"use client";

import React from "react";
import Link from "next/link";
import {
    ShieldCheck,
    Users,
    PieChart,
    PlusCircle,
    Wallet,
    CheckCircle2,
    ArrowRight,
    TrendingUp,
    Activity,
    ChevronRight,
    Leaf,
    GraduationCap,
    Globe,
    Building2,
} from "lucide-react";

/* ────────────────────────────────────────────────────────
 *  Design tokens  (8px grid · 3 font sizes · neutral palette)
 * ──────────────────────────────────────────────────────── */
const t = {
    // Colours
    bg: "#fafbfc",
    surface: "#ffffff",
    muted: "#f4f6f8",
    border: "#eef1f4",
    borderSub: "#f4f6f8",
    navy: "#0c1524",
    slate700: "#334155",
    slate500: "#64748b",
    slate400: "#94a3b8",
    emerald: "#059669",
    emeraldBg: "#ecfdf5",
    emeraldBd: "#a7f3d0",
    green: "#10b981",
    blue: "#3b82f6",
    white: "#ffffff",

    // Typography — 3 sizes + headline
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    hero: { fontSize: "clamp(2.5rem, 5vw, 3.75rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.025em" },
    h2: { fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.02em" },
    body: { fontSize: "1.0625rem", fontWeight: 400, lineHeight: 1.7 },
    small: { fontSize: "0.875rem", fontWeight: 500, lineHeight: 1.6 },

    // Spacing (8px grid)
    s4: 4, s8: 8, s12: 12, s16: 16, s24: 24,
    s32: 32, s40: 40, s48: 48, s56: 56, s64: 64,
    s80: 80, s96: 96, s120: 120, s160: 160,

    // Misc
    radius: 12,
    radiusLg: 20,
    radiusXl: 28,
    radiusFull: 9999,
    shadow: "0 1px 3px rgba(0,0,0,0.04)",
    shadowMd: "0 4px 16px rgba(0,0,0,0.06)",
    shadowLg: "0 12px 40px rgba(0,0,0,0.08)",
    shadowHero: "0 24px 64px rgba(0,0,0,0.07)",
} as const;

/* ── Wrapper that resets global dark theme ── */
const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: t.bg,
    color: t.navy,
    fontFamily: t.fontFamily,
    WebkitFontSmoothing: "antialiased",
};

/* ── Reusable section padding (generous breathing room) ── */
const sectionPad = (py = t.s120): React.CSSProperties => ({
    paddingTop: py,
    paddingBottom: py,
});

const containerStyle: React.CSSProperties = {
    maxWidth: 1200,
    marginInline: "auto",
    paddingInline: t.s24,
};

/* ────────────────────────────────────────────────────────
 *  Component
 * ──────────────────────────────────────────────────────── */
