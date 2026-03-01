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
  PENDING: "text-[#1A1F2E]/25 border-[#E4E2DC]",
  UNDER_REVIEW: "text-[#C2850C] border-[#C2850C]/30",
  APPROVED: "text-[#2D6A4F] border-[#2D6A4F]/30",
  REJECTED: "text-[#C44536] border-[#C44536]/30",
};
const LINE_COLOR: Record<string, string> = {
  PENDING: "bg-[#E4E2DC]",
  UNDER_REVIEW: "bg-[#C2850C]/30",
  APPROVED: "bg-[#2D6A4F]/30",
  REJECTED: "bg-[#C44536]/30",
};

export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  if (!milestones.length) {
    return (
      <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
        <h3 className="text-base font-bold mb-3">Milestones</h3>
        <p className="text-base text-[#1A1F2E]/30">No milestones configured.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
      <h3 className="text-base font-bold mb-8">🏁 Milestones</h3>
      <div className="flex flex-col">
        {milestones.map((m, i) => {
          const Icon = ICONS[m.state] ?? Circle;
          return (
            <div key={m.id} className="flex gap-4">
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center bg-[#F8F7F4] ${COLORS[m.state]}`}>
                  <Icon size={18} />
                </div>
                {i < milestones.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-6 my-1 ${LINE_COLOR[m.state]}`} />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 ${i < milestones.length - 1 ? "pb-6" : ""}`}>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-base text-[#1A1F2E]/80">
                    Phase {m.index + 1}: {m.title}
                  </span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${m.state === "APPROVED" ? "text-[#2D6A4F]" :
                    m.state === "UNDER_REVIEW" ? "text-[#C2850C]" :
                      m.state === "REJECTED" ? "text-[#C44536]" : "text-[#1A1F2E]/25"
                    }`}>
                    {m.state.replace("_", " ")}
                  </span>
                </div>
                {m.description && (
                  <p className="text-sm text-[#1A1F2E]/40 mt-1.5 leading-relaxed">{m.description}</p>
                )}
                <p className="text-sm text-[#1A1F2E]/25 mt-2 font-['DM_Mono']">
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
