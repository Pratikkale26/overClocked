"use client";

import Link from "next/link";
import { TrendingUp, Users } from "lucide-react";
import { formatGoalProgress, formatSol } from "../../lib/utils";
import type { Campaign } from "../../lib/api";

const STATE_STYLES: Record<string, string> = {
  ACTIVE: "bg-[#2D6A4F]/10 text-[#2D6A4F] border border-[#2D6A4F]/20",
  COMPLETED: "bg-[#2D6A4F]/10 text-[#2D6A4F] border border-[#2D6A4F]/20",
  FAILED: "bg-[#C44536]/10 text-[#C44536] border border-[#C44536]/20",
  FROZEN: "bg-[#1A1F2E]/10 text-[#1A1F2E]/60 border border-[#1A1F2E]/15",
};
const STATE_LABEL: Record<string, string> = {
  ACTIVE: "Live", COMPLETED: "Done", FAILED: "Failed", FROZEN: "Frozen",
};

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const pct = formatGoalProgress(campaign.raisedLamports, campaign.totalGoalLamports);
  const donors = campaign._count?.donations ?? 0;

  return (
    <Link href={`/campaign/${campaign.id}`} className="group block">
      <div className="bg-white border border-[#E4E2DC] rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(26,31,46,0.06)] hover:border-[#C5C3BD] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(26,31,46,0.10)] transition-all duration-200">

        {/* Banner area */}
        <div
          className="h-40 relative"
          style={{
            background: campaign.bannerUrl
              ? `url(${campaign.bannerUrl}) center/cover`
              : "linear-gradient(135deg, rgba(45,106,79,0.08) 0%, rgba(26,31,46,0.04) 60%, rgba(45,106,79,0.03) 100%)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent" />

          <div className="absolute top-4 right-4">
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg ${STATE_STYLES[campaign.state] ?? ""}`}>
              {STATE_LABEL[campaign.state] ?? campaign.state}
            </span>
          </div>

          {campaign.category && (
            <div className="absolute bottom-4 left-4">
              <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur-sm text-[#1A1F2E]/70 border border-[#E4E2DC]">
                {campaign.category.replace("_", " ")}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {campaign.org && (
            <p className="text-xs font-semibold text-[#2D6A4F] uppercase tracking-widest mb-2">
              {campaign.org.name}
            </p>
          )}

          <h3 className="text-lg font-bold leading-snug mb-2 line-clamp-2 text-[#1A1F2E]">
            {campaign.title}
          </h3>

          <p className="text-base text-[#1A1F2E]/45 leading-relaxed line-clamp-2 mb-6">
            {campaign.description}
          </p>

          {/* Progress bar */}
          <div className="h-2 w-full bg-[#F0EFEB] rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-[#2D6A4F] transition-all duration-700 progress-animate"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-[#2D6A4F]">
                {formatSol(campaign.raisedLamports)}
              </p>
              {campaign.hasGoal && (
                <p className="text-sm text-[#1A1F2E]/30">
                  of {formatSol(campaign.totalGoalLamports)} · {pct.toFixed(0)}%
                </p>
              )}
            </div>
            <div className="flex gap-4 text-sm text-[#1A1F2E]/30">
              <span className="flex items-center gap-1.5"><Users size={14} />{donors}</span>
              <span className="flex items-center gap-1.5"><TrendingUp size={14} />{campaign.milestones?.length ?? 0} phases</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
