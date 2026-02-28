"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Twitter, Globe, TrendingUp, ExternalLink } from "lucide-react";
import { Navbar } from "../../../components/layout/Navbar";
import { CampaignCard, CampaignCardSkeleton } from "../../../components/campaigns/CampaignCard";
import { fetchOrg, type Org } from "../../../lib/api";
import { formatSol } from "../../../lib/utils";

export default function OrgProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
    const { wallet } = use(params);
    const [org, setOrg] = useState<Org | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrg(wallet)
            .then(setOrg)
            .catch(() => setOrg(null))
            .finally(() => setLoading(false));
    }, [wallet]);

    if (loading) return (
        <div><Navbar />
            <main className="container" style={{ paddingTop: 44 }}>
                <div className="skeleton" style={{ height: 200, borderRadius: 16, marginBottom: 20 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 18 }}>
                    {[1, 2].map((i) => <CampaignCardSkeleton key={i} />)}
                </div>
            </main>
        </div>
    );

    if (!org) return (
        <div><Navbar />
            <main className="container" style={{ paddingTop: 60, textAlign: "center" }}>
                <h2>Organisation not found</h2>
                <Link href="/explore"><button className="btn btn-primary" style={{ marginTop: 14 }}>Explore Campaigns</button></Link>
            </main>
        </div>
    );

    const completionRate = Math.round((org.completionRateBps ?? 0) / 100);
    const trustTier = completionRate >= 80 ? "GOLD" : completionRate >= 50 ? "SILVER" : "BRONZE";
    const tierColor = trustTier === "GOLD" ? "#f59e0b" : trustTier === "SILVER" ? "#94a3b8" : "#a16207";
    const tierEmoji = { GOLD: "🥇", SILVER: "🥈", BRONZE: "🥉" }[trustTier];

    return (
        <div>
            <Navbar />
            <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>

                {/* Hero */}
                <div className="card" style={{ padding: 32, marginBottom: 28, position: "relative", overflow: "hidden" }}>
                    {/* Background glow */}
                    <div style={{
                        position: "absolute", top: -60, right: -60, width: 200, height: 200,
                        background: trustTier === "GOLD" ? "rgba(245,158,11,0.08)" : "rgba(124,58,237,0.08)",
                        borderRadius: "50%", pointerEvents: "none",
                    }} />

                    <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
                        {/* Logo */}
                        <div style={{
                            width: 72, height: 72, borderRadius: 18,
                            background: "var(--bg-elevated)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 32, flexShrink: 0,
                            border: "2px solid var(--border)",
                        }}>
                            {org.logoUrl ? (
                                <img src={org.logoUrl} alt={org.name} style={{ width: "100%", height: "100%", borderRadius: 16, objectFit: "cover" }} />
                            ) : "🏢"}
                        </div>

                        <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0 }}>{org.name}</h1>
                                <span style={{
                                    fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
                                    background: trustTier === "GOLD" ? "rgba(245,158,11,0.12)" : "rgba(124,58,237,0.12)",
                                    color: tierColor, border: `1px solid ${tierColor}40`,
                                }}>
                                    {tierEmoji} {trustTier} TRUST
                                </span>
                                {org.verified && (
                                    <span className="badge badge-approved">✓ Verified</span>
                                )}
                            </div>

                            {org.description && (
                                <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.65, marginBottom: 12, maxWidth: 640 }}>
                                    {org.description}
                                </p>
                            )}

                            {/* Social links */}
                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                                {org.twitterHandle && (
                                    <a href={`https://twitter.com/${org.twitterHandle.replace("@", "")}`} target="_blank" rel="noreferrer"
                                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--violet-light)" }}>
                                        <Twitter size={13} /> {org.twitterHandle}
                                    </a>
                                )}
                                {org.websiteUrl && (
                                    <a href={org.websiteUrl} target="_blank" rel="noreferrer"
                                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--violet-light)" }}>
                                        <Globe size={13} /> Website
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* GST verification */}
                    {org.gstinVerified && (
                        <div style={{
                            marginTop: 20, display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "8px 14px",
                            background: "rgba(34,197,94,0.06)",
                            border: "1px solid rgba(34,197,94,0.25)",
                            borderRadius: 10, fontSize: 13,
                        }}>
                            <Shield size={14} style={{ color: "var(--success)" }} />
                            <span style={{ color: "var(--success)", fontWeight: 600 }}>GST-Verified —</span>
                            <span style={{ color: "var(--text-secondary)" }}>{org.gstinLegalName ?? "Registered entity"}</span>
                            <code style={{ fontSize: 11, color: "var(--text-muted)" }}>{org.gstin}</code>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 28 }}>
                    {[
                        { label: "Campaigns Created", value: org.campaignsCreated, icon: "📋" },
                        { label: "Completed", value: org.campaignsCompleted, icon: "✅" },
                        { label: "Completion Rate", value: `${completionRate}%`, icon: "📈" },
                        { label: "Total Raised", value: formatSol(org.totalRaisedLamports), icon: "💰" },
                    ].map((s) => (
                        <div key={s.label} style={{
                            padding: "18px 20px",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            borderRadius: 14,
                            textAlign: "center",
                        }}>
                            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{s.value}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* On-chain reputation PDA */}
                {org.onchainPda && (
                    <div style={{
                        padding: "14px 18px", marginBottom: 28,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        display: "flex", alignItems: "center", gap: 10,
                    }}>
                        <TrendingUp size={14} style={{ color: "var(--violet-light)", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 2 }}>
                                On-chain Reputation PDA
                            </div>
                            <code style={{ fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all" }}>
                                {org.onchainPda}
                            </code>
                        </div>
                        <a
                            href={`https://explorer.solana.com/address/${org.onchainPda}?cluster=devnet`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ flexShrink: 0 }}
                        >
                            <button className="btn btn-ghost btn-sm">
                                <ExternalLink size={12} /> Explorer
                            </button>
                        </a>
                    </div>
                )}

                {/* Campaigns */}
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Campaigns</h2>
                {!org.campaigns || org.campaigns.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)" }}>
                        No campaigns yet.
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 18 }}>
                        {org.campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
                    </div>
                )}
            </main>
        </div>
    );
}
