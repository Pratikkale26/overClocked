"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import {
    useConnectedStandardWallets,
    useSendTransaction,
    useStandardSignAndSendTransaction,
} from "@privy-io/react-auth/solana";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { toast } from "sonner";
import { ArrowLeft, Upload, Plus, FileText, Wallet } from "lucide-react";
import { Navbar } from "../../../../components/layout/Navbar";
import { DprTimeline } from "../../../../components/campaigns/DprTimeline";
import {
    fetchCampaign, fetchMilestoneUpdates, postMilestoneUpdate,
    submitMilestoneProof, presignProofUpload, fetchMilestoneProof, confirmMilestoneProofOnchain, presignUpdateMedia,
    type Campaign, type Milestone, type MilestoneUpdate, type MilestoneProof,
} from "../../../../lib/api";
import {
    buildSubmitMilestoneProofTx,
    deriveProjectPDA,
    getProgram,
    hexToProjectId,
} from "../../../../lib/anchor";

const UPDATE_TYPES = ["PROGRESS", "EXPENSE", "PHOTO", "COMPLETION", "ANNOUNCEMENT"];

const inputCls = "w-full px-4 py-3 rounded-xl bg-[#161625] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all";

async function sha256Bytes(input: string): Promise<number[]> {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", encoded as unknown as BufferSource);
    return Array.from(new Uint8Array(digest));
}

