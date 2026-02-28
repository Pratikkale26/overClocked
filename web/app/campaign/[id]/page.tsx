"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ExternalLink, Users, TrendingUp, Shield, AlertCircle } from "lucide-react";
import { Navbar } from "../../../components/layout/Navbar";
import { DonateModal } from "../../../components/campaigns/DonateModal";
import { MilestoneTimeline } from "../../../components/campaigns/MilestoneTimeline";
import { DprTimeline } from "../../../components/campaigns/DprTimeline";
import { VotingPanel } from "../../../components/campaigns/VotingPanel";
import {
  fetchCampaign, fetchMilestoneProof, fetchMilestoneUpdates,
  type Campaign, type Milestone, type MilestoneProof, type MilestoneUpdate,
} from "../../../lib/api";
import { formatGoalProgress, formatSol } from "../../../lib/utils";

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [donateOpen, setDonateOpen] = useState(false);

  // For the active milestone under review
  const [activeProof, setActiveProof] = useState<MilestoneProof | null>(null);
  const [activeUpdates, setActiveUpdates] = useState<MilestoneUpdate[]>([]);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);

  const load = useCallback(async () => {
    try {
      const c = await fetchCampaign(id);
      setCampaign(c);
      // Find the active milestone (UNDER_REVIEW or most recent PENDING)
      const underReview = c.milestones?.find((m) => m.state === "UNDER_REVIEW");
      const target = underReview ?? c.milestones?.find((m) => m.state === "PENDING") ?? c.milestones?.[0];
      if (target) {
        setActiveMilestone(target);
        const [proof, updates] = await Promise.allSettled([
          fetchMilestoneProof(target.id),
          fetchMilestoneUpdates(target.id),
        ]);
        setActiveProof(proof.status === "fulfilled" ? proof.value : null);
        setActiveUpdates(updates.status === "fulfilled" ? updates.value : []);
      }
    } catch {
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div>
        <Navbar />
        <main className="container" style={{ paddingTop: 44 }}>
          <div className="skeleton" style={{ height: 220, borderRadius: 16, marginBottom: 20 }} />
          <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />
        </main>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div>
        <Navbar />
        <main className="container" style={{ paddingTop: 60, textAlign: "center" }}>
          <h2>Campaign not found</h2>
          <Link href="/explore"><button className="btn btn-primary" style={{ marginTop: 14 }}>Back to Explore</button></Link>
        </main>
      </div>
    );
  }

  const progress = formatGoalProgress(campaign.raisedLamports, campaign.totalGoalLamports);
  const completionRate = campaign.org ? Math.round((campaign.org.completionRateBps ?? 0) / 100) : 0;
  const trustTier = completionRate >= 80 ? "GOLD" : completionRate >= 50 ? "SILVER" : "BRONZE";
  const tierColor = trustTier === "GOLD" ? "#f59e0b" : trustTier === "SILVER" ? "#94a3b8" : "#a16207";

  return (
    <div>
      <Navbar />
      <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>

          {/* ── Left column ── */}
          <div style={{ minWidth: 0 }}>

            {/* Hero card */}
            <div className="card" style={{ padding: 28, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--violet-light)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    {campaign.org?.name}
                  </div>
                  <h1 style={{ fontSize: "1.75rem", fontWeight: 800, lineHeight: 1.25, marginBottom: 12 }}>
                    {campaign.title}
                  </h1>
                  <p style={{ color: "var(--text-secondary)", lineHeight: 1.65, fontSize: 15 }}>
                    {campaign.description}
                  </p>
                </div>
                <span className={`badge badge-${campaign.state.toLowerCase()}`} style={{ height: "fit-content", flexShrink: 0 }}>
                  {campaign.state}
                </span>
              </div>

              {/* Tags */}
              {campaign.tags?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                  {campaign.tags.map((t) => (
                    <span key={t} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Progress */}
              <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)" }}>
                <span><strong style={{ color: "var(--text-primary)", fontSize: 16 }}>{formatSol(campaign.raisedLamports)}</strong> raised</span>
                <span>Goal: {formatSol(campaign.totalGoalLamports)}</span>
              </div>
              <div className="progress-track" style={{ height: 10, marginBottom: 6 }}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {progress.toFixed(0)}% funded · {campaign._count?.donations ?? 0} donors
              </div>
            </div>

            {/* Voting panel — shown when UNDER_REVIEW */}
            {activeMilestone && activeMilestone.state === "UNDER_REVIEW" && (
              <VotingPanel
                milestone={activeMilestone}
                proof={activeProof}
                campaignId={campaign.id}
                raisedLamports={campaign.raisedLamports}
                onVoted={load}
              />
            )}

            {/* DPR Activity Timeline */}
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>
                📋 Activity Log
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400, marginLeft: 10 }}>
                  Live proof-of-history — updated like git commits
                </span>
              </h2>
              <DprTimeline updates={activeUpdates} />
              <Link href={`/campaigns/${campaign.id}/audit`} style={{ display: "block", marginTop: 16, textAlign: "center" }}>
                <button className="btn btn-ghost btn-sm" style={{ width: "100%" }}>
                  <ExternalLink size={13} /> View Full Audit Chain
                </button>
              </Link>
            </div>

            {/* DPR Milestone phases */}
            <MilestoneTimeline milestones={campaign.milestones ?? []} />
          </div>

          {/* ── Right column ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Donate card */}
            <div className="card" style={{ padding: 22 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Support this campaign</h3>
              <button
                className="btn btn-primary"
                style={{ width: "100%", padding: "14px" }}
                onClick={() => setDonateOpen(true)}
                disabled={campaign.state !== "ACTIVE"}
              >
                {campaign.state === "ACTIVE" ? "Donate SOL / UPI" : "Campaign Closed"}
              </button>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 10, lineHeight: 1.6 }}>
                Funds go into an on-chain escrow vault.
                Released only after donor voting approves each milestone.
              </div>
              {/* Yield hint */}
              <div style={{
                marginTop: 14, padding: "10px 14px",
                background: "rgba(34,197,94,0.06)",
                border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: 10, fontSize: 12,
              }}>
                <span style={{ color: "var(--success)", fontWeight: 700 }}>💰 8–12% APY</span>
                <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>
                  Your locked SOL earns yield while it waits.
                </span>
              </div>
            </div>

            {/* Org reputation card */}
            {campaign.org && (
              <div className="card" style={{ padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  {campaign.org.logoUrl ? (
                    <img src={campaign.org.logoUrl} alt={campaign.org.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
                  ) : (
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: "var(--bg-elevated)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                    }}>🏢</div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{campaign.org.name}</div>
                    <div style={{ fontSize: 11, color: tierColor, fontWeight: 700 }}>⬡ {trustTier} tier</div>
                  </div>
                </div>

                {/* GSTIN verification */}
                {campaign.org.gstinVerified && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, padding: "8px 12px", background: "rgba(34,197,94,0.06)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.2)" }}>
                    <Shield size={13} style={{ color: "var(--success)" }} />
                    <span style={{ fontSize: 12, color: "var(--success)" }}>GST-verified organization</span>
                  </div>
                )}

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Campaigns", value: campaign.org.campaignsCreated },
                    { label: "Completed", value: campaign.org.campaignsCompleted },
                    { label: "Success Rate", value: `${completionRate}%` },
                    { label: "Total Raised", value: formatSol(campaign.org.totalRaisedLamports) },
                  ].map((s) => (
                    <div key={s.label} style={{ padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* On-chain PDA */}
                {campaign.org.onchainPda && (
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)", wordBreak: "break-all", padding: "8px 10px", background: "var(--bg-elevated)", borderRadius: 8 }}>
                    On-chain: {campaign.org.onchainPda}
                  </div>
                )}

                {campaign.org.twitterHandle && (
                  <a
                    href={`https://twitter.com/${campaign.org.twitterHandle.replace("@", "")}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, color: "var(--violet-light)" }}
                  >
                    <Users size={12} /> {campaign.org.twitterHandle}
                  </a>
                )}

                {campaign.org?.id && (
                  <Link href={`/org/${campaign.org.id}`}>
                    <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 12 }}>
                      <TrendingUp size={13} /> View Full Profile
                    </button>
                  </Link>
                )}
              </div>
            )}

            {/* Unregistered vendor warning */}
            {activeProof?.isUnregisteredVendor && (
              <div style={{
                padding: "14px 16px",
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.25)",
                borderRadius: 12,
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertCircle size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: "var(--warning)" }}>
                    <strong>Unregistered vendor</strong> — this vendor is below the GST registration threshold (₹40L turnover). Verify manually before voting.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <DonateModal campaignId={campaign.id} open={donateOpen} onClose={() => setDonateOpen(false)} />
    </div>
  );
}
