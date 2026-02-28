"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight, ArrowLeft, Info } from "lucide-react";
import { Navbar } from "../../components/layout/Navbar";
import { createCampaignMeta, createOrgMeta } from "../../lib/api";
import { YIELD_LABELS, ORG_CATEGORY_LABELS } from "../../lib/utils";

const STEPS = ["Org Check", "Campaign Info", "Milestones", "Review & Launch"];

interface MilestoneForm {
    title: string;
    description: string;
    amountSol: string;
}

export default function CreatePage() {
    const router = useRouter();
    const { authenticated, login, getAccessToken } = usePrivy();

    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Org fields
    const [orgName, setOrgName] = useState("");
    const [orgCategory, setOrgCategory] = useState("STUDENT_ORG");
    const [orgDescription, setOrgDescription] = useState("");
    const [orgTwitter, setOrgTwitter] = useState("");

    // Campaign fields
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");
    const [goalSol, setGoalSol] = useState("");
    const [yieldPolicy, setYieldPolicy] = useState(0);
    const [milestones, setMilestones] = useState<MilestoneForm[]>([{ title: "", description: "", amountSol: "" }]);

    if (!authenticated) {
        return (
            <div>
                <Navbar />
                <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
                    <h2 style={{ marginBottom: 12 }}>Connect to get started</h2>
                    <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
                        You need to log in to create a campaign.
                    </p>
                    <button className="btn btn-primary btn-lg" onClick={() => login()}>
                        Connect with Privy
                    </button>
                </div>
            </div>
        );
    }

    const addMilestone = () => setMilestones([...milestones, { title: "", description: "", amountSol: "" }]);
    const removeMilestone = (i: number) => setMilestones(milestones.filter((_, idx) => idx !== i));
    const updateMilestone = (i: number, field: keyof MilestoneForm, value: string) => {
        setMilestones(milestones.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
    };

    const totalMilestoneSol = milestones.reduce((sum, m) => sum + parseFloat(m.amountSol || "0"), 0);
    const goalSolNum = parseFloat(goalSol || "0");
    const milestonesValid = Math.abs(totalMilestoneSol - goalSolNum) < 0.0001;

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const token = await getAccessToken();
            const LAMPORTS = 1_000_000_000;

            // Create org meta first
            await createOrgMeta({
                name: orgName,
                category: orgCategory,
                description: orgDescription,
                twitterHandle: orgTwitter,
            });

            // Create campaign meta
            const campaign = await createCampaignMeta({
                title,
                description,
                category: orgCategory,
                tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
                hasGoal: true,
                totalGoalLamports: Math.floor(goalSolNum * LAMPORTS),
                yieldPolicy,
                milestones: milestones.map((m) => ({
                    title: m.title,
                    description: m.description,
                    amountLamports: Math.floor(parseFloat(m.amountSol || "0") * LAMPORTS),
                })),
            });

            toast.success("Campaign created!", {
                description: "Now call create_project on-chain to activate the escrow vault.",
            });
            router.push(`/campaign/${campaign.id}`);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Unknown error";
            toast.error("Failed to create campaign", { description: message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <Navbar />
            <main className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 680 }}>
                <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 8 }}>Start a Campaign</h1>
                <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
                    Create an on-chain milestone-backed fundraiser.
                </p>

                {/* Step indicator */}
                <div style={{ display: "flex", gap: 8, marginBottom: 36 }}>
                    {STEPS.map((s, i) => (
                        <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: "50%",
                                background: i < step ? "var(--success)" : i === step ? "var(--violet)" : "var(--bg-elevated)",
                                border: i <= step ? "none" : "1.5px solid var(--border)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, fontWeight: 700, color: "#fff",
                            }}>
                                {i < step ? "✓" : i + 1}
                            </div>
                            <span style={{ fontSize: 10, color: i === step ? "var(--violet-light)" : "var(--text-muted)", fontWeight: 600, textAlign: "center" }}>
                                {s}
                            </span>
                        </div>
                    ))}
                </div>

                {/* ── Step 0: Org Check ── */}
                {step === 0 && (
                    <div className="card" style={{ padding: 28 }}>
                        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Organisation Details</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div>
                                <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Organisation Name *</label>
                                <input className="input" placeholder="e.g. Shaastra, IIT Madras" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Category *</label>
                                <select className="input" value={orgCategory} onChange={(e) => setOrgCategory(e.target.value)}>
                                    {Object.entries(ORG_CATEGORY_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Twitter Handle</label>
                                <input className="input" placeholder="@shaastra_iitm" value={orgTwitter} onChange={(e) => setOrgTwitter(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Description</label>
                                <textarea className="input" placeholder="What does your organisation do?" value={orgDescription} onChange={(e) => setOrgDescription(e.target.value)} />
                            </div>
                        </div>
                        <button
                            className="btn btn-primary"
                            style={{ width: "100%", marginTop: 24 }}
                            disabled={!orgName}
                            onClick={() => setStep(1)}
                        >
                            Next: Campaign Info <ArrowRight size={15} />
                        </button>
                    </div>
                )}

                {/* ── Step 1: Campaign Info ── */}
                {step === 1 && (
                    <div className="card" style={{ padding: 28 }}>
                        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Campaign Details</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div>
                                <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Campaign Title *</label>
                                <input className="input" placeholder="e.g. Shaastra 2025 Technical Festival" value={title} onChange={(e) => setTitle(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Description *</label>
                                <textarea className="input" style={{ minHeight: 120 }} placeholder="Tell donors what you're raising for..." value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                <div>
                                    <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Goal (SOL) *</label>
                                    <input className="input" type="number" min="0" step="0.1" placeholder="e.g. 40" value={goalSol} onChange={(e) => setGoalSol(e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Yield Policy</label>
                                    <select className="input" value={yieldPolicy} onChange={(e) => setYieldPolicy(parseInt(e.target.value))}>
                                        {Object.entries(YIELD_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>Tags (comma-separated)</label>
                                <input className="input" placeholder="education, tech, open-source" value={tags} onChange={(e) => setTags(e.target.value)} />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                            <button className="btn btn-ghost" onClick={() => setStep(0)}><ArrowLeft size={15} /> Back</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!title || !description || !goalSol} onClick={() => setStep(2)}>
                                Next: Milestones <ArrowRight size={15} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Milestones ── */}
                {step === 2 && (
                    <div>
                        <div style={{
                            padding: "12px 16px", borderRadius: 10, marginBottom: 20,
                            background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
                            fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 8,
                        }}>
                            <Info size={15} color="var(--violet-light)" style={{ flexShrink: 0, marginTop: 1 }} />
                            Milestone amounts must sum to the total goal ({goalSol} SOL). Current sum: {totalMilestoneSol.toFixed(2)} SOL.
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {milestones.map((m, i) => (
                                <div key={i} className="card" style={{ padding: 20 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--violet-light)" }}>Milestone {i + 1}</span>
                                        {milestones.length > 1 && (
                                            <button onClick={() => removeMilestone(i)} className="btn btn-danger btn-sm">
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        <input className="input" placeholder="Milestone title" value={m.title} onChange={(e) => updateMilestone(i, "title", e.target.value)} />
                                        <textarea className="input" style={{ minHeight: 70 }} placeholder="What needs to happen for this milestone?" value={m.description} onChange={(e) => updateMilestone(i, "description", e.target.value)} />
                                        <input className="input" type="number" min="0" step="0.1" placeholder="Amount (SOL)" value={m.amountSol} onChange={(e) => updateMilestone(i, "amountSol", e.target.value)} />
                                    </div>
                                </div>
                            ))}
                            <button onClick={addMilestone} className="btn btn-ghost" style={{ width: "100%" }}>
                                <Plus size={15} /> Add Milestone
                            </button>
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                            <button className="btn btn-ghost" onClick={() => setStep(1)}><ArrowLeft size={15} /> Back</button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                                disabled={!milestonesValid || milestones.some((m) => !m.title)}
                                onClick={() => setStep(3)}
                            >
                                Review & Launch <ArrowRight size={15} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Review ── */}
                {step === 3 && (
                    <div className="card" style={{ padding: 28 }}>
                        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Review & Launch</h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                            {[
                                { label: "Org", value: `${orgName} (${ORG_CATEGORY_LABELS[orgCategory]})` },
                                { label: "Campaign Title", value: title },
                                { label: "Goal", value: `${goalSol} SOL` },
                                { label: "Yield Policy", value: YIELD_LABELS[yieldPolicy] },
                                { label: "Milestones", value: `${milestones.length} milestone(s)` },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{value}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{
                            padding: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                            borderRadius: 10, fontSize: 12, color: "var(--text-secondary)", marginBottom: 20,
                        }}>
                            ⚠️ After creating the campaign metadata, you&apos;ll need to call <code>create_project</code> on-chain with your wallet to activate the escrow vault.
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button className="btn btn-ghost" onClick={() => setStep(2)}><ArrowLeft size={15} /> Back</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={loading}>
                                {loading ? "Creating..." : "🚀 Launch Campaign"}
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
