"use client";

import Link from "next/link";
import { TrendingUp, Users } from "lucide-react";
import { formatGoalProgress, formatSol } from "../../lib/utils";
import type { Campaign } from "../../lib/api";

const STATE_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  FAILED: "bg-red-500/10 text-red-400 border border-red-500/20",
  FROZEN: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
};
const STATE_LABEL: Record<string, string> = {
  ACTIVE: "Live", COMPLETED: "Done", FAILED: "Failed", FROZEN: "Frozen",
};

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const pct = formatGoalProgress(campaign.raisedLamports, campaign.totalGoalLamports);
  const donors = campaign._count?.donations ?? 0;

  return (
    <Link href={`/campaign/${campaign.id}`} className="group block">
      <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-violet-500/20 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 transition-all duration-300">

        {/* Banner area */}
        <div
          className="h-36 relative"
          style={{
            background: campaign.bannerUrl
              ? `url(${campaign.bannerUrl}) center/cover`
              : "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(79,70,229,0.06) 60%, rgba(6,182,212,0.04) 100%)",
          }}
        >
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a]/60 to-transparent" />

          <div className="absolute top-3 right-3">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATE_STYLES[campaign.state] ?? ""}`}>
              {STATE_LABEL[campaign.state] ?? campaign.state}
            </span>
          </div>

          {campaign.category && (
            <div className="absolute bottom-3 left-3">
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/70 border border-white/10">
                {campaign.category.replace("_", " ")}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {campaign.org && (
            <p className="text-[11px] font-semibold text-violet-400/80 uppercase tracking-widest mb-1.5">
              {campaign.org.name}
            </p>
          )}

          <h3 className="text-base font-bold leading-snug mb-2 line-clamp-2 text-white/90">
            {campaign.title}
          </h3>

          <p className="text-sm text-white/40 leading-relaxed line-clamp-2 mb-4">
            {campaign.description}
          </p>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-700 progress-glow"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-violet-300">
                {formatSol(campaign.raisedLamports)}
              </p>
              {campaign.hasGoal && (
                <p className="text-[11px] text-white/30">
                  of {formatSol(campaign.totalGoalLamports)} · {pct.toFixed(0)}%
                </p>
              )}
            </div>
            <div className="flex gap-3 text-[11px] text-white/30">
              <span className="flex items-center gap-1"><Users size={11} />{donors}</span>
              <span className="flex items-center gap-1"><TrendingUp size={11} />{campaign.milestones?.length ?? 0} phases</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
