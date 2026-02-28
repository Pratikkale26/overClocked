"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  UnsafeBurnerWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { loginWithPrivy } from "../lib/api";

const DEVNET_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

const DEVNET_WSS_URL = DEVNET_RPC_URL.startsWith("https://")
  ? DEVNET_RPC_URL.replace("https://", "wss://")
  : DEVNET_RPC_URL.startsWith("http://")
    ? DEVNET_RPC_URL.replace("http://", "ws://")
    : "wss://api.devnet.solana.com";

const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

function ApiTokenSync({ children }: { children: ReactNode }) {
  const { authenticated, ready, getAccessToken } = usePrivy();

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      localStorage.removeItem("privy:token");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;

        localStorage.setItem("privy:token", token);
        await loginWithPrivy(token);
      } catch {
        // Non-blocking: the app can still run while backend auth catches up.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken, ready]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new UnsafeBurnerWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={DEVNET_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ""}
          config={{
            loginMethods: ["twitter", "google", "wallet"],
            appearance: {
              theme: "dark",
              accentColor: "#FF6B35",
              walletChainType: "solana-only",
              landingHeader: "Welcome to DareMe",
              loginMessage: "Put your money where your mouth is.",
            },
            embeddedWallets: {
              solana: {
                createOnLogin: "users-without-wallets",
              },
            },
            externalWallets: {
              solana: {
                connectors: solanaConnectors,
              },
            },
            solana: {
              rpcs: {
                "solana:devnet": {
                  rpc: createSolanaRpc(DEVNET_RPC_URL),
                  rpcSubscriptions: createSolanaRpcSubscriptions(DEVNET_WSS_URL),
                  blockExplorerUrl: "https://solscan.io/?cluster=devnet",
                },
                "solana:mainnet": {
                  rpc: createSolanaRpc("https://api.mainnet-beta.solana.com"),
                  rpcSubscriptions: createSolanaRpcSubscriptions(
                    "wss://api.mainnet-beta.solana.com"
                  ),
                  blockExplorerUrl: "https://solscan.io",
                },
              },
            },
          }}
        >
          <ApiTokenSync>{children}</ApiTokenSync>
        </PrivyProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
