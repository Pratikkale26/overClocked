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
      <div className="min-h-screen bg-[#050509] text-white">
        <Navbar />
        <main className="mx-auto max-w-[1240px] px-6 pt-12">
          <div className="skeleton h-56 rounded-2xl mb-5" />
          <div className="skeleton h-40 rounded-2xl" />
        </main>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#050509] text-white">
        <Navbar />
        <main className="mx-auto max-w-[1240px] px-6 pt-20 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-bold mb-3">Campaign not found</h2>
          <Link href="/explore">
            <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold">
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
  const tierClr = trustTier === "GOLD" ? "text-amber-400" : trustTier === "SILVER" ? "text-slate-400" : "text-amber-700";
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
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
    FROZEN: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  };

  return (
    <div className="min-h-screen bg-[#050509] text-white font-['Inter']">
      <Navbar />

      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.06)_0%,transparent_70%)] pointer-events-none -z-10" />

      <main className="mx-auto max-w-[1240px] px-6 pt-10 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

          {/* ── Left column ── */}
          <div className="min-w-0 space-y-5">

            {/* Hero card */}
            <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-7 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-600/40 via-indigo-500/20 to-transparent" />

              <div className="flex justify-between gap-4 flex-wrap mb-5">
                <div className="flex-1 min-w-[200px]">
                  {campaign.org && (
                    <p className="text-[11px] font-semibold text-violet-400/80 uppercase tracking-widest mb-2">
                      {campaign.org.name}
                    </p>
                  )}
                  <h1 className="text-2xl font-extrabold tracking-tight leading-snug mb-3">
                    {campaign.title}
                  </h1>
                  <p className="text-[15px] text-white/50 leading-relaxed">
                    {campaign.description}
                  </p>
                </div>
                <span className={`self-start text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${stateClasses[campaign.state] ?? ""}`}>
                  {campaign.state}
                </span>
              </div>

              {/* Tags */}
              {campaign.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {campaign.tags.map((t) => (
                    <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/40">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Progress */}
              <div className="flex justify-between text-sm mb-2">
                <span>
                  <strong className="text-base text-white font-extrabold">{formatSol(campaign.raisedLamports)}</strong>
                  <span className="text-white/40 ml-1.5">raised</span>
                </span>
                <span className="text-white/30">Goal: {formatSol(campaign.totalGoalLamports)}</span>
              </div>
              <div className="h-2.5 w-full bg-white/[0.04] rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-700 progress-glow" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-white/25">{progress.toFixed(0)}% funded · {campaign._count?.donations ?? 0} donors</p>
            </div>

            {/* Voting panel */}
            {activeMilestone && activeMilestone.state === "UNDER_REVIEW" && (
              <VotingPanel milestone={activeMilestone} proof={activeProof} campaign={campaign} onVoted={load} />
            )}

            {/* Activity log */}
            <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-white/70">
                  📋 Activity Log
                  <span className="text-xs text-white/25 font-normal ml-2">Proof-of-history chain</span>
                </h2>
              </div>

              {!!campaign.milestones?.length && (
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {campaign.milestones.map((m) => {
                    const active = activeMilestone?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { void selectMilestone(m); }}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${active
                          ? "bg-violet-500/15 border-violet-500/40 text-violet-300"
                          : "bg-white/[0.03] border-white/[0.06] text-white/45 hover:text-white/75"
                          }`}
                      >
                        Phase {m.index + 1}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeMilestone && (
                <div className="mb-4 p-3 rounded-xl border border-white/[0.07] bg-white/[0.02]">
                  <p className="text-xs text-white/60 font-semibold mb-1">
                    Phase {activeMilestone.index + 1}: {activeMilestone.title}
                  </p>
                  {activeProof ? (
                    <div>
                      <p className="text-[11px] text-white/35">
                        Proof submitted on {new Date(activeProof.submittedAt).toLocaleString("en-IN")} · Hash {activeProof.invoiceHash.slice(0, 12)}...
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className={`px-2 py-1 rounded-md border ${activeProof.integrityChecked ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"}`}>
                          {activeProof.integrityChecked ? "Invoice hash verified" : "Invoice hash mismatch"}
                        </span>
                        {activeProof.invoiceUrl && (
                          <a
                            href={activeProof.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded-md border border-white/15 text-white/70 hover:text-white hover:border-violet-500/40 transition-all"
                          >
                            View submitted invoice
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-white/30">No proof submitted for this phase yet.</p>
                  )}
                </div>
              )}

              <DprTimeline updates={activeUpdates} title="" />
              <Link href={`/campaign/${campaign.id}/audit`} className="block mt-5">
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm font-semibold hover:bg-white/[0.06] transition-all">
                  <ExternalLink size={13} /> View Full Audit Chain
                </button>
              </Link>
            </div>

            {/* Milestones */}
            <MilestoneTimeline milestones={campaign.milestones ?? []} />
          </div>

          {/* ── Right column ── */}
          <div className="space-y-5">

            {/* Donate card */}
            <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-600/40 to-transparent" />
              <h3 className="text-sm font-bold mb-4">Support this campaign</h3>
              <button
                onClick={() => setDonateOpen(true)}
                disabled={campaign.state !== "ACTIVE" || isSelfDonation}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Heart size={15} />
                {campaign.state !== "ACTIVE"
                  ? "Campaign Closed"
                  : isSelfDonation
                    ? "Own Campaign"
                    : "Donate SOL"}
              </button>
              <p className="text-[11px] text-white/25 text-center mt-3 leading-relaxed">
                Funds go into an on-chain escrow vault. Released only after donor voting approves each milestone.
              </p>
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15">
                <span className="text-emerald-400 text-xs font-bold">💰 8–12% APY</span>
                <span className="text-white/30 text-xs ml-2">Locked SOL earns yield</span>
              </div>
            </div>

            {/* Org card */}
            {campaign.org && (
              <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-[#161625] flex items-center justify-center text-xl">
                    {campaign.org.logoUrl
                      ? <img src={campaign.org.logoUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                      : "🏢"}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{campaign.org.name}</p>
                    <p className={`text-xs font-bold ${tierClr}`}>⬡ {trustTier} tier</p>
                  </div>
                </div>

                {campaign.org.gstinVerified && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/[0.05] border border-emerald-500/15 mb-4 text-xs text-emerald-400">
                    <Shield size={12} /> GST-verified organization
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: "Campaigns", value: campaign.org.campaignsCreated },
                    { label: "Completed", value: campaign.org.campaignsCompleted },
                    { label: "Success", value: `${completionRate}%` },
                    { label: "Raised", value: formatSol(campaign.org.totalRaisedLamports) },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-xl bg-white/[0.02] text-center">
                      <p className="text-sm font-extrabold">{s.value}</p>
                      <p className="text-[10px] text-white/25 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {campaign.org.onchainPda && (
                  <div className="text-[10px] font-mono text-white/15 p-2.5 rounded-lg bg-white/[0.02] break-all mb-3">
                    On-chain: {campaign.org.onchainPda}
                  </div>
                )}

                {campaign.org.twitterHandle && (
                  <a
                    href={`https://twitter.com/${campaign.org.twitterHandle.replace("@", "")}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors mt-2"
                  >
                    <Users size={12} /> {campaign.org.twitterHandle}
                  </a>
                )}

                {(campaign.org?.walletAddress || campaign.org?.id) && (
                  <Link href={`/org/${campaign.org.walletAddress ?? campaign.org.id}`} className="block mt-4">
                    <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-sm font-semibold hover:bg-white/[0.06] transition-all">
                      <TrendingUp size={13} /> View Full Profile
                    </button>
                  </Link>
                )}
              </div>
            )}

            {/* Unregistered vendor warning */}
            {activeProof?.isUnregisteredVendor && (
              <div className="p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20">
                <div className="flex gap-2.5 items-start">
                  <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400 leading-relaxed">
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
