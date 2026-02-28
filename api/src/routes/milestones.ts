import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getPresignedUploadUrl } from "../services/s3.js";
import { computeGstinHashHex, normalizeGstin, validateGstin } from "../services/gstin.service.js";

export const milestonesRouter = Router();

const MIN_VOTING_WINDOW_SECS = 172_800; // 48 hours
const MAX_VOTING_WINDOW_SECS = 604_800; // 7 days

function firstParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Proof Submission (GST-verified)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/milestones/:id/proof/presign
 * Get a presigned S3 URL for uploading the GST invoice file.
 * Creator uploads the invoice, then calls /proof/submit with the S3 key + GSTIN.
 */
milestonesRouter.post("/:id/proof/presign", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { fileName, contentType } = req.body;
        if (!fileName || !contentType) {
            res.status(400).json({ error: "fileName and contentType required" });
            return;
        }

        const milestoneId = firstParam(req.params.id);
        if (!milestoneId) {
            res.status(400).json({ error: "milestone id is required" });
            return;
        }
        const key = `milestones/${milestoneId}/proof/${Date.now()}-${fileName}`;
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);

        res.json({ uploadUrl, s3Key: key, publicUrl });
    } catch (err) {
        console.error("[milestones/proof/presign]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/milestones/:id/proof
 * Submit proof for a milestone.
 *
 * Body:
 *   gstin?: string           — Vendor GSTIN (required unless isUnregisteredVendor = true)
 *   isUnregisteredVendor?: boolean — true for vendors below GST threshold
 *   invoiceNumber?: string
 *   invoiceAmountPaise?: number
 *   invoiceS3Key: string     — S3 key of uploaded invoice file
 *   proofNote?: string       — Creator's explanation
 *   votingWindowSecs?: number — Desired voting window (clamped to 48h–7d)
 *
 * Returns:
 *   milestoneProof record + invoiceHash (to use when calling Anchor submit_milestone_proof)
 */
milestonesRouter.post("/:id/proof", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const milestoneId = firstParam(req.params.id);
        if (!milestoneId) {
            res.status(400).json({ error: "milestone id is required" });
            return;
        }

        const {
            gstin,
            isUnregisteredVendor = false,
            invoiceNumber,
            invoiceAmountPaise,
            invoiceS3Key,
            proofNote,
            votingWindowSecs,
        } = req.body;

        if (!invoiceS3Key) {
            res.status(400).json({ error: "invoiceS3Key is required" });
            return;
        }

        // ── 1. Fetch the milestone ──────────────────────────────────────────
        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                campaign: { include: { org: { include: { user: true } } } },
                proof: true,
            },
        });

        if (!milestone) {
            res.status(404).json({ error: "Milestone not found" });
            return;
        }
        if (milestone.proof) {
            res.status(409).json({ error: "Proof already submitted for this milestone" });
            return;
        }

        // ── 2. GSTIN validation ─────────────────────────────────────────────
        // Two independent GSTIN checks:
        //   a) Org GSTIN  — proves the org is a real registered entity (stored at onboarding)
        //   b) Vendor GSTIN — proves the vendor they PAID is a real business
        // They are different GSTINs: org is the BUYER, vendor is the SUPPLIER on the invoice.
        let gstinVerified = false;
        let vendorLegalName: string | undefined;
        let vendorState: string | undefined;
        let normalizedGstin: string | undefined;
        let vendorGstinHash = "0".repeat(64);

        // Ensure the org itself has a registered GSTIN (set during org onboarding)
        const orgGstin = milestone.campaign.org.gstin
            ? normalizeGstin(milestone.campaign.org.gstin)
            : undefined;
        if (!orgGstin) {
            res.status(409).json({
                error: "Org GSTIN is missing. Add your org GSTIN in the org profile before submitting proof.",
            });
            return;
        }

        if (!isUnregisteredVendor) {
            if (!gstin) {
                res.status(400).json({
                    error: "gstin is required unless isUnregisteredVendor is true",
                });
                return;
            }

            // Validate the VENDOR's GSTIN (they are the invoice supplier, not the org)
            normalizedGstin = normalizeGstin(String(gstin));

            const gstResult = await validateGstin(normalizedGstin);
            if (!gstResult.isValid) {
                res.status(422).json({
                    error: `Vendor GSTIN validation failed: ${gstResult.error}`,
                    vendorGstin: normalizedGstin,
                });
                return;
            }

            gstinVerified = true;
            vendorLegalName = gstResult.legalName;
            vendorState = gstResult.state;
            vendorGstinHash = computeGstinHashHex(normalizedGstin);
        }

        // ── 3. Compute invoice hash (for on-chain storage + tamper detection) ──
        // We hash the S3 key + gstin + invoice number as a deterministic commitment.
        // In a production system you'd download the actual file and hash its bytes.
        const hashInput = [invoiceS3Key, normalizedGstin ?? "unregistered", invoiceNumber ?? ""].join("|");
        const invoiceHash = crypto.createHash("sha256").update(hashInput).digest("hex");

        // ── 4. Build prev proof hash (Proof-of-History chain link) ──────────
        // Find the previous milestone's proof (sorted by index) for the same campaign
        const prevMilestone = await prisma.milestone.findFirst({
            where: {
                campaignId: milestone.campaignId,
                index: { lt: milestone.index },
                proof: { isNot: null },
            },
            orderBy: { index: "desc" },
            include: { proof: true },
        });
        const prevProofHash = prevMilestone?.proof?.invoiceHash ?? null;

        // ── 5. Save MilestoneProof ──────────────────────────────────────────
        const milestoneProof = await prisma.milestoneProof.create({
            data: {
                milestoneId,
                gstin: isUnregisteredVendor ? null : normalizedGstin,
                gstinVerified,
                vendorLegalName,
                vendorState,
                isUnregisteredVendor,
                invoiceNumber,
                invoiceAmountPaise: invoiceAmountPaise ? BigInt(invoiceAmountPaise) : null,
                invoiceS3Key,
                invoiceHash,
                prevProofHash,
            },
        });

        // ── 6. Update milestone state + proof note ──────────────────────────
        const windowSecs = Math.min(
            Math.max(Number(votingWindowSecs ?? MIN_VOTING_WINDOW_SECS), MIN_VOTING_WINDOW_SECS),
            MAX_VOTING_WINDOW_SECS
        );
        await prisma.milestone.update({
            where: { id: milestoneId },
            data: {
                proofUri: invoiceS3Key,
                proofNote,
                votingWindowSecs: windowSecs,
                state: "UNDER_REVIEW",
            },
        });

        res.status(201).json({
            milestoneProof: {
                ...milestoneProof,
                invoiceAmountPaise: milestoneProof.invoiceAmountPaise?.toString(),
            },
            // Return this for the frontend to pass to the Anchor submit_milestone_proof call
            invoiceHash,
            vendorGstinHash,
            vendorGstinHashBytes: Array.from(Buffer.from(vendorGstinHash, "hex")),
            prevProofHash,
            votingWindowSecs: windowSecs,
            message: isUnregisteredVendor
                ? "Proof saved — unregistered vendor (⚠️ badge will be shown to donors)"
                : `Proof saved — GSTIN verified: ${vendorLegalName} (${vendorState})`,
        });
    } catch (err) {
        console.error("[milestones/proof]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/milestones/:id/proof
 * Get the proof details for a milestone (visible to donors during voting).
 */
milestonesRouter.get("/:id/proof", async (req, res) => {
    try {
        const milestoneId = firstParam(req.params.id);
        if (!milestoneId) {
            res.status(400).json({ error: "milestone id is required" });
            return;
        }
        const proof = await prisma.milestoneProof.findUnique({
            where: { milestoneId },
        });

        if (!proof) {
            res.status(404).json({ error: "No proof submitted yet" });
            return;
        }

        res.json({
            proof: {
                ...proof,
                invoiceAmountPaise: proof.invoiceAmountPaise?.toString(),
            },
        });
    } catch (err) {
        console.error("[milestones/proof/get]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/milestones/:id/proof/onchain-confirmed
 * Called by frontend after Anchor tx confirmed — stores the on-chain proof URI.
 */
milestonesRouter.post("/:id/proof/onchain-confirmed", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const milestoneId = firstParam(req.params.id);
        if (!milestoneId) {
            res.status(400).json({ error: "milestone id is required" });
            return;
        }
        const { onchainProofUri, txSignature } = req.body;

        await prisma.milestoneProof.update({
            where: { milestoneId },
            data: { onchainProofUri },
        });

        res.json({ success: true, txSignature });
    } catch (err) {
        console.error("[milestones/proof/confirm]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DPR Progress Updates (Commit-style timeline)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/milestones/:id/updates
 * Creator posts a DPR progress update (like a git commit).
 * Can include photos, descriptions, expense notes.
 * Can be posted any time — before, during, or after voting.
 *
 * Body:
 *   type: "PROGRESS" | "EXPENSE" | "PHOTO" | "ANNOUNCEMENT" | "COMPLETION"
 *   title: string
 *   description?: string
 *   mediaUrls?: string[] — S3 keys of uploaded photos/docs
 */
milestonesRouter.post("/:id/updates", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const milestoneId = firstParam(req.params.id);
        if (!milestoneId) {
            res.status(400).json({ error: "milestone id is required" });
            return;
        }
        const { type = "PROGRESS", title, description, mediaUrls = [] } = req.body;

        if (!title) {
            res.status(400).json({ error: "title is required" });
            return;
        }

        // Verify the milestone exists
        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: { campaign: { include: { org: { include: { user: true } } } } },
        });
        if (!milestone) {
            res.status(404).json({ error: "Milestone not found" });
            return;
        }

        // Compute content hash for authenticity
        const contentHash = crypto
            .createHash("sha256")
            .update(`${title}|${description ?? ""}|${milestoneId}`)
            .digest("hex");

        const update = await prisma.milestoneUpdate.create({
            data: {
                milestoneId,
                type,
                title,
                description,
                mediaUrls,
                creatorWallet: milestone.campaign.org.user.walletAddress ?? undefined,
                contentHash,
            },
        });

        res.status(201).json({ update });
    } catch (err) {
        console.error("[milestones/updates/create]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /api/milestones/:id/updates/presign
 * Get presigned URL for uploading media attached to a DPR update.
 */
milestonesRouter.post("/:id/updates/presign", requireAuth, async (req: AuthedRequest, res) => {
    try {
        const { fileName, contentType } = req.body;
        const milestoneId = firstParam(req.params.id);
        if (!milestoneId) {
            res.status(400).json({ error: "milestone id is required" });
            return;
        }
        const key = `milestones/${milestoneId}/updates/${Date.now()}-${fileName}`;
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, contentType);
        res.json({ uploadUrl, s3Key: key, publicUrl });
    } catch (err) {
        console.error("[milestones/updates/presign]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/milestones/:id/updates
 * Get all DPR updates for a milestone (public — visible to donors).
 * Ordered by postedAt ASC for timeline view.
 */
milestonesRouter.get("/:id/updates", async (req, res) => {
    try {
        const milestoneId = firstParam(req.params.id);
        if (!milestoneId) {
            res.status(400).json({ error: "milestone id is required" });
            return;
        }
        const updates = await prisma.milestoneUpdate.findMany({
            where: { milestoneId },
            orderBy: { postedAt: "asc" },
        });
        res.json({ updates });
    } catch (err) {
        console.error("[milestones/updates/list]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/milestones/:id/full
 * Full milestone detail: milestone + proof + DPR update timeline.
 * Used by the voting page and campaign detail.
 */
milestonesRouter.get("/:id/full", async (req, res) => {
    try {
        const milestoneId = firstParam(req.params.id);
        if (!milestoneId) {
            res.status(400).json({ error: "milestone id is required" });
            return;
        }
        const milestone = await prisma.milestone.findUnique({
            where: { id: milestoneId },
            include: {
                proof: true,
                updates: { orderBy: { postedAt: "asc" } },
                campaign: {
                    select: {
                        id: true, title: true, raisedLamports: true,
                        org: { select: { id: true, name: true, logoUrl: true } },
                    },
                },
            },
        });

        if (!milestone) {
            res.status(404).json({ error: "Milestone not found" });
            return;
        }

        res.json({
            milestone: {
                ...milestone,
                amountLamports: milestone.amountLamports.toString(),
                proof: milestone.proof
                    ? {
                        ...milestone.proof,
                        invoiceAmountPaise: milestone.proof.invoiceAmountPaise?.toString(),
                    }
                    : null,
                campaign: {
                    ...milestone.campaign,
                    raisedLamports: milestone.campaign.raisedLamports.toString(),
                },
            },
        });
    } catch (err) {
        console.error("[milestones/full]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * GET /api/campaigns/:campaignId/proof-chain
 * Returns the full Proof-of-History chain for a campaign —
 * all milestone proofs in order, linked by prevProofHash.
 * Perfect for the /audit page.
 */
milestonesRouter.get("/campaign/:campaignId/proof-chain", async (req, res) => {
    try {
        const campaignId = firstParam(req.params.campaignId);
        if (!campaignId) {
            res.status(400).json({ error: "campaign id is required" });
            return;
        }
        const milestones = await prisma.milestone.findMany({
            where: { campaignId },
            orderBy: { index: "asc" },
            include: {
                proof: true,
                updates: { orderBy: { postedAt: "asc" } },
            },
        });

        const chain = milestones.map(m => ({
            id: m.id,
            index: m.index,
            title: m.title,
            dprPhaseLabel: m.dprPhaseLabel,
            state: m.state,
            proof: m.proof
                ? {
                    gstin: m.proof.gstin,
                    gstinVerified: m.proof.gstinVerified,
                    vendorLegalName: m.proof.vendorLegalName,
                    vendorState: m.proof.vendorState,
                    isUnregisteredVendor: m.proof.isUnregisteredVendor,
                    invoiceHash: m.proof.invoiceHash,
                    prevProofHash: m.proof.prevProofHash,
                    onchainProofUri: m.proof.onchainProofUri,
                    submittedAt: m.proof.submittedAt,
                }
                : null,
            updates: m.updates,
            updateCount: m.updates.length,
        }));

        res.json({ chain });
    } catch (err) {
        console.error("[milestones/proof-chain]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
