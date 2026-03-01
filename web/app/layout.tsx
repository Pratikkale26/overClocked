import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ProvidersClientOnly } from "../components/ProvidersClientOnly";
import "./globals.css";

export const metadata: Metadata = {
  title: "Credence — Programmable Trust for Fundraising",
  description:
    "Milestone-locked escrow, stake-weighted donor voting, and on-chain org reputation. Built on Solana.",
  openGraph: {
    title: "Credence",
    description: "Programmable trust for fundraising on Solana.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8F7F4] text-[#1A1F2E] font-['DM_Sans'] antialiased">
        <ProvidersClientOnly>
          {children}
          <Toaster
            theme="light"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#1A1F2E",
                border: "none",
                color: "#fff",
                fontFamily: "'DM Sans', sans-serif",
                borderRadius: "999px",
                padding: "12px 20px",
                fontSize: "13px",
                fontWeight: 500,
                boxShadow: "0 8px 24px rgba(26,31,46,0.2)",
              },
            }}
          />
        </ProvidersClientOnly>
      </body>
    </html>
  );
}
