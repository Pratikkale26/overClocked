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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#050509] text-white font-['Inter'] antialiased">
        <ProvidersClientOnly>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#0f0f1a",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#fff",
                fontFamily: "Inter, sans-serif",
              },
            }}
          />
        </ProvidersClientOnly>
      </body>
    </html>
  );
}
