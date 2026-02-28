import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import { Providers } from "../components/Providers";
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
      <body>
        <Providers>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--bg-card)",
                border: "1px solid var(--border-hover)",
                color: "var(--text-primary)",
                fontFamily: "Inter, sans-serif",
              },
            }}
          />
        </Providers>
        {/* <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" /> */}
      </body>
    </html>
  );
}
