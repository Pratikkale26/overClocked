"use client";

import type { MilestoneUpdate } from "../../lib/api";

const TYPE_ICON: Record<string, string> = { PROGRESS: "📋", EXPENSE: "💸", PHOTO: "📸", COMPLETION: "✅", ANNOUNCEMENT: "📢" };
const TYPE_COLOR: Record<string, string> = {
    PROGRESS: "text-[#2D6A4F] border-[#2D6A4F]/30",
    EXPENSE: "text-[#C2850C] border-[#C2850C]/30",
    PHOTO: "text-[#2563EB] border-[#2563EB]/30",
    COMPLETION: "text-[#2D6A4F] border-[#2D6A4F]/30",
    ANNOUNCEMENT: "text-[#7C3AED] border-[#7C3AED]/30",
};

export function DprTimeline({ updates, title = "Activity Log" }: { updates: MilestoneUpdate[]; title?: string }) {
    if (!updates.length) {
        return (
            <div className="py-8 text-center text-base text-[#1A1F2E]/30">
                No updates posted yet. The creator will post progress, expenses, and photos here.
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col">
                {updates.map((u, i) => (
                    <div key={u.id} className="flex gap-4">
                        {/* Dot + line */}
                        <div className="flex flex-col items-center shrink-0">
                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-base bg-[#F8F7F4] ${TYPE_COLOR[u.type] ?? "border-[#E4E2DC]"}`}>
                                {TYPE_ICON[u.type] ?? "📌"}
                            </div>
                            {i < updates.length - 1 && (
                                <div className="w-px flex-1 min-h-4 my-1 bg-[#E4E2DC]" />
                            )}
                        </div>

                        {/* Content */}
                        <div className={`flex-1 min-w-0 ${i < updates.length - 1 ? "pb-6" : ""}`}>
                            <div className="flex items-start justify-between gap-3 mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className={`text-xs font-bold uppercase tracking-widest shrink-0 ${u.type === "EXPENSE" ? "text-[#C2850C]" :
                                        u.type === "COMPLETION" ? "text-[#2D6A4F]" :
                                            u.type === "PHOTO" ? "text-[#2563EB]" :
                                                u.type === "ANNOUNCEMENT" ? "text-[#7C3AED]" : "text-[#2D6A4F]"
                                        }`}>
                                        {u.type}
                                    </span>
                                    <span className="text-base font-semibold text-[#1A1F2E]/70 truncate">{u.title}</span>
                                </div>
                                <span className="text-sm text-[#1A1F2E]/25 shrink-0">
                                    {new Date(u.postedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </span>
                            </div>
                            {u.description && (
                                <p className="text-sm text-[#1A1F2E]/40 leading-relaxed mt-1">{u.description}</p>
                            )}
                            {u.mediaUrls?.length > 0 && (
                                <div className="flex gap-3 mt-3 flex-wrap">
                                    {u.mediaUrls.map((url, mi) => {
                                        const lower = url.toLowerCase();
                                        const isImage = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"].some((ext) => lower.includes(ext));
                                        if (isImage) {
                                            return (
                                                <a key={mi} href={url} target="_blank" rel="noreferrer">
                                                    <img src={url} alt={`media-${mi}`}
                                                        className="w-24 h-20 object-cover rounded-lg border border-[#E4E2DC] hover:border-[#2D6A4F]/30 transition-colors duration-150"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                </a>
                                            );
                                        }
                                        return (
                                            <a key={mi} href={url} target="_blank" rel="noreferrer"
                                                className="px-3 py-1.5 rounded-lg border border-[#E4E2DC] text-sm text-[#1A1F2E]/50 hover:text-[#1A1F2E]/80 hover:border-[#2D6A4F]/30 transition-colors duration-150">
                                                Attachment {mi + 1}
                                            </a>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="text-xs font-['DM_Mono'] text-[#1A1F2E]/15 mt-2">
                                #{u.contentHash?.slice(0, 12)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
