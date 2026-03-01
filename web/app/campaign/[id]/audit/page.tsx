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
        PENDING: "bg-[#F0EFEB] text-[#1A1F2E]/35 border-[#E4E2DC]",
        UNDER_REVIEW: "bg-[#C2850C]/10 text-[#C2850C] border-[#C2850C]/20",
        APPROVED: "bg-[#2D6A4F]/10 text-[#2D6A4F] border-[#2D6A4F]/20",
        REJECTED: "bg-[#C44536]/10 text-[#C44536] border-[#C44536]/20",
    };

    return (
        <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
            <Navbar />
            <main className="mx-auto max-w-[800px] px-8 pt-12 pb-24">
                <Link href={`/campaign/${id}`}>
                    <button className="flex items-center gap-2 text-base text-[#1A1F2E]/40 hover:text-[#1A1F2E]/70 transition-colors duration-150 mb-8 min-h-[44px]">
                        <ArrowLeft size={16} /> Back to Campaign
                    </button>
                </Link>

                <h1 className="text-4xl font-bold tracking-[-0.03em] mb-3">Proof-of-History Audit</h1>
                <p className="text-lg text-[#1A1F2E]/40 leading-relaxed mb-12 max-w-lg">
                    Every phase proof is hash-linked to the previous one — forming a tamper-evident chain.
                </p>

                {loading ? (
                    <div className="space-y-6">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-44 rounded-xl" />)}</div>
                ) : chain.length === 0 ? (
                    <div className="text-center py-24 text-[#1A1F2E]/30">
                        <div className="text-6xl mb-4">🔗</div>
                        <p className="text-lg">No proofs submitted yet.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {chain.map((phase, idx) => (
                            <div key={phase.id} className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">

                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-sm font-bold text-[#2D6A4F] uppercase tracking-widest mb-2">Phase {phase.index + 1}</p>
                                        <h3 className="font-bold text-xl">{phase.title}</h3>
                                    </div>
                                    <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${stateClasses[phase.state] ?? ""}`}>
                                        {phase.state.replace("_", " ")}
                                    </span>
                                </div>

                                {phase.proof ? (
                                    <div className="mb-6">
                                        <div className="bg-[#F8F7F4] border border-[#E4E2DC] rounded-xl p-6 space-y-3">
                                            <p className="text-sm font-bold text-[#1A1F2E]/45">Invoice Proof</p>

                                            <div className="flex items-center gap-2">
                                                {phase.proof.gstinVerified
                                                    ? <Shield size={16} className="text-[#2D6A4F]" />
                                                    : <AlertCircle size={16} className="text-[#C2850C]" />}
                                                <span className="text-base">
                                                    {phase.proof.isUnregisteredVendor
                                                        ? <span className="text-[#C2850C]">⚠️ Unregistered vendor</span>
                                                        : phase.proof.gstinVerified
                                                            ? <><span className="text-[#2D6A4F] font-semibold">{phase.proof.vendorLegalName}</span><code className="text-xs text-[#1A1F2E]/25 ml-2 bg-[#F0EFEB] px-2 py-1 rounded-lg font-['DM_Mono']">{phase.proof.gstin}</code></>
                                                            : <span className="text-[#1A1F2E]/35">GSTIN unverified</span>}
                                                </span>
                                            </div>

                                            {phase.proof.invoiceNumber && (
                                                <p className="text-sm text-[#1A1F2E]/35">
                                                    Invoice: {phase.proof.invoiceNumber}
                                                    {phase.proof.invoiceAmountPaise ? ` · ₹${(Number(phase.proof.invoiceAmountPaise) / 100).toLocaleString("en-IN")}` : ""}
                                                </p>
                                            )}

                                            <div className="space-y-1.5 mt-3">
                                                <p className="text-xs font-['DM_Mono'] text-[#1A1F2E]/20">
                                                    <span className="text-[#1A1F2E]/35 mr-2">INVOICE HASH</span>{phase.proof.invoiceHash}
                                                </p>
                                                {idx > 0 && phase.proof.prevProofHash && (
                                                    <p className="text-xs font-['DM_Mono'] text-[#1A1F2E]/20">
                                                        <span className="text-[#1A1F2E]/35 mr-2">PREV HASH</span>{phase.proof.prevProofHash}
                                                    </p>
                                                )}
                                                <p className="text-xs text-[#1A1F2E]/20">
                                                    Submitted: {new Date(phase.proof.submittedAt).toLocaleString("en-IN")}
                                                </p>
                                            </div>
                                        </div>

                                        {idx < chain.length - 1 && (
                                            <div className="text-center py-3 text-xl text-[#1A1F2E]/15">⬇</div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-base text-[#1A1F2E]/25 py-4">No proof submitted for this phase.</p>
                                )}

                                {phase.updates?.length > 0 && (
                                    <div className="border-t border-[#E4E2DC] pt-6">
                                        <p className="text-sm font-bold text-[#1A1F2E]/35 mb-6">Activity ({phase.updates.length})</p>
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
