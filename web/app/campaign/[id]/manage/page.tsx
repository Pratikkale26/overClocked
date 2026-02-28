"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { ArrowLeft, Upload, Plus, FileText } from "lucide-react";
import { Navbar } from "../../../../components/layout/Navbar";
import { DprTimeline } from "../../../../components/campaigns/DprTimeline";
import {
    fetchCampaign, fetchMilestoneUpdates, postMilestoneUpdate,
    submitMilestoneProof, presignProofUpload,
    type Campaign, type Milestone, type MilestoneUpdate,
} from "../../../../lib/api";

const UPDATE_TYPES = ["PROGRESS", "EXPENSE", "PHOTO", "COMPLETION", "ANNOUNCEMENT"];

export default function ManageCampaignPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { authenticated } = usePrivy();
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
    const [updates, setUpdates] = useState<MilestoneUpdate[]>([]);

    // Proof form
    const [proofLoading, setProofLoading] = useState(false);
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [gstin, setGstin] = useState("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [invoiceAmount, setInvoiceAmount] = useState("");
    const [isUnregistered, setIsUnregistered] = useState(false);
    const [votingHours, setVotingHours] = useState(72);

    // DPR update form
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateType, setUpdateType] = useState("PROGRESS");
    const [updateTitle, setUpdateTitle] = useState("");
    const [updateDesc, setUpdateDesc] = useState("");

    const load = useCallback(async () => {
        try {
            const c = await fetchCampaign(id);
            setCampaign(c);
            // Find the current actionable milestone
            const target = c.milestones?.find((m) => m.state === "PENDING" || m.state === "UNDER_REVIEW")
                ?? c.milestones?.[0];
            if (target) {
                setActiveMilestone(target);
                const u = await fetchMilestoneUpdates(target.id);
                setUpdates(u);
            }
        } catch {
            setCampaign(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    // ── Submit Proof ──────────────────────────────────────────────────────────
    const handleSubmitProof = async () => {
        if (!activeMilestone) return;
        if (!isUnregistered && !gstin) { toast.error("Enter vendor GSTIN or mark as unregistered"); return; }
        if (!invoiceFile) { toast.error("Upload the invoice PDF/image first"); return; }

        setProofLoading(true);
        try {
            // 1. Get presigned URL and upload to S3
            const { uploadUrl, s3Key } = await presignProofUpload(
                activeMilestone.id,
                invoiceFile.name,
                invoiceFile.type,
            );
            await fetch(uploadUrl, { method: "PUT", body: invoiceFile, headers: { "Content-Type": invoiceFile.type } });

            // 2. Submit proof to backend (validates GSTIN, computes hash, opens voting)
            await submitMilestoneProof(activeMilestone.id, {
                gstin: isUnregistered ? undefined : gstin.toUpperCase().trim(),
                isUnregisteredVendor: isUnregistered,
                invoiceS3Key: s3Key,
                invoiceNumber: invoiceNumber || undefined,
                invoiceAmount: invoiceAmount ? parseFloat(invoiceAmount) : undefined,
                votingWindowSecs: votingHours * 3600,
            });

            toast.success("Proof submitted!", {
                description: `Voting window is now open (${votingHours}h). Donors will be notified.`,
            });
            await load();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            toast.error("Proof submission failed", { description: msg });
        } finally {
            setProofLoading(false);
        }
    };

    // ── Post DPR Update ───────────────────────────────────────────────────────
    const handlePostUpdate = async () => {
        if (!activeMilestone || !updateTitle.trim()) return;
        setUpdateLoading(true);
        try {
            await postMilestoneUpdate(activeMilestone.id, {
                type: updateType,
                title: updateTitle.trim(),
                description: updateDesc.trim() || undefined,
            });
            toast.success("Update posted!", { description: "Visible on the campaign page." });
            setUpdateTitle("");
            setUpdateDesc("");
            await load();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            toast.error("Failed to post update", { description: msg });
        } finally {
            setUpdateLoading(false);
        }
    };

    if (!authenticated) {
        return (
            <div><Navbar />
                <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
                    <h2>Sign in to manage your campaign</h2>
                </div>
            </div>
        );
    }

    if (loading) {
        return <div><Navbar /><main className="container" style={{ paddingTop: 44 }}><div className="skeleton" style={{ height: 200, borderRadius: 16 }} /></main></div>;
    }

    if (!campaign) {
        return <div><Navbar /><main className="container" style={{ paddingTop: 60, textAlign: "center" }}><h2>Campaign not found</h2></main></div>;
    }

    const canSubmitProof = activeMilestone?.state === "PENDING";
    const isUnderReview = activeMilestone?.state === "UNDER_REVIEW";

    return (
        <div>
            <Navbar />
            <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>

                {/* Header */}
                <div style={{ marginBottom: 28 }}>
                    <Link href={`/campaign/${id}`}>
                        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
                            <ArrowLeft size={14} /> Back to Campaign
                        </button>
                    </Link>
                    <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 6 }}>
                        Manage Campaign
                    </h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{campaign.title}</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

                    {/* ── Left: proof submission ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                        {/* Active phase indicator */}
                        {activeMilestone && (
                            <div style={{
                                padding: "14px 18px",
                                background: isUnderReview ? "rgba(245,158,11,0.06)" : "rgba(124,58,237,0.06)",
                                border: `1px solid ${isUnderReview ? "rgba(245,158,11,0.3)" : "rgba(124,58,237,0.25)"}`,
                                borderRadius: 12,
                            }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: isUnderReview ? "var(--warning)" : "var(--violet-light)", textTransform: "uppercase", marginBottom: 4 }}>
                                    {isUnderReview ? "🗳️ Voting in progress" : "⏳ Active Phase"}
                                </div>
                                <div style={{ fontWeight: 700 }}>
                                    Phase {activeMilestone.index + 1}: {activeMilestone.title}
                                </div>
                                {isUnderReview && (
                                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                                        Donors are reviewing your proof and voting. You cannot resubmit until voting concludes.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Submit Proof form */}
                        <div className="card" style={{ padding: 24 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                                <FileText size={16} /> Submit Phase Proof
                            </h2>

                            {isUnderReview ? (
                                <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "20px 0", textAlign: "center" }}>
                                    ⏳ Proof submitted. Voting window is active. Wait for donors to vote.
                                </div>
                            ) : !canSubmitProof ? (
                                <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "20px 0", textAlign: "center" }}>
                                    This phase is {activeMilestone?.state?.toLowerCase()}.
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                                    {/* Unregistered vendor toggle */}
                                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                                        <input type="checkbox" checked={isUnregistered} onChange={(e) => setIsUnregistered(e.target.checked)} />
                                        <span style={{ fontSize: 13 }}>Vendor is unregistered (below ₹40L GST threshold)</span>
                                    </label>

                                    {!isUnregistered && (
                                        <div>
                                            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
                                                Vendor GSTIN *
                                            </label>
                                            <input
                                                className="input"
                                                placeholder="e.g. 27AABCE1234F1Z5"
                                                value={gstin}
                                                maxLength={15}
                                                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                                                style={{ fontFamily: "monospace" }}
                                            />
                                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                                Backend will validate via GST API → vendor legal name displayed to donors
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                        <div>
                                            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Invoice No.</label>
                                            <input className="input" placeholder="INV-2025-0042" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Amount (₹)</label>
                                            <input className="input" type="number" placeholder="20000" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Voting Window</label>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <input
                                                type="range" min={48} max={168} step={24}
                                                value={votingHours}
                                                onChange={(e) => setVotingHours(parseInt(e.target.value))}
                                                style={{ flex: 1 }}
                                            />
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--violet-light)", minWidth: 50 }}>
                                                {votingHours}h
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>48h minimum · 168h (7d) maximum</div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
                                            Invoice PDF / Image *
                                        </label>
                                        <label style={{
                                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                            gap: 8, padding: "20px", border: "2px dashed var(--border)", borderRadius: 12,
                                            cursor: "pointer", transition: "border-color 200ms",
                                        }}>
                                            <Upload size={20} style={{ color: "var(--text-muted)" }} />
                                            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                                {invoiceFile ? invoiceFile.name : "Click to upload PDF, JPG, PNG"}
                                            </span>
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                style={{ display: "none" }}
                                                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                                            />
                                        </label>
                                    </div>

                                    <button
                                        className="btn btn-primary"
                                        style={{ width: "100%", marginTop: 4 }}
                                        disabled={proofLoading || !invoiceFile || (!isUnregistered && !gstin)}
                                        onClick={handleSubmitProof}
                                    >
                                        {proofLoading ? "Uploading & Validating…" : "Submit Proof & Open Voting"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right: DPR update posting + timeline ── */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <div className="card" style={{ padding: 24 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                                <Plus size={16} /> Post Activity Update
                            </h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                <div>
                                    <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Type</label>
                                    <select className="input" value={updateType} onChange={(e) => setUpdateType(e.target.value)}>
                                        {UPDATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Title *</label>
                                    <input className="input" placeholder="e.g. Venue deposit paid to Raj Events" value={updateTitle} onChange={(e) => setUpdateTitle(e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Details</label>
                                    <textarea className="input" style={{ minHeight: 80 }} placeholder="Any additional context for donors…" value={updateDesc} onChange={(e) => setUpdateDesc(e.target.value)} />
                                </div>
                                <button
                                    className="btn btn-outline"
                                    onClick={handlePostUpdate}
                                    disabled={updateLoading || !updateTitle.trim()}
                                >
                                    {updateLoading ? "Posting…" : "📋 Post Update"}
                                </button>
                            </div>
                        </div>

                        {/* Live activity log */}
                        <div className="card" style={{ padding: 20 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Activity Log</h3>
                            <DprTimeline updates={updates} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
