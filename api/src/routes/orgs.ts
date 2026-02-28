import { Router } from "express";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getPresignedUploadUrl } from "../services/s3.js";
import { computeGstinHashHex, normalizeGstin, validateGstin } from "../services/gstin.service.js";

export const orgsRouter = Router();

/**
 * POST /api/orgs/gstin/verify
 * Validates GSTIN and returns hash to use in on-chain create_org.
 */
orgsRouter.post("/gstin/verify", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const gstinInput = String(req.body?.gstin ?? "");
        if (!gstinInput) {
            res.status(400).json({ error: "gstin is required" });
            return;
        }

        const gstin = normalizeGstin(gstinInput);
        const gst = await validateGstin(gstin);
        if (!gst.isValid) {
            res.status(422).json({ error: gst.error ?? "GSTIN validation failed", gstin });
            return;
        }

        const gstinHashHex = computeGstinHashHex(gstin);
        const gstinHashBytes = Array.from(Buffer.from(gstinHashHex, "hex"));

        res.json({
            gstin,
            gstinHashHex,
            gstinHashBytes,
            gstProfile: {
                legalName: gst.legalName,
                tradeName: gst.tradeName,
                state: gst.state,
                stateCode: gst.stateCode,
                status: gst.status,
                registrationDate: gst.registrationDate,
            },
            warning: gst.error,
        });
    } catch (err) {
        console.error("[orgs/gstin/verify]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/orgs
 * Register an org after `create_org` is confirmed on-chain.
 */
orgsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { privyId: req.user!.privyId } });
        if (!user) { res.status(404).json({ error: "User not found" }); return; }

        const { name, description, category, websiteUrl, twitterHandle, onchainPda, gstin: gstinInput } = req.body;
        if (!gstinInput) {
            res.status(400).json({ error: "gstin is required" });
            return;
        }

        const gstin = normalizeGstin(String(gstinInput));
        const gst = await validateGstin(gstin);
        if (!gst.isValid) {
            res.status(422).json({ error: gst.error ?? "GSTIN validation failed", gstin });
            return;
        }

        const gstinHashHex = computeGstinHashHex(gstin);
        const now = new Date();

        const org = await prisma.org.create({
            data: {
                userId: user.id,
                name,
                description,
                category: category ?? "OTHER",
                websiteUrl,
                twitterHandle,
                onchainPda,
                onchainGstinHash: gstinHashHex,
                gstin,
                gstinVerified: true,
                gstinLegalName: gst.legalName,
                gstinTradeName: gst.tradeName,
                gstinState: gst.state,
                gstinStateCode: gst.stateCode,
                gstinStatus: gst.status,
                gstinRegistrationDate: gst.registrationDate,
                gstinVerifiedAt: now,
                gstinLastCheckedAt: now,
            },
        });

        res.status(201).json({
            org,
            gstinHashHex,
            gstinHashBytes: Array.from(Buffer.from(gstinHashHex, "hex")),
            gstWarning: gst.error,
        });
    } catch (err: any) {
        if (err.code === "P2002") { res.status(409).json({ error: "Org already exists or GSTIN already in use" }); return; }
        console.error("[orgs/create]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/orgs/:walletAddress
 * Fetch org by wallet address + all campaigns summary.
 */
orgsRouter.get("/:walletAddress", async (req, res) => {
    try {
        const key = req.params.walletAddress;
        let user = await prisma.user.findUnique({
            where: { walletAddress: key },
            include: {
                org: {
                    include: {
                        campaigns: {
                            select: {
                                id: true,
                                title: true,
                                state: true,
                                raisedLamports: true,
                                totalGoalLamports: true,
                                createdAt: true,
                            },
                            orderBy: { createdAt: "desc" },
                        },
                    },
                },
            },
        });

        // Backward-compatible fallback: allow org id in this route.
        if (!user?.org) {
            const orgById = await prisma.org.findUnique({
                where: { id: key },
                include: {
                    user: true,
                    campaigns: {
                        select: {
                            id: true,
                            title: true,
                            state: true,
                            raisedLamports: true,
                            totalGoalLamports: true,
                            createdAt: true,
                        },
                        orderBy: { createdAt: "desc" },
                    },
                },
            });
            if (!orgById) {
                res.status(404).json({ error: "Org not found" });
                return;
            }
            res.json({
                org: {
                    ...orgById,
                    walletAddress: orgById.user?.walletAddress ?? null,
                },
            });
            return;
        }
        res.json({
            org: {
                ...user.org,
                walletAddress: user.walletAddress ?? null,
            },
        });
    } catch (err) {
        console.error("[orgs/get]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/orgs/:id/upload-doc
 * Returns a presigned S3 URL for uploading a verification document.
 */
orgsRouter.post("/:id/upload-doc", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { fileName, contentType } = req.body;
        if (!fileName || !contentType) { res.status(400).json({ error: "fileName and contentType required" }); return; }

        const key = `orgs/${req.params.id}/docs/${Date.now()}-${fileName}`;
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

        // Save the doc URL to the org
        await prisma.org.update({
            where: { id: req.params.id as string},
            data: { docUrls: { push: publicUrl } },
        });

        res.json({ uploadUrl, publicUrl });
    } catch (err) {
        console.error("[orgs/upload-doc]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * PATCH /api/orgs/:id/logo
 * Returns presigned URL for org logo upload.
 */
orgsRouter.patch("/:id/logo", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { fileName, contentType } = req.body;
        const key = `orgs/${req.params.id}/logo/${fileName}`;
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

        await prisma.org.update({
            where: { id: req.params.id as string },
            data: { logoUrl: publicUrl },
        });

        res.json({ uploadUrl, publicUrl });
    } catch (err) {
        console.error("[orgs/logo]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
