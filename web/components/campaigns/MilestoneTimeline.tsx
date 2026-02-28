import { CheckCircle, Circle, Clock, XCircle } from "lucide-react";
import type { Milestone } from "../../lib/api";
import { formatSol } from "../../lib/utils";

const ICONS: Record<string, React.ElementType> = {
  PENDING: Circle,
  UNDER_REVIEW: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
};
const COLORS: Record<string, string> = {
  PENDING: "text-white/30 border-white/10",
  UNDER_REVIEW: "text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]",
  APPROVED: "text-emerald-400 border-emerald-500/30",
  REJECTED: "text-red-400 border-red-500/30",
};
const LINE_COLOR: Record<string, string> = {
  PENDING: "bg-white/10",
  UNDER_REVIEW: "bg-amber-500/30",
  APPROVED: "bg-emerald-500/30",
  REJECTED: "bg-red-500/30",
};

export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  if (!milestones.length) {
    return (
      <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-sm font-bold mb-2">Milestones</h3>
        <p className="text-sm text-white/30">No milestones configured.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6">
      <h3 className="text-sm font-bold mb-5">🏁 Milestones</h3>
      <div className="flex flex-col">
        {milestones.map((m, i) => {
          const Icon = ICONS[m.state] ?? Circle;
          return (
            <div key={m.id} className="flex gap-4">
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-[#0a0a14] ${COLORS[m.state]}`}>
                  <Icon size={14} />
                </div>
                {i < milestones.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-5 my-1 ${LINE_COLOR[m.state]}`} />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 ${i < milestones.length - 1 ? "pb-5" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-sm text-white/80">
                    Phase {m.index + 1}: {m.title}
                  </span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${m.state === "APPROVED" ? "text-emerald-400" :
                      m.state === "UNDER_REVIEW" ? "text-amber-400" :
                        m.state === "REJECTED" ? "text-red-400" : "text-white/30"
                    }`}>
                    {m.state.replace("_", " ")}
                  </span>
                </div>
                {m.description && (
                  <p className="text-xs text-white/40 mt-1 leading-relaxed">{m.description}</p>
                )}
                <p className="text-xs text-white/25 mt-1.5 font-mono">
                  {formatSol(m.amountLamports)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
