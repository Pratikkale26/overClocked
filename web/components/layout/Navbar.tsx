"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet, LogOut, Compass, PlusCircle, LayoutDashboard } from "lucide-react";
import { shortenAddress } from "../../lib/utils";

const NAV = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/create", label: "Create", icon: PlusCircle },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function Navbar() {
  const pathname = usePathname();
  const { authenticated, login, logout } = usePrivy();
  const { publicKey } = useWallet();
  const addr = publicKey?.toBase58();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050509]/80 backdrop-blur-2xl">
      <nav className="mx-auto max-w-[1240px] px-6 flex items-center justify-between h-16 gap-4">

        {/* Logo */}
        <div className="flex items-center gap-7">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-violet-500/25">
              C
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Credence
            </span>
          </Link>

          {/* Nav links */}
          <div className="flex gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href}>
                  <button className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${active
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    }`}>
                    <Icon size={14} />
                    {label}
                  </button>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Auth */}
        <div className="flex items-center gap-2">
          {authenticated ? (
            <>
              {addr && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/[0.08] text-xs font-mono text-white/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  {shortenAddress(addr)}
                </div>
              )}
              <button
                onClick={() => logout()}
                className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
              >
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <button
              onClick={() => login()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:brightness-110 transition-all duration-200"
            >
              <Wallet size={14} />
              Connect
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
