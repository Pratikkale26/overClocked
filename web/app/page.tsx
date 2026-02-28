"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Vote, TrendingUp, Zap } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { CampaignCard } from "../components/campaigns/CampaignCard";
import { fetchCampaigns, type Campaign } from "../lib/api";

const FEATURES = [
  { icon: Shield, color: "violet", title: "Milestone-Locked Escrow", desc: "Funds release only when donors verify work is done on-chain." },
  { icon: Vote, color: "cyan", title: "Stake-Weighted Voting", desc: "Your donation size = your voting power. Transparent and fair." },
  { icon: TrendingUp, color: "emerald", title: "On-Chain Reputation", desc: "Every org's track record is public and immutable on Solana." },
  { icon: Zap, color: "amber", title: "GST-Verified Proofs", desc: "Invoice hashes form a tamper-evident proof-of-history chain." },
];

const ICON_COLORS: Record<string, string> = {
  violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
  cyan: "bg-cyan-500/10   border-cyan-500/20   text-cyan-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  amber: "bg-amber-500/10  border-amber-500/20  text-amber-400",
};

export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetchCampaigns({ limit: 6 }).then(setCampaigns).catch(() => { });
  }, []);

  return (
    <div className="min-h-screen bg-[#050509] text-white font-['Inter']">
      <Navbar />

      {/* Ambient background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.07)_0%,transparent_70%)] pointer-events-none -z-10" />

      {/* ── Hero ─────────────────────────────────── */}
      <section className="relative pt-28 pb-20 overflow-hidden text-center">
        {/* Orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(124,58,237,0.07),transparent_70%)] blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(79,70,229,0.05),transparent_70%)] blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-[1240px] px-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold uppercase tracking-wider mb-7">
            <Zap size={11} /> Built on Solana — Devnet
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-[1.05] mb-5">
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Programmable Trust
            </span>
            <br />
            <span className="text-white/90">for Crowdfunding</span>
          </h1>

          <p className="text-lg text-white/50 max-w-lg mx-auto leading-relaxed mb-10">
            Milestone-locked escrow, stake-weighted donor voting, and on-chain org reputation. Every rupee accounted for.
          </p>

          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/explore">
              <button className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-base shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 hover:brightness-110 transition-all duration-200">
                Explore Campaigns <ArrowRight size={16} />
              </button>
            </Link>
            <Link href="/create">
              <button className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-violet-500/30 text-violet-300 font-semibold text-base hover:bg-violet-500/10 hover:border-violet-500/50 transition-all duration-200">
                Start a Campaign
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────── */}
      <section className="mx-auto max-w-[1240px] px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="relative bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-600/30 via-indigo-600/20 to-transparent" />
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-4 ${ICON_COLORS[f.color]}`}>
                <f.icon size={18} />
              </div>
              <h3 className="text-sm font-bold mb-2 text-white/90">{f.title}</h3>
              <p className="text-[13px] text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Campaigns ────────────────────────────── */}
      {campaigns.length > 0 && (
        <section className="mx-auto max-w-[1240px] px-6 pb-24">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Live Campaigns
            </h2>
            <Link href="/explore">
              <button className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
                View all <ArrowRight size={13} />
              </button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        </section>
      )}
    </div>
  );
}
