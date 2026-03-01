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
        <div className="min-h-screen bg-[#050509] text-white font-['Inter']">
            <Navbar />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.05)_0%,transparent_70%)] pointer-events-none -z-10" />

            <main className="mx-auto max-w-[1240px] px-6 pt-10 pb-16">

                {/* Header */}
                <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent mb-1">
                            Dashboard
                        </h1>
                        {wallet && <p className="text-xs font-mono text-white/25">{shortenAddress(wallet, 6)}</p>}
                    </div>
                    <Link href="/create">
                        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35 hover:brightness-110 transition-all">
                            <Plus size={15} /> New Campaign
                        </button>
                    </Link>
                </div>

                {/* Pending votes alert */}
                {pendingVotes > 0 && (
                    <div className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20">
                        <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                        <div className="flex-1">
                            <span className="font-bold text-amber-400 text-sm">{pendingVotes} campaign{pendingVotes > 1 ? "s" : ""} awaiting your vote</span>
                            <span className="text-white/40 text-xs ml-2">Your stake-weighted vote determines fund release.</span>
                        </div>
                        <button onClick={() => setTab("donor")} className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors">
                            View <ArrowRight size={12} />
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-white/[0.06] mb-7">
                    {(["creator", "donor"] as const).map((t) => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${tab === t
                                    ? "text-violet-400 border-violet-500"
                                    : "text-white/30 border-transparent hover:text-white/50"
                                }`}>
                            {t === "creator" ? "🏢 My Campaigns" : "💰 My Donations"}
                            {t === "donor" && pendingVotes > 0 && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400 text-black font-extrabold">{pendingVotes}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Creator Tab */}
                {tab === "creator" && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
                            {[
                                { label: "Campaigns", value: myCampaigns.length, icon: "📋" },
                                { label: "Active", value: myCampaigns.filter((c) => c.state === "ACTIVE").length, icon: "🟢" },
                                { label: "Completed", value: myCampaigns.filter((c) => c.state === "COMPLETED").length, icon: "✅" },
                                { label: "Total Raised", value: formatSol(totalRaised), icon: "💎" },
                            ].map((s) => (
                                <div key={s.label} className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-5 text-center relative overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-600/30 to-transparent" />
                                    <div className="text-2xl mb-2">{s.icon}</div>
                                    <p className="text-xl font-extrabold">{s.value}</p>
                                    <p className="text-[10px] text-white/25 mt-0.5">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
                        ) : myCampaigns.length === 0 ? (
                            <div className="text-center py-16 bg-[#0f0f1a] border border-white/[0.06] rounded-2xl">
                                <div className="text-4xl mb-3">📋</div>
                                <h3 className="font-bold mb-2">No campaigns yet</h3>
                                <p className="text-sm text-white/30 mb-5">Create your first milestone-backed campaign.</p>
                                <Link href="/create">
                                    <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm">
                                        <Plus size={14} className="inline mr-1" /> Create Campaign
                                    </button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {myCampaigns.map((c) => {
                                    const pct = formatGoalProgress(c.raisedLamports, c.totalGoalLamports);
                                    const approved = c.milestones?.filter(m => m.state === "APPROVED").length ?? 0;
                                    const hasVoting = c.milestones?.some(m => m.state === "UNDER_REVIEW");
                                    return (
                                        <div key={c.id} className={`flex items-center gap-4 flex-wrap p-5 bg-[#0f0f1a] rounded-2xl border ${hasVoting ? "border-amber-500/25" : "border-white/[0.06]"}`}>
                                            <div className="flex-1 min-w-[200px]">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-sm">{c.title}</span>
                                                    {hasVoting && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold">🗳️ Voting</span>}
                                                </div>
                                                <p className="text-xs text-white/30">{c.state} · {approved}/{c.milestones?.length ?? 0} phases · {formatSol(c.raisedLamports)}</p>
                                                <div className="h-1 w-full bg-white/[0.04] rounded-full overflow-hidden mt-2">
                                                    <div className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full progress-glow" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {hasVoting && <Link href={`/campaign/${c.id}`}><button className="text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold hover:bg-amber-500/15 transition-all">View Votes</button></Link>}
                                                <Link href={`/campaign/${c.id}/manage`}><button className="text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 font-semibold hover:bg-white/[0.06] transition-all">Manage</button></Link>
                                                <Link href={`/campaign/${c.id}`}><button className="text-xs p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/30 hover:bg-white/[0.06] transition-all"><ArrowRight size={12} /></button></Link>
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
                        <div className="flex items-center gap-5 flex-wrap p-6 mb-7 rounded-2xl bg-gradient-to-r from-emerald-500/[0.04] to-violet-500/[0.04] border border-emerald-500/15">
                            <div className="text-4xl">💰</div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Estimated Yield Accrued</p>
                                <p className="text-2xl font-extrabold mb-0.5">{totalYield.toFixed(4)} SOL</p>
                                <p className="text-xs text-white/40">@ 10% APY on locked SOL · Claimable on completion</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-white/20 mb-1">V2: Real yield via</p>
                                <p className="text-xs font-bold text-white/40">Marinade / Kamino</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="space-y-3">{[1, 2].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
                        ) : donorCampaigns.length === 0 ? (
                            <div className="text-center py-16 bg-[#0f0f1a] border border-white/[0.06] rounded-2xl">
                                <div className="text-4xl mb-3">💸</div>
                                <h3 className="font-bold mb-2">No donations yet</h3>
                                <p className="text-sm text-white/30 mb-5">Find campaigns to support.</p>
                                <Link href="/explore">
                                    <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm">Explore Campaigns</button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {donorCampaigns.map((c) => {
                                    const yld = computeYield(c.raisedLamports, c.createdAt);
                                    const underReview = c.milestones?.find(m => m.state === "UNDER_REVIEW");
                                    return (
                                        <div key={c.id} className={`p-5 bg-[#0f0f1a] rounded-2xl border ${underReview ? "border-amber-500/25" : "border-white/[0.06]"}`}>
                                            <div className="flex justify-between gap-3 flex-wrap">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-sm">{c.title}</span>
                                                        {c.org?.gstinVerified && <Shield size={12} className="text-emerald-400" />}
                                                    </div>
                                                    <p className="text-xs text-white/30 mb-2">{c.org?.name} · {c.state}</p>
                                                    <div className="flex items-center gap-1 text-xs">
                                                        <TrendingUp size={11} className="text-emerald-400" />
                                                        <span className="text-emerald-400 font-bold">+{yld.toFixed(4)} SOL</span>
                                                        <span className="text-white/25 ml-1">yield</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 items-end">
                                                    {underReview && (
                                                        <Link href={`/campaign/${c.id}`}>
                                                            <button className="text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold hover:bg-amber-500/15 transition-all">🗳️ Vote Now</button>
                                                        </Link>
                                                    )}
                                                    <Link href={`/campaign/${c.id}`}>
                                                        <button className="text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 font-semibold hover:bg-white/[0.06] transition-all flex items-center gap-1">View <ArrowRight size={11} /></button>
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
