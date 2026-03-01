"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useSendTransaction } from "@privy-io/react-auth/solana";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight, ArrowLeft, Info, Wallet } from "lucide-react";
import { Navbar } from "../../components/layout/Navbar";
import {
  createCampaignMeta,
  createOrgMeta,
  verifyOrgGstin,
  patchCampaignOnchain,
  loginWithPrivy,
} from "../../lib/api";
import { YIELD_LABELS, ORG_CATEGORY_LABELS, LAMPORTS_PER_SOL } from "../../lib/utils";
import {
  getProgram,
  buildCreateOrgTx,
  buildCreateProjectTx,
  generateProjectId,
  projectIdToHex,
  deriveOrgPDA,
  fetchOrgAccount,
} from "../../lib/anchor";

const STEPS = ["Organisation", "Campaign", "Milestones", "Launch"];
const SOLSCAN_CLUSTER_SUFFIX = process.env.NEXT_PUBLIC_SOLANA_RPC?.includes("devnet")
  ? "?cluster=devnet"
  : process.env.NEXT_PUBLIC_SOLANA_RPC?.includes("testnet")
    ? "?cluster=testnet"
    : "";

function solscanTxUrl(signature: string) {
  return `https://solscan.io/tx/${signature}${SOLSCAN_CLUSTER_SUFFIX}`;
}

