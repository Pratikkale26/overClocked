"use client";

import Link from "next/link";
import type { Campaign } from "../../lib/api";
import { formatGoalProgress, formatSol } from "../../lib/utils";

type CampaignCardProps = {
  campaign: Campaign;
};

export function CampaignCard({ campaign }: CampaignCardProps) {
  const progress = formatGoalProgress(campaign.raisedLamports, campaign.totalGoalLamports);

  return (
    <article
      className="card"
      style={{
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{campaign.title}</h3>
        <span className="badge badge-violet">{campaign.state}</span>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}>
        {campaign.description}
      </p>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Raised {formatSol(campaign.raisedLamports)} of {formatSol(campaign.totalGoalLamports)}
      </div>
      <div className="progress-track" style={{ height: 6 }}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {campaign.milestones?.length ?? 0} milestones
        </span>
        <Link href={`/campaign/${campaign.id}`}>
          <button className="btn btn-primary btn-sm">View</button>
        </Link>
      </div>
    </article>
  );
}

export function CampaignCardSkeleton() {
  return <div className="skeleton" style={{ borderRadius: 14, height: 220 }} />;
}
