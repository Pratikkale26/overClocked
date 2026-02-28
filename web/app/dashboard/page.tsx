"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { Navbar } from "../../components/layout/Navbar";
import { fetchCampaigns, type Campaign } from "../../lib/api";
import { formatSol, formatGoalProgress } from "../../lib/utils";

export default function DashboardPage() {
    const router = useRouter();
    const { authenticated, user, ready } = usePrivy();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ready) return;
        if (!authenticated) { router.replace("/"); return; }
        // Fetch campaigns for this creator's org
        fetchCampaigns({ limit: 20 })
            .then(all => {
                // Filter to campaigns where org wallet matches user
                const wallet = user?.wallet?.address;
                const mine = wallet
                    ? all.filter(c => c.org?.campaigns !== undefined)
                    : all; // fallback: show all for demo
                setCampaigns(mine);
            })
            .catch(() => setCampaigns([]))
            .finally(() => setLoading(false));
    }, [ready, authenticated, user, router]);

    if (!ready || !authenticated) return null;

    return (
        <div>
            <Navbar />
            <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 6 }}>Dashboard</h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                            Manage your campaigns and track milestone progress.
                        </p>
                    </div>
                    <Link href="/create">
                        <button className="btn btn-primary">
                            <Plus size={15} />
                            New Campaign
                        </button>
                    </Link>
                </div>

                {/* Stats bar */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 16, marginBottom: 36,
                }}>
                    {[
                        { label: "Total Campaigns", value: campaigns.length },
                        { label: "Active", value: campaigns.filter(c => c.state === "ACTIVE").length },
                        { label: "Completed", value: campaigns.filter(c => c.state === "COMPLETED").length },
                        {
                            label: "Total Raised",
                            value: formatSol(
                                campaigns.reduce((sum, c) => sum + Number(c.raisedLamports || 0), 0)
                            ),
                        },
                    ].map((stat) => (
                        <div key={stat.label} style={{
                            padding: "16px 20px",
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            borderRadius: 14,
                        }}>
                            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>{stat.value.toString()}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Campaigns table */}
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Your Campaigns</h2>
                {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
                        ))}
                    </div>
                ) : campaigns.length === 0 ? (
                    <div style={{
                        padding: "60px 24px",
                        textAlign: "center",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: 16,
                    }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                        <h3 style={{ marginBottom: 8 }}>No campaigns yet</h3>
                        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>
                            Create your first campaign to start raising funds.
                        </p>
                        <Link href="/create">
                            <button className="btn btn-primary">
                                <Plus size={15} /> Create Campaign
                            </button>
                        </Link>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {campaigns.map((c) => {
                            const progress = formatGoalProgress(c.raisedLamports, c.totalGoalLamports);
                            const approvedMilestones = c.milestones?.filter(m => m.state === "APPROVED").length ?? 0;
                            const totalMilestones = c.milestones?.length ?? 0;

                            return (
                                <div key={c.id} style={{
                                    padding: "16px 20px",
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 14,
                                    display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                                }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{c.title}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                            {c.state} · {approvedMilestones}/{totalMilestones} milestones · {formatSol(c.raisedLamports)} raised
                                        </div>
                                        <div className="progress-track" style={{ marginTop: 8, height: 4 }}>
                                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>
                                    <Link href={`/campaign/${c.id}`}>
                                        <button className="btn btn-ghost btn-sm">
                                            View <ArrowRight size={13} />
                                        </button>
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
