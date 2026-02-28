import axios from "axios";

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api",
});

// Attach Privy token to every request if stored in localStorage
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("privy:token");
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;

// ── Campaign helpers ───────────────────────────────────────────────────────

export async function fetchCampaigns(params?: {
    state?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
}) {
    const { data } = await api.get("/campaigns", { params });
    return data.campaigns as Campaign[];
}

export async function fetchCampaign(id: string) {
    const { data } = await api.get(`/campaigns/${id}`);
    return data.campaign as Campaign;
}

export async function createCampaignMeta(body: Record<string, unknown>) {
    const { data } = await api.post("/campaigns", body);
    return data.campaign as Campaign;
}

// ── Org helpers ────────────────────────────────────────────────────────────

export async function fetchOrg(wallet: string) {
    const { data } = await api.get(`/orgs/${wallet}`);
    return data.org as Org;
}

export async function createOrgMeta(body: Record<string, unknown>) {
    const { data } = await api.post("/orgs", body);
    return data.org as Org;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function loginWithPrivy(privyToken: string) {
    const { data } = await api.post(
        "/auth/privy",
        {},
        { headers: { Authorization: `Bearer ${privyToken}` } }
    );
    return data.user as User;
}

// ── Types (lightweight, from API responses) ───────────────────────────────

export interface Milestone {
    id: string;
    index: number;
    title: string;
    description?: string;
    amountLamports: string;
    state: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
    proofUri?: string;
    deadline?: string;
    thresholdBps: number;
    quorumBps: number;
    votingWindowSecs: number;
}

export interface Campaign {
    id: string;
    title: string;
    description: string;
    category?: string;
    bannerUrl?: string;
    tags: string[];
    onchainProjectPda?: string;
    onchainVaultPda?: string;
    projectIdBytes?: string;
    hasGoal: boolean;
    totalGoalLamports: string;
    raisedLamports: string;
    state: "ACTIVE" | "COMPLETED" | "FAILED" | "FROZEN";
    yieldPolicy: number;
    prefrontLamports: string;
    prefrontTranches: number;
    deadline?: string;
    createdAt: string;
    org: Org;
    milestones: Milestone[];
    _count?: { donations: number };
}

export interface Org {
    id: string;
    name: string;
    description?: string;
    category: string;
    logoUrl?: string;
    twitterHandle?: string;
    websiteUrl?: string;
    onchainPda?: string;
    verified: boolean;
    campaignsCreated: number;
    campaignsCompleted: number;
    campaignsFailed: number;
    totalRaisedLamports: string;
    completionRateBps: number;
    campaigns?: Campaign[];
}

export interface User {
    id: string;
    privyId: string;
    walletAddress?: string;
    email?: string;
    org?: Org;
}
