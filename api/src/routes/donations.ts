import type { Request, Response } from "express";
import { Router } from "express";
import { createHmac } from "crypto";
import Razorpay from "razorpay";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { sendSolFromHotWallet } from "../services/solana.js";

export const donationsRouter = Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// Demo rate: 1 SOL = ₹4,000
const SOL_INR_RATE = Number(process.env.SOL_INR_RATE ?? 4000);
const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * POST /api/donations/upi-intent
 * Create a Razorpay order for a UPI donation.
 */
donationsRouter.post("/upi-intent", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { campaignId, amountInr } = req.body;

        if (!campaignId || !amountInr || amountInr < 1) {
            res.status(400).json({ error: "campaignId and amountInr (min ₹1) required" });
            return;
        }

        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
        if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
        if (campaign.state !== "ACTIVE") { res.status(400).json({ error: "Campaign is not active" }); return; }

        // Create Razorpay order (amount is in paise)
        const order = await razorpay.orders.create({
            amount: amountInr * 100,
            currency: "INR",
            notes: { campaignId, privyId: req.user!.privyId },
        });

        // Calculate SOL equivalent
        const lamports = Math.floor((amountInr / SOL_INR_RATE) * LAMPORTS_PER_SOL);

        // Pre-create donation record (unconfirmed)
        const user = await prisma.user.findUnique({ where: { privyId: req.user!.privyId } });
        await prisma.donation.create({
            data: {
                campaignId,
                userId: user?.id,
                amountLamports: BigInt(lamports),
                amountInr,
                paymentType: "UPI",
                razorpayOrderId: order.id as string,
                confirmed: false,
            },
        });

        res.json({
            orderId: order.id,
            amountInr,
            lamports,
            solRate: SOL_INR_RATE,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (err) {
        console.error("[donations/upi-intent]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/donations/upi-webhook
 * Razorpay webhook — raw body needed for HMAC verification.
 * On payment.captured: convert to SOL, send from hot wallet to vault.
 */
donationsRouter.post("/upi-webhook", async (req: Request, res: Response) => {
    try {
        const signature = req.headers["x-razorpay-signature"] as string;
        const rawBody = req.body as Buffer;
        console.log(`[upi-webhook] ${rawBody.toString()}`);

        // Verify HMAC signature
        const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(rawBody)
            .digest("hex");

        if (expected !== signature) {
            res.status(400).json({ error: "Invalid signature" });
            return;
        }

        const event = JSON.parse(rawBody.toString());

        if (event.event === "payment.captured") {
            const payment = event.payload.payment.entity;
            const orderId: string = payment.order_id;

            const donation = await prisma.donation.findUnique({ where: { razorpayOrderId: orderId } });
            if (!donation || donation.confirmed) { res.json({ ok: true }); return; }

            const campaign = await prisma.campaign.findUnique({ where: { id: donation.campaignId } });
            if (!campaign?.onchainVaultPda) {
                console.error(`[upi-webhook] No vault PDA for campaign ${donation.campaignId}`);
                res.json({ ok: true }); return;
            }

            // Send SOL from hot wallet to vault
            const txSig = await sendSolFromHotWallet(
                campaign.onchainVaultPda,
                Number(donation.amountLamports)
            );

            // Confirm donation + update raised amount
            await prisma.$transaction([
                prisma.donation.update({
                    where: { razorpayOrderId: orderId },
                    data: {
                        confirmed: true,
                        razorpayPaymentId: payment.id,
                        txSignature: txSig,
                    },
                }),
                prisma.campaign.update({
                    where: { id: donation.campaignId },
                    data: { raisedLamports: { increment: donation.amountLamports } },
                }),
            ]);

            console.log(`[upi-webhook] ✅ ${Number(donation.amountLamports)} lamports → ${campaign.onchainVaultPda} | tx: ${txSig}`);
        }

        res.json({ ok: true });
    } catch (err) {
        console.error("[donations/upi-webhook]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/donations/sol
 * Record an on-chain SOL donation after the donor's tx confirms.
 */
donationsRouter.post("/sol", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { campaignId, amountLamports, txSignature, donorWallet } = req.body;

        if (!campaignId || !amountLamports || !txSignature) {
            res.status(400).json({ error: "campaignId, amountLamports, and txSignature required" });
            return;
        }

        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
        if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

        // Prevent duplicate recording
        const existing = await prisma.donation.findUnique({ where: { txSignature } });
        if (existing) { res.json({ donation: { ...existing, amountLamports: existing.amountLamports.toString() } }); return; }

        const user = await prisma.user.findUnique({ where: { privyId: req.user!.privyId } });

        const [donation] = await prisma.$transaction([
            prisma.donation.create({
                data: {
                    campaignId,
                    userId: user?.id,
                    donorWallet: donorWallet ?? user?.walletAddress,
                    amountLamports: BigInt(amountLamports),
                    paymentType: "SOL",
                    txSignature,
                    confirmed: true,
                },
            }),
            prisma.campaign.update({
                where: { id: campaignId },
                data: { raisedLamports: { increment: BigInt(amountLamports) } },
            }),
        ]);

        res.status(201).json({ donation: { ...donation, amountLamports: donation.amountLamports.toString() } });
    } catch (err: any) {
        if (err.code === "P2002") { res.json({ ok: true, msg: "Donation already recorded" }); return; }
        console.error("[donations/sol]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/donations/:campaignId
 * List confirmed donations for a campaign.
 */
donationsRouter.get("/:campaignId", async (req, res) => {
    try {
        const donations = await prisma.donation.findMany({
            where: { campaignId: req.params.campaignId, confirmed: true },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
                id: true, amountLamports: true, amountInr: true,
                paymentType: true, donorWallet: true, txSignature: true, createdAt: true,
            },
        });

        res.json({
            donations: donations.map(d => ({ ...d, amountLamports: d.amountLamports.toString() })),
        });
    } catch (err) {
        console.error("[donations/list]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
