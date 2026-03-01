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
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
      <Navbar />

      <div className="mx-auto max-w-[1200px] px-8 pt-16 pb-24">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-[-0.03em] mb-3 text-[#1A1F2E]">
            Explore Campaigns
          </h1>
          <p className="text-lg text-[#1A1F2E]/45 leading-relaxed">Transparent, milestone-locked fundraising on Solana</p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mb-12">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1F2E]/30" />
          <input
            type="text"
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-4 rounded-xl bg-white border border-[#E4E2DC] text-[#1A1F2E] text-base placeholder-[#1A1F2E]/25 focus:outline-none focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F]/20 transition-all duration-150 shadow-[0_4px_12px_rgba(26,31,46,0.06)] min-h-[48px]"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-80 rounded-xl skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 text-[#1A1F2E]/30">
            <div className="text-6xl mb-6">🔍</div>
            <p className="text-xl font-semibold mb-2">{search ? "No campaigns found" : "No campaigns yet"}</p>
            <p className="text-base">{search ? "Try a different search" : "Be the first to create one!"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
