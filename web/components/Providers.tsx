"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { loginWithPrivy } from "../lib/api";

const RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

// ─── Backend auth sync ────────────────────────────────────────────────────────
function ApiTokenSync({ children }: { children: ReactNode }) {
  const { authenticated, ready, getAccessToken } = usePrivy();

  useEffect(() => {
    if (!ready || !authenticated) {
      if (!authenticated) localStorage.removeItem("privy:token");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        localStorage.setItem("privy:token", token);
        await loginWithPrivy(token);
      } catch (err) {
        // Non-fatal — user is still logged in with Privy even if backend sync fails
        console.warn("[Credence] Backend auth sync failed (non-critical):", err);
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
      <WalletProvider wallets={wallets} autoConnect>
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
        loginMethods: ["google", "twitter", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#7c3aed",
          walletChainType: "solana-only",
          landingHeader: "Welcome to Credence",
          loginMessage: "Transparent crowdfunding on Solana.",
        },
        embeddedWallets: {
          solana: { createOnLogin: "off" },
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
      }}
    >
      <WalletProviders>{children}</WalletProviders>
    </PrivyProvider>
  );
}
