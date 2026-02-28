"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Twitter, Globe, TrendingUp, ExternalLink } from "lucide-react";
import { Navbar } from "../../../components/layout/Navbar";
import { CampaignCard } from "../../../components/campaigns/CampaignCard";
import { fetchOrg, type Org } from "../../../lib/api";
import { formatSol } from "../../../lib/utils";

export default function OrgProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
    const { wallet } = use(params);
    const [org, setOrg] = useState<Org | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrg(wallet).then(setOrg).catch(() => setOrg(null)).finally(() => setLoading(false));
    }, [wallet]);

    if (loading) return (
        <div className="min-h-screen bg-[#050509] text-white"><Navbar />
            <main className="mx-auto max-w-[1240px] px-6 pt-12">
                <div className="skeleton h-52 rounded-2xl mb-5" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2].map(i => <div key={i} className="skeleton h-72 rounded-2xl" />)}
                </div>
            </main>
        </div>
    );

    if (!org) return (
        <div className="min-h-screen bg-[#050509] text-white"><Navbar />
            <main className="mx-auto max-w-[1240px] px-6 pt-20 text-center">
                <div className="text-5xl mb-4">🔍</div>
                <h2 className="text-xl font-bold mb-3">Organisation not found</h2>
                <Link href="/explore"><button className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold">Explore Campaigns</button></Link>
            </main>
        </div>
    );

    const completionRate = Math.round((org.completionRateBps ?? 0) / 100);
    const trustTier = completionRate >= 80 ? "GOLD" : completionRate >= 50 ? "SILVER" : "BRONZE";
    const tierClr = trustTier === "GOLD" ? "text-amber-400" : trustTier === "SILVER" ? "text-slate-400" : "text-amber-700";
    const tierBg = trustTier === "GOLD" ? "bg-amber-500/10 border-amber-500/20" : "bg-violet-500/10 border-violet-500/20";
    const tierEmoji = { GOLD: "🥇", SILVER: "🥈", BRONZE: "🥉" }[trustTier];

    return (
        <div className="min-h-screen bg-[#050509] text-white font-['Inter']">
            <Navbar />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.05)_0%,transparent_70%)] pointer-events-none -z-10" />

            <main className="mx-auto max-w-[1240px] px-6 pt-10 pb-16">

                {/* Hero */}
                <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-8 mb-7 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-600/40 via-indigo-600/20 to-transparent" />
                    <div className="absolute top-[-60px] right-[-60px] w-[200px] h-[200px] bg-[radial-gradient(circle,rgba(124,58,237,0.06),transparent_70%)] pointer-events-none" />

                    <div className="flex gap-5 items-start flex-wrap">
                        <div className="w-[72px] h-[72px] rounded-2xl bg-[#161625] border border-white/[0.06] flex items-center justify-center text-3xl shrink-0">
                            {org.logoUrl ? <img src={org.logoUrl} alt="" className="w-full h-full rounded-2xl object-cover" /> : "🏢"}
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center gap-3 flex-wrap mb-2">
                                <h1 className="text-2xl font-extrabold tracking-tight">{org.name}</h1>
                                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${tierBg} ${tierClr}`}>
                                    {tierEmoji} {trustTier} TRUST
                                </span>
                                {org.verified && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Verified</span>}
                            </div>
                            {org.description && <p className="text-sm text-white/40 leading-relaxed mb-3 max-w-xl">{org.description}</p>}
                            <div className="flex gap-4 flex-wrap">
                                {org.twitterHandle && (
                                    <a href={`https://twitter.com/${org.twitterHandle.replace("@", "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                                        <Twitter size={12} /> {org.twitterHandle}
                                    </a>
                                )}
                                {org.websiteUrl && (
                                    <a href={org.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                                        <Globe size={12} /> Website
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {org.gstinVerified && (
                        <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15 text-xs">
                            <Shield size={13} className="text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">GST-Verified —</span>
                            <span className="text-white/40">{org.gstinLegalName ?? "Registered entity"}</span>
                            <code className="text-[10px] text-white/20">{org.gstin}</code>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
                    {[
                        { label: "Campaigns", value: org.campaignsCreated, icon: "📋" },
                        { label: "Completed", value: org.campaignsCompleted, icon: "✅" },
                        { label: "Success Rate", value: `${completionRate}%`, icon: "📈" },
                        { label: "Total Raised", value: formatSol(org.totalRaisedLamports), icon: "💰" },
                    ].map((s) => (
                        <div key={s.label} className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-5 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-600/30 to-transparent" />
                            <div className="text-2xl mb-2">{s.icon}</div>
                            <p className="text-xl font-extrabold">{s.value}</p>
                            <p className="text-[10px] text-white/25 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* On-chain PDA */}
                {org.onchainPda && (
                    <div className="flex items-center gap-3 p-4 mb-7 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <TrendingUp size={14} className="text-violet-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white/30 mb-0.5">On-chain Reputation PDA</p>
                            <code className="text-[11px] text-white/15 break-all">{org.onchainPda}</code>
                        </div>
                        <a href={`https://explorer.solana.com/address/${org.onchainPda}?cluster=devnet`} target="_blank" rel="noreferrer">
                            <button className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 hover:bg-white/[0.06] transition-all">
                                <ExternalLink size={11} /> Explorer
                            </button>
                        </a>
                    </div>
                )}

                {/* Campaigns */}
                <h2 className="text-lg font-bold mb-5 bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Campaigns</h2>
                {!org.campaigns || org.campaigns.length === 0 ? (
                    <div className="text-center py-16 bg-[#0f0f1a] border border-white/[0.06] rounded-2xl text-white/30">
                        No campaigns yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {org.campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
                    </div>
                )}
            </main>
        </div>
    );
}