export default function ManageCampaignPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { authenticated, login, user } = usePrivy();
    const { sendTransaction: sendPrivyTransaction } = useSendTransaction();
    const { wallets: connectedStandardWallets } = useConnectedStandardWallets();
    const { signAndSendTransaction } = useStandardSignAndSendTransaction();
    const { connection } = useConnection();
    const { publicKey, sendTransaction: sendWalletAdapterTransaction } = useWallet();
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
    const [updates, setUpdates] = useState<MilestoneUpdate[]>([]);
    const [proof, setProof] = useState<MilestoneProof | null>(null);

    const [proofLoading, setProofLoading] = useState(false);
    const [proofSyncLoading, setProofSyncLoading] = useState(false);
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [gstin, setGstin] = useState("");
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [invoiceAmount, setInvoiceAmount] = useState("");
    const [isUnregistered, setIsUnregistered] = useState(false);
    const [votingHours, setVotingHours] = useState(72);

    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateType, setUpdateType] = useState("PROGRESS");
    const [updateTitle, setUpdateTitle] = useState("");
    const [updateDesc, setUpdateDesc] = useState("");
    const [updateFiles, setUpdateFiles] = useState<File[]>([]);

    const load = useCallback(async () => {
        try {
            const c = await fetchCampaign(id);
            setCampaign(c);
            if (!activeMilestone || !c.milestones.some((m) => m.id === activeMilestone.id)) {
                const target = c.milestones?.find((m) => m.state === "PENDING" || m.state === "UNDER_REVIEW") ?? c.milestones?.[0];
                if (target) setActiveMilestone(target);
            }
        } catch { setCampaign(null); } finally { setLoading(false); }
    }, [activeMilestone, id]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!activeMilestone) {
            setUpdates([]);
            setProof(null);
            return;
        }
        (async () => {
            const [u, p] = await Promise.allSettled([
                fetchMilestoneUpdates(activeMilestone.id),
                fetchMilestoneProof(activeMilestone.id),
            ]);
            setUpdates(u.status === "fulfilled" ? u.value : []);
            setProof(p.status === "fulfilled" ? p.value : null);
        })();
    }, [activeMilestone]);

    const handleSubmitProof = async () => {
        if (!activeMilestone) return;
        const currentCampaign = campaign;
        if (!currentCampaign) return;
        if (!isUnregistered && !gstin) { toast.error("Enter vendor GSTIN or mark as unregistered"); return; }
        if (!invoiceFile) { toast.error("Upload the invoice first"); return; }
        const signerAddr = publicKey?.toBase58() ?? linkedAddr ?? user?.wallet?.address;
        if (!signerAddr) {
            toast.error("Connect your creator wallet first");
            return;
        }
        if (!currentCampaign.onchainProjectPda && !(currentCampaign.projectIdBytes && currentCampaign.org?.walletAddress)) {
            toast.error("Campaign is missing on-chain project reference");
            return;
        }
        setProofLoading(true);
        try {
            const { uploadUrl, s3Key } = await presignProofUpload(activeMilestone.id, invoiceFile.name, invoiceFile.type);
            const putRes = await fetch(uploadUrl, {
                method: "PUT",
                body: invoiceFile,
                headers: { "Content-Type": invoiceFile.type },
            });
            if (!putRes.ok) {
                const detail = await putRes.text().catch(() => "");
                throw new Error(`File upload failed (${putRes.status})${detail ? `: ${detail}` : ""}`);
            }
            const proofResult = await submitMilestoneProof(activeMilestone.id, {
                gstin: isUnregistered ? undefined : gstin.toUpperCase().trim(),
                isUnregisteredVendor: isUnregistered, invoiceS3Key: s3Key,
                invoiceNumber: invoiceNumber || undefined,
                invoiceAmountPaise: invoiceAmount ? Math.round(parseFloat(invoiceAmount) * 100) : undefined,
                votingWindowSecs: votingHours * 3600,
            });
            const projectPda = currentCampaign.onchainProjectPda
                ? new PublicKey(currentCampaign.onchainProjectPda)
                : (() => {
                    const [pda] = deriveProjectPDA(
                        new PublicKey(currentCampaign.org.walletAddress!),
                        hexToProjectId(currentCampaign.projectIdBytes!)
                    );
                    return pda;
                })();
            const creatorPk = new PublicKey(signerAddr);
            const provider = new AnchorProvider(connection, {} as never, { commitment: "confirmed" });
            const orgGstinHashBytes = isUnregistered
                ? new Array(32).fill(0)
                : currentCampaign.org.gstin
                    ? await sha256Bytes(currentCampaign.org.gstin.trim().toUpperCase())
                    : (() => { throw new Error("Org GSTIN missing for on-chain proof submission"); })();
            const tx = await buildSubmitMilestoneProofTx(
                getProgram(provider),
                creatorPk,
                projectPda,
                activeMilestone.index,
                s3Key,
                String((proofResult as { invoiceHash: string }).invoiceHash),
                orgGstinHashBytes,
                Number((proofResult as { votingWindowSecs: number }).votingWindowSecs ?? votingHours * 3600)
            );
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            tx.feePayer = creatorPk;
            tx.recentBlockhash = blockhash;

            let proofSig: string | undefined;
            if (publicKey && publicKey.toBase58() === signerAddr) {
                proofSig = await sendWalletAdapterTransaction(tx, connection);
            } else {
                const stdWallet = connectedStandardWallets.find(
                    (wallet) => wallet.address.toLowerCase() === signerAddr.toLowerCase()
                );
                if (stdWallet) {
                    await signAndSendTransaction({
                        transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
                        wallet: stdWallet,
                        chain: "solana:devnet",
                    });
                } else {
                    const receipt = await sendPrivyTransaction({ transaction: tx, connection, address: signerAddr });
                    proofSig = receipt.signature;
                }
            }
            await confirmMilestoneProofOnchain(activeMilestone.id, { onchainProofUri: s3Key, txSignature: proofSig });
            toast.success("Proof submitted!", { description: `Voting open for ${votingHours}h.` });
            await load();
            setProof(await fetchMilestoneProof(activeMilestone.id));
        } catch (e: unknown) {
            toast.error("Proof submission failed", { description: e instanceof Error ? e.message : "Error" });
        } finally { setProofLoading(false); }
    };

    const handleRetryOnchainProof = async () => {
        if (!activeMilestone || !proof) return;
        const currentCampaign = campaign;
        if (!currentCampaign) return;
        const proofUri = proof.invoiceS3Key ?? activeMilestone.proofUri;
        if (!proofUri || !proof.invoiceHash) {
            toast.error("Missing proof data", { description: "Invoice key or hash not found. Re-upload proof." });
            return;
        }
        const signerAddr = publicKey?.toBase58() ?? linkedAddr ?? user?.wallet?.address;
        if (!signerAddr) {
            toast.error("Connect your creator wallet first");
            return;
        }
        if (!currentCampaign.onchainProjectPda && !(currentCampaign.projectIdBytes && currentCampaign.org?.walletAddress)) {
            toast.error("Campaign is missing on-chain project reference");
            return;
        }

        setProofSyncLoading(true);
        try {
            const orgGstinHashBytes = proof.isUnregisteredVendor
                ? new Array(32).fill(0)
                : currentCampaign.org.gstin
                    ? await sha256Bytes(currentCampaign.org.gstin.trim().toUpperCase())
                    : (() => { throw new Error("Org GSTIN missing for on-chain proof submission"); })();
            const projectPda = currentCampaign.onchainProjectPda
                ? new PublicKey(currentCampaign.onchainProjectPda)
                : (() => {
                    const [pda] = deriveProjectPDA(
                        new PublicKey(currentCampaign.org.walletAddress!),
                        hexToProjectId(currentCampaign.projectIdBytes!)
                    );
                    return pda;
                })();
            const creatorPk = new PublicKey(signerAddr);
            const provider = new AnchorProvider(connection, {} as never, { commitment: "confirmed" });
            const tx = await buildSubmitMilestoneProofTx(
                getProgram(provider),
                creatorPk,
                projectPda,
                activeMilestone.index,
                proofUri,
                proof.invoiceHash,
                orgGstinHashBytes,
                activeMilestone.votingWindowSecs
            );
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            tx.feePayer = creatorPk;
            tx.recentBlockhash = blockhash;

            let proofSig: string | undefined;
            if (publicKey && publicKey.toBase58() === signerAddr) {
                proofSig = await sendWalletAdapterTransaction(tx, connection);
            } else {
                const stdWallet = connectedStandardWallets.find(
                    (wallet) => wallet.address.toLowerCase() === signerAddr.toLowerCase()
                );
                if (stdWallet) {
                    await signAndSendTransaction({
                        transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
                        wallet: stdWallet,
                        chain: "solana:devnet",
                    });
                } else {
                    const receipt = await sendPrivyTransaction({ transaction: tx, connection, address: signerAddr });
                    proofSig = receipt.signature;
                }
            }
            await confirmMilestoneProofOnchain(activeMilestone.id, { onchainProofUri: proofUri, txSignature: proofSig });
            toast.success("Voting opened on-chain");
            await load();
            setProof(await fetchMilestoneProof(activeMilestone.id));
        } catch (e: unknown) {
            toast.error("On-chain proof sync failed", { description: e instanceof Error ? e.message : "Error" });
        } finally {
            setProofSyncLoading(false);
        }
    };

    const handlePostUpdate = async () => {
        if (!activeMilestone || !updateTitle.trim()) return;
        setUpdateLoading(true);
        try {
            const mediaKeys: string[] = [];
            for (const file of updateFiles) {
                const { uploadUrl, s3Key } = await presignUpdateMedia(activeMilestone.id, file.name, file.type || "application/octet-stream");
                const putRes = await fetch(uploadUrl, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type || "application/octet-stream" },
                });
                if (!putRes.ok) {
                    const detail = await putRes.text().catch(() => "");
                    throw new Error(`Media upload failed (${putRes.status})${detail ? `: ${detail}` : ""}`);
                }
                mediaKeys.push(s3Key);
            }
            await postMilestoneUpdate(activeMilestone.id, {
                type: updateType,
                title: updateTitle.trim(),
                description: updateDesc.trim() || undefined,
                mediaUrls: mediaKeys,
            });
            toast.success("Update posted!");
            setUpdateTitle(""); setUpdateDesc(""); setUpdateFiles([]);
            setUpdates(await fetchMilestoneUpdates(activeMilestone.id));
        } catch (e: unknown) {
            toast.error("Failed", { description: e instanceof Error ? e.message : "Error" });
        } finally { setUpdateLoading(false); }
    };

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[#050509] text-white"><Navbar />
                <div className="mx-auto max-w-[1240px] px-6 pt-24 text-center">
                    <div className="text-5xl mb-4">🔐</div>
                    <h2 className="text-xl font-bold mb-3">Sign in to manage</h2>
                    <button onClick={() => login()} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/20 hover:brightness-110 transition-all">
                        <Wallet size={15} /> Connect
                    </button>
                </div>
            </div>
        );
    }

    if (loading) return <div className="min-h-screen bg-[#050509] text-white"><Navbar /><main className="mx-auto max-w-[1240px] px-6 pt-12"><div className="skeleton h-52 rounded-2xl" /></main></div>;
    if (!campaign) return <div className="min-h-screen bg-[#050509] text-white"><Navbar /><main className="mx-auto max-w-[1240px] px-6 pt-20 text-center"><h2 className="text-xl font-bold">Campaign not found</h2></main></div>;

    const linkedSolanaAccount = user?.linkedAccounts?.find(
        (account) => account.type === "wallet" && "chainType" in account && account.chainType === "solana"
    );
    const linkedAddr =
        linkedSolanaAccount && "address" in linkedSolanaAccount && typeof linkedSolanaAccount.address === "string"
            ? linkedSolanaAccount.address
            : undefined;
    const connectedWallet = publicKey?.toBase58() ?? user?.wallet?.address ?? linkedAddr;
    const isOwner = Boolean(
        connectedWallet &&
        campaign?.org?.walletAddress &&
        connectedWallet.toLowerCase() === campaign.org.walletAddress.toLowerCase()
    );

    const canSubmitProof = activeMilestone?.state === "PENDING" && !proof;
    const isUnderReview = activeMilestone?.state === "UNDER_REVIEW";
    const canPostUpdate = activeMilestone?.state === "PENDING" || activeMilestone?.state === "UNDER_REVIEW";

    return (
        <div className="min-h-screen bg-[#050509] text-white font-['Inter']">
            <Navbar />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse,rgba(124,58,237,0.05)_0%,transparent_70%)] pointer-events-none -z-10" />

            <main className="mx-auto max-w-[1240px] px-6 pt-10 pb-16">
                <Link href={`/campaign/${id}`}>
                    <button className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-5">
                        <ArrowLeft size={14} /> Back to Campaign
                    </button>
                </Link>
                <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent mb-1">Manage Campaign</h1>
                <p className="text-sm text-white/40 mb-8">{campaign.title}</p>

                {!isOwner && (
                    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                        You are signed in, but this wallet is not the campaign owner wallet. Management actions are blocked.
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                    {/* Left: proof */}
                    <div className="space-y-5">
                        {activeMilestone && (
                            <div className={`p-4 rounded-2xl border ${isUnderReview ? "bg-amber-500/[0.03] border-amber-500/20" : "bg-violet-500/[0.03] border-violet-500/20"}`}>
                                <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isUnderReview ? "text-amber-400" : "text-violet-400"}`}>
                                    {isUnderReview ? "🗳️ Voting in progress" : "⏳ Active Phase"}
                                </p>
                                <p className="font-bold text-sm">Phase {activeMilestone.index + 1}: {activeMilestone.title}</p>
                                {isUnderReview && <p className="text-xs text-white/40 mt-1">Donors are reviewing your proof and voting.</p>}
                            </div>
                        )}
                        {!!campaign.milestones?.length && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {campaign.milestones.map((m) => {
                                    const active = activeMilestone?.id === m.id;
                                    return (
                                        <button
                                            key={m.id}
                                            onClick={() => setActiveMilestone(m)}
                                            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${active
                                                ? "bg-violet-500/15 border-violet-500/40 text-violet-300"
                                                : "bg-white/[0.03] border-white/[0.06] text-white/45 hover:text-white/75"
                                                }`}
                                        >
                                            Phase {m.index + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6">
                            <h2 className="text-sm font-bold flex items-center gap-2 mb-5"><FileText size={15} /> Submit Phase Proof</h2>
                            {proof && (
                                <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                                    <p className="text-xs font-semibold text-emerald-300">Proof already submitted</p>
                                    <p className="text-[11px] text-white/40 mt-1">
                                        Submitted on {new Date(proof.submittedAt).toLocaleString("en-IN")} · Hash {proof.invoiceHash.slice(0, 12)}...
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                        <span className={`px-2 py-1 rounded-md border ${proof.integrityChecked ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"}`}>
                                            {proof.integrityChecked ? "Invoice hash verified" : "Invoice hash mismatch"}
                                        </span>
                                        {proof.invoiceUrl && (
                                            <a
                                                href={proof.invoiceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2 py-1 rounded-md border border-white/15 text-white/70 hover:text-white hover:border-violet-500/40 transition-all"
                                            >
                                                View invoice
                                            </a>
                                        )}
                                    </div>
                                    {!proof.onchainProofUri && (
                                        <button
                                            disabled={!isOwner || proofSyncLoading}
                                            onClick={handleRetryOnchainProof}
                                            className="mt-3 w-full py-2.5 rounded-lg border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            {proofSyncLoading ? "Opening voting on-chain…" : "Retry Opening Voting On-Chain"}
                                        </button>
                                    )}
                                </div>
                            )}
                            {isUnderReview ? (
                                <p className="text-sm text-white/30 py-6 text-center">⏳ Proof submitted. Wait for voting.</p>
                            ) : !canSubmitProof ? (
                                <p className="text-sm text-white/30 py-6 text-center">This phase is {activeMilestone?.state?.toLowerCase()}.</p>
                            ) : (
                                <div className="space-y-4">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input type="checkbox" checked={isUnregistered} onChange={(e) => setIsUnregistered(e.target.checked)} className="accent-violet-500" />
                                        <span className="text-sm text-white/60">Vendor is unregistered (below ₹40L GST)</span>
                                    </label>
                                    {!isUnregistered && (
                                        <div>
                                            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Vendor GSTIN *</label>
                                            <input className={inputCls + " font-mono"} placeholder="e.g. 27AABCE1234F1Z5" value={gstin} maxLength={15} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
                                            <p className="text-[10px] text-white/20 mt-1">Validated via GST API</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Invoice No.</label>
                                            <input className={inputCls} placeholder="INV-2025-0042" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Amount (₹)</label>
                                            <input className={inputCls} type="number" placeholder="20000" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Voting Window</label>
                                        <div className="flex items-center gap-3">
                                            <input type="range" min={48} max={168} step={24} value={votingHours} onChange={(e) => setVotingHours(parseInt(e.target.value))} className="flex-1 accent-violet-500" />
                                            <span className="text-sm font-bold text-violet-400 min-w-[50px]">{votingHours}h</span>
                                        </div>
                                        <p className="text-[10px] text-white/20 mt-1">48h min · 168h max</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Invoice File *</label>
                                        <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-white/[0.08] rounded-xl cursor-pointer hover:border-violet-500/30 transition-all">
                                            <Upload size={18} className="text-white/25" />
                                            <span className="text-xs text-white/30">{invoiceFile ? invoiceFile.name : "Click to upload PDF, JPG, PNG"}</span>
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
                                        </label>
                                    </div>
                                    <button disabled={!isOwner || proofLoading || !invoiceFile || (!isUnregistered && !gstin)} onClick={handleSubmitProof}
                                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/20 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                        {proofLoading ? "Uploading & Validating…" : "Submit Proof & Open Voting"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: DPR updates */}
                    <div className="space-y-5">
                        <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-6">
                            <h2 className="text-sm font-bold flex items-center gap-2 mb-5"><Plus size={15} /> Post Activity Update</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Type</label>
                                    <select className={inputCls + " appearance-none"} value={updateType} onChange={(e) => setUpdateType(e.target.value)}>
                                        {UPDATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Title *</label>
                                    <input className={inputCls} placeholder="e.g. Venue deposit paid to Raj Events" value={updateTitle} onChange={(e) => setUpdateTitle(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Details</label>
                                <textarea className={inputCls + " min-h-[80px] resize-y"} placeholder="Additional context for donors…" value={updateDesc} onChange={(e) => setUpdateDesc(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Attach Photos / Files</label>
                                    <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-white/[0.08] rounded-xl cursor-pointer hover:border-violet-500/30 transition-all">
                                        <Upload size={16} className="text-white/25" />
                                        <span className="text-xs text-white/30">
                                            {updateFiles.length ? `${updateFiles.length} file(s) selected` : "Click to upload images/docs"}
                                        </span>
                                        <input
                                            type="file"
                                            multiple
                                            accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4"
                                            className="hidden"
                                            onChange={(e) => setUpdateFiles(Array.from(e.target.files ?? []))}
                                        />
                                    </label>
                                    {!!updateFiles.length && (
                                        <p className="text-[11px] text-white/35 mt-2 truncate">
                                            {updateFiles.map((file) => file.name).join(", ")}
                                        </p>
                                    )}
                                </div>
                                <button disabled={!isOwner || !canPostUpdate || updateLoading || !updateTitle.trim()} onClick={handlePostUpdate}
                                    className="w-full py-3 rounded-xl border border-violet-500/30 text-violet-300 font-semibold hover:bg-violet-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                    {updateLoading ? "Posting…" : !canPostUpdate ? "Phase Closed" : "📋 Post Update"}
                                </button>
                            </div>
                        </div>

                        <div className="bg-[#0f0f1a] border border-white/[0.06] rounded-2xl p-5">
                            <h3 className="text-sm font-bold mb-4">Activity Log</h3>
                            <DprTimeline updates={updates} title="" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
