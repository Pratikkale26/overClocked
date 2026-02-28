"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "../../../components/layout/Navbar";
import { DonateModal } from "../../../components/campaigns/DonateModal";
import { MilestoneTimeline } from "../../../components/campaigns/MilestoneTimeline";
import { fetchCampaign, type Campaign } from "../../../lib/api";
import { formatGoalProgress, formatSol } from "../../../lib/utils";

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [donateOpen, setDonateOpen] = useState(false);

  useEffect(() => {
    fetchCampaign(id)
      .then(setCampaign)
      .catch(() => setCampaign(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div>
        <Navbar />
        <main className="container" style={{ paddingTop: 44 }}>
          <div className="skeleton" style={{ height: 220, borderRadius: 16 }} />
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
          <p style={{ color: "var(--text-muted)", marginTop: 8 }}>ID: {id}</p>
          <Link href="/explore">
            <button className="btn btn-primary" style={{ marginTop: 14 }}>
              Back to Explore
            </button>
          </Link>
        </main>
      </div>
    );
  }

  const progress = formatGoalProgress(campaign.raisedLamports, campaign.totalGoalLamports);

  return (
    <div>
      <Navbar />
      <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className="card" style={{ padding: 24, marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontSize: "1.9rem", fontWeight: 800, marginBottom: 8 }}>{campaign.title}</h1>
              <p style={{ color: "var(--text-secondary)", lineHeight: 1.65 }}>{campaign.description}</p>
            </div>
            <span className="badge badge-violet" style={{ height: "fit-content" }}>
              {campaign.state}
            </span>
          </div>

          <div style={{ marginTop: 16, marginBottom: 8, fontSize: 14, color: "var(--text-secondary)" }}>
            Raised {formatSol(campaign.raisedLamports)} of {formatSol(campaign.totalGoalLamports)}
          </div>
          <div className="progress-track" style={{ height: 8 }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => setDonateOpen(true)}>
              Donate
            </button>
            {campaign.org ? (
              <Link href={`/org/${encodeURIComponent(campaign.org.onchainPda ?? campaign.org.id)}`}>
                <button className="btn btn-ghost">View Organization</button>
              </Link>
            ) : null}
          </div>
        </div>

        <MilestoneTimeline milestones={campaign.milestones ?? []} />
      </main>

      <DonateModal campaignId={campaign.id} open={donateOpen} onClose={() => setDonateOpen(false)} />
    </div>
  );
}