interface MilestoneForm {
  title: string;
  description: string;
  amountSol: string;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">{label}</label>
      {children}
      {hint && <p className="text-sm text-[#1A1F2E]/25 mt-2">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full px-4 py-3.5 rounded-xl bg-[#F8F7F4] border border-[#E4E2DC] text-[#1A1F2E] text-base placeholder-[#1A1F2E]/25 focus:outline-none focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F]/20 transition-all duration-150 min-h-[48px]";
const selectCls = `${inputCls} appearance-none`;

export default function CreatePage() {
  const router = useRouter();
  const { authenticated, login, getAccessToken, user, linkTwitter } = usePrivy();
  const { sendTransaction: sendPrivyTransaction } = useSendTransaction();
  const { connection } = useConnection();
  const { publicKey, sendTransaction: sendWalletAdapterTransaction } = useWallet();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [orgCategory, setOrgCategory] = useState("STUDENT_ORG");
  const [orgDescription, setOrgDescription] = useState("");
  const [orgGstin, setOrgGstin] = useState("");
  const [gstinChecking, setGstinChecking] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [goalSol, setGoalSol] = useState("");
  const [yieldPolicy, setYieldPolicy] = useState(0);
  const [milestones, setMilestones] = useState<MilestoneForm[]>([{ title: "", description: "", amountSol: "" }]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
        <Navbar />
        <div className="mx-auto max-w-[1200px] px-8 pt-32 text-center">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-2xl font-bold mb-4">Connect to get started</h2>
          <p className="text-lg text-[#1A1F2E]/45 mb-8">You need to log in to create a campaign.</p>
          <button
            onClick={() => login()}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-lg hover:bg-[#245A42] hover:-translate-y-[1px] transition-all duration-150 min-h-[48px]"
          >
            <Wallet size={20} /> Connect with Privy
          </button>
        </div>
      </div>
    );
  }

  const addMilestone = () => setMilestones([...milestones, { title: "", description: "", amountSol: "" }]);
  const removeMilestone = (i: number) => setMilestones(milestones.filter((_, idx) => idx !== i));
  const updateMilestone = (i: number, field: keyof MilestoneForm, value: string) => {
    setMilestones(milestones.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  };

  const totalMilestoneSol = milestones.reduce((sum, m) => sum + parseFloat(m.amountSol || "0"), 0);
  const goalSolNum = parseFloat(goalSol || "0");
  const milestonesValid = Math.abs(totalMilestoneSol - goalSolNum) < 0.0001;
  const twitterHandle =
    user?.twitter?.username ??
    user?.linkedAccounts?.find((a) => a.type === "twitter_oauth")?.username ??
    undefined;
  const linkedSolanaAccount = user?.linkedAccounts?.find(
    (account) =>
      account.type === "wallet" &&
      "chainType" in account &&
      account.chainType === "solana"
  );
  const linkedSolanaAddress =
    linkedSolanaAccount &&
      "address" in linkedSolanaAccount &&
      typeof linkedSolanaAccount.address === "string"
      ? linkedSolanaAccount.address
      : undefined;
  const connectedWalletAddress = publicKey?.toBase58() ?? user?.wallet?.address ?? linkedSolanaAddress;

  const handleLinkTwitter = async () => {
    try {
      await linkTwitter();
      const accessToken = await getAccessToken();
      if (accessToken) {
        await loginWithPrivy(accessToken);
      }
      toast.success("X account linked");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to link X account";
      toast.error("Could not link X account", { description: message });
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const walletAddress = connectedWalletAddress;
      if (!walletAddress) {
        toast.error("Connect your wallet first");
        return;
      }

      if (!orgName.trim() || !title.trim() || !description.trim() || !orgGstin.trim()) {
        toast.error("Please fill required fields");
        return;
      }
      if (!goalSolNum || goalSolNum <= 0) {
        toast.error("Goal must be greater than 0");
        return;
      }
      if (!milestonesValid || milestones.some((m) => !m.title.trim())) {
        toast.error("Milestones are invalid");
        return;
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error("Session expired. Please login again.");
        return;
      }
      await loginWithPrivy(accessToken);

      const normalizedGstin = orgGstin.toUpperCase().trim();
      setGstinChecking(true);
      const gst = await verifyOrgGstin(normalizedGstin);
      setGstinChecking(false);

      const creatorPubkey = new PublicKey(walletAddress);
      const prepareTx = async (tx: Transaction) => {
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        tx.feePayer = creatorPubkey;
        tx.recentBlockhash = blockhash;
        return tx;
      };
      const provider = new AnchorProvider(connection, {} as never, { commitment: "confirmed" });
      const program = getProgram(provider);
      const existingOrg = await fetchOrgAccount(program, creatorPubkey);

      const [orgPDA] = deriveOrgPDA(creatorPubkey);
      const orgPdaAddress = orgPDA.toBase58();

      if (!existingOrg) {
        toast.info("Creating org on-chain...", { description: "Approve the transaction." });
        const createOrgTx = await prepareTx(await buildCreateOrgTx(program, creatorPubkey, gst.gstinHashBytes));
        let orgSig: string;
        if (publicKey) {
          orgSig = await sendWalletAdapterTransaction(createOrgTx, connection);
        } else {
          const receipt = await sendPrivyTransaction({ transaction: createOrgTx, connection, address: walletAddress });
          orgSig = receipt.signature;
        }
        toast.success("Org created on-chain", {
          description: `Tx: ${orgSig.slice(0, 8)}...${orgSig.slice(-8)}`,
          action: {
            label: "Solscan",
            onClick: () => window.open(solscanTxUrl(orgSig), "_blank", "noopener,noreferrer"),
          },
        });
      }

      try {
        await createOrgMeta({
          name: orgName,
          category: orgCategory,
          description: orgDescription,
          gstin: normalizedGstin,
          onchainPda: orgPdaAddress,
        });
      } catch (e: unknown) {
        const err = e as { response?: { status?: number } };
        if (err.response?.status !== 409) throw e;
      }

      const campaign = await createCampaignMeta({
        title,
        description,
        category: orgCategory,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        hasGoal: true,
        totalGoalLamports: Math.floor(goalSolNum * LAMPORTS_PER_SOL),
        yieldPolicy,
        milestones: milestones.map((m) => ({
          title: m.title,
          description: m.description,
          amountLamports: Math.floor(parseFloat(m.amountSol || "0") * LAMPORTS_PER_SOL),
        })),
      });

      const projectId = generateProjectId();
      const deadlineUnix = Math.floor(Date.now() / 1000) + 90 * 24 * 3600;
      toast.info("Creating project on-chain...", { description: "Approve the transaction." });

      const { tx: createProjectTx, projectPDA, vaultPDA } = await buildCreateProjectTx(program, creatorPubkey, {
        projectId: Array.from(projectId),
        hasGoal: true,
        totalGoalLamports: Math.floor(goalSolNum * LAMPORTS_PER_SOL),
        useMilestonePct: false,
        deadlineUnix,
        yieldPolicy,
        prefrontLamports: 0,
        prefrontTranches: 0,
        milestones: milestones.map((m) => ({
          amount: Math.floor(parseFloat(m.amountSol || "0") * LAMPORTS_PER_SOL),
          releasePctBps: 0,
          deadline: deadlineUnix,
          thresholdBps: 5100,
          quorumBps: 1000,
        })),
      });
      const preparedCreateProjectTx = await prepareTx(createProjectTx);
      let createProjectSig: string;

      if (publicKey) {
        createProjectSig = await sendWalletAdapterTransaction(preparedCreateProjectTx, connection);
      } else {
        const receipt = await sendPrivyTransaction({ transaction: preparedCreateProjectTx, connection, address: walletAddress });
        createProjectSig = receipt.signature;
      }

      await patchCampaignOnchain(campaign.id, {
        onchainProjectPda: projectPDA.toBase58(),
        onchainVaultPda: vaultPDA.toBase58(),
        projectIdBytes: projectIdToHex(projectId),
        onchainOrgPda: orgPdaAddress,
      });

      toast.success("Campaign launched", {
        description: "Your campaign is live.",
        action: {
          label: "Solscan",
          onClick: () => window.open(solscanTxUrl(createProjectSig), "_blank", "noopener,noreferrer"),
        },
      });
      router.push(`/campaign/${campaign.id}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast.error("Failed to create campaign", { description: message });
    } finally {
      setGstinChecking(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
      <Navbar />

      <main className="mx-auto max-w-[720px] px-8 pt-12 pb-24">
        <h1 className="text-4xl font-bold tracking-[-0.03em] text-[#1A1F2E] mb-3">
          Start a Campaign
        </h1>
        <p className="text-lg text-[#1A1F2E]/45 mb-12 leading-relaxed">Create an on-chain milestone-backed fundraiser.</p>

        <div className="flex gap-3 mb-12">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${i < step
                    ? "bg-[#2D6A4F] text-white"
                    : i === step
                      ? "bg-[#2D6A4F] text-white shadow-[0_4px_12px_rgba(45,106,79,0.2)]"
                      : "bg-[#F0EFEB] border border-[#E4E2DC] text-[#1A1F2E]/30"
                  }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-semibold text-center ${i === step ? "text-[#2D6A4F]" : "text-[#1A1F2E]/25"}`}>
                {s}
              </span>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
            <h2 className="text-xl font-bold mb-8">Organisation Details</h2>
            <div className="space-y-6">
              <Field label="Organisation Name *">
                <input className={inputCls} placeholder="e.g. Shaastra, IIT Madras" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </Field>
              <Field label="Category *">
                <select className={selectCls} value={orgCategory} onChange={(e) => setOrgCategory(e.target.value)}>
                  {Object.entries(ORG_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="X (Twitter) Account">
                {twitterHandle ? (
                  <div className="px-4 py-3.5 rounded-xl bg-[#2D6A4F]/8 border border-[#2D6A4F]/20 text-[#2D6A4F] text-base font-medium min-h-[48px] flex items-center">
                    Linked as @{twitterHandle}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleLinkTwitter}
                    className="w-full px-4 py-3.5 rounded-xl bg-[#F8F7F4] border border-[#E4E2DC] text-[#1A1F2E]/80 text-base font-semibold hover:border-[#2D6A4F]/50 transition-all duration-150 min-h-[48px]"
                  >
                    Connect X via Privy
                  </button>
                )}
              </Field>
              <Field label="Organisation GSTIN *" hint="15-char format: 29AABCR1234A1Z5. Any valid format works in demo mode.">
                <div className="flex gap-3">
                  <input
                    className={`${inputCls} font-['DM_Mono'] flex-1`}
                    placeholder="e.g. 29AABCR1234A1Z5"
                    value={orgGstin}
                    onChange={(e) => setOrgGstin(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setOrgGstin("29AABCR1234A1Z5")}
                    className="px-4 py-3 rounded-xl bg-[#2D6A4F]/8 border border-[#2D6A4F]/20 text-[#2D6A4F] text-sm font-bold hover:bg-[#2D6A4F]/15 transition-all duration-150 whitespace-nowrap shrink-0 min-h-[48px]"
                  >
                    Use Demo
                  </button>
                </div>
              </Field>
              <Field label="Description">
                <textarea
                  className={`${inputCls} min-h-[100px] resize-y`}
                  placeholder="What does your organisation do?"
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                />
              </Field>
            </div>
            <button
              disabled={!orgName || !orgGstin.trim()}
              onClick={() => setStep(1)}
              className="w-full mt-8 py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#245A42] hover:-translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[48px]"
            >
              Next: Campaign Info <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
            <h2 className="text-xl font-bold mb-8">Campaign Details</h2>
            <div className="space-y-6">
              <Field label="Campaign Title *">
                <input className={inputCls} placeholder="e.g. Shaastra 2025 Technical Festival" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="Description *">
                <textarea
                  className={`${inputCls} min-h-[140px] resize-y`}
                  placeholder="Tell donors what you're raising for..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Goal (SOL) *">
                  <input className={inputCls} type="number" min="0" step="0.1" placeholder="e.g. 40" value={goalSol} onChange={(e) => setGoalSol(e.target.value)} />
                </Field>
                <Field label="Yield Policy">
                  <select className={selectCls} value={yieldPolicy} onChange={(e) => setYieldPolicy(parseInt(e.target.value, 10))}>
                    {Object.entries(YIELD_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Tags (comma-separated)">
                <input className={inputCls} placeholder="education, tech, open-source" value={tags} onChange={(e) => setTags(e.target.value)} />
              </Field>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep(0)}
                className="px-6 py-3.5 rounded-xl border border-[#E4E2DC] text-[#1A1F2E]/50 text-base font-semibold hover:bg-[#F0EFEB] transition-all duration-150 flex items-center gap-2 min-h-[48px]"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button
                disabled={!title || !description || !goalSol}
                onClick={() => setStep(2)}
                className="flex-1 py-3.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#245A42] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[48px]"
              >
                Next: Milestones <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-start gap-3 p-6 rounded-xl bg-[#2D6A4F]/[0.06] border border-[#2D6A4F]/20 mb-6 text-base text-[#1A1F2E]/55">
              <Info size={18} className="text-[#2D6A4F] shrink-0 mt-0.5" />
              Milestone amounts must sum to {goalSol || 0} SOL. Current: {totalMilestoneSol.toFixed(2)} SOL.
            </div>
            <div className="space-y-6">
              {milestones.map((m, i) => (
                <div key={i} className="bg-white border border-[#E4E2DC] rounded-xl p-6 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-bold text-[#2D6A4F]">Milestone {i + 1}</span>
                    {milestones.length > 1 && (
                      <button
                        onClick={() => removeMilestone(i)}
                        className="p-2.5 rounded-lg text-[#C44536]/60 hover:bg-[#C44536]/10 hover:text-[#C44536] transition-all duration-150 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <input className={inputCls} placeholder="Milestone title" value={m.title} onChange={(e) => updateMilestone(i, "title", e.target.value)} />
                    <textarea
                      className={`${inputCls} min-h-[80px] resize-y`}
                      placeholder="What needs to happen?"
                      value={m.description}
                      onChange={(e) => updateMilestone(i, "description", e.target.value)}
                    />
                    <input
                      className={inputCls}
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Amount (SOL)"
                      value={m.amountSol}
                      onChange={(e) => updateMilestone(i, "amountSol", e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={addMilestone}
                className="w-full py-4 rounded-xl border border-dashed border-[#E4E2DC] text-[#1A1F2E]/30 text-base font-semibold hover:bg-[#F0EFEB] hover:text-[#1A1F2E]/50 transition-all duration-150 flex items-center justify-center gap-2 min-h-[48px]"
              >
                <Plus size={18} /> Add Milestone
              </button>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3.5 rounded-xl border border-[#E4E2DC] text-[#1A1F2E]/50 text-base font-semibold hover:bg-[#F0EFEB] transition-all duration-150 flex items-center gap-2 min-h-[48px]"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button
                disabled={!milestonesValid || milestones.some((m) => !m.title.trim())}
                onClick={() => setStep(3)}
                className="flex-1 py-3.5 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#245A42] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[48px]"
              >
                Review & Launch <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
            <h2 className="text-xl font-bold mb-8">Review & Launch</h2>
            <div className="space-y-4 mb-8">
              {[
                { label: "Org", value: `${orgName} (${ORG_CATEGORY_LABELS[orgCategory]})` },
                { label: "Campaign", value: title },
                { label: "Goal", value: `${goalSol} SOL` },
                { label: "Yield", value: YIELD_LABELS[yieldPolicy] },
                { label: "Milestones", value: `${milestones.length} phase(s)` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-4 border-b border-[#E4E2DC]">
                  <span className="text-sm text-[#1A1F2E]/35">{label}</span>
                  <span className="text-base font-semibold text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-3 p-6 rounded-xl bg-[#C2850C]/[0.06] border border-[#C2850C]/20 mb-8 text-sm text-[#1A1F2E]/50">
              ⚠️ After creating the campaign metadata, you&apos;ll sign a transaction to activate the on-chain escrow vault.
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3.5 rounded-xl border border-[#E4E2DC] text-[#1A1F2E]/50 text-base font-semibold hover:bg-[#F0EFEB] transition-all duration-150 flex items-center gap-2 min-h-[48px]"
              >
                <ArrowLeft size={18} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || gstinChecking}
                className="flex-1 py-4 rounded-xl bg-[#2D6A4F] text-white font-bold text-base flex items-center justify-center gap-2 hover:bg-[#245A42] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[48px]"
              >
                {loading || gstinChecking ? "Creating..." : "Launch Campaign"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
