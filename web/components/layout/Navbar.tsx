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
  const { authenticated, login, logout, user } = usePrivy();
  const { publicKey } = useWallet();
  const adapterAddr = publicKey?.toBase58();
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
  const addr = adapterAddr ?? user?.wallet?.address ?? linkedAddr;

  return (
    <header className="sticky top-0 z-50 border-b border-[#E4E2DC] bg-[#F8F7F4]/80 backdrop-blur-xl">
      <nav className="mx-auto max-w-[1200px] px-8 flex items-center justify-between h-[72px] gap-6">

        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2D6A4F] flex items-center justify-center text-white text-base font-bold">
              C
            </div>
            <span className="font-extrabold text-[22px] tracking-tight text-[#1A1F2E]">
              Credence
            </span>
          </Link>

          {/* Nav links */}
          <div className="flex gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href}>
                  <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-base font-semibold transition-all duration-150 min-h-[44px] ${active
                    ? "bg-[#2D6A4F] text-white"
                    : "text-[#1A1F2E]/50 hover:text-[#1A1F2E]/80 hover:bg-[#1A1F2E]/[0.04]"
                    }`}>
                    <Icon size={18} />
                    {label}
                  </button>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {authenticated ? (
            <>
              {addr && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F0EFEB] border border-[#E4E2DC] text-sm font-['DM_Mono'] text-[#1A1F2E]/50 min-h-[44px]">
                  <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
                  {shortenAddress(addr)}
                </div>
              )}
              <button
                onClick={() => logout()}
                className="p-3 rounded-xl text-[#1A1F2E]/40 hover:text-[#1A1F2E]/70 hover:bg-[#1A1F2E]/[0.04] transition-all duration-150 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => login()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2D6A4F] text-white text-base font-semibold hover:bg-[#245A42] hover:-translate-y-[1px] transition-all duration-150 min-h-[48px]"
            >
              <Wallet size={18} />
              Connect
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
