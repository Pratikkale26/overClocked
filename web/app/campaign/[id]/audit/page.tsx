"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, AlertCircle } from "lucide-react";
import { Navbar } from "../../../../components/layout/Navbar";
import { fetchProofChain, type MilestoneChainItem } from "../../../../lib/api";
import { DprTimeline } from "../../../../components/campaigns/DprTimeline";

export default function AuditPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [chain, setChain] = useState<MilestoneChainItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProofChain(id)
            .then(setChain)
            .catch(() => setChain([]))
            .finally(() => setLoading(false));
    }, [id]);

    return (
        <div>
            <Navbar />
            <main className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 800 }}>
                <Link href={`/campaign/${id}`}>
                    <button className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>
                        <ArrowLeft size={14} /> Back to Campaign
                    </button>
                </Link>

                <div style={{ marginBottom: 28 }}>
                    <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8 }}>🔗 Proof-of-History Audit</h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.65 }}>
                        Every phase proof is hash-linked to the previous one — forming a tamper-evident chain.
                        Any modification would break the chain from that point forward.
                    </p>
                </div>

                {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />)}
                    </div>
                ) : chain.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
                        <p>No proofs submitted yet. The chain will appear here once the creator submits their first phase proof.</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {chain.map((phase, idx) => (
                            <div key={phase.id} className="card" style={{ padding: 24 }}>
                                {/* Phase header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--violet-light)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                                            Phase {phase.index + 1}
                                        </div>
                                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{phase.title}</h3>
                                    </div>
                                    <span className={`badge badge-${phase.state.toLowerCase()}`}>
                                        {phase.state}
                                    </span>
                                </div>

                                {/* Proof details */}
                                {phase.proof ? (
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{
                                            padding: "14px 16px",
                                            background: "var(--bg-elevated)",
                                            borderRadius: 12,
                                            border: "1px solid var(--border)",
                                        }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10 }}>
                                                📄 Invoice Proof
                                            </div>

                                            {/* GSTIN status */}
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                {phase.proof.gstinVerified ? (
                                                    <Shield size={14} style={{ color: "var(--success)" }} />
                                                ) : (
                                                    <AlertCircle size={14} style={{ color: "var(--warning)" }} />
                                                )}
                                                <span style={{ fontSize: 13, fontWeight: 600 }}>
                                                    {phase.proof.isUnregisteredVendor ? (
                                                        <span style={{ color: "var(--warning)" }}>⚠️ Unregistered vendor</span>
                                                    ) : phase.proof.gstinVerified ? (
                                                        <span style={{ color: "var(--success)" }}>{phase.proof.vendorLegalName}</span>
                                                    ) : "GSTIN unverified"}
                                                </span>
                                                {phase.proof.gstin && (
                                                    <code style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-primary)", padding: "2px 6px", borderRadius: 4 }}>
                                                        {phase.proof.gstin}
                                                    </code>
                                                )}
                                            </div>

                                            {phase.proof.invoiceNumber && (
                                                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                                                    Invoice: {phase.proof.invoiceNumber}
                                                    {phase.proof.invoiceAmount ? ` · ₹${phase.proof.invoiceAmount.toLocaleString()}` : ""}
                                                </div>
                                            )}

                                            {/* Hash chain */}
                                            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                                                <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)" }}>
                                                    <span style={{ color: "var(--text-secondary)", marginRight: 8 }}>INVOICE HASH</span>
                                                    {phase.proof.invoiceHash}
                                                </div>
                                                {idx > 0 && phase.proof.prevProofHash && (
                                                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)" }}>
                                                        <span style={{ color: "var(--text-secondary)", marginRight: 8 }}>PREV HASH</span>
                                                        {phase.proof.prevProofHash}
                                                    </div>
                                                )}
                                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                                    Submitted: {new Date(phase.proof.createdAt).toLocaleString("en-IN")}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Chain link indicator */}
                                        {idx < chain.length - 1 && (
                                            <div style={{ textAlign: "center", padding: "8px 0", fontSize: 18, color: "var(--border)" }}>
                                                ⬇
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>
                                        No proof submitted for this phase yet.
                                    </div>
                                )}

                                {/* DPR activity for this phase */}
                                {phase.updates?.length > 0 && (
                                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 14 }}>
                                            Activity during this phase ({phase.updates.length} entries)
                                        </div>
                                        <DprTimeline updates={phase.updates} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
