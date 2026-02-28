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
        fetchProofChain(id).then(setChain).catch(() => setChain([])).finally(() => setLoading(false));
    }, [id]);

    const stateClasses: Record<string, string> = {
        PENDING: "bg-white/5 text-white/30 border-white/10",
        UNDER_REVIEW: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
    };

    return (
        <div className="min-h-screen bg-[#050509] text-white font-['Inter']">
            <Navbar />
            <main className="mx-auto max-w-[800px] px-6 pt-10 pb-16">
                <Link href={`/campaign/${id}`}>
                    <button className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-6">
                        <ArrowLeft size={14} /> Back to Campaign
                    </button>
                </Link>

                <h1 className="text-2xl font-black tracking-tight mb-2">🔗 Proof-of-History Audit</h1>
                <p className="text-sm text-white/40 leading-relaxed mb-8 max-w-lg">
                    Every phase proof is hash-linked to the previous one — forming a tamper-evident chain.
                </p>

                {loading ? (
                    <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}</div>
                ) : chain.length === 0 ? (
                    <div className="text-center py-16 text-white/30">
                        <div className="text-5xl mb-3">🔗</div>
                        <p>No proofs submitted yet.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {chain.map((phase, idx) => (
                            <div key={phase.id} className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-600/30 to-transparent" />

                                <div className="flex justify-between items-start mb-5">
                                    <div>
                                        <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">Phase {phase.index + 1}</p>
                                        <h3 className="font-bold text-base">{phase.title}</h3>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${stateClasses[phase.state] ?? ""}`}>
                                        {phase.state.replace("_", " ")}
                                    </span>
                                </div>

                                {phase.proof ? (
                                    <div className="mb-4">
                                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2.5">
                                            <p className="text-xs font-bold text-white/40">📄 Invoice Proof</p>

                                            <div className="flex items-center gap-2">
                                                {phase.proof.gstinVerified
                                                    ? <Shield size={13} className="text-emerald-400" />
                                                    : <AlertCircle size={13} className="text-amber-400" />}
                                                <span className="text-sm">
                                                    {phase.proof.isUnregisteredVendor
                                                        ? <span className="text-amber-400">⚠️ Unregistered vendor</span>
                                                        : phase.proof.gstinVerified
                                                            ? <><span className="text-emerald-400 font-semibold">{phase.proof.vendorLegalName}</span><code className="text-[10px] text-white/20 ml-2 bg-white/[0.03] px-1.5 py-0.5 rounded">{phase.proof.gstin}</code></>
                                                            : <span className="text-white/30">GSTIN unverified</span>}
                                                </span>
                                            </div>

                                            {phase.proof.invoiceNumber && (
                                                <p className="text-xs text-white/30">
                                                    Invoice: {phase.proof.invoiceNumber}
                                                    {phase.proof.invoiceAmountPaise ? ` · ₹${(Number(phase.proof.invoiceAmountPaise) / 100).toLocaleString("en-IN")}` : ""}
                                                </p>
                                            )}

                                            <div className="space-y-1 mt-2.5">
                                                <p className="text-[10px] font-mono text-white/15">
                                                    <span className="text-white/30 mr-2">INVOICE HASH</span>{phase.proof.invoiceHash}
                                                </p>
                                                {idx > 0 && phase.proof.prevProofHash && (
                                                    <p className="text-[10px] font-mono text-white/15">
                                                        <span className="text-white/30 mr-2">PREV HASH</span>{phase.proof.prevProofHash}
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-white/15">
                                                    Submitted: {new Date(phase.proof.submittedAt).toLocaleString("en-IN")}
                                                </p>
                                            </div>
                                        </div>

                                        {idx < chain.length - 1 && (
                                            <div className="text-center py-2 text-lg text-white/10">⬇</div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-white/25 py-3">No proof submitted for this phase.</p>
                                )}

                                {phase.updates?.length > 0 && (
                                    <div className="border-t border-white/[0.04] pt-4">
                                        <p className="text-xs font-bold text-white/30 mb-4">Activity ({phase.updates.length})</p>
                                        <DprTimeline updates={phase.updates} title="" />
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
