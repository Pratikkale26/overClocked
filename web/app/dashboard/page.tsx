"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { Navbar } from "../../components/layout/Navbar";
import { fetchMyCampaigns, fetchDonatedCampaigns, type Campaign } from "../../lib/api";
import { formatSol, formatGoalProgress, LAMPORTS_PER_SOL, shortenAddress } from "../../lib/utils";

const YIELD_APY = 0.10;
function computeYield(raised: string, created: string): number {
    const sol = Number(raised) / LAMPORTS_PER_SOL;
    const days = (Date.now() - new Date(created).getTime()) / 864e5;
    return sol * YIELD_APY * Math.max(0, days) / 365;
}

export default function DashboardPage() {
    const router = useRouter();
    const { authenticated, ready, user } = usePrivy();
    const { publicKey } = useWallet();
    const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
    const [donorCampaigns, setDonorCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"creator" | "donor">("creator");

    useEffect(() => {
        if (!ready) return;
        if (!authenticated) { router.replace("/"); return; }
        Promise.allSettled([fetchMyCampaigns(), fetchDonatedCampaigns()])
            .then(([mine, donated]) => {
                setMyCampaigns(mine.status === "fulfilled" ? mine.value : []);
                setDonorCampaigns(donated.status === "fulfilled" ? donated.value : []);
            })
            .finally(() => setLoading(false));
    }, [ready, authenticated, router]);

    if (!ready || !authenticated) return null;

    const linkedSolanaAccount = user?.linkedAccounts?.find(
        (account) =>
            account.type === "wallet" &&
            "chainType" in account &&
            account.chainType === "solana"
    );
    const linkedAddr =
        linkedSolanaAccount &&
            "address" in linkedSolanaAccount &&
            typeof linkedSolanaAccount.address === "string"
            ? linkedSolanaAccount.address
            : undefined;
    const wallet = publicKey?.toBase58() ?? user?.wallet?.address ?? linkedAddr;
    const totalRaised = myCampaigns.reduce((s, c) => s + Number(c.raisedLamports || 0), 0);
    const pendingVotes = donorCampaigns.filter((c) => c.milestones?.some((m) => m.state === "UNDER_REVIEW")).length;
    const totalYield = donorCampaigns.reduce((s, c) => s + computeYield(c.raisedLamports, c.createdAt), 0);

    return (
        <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
            <Navbar />

            <main className="mx-auto max-w-[1200px] px-8 pt-12 pb-24">

                {/* Header */}
                <div className="flex justify-between items-start flex-wrap gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-bold tracking-[-0.03em] text-[#1A1F2E] mb-2">
                            Dashboard
                        </h1>
                        {wallet && <p className="text-sm font-['DM_Mono'] text-[#1A1F2E]/30">{shortenAddress(wallet, 6)}</p>}
                    </div>
                    <Link href="/create">
                        <button className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#2D6A4F] text-white text-base font-semibold hover:bg-[#245A42] hover:-translate-y-[1px] transition-all duration-150 min-h-[48px]">
                            <Plus size={18} /> New Campaign
                        </button>
                    </Link>
                </div>

                {/* Pending votes alert */}
                {pendingVotes > 0 && (
                    <div className="flex items-center gap-4 p-6 mb-8 rounded-xl bg-[#C2850C]/[0.06] border border-[#C2850C]/20">
                        <AlertTriangle size={20} className="text-[#C2850C] shrink-0" />
                        <div className="flex-1">
                            <span className="font-bold text-[#C2850C] text-base">{pendingVotes} campaign{pendingVotes > 1 ? "s" : ""} awaiting your vote</span>
                            <span className="text-[#1A1F2E]/40 text-sm ml-3">Your stake-weighted vote determines fund release.</span>
                        </div>
                        <button onClick={() => setTab("donor")} className="text-sm text-[#1A1F2E]/40 hover:text-[#1A1F2E]/70 flex items-center gap-1 transition-colors duration-150 min-h-[44px]">
                            View <ArrowRight size={14} />
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-[#E4E2DC] mb-8">
                    {(["creator", "donor"] as const).map((t) => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-6 py-4 text-base font-semibold border-b-2 transition-all duration-150 min-h-[48px] ${tab === t
                                ? "text-[#2D6A4F] border-[#2D6A4F]"
                                : "text-[#1A1F2E]/30 border-transparent hover:text-[#1A1F2E]/50"
                                }`}>
                            {t === "creator" ? "My Campaigns" : "My Donations"}
                            {t === "donor" && pendingVotes > 0 && (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[#C2850C] text-white font-extrabold">{pendingVotes}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Creator Tab */}
                {tab === "creator" && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                            {[
                                { label: "Campaigns", value: myCampaigns.length },
                                { label: "Active", value: myCampaigns.filter((c) => c.state === "ACTIVE").length },
                                { label: "Completed", value: myCampaigns.filter((c) => c.state === "COMPLETED").length },
                                { label: "Total Raised", value: formatSol(totalRaised) },
                            ].map((s) => (
                                <div key={s.label} className="bg-white border border-[#E4E2DC] rounded-xl p-6 text-center shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
                                    <p className="text-2xl font-extrabold text-[#1A1F2E]">{s.value}</p>
                                    <p className="text-sm text-[#1A1F2E]/35 mt-2 uppercase tracking-wider font-semibold">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
                        ) : myCampaigns.length === 0 ? (
                            <div className="text-center py-24 bg-white border border-[#E4E2DC] rounded-xl shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
                                <h3 className="text-xl font-bold mb-3">No campaigns yet</h3>
                                <p className="text-base text-[#1A1F2E]/35 mb-8">Create your first milestone-backed campaign.</p>
                                <Link href="/create">
                                    <button className="px-8 py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base hover:bg-[#245A42] transition-all duration-150 min-h-[48px]">
                                        <Plus size={16} className="inline mr-2" /> Create Campaign
                                    </button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {myCampaigns.map((c) => {
                                    const pct = formatGoalProgress(c.raisedLamports, c.totalGoalLamports);
                                    const approved = c.milestones?.filter(m => m.state === "APPROVED").length ?? 0;
                                    const hasVoting = c.milestones?.some(m => m.state === "UNDER_REVIEW");
                                    return (
                                        <div key={c.id} className={`flex items-center gap-6 flex-wrap p-6 bg-white rounded-xl border ${hasVoting ? "border-[#C2850C]/30" : "border-[#E4E2DC]"} shadow-[0_4px_12px_rgba(26,31,46,0.06)]`}>
                                            <div className="flex-1 min-w-[200px]">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="font-bold text-base">{c.title}</span>
                                                    {hasVoting && <span className="text-xs px-2.5 py-1 rounded-lg bg-[#C2850C]/10 border border-[#C2850C]/20 text-[#C2850C] font-bold">Voting</span>}
                                                </div>
                                                <p className="text-sm text-[#1A1F2E]/35">{c.state} · {approved}/{c.milestones?.length ?? 0} phases · {formatSol(c.raisedLamports)}</p>
                                                <div className="h-1.5 w-full bg-[#F0EFEB] rounded-full overflow-hidden mt-3">
                                                    <div className="h-full bg-[#2D6A4F] rounded-full progress-animate" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                {hasVoting && <Link href={`/campaign/${c.id}`}><button className="text-sm px-4 py-2.5 rounded-lg bg-[#C2850C]/10 border border-[#C2850C]/20 text-[#C2850C] font-bold hover:bg-[#C2850C]/15 transition-all duration-150 min-h-[44px]">View Votes</button></Link>}
                                                <Link href={`/campaign/${c.id}/manage`}><button className="text-sm px-4 py-2.5 rounded-lg bg-[#F0EFEB] border border-[#E4E2DC] text-[#1A1F2E]/45 font-semibold hover:bg-[#E4E2DC] transition-all duration-150 min-h-[44px]">Manage</button></Link>
                                                <Link href={`/campaign/${c.id}`}><button className="p-2.5 rounded-lg bg-[#F0EFEB] border border-[#E4E2DC] text-[#1A1F2E]/35 hover:bg-[#E4E2DC] transition-all duration-150 min-w-[44px] min-h-[44px] flex items-center justify-center"><ArrowRight size={16} /></button></Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {/* Donor Tab */}
                {tab === "donor" && (
                    <>
                        <div className="flex items-center gap-6 flex-wrap p-8 mb-8 rounded-xl bg-[#2D6A4F]/[0.04] border border-[#2D6A4F]/15">
                            <div className="flex-1">
                                <p className="text-xs font-bold text-[#2D6A4F] uppercase tracking-widest mb-2">Estimated Yield Accrued</p>
                                <p className="text-3xl font-extrabold mb-1 font-['DM_Mono']">{totalYield.toFixed(4)} SOL</p>
                                <p className="text-sm text-[#1A1F2E]/40">@ 10% APY on locked SOL · Claimable on completion</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-[#1A1F2E]/25 mb-1">V2: Real yield via</p>
                                <p className="text-sm font-bold text-[#1A1F2E]/45">Marinade / Kamino</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="space-y-4">{[1, 2].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
                        ) : donorCampaigns.length === 0 ? (
                            <div className="text-center py-24 bg-white border border-[#E4E2DC] rounded-xl shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
                                <h3 className="text-xl font-bold mb-3">No donations yet</h3>
                                <p className="text-base text-[#1A1F2E]/35 mb-8">Find campaigns to support.</p>
                                <Link href="/explore">
                                    <button className="px-8 py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base hover:bg-[#245A42] transition-all duration-150 min-h-[48px]">Explore Campaigns</button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {donorCampaigns.map((c) => {
                                    const yld = computeYield(c.raisedLamports, c.createdAt);
                                    const underReview = c.milestones?.find(m => m.state === "UNDER_REVIEW");
                                    return (
                                        <div key={c.id} className={`p-6 bg-white rounded-xl border ${underReview ? "border-[#C2850C]/30" : "border-[#E4E2DC]"} shadow-[0_4px_12px_rgba(26,31,46,0.06)]`}>
                                            <div className="flex justify-between gap-4 flex-wrap">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="font-bold text-base">{c.title}</span>
                                                        {c.org?.gstinVerified && <Shield size={14} className="text-[#2D6A4F]" />}
                                                    </div>
                                                    <p className="text-sm text-[#1A1F2E]/35 mb-3">{c.org?.name} · {c.state}</p>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <TrendingUp size={14} className="text-[#2D6A4F]" />
                                                        <span className="text-[#2D6A4F] font-bold font-['DM_Mono']">+{yld.toFixed(4)} SOL</span>
                                                        <span className="text-[#1A1F2E]/25 ml-1">yield</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-3 items-end">
                                                    {underReview && (
                                                        <Link href={`/campaign/${c.id}`}>
                                                            <button className="text-sm px-4 py-2.5 rounded-lg bg-[#C2850C]/10 border border-[#C2850C]/20 text-[#C2850C] font-bold hover:bg-[#C2850C]/15 transition-all duration-150 min-h-[44px]">Vote Now</button>
                                                        </Link>
                                                    )}
                                                    <Link href={`/campaign/${c.id}`}>
                                                        <button className="text-sm px-4 py-2.5 rounded-lg bg-[#F0EFEB] border border-[#E4E2DC] text-[#1A1F2E]/45 font-semibold hover:bg-[#E4E2DC] transition-all duration-150 flex items-center gap-2 min-h-[44px]">View <ArrowRight size={14} /></button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
