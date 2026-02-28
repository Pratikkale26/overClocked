"use client";

import type { MilestoneUpdate } from "../../lib/api";

const TYPE_ICON: Record<string, string> = { PROGRESS: "📋", EXPENSE: "💸", PHOTO: "📸", COMPLETION: "✅", ANNOUNCEMENT: "📢" };
const TYPE_COLOR: Record<string, string> = {
    PROGRESS: "text-violet-400 border-violet-500/30",
    EXPENSE: "text-amber-400 border-amber-500/30",
    PHOTO: "text-cyan-400 border-cyan-500/30",
    COMPLETION: "text-emerald-400 border-emerald-500/30",
    ANNOUNCEMENT: "text-pink-400 border-pink-500/30",
};

export function DprTimeline({ updates, title = "Activity Log" }: { updates: MilestoneUpdate[]; title?: string }) {
    if (!updates.length) {
        return (
            <div className="py-6 text-center text-sm text-white/30">
                No updates posted yet. The creator will post progress, expenses, and photos here.
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col">
                {updates.map((u, i) => (
                    <div key={u.id} className="flex gap-3.5">
                        {/* Dot + line */}
                        <div className="flex flex-col items-center shrink-0">
                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm bg-[#0a0a14] ${TYPE_COLOR[u.type] ?? "border-white/10"}`}>
                                {TYPE_ICON[u.type] ?? "📌"}
                            </div>
                            {i < updates.length - 1 && (
                                <div className="w-px flex-1 min-h-4 my-1 bg-white/[0.06]" />
                            )}
                        </div>

                        {/* Content */}
                        <div className={`flex-1 min-w-0 ${i < updates.length - 1 ? "pb-5" : ""}`}>
                            <div className="flex items-start justify-between gap-2 mb-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest shrink-0 ${u.type === "EXPENSE" ? "text-amber-400" :
                                            u.type === "COMPLETION" ? "text-emerald-400" :
                                                u.type === "PHOTO" ? "text-cyan-400" :
                                                    u.type === "ANNOUNCEMENT" ? "text-pink-400" : "text-violet-400"
                                        }`}>
                                        {u.type}
                                    </span>
                                    <span className="text-sm font-semibold text-white/80 truncate">{u.title}</span>
                                </div>
                                <span className="text-[11px] text-white/25 shrink-0">
                                    {new Date(u.postedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </span>
                            </div>
                            {u.description && (
                                <p className="text-[13px] text-white/40 leading-relaxed mt-0.5">{u.description}</p>
                            )}
                            {u.mediaUrls?.length > 0 && (
                                <div className="flex gap-2 mt-2.5 flex-wrap">
                                    {u.mediaUrls.map((url, mi) => (
                                        <a key={mi} href={url} target="_blank" rel="noreferrer">
                                            <img src={url} alt={`media-${mi}`}
                                                className="w-20 h-16 object-cover rounded-lg border border-white/[0.06] hover:border-violet-500/30 transition-colors"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}
                            <div className="text-[10px] font-mono text-white/15 mt-1.5">
                                #{u.contentHash?.slice(0, 12)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
