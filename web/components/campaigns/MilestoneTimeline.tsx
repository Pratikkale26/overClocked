import type { Milestone } from "../../lib/api";
import { formatSol } from "../../lib/utils";

type MilestoneTimelineProps = {
  milestones: Milestone[];
};

const STATE_COLOR: Record<Milestone["state"], string> = {
  PENDING: "var(--text-muted)",
  UNDER_REVIEW: "#f59e0b",
  APPROVED: "var(--success)",
  REJECTED: "var(--danger)",
};

export function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  if (!milestones.length) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 8 }}>Milestones</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No milestones yet.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ marginBottom: 14 }}>Milestones</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {milestones.map((m) => (
          <div key={m.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <strong>
                {m.index + 1}. {m.title}
              </strong>
              <span style={{ fontSize: 12, color: STATE_COLOR[m.state], fontWeight: 700 }}>{m.state}</span>
            </div>
            {m.description ? (
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>{m.description}</p>
            ) : null}
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              Amount: {formatSol(m.amountLamports)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