export default function CredenceLandingPage() {
    return (
        <div style={pageStyle}>
            {/* ═══════════ NAV ═══════════ */}
            <nav
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 50,
                    background: "rgba(255,255,255,0.88)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    borderBottom: `1px solid ${t.border}`,
                }}
            >
                <div
                    style={{
                        ...containerStyle,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        height: 64,
                    }}
                >
                    {/* Logo */}
                    <div style={{ display: "flex", alignItems: "center", gap: t.s8 }}>
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: t.s8,
                                background: t.navy,
                                color: t.white,
                                display: "grid",
                                placeItems: "center",
                                fontWeight: 700,
                                fontSize: 15,
                            }}
                        >
                            C
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 700, color: t.navy, letterSpacing: "-0.01em" }}>
                            Credence
                        </span>
                    </div>

                    {/* Links */}
                    <div style={{ display: "flex", gap: t.s32, ...t.small, color: t.slate500 }} className="hidden md:flex">
                        <Link href="#features" style={{ color: t.slate500, transition: "color .15s" }}>
                            Features
                        </Link>
                        <Link href="#how-it-works" style={{ color: t.slate500, transition: "color .15s" }}>
                            How it Works
                        </Link>
                        <Link href="#about" style={{ color: t.slate500, transition: "color .15s" }}>
                            About
                        </Link>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: t.s16 }}>
                        <Link href="/login" style={{ ...t.small, color: t.slate500 }}>
                            Log in
                        </Link>
                        <Link
                            href="/signup"
                            style={{
                                ...t.small,
                                color: t.white,
                                background: t.navy,
                                padding: "8px 20px",
                                borderRadius: t.radiusFull,
                                transition: "opacity .15s",
                            }}
                        >
                            Sign up
                        </Link>
                    </div>
                </div>
            </nav>

            <main>
                {/* ═══════════ HERO ═══════════ */}
                <section style={{ ...sectionPad(t.s120), background: t.surface, position: "relative", overflow: "hidden" }}>
                    {/* Soft gradient blob */}
                    <div
                        style={{
                            position: "absolute",
                            top: -200,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 900,
                            height: 600,
                            background: "radial-gradient(ellipse at center, rgba(16,185,129,0.06) 0%, transparent 70%)",
                            pointerEvents: "none",
                        }}
                    />

                    <div
                        style={{
                            ...containerStyle,
                            display: "flex",
                            flexDirection: "column",
                            gap: t.s64,
                        }}
                        className="lg:!flex-row lg:items-center lg:gap-16"
                    >
                        {/* Copy */}
                        <div style={{ flex: 1, maxWidth: 540 }}>
                            {/* Pill */}
                            <Link
                                href="#features"
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: t.s8,
                                    ...t.small,
                                    color: t.slate500,
                                    background: t.muted,
                                    padding: "6px 16px",
                                    borderRadius: t.radiusFull,
                                    marginBottom: t.s32,
                                    transition: "background .15s",
                                }}
                            >
                                Introducing Transparent Funding
                                <ChevronRight size={14} style={{ color: t.emerald }} />
                            </Link>

                            <h1 style={{ ...t.hero, color: t.navy, marginBottom: t.s24 }}>
                                Funding Backed by{" "}
                                <span style={{ color: t.emerald }}>Proof</span>, Not&nbsp;Promises.
                            </h1>

                            <p style={{ ...t.body, color: t.slate500, maxWidth: 480, marginBottom: t.s40 }}>
                                A milestone-based crowdfunding platform where contributor funds are held
                                securely and released only when project creators deliver verified results.
                            </p>

                            <div style={{ display: "flex", alignItems: "center", gap: t.s24 }}>
                                <Link
                                    href="/app"
                                    style={{
                                        ...t.small,
                                        fontWeight: 600,
                                        color: t.white,
                                        background: t.navy,
                                        padding: "14px 32px",
                                        borderRadius: t.radiusFull,
                                        boxShadow: t.shadowMd,
                                        transition: "opacity .15s",
                                    }}
                                >
                                    Launch App
                                </Link>
                                <Link
                                    href="/explore"
                                    style={{
                                        ...t.small,
                                        fontWeight: 600,
                                        color: t.navy,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: t.s8,
                                    }}
                                >
                                    Explore Projects <ArrowRight size={15} />
                                </Link>
                            </div>
                        </div>

                        {/* Dashboard mockup */}
                        <div style={{ flex: 1, maxWidth: 520, width: "100%" }}>
                            <div
                                style={{
                                    background: t.surface,
                                    borderRadius: t.radiusXl,
                                    border: `1px solid ${t.border}`,
                                    padding: t.s32,
                                    boxShadow: t.shadowHero,
                                }}
                            >
                                {/* Header row */}
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        paddingBottom: t.s24,
                                        marginBottom: t.s24,
                                        borderBottom: `1px solid ${t.borderSub}`,
                                    }}
                                >
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 650, color: t.navy }}>Clean Water Initiative</h3>
                                        <p style={{ ...t.small, color: t.slate500, marginTop: t.s4 }}>
                                            Milestone 2 · Infrastructure Setup
                                        </p>
                                    </div>
                                    <span
                                        style={{
                                            ...t.small,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4,
                                            color: "#047857",
                                            background: t.emeraldBg,
                                            padding: "4px 12px",
                                            borderRadius: t.radiusFull,
                                        }}
                                    >
                                        <CheckCircle2 size={13} /> Approved
                                    </span>
                                </div>

                                {/* Progress */}
                                <div style={{ marginBottom: t.s24 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: t.s8 }}>
                                        <span style={{ ...t.small, color: t.slate500 }}>Fund Release</span>
                                        <span style={{ ...t.small, fontWeight: 650, color: t.navy }}>$25,000 / $50,000</span>
                                    </div>
                                    <div style={{ height: 6, borderRadius: t.radiusFull, background: t.muted }}>
                                        <div style={{ height: "100%", width: "50%", borderRadius: t.radiusFull, background: t.green }} />
                                    </div>
                                </div>

                                {/* Vote card */}
                                <div
                                    style={{
                                        background: t.muted,
                                        borderRadius: t.radius,
                                        padding: t.s24,
                                        marginBottom: t.s24,
                                    }}
                                    className="hidden sm:block"
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: t.s12 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: t.s12 }}>
                                            <div
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: t.s8,
                                                    background: t.surface,
                                                    display: "grid",
                                                    placeItems: "center",
                                                    boxShadow: t.shadow,
                                                }}
                                            >
                                                <Users size={16} style={{ color: t.slate500 }} />
                                            </div>
                                            <span style={{ ...t.small, fontWeight: 600, color: t.slate700 }}>
                                                Community Approval
                                            </span>
                                        </div>
                                        <span style={{ fontSize: 20, fontWeight: 700, color: t.navy }}>89%</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 4, height: 6 }}>
                                        <div style={{ flex: 89, borderRadius: t.radiusFull, background: t.green }} />
                                        <div style={{ flex: 11, borderRadius: t.radiusFull, background: t.border }} />
                                    </div>
                                    <p style={{ fontSize: 12, color: t.slate400, marginTop: t.s8, textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                                        <CheckCircle2 size={12} style={{ color: t.green }} /> Vote Passed
                                    </p>
                                </div>

                                {/* Status bar */}
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: t.s16,
                                        ...t.small,
                                        color: t.slate500,
                                        paddingTop: t.s16,
                                        borderTop: `1px solid ${t.borderSub}`,
                                    }}
                                >
                                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: t.slate700 }}>
                                        <TrendingUp size={14} style={{ color: t.emerald }} /> On Track
                                    </span>
                                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: t.border }} />
                                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <Activity size={14} style={{ color: t.blue }} /> Updates: 0
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══════════ SOCIAL PROOF ═══════════ */}
                <section style={{ background: t.muted, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: `${t.s56}px 0` }}>
                    <div style={containerStyle}>
                        <p style={{ ...t.small, color: t.slate400, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: t.s32 }}>
                            Designed for student organisations, NGOs &amp; community initiatives
                        </p>
                        <div
                            style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: t.s48, opacity: 0.45 }}
                        >
                            {[
                                { icon: Leaf, name: "EcoFund" },
                                { icon: GraduationCap, name: "CampusWorks" },
                                { icon: Globe, name: "NextGen NGO" },
                                { icon: Building2, name: "CivicTrust" },
                            ].map(({ icon: Icon, name }) => (
                                <div key={name} style={{ display: "flex", alignItems: "center", gap: t.s8, fontWeight: 700, fontSize: 17, color: t.slate500 }}>
                                    <Icon size={20} /> {name}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════ FEATURES ═══════════ */}
                <section id="features" style={{ ...sectionPad(t.s120), background: t.surface }}>
                    <div style={containerStyle}>
                        {/* Heading */}
                        <div style={{ textAlign: "center", maxWidth: 580, marginInline: "auto", marginBottom: t.s80 }}>
                            <p style={{ ...t.small, fontWeight: 600, color: t.emerald, marginBottom: t.s12, letterSpacing: "0.04em" }}>
                                ACCOUNTABILITY FIRST
                            </p>
                            <h2 style={{ ...t.h2, color: t.navy, marginBottom: t.s16 }}>Built for Transparency</h2>
                            <p style={{ ...t.body, color: t.slate500 }}>
                                Trust is earned, not given. Credence ensures every contribution is used
                                effectively through structured milestones and community oversight.
                            </p>
                        </div>

                        {/* Cards */}
                        <div
                            style={{ display: "grid", gap: t.s32 }}
                            className="grid-cols-1 md:grid-cols-3"
                        >
                            {[
                                {
                                    icon: ShieldCheck,
                                    title: "Controlled Fund Release",
                                    desc: "Funds unlock in stages — only after creators prove completion of agreed-upon milestones. No lump-sum payouts, ever.",
                                },
                                {
                                    icon: Users,
                                    title: "Community Approval",
                                    desc: "Contributors vote on milestone completion through a transparent system, giving backers direct, democratic control.",
                                },
                                {
                                    icon: PieChart,
                                    title: "Full Visibility of Usage",
                                    desc: "Track every dollar. Expenditure reports are tied to milestones, ensuring total financial clarity from start to finish.",
                                },
                            ].map(({ icon: Icon, title, desc }) => (
                                <div
                                    key={title}
                                    style={{
                                        background: t.muted,
                                        borderRadius: t.radiusLg,
                                        padding: t.s32,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: t.radius,
                                            background: t.emeraldBg,
                                            display: "grid",
                                            placeItems: "center",
                                            marginBottom: t.s24,
                                        }}
                                    >
                                        <Icon size={22} style={{ color: t.emerald }} />
                                    </div>
                                    <h3 style={{ fontSize: 17, fontWeight: 650, color: t.navy, marginBottom: t.s12 }}>{title}</h3>
                                    <p style={{ ...t.body, fontSize: 15, color: t.slate500 }}>{desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════ HOW IT WORKS ═══════════ */}
                <section
                    id="how-it-works"
                    style={{
                        ...sectionPad(t.s120),
                        background: t.muted,
                        borderTop: `1px solid ${t.border}`,
                        borderBottom: `1px solid ${t.border}`,
                    }}
                >
                    <div style={containerStyle}>
                        <div style={{ textAlign: "center", maxWidth: 520, marginInline: "auto", marginBottom: t.s80 }}>
                            <h2 style={{ ...t.h2, color: t.navy, marginBottom: t.s12 }}>How Credence Works</h2>
                            <p style={{ ...t.body, color: t.slate500 }}>
                                A simple, secure lifecycle for every verified project.
                            </p>
                        </div>

                        <div style={{ maxWidth: 960, marginInline: "auto", position: "relative" }}>
                            {/* Connector line */}
                            <div
                                style={{
                                    position: "absolute",
                                    top: 36,
                                    left: "16.67%",
                                    width: "66.67%",
                                    height: 1,
                                    background: t.border,
                                }}
                                className="hidden md:block"
                            />

                            <div
                                style={{ display: "grid", gap: t.s40, textAlign: "center" }}
                                className="grid-cols-1 md:grid-cols-3"
                            >
                                {[
                                    { icon: PlusCircle, step: "01", title: "Create Campaign", desc: "Define project goals and break them into actionable, verifiable milestones." },
                                    { icon: Wallet, step: "02", title: "Contributors Fund It", desc: "Backers pledge funds held securely in escrow — never released as a lump sum." },
                                    { icon: CheckCircle2, step: "03", title: "Funds Released on Approval", desc: "Community reviews and approves each milestone before the next tranche is disbursed.", highlight: true },
                                ].map(({ icon: Icon, step, title, desc, highlight }) => (
                                    <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                        <div
                                            style={{
                                                width: 72,
                                                height: 72,
                                                borderRadius: "50%",
                                                background: highlight ? t.navy : t.surface,
                                                border: highlight ? "none" : `2px solid ${t.border}`,
                                                display: "grid",
                                                placeItems: "center",
                                                marginBottom: t.s24,
                                                boxShadow: highlight ? t.shadowMd : t.shadow,
                                                position: "relative",
                                                zIndex: 1,
                                            }}
                                        >
                                            <Icon size={24} style={{ color: highlight ? t.white : t.emerald }} />
                                        </div>
                                        <p style={{ ...t.small, color: t.slate400, marginBottom: t.s8, fontWeight: 600, letterSpacing: "0.06em" }}>
                                            STEP {step}
                                        </p>
                                        <h3 style={{ fontSize: 17, fontWeight: 650, color: t.navy, marginBottom: t.s8 }}>{title}</h3>
                                        <p style={{ ...t.body, fontSize: 15, color: t.slate500, maxWidth: 280, marginInline: "auto" }}>{desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══════════ CTA ═══════════ */}
                <section style={{ ...sectionPad(t.s120), background: t.surface }}>
                    <div style={{ ...containerStyle, maxWidth: 960 }}>
                        <div
                            style={{
                                background: t.navy,
                                borderRadius: t.radiusXl,
                                padding: `${t.s80}px ${t.s32}px`,
                                textAlign: "center",
                                position: "relative",
                                overflow: "hidden",
                                boxShadow: t.shadowLg,
                            }}
                        >
                            {/* Glow */}
                            <div
                                style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    width: 600,
                                    height: 600,
                                    borderRadius: "50%",
                                    background: "radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)",
                                    pointerEvents: "none",
                                }}
                            />

                            <h2 style={{ ...t.h2, color: t.white, position: "relative", zIndex: 1, marginBottom: t.s16 }}>
                                Bring Accountability to Every Contribution.
                            </h2>
                            <p style={{ ...t.body, color: t.slate400, maxWidth: 480, marginInline: "auto", position: "relative", zIndex: 1, marginBottom: t.s40 }}>
                                Join the platform that aligns creator incentives with backer trust. Start your
                                transparent funding journey today.
                            </p>

                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: t.s24, position: "relative", zIndex: 1 }}>
                                <Link
                                    href="/signup"
                                    style={{
                                        ...t.small,
                                        fontWeight: 600,
                                        color: t.white,
                                        background: t.green,
                                        padding: "14px 36px",
                                        borderRadius: t.radiusFull,
                                        boxShadow: "0 4px 20px rgba(16,185,129,0.3)",
                                        transition: "opacity .15s",
                                    }}
                                >
                                    Get Started
                                </Link>
                                <Link
                                    href="/contact"
                                    style={{ ...t.small, fontWeight: 600, color: t.slate400, transition: "color .15s" }}
                                >
                                    Contact Sales →
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* ═══════════ FOOTER ═══════════ */}
            <footer style={{ background: t.surface, borderTop: `1px solid ${t.border}`, padding: `${t.s64}px 0 ${t.s40}px` }}>
                <div style={containerStyle}>
                    <div
                        style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: t.s40 }}
                    >
                        {/* Brand */}
                        <div style={{ maxWidth: 280 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: t.s8, marginBottom: t.s12 }}>
                                <div
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 6,
                                        background: t.navy,
                                        color: t.white,
                                        display: "grid",
                                        placeItems: "center",
                                        fontWeight: 700,
                                        fontSize: 11,
                                    }}
                                >
                                    C
                                </div>
                                <span style={{ fontWeight: 700, fontSize: 17, color: t.navy }}>Credence</span>
                            </div>
                            <p style={{ ...t.small, color: t.slate400, lineHeight: 1.7 }}>
                                Funding backed by proof, not promises. Changing how communities build
                                together.
                            </p>
                        </div>

                        {/* Links */}
                        <div style={{ display: "flex", gap: t.s32, ...t.small }}>
                            {["About", "Docs", "GitHub", "Contact"].map((item) => (
                                <Link
                                    key={item}
                                    href={item === "GitHub" ? "https://github.com" : `/${item.toLowerCase()}`}
                                    style={{ color: t.slate500, transition: "color .15s" }}
                                >
                                    {item}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div
                        style={{
                            marginTop: t.s40,
                            paddingTop: t.s24,
                            borderTop: `1px solid ${t.borderSub}`,
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "space-between",
                            gap: t.s16,
                            fontSize: 13,
                            color: t.slate400,
                        }}
                    >
                        <p>© {new Date().getFullYear()} Credence Platform. All rights reserved.</p>
                        <div style={{ display: "flex", gap: t.s24 }}>
                            <Link href="/privacy" style={{ color: t.slate400 }}>Privacy</Link>
                            <Link href="/terms" style={{ color: t.slate400 }}>Terms</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
