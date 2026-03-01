"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Vote, TrendingUp, Zap } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { CampaignCard } from "../components/campaigns/CampaignCard";
import { fetchCampaigns, type Campaign } from "../lib/api";

const FEATURES = [
  { icon: Shield, title: "Milestone-Locked Escrow", desc: "Funds release only when donors verify work is done on-chain." },
  { icon: Vote, title: "Stake-Weighted Voting", desc: "Your donation size = your voting power. Transparent and fair." },
  { icon: TrendingUp, title: "On-Chain Reputation", desc: "Every org's track record is public and immutable on Solana." },
  { icon: Zap, title: "GST-Verified Proofs", desc: "Invoice hashes form a tamper-evident proof-of-history chain." },
];

export default function Home() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetchCampaigns({ limit: 6 }).then(setCampaigns).catch(() => { });
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
      <Navbar />

      {/* ── Hero ─────────────────────────────────── */}
      <section className="relative pt-32 pb-24 overflow-hidden text-center">
        <div className="relative mx-auto max-w-[1200px] px-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2D6A4F]/8 border border-[#2D6A4F]/15 text-[#2D6A4F] text-sm font-semibold uppercase tracking-wider mb-8">
            <Zap size={14} /> Built on Solana
          </div>

          <h1 className="text-6xl font-bold tracking-[-0.03em] leading-[1.1] mb-6">
            <span className="text-[#1A1F2E]">
              Programmable Trust
            </span>
            <br />
            <span className="text-[#1A1F2E]/70">for Crowdfunding</span>
          </h1>

          <p className="text-xl text-[#1A1F2E]/50 max-w-xl mx-auto leading-relaxed mb-12">
            Milestone-locked escrow, stake-weighted donor voting, and on-chain org reputation. Every rupee accounted for.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/explore">
              <button className="flex items-center gap-2 px-8 py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-lg hover:bg-[#245A42] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(45,106,79,0.2)] transition-all duration-200 min-h-[48px]">
                Explore Campaigns <ArrowRight size={20} />
              </button>
            </Link>
            <Link href="/create">
              <button className="flex items-center gap-2 px-8 py-4 rounded-xl border border-[#2D6A4F] text-[#2D6A4F] font-semibold text-lg hover:bg-[#2D6A4F]/[0.06] hover:-translate-y-[1px] transition-all duration-200 min-h-[48px]">
                Start a Campaign
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section Divider ──────────────────────── */}
      <div className="mx-auto max-w-[1200px] px-8">
        <div className="border-t border-[#E4E2DC] relative">
          <div className="absolute left-0 top-0 w-12 h-[2px] bg-[#2D6A4F]" />
        </div>
      </div>

      {/* ── Features ─────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)] hover:-translate-y-[2px] hover:border-[#C5C3BD] transition-all duration-200">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-[#2D6A4F]/20 bg-[#2D6A4F]/8 text-[#2D6A4F] mb-6">
                <f.icon size={22} />
              </div>
              <h3 className="text-base font-bold mb-3 text-[#1A1F2E]">{f.title}</h3>
              <p className="text-base text-[#1A1F2E]/45 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Campaigns ────────────────────────────── */}
      {campaigns.length > 0 && (
        <>
          <div className="mx-auto max-w-[1200px] px-8">
            <div className="border-t border-[#E4E2DC] relative">
              <div className="absolute left-0 top-0 w-12 h-[2px] bg-[#2D6A4F]" />
            </div>
          </div>

          <section className="mx-auto max-w-[1200px] px-8 py-16">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-4xl font-bold tracking-[-0.03em] text-[#1A1F2E]">
                Live Campaigns
              </h2>
              <Link href="/explore">
                <button className="flex items-center gap-2 text-base text-[#1A1F2E]/40 hover:text-[#1A1F2E]/70 transition-colors duration-150 min-h-[44px]">
                  View all <ArrowRight size={16} />
                </button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
