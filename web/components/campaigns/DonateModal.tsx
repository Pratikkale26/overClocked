"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSendTransaction } from "@privy-io/react-auth/solana";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { toast } from "sonner";
import { ExternalLink, X, Zap } from "lucide-react";
import {
  getProgram, buildDonateTx, hexToProjectId, deriveProjectPDA,
} from "../../lib/anchor";
import { recordSolDonation, type Campaign } from "../../lib/api";
import { LAMPORTS_PER_SOL } from "../../lib/utils";

type Props = { campaign: Campaign; open: boolean; onClose: () => void; onSuccess?: () => void };

const QUICK = [0.1, 0.5, 1, 5];

export function DonateModal({ campaign, open, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const { user } = usePrivy();
  const { sendTransaction: sendPrivyTransaction } = useSendTransaction();
  const { connection } = useConnection();
  const { publicKey, sendTransaction: sendWalletAdapterTransaction } = useWallet();

  if (!open) return null;

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
  const walletAddr = publicKey?.toBase58() ?? user?.wallet?.address ?? linkedAddr;

  const resolveProjectPDA = (): PublicKey | null => {
    if (campaign.onchainProjectPda) return new PublicKey(campaign.onchainProjectPda);
    if (campaign.projectIdBytes && campaign.org?.walletAddress) {
      const [pda] = deriveProjectPDA(new PublicKey(campaign.org.walletAddress), hexToProjectId(campaign.projectIdBytes));
      return pda;
    }
    return null;
  };

  const onDonate = async () => {
    if (!walletAddr) { toast.error("Connect your wallet first"); return; }
    const projectPDA = resolveProjectPDA();
    if (!projectPDA) { toast.error("Campaign not yet on-chain"); return; }
    const amountSol = parseFloat(amount);
    if (!amountSol || amountSol <= 0) { toast.error("Enter a valid amount"); return; }

    setLoading(true);
    try {
      const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
      const provider = new AnchorProvider(connection, {} as never, { commitment: "confirmed" });
      const tx = await buildDonateTx(getProgram(provider), new PublicKey(walletAddr), projectPDA, lamports);
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.feePayer = new PublicKey(walletAddr);
      tx.recentBlockhash = blockhash;
      const sig = publicKey
        ? await sendWalletAdapterTransaction(tx, connection)
        : (await sendPrivyTransaction({ transaction: tx, connection, address: walletAddr })).signature;
      setTxSig(sig);
      try { await recordSolDonation({ campaignId: campaign.id, amountLamports: lamports, txSignature: sig, donorWallet: walletAddr }); }
      catch (e) { console.warn("Backend record failed (non-critical):", e); }
      toast.success("Donation sent! 🎉");
      onSuccess?.();
    } catch (e: unknown) {
      toast.error("Donation failed", { description: e instanceof Error ? e.message : "Transaction failed" });
    } finally { setLoading(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#0f0f1a] border border-white/[0.08] rounded-3xl p-8 animate-slideUp shadow-2xl shadow-black/50">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">Donate SOL</h3>
            <p className="text-sm text-white/40 mt-0.5">Funds go into an on-chain escrow vault</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
            <X size={16} />
          </button>
        </div>

        {txSig ? (
          /* Success state */
          <div className="text-center py-4">
            <div className="text-5xl mb-4">🎉</div>
            <p className="font-bold text-lg text-white mb-2">Donation Sent!</p>
            <a
              href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors mb-6"
            >
              <ExternalLink size={13} /> View on Solscan
            </a>
            <button onClick={() => { setTxSig(null); setAmount(""); onClose(); }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:brightness-110 transition-all">
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Amount input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Amount (SOL)</label>
              <input
                type="number" min="0.001" step="0.01" placeholder="0.0"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#161625] border border-white/[0.08] text-white text-base font-semibold placeholder-white/20 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {QUICK.map((v) => (
                <button key={v} onClick={() => setAmount(v.toString())}
                  className={`py-2 rounded-lg text-sm font-semibold border transition-all ${amount === v.toString()
                      ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                      : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:bg-white/[0.07] hover:text-white/70"
                    }`}>
                  {v}
                </button>
              ))}
            </div>

            {!walletAddr && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-amber-400 text-sm mb-4">
                <Zap size={14} /> Connect your wallet to donate
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={onClose}
                className="px-5 py-3 rounded-xl border border-white/[0.08] text-white/50 text-sm font-semibold hover:bg-white/5 transition-all">
                Cancel
              </button>
              <button onClick={onDonate} disabled={loading || !amount || !walletAddr}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/20">
                {loading ? "Sending…" : `Donate ${amount || "0"} SOL`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
