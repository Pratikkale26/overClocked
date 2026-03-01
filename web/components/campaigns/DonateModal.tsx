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
    (account) => account.type === "wallet" && "chainType" in account && account.chainType === "solana"
  );
  const linkedAddr =
    linkedSolanaAccount && "address" in linkedSolanaAccount && typeof linkedSolanaAccount.address === "string"
      ? linkedSolanaAccount.address : undefined;
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
      tx.feePayer = new PublicKey(walletAddr); tx.recentBlockhash = blockhash;
      const sig = publicKey
        ? await sendWalletAdapterTransaction(tx, connection)
        : (await sendPrivyTransaction({ transaction: tx, connection, address: walletAddr })).signature;
      const latest = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({ signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, "confirmed");
      setTxSig(sig);
      try { await recordSolDonation({ campaignId: campaign.id, amountLamports: lamports, txSignature: sig, donorWallet: walletAddr }); }
      catch (e) { console.warn("Backend record failed (non-critical):", e); }
      toast.success("Donation sent! 🎉");
      onSuccess?.();
    } catch (e: unknown) { toast.error("Donation failed", { description: e instanceof Error ? e.message : "Transaction failed" }); }
    finally { setLoading(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1A1F2E]/40 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-white border border-[#E4E2DC] rounded-xl p-8 animate-slideUp shadow-[0_16px_48px_rgba(26,31,46,0.18)]">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold text-[#1A1F2E]">Donate SOL</h3>
            <p className="text-sm text-[#1A1F2E]/35 mt-1">Funds go into an on-chain escrow vault</p>
          </div>
          <button onClick={onClose} className="p-3 rounded-xl text-[#1A1F2E]/30 hover:text-[#1A1F2E]/60 hover:bg-[#F0EFEB] transition-all duration-150 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        {txSig ? (
          <div className="text-center py-6">
            <div className="text-6xl mb-6">🎉</div>
            <p className="font-bold text-xl text-[#1A1F2E] mb-3">Donation Sent!</p>
            <a href={`https://solscan.io/tx/${txSig}?cluster=devnet`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-base text-[#2D6A4F] hover:text-[#245A42] transition-colors duration-150 mb-8">
              <ExternalLink size={16} /> View on Solscan
            </a>
            <button onClick={() => { setTxSig(null); setAmount(""); onClose(); }}
              className="w-full py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base hover:bg-[#245A42] transition-all duration-150 min-h-[48px]">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#1A1F2E]/40 uppercase tracking-wider mb-2">Amount (SOL)</label>
              <input
                type="number" min="0.001" step="0.01" placeholder="0.0"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-4 rounded-xl bg-[#F8F7F4] border border-[#E4E2DC] text-[#1A1F2E] text-xl font-bold placeholder-[#1A1F2E]/20 focus:outline-none focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F]/20 transition-all duration-150 min-h-[56px]"
              />
            </div>

            <div className="grid grid-cols-4 gap-3 mb-8">
              {QUICK.map((v) => (
                <button key={v} onClick={() => setAmount(v.toString())}
                  className={`py-3 rounded-xl text-base font-semibold border transition-all duration-150 min-h-[48px] ${amount === v.toString()
                    ? "bg-[#2D6A4F]/10 border-[#2D6A4F]/30 text-[#2D6A4F]"
                    : "bg-[#F8F7F4] border-[#E4E2DC] text-[#1A1F2E]/35 hover:bg-[#F0EFEB] hover:text-[#1A1F2E]/55"
                    }`}>
                  {v}
                </button>
              ))}
            </div>

            {!walletAddr && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#C2850C]/[0.06] border border-[#C2850C]/20 text-[#C2850C] text-base mb-6">
                <Zap size={18} /> Connect your wallet to donate
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={onClose}
                className="px-6 py-3.5 rounded-xl border border-[#E4E2DC] text-[#1A1F2E]/45 text-base font-semibold hover:bg-[#F0EFEB] transition-all duration-150 min-h-[48px]">
                Cancel
              </button>
              <button onClick={onDonate} disabled={loading || !amount || !walletAddr}
                className="flex-1 py-4 rounded-xl bg-[#2D6A4F] text-white font-semibold text-base hover:bg-[#245A42] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[48px]">
                {loading ? "Sending…" : `Donate ${amount || "0"} SOL`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
