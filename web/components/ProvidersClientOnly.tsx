"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Providers = dynamic(
  () => import("./Providers").then((mod) => mod.Providers),
  { ssr: false }
);

export function ProvidersClientOnly({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
