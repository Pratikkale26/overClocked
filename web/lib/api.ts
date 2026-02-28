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

// ── Milestone / Proof / DPR helpers ───────────────────────────────────

export async function fetchMilestoneProof(milestoneId: string) {
    const { data } = await api.get(`/milestones/${milestoneId}/proof`);
    return data.proof as MilestoneProof | null;
}

export async function fetchMilestoneUpdates(milestoneId: string) {
    const { data } = await api.get(`/milestones/${milestoneId}/updates`);
    return data.updates as MilestoneUpdate[];
}

export async function fetchMilestoneFull(milestoneId: string) {
    const { data } = await api.get(`/milestones/${milestoneId}/full`);
    return data.milestone;
}

export async function fetchProofChain(campaignId: string) {
    const { data } = await api.get(`/milestones/campaign/${campaignId}/proof-chain`);
    return data.chain as MilestoneChainItem[];
}

export async function presignProofUpload(milestoneId: string, fileName: string, contentType: string) {
    const { data } = await api.post(`/milestones/${milestoneId}/proof/presign`, { fileName, contentType });
    return data as { uploadUrl: string; s3Key: string; publicUrl: string };
}

export async function submitMilestoneProof(milestoneId: string, body: {
    gstin?: string;
    isUnregisteredVendor?: boolean;
    invoiceS3Key: string;
    invoiceNumber?: string;
    invoiceAmount?: number;
    onchainProofUri?: string;
    votingWindowSecs?: number;
}) {
    const { data } = await api.post(`/milestones/${milestoneId}/proof`, body);
    return data;
}

export async function postMilestoneUpdate(milestoneId: string, body: {
    type?: string;
    title: string;
    description?: string;
    mediaUrls?: string[];
}) {
    const { data } = await api.post(`/milestones/${milestoneId}/updates`, body);
    return data.update as MilestoneUpdate;
}

export async function presignUpdateMedia(milestoneId: string, fileName: string, contentType: string) {
    const { data } = await api.post(`/milestones/${milestoneId}/updates/presign`, { fileName, contentType });
    return data as { uploadUrl: string; s3Key: string; publicUrl: string };
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
    gstin?: string;
    gstinVerified?: boolean;
    gstinLegalName?: string;
    verified: boolean;
    campaignsCreated: number;
    campaignsCompleted: number;
    campaignsFailed: number;
    totalRaisedLamports: string;
    completionRateBps: number;
    campaigns?: Campaign[];
    walletAddress?: string; // Added this line
}

export interface User {
    id: string;
    privyId: string;
    walletAddress?: string;
    email?: string;
    org?: Org;
}

export interface MilestoneProof {
    id: string;
    milestoneId: string;
    gstin?: string;
    gstinVerified: boolean;
    vendorLegalName?: string;
    vendorState?: string;
    invoiceNumber?: string;
    invoiceAmount?: number;
    invoiceS3Key?: string;
    invoiceHash: string;
    prevProofHash?: string;
    isUnregisteredVendor: boolean;
    createdAt: string;
}

export interface MilestoneUpdate {
    id: string;
    milestoneId: string;
    type: "PROGRESS" | "EXPENSE" | "PHOTO" | "COMPLETION" | "ANNOUNCEMENT";
    title: string;
    description?: string;
    mediaUrls: string[];
    contentHash: string;
    postedAt: string;
}

export interface MilestoneChainItem {
    id: string;
    index: number;
    title: string;
    state: string;
    proof?: MilestoneProof;
    updates: MilestoneUpdate[];
}

// Legacy types kept for compat
export interface MilestoneVote {
    id: string;
    milestoneId: string;
    voter: string;
    vote: "APPROVE" | "REJECT";
    createdAt: string;
}

export interface DprUpdate {
    id: string;
    campaignId: string;
    oldDpr: number;
    newDpr: number;
    reason: string;
    createdAt: string;
}
