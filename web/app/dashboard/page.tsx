"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { Navbar } from "../../components/layout/Navbar";
import { fetchCampaigns, type Campaign } from "../../lib/api";
import { formatSol, formatGoalProgress, LAMPORTS_PER_SOL } from "../../lib/utils";

const YIELD_APY = 0.10; // 10% APY mock

function computeMockYield(raisedLamports: string, createdAt: string): number {
    const sol = Number(raisedLamports) / LAMPORTS_PER_SOL;
    const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return sol * YIELD_APY * Math.max(0, days) / 365;
}

export default function DashboardPage() {
    const router = useRouter();
    const { authenticated, user, ready } = usePrivy();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"creator" | "donor">("creator");

    useEffect(() => {
        if (!ready) return;
        if (!authenticated) { router.replace("/"); return; }
        fetchCampaigns({ limit: 50 })
            .then(setCampaigns)
            .catch(() => setCampaigns([]))
            .finally(() => setLoading(false));
    }, [ready, authenticated, router]);

    if (!ready || !authenticated) return null;

    const wallet = user?.wallet?.address;

    // Creator campaigns (orgs where wallet matches)
    const myCampaigns = campaigns; // backend should filter; using all for demo

    // Donor campaigns: campaigns with UNDER_REVIEW milestone (mock donor view)
    const donorCampaigns = campaigns.filter((c) =>
        c.milestones?.some((m) => m.state === "UNDER_REVIEW" || m.state === "APPROVED")
    );

    const totalRaised = myCampaigns.reduce((s, c) => s + Number(c.raisedLamports || 0), 0);
    const pendingVotes = donorCampaigns.filter((c) => c.milestones?.some((m) => m.state === "UNDER_REVIEW")).length;
    const totalMockYield = donorCampaigns.reduce((s, c) => s + computeMockYield(c.raisedLamports, c.createdAt), 0);

    const tabStyle = (active: boolean) => ({
        padding: "10px 22px",
        fontWeight: 700,
        fontSize: 14,
        cursor: "pointer",
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid var(--violet)" : "2px solid transparent",
        color: active ? "var(--violet-light)" : "var(--text-muted)",
        transition: "all 200ms",
        fontFamily: "inherit",
    });

    return (
        <div>
            <Navbar />
            <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 4 }}>Dashboard</h1>
                        {wallet && (
                            <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-muted)" }}>
                                {wallet.slice(0, 6)}…{wallet.slice(-6)}
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <Link href="/create">
                            <button className="btn btn-primary">
                                <Plus size={15} /> New Campaign
                            </button>
                        </Link>
                    </div>
                </div>

                {/* Pending votes alert */}
                {pendingVotes > 0 && (
                    <div style={{
                        padding: "14px 18px", marginBottom: 24,
                        background: "rgba(245,158,11,0.06)",
                        border: "1px solid rgba(245,158,11,0.3)",
                        borderRadius: 12,
                        display: "flex", alignItems: "center", gap: 12,
                    }}>
                        <AlertTriangle size={16} style={{ color: "var(--warning)", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 700, color: "var(--warning)" }}>
                                {pendingVotes} campaign{pendingVotes > 1 ? "s" : ""} awaiting your vote
                            </span>
                            <span style={{ color: "var(--text-secondary)", fontSize: 13, marginLeft: 8 }}>
                                Your stake-weighted vote determines fund release.
                            </span>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setTab("donor")}>
                            View <ArrowRight size={13} />
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div style={{ borderBottom: "1px solid var(--border)", marginBottom: 28, display: "flex" }}>
                    <button style={tabStyle(tab === "creator")} onClick={() => setTab("creator")}>
                        🏢 My Campaigns
                    </button>
                    <button style={tabStyle(tab === "donor")} onClick={() => setTab("donor")}>
                        💰 My Donations
                        {pendingVotes > 0 && (
                            <span style={{
                                marginLeft: 8, fontSize: 11, padding: "2px 7px", borderRadius: 99,
                                background: "var(--warning)", color: "#000", fontWeight: 800,
                            }}>{pendingVotes}</span>
                        )}
                    </button>
                </div>

                {/* ── Creator Tab ── */}
                {tab === "creator" && (
                    <>
                        {/* Stats */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 28 }}>
                            {[
                                { label: "Campaigns", value: myCampaigns.length, icon: "📋" },
                                { label: "Active", value: myCampaigns.filter((c) => c.state === "ACTIVE").length, icon: "🟢" },
                                { label: "Completed", value: myCampaigns.filter((c) => c.state === "COMPLETED").length, icon: "✅" },
                                { label: "Total Raised", value: formatSol(totalRaised), icon: "💎" },
                            ].map((s) => (
                                <div key={s.label} style={{ padding: "18px 16px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, textAlign: "center" }}>
                                    <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>{typeof s.value === "number" ? s.value : s.value}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
                            </div>
                        ) : myCampaigns.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                                <h3 style={{ marginBottom: 8 }}>No campaigns yet</h3>
                                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>Create your first milestone-backed campaign.</p>
                                <Link href="/create"><button className="btn btn-primary"><Plus size={14} /> Create Campaign</button></Link>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {myCampaigns.map((c) => {
                                    const progress = formatGoalProgress(c.raisedLamports, c.totalGoalLamports);
                                    const approved = c.milestones?.filter((m) => m.state === "APPROVED").length ?? 0;
                                    const hasVoting = c.milestones?.some((m) => m.state === "UNDER_REVIEW");
                                    return (
                                        <div key={c.id} style={{
                                            padding: "16px 20px", background: "var(--bg-card)", border: `1px solid ${hasVoting ? "rgba(245,158,11,0.3)" : "var(--border)"}`,
                                            borderRadius: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                                        }}>
                                            <div style={{ flex: 1, minWidth: 200 }}>
                                                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3, display: "flex", alignItems: "center", gap: 8 }}>
                                                    {c.title}
                                                    {hasVoting && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "rgba(245,158,11,0.12)", color: "var(--warning)", fontWeight: 700 }}>🗳️ Voting Open</span>}
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                    {c.state} · {approved}/{c.milestones?.length ?? 0} phases · {formatSol(c.raisedLamports)} raised
                                                </div>
                                                <div className="progress-track" style={{ marginTop: 8, height: 4 }}>
                                                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                {hasVoting && (
                                                    <Link href={`/campaign/${c.id}`}>
                                                        <button className="btn btn-sm" style={{ background: "rgba(245,158,11,0.1)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.3)" }}>
                                                            View Votes
                                                        </button>
                                                    </Link>
                                                )}
                                                <Link href={`/campaign/${c.id}/manage`}>
                                                    <button className="btn btn-ghost btn-sm">Manage</button>
                                                </Link>
                                                <Link href={`/campaign/${c.id}`}>
                                                    <button className="btn btn-ghost btn-sm"><ArrowRight size={13} /></button>
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {/* ── Donor Tab ── */}
                {tab === "donor" && (
                    <>
                        {/* Yield summary card */}
                        <div style={{
                            padding: "22px 24px", marginBottom: 24,
                            background: "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(124,58,237,0.06) 100%)",
                            border: "1px solid rgba(34,197,94,0.2)",
                            borderRadius: 16,
                            display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
                        }}>
                            <div style={{ fontSize: 40 }}>💰</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                                    Estimated Yield Accrued
                                </div>
                                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
                                    {totalMockYield.toFixed(4)} SOL
                                </div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                                    @ 10% APY on locked SOL · Claimable when campaign completes
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>V2: Real yield via</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>Marinade / Kamino</div>
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {[1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />)}
                            </div>
                        ) : donorCampaigns.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "60px 24px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16 }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
                                <h3 style={{ marginBottom: 8 }}>No donations yet</h3>
                                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>Find campaigns to support.</p>
                                <Link href="/explore"><button className="btn btn-primary">Explore Campaigns</button></Link>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                {donorCampaigns.map((c) => {
                                    const yieldAccrued = computeMockYield(c.raisedLamports, c.createdAt);
                                    const underReview = c.milestones?.find((m) => m.state === "UNDER_REVIEW");
                                    return (
                                        <div key={c.id} style={{
                                            padding: "18px 20px", background: "var(--bg-card)",
                                            border: `1px solid ${underReview ? "rgba(245,158,11,0.3)" : "var(--border)"}`,
                                            borderRadius: 14,
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                                                        {c.title}
                                                        {c.org?.gstinVerified && <Shield size={13} style={{ color: "var(--success)" }} />}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                                                        {c.org?.name} · {c.state}
                                                    </div>
                                                    <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                                                        <span>
                                                            <TrendingUp size={12} style={{ marginRight: 4, color: "var(--success)" }} />
                                                            <span style={{ color: "var(--success)", fontWeight: 700 }}>+{yieldAccrued.toFixed(4)} SOL</span>
                                                            <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>yield</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                                                    {underReview && (
                                                        <Link href={`/campaign/${c.id}`}>
                                                            <button className="btn btn-sm" style={{
                                                                background: "rgba(245,158,11,0.1)", color: "var(--warning)",
                                                                border: "1px solid rgba(245,158,11,0.3)", fontWeight: 700,
                                                            }}>
                                                                🗳️ Vote Now
                                                            </button>
                                                        </Link>
                                                    )}
                                                    <Link href={`/campaign/${c.id}`}>
                                                        <button className="btn btn-ghost btn-sm">View <ArrowRight size={12} /></button>
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
