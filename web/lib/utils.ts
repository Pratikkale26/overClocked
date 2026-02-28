export const LAMPORTS_PER_SOL = 1_000_000_000;

export const ORG_CATEGORY_LABELS: Record<string, string> = {
  STUDENT_ORG: "Student Organization",
  NGO: "NGO",
  OPEN_SOURCE: "Open Source",
  SOCIAL_IMPACT: "Social Impact",
  COMMUNITY: "Community",
  RESEARCH: "Research",
  OTHER: "Other",
};

export const YIELD_LABELS: Record<number, string> = {
  0: "No Yield",
  1: "Conservative",
  2: "Balanced",
  3: "Aggressive",
};

export function formatSol(lamports: string | number | bigint): string {
  const numeric = typeof lamports === "bigint" ? Number(lamports) : Number(lamports || 0);
  if (!Number.isFinite(numeric)) return "0 SOL";
  const sol = numeric / LAMPORTS_PER_SOL;
  return `${sol.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL`;
}

export function shortenAddress(address?: string, size = 4): string {
  if (!address) return "";
  if (address.length <= size * 2) return address;
  return `${address.slice(0, size)}...${address.slice(-size)}`;
}

export function formatGoalProgress(
  raisedLamports: string | number,
  totalGoalLamports: string | number
): number {
  const raised = Number(raisedLamports || 0);
  const goal = Number(totalGoalLamports || 0);
  if (!Number.isFinite(raised) || !Number.isFinite(goal) || goal <= 0) return 0;
  return Math.max(0, Math.min(100, (raised / goal) * 100));
}
