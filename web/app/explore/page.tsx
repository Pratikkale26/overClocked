"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "../../components/layout/Navbar";
import { CampaignCard, CampaignCardSkeleton } from "../../components/campaigns/CampaignCard";
import { fetchCampaigns, type Campaign } from "../../lib/api";

export default function ExplorePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchCampaigns({ limit: 100 })
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [campaigns, query]);

  return (
    <div>
      <Navbar />
      <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 10 }}>Explore Campaigns</h1>
          <input
            className="input"
            placeholder="Search by title, description, or tags"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 18 }}>
          {loading
            ? [1, 2, 3, 4, 5, 6].map((i) => <CampaignCardSkeleton key={i} />)
            : filtered.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      </main>
    </div>
  );
}
