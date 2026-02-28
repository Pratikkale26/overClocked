"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, AlertCircle, CheckCircle, Shield } from "lucide-react";
import type { Milestone, MilestoneProof } from "../../lib/api";
import { formatSol } from "../../lib/utils";

interface VotingPanelProps {
    milestone: Milestone;
    proof: MilestoneProof | null;
    campaignId: string;
    raisedLamports: string;
    onVoted?: () => void;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

export function VotingPanel({ milestone, proof, raisedLamports, onVoted }: VotingPanelProps) {
    const [voted, setVoted] = useState(false);
    const [loading, setLoading] = useState(false);

    if (milestone.state !== "UNDER_REVIEW") return null;

    const now = Date.now();
    const totalEligible = Number(raisedLamports) / LAMPORTS_PER_SOL;

    // Mock tally from proof — in production fetched from on-chain
    const mockYes = totalEligible * 0.62;
    const mockNo = totalEligible * 0.14;
    const mockTotal = mockYes + mockNo;
    const yesPercent = mockTotal > 0 ? (mockYes / mockTotal) * 100 : 0;

    const handleVote = async (approve: boolean) => {
        setLoading(true);
        try {
            // In production: sign vote_milestone tx via Privy wallet, then call backend
            await new Promise((r) => setTimeout(r, 800)); // mock tx latency
            setVoted(true);
            toast.success(approve ? "Voted YES ✅" : "Voted NO ❌", {
                description: "Your stake-weighted vote has been recorded on-chain.",
            });
            onVoted?.();
        } catch {
            toast.error("Vote failed — please try again");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            border: "1px solid rgba(245,158,11,0.3)",
            background: "rgba(245,158,11,0.04)",
            borderRadius: 16,
            padding: "24px",
            marginBottom: 24,
        }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: "var(--warning)",
                    boxShadow: "0 0 8px var(--warning)",
                    animation: "pulse 1.5s ease-in-out infinite",
                }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--warning)" }}>
                    Voting Open — Phase {milestone.index + 1}: {milestone.title}
                </h3>
            </div>

            {/* Proof summary */}
            {proof && (
                <div style={{
                    background: "var(--bg-elevated)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    marginBottom: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                        Proof submitted for review:
                    </div>

                    {/* GSTIN status */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {proof.gstinVerified ? (
                            <Shield size={14} style={{ color: "var(--success)", flexShrink: 0 }} />
                        ) : proof.isUnregisteredVendor ? (
                            <AlertCircle size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />
                        ) : null}
                        <span style={{ fontSize: 13 }}>
                            {proof.isUnregisteredVendor ? (
                                <span style={{ color: "var(--warning)" }}>⚠️ Unregistered vendor (below GST threshold)</span>
                            ) : proof.gstinVerified ? (
                                <>
                                    <span style={{ color: "var(--success)" }}>✅ {proof.vendorLegalName}</span>
                                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>GSTIN: {proof.gstin}</span>
                                </>
                            ) : (
                                <span style={{ color: "var(--text-muted)" }}>GSTIN pending verification</span>
                            )}
                        </span>
                    </div>

                    {proof.invoiceNumber && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            Invoice #{proof.invoiceNumber}
                            {proof.invoiceAmount ? ` · ₹${proof.invoiceAmount.toLocaleString()}` : ""}
                        </div>
                    )}

                    {/* Hash */}
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)", marginTop: 2 }}>
                        SHA-256: {proof.invoiceHash?.slice(0, 24)}…
                    </div>
                </div>
            )}

            {/* Live tally */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: "var(--success)", fontWeight: 600 }}>YES {mockYes.toFixed(2)} SOL ({yesPercent.toFixed(0)}%)</span>
                    <span style={{ color: "var(--danger)", fontWeight: 600 }}>NO {mockNo.toFixed(2)} SOL</span>
                </div>
                <div className="progress-track" style={{ height: 10 }}>
                    <div className="progress-fill" style={{ width: `${yesPercent}%`, background: "linear-gradient(90deg, var(--success), #4ade80)" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    {formatSol(raisedLamports)} total eligible · 51% threshold · 10% quorum
                </div>
            </div>

            {/* Vote buttons */}
            {voted ? (
                <div style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "14px 18px",
                    background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
                    borderRadius: 12, fontSize: 14, color: "var(--success)", fontWeight: 600,
                }}>
                    <CheckCircle size={16} />
                    Your vote is recorded on-chain. Weight = your donated SOL.
                </div>
            ) : (
                <div style={{ display: "flex", gap: 12 }}>
                    <button
                        className="btn"
                        disabled={loading}
                        onClick={() => handleVote(true)}
                        style={{
                            flex: 1, padding: "14px", fontSize: 15, fontWeight: 700,
                            background: "rgba(34,197,94,0.12)", color: "var(--success)",
                            border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12,
                        }}
                    >
                        <ThumbsUp size={16} />
                        {loading ? "Signing…" : "Approve"}
                    </button>
                    <button
                        className="btn"
                        disabled={loading}
                        onClick={() => handleVote(false)}
                        style={{
                            flex: 1, padding: "14px", fontSize: 15, fontWeight: 700,
                            background: "rgba(239,68,68,0.08)", color: "var(--danger)",
                            border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12,
                        }}
                    >
                        <ThumbsDown size={16} />
                        {loading ? "Signing…" : "Reject"}
                    </button>
                </div>
            )}
        </div>
    );
}
