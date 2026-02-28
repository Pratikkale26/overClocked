"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { CampaignCard, CampaignCardSkeleton } from "../components/campaigns/CampaignCard";
import { fetchCampaigns, type Campaign } from "../lib/api";

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns({ limit: 6 })
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Navbar />
      <main className="container" style={{ paddingTop: 44, paddingBottom: 64 }}>
        <section style={{ marginBottom: 34 }}>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: 10 }}>
            Programmable trust for fundraising.
          </h1>
          <p style={{ color: "var(--text-secondary)", maxWidth: 720, lineHeight: 1.65 }}>
            Discover milestone-locked campaigns, donate transparently, and fund outcomes rather than promises.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Link href="/explore">
              <button className="btn btn-primary">
                Explore Campaigns <ArrowRight size={14} />
              </button>
            </Link>
            <Link href="/create">
              <button className="btn btn-ghost">Start a Campaign</button>
            </Link>
          </div>
        </section>

        <section>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Featured Campaigns</h2>
            <Link href="/explore" style={{ fontSize: 13, color: "var(--violet-light)" }}>
              View all
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {loading
              ? [1, 2, 3].map((i) => <CampaignCardSkeleton key={i} />)
              : campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        </section>
      </main>
    </div>
  );
}
