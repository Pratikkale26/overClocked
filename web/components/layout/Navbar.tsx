"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { shortenAddress } from "../../lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const { authenticated, user, login, logout } = usePrivy();

  const wallet = user?.wallet?.address;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        borderBottom: "1px solid var(--border)",
        background: "rgba(11,14,24,0.8)",
        backdropFilter: "blur(8px)",
      }}
    >
      <nav
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 68,
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)" }}>
            Credence
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/explore">
              <button className={`btn btn-sm ${pathname === "/explore" ? "btn-primary" : "btn-ghost"}`}>
                Explore
              </button>
            </Link>
            <Link href="/create">
              <button className={`btn btn-sm ${pathname === "/create" ? "btn-primary" : "btn-ghost"}`}>
                Create
              </button>
            </Link>
            <Link href="/dashboard">
              <button className={`btn btn-sm ${pathname === "/dashboard" ? "btn-primary" : "btn-ghost"}`}>
                Dashboard
              </button>
            </Link>
          </div>
        </div>

        <div>
          {authenticated ? (
            <button className="btn btn-ghost btn-sm" onClick={() => logout()}>
              {wallet ? shortenAddress(wallet) : "Disconnect"}
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => login()}>
              Connect
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
