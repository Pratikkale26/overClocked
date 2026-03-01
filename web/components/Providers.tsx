"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { loginWithPrivy } from "../lib/api";
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';


const RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
const DEVNET_WSS_URL = RPC.replace('https://', 'wss://');


const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: false });
const API_TOKEN_STORAGE_KEY = "credence:privy-access-token";

// ─── Backend auth sync ────────────────────────────────────────────────────────
function ApiTokenSync({ children }: { children: ReactNode }) {
  const { authenticated, ready, getAccessToken } = usePrivy();

  useEffect(() => {
    if (!ready || !authenticated) {
      if (!authenticated) localStorage.removeItem(API_TOKEN_STORAGE_KEY);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        localStorage.setItem(API_TOKEN_STORAGE_KEY, token);
        await loginWithPrivy(token);
      } catch (err) {
        // Non-fatal — user remains logged into Privy even if API sync fails.
        console.error("[Credence] Backend auth sync failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [authenticated, getAccessToken, ready]);

  return <>{children}</>;
}

// ─── Wallet providers (must be inside PrivyProvider) ─────────────────────────
function WalletProviders({ children }: { children: ReactNode }) {
  // Empty wallets array — Privy's connectors provide wallets via toSolanaWalletConnectors
  const wallets = useMemo(() => [], []);
  return (
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <ApiTokenSync>{children}</ApiTokenSync>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// ─── Root provider ────────────────────────────────────────────────────────────
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!PRIVY_APP_ID) {
      console.error("[Credence] NEXT_PUBLIC_PRIVY_APP_ID is not set!");
    }
  }, []);

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["twitter", "wallet", "google"],
        appearance: {
          theme: "light",
          accentColor: "#2D6A4F",
          walletChainType: "solana-only",
          landingHeader: "Welcome to Credence",
          loginMessage: "Transparent crowdfunding on Solana.",
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },

        solana: {
          rpcs: {
            'solana:devnet': {
              rpc: createSolanaRpc(RPC),
              rpcSubscriptions: createSolanaRpcSubscriptions(DEVNET_WSS_URL),
              blockExplorerUrl: 'https://solscan.io/?cluster=devnet',
            },
            'solana:mainnet': {
              rpc: createSolanaRpc('https://api.mainnet-beta.solana.com'),
              rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.mainnet-beta.solana.com'),
              blockExplorerUrl: 'https://solscan.io',
            },
          },
        }
      }}
    >
      <WalletProviders>{children}</WalletProviders>
    </PrivyProvider>
  );
}
