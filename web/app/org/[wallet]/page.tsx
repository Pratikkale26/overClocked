"use client";

import { useEffect, useState, use } from "react";
import { ExternalLink, Twitter, Globe, CheckCircle } from "lucide-react";
import { Navbar } from "../../../components/layout/Navbar";
import { CampaignCard } from "../../../components/campaigns/CampaignCard";
import { fetchOrg, type Org } from "../../../lib/api";
import { formatSol, ORG_CATEGORY_LABELS } from "../../../lib/utils";

export default function OrgProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
    const { wallet } = use(params);
    const [org, setOrg] = useState<Org | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrg(decodeURIComponent(wallet))
            .then(setOrg)
            .catch(() => setOrg(null))
            .finally(() => setLoading(false));
    }, [wallet]);

    const completionRate = org ? ((org.completionRateBps ?? 0) / 100).toFixed(0) : "0";

    if (loading) {
        return (
            <div>
                <Navbar />
                <div className="container" style={{ paddingTop: 60 }}>
                    <div className="skeleton" style={{ height: 140, borderRadius: 16, marginBottom: 24 }} />
                    <div className="skeleton" style={{ height: 24, width: "40%", marginBottom: 12 }} />
                    <div className="skeleton" style={{ height: 16, width: "60%" }} />
                </div>
            </div>
        );
    }

    if (!org) {
        return (
            <div>
                <Navbar />
                <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
                    <h2>Organisation not found</h2>
                    <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
                        Wallet: {decodeURIComponent(wallet)}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <Navbar />
            <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
                {/* Org header card */}
                <div className="card" style={{ padding: 28, marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
                        {/* Logo */}
                        {org.logoUrl ? (
                            <img src={org.logoUrl} alt={org.name} style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover" }} />
                        ) : (
                            <div style={{
                                width: 72, height: 72, borderRadius: 16, flexShrink: 0,
                                background: "linear-gradient(135deg, var(--violet), var(--indigo))",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 28, fontWeight: 800, color: "#fff",
                            }}>
                                {org.name[0]}
                            </div>
                        )}

                        <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                                <h1 style={{ fontSize: "1.6rem", fontWeight: 800 }}>{org.name}</h1>
                                {org.verified && (
                                    <CheckCircle size={20} color="var(--success)" />
                                )}
                                <span className="badge badge-violet" style={{ fontSize: 12 }}>
                                    {ORG_CATEGORY_LABELS[org.category] ?? org.category}
                                </span>
                            </div>
                            {org.description && (
                                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>
                                    {org.description}
                                </p>
                            )}
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                                {org.twitterHandle && (
                                    <a href={`https://twitter.com/${org.twitterHandle.replace("@", "")}`} target="_blank" rel="noreferrer"
                                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-secondary)" }}>
                                        <Twitter size={14} /> {org.twitterHandle}
                                    </a>
                                )}
                                {org.websiteUrl && (
                                    <a href={org.websiteUrl} target="_blank" rel="noreferrer"
                                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-secondary)" }}>
                                        <Globe size={14} /> Website
                                    </a>
                                )}
                                {org.onchainPda && (
                                    <a href={`https://explorer.solana.com/address/${org.onchainPda}?cluster=devnet`} target="_blank" rel="noreferrer"
                                        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--violet-light)" }}>
                                        <ExternalLink size={14} /> On-chain Identity
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Reputation stats */}
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>On-chain Reputation</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 36 }}>
                    {[
                        { label: "Campaigns Created", value: org.campaignsCreated },
                        { label: "Campaigns Completed", value: org.campaignsCompleted },
                        { label: "Campaigns Failed", value: org.campaignsFailed },
                        { label: "Completion Rate", value: `${completionRate}%` },
                        { label: "Total Raised", value: formatSol(org.totalRaisedLamports) },
                    ].map(({ label, value }) => (
                        <div key={label} style={{
                            padding: "16px 18px",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            borderRadius: 14,
                        }}>
                            <div style={{
                                fontSize: 20, fontWeight: 800, marginBottom: 2,
                                color: label === "Campaigns Failed" && Number(org.campaignsFailed) > 0 ? "var(--danger)" : "var(--text-primary)",
                            }}>
                                {value.toString()}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* Campaigns */}
                {org.campaigns && org.campaigns.length > 0 && (
                    <>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Campaigns</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
                            {org.campaigns.map((c) => (
                                <CampaignCard key={c.id} campaign={{ ...c, org }} />
                            ))}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
