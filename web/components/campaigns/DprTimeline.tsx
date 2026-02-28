"use client";

import type { MilestoneUpdate } from "../../lib/api";

const TYPE_ICONS: Record<string, string> = {
    PROGRESS: "📋",
    EXPENSE: "💸",
    PHOTO: "📸",
    COMPLETION: "✅",
    ANNOUNCEMENT: "📢",
};

const TYPE_COLORS: Record<string, string> = {
    PROGRESS: "var(--violet-light)",
    EXPENSE: "var(--warning)",
    PHOTO: "#22d3ee",
    COMPLETION: "var(--success)",
    ANNOUNCEMENT: "#f472b6",
};

interface DprTimelineProps {
    updates: MilestoneUpdate[];
    title?: string;
}

export function DprTimeline({ updates, title = "Activity Log" }: DprTimelineProps) {
    if (!updates.length) {
        return (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                No updates posted yet. The creator will post progress, expenses, and photos here.
            </div>
        );
    }

    return (
        <div>
            {title && (
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: "var(--text-secondary)" }}>
                    {title}
                </h3>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {updates.map((u, i) => (
                    <div key={u.id} style={{ display: "flex", gap: 14, position: "relative" }}>
                        {/* Timeline track */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: "50%",
                                background: "var(--bg-elevated)",
                                border: `2px solid ${TYPE_COLORS[u.type] ?? "var(--border)"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 14, flexShrink: 0,
                                boxShadow: `0 0 10px ${TYPE_COLORS[u.type] ?? "transparent"}40`,
                            }}>
                                {TYPE_ICONS[u.type] ?? "📌"}
                            </div>
                            {i < updates.length - 1 && (
                                <div style={{ width: 2, flex: 1, minHeight: 20, background: "var(--border)", margin: "4px 0" }} />
                            )}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, paddingBottom: i < updates.length - 1 ? 20 : 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                                <div>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700,
                                        color: TYPE_COLORS[u.type] ?? "var(--text-muted)",
                                        textTransform: "uppercase", letterSpacing: "0.06em",
                                        marginRight: 8,
                                    }}>
                                        {u.type}
                                    </span>
                                    <span style={{ fontSize: 14, fontWeight: 600 }}>{u.title}</span>
                                </div>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                                    {new Date(u.postedAt).toLocaleDateString("en-IN", {
                                        day: "numeric", month: "short",
                                    })}
                                </span>
                            </div>
                            {u.description && (
                                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, marginTop: 2 }}>
                                    {u.description}
                                </p>
                            )}
                            {u.mediaUrls?.length > 0 && (
                                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                    {u.mediaUrls.map((url, mi) => (
                                        <a key={mi} href={url} target="_blank" rel="noreferrer">
                                            <img
                                                src={url}
                                                alt={`media-${mi}`}
                                                style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}
                            {/* Proof-of-history hash */}
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, fontFamily: "monospace" }}>
                                #{u.contentHash?.slice(0, 12)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
