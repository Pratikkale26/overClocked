"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, MapPin, Globe, TrendingUp, Users } from "lucide-react";
import { Navbar } from "../../../components/layout/Navbar";
import { CampaignCard } from "../../../components/campaigns/CampaignCard";
import { fetchOrg, fetchCampaigns, type Campaign } from "../../../lib/api";
import { formatSol, shortenAddress, ORG_CATEGORY_LABELS } from "../../../lib/utils";

export default function OrgProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
    const { wallet } = use(params);
    const [org, setOrg] = useState<Record<string, unknown> | null>(null);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const o = await fetchOrg(wallet);
                setOrg(o);
                const allCampaigns = await fetchCampaigns({ limit: 100 });
                setCampaigns(allCampaigns.filter(
                    (c) => c.org?.walletAddress?.toLowerCase() === wallet.toLowerCase() || c.org?.id === (o as Record<string, unknown>)?.id
                ));
            } catch { setOrg(null); } finally { setLoading(false); }
        })();
    }, [wallet]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
                <Navbar />
                <main className="mx-auto max-w-[1200px] px-8 pt-16">
                    <div className="skeleton h-56 rounded-xl mb-6" />
                    <div className="grid grid-cols-3 gap-6">{[1, 2, 3].map(i => <div key={i} className="skeleton h-64 rounded-xl" />)}</div>
                </main>
            </div>
        );
    }

    if (!org) {
        return (
            <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
                <Navbar />
                <main className="mx-auto max-w-[1200px] px-8 pt-24 text-center">
                    <div className="text-6xl mb-6">🏢</div>
                    <h2 className="text-2xl font-bold mb-4">Organisation not found</h2>
                    <Link href="/explore">
                        <button className="px-8 py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base hover:bg-[#245A42] transition-all duration-150 min-h-[48px]">Back to Explore</button>
                    </Link>
                </main>
            </div>
        );
    }

    const name = (org.name as string) ?? "Unknown";
    const category = ORG_CATEGORY_LABELS[(org.category as string) ?? ""] ?? (org.category as string);
    const completionRate = Math.round(((org.completionRateBps as number) ?? 0) / 100);
    const trustTier = completionRate >= 80 ? "GOLD" : completionRate >= 50 ? "SILVER" : "BRONZE";
    const tierClr = trustTier === "GOLD" ? "text-[#C2850C]" : trustTier === "SILVER" ? "text-[#6B7280]" : "text-[#92633A]";
    const tierBg = trustTier === "GOLD" ? "bg-[#C2850C]/8 border-[#C2850C]/20" : trustTier === "SILVER" ? "bg-[#6B7280]/8 border-[#6B7280]/20" : "bg-[#92633A]/8 border-[#92633A]/20";

    return (
        <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
            <Navbar />

            <main className="mx-auto max-w-[1200px] px-8 pt-12 pb-24">
                <Link href="/explore">
                    <button className="flex items-center gap-2 text-base text-[#1A1F2E]/40 hover:text-[#1A1F2E]/70 transition-colors duration-150 mb-8 min-h-[44px]">
                        <ArrowLeft size={16} /> Back to Explore
                    </button>
                </Link>

                {/* Org Hero */}
                <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)] mb-8">
                    <div className="flex items-start gap-6 flex-wrap">
                        <div className="w-20 h-20 rounded-xl bg-[#F0EFEB] flex items-center justify-center text-4xl shrink-0">
                            {(org.logoUrl as string)
                                ? <img src={org.logoUrl as string} alt="" className="w-full h-full rounded-xl object-cover" />
                                : "🏢"}
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center gap-4 flex-wrap mb-2">
                                <h1 className="text-3xl font-extrabold tracking-tight">{name}</h1>
                                <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${tierBg} ${tierClr}`}>
                                    ⬡ {trustTier}
                                </span>
                            </div>
                            <p className="text-base text-[#1A1F2E]/45 mb-4">{category}</p>
                            {(org.description as string) && (
                                <p className="text-base text-[#1A1F2E]/60 leading-relaxed mb-6 max-w-xl">{org.description as string}</p>
                            )}

                            <div className="flex flex-wrap gap-3 text-sm">
                                {(org.gstinVerified as boolean) && (
                                    <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2D6A4F]/8 border border-[#2D6A4F]/20 text-[#2D6A4F] min-h-[40px]">
                                        <Shield size={14} /> GST-verified
                                    </span>
                                )}
                                {(org.twitterHandle as string) && (
                                    <a href={`https://twitter.com/${(org.twitterHandle as string).replace("@", "")}`} target="_blank" rel="noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F0EFEB] border border-[#E4E2DC] text-[#1A1F2E]/60 hover:text-[#1A1F2E] transition-colors duration-150 min-h-[40px]">
                                        <Users size={14} /> {org.twitterHandle as string}
                                    </a>
                                )}
                                {(org.websiteUrl as string) && (
                                    <a href={org.websiteUrl as string} target="_blank" rel="noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F0EFEB] border border-[#E4E2DC] text-[#1A1F2E]/60 hover:text-[#1A1F2E] transition-colors duration-150 min-h-[40px]">
                                        <Globe size={14} /> Website
                                    </a>
                                )}
                                {(org.location as string) && (
                                    <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F0EFEB] border border-[#E4E2DC] text-[#1A1F2E]/40 min-h-[40px]">
                                        <MapPin size={14} /> {org.location as string}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {(org.walletAddress as string) && (
                        <div className="mt-8 pt-6 border-t border-[#E4E2DC]">
                            <p className="text-xs font-['DM_Mono'] text-[#1A1F2E]/20">
                                Wallet: {shortenAddress(org.walletAddress as string, 8)}
                                {(org.onchainPda as string) && <span className="ml-4">PDA: {shortenAddress(org.onchainPda as string, 8)}</span>}
                            </p>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                    {[
                        { label: "Campaigns Created", value: org.campaignsCreated },
                        { label: "Completed", value: org.campaignsCompleted },
                        { label: "Success Rate", value: `${completionRate}%` },
                        { label: "Total Raised", value: formatSol(((org.totalRaisedLamports ?? 0) as number)) },
                    ].map((s) => (
                        <div key={s.label} className="bg-white border border-[#E4E2DC] rounded-xl p-6 text-center shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
                            <p className="text-2xl font-extrabold text-[#1A1F2E]">{String(s.value ?? 0)}</p>
                            <p className="text-sm text-[#1A1F2E]/35 mt-2 uppercase tracking-wider font-semibold">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Campaigns */}
                <div className="border-t border-[#E4E2DC] relative mb-8">
                    <div className="absolute left-0 top-0 w-12 h-[2px] bg-[#2D6A4F]" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-8 flex items-center gap-3">
                    <TrendingUp size={22} className="text-[#2D6A4F]" /> Campaigns
                </h2>

                {campaigns.length === 0 ? (
                    <div className="text-center py-24 text-[#1A1F2E]/30">
                        <p className="text-base">No campaigns found for this organisation.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
                    </div>
                )}
            </main>
        </div>
    );
}
