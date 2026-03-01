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

const inputCls = "w-full px-4 py-3.5 rounded-xl bg-[#F8F7F4] border border-[#E4E2DC] text-[#1A1F2E] text-base placeholder-[#1A1F2E]/25 focus:outline-none focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F]/20 transition-all duration-150 min-h-[48px]";

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
        if (!activeMilestone) { setUpdates([]); setProof(null); return; }
        (async () => {
            const [u, p] = await Promise.allSettled([fetchMilestoneUpdates(activeMilestone.id), fetchMilestoneProof(activeMilestone.id)]);
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
        if (!signerAddr) { toast.error("Connect your creator wallet first"); return; }
        if (!currentCampaign.onchainProjectPda && !(currentCampaign.projectIdBytes && currentCampaign.org?.walletAddress)) { toast.error("Campaign is missing on-chain project reference"); return; }
        setProofLoading(true);
        try {
            const { uploadUrl, s3Key } = await presignProofUpload(activeMilestone.id, invoiceFile.name, invoiceFile.type);
            const putRes = await fetch(uploadUrl, { method: "PUT", body: invoiceFile, headers: { "Content-Type": invoiceFile.type } });
            if (!putRes.ok) { const detail = await putRes.text().catch(() => ""); throw new Error(`File upload failed (${putRes.status})${detail ? `: ${detail}` : ""}`); }
            const proofResult = await submitMilestoneProof(activeMilestone.id, {
                gstin: isUnregistered ? undefined : gstin.toUpperCase().trim(), isUnregisteredVendor: isUnregistered, invoiceS3Key: s3Key,
                invoiceNumber: invoiceNumber || undefined, invoiceAmountPaise: invoiceAmount ? Math.round(parseFloat(invoiceAmount) * 100) : undefined,
                votingWindowSecs: votingHours * 3600,
            });
            const projectPda = currentCampaign.onchainProjectPda
                ? new PublicKey(currentCampaign.onchainProjectPda)
                : (() => { const [pda] = deriveProjectPDA(new PublicKey(currentCampaign.org.walletAddress!), hexToProjectId(currentCampaign.projectIdBytes!)); return pda; })();
            const creatorPk = new PublicKey(signerAddr);
            const provider = new AnchorProvider(connection, {} as never, { commitment: "confirmed" });
            const orgGstinHashBytes = isUnregistered ? new Array(32).fill(0) : currentCampaign.org.gstin ? await sha256Bytes(currentCampaign.org.gstin.trim().toUpperCase()) : (() => { throw new Error("Org GSTIN missing"); })();
            const tx = await buildSubmitMilestoneProofTx(getProgram(provider), creatorPk, projectPda, activeMilestone.index, s3Key, String((proofResult as { invoiceHash: string }).invoiceHash), orgGstinHashBytes, Number((proofResult as { votingWindowSecs: number }).votingWindowSecs ?? votingHours * 3600));
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            tx.feePayer = creatorPk; tx.recentBlockhash = blockhash;
            let proofSig: string | undefined;
            if (publicKey && publicKey.toBase58() === signerAddr) { proofSig = await sendWalletAdapterTransaction(tx, connection); }
            else { const stdWallet = connectedStandardWallets.find((w) => w.address.toLowerCase() === signerAddr.toLowerCase()); if (stdWallet) { await signAndSendTransaction({ transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }), wallet: stdWallet, chain: "solana:devnet" }); } else { const receipt = await sendPrivyTransaction({ transaction: tx, connection, address: signerAddr }); proofSig = receipt.signature; } }
            await confirmMilestoneProofOnchain(activeMilestone.id, { onchainProofUri: s3Key, txSignature: proofSig });
            toast.success("Proof submitted!", { description: `Voting open for ${votingHours}h.` });
            await load(); setProof(await fetchMilestoneProof(activeMilestone.id));
        } catch (e: unknown) { toast.error("Proof submission failed", { description: e instanceof Error ? e.message : "Error" }); } finally { setProofLoading(false); }
    };

    const handleRetryOnchainProof = async () => {
        if (!activeMilestone || !proof) return;
        const currentCampaign = campaign; if (!currentCampaign) return;
        const proofUri = proof.invoiceS3Key ?? activeMilestone.proofUri;
        if (!proofUri || !proof.invoiceHash) { toast.error("Missing proof data"); return; }
        const signerAddr = publicKey?.toBase58() ?? linkedAddr ?? user?.wallet?.address;
        if (!signerAddr) { toast.error("Connect your creator wallet first"); return; }
        if (!currentCampaign.onchainProjectPda && !(currentCampaign.projectIdBytes && currentCampaign.org?.walletAddress)) { toast.error("Campaign is missing on-chain project reference"); return; }
        setProofSyncLoading(true);
        try {
            const orgGstinHashBytes = proof.isUnregisteredVendor ? new Array(32).fill(0) : currentCampaign.org.gstin ? await sha256Bytes(currentCampaign.org.gstin.trim().toUpperCase()) : (() => { throw new Error("Org GSTIN missing"); })();
            const projectPda = currentCampaign.onchainProjectPda
                ? new PublicKey(currentCampaign.onchainProjectPda)
                : (() => { const [pda] = deriveProjectPDA(new PublicKey(currentCampaign.org.walletAddress!), hexToProjectId(currentCampaign.projectIdBytes!)); return pda; })();
            const creatorPk = new PublicKey(signerAddr);
            const provider = new AnchorProvider(connection, {} as never, { commitment: "confirmed" });
            const tx = await buildSubmitMilestoneProofTx(getProgram(provider), creatorPk, projectPda, activeMilestone.index, proofUri, proof.invoiceHash, orgGstinHashBytes, activeMilestone.votingWindowSecs);
            const { blockhash } = await connection.getLatestBlockhash("confirmed"); tx.feePayer = creatorPk; tx.recentBlockhash = blockhash;
            let proofSig: string | undefined;
            if (publicKey && publicKey.toBase58() === signerAddr) { proofSig = await sendWalletAdapterTransaction(tx, connection); }
            else { const stdWallet = connectedStandardWallets.find((w) => w.address.toLowerCase() === signerAddr.toLowerCase()); if (stdWallet) { await signAndSendTransaction({ transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }), wallet: stdWallet, chain: "solana:devnet" }); } else { const receipt = await sendPrivyTransaction({ transaction: tx, connection, address: signerAddr }); proofSig = receipt.signature; } }
            await confirmMilestoneProofOnchain(activeMilestone.id, { onchainProofUri: proofUri, txSignature: proofSig });
            toast.success("Voting opened on-chain"); await load(); setProof(await fetchMilestoneProof(activeMilestone.id));
        } catch (e: unknown) { toast.error("On-chain proof sync failed", { description: e instanceof Error ? e.message : "Error" }); } finally { setProofSyncLoading(false); }
    };

    const handlePostUpdate = async () => {
        if (!activeMilestone || !updateTitle.trim()) return;
        setUpdateLoading(true);
        try {
            const mediaKeys: string[] = [];
            for (const file of updateFiles) {
                const { uploadUrl, s3Key } = await presignUpdateMedia(activeMilestone.id, file.name, file.type || "application/octet-stream");
                const putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
                if (!putRes.ok) { const detail = await putRes.text().catch(() => ""); throw new Error(`Media upload failed (${putRes.status})${detail ? `: ${detail}` : ""}`); }
                mediaKeys.push(s3Key);
            }
            await postMilestoneUpdate(activeMilestone.id, { type: updateType, title: updateTitle.trim(), description: updateDesc.trim() || undefined, mediaUrls: mediaKeys });
            toast.success("Update posted!"); setUpdateTitle(""); setUpdateDesc(""); setUpdateFiles([]);
            setUpdates(await fetchMilestoneUpdates(activeMilestone.id));
        } catch (e: unknown) { toast.error("Failed", { description: e instanceof Error ? e.message : "Error" }); } finally { setUpdateLoading(false); }
    };

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]"><Navbar />
                <div className="mx-auto max-w-[1200px] px-8 pt-32 text-center">
                    <div className="text-6xl mb-6">🔐</div>
                    <h2 className="text-2xl font-bold mb-4">Sign in to manage</h2>
                    <button onClick={() => login()} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base hover:bg-[#245A42] transition-all duration-150 min-h-[48px]">
                        <Wallet size={18} /> Connect
                    </button>
                </div>
            </div>
        );
    }

    if (loading) return <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]"><Navbar /><main className="mx-auto max-w-[1200px] px-8 pt-16"><div className="skeleton h-64 rounded-xl" /></main></div>;
    if (!campaign) return <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]"><Navbar /><main className="mx-auto max-w-[1200px] px-8 pt-24 text-center"><h2 className="text-2xl font-bold">Campaign not found</h2></main></div>;

    const linkedSolanaAccount = user?.linkedAccounts?.find(
        (account) => account.type === "wallet" && "chainType" in account && account.chainType === "solana"
    );
    const linkedAddr =
        linkedSolanaAccount && "address" in linkedSolanaAccount && typeof linkedSolanaAccount.address === "string"
            ? linkedSolanaAccount.address : undefined;
    const connectedWallet = publicKey?.toBase58() ?? user?.wallet?.address ?? linkedAddr;
    const isOwner = Boolean(connectedWallet && campaign?.org?.walletAddress && connectedWallet.toLowerCase() === campaign.org.walletAddress.toLowerCase());
    const canSubmitProof = activeMilestone?.state === "PENDING" && !proof;
    const isUnderReview = activeMilestone?.state === "UNDER_REVIEW";
    const canPostUpdate = activeMilestone?.state === "PENDING" || activeMilestone?.state === "UNDER_REVIEW";

    return (
        <div className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E]">
            <Navbar />

            <main className="mx-auto max-w-[1200px] px-8 pt-12 pb-24">
                <Link href={`/campaign/${id}`}>
                    <button className="flex items-center gap-2 text-base text-[#1A1F2E]/40 hover:text-[#1A1F2E]/70 transition-colors duration-150 mb-6 min-h-[44px]">
                        <ArrowLeft size={16} /> Back to Campaign
                    </button>
                </Link>
                <h1 className="text-4xl font-bold tracking-[-0.03em] text-[#1A1F2E] mb-2">Manage Campaign</h1>
                <p className="text-base text-[#1A1F2E]/40 mb-12">{campaign.title}</p>

                {!isOwner && (
                    <div className="mb-8 rounded-xl border border-[#C2850C]/30 bg-[#C2850C]/[0.06] px-6 py-4 text-base text-[#C2850C]">
                        You are signed in, but this wallet is not the campaign owner wallet. Management actions are blocked.
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                    {/* Left: proof */}
                    <div className="space-y-6">
                        {activeMilestone && (
                            <div className={`p-6 rounded-xl border ${isUnderReview ? "bg-[#C2850C]/[0.04] border-[#C2850C]/20" : "bg-[#2D6A4F]/[0.04] border-[#2D6A4F]/20"}`}>
                                <p className={`text-sm font-bold uppercase tracking-widest mb-2 ${isUnderReview ? "text-[#C2850C]" : "text-[#2D6A4F]"}`}>
                                    {isUnderReview ? "Voting in progress" : "Active Phase"}
                                </p>
                                <p className="font-bold text-base">Phase {activeMilestone.index + 1}: {activeMilestone.title}</p>
                                {isUnderReview && <p className="text-sm text-[#1A1F2E]/40 mt-2">Donors are reviewing your proof and voting.</p>}
                            </div>
                        )}
                        {!!campaign.milestones?.length && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {campaign.milestones.map((m) => {
                                    const active = activeMilestone?.id === m.id;
                                    return (
                                        <button key={m.id} onClick={() => setActiveMilestone(m)}
                                            className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-150 min-h-[44px] ${active
                                                ? "bg-[#2D6A4F]/10 border-[#2D6A4F]/30 text-[#2D6A4F]"
                                                : "bg-[#F0EFEB] border-[#E4E2DC] text-[#1A1F2E]/45 hover:text-[#1A1F2E]/75"}`}>
                                            Phase {m.index + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
                            <h2 className="text-base font-bold flex items-center gap-2 mb-6"><FileText size={18} /> Submit Phase Proof</h2>
                            {proof && (
                                <div className="mb-6 rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/[0.04] p-6">
                                    <p className="text-sm font-semibold text-[#2D6A4F]">Proof already submitted</p>
                                    <p className="text-sm text-[#1A1F2E]/40 mt-2">
                                        Submitted on {new Date(proof.submittedAt).toLocaleString("en-IN")} · Hash <span className="font-['DM_Mono']">{proof.invoiceHash.slice(0, 12)}...</span>
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                                        <span className={`px-3 py-1.5 rounded-lg border ${proof.integrityChecked ? "border-[#2D6A4F]/30 text-[#2D6A4F]" : "border-[#C2850C]/30 text-[#C2850C]"}`}>
                                            {proof.integrityChecked ? "Invoice hash verified" : "Invoice hash mismatch"}
                                        </span>
                                        {proof.invoiceUrl && (
                                            <a href={proof.invoiceUrl} target="_blank" rel="noreferrer"
                                                className="px-3 py-1.5 rounded-lg border border-[#E4E2DC] text-[#1A1F2E]/60 hover:text-[#1A1F2E] hover:border-[#2D6A4F]/40 transition-all duration-150">
                                                View invoice
                                            </a>
                                        )}
                                    </div>
                                    {!proof.onchainProofUri && (
                                        <button disabled={!isOwner || proofSyncLoading} onClick={handleRetryOnchainProof}
                                            className="mt-4 w-full py-3 rounded-xl border border-[#C2850C]/30 text-[#C2850C] text-sm font-semibold hover:bg-[#C2850C]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[44px]">
                                            {proofSyncLoading ? "Opening voting on-chain…" : "Retry Opening Voting On-Chain"}
                                        </button>
                                    )}
                                </div>
                            )}
                            {isUnderReview ? (
                                <p className="text-base text-[#1A1F2E]/30 py-8 text-center">⏳ Proof submitted. Wait for voting.</p>
                            ) : !canSubmitProof ? (
                                <p className="text-base text-[#1A1F2E]/30 py-8 text-center">This phase is {activeMilestone?.state?.toLowerCase()}.</p>
                            ) : (
                                <div className="space-y-6">
                                    <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                                        <input type="checkbox" checked={isUnregistered} onChange={(e) => setIsUnregistered(e.target.checked)} className="w-5 h-5 accent-[#2D6A4F]" />
                                        <span className="text-base text-[#1A1F2E]/60">Vendor is unregistered (below ₹40L GST)</span>
                                    </label>
                                    {!isUnregistered && (
                                        <div>
                                            <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">Vendor GSTIN *</label>
                                            <input className={inputCls + " font-['DM_Mono']"} placeholder="e.g. 27AABCE1234F1Z5" value={gstin} maxLength={15} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
                                            <p className="text-sm text-[#1A1F2E]/25 mt-2">Validated via GST API</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">Invoice No.</label>
                                            <input className={inputCls} placeholder="INV-2025-0042" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">Amount (₹)</label>
                                            <input className={inputCls} type="number" placeholder="20000" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">Voting Window</label>
                                        <div className="flex items-center gap-4">
                                            <input type="range" min={48} max={168} step={24} value={votingHours} onChange={(e) => setVotingHours(parseInt(e.target.value))} className="flex-1 accent-[#2D6A4F] h-2" />
                                            <span className="text-base font-bold text-[#2D6A4F] min-w-[56px]">{votingHours}h</span>
                                        </div>
                                        <p className="text-sm text-[#1A1F2E]/25 mt-2">48h min · 168h max</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">Invoice File *</label>
                                        <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-[#E4E2DC] rounded-xl cursor-pointer hover:border-[#2D6A4F]/30 transition-all duration-150">
                                            <Upload size={24} className="text-[#1A1F2E]/25" />
                                            <span className="text-sm text-[#1A1F2E]/30">{invoiceFile ? invoiceFile.name : "Click to upload PDF, JPG, PNG"}</span>
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} />
                                        </label>
                                    </div>
                                    <button disabled={!isOwner || proofLoading || !invoiceFile || (!isUnregistered && !gstin)} onClick={handleSubmitProof}
                                        className="w-full py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base hover:bg-[#245A42] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[48px]">
                                        {proofLoading ? "Uploading & Validating…" : "Submit Proof & Open Voting"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: DPR updates */}
                    <div className="space-y-6">
                        <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
                            <h2 className="text-base font-bold flex items-center gap-2 mb-6"><Plus size={18} /> Post Activity Update</h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">Type</label>
                                    <select className={inputCls + " appearance-none"} value={updateType} onChange={(e) => setUpdateType(e.target.value)}>
                                        {UPDATE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">Title *</label>
                                    <input className={inputCls} placeholder="e.g. Venue deposit paid to Raj Events" value={updateTitle} onChange={(e) => setUpdateTitle(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">Details</label>
                                    <textarea className={inputCls + " min-h-[100px] resize-y"} placeholder="Additional context for donors…" value={updateDesc} onChange={(e) => setUpdateDesc(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">Attach Photos / Files</label>
                                    <label className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-[#E4E2DC] rounded-xl cursor-pointer hover:border-[#2D6A4F]/30 transition-all duration-150">
                                        <Upload size={20} className="text-[#1A1F2E]/25" />
                                        <span className="text-sm text-[#1A1F2E]/30">
                                            {updateFiles.length ? `${updateFiles.length} file(s) selected` : "Click to upload images/docs"}
                                        </span>
                                        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4" className="hidden"
                                            onChange={(e) => setUpdateFiles(Array.from(e.target.files ?? []))} />
                                    </label>
                                    {!!updateFiles.length && (
                                        <p className="text-sm text-[#1A1F2E]/35 mt-2 truncate">{updateFiles.map((f) => f.name).join(", ")}</p>
                                    )}
                                </div>
                                <button disabled={!isOwner || !canPostUpdate || updateLoading || !updateTitle.trim()} onClick={handlePostUpdate}
                                    className="w-full py-3.5 rounded-xl border border-[#2D6A4F]/30 text-[#2D6A4F] font-semibold text-base hover:bg-[#2D6A4F]/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[48px]">
                                    {updateLoading ? "Posting…" : !canPostUpdate ? "Phase Closed" : "Post Update"}
                                </button>
                            </div>
                        </div>

                        <div className="bg-white border border-[#E4E2DC] rounded-xl p-8 shadow-[0_4px_12px_rgba(26,31,46,0.06)]">
                            <h3 className="text-base font-bold mb-6">Activity Log</h3>
                            <DprTimeline updates={updates} title="" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
