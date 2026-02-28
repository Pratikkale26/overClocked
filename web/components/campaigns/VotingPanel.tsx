"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, CheckCircle, Shield, AlertCircle } from "lucide-react";
import type { Milestone, MilestoneProof, Campaign } from "../../lib/api";
import { formatSol, LAMPORTS_PER_SOL } from "../../lib/utils";
import {
    getProgram, buildVoteMilestoneTx, fetchProjectAccount,
    fetchDonorRecord, hexToProjectId, deriveProjectPDA,
} from "../../lib/anchor";

interface Props {
    milestone: Milestone;
    proof: MilestoneProof | null;
    campaign: Campaign;
    onVoted?: () => void;
}

export function VotingPanel({ milestone, proof, campaign, onVoted }: Props) {
    const [voted, setVoted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [tally, setTally] = useState<{ yes: number; no: number; eligible: number } | null>(null);
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    if (milestone.state !== "UNDER_REVIEW") return null;

    const walletAddr = publicKey?.toBase58();

    const resolvePDA = useCallback((): PublicKey | null => {
        if (campaign.onchainProjectPda) return new PublicKey(campaign.onchainProjectPda);
        if (campaign.projectIdBytes && campaign.org?.walletAddress) {
            const [pda] = deriveProjectPDA(new PublicKey(campaign.org.walletAddress), hexToProjectId(campaign.projectIdBytes));
            return pda;
        }
        return null;
    }, [campaign.onchainProjectPda, campaign.projectIdBytes, campaign.org?.walletAddress]);

    useEffect(() => {
        const run = async () => {
            const pda = resolvePDA();
            if (!pda) return;
            try {
                const provider = new AnchorProvider(connection, {} as any, { commitment: "confirmed" });
                const program = getProgram(provider);
                const project = await fetchProjectAccount(program, pda);
                if (project?.milestones?.[milestone.index]) {
                    const m = project.milestones[milestone.index];
                    setTally({ yes: Number(m.voteYes) / LAMPORTS_PER_SOL, no: Number(m.voteNo) / LAMPORTS_PER_SOL, eligible: Number(m.totalEligible) / LAMPORTS_PER_SOL });
                }
                if (walletAddr) {
                    const rec = await fetchDonorRecord(program, pda, new PublicKey(walletAddr));
                    if (rec && (Number(rec.votedBitmap) & (1 << milestone.index)) !== 0) setVoted(true);
                }
            } catch { /* read-only fail is ok */ }
        };
        run();
    }, [connection, resolvePDA, milestone.index, walletAddr]);

    const totalVotes = (tally?.yes ?? 0) + (tally?.no ?? 0);
    const yesPct = totalVotes > 0 ? ((tally?.yes ?? 0) / totalVotes) * 100 : 0;

    const vote = async (approve: boolean) => {
        if (!walletAddr) { toast.error("Connect your wallet to vote"); return; }
        const pda = resolvePDA();
        if (!pda) { toast.error("Campaign not yet on-chain"); return; }
        setLoading(true);
        try {
            const provider = new AnchorProvider(connection, {} as any, { commitment: "confirmed" });
            const tx = await buildVoteMilestoneTx(getProgram(provider), new PublicKey(walletAddr), pda, milestone.index, approve);
            await sendTransaction(tx, connection);
            setVoted(true);
            toast.success(approve ? "Voted YES ✅" : "Voted NO ❌", { description: "Stake-weighted vote recorded on-chain." });
            onVoted?.();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Transaction failed";
            if (msg.includes("AlreadyVoted")) { setVoted(true); toast.info("Already voted"); }
            else if (msg.includes("NoDonorRecord")) { toast.error("You need to donate first to vote"); }
            else { toast.error("Vote failed", { description: msg }); }
        } finally { setLoading(false); }
    };

    return (
        <div className="border border-amber-500/25 bg-amber-500/[0.03] rounded-2xl p-6 mb-6">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse" />
                <h3 className="text-base font-bold text-amber-400">
                    Voting Open — Phase {milestone.index + 1}: {milestone.title}
                </h3>
            </div>

            {/* Proof summary */}
            {proof && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-5 space-y-2">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Submitted proof</p>
                    <div className="flex items-center gap-2">
                        {proof.gstinVerified ? <Shield size={13} className="text-emerald-400 shrink-0" /> : proof.isUnregisteredVendor ? <AlertCircle size={13} className="text-amber-400 shrink-0" /> : null}
                        <span className="text-sm">
                            {proof.isUnregisteredVendor
                                ? <span className="text-amber-400">Unregistered vendor (below GST threshold)</span>
                                : proof.gstinVerified
                                    ? <><span className="text-emerald-400 font-semibold">{proof.vendorLegalName}</span><span className="text-white/30 text-xs ml-2">{proof.gstin}</span></>
                                    : <span className="text-white/30">GSTIN pending</span>}
                        </span>
                    </div>
                    {proof.invoiceNumber && (
                        <p className="text-xs text-white/30">Invoice #{proof.invoiceNumber}{proof.invoiceAmountPaise ? ` · ₹${(Number(proof.invoiceAmountPaise) / 100).toLocaleString("en-IN")}` : ""}</p>
                    )}
                    <p className="text-[10px] font-mono text-white/20">SHA-256: {proof.invoiceHash?.slice(0, 24)}…</p>
                </div>
            )}

            {/* Tally */}
            <div className="mb-5">
                <div className="flex justify-between text-sm font-semibold mb-2">
                    <span className="text-emerald-400">YES {tally ? tally.yes.toFixed(2) : "—"} SOL ({yesPct.toFixed(0)}%)</span>
                    <span className="text-red-400">NO {tally ? tally.no.toFixed(2) : "—"} SOL</span>
                </div>
                <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700 progress-glow" style={{ width: `${yesPct}%` }} />
                </div>
                <p className="text-xs text-white/30 mt-2">
                    {tally ? `${tally.eligible.toFixed(2)} SOL eligible` : formatSol(campaign.raisedLamports) + " total"} · 51% threshold · 10% quorum
                </p>
            </div>

            {/* Buttons */}
            {voted ? (
                <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-emerald-400 font-semibold text-sm">
                    <CheckCircle size={16} /> Vote recorded on-chain. Weight = your donated SOL.
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <button disabled={loading || !walletAddr} onClick={() => vote(true)}
                        className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold hover:bg-emerald-500/20 disabled:opacity-40 transition-all">
                        <ThumbsUp size={15} /> {loading ? "Signing…" : "Approve"}
                    </button>
                    <button disabled={loading || !walletAddr} onClick={() => vote(false)}
                        className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 font-bold hover:bg-red-500/15 disabled:opacity-40 transition-all">
                        <ThumbsDown size={15} /> {loading ? "Signing…" : "Reject"}
                    </button>
                </div>
            )}
        </div>
    );
}
