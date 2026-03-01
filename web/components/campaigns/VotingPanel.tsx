"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
    const [voteBlockReason, setVoteBlockReason] = useState<string | null>(null);
    const { user } = usePrivy();
    const { sendTransaction: sendPrivyTransaction } = useSendTransaction();
    const { wallets: connectedStandardWallets } = useConnectedStandardWallets();
    const { signAndSendTransaction } = useStandardSignAndSendTransaction();
    const { connection } = useConnection();
    const { publicKey, sendTransaction: sendWalletAdapterTransaction } = useWallet();

    if (milestone.state !== "UNDER_REVIEW") return null;

    const linkedSolanaAccount = user?.linkedAccounts?.find(
        (account) =>
            account.type === "wallet" &&
            "chainType" in account &&
            account.chainType === "solana"
    );
    const linkedAddr =
        linkedSolanaAccount &&
            "address" in linkedSolanaAccount &&
            typeof linkedSolanaAccount.address === "string"
            ? linkedSolanaAccount.address
            : undefined;
    const isValidSolanaAddress = (value?: string): value is string => {
        if (!value) return false;
        try {
            new PublicKey(value);
            return true;
        } catch {
            return false;
        }
    };

    const privyActiveWalletAddr = isValidSolanaAddress(user?.wallet?.address)
        ? user.wallet.address
        : undefined;
    const walletAdapterAddr = publicKey?.toBase58();
    const connectedStandardWallet = useMemo(() => {
        if (!connectedStandardWallets.length) return null;
        const matchByLinked = linkedAddr
            ? connectedStandardWallets.find(
                (wallet) => wallet.address.toLowerCase() === linkedAddr.toLowerCase()
            )
            : undefined;
        if (matchByLinked) return matchByLinked;
        const matchByActive = privyActiveWalletAddr
            ? connectedStandardWallets.find(
                (wallet) => wallet.address.toLowerCase() === privyActiveWalletAddr.toLowerCase()
            )
            : undefined;
        return matchByActive ?? null;
    }, [connectedStandardWallets, linkedAddr, privyActiveWalletAddr]);
    const signerWalletAddr =
        walletAdapterAddr ??
        connectedStandardWallet?.address ??
        privyActiveWalletAddr ??
        linkedAddr;
    const displayWalletAddr = walletAdapterAddr ?? linkedAddr ?? privyActiveWalletAddr;

    const voterPublicKey = useMemo(() => {
        if (!signerWalletAddr) return null;
        try {
            return new PublicKey(signerWalletAddr);
        } catch {
            return null;
        }
    }, [signerWalletAddr]);

    const resolvePDA = useCallback((): PublicKey | null => {
        if (campaign.onchainProjectPda) return new PublicKey(campaign.onchainProjectPda);
        if (campaign.projectIdBytes && campaign.org?.walletAddress) {
            const [pda] = deriveProjectPDA(new PublicKey(campaign.org.walletAddress), hexToProjectId(campaign.projectIdBytes));
            return pda;
        }
        return null;
    }, [campaign.onchainProjectPda, campaign.projectIdBytes, campaign.org?.walletAddress]);

    const toBigIntSafe = (value: unknown): bigint | null => {
        try {
            if (typeof value === "bigint") return value;
            if (typeof value === "number") return BigInt(Math.trunc(value));
            if (typeof value === "string") return BigInt(value);
            if (value && typeof value === "object" && "toString" in value) {
                return BigInt((value as { toString: () => string }).toString());
            }
        } catch {
            return null;
        }
        return null;
    };

    const isUnderReviewState = (value: unknown): boolean => {
        if (!value) return false;
        if (typeof value === "string") return value.toLowerCase() === "underreview";
        if (typeof value === "object") {
            const firstKey = Object.keys(value as Record<string, unknown>)[0];
            return firstKey?.toLowerCase() === "underreview";
        }
        return false;
    };

    useEffect(() => {
        const run = async () => {
            const pda = resolvePDA();
            if (!pda) return;
            try {
                const provider = new AnchorProvider(connection, {} as never, { commitment: "confirmed" });
                const program = getProgram(provider);
                const project = await fetchProjectAccount(program, pda);
                if (project?.milestones?.[milestone.index]) {
                    const m = project.milestones[milestone.index];
                    setTally({ yes: Number(m.voteYes) / LAMPORTS_PER_SOL, no: Number(m.voteNo) / LAMPORTS_PER_SOL, eligible: Number(m.totalEligible) / LAMPORTS_PER_SOL });
                    const now = BigInt(Math.floor(Date.now() / 1000));
                    const votingStart = toBigIntSafe((m as { votingStart?: unknown }).votingStart);
                    const votingEnd = toBigIntSafe((m as { votingEnd?: unknown }).votingEnd);
                    if (!isUnderReviewState((m as { state?: unknown }).state)) {
                        setVoteBlockReason("Voting is not open on-chain for this milestone.");
                    } else if (votingStart !== null && now < votingStart) {
                        setVoteBlockReason("Voting window has not started yet on-chain.");
                    } else if (votingEnd !== null && now > votingEnd) {
                        setVoteBlockReason("Voting window has already ended on-chain.");
                    } else {
                        setVoteBlockReason(null);
                    }
                }
                if (voterPublicKey) {
                    const rec = await fetchDonorRecord(program, pda, voterPublicKey);
                    if (!rec) {
                        setVoteBlockReason("You need to donate first with this wallet to vote.");
                    } else if (project?.milestones?.[milestone.index]) {
                        const m = project.milestones[milestone.index] as { revisionCount?: unknown };
                        const revisionCount = Number(m.revisionCount ?? 0);
                        const bitIndex = milestone.index + revisionCount * 8;
                        const votedBitmap = toBigIntSafe((rec as { votedBitmap?: unknown }).votedBitmap) ?? BigInt(0);
                        if (bitIndex >= 0 && bitIndex < 64) {
                            const hasVoted = ((votedBitmap >> BigInt(bitIndex)) & BigInt(1)) === BigInt(1);
                            if (hasVoted) {
                                setVoted(true);
                                setVoteBlockReason("You already voted for this review round.");
                            }
                        }
                    }
                }
            } catch { /* read-only fail is ok */ }
        };
        run();
    }, [connection, resolvePDA, milestone.index, voterPublicKey]);

    const totalVotes = (tally?.yes ?? 0) + (tally?.no ?? 0);
    const yesPct = totalVotes > 0 ? ((tally?.yes ?? 0) / totalVotes) * 100 : 0;

    const vote = async (approve: boolean) => {
        if (!voterPublicKey || !signerWalletAddr) { toast.error("Connect a Solana wallet to vote"); return; }
        if (voteBlockReason) { toast.error("Cannot vote", { description: voteBlockReason }); return; }
        const pda = resolvePDA();
        if (!pda) { toast.error("Campaign not yet on-chain"); return; }
        setLoading(true);
        try {
            const provider = new AnchorProvider(connection, {} as never, { commitment: "confirmed" });
            const program = getProgram(provider);
            const project = await fetchProjectAccount(program, pda);
            const projectMilestone = project?.milestones?.[milestone.index] as
                | { state?: unknown; votingStart?: unknown; votingEnd?: unknown; revisionCount?: unknown }
                | undefined;
            if (!projectMilestone) {
                toast.error("Vote failed", { description: "Milestone not found on-chain." });
                return;
            }
            const now = BigInt(Math.floor(Date.now() / 1000));
            const votingStart = toBigIntSafe(projectMilestone.votingStart);
            const votingEnd = toBigIntSafe(projectMilestone.votingEnd);
            if (!isUnderReviewState(projectMilestone.state)) {
                toast.error("Vote failed", { description: "Voting is not open on-chain for this milestone." });
                return;
            }
            if (votingStart !== null && now < votingStart) {
                toast.error("Vote failed", { description: "Voting window has not started yet." });
                return;
            }
            if (votingEnd !== null && now > votingEnd) {
                toast.error("Vote failed", { description: "Voting window has ended." });
                return;
            }

            const donorRecord = await fetchDonorRecord(program, pda, voterPublicKey);
            if (!donorRecord) {
                toast.error("You need to donate first with this wallet to vote");
                return;
            }
            const revisionCount = Number(projectMilestone.revisionCount ?? 0);
            const bitIndex = milestone.index + revisionCount * 8;
            const votedBitmap = toBigIntSafe((donorRecord as { votedBitmap?: unknown }).votedBitmap) ?? BigInt(0);
            if (bitIndex >= 0 && bitIndex < 64) {
                const hasVoted = ((votedBitmap >> BigInt(bitIndex)) & BigInt(1)) === BigInt(1);
                if (hasVoted) {
                    setVoted(true);
                    toast.info("Already voted");
                    return;
                }
            }

            const tx = await buildVoteMilestoneTx(program, voterPublicKey, pda, milestone.index, approve);
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            tx.feePayer = voterPublicKey;
            tx.recentBlockhash = blockhash;
            if (publicKey) {
                await sendWalletAdapterTransaction(tx, connection);
            } else if (connectedStandardWallet) {
                await signAndSendTransaction({
                    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
                    wallet: connectedStandardWallet,
                    chain: "solana:devnet",
                });
            } else if (privyActiveWalletAddr && signerWalletAddr === privyActiveWalletAddr) {
                await sendPrivyTransaction({ transaction: tx, connection, address: signerWalletAddr });
            } else {
                toast.error("Vote failed", {
                    description: "No signer available for this wallet. Reconnect Phantom from the Privy wallet picker and try again.",
                });
                return;
            }
            setVoted(true);
            toast.success(approve ? "Voted YES ✅" : "Voted NO ❌", { description: "Stake-weighted vote recorded on-chain." });
            onVoted?.();
        } catch (e: unknown) {
            const msg = e instanceof Error
                ? e.message
                : (typeof e === "string" ? e : JSON.stringify(e));
            if (msg.includes("AlreadyVoted")) { setVoted(true); toast.info("Already voted"); }
            else if (msg.includes("NoDonorRecord")) { toast.error("You need to donate first to vote"); }
            else if (msg.includes("No wallet found for address")) {
                toast.error("Vote failed", {
                    description: "Connected wallet mismatch. Reconnect your Phantom wallet in Privy and try again.",
                });
            }
            else if (msg.includes("Unexpected error")) { toast.error("Vote failed", { description: "Privy wallet session mismatch. Re-open wallet picker and select your donor wallet." }); }
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
                    <button disabled={loading || !displayWalletAddr} onClick={() => vote(true)}
                        className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold hover:bg-emerald-500/20 disabled:opacity-40 transition-all">
                        <ThumbsUp size={15} /> {loading ? "Signing…" : "Approve"}
                    </button>
                    <button disabled={loading || !displayWalletAddr} onClick={() => vote(false)}
                        className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 font-bold hover:bg-red-500/15 disabled:opacity-40 transition-all">
                        <ThumbsDown size={15} /> {loading ? "Signing…" : "Reject"}
                    </button>
                </div>
            )}
        </div>
    );
}
