"use client";

import { useState } from "react";
import { toast } from "sonner";

type DonateModalProps = {
  campaignId: string;
  open: boolean;
  onClose: () => void;
};

export function DonateModal({ campaignId, open, onClose }: DonateModalProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const onDonate = async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast.success("Donation flow started", {
        description: `Campaign ${campaignId} · ${amount || "0"} SOL`,
      });
      onClose();
      setAmount("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Donate</h3>
        <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "var(--text-secondary)" }}>
          Amount (SOL)
        </label>
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onDonate} disabled={loading || !amount}>
            {loading ? "Processing..." : "Donate"}
          </button>
        </div>
      </div>
    </div>
  );
}
