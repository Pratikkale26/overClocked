"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { ArrowLeft, Upload, Plus, FileText, Wallet } from "lucide-react";
import { Navbar } from "../../../../components/layout/Navbar";
import { DprTimeline } from "../../../../components/campaigns/DprTimeline";
import {
    fetchCampaign, fetchMilestoneUpdates, postMilestoneUpdate,
    submitMilestoneProof, presignProofUpload,
    type Campaign, type Milestone, type MilestoneUpdate,
} from "../../../../lib/api";

const UPDATE_TYPES = ["PROGRESS", "EXPENSE", "PHOTO", "COMPLETION", "ANNOUNCEMENT"];

const inputCls = "w-full px-4 py-3 rounded-xl bg-[#161625] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all";

export default function ManageCampaignPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { authenticated, login } = usePrivy();
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
    const [updates, setUpdates] = useState<MilestoneUpdate[]>([]);

    const [proofLoading, setProofLoading] = useState(false);
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [gstin, setGstin] = useState("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [invoiceAmount, setInvoiceAmount] = useState("");
    const [isUnregistered, setIsUnregistered] = useState(false);
    const [votingHours, setVotingHours] = useState(72);

    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateType, setUpdateType] = useState("PROGRESS");
    const [updateTitle, setUpdateTitle] = useState("");
    const [updateDesc, setUpdateDesc] = useState("");

    const load = useCallback(async () => {
        try {
            const c = await fetchCampaign(id);
            setCampaign(c);
            const target = c.milestones?.find((m) => m.state === "PENDING" || m.state === "UNDER_REVIEW") ?? c.milestones?.[0];
            if (target) {
                setActiveMilestone(target);
                setUpdates(await fetchMilestoneUpdates(target.id));
            }
        } catch { setCampaign(null); } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const handleSubmitProof = async () => {
        if (!activeMilestone) return;
        if (!isUnregistered && !gstin) { toast.error("Enter vendor GSTIN or mark as unregistered"); return; }
        if (!invoiceFile) { toast.error("Upload the invoice first"); return; }
        setProofLoading(true);
        try {
            const { uploadUrl, s3Key } = await presignProofUpload(activeMilestone.id, invoiceFile.name, invoiceFile.type);
            await fetch(uploadUrl, { method: "PUT", body: invoiceFile, headers: { "Content-Type": invoiceFile.type } });
            await submitMilestoneProof(activeMilestone.id, {
                gstin: isUnregistered ? undefined : gstin.toUpperCase().trim(),
                isUnregisteredVendor: isUnregistered, invoiceS3Key: s3Key,
                invoiceNumber: invoiceNumber || undefined,
                invoiceAmountPaise: invoiceAmount ? Math.round(parseFloat(invoiceAmount) * 100) : undefined,
                votingWindowSecs: votingHours * 3600,
            });
            toast.success("Proof submitted!", { description: `Voting open for ${votingHours}h.` });
            await load();
        } catch (e: unknown) {
            toast.error("Proof submission failed", { description: e instanceof Error ? e.message : "Error" });
        } finally { setProofLoading(false); }
    };

    const handlePostUpdate = async () => {
        if (!activeMilestone || !updateTitle.trim()) return;
        setUpdateLoading(true);
        try {
            await postMilestoneUpdate(activeMilestone.id, { type: updateType, title: updateTitle.trim(), description: updateDesc.trim() || undefined });
            toast.success("Update posted!");
            setUpdateTitle(""); setUpdateDesc("");
            await load();
        } catch (e: unknown) {
            toast.error("Failed", { description: e instanceof Error ? e.message : "Error" });
        } finally { setUpdateLoading(false); }
    };

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[#050509] text-white"><Navbar />
                <div className="mx-auto max-w-[1240px] px-6 pt-24 text-center">
                    <div className="text-5xl mb-4">🔐</div>
                    <h2 className="text-xl font-bold mb-3">Sign in to manage</h2>
                    <button onClick={() => login()} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/20 hover:brightness-110 transition-all">
                        <Wallet size={15} /> Connect
                    </button>
                </div>
            </div>
        );
    }

    if (loading) return <div className="min-h-screen bg-[#050509] text-white"><Navbar /><main className="mx-auto max-w-[1240px] px-6 pt-12"><div className="skeleton h-52 rounded-2xl" /></main></div>;
    if (!campaign) return <div className="min-h-screen bg-[#050509] text-white"><Navbar /><main className="mx-auto max-w-[1240px] px-6 pt-20 text-center"><h2 className="text-xl font-bold">Campaign not found</h2></main></div>;

    const canSubmitProof = activeMilestone?.state === "PENDING";
    const isUnderReview = activeMilestone?.state === "UNDER_REVIEW";

    return (
        <div className="min-h-screen bg-[#050509] text-white font-['Inter']">
            <Navbar />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.05)_0%,transparent_70%)] pointer-events-none -z-10" />

            <main className="mx-auto max-w-[1240px] px-6 pt-10 pb-16">
                <Link href={`/campaign/${id}`}>
                    <button className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-5">
                        <ArrowLeft size={14} /> Back to Campaign
                    </button>
                </Link>
                <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent mb-1">Manage Campaign</h1>
                <p className="text-sm text-white/40 mb-8">{campaign.title}</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                    {/* Left: proof */}
                    <div className="space-y-5">
                        {activeMilestone && (
                            <div className={`p-4 rounded-2xl border ${isUnderReview ? "bg-amber-500/[0.03] border-amber-500/20" : "bg-violet-500/[0.03] border-violet-500/20"}`}>
                                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isUnderReview ? "text-amber-400" : "text-violet-400"}`}>
                                    {isUnderReview ? "🗳️ Voting in progress" : "⏳ Active Phase"}
                                </p>
                                <p className="font-bold text-sm">Phase {activeMilestone.index + 1}: {activeMilestone.title}</p>
                                {isUnderReview && <p className="text-xs text-white/40 mt-1">Donors are reviewing your proof and voting.</p>}
                            </div>
                        )}

                        <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6">
                            <h2 className="text-sm font-bold flex items-center gap-2 mb-5"><FileText size={15} /> Submit Phase Proof</h2>
                            {isUnderReview ? (
                                <p className="text-sm text-white/30 py-6 text-center">⏳ Proof submitted. Wait for voting.</p>
                            ) : !canSubmitProof ? (
                                <p className="text-sm text-white/30 py-6 text-center">This phase is {activeMilestone?.state?.toLowerCase()}.</p>
                            ) : (
                                <div className="space-y-4">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input type="checkbox" checked={isUnregistered} onChange={(e) => setIsUnregistered(e.target.checked)} className="accent-violet-500" />
                                        <span className="text-sm text-white/60">Vendor is unregistered (below ₹40L GST)</span>
                                    </label>
                                    {!isUnregistered && (
                                        <div>
                                            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Vendor GSTIN *</label>
                                            <input className={inputCls + " font-mono"} placeholder="e.g. 27AABCE1234F1Z5" value={gstin} maxLength={15} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
                                            <p className="text-[10px] text-white/20 mt-1">Validated via GST API</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Invoice No.</label>
                                            <input className={inputCls} placeholder="INV-2025-0042" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Amount (₹)</label>
                                            <input className={inputCls} type="number" placeholder="20000" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Voting Window</label>
                                        <div className="flex items-center gap-3">
                                            <input type="range" min={48} max={168} step={24} value={votingHours} onChange={(e) => setVotingHours(parseInt(e.target.value))} className="flex-1 accent-violet-500" />
                                            <span className="text-sm font-bold text-violet-400 min-w-[50px]">{votingHours}h</span>
                                        </div>
                                        <p className="text-[10px] text-white/20 mt-1">48h min · 168h max</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Invoice File *</label>
                                        <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-white/[0.08] rounded-xl cursor-pointer hover:border-violet-500/30 transition-all">
                                            <Upload size={18} className="text-white/25" />
                                            <span className="text-xs text-white/30">{invoiceFile ? invoiceFile.name : "Click to upload PDF, JPG, PNG"}</span>
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
                                        </label>
                                    </div>
                                    <button disabled={proofLoading || !invoiceFile || (!isUnregistered && !gstin)} onClick={handleSubmitProof}
                                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/20 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                        {proofLoading ? "Uploading & Validating…" : "Submit Proof & Open Voting"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: DPR updates */}
                    <div className="space-y-5">
                        <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6">
                            <h2 className="text-sm font-bold flex items-center gap-2 mb-5"><Plus size={15} /> Post Activity Update</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Type</label>
                                    <select className={inputCls + " appearance-none"} value={updateType} onChange={(e) => setUpdateType(e.target.value)}>
                                        {UPDATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Title *</label>
                                    <input className={inputCls} placeholder="e.g. Venue deposit paid to Raj Events" value={updateTitle} onChange={(e) => setUpdateTitle(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Details</label>
                                    <textarea className={inputCls + " min-h-[80px] resize-y"} placeholder="Additional context for donors…" value={updateDesc} onChange={(e) => setUpdateDesc(e.target.value)} />
                                </div>
                                <button disabled={updateLoading || !updateTitle.trim()} onClick={handlePostUpdate}
                                    className="w-full py-3 rounded-xl border border-violet-500/30 text-violet-300 font-semibold hover:bg-violet-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                    {updateLoading ? "Posting…" : "📋 Post Update"}
                                </button>
                            </div>
                        </div>

                        <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-5">
                            <h3 className="text-sm font-bold mb-4">Activity Log</h3>
                            <DprTimeline updates={updates} title="" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
