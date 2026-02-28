"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Navbar } from "../../components/layout/Navbar";
import { CampaignCard } from "../../components/campaigns/CampaignCard";
import { fetchCampaigns, type Campaign } from "../../lib/api";

export default function ExplorePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns({ limit: 50 })
      .then(setCampaigns)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const filtered = campaigns.filter((c) =>
    !search ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase()) ||
    c.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#050509] text-white font-['Inter']">
      <Navbar />

      <div className="mx-auto max-w-[1240px] px-6 pt-16 pb-24">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-tight mb-2 bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Explore Campaigns
          </h1>
          <p className="text-white/40">Transparent, milestone-locked fundraising on Solana</p>
        </div>

        {/* Search */}
        <div className="relative max-w-lg mb-10">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0f0f1a] border border-white/[0.08] text-white placeholder-white/25 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all text-sm"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-72 rounded-2xl skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-white/30">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-lg font-semibold">{search ? "No campaigns found" : "No campaigns yet"}</p>
            <p className="text-sm mt-1">{search ? "Try a different search" : "Be the first to create one!"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
