"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ExternalLink, Users, TrendingUp, Shield, AlertCircle, Heart } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@solana/wallet-adapter-react";
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
  const { user } = usePrivy();
  const { publicKey } = useWallet();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [donateOpen, setDonateOpen] = useState(false);
  const [activeProof, setActiveProof] = useState<MilestoneProof | null>(null);
  const [activeUpdates, setActiveUpdates] = useState<MilestoneUpdate[]>([]);
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);

  const load = useCallback(async () => {
    try {
      const c = await fetchCampaign(id);
      setCampaign(c);
      const target = c.milestones?.find((m) => m.state === "UNDER_REVIEW") ?? c.milestones?.find((m) => m.state === "PENDING") ?? c.milestones?.[0];
      if (target) {
        setActiveMilestone(target);
        const [proof, updates] = await Promise.allSettled([
          fetchMilestoneProof(target.id),
          fetchMilestoneUpdates(target.id),
        ]);
        setActiveProof(proof.status === "fulfilled" ? proof.value : null);
        setActiveUpdates(updates.status === "fulfilled" ? updates.value : []);
      }
    } catch { setCampaign(null); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const selectMilestone = useCallback(async (milestone: Milestone) => {
    setActiveMilestone(milestone);
    const [proof, updates] = await Promise.allSettled([
      fetchMilestoneProof(milestone.id),
      fetchMilestoneUpdates(milestone.id),
    ]);
    setActiveProof(proof.status === "fulfilled" ? proof.value : null);
    setActiveUpdates(updates.status === "fulfilled" ? updates.value : []);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
        <Navbar />
        <main className="mx-auto max-w-[1200px] px-8 pt-16">
          <div className="skeleton h-64 rounded-xl mb-6" />
          <div className="skeleton h-48 rounded-xl" />
        </main>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
        <Navbar />
        <main className="mx-auto max-w-[1200px] px-8 pt-24 text-center">
          <div className="text-6xl mb-6">🔍</div>
          <h2 className="text-2xl font-bold mb-4">Campaign not found</h2>
          <Link href="/explore">
            <button className="px-8 py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base hover:bg-[#245A42] transition-all duration-150 min-h-[48px]">
              Back to Explore
            </button>
          </Link>
        </main>
      </div>
    );
  }

  const progress = formatGoalProgress(campaign.raisedLamports, campaign.totalGoalLamports);
  const completionRate = campaign.org ? Math.round((campaign.org.completionRateBps ?? 0) / 100) : 0;
  const trustTier = completionRate >= 80 ? "GOLD" : completionRate >= 50 ? "SILVER" : "BRONZE";
  const tierClr = trustTier === "GOLD" ? "text-[#C2850C]" : trustTier === "SILVER" ? "text-[#6B7280]" : "text-[#92633A]";
  const linkedSolanaAccount = user?.linkedAccounts?.find(
    (account) =>
      account.type === "wallet" &&
      "chainType" in account &&
      account.chainType === "solana"
  );
  const linkedAddr =
    linkedSolanaAccount &&
      "address" in linkedSolanaAccount &&
      typeof linkedSolanaAccount.address === "string"
      ? linkedSolanaAccount.address
      : undefined;
  const connectedWallet = (publicKey?.toBase58() ?? user?.wallet?.address ?? linkedAddr)?.toLowerCase();
  const creatorWallet = campaign.org?.walletAddress?.toLowerCase();
  const isSelfDonation = Boolean(connectedWallet && creatorWallet && connectedWallet === creatorWallet);

  const stateClasses: Record<string, string> = {
    ACTIVE: "bg-[#2D6A4F]/10 text-[#2D6A4F] border-[#2D6A4F]/20",
    COMPLETED: "bg-[#2D6A4F]/10 text-[#2D6A4F] border-[#2D6A4F]/20",
    FAILED: "bg-[#C44536]/10 text-[#C44536] border-[#C44536]/20",
    FROZEN: "bg-[#1A1F2E]/10 text-[#1A1F2E]/60 border-[#1A1F2E]/15",
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
      <Navbar />

      <main className="mx-auto max-w-[1200px] px-8 pt-12 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* ── Left column ── */}
          <div className="min-w-0 space-y-6">

            {/* Hero card */}
            <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">

              <div className="flex justify-between gap-6 flex-wrap mb-6">
                <div className="flex-1 min-w-[200px]">
                  {campaign.org && (
                    <p className="text-sm font-semibold text-[#2D6A4F] uppercase tracking-widest mb-3">
                      {campaign.org.name}
                    </p>
                  )}
                  <h1 className="text-3xl font-extrabold tracking-tight leading-tight mb-4">
                    {campaign.title}
                  </h1>
                  <p className="text-base text-[#1A1F2E]/50 leading-relaxed">
                    {campaign.description}
                  </p>
                </div>
                <span className={`self-start text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg border ${stateClasses[campaign.state] ?? ""}`}>
                  {campaign.state}
                </span>
              </div>

              {/* Tags */}
              {campaign.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {campaign.tags.map((t) => (
                    <span key={t} className="text-sm px-3 py-1.5 rounded-lg bg-[#F0EFEB] border border-[#E4E2DC] text-[#1A1F2E]/45">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Progress */}
              <div className="flex justify-between text-base mb-3">
                <span>
                  <strong className="text-xl text-[#1A1F2E] font-extrabold">{formatSol(campaign.raisedLamports)}</strong>
                  <span className="text-[#1A1F2E]/40 ml-2">raised</span>
                </span>
                <span className="text-[#1A1F2E]/30">Goal: {formatSol(campaign.totalGoalLamports)}</span>
              </div>
              <div className="h-3 w-full bg-[#F0EFEB] rounded-full overflow-hidden mb-3">
                <div className="h-full rounded-full bg-[#2D6A4F] transition-all duration-700 progress-animate" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-[#1A1F2E]/30">{progress.toFixed(0)}% funded · {campaign._count?.donations ?? 0} donors</p>
            </div>

            {/* Voting panel */}
            {activeMilestone && activeMilestone.state === "UNDER_REVIEW" && (
              <VotingPanel milestone={activeMilestone} proof={activeProof} campaign={campaign} onVoted={load} />
            )}

            {/* Activity log */}
            <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold text-[#1A1F2E]/70">
                  Activity Log
                  <span className="text-sm text-[#1A1F2E]/25 font-normal ml-3">Proof-of-history chain</span>
                </h2>
              </div>

              {!!campaign.milestones?.length && (
                <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
                  {campaign.milestones.map((m) => {
                    const active = activeMilestone?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { void selectMilestone(m); }}
                        className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-150 min-h-[44px] ${active
                          ? "bg-[#2D6A4F]/10 border-[#2D6A4F]/30 text-[#2D6A4F]"
                          : "bg-[#F0EFEB] border-[#E4E2DC] text-[#1A1F2E]/45 hover:text-[#1A1F2E]/75"
                          }`}
                      >
                        Phase {m.index + 1}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeMilestone && (
                <div className="mb-6 p-6 rounded-xl border border-[#E4E2DC] bg-[#F8F7F4]">
                  <p className="text-sm text-[#1A1F2E]/60 font-semibold mb-2">
                    Phase {activeMilestone.index + 1}: {activeMilestone.title}
                  </p>
                  {activeProof ? (
                    <div>
                      <p className="text-sm text-[#1A1F2E]/35">
                        Proof submitted on {new Date(activeProof.submittedAt).toLocaleString("en-IN")} · Hash <span className="font-['DM_Mono']">{activeProof.invoiceHash.slice(0, 12)}...</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        <span className={`px-3 py-1.5 rounded-lg border ${activeProof.integrityChecked ? "border-[#2D6A4F]/30 text-[#2D6A4F]" : "border-[#C2850C]/30 text-[#C2850C]"}`}>
                          {activeProof.integrityChecked ? "Invoice hash verified" : "Invoice hash mismatch"}
                        </span>
                        {activeProof.invoiceUrl && (
                          <a
                            href={activeProof.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg border border-[#E4E2DC] text-[#1A1F2E]/60 hover:text-[#1A1F2E] hover:border-[#2D6A4F]/40 transition-all duration-150"
                          >
                            View submitted invoice
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#1A1F2E]/30">No proof submitted for this phase yet.</p>
                  )}
                </div>
              )}

              <DprTimeline updates={activeUpdates} title="" />
              <Link href={`/campaign/${campaign.id}/audit`} className="block mt-6">
                <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#F0EFEB] border border-[#E4E2DC] text-[#1A1F2E]/45 text-base font-semibold hover:bg-[#E4E2DC] transition-all duration-150 min-h-[48px]">
                  <ExternalLink size={16} /> View Full Audit Chain
                </button>
              </Link>
            </div>

            {/* Milestones */}
            <MilestoneTimeline milestones={campaign.milestones ?? []} />
          </div>

          {/* ── Right column ── */}
          <div className="space-y-6">

            {/* Donate card */}
            <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
              <h3 className="text-base font-bold mb-6">Support this campaign</h3>
              <button
                onClick={() => setDonateOpen(true)}
                disabled={campaign.state !== "ACTIVE" || isSelfDonation}
                className="w-full py-4 rounded-xl bg-[#2D6A4F] text-white font-bold text-base flex items-center justify-center gap-2 hover:bg-[#245A42] hover:-translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[48px]"
              >
                <Heart size={18} />
                {campaign.state !== "ACTIVE"
                  ? "Campaign Closed"
                  : isSelfDonation
                    ? "Own Campaign"
                    : "Donate SOL"}
              </button>
              <p className="text-sm text-[#1A1F2E]/30 text-center mt-4 leading-relaxed">
                Funds go into an on-chain escrow vault. Released only after donor voting approves each milestone.
              </p>
              <div className="mt-6 p-4 rounded-xl bg-[#2D6A4F]/[0.05] border border-[#2D6A4F]/15">
                <span className="text-[#2D6A4F] text-sm font-bold">8–12% APY</span>
                <span className="text-[#1A1F2E]/30 text-sm ml-3">Locked SOL earns yield</span>
              </div>
            </div>

            {/* Org card */}
            {campaign.org && (
              <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-[#F0EFEB] flex items-center justify-center text-2xl">
                    {campaign.org.logoUrl
                      ? <img src={campaign.org.logoUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                      : "🏢"}
                  </div>
                  <div>
                    <p className="font-bold text-base">{campaign.org.name}</p>
                    <p className={`text-sm font-bold ${tierClr}`}>⬡ {trustTier} tier</p>
                  </div>
                </div>

                {campaign.org.gstinVerified && (
                  <div className="flex items-center gap-2 p-4 rounded-xl bg-[#2D6A4F]/[0.05] border border-[#2D6A4F]/15 mb-6 text-sm text-[#2D6A4F]">
                    <Shield size={16} /> GST-verified organization
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { label: "Campaigns", value: campaign.org.campaignsCreated },
                    { label: "Completed", value: campaign.org.campaignsCompleted },
                    { label: "Success", value: `${completionRate}%` },
                    { label: "Raised", value: formatSol(campaign.org.totalRaisedLamports) },
                  ].map((s) => (
                    <div key={s.label} className="p-4 rounded-xl bg-[#F8F7F4] text-center">
                      <p className="text-lg font-extrabold">{s.value}</p>
                      <p className="text-xs text-[#1A1F2E]/30 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {campaign.org.onchainPda && (
                  <div className="text-xs font-['DM_Mono'] text-[#1A1F2E]/20 p-4 rounded-xl bg-[#F8F7F4] break-all mb-4">
                    On-chain: {campaign.org.onchainPda}
                  </div>
                )}

                {campaign.org.twitterHandle && (
                  <a
                    href={`https://twitter.com/${campaign.org.twitterHandle.replace("@", "")}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-[#2D6A4F] hover:text-[#245A42] transition-colors duration-150 mt-3"
                  >
                    <Users size={14} /> {campaign.org.twitterHandle}
                  </a>
                )}

                {(campaign.org?.walletAddress || campaign.org?.id) && (
                  <Link href={`/org/${campaign.org.walletAddress ?? campaign.org.id}`} className="block mt-6">
                    <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#F0EFEB] border border-[#E4E2DC] text-[#1A1F2E]/45 text-base font-semibold hover:bg-[#E4E2DC] transition-all duration-150 min-h-[48px]">
                      <TrendingUp size={16} /> View Full Profile
                    </button>
                  </Link>
                )}
              </div>
            )}

            {/* Unregistered vendor warning */}
            {activeProof?.isUnregisteredVendor && (
              <div className="p-6 rounded-xl bg-[#C2850C]/[0.06] border border-[#C2850C]/20">
                <div className="flex gap-3 items-start">
                  <AlertCircle size={18} className="text-[#C2850C] shrink-0 mt-0.5" />
                  <p className="text-sm text-[#C2850C] leading-relaxed">
                    <strong>Unregistered vendor</strong> — below the GST registration threshold (₹40L). Verify manually before voting.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <DonateModal campaign={campaign} open={donateOpen} onClose={() => setDonateOpen(false)} onSuccess={load} />
    </div>
  );
}
