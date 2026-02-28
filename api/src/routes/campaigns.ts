import { Router } from "express";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getPresignedUploadUrl } from "../services/s3.js";

export const campaignsRouter = Router();

/**
 * POST /api/campaigns
 * Save off-chain campaign metadata after on-chain create_project confirmed.
 */
campaignsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { privyId: req.user!.privyId },
            include: { org: true },
        });

        if (!user?.org) { res.status(403).json({ error: "Must have an org to create campaigns" }); return; }

        const {
            title, description, category, tags,
            onchainProjectPda, onchainVaultPda, projectIdBytes,
            hasGoal, totalGoalLamports, prefrontLamports, prefrontTranches,
            yieldPolicy, deadline, milestones,
        } = req.body;

        const campaign = await prisma.campaign.create({
            data: {
                orgId: user.org.id,
                title,
                description,
                category,
                tags: tags ?? [],
                onchainProjectPda,
                onchainVaultPda,
                projectIdBytes,
                hasGoal: hasGoal ?? true,
                totalGoalLamports: BigInt(totalGoalLamports ?? 0),
                prefrontLamports: BigInt(prefrontLamports ?? 0),
                prefrontTranches: prefrontTranches ?? 0,
                yieldPolicy: yieldPolicy ?? 0,
                deadline: deadline ? new Date(deadline) : undefined,
                milestones: {
                    create: (milestones ?? []).map((m: any, i: number) => ({
                        index: i,
                        title: m.title,
                        description: m.description,
                        amountLamports: BigInt(m.amountLamports ?? 0),
                        releasePctBps: m.releasePctBps ?? 0,
                        thresholdBps: m.thresholdBps ?? 5100,
                        quorumBps: m.quorumBps ?? 1000,
                        dprPhaseLabel: m.dprPhaseLabel,
                        votingWindowSecs: Math.min(
                            Math.max(Number(m.votingWindowSecs ?? 172800), 172800), // min 48h
                            604800 // max 7d
                        ),
                        deadline: m.deadline ? new Date(m.deadline) : undefined,
                    })),
                },
            },
            include: { milestones: true },
        });

        // Update org campaigns_created count
        await prisma.org.update({
            where: { id: user.org.id },
            data: { campaignsCreated: { increment: 1 } },
        });

        res.status(201).json({ campaign });
    } catch (err) {
        console.error("[campaigns/create]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/campaigns
 * List campaigns with optional filtering.
 */
campaignsRouter.get("/", async (req, res) => {
    try {
        const { state, category, search, limit = "20", offset = "0" } = req.query as Record<string, string>;

        const campaigns = await prisma.campaign.findMany({
            where: {
                state: state ? (state as any) : "ACTIVE",
                category: category ? { equals: category, mode: "insensitive" } : undefined,
                OR: search
                    ? [
                        { title: { contains: search, mode: "insensitive" } },
                        { description: { contains: search, mode: "insensitive" } },
                    ]
                    : undefined,
            },
            include: {
                org: { select: { id: true, name: true, logoUrl: true, completionRateBps: true, verified: true } },
                milestones: { select: { id: true, index: true, title: true, state: true, amountLamports: true } },
                _count: { select: { donations: true } },
            },
            orderBy: { createdAt: "desc" },
            take: parseInt(limit),
            skip: parseInt(offset),
        });

        res.json({
            campaigns: campaigns.map(c => ({
                ...c,
                totalGoalLamports: c.totalGoalLamports.toString(),
                raisedLamports: c.raisedLamports.toString(),
                prefrontLamports: c.prefrontLamports.toString(),
                milestones: c.milestones.map(m => ({
                    ...m,
                    amountLamports: m.amountLamports.toString(),
                })),
            })),
        });
    } catch (err) {
        console.error("[campaigns/list]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/campaigns/:id
 * Full campaign detail including donations + yield accruals.
 */
campaignsRouter.get("/:id", async (req, res) => {
    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id: req.params.id },
            include: {
                org: {
                    include: {
                        user: { select: { walletAddress: true } },
                    },
                },
                milestones: { orderBy: { index: "asc" } },
                donations: {
                    orderBy: { createdAt: "desc" },
                    take: 50,
                    select: {
                        id: true, amountLamports: true, amountInr: true,
                        paymentType: true, donorWallet: true, confirmed: true, createdAt: true,
                    },
                },
                yieldAccruals: {
                    orderBy: { periodDate: "desc" },
                    take: 30,
                    select: { yieldLamports: true, periodDate: true, yieldRateBps: true },
                },
                _count: { select: { donations: true } },
            },
        });

        if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

        // Serialize BigInt
        res.json({
            campaign: {
                ...campaign,
                org: {
                    ...campaign.org,
                    walletAddress: campaign.org.user?.walletAddress ?? null,
                },
                totalGoalLamports: campaign.totalGoalLamports.toString(),
                raisedLamports: campaign.raisedLamports.toString(),
                prefrontLamports: campaign.prefrontLamports.toString(),
                milestones: campaign.milestones.map(m => ({
                    ...m,
                    amountLamports: m.amountLamports.toString(),
                })),
                donations: campaign.donations.map(d => ({
                    ...d,
                    amountLamports: d.amountLamports.toString(),
                })),
                yieldAccruals: campaign.yieldAccruals.map(y => ({
                    ...y,
                    yieldLamports: y.yieldLamports.toString(),
                })),
            },
        });
    } catch (err) {
        console.error("[campaigns/get]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/campaigns/:id/upload-banner
 * S3 presigned URL for campaign banner image.
 */
campaignsRouter.post("/:id/upload-banner", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { fileName, contentType } = req.body;
        const key = `campaigns/${req.params.id}/banner/${fileName}`;
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

        await prisma.campaign.update({
            where: { id: req.params.id as string },
            data: { bannerUrl: publicUrl },
        });

        res.json({ uploadUrl, publicUrl });
    } catch (err) {
        console.error("[campaigns/upload-banner]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/campaigns/:id/milestones/:index/upload-proof
 * S3 presigned URL for milestone proof. Returns key to store on-chain as URI.
 * Enforces minimum 24h voting window.
 */
campaignsRouter.post("/:id/milestones/:index/upload-proof", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { fileName, contentType, votingWindowSecs } = req.body;
        const index = parseInt(req.params.index as string);

        // Enforce min 24h voting window
        const windowSecs = Math.max(Number(votingWindowSecs ?? 172800), 86400);

        const key = `campaigns/${req.params.id}/milestones/${index}/proof-${Date.now()}-${fileName}`;
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

        // Update milestone record
        await prisma.milestone.updateMany({
            where: { campaignId: req.params.id as string, index },
            data: { proofUri: publicUrl, votingWindowSecs: windowSecs, state: "UNDER_REVIEW" },
        });

        res.json({ uploadUrl, publicUrl, proofUri: publicUrl, windowSecs });
    } catch (err) {
        console.error("[campaigns/upload-proof]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});


/**
 * PATCH /api/campaigns/:id/onchain
 * Save PDA addresses after on-chain create_project tx.
 */
campaignsRouter.patch("/:id/onchain", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { onchainProjectPda, onchainVaultPda, projectIdBytes, onchainOrgPda } = req.body;
        const campaign = await prisma.campaign.update({
            where: { id: req.params.id as string },
            data: {
                ...(onchainProjectPda ? { onchainProjectPda } : {}),
                ...(onchainVaultPda ? { onchainVaultPda } : {}),
                ...(projectIdBytes ? { projectIdBytes } : {}),
            },
        });
        if (onchainOrgPda && campaign.orgId) {
            await prisma.org.update({
                where: { id: campaign.orgId },
                data: { onchainPda: onchainOrgPda },
            }).catch(() => { });
        }
        res.json({ campaign: { ...campaign, totalGoalLamports: campaign.totalGoalLamports.toString(), raisedLamports: campaign.raisedLamports.toString() } });
    } catch (err) {
        console.error("[campaigns/onchain]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
