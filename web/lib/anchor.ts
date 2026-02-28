import { AnchorProvider, Program, BN, type Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";

import idlJson from "./idl.json";

// ── Constants ─────────────────────────────────────────────────────────────────
export const PROGRAM_ID = new PublicKey(
    process.env.NEXT_PUBLIC_PROGRAM_ID ?? "G5WtbViVihHkgX9FrxZYup7qRKLudyzzNpiE96xMVZ8a"
);

const ORG_SEED = Buffer.from("org");
const PROJECT_SEED = Buffer.from("project");
const VAULT_SEED = Buffer.from("vault");
const DONOR_RECORD_SEED = Buffer.from("donor_record");

// ── PDA Derivation Helpers ────────────────────────────────────────────────────

export function deriveOrgPDA(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [ORG_SEED, authority.toBuffer()],
        PROGRAM_ID
    );
}

export function deriveProjectPDA(
    creator: PublicKey,
    projectId: Uint8Array | number[]
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [PROJECT_SEED, creator.toBuffer(), Buffer.from(projectId)],
        PROGRAM_ID
    );
}

export function deriveVaultPDA(projectPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [VAULT_SEED, projectPDA.toBuffer()],
        PROGRAM_ID
    );
}

export function deriveDonorRecordPDA(
    projectPDA: PublicKey,
    donor: PublicKey
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [DONOR_RECORD_SEED, projectPDA.toBuffer(), donor.toBuffer()],
        PROGRAM_ID
    );
}

// ── Program Instance ──────────────────────────────────────────────────────────

export function getProgram(provider: AnchorProvider) {
    return new Program(idlJson as Idl, provider);
}

export function getReadonlyProvider(connection: Connection): AnchorProvider {
    // Read-only provider (no wallet) for fetching accounts
    return new AnchorProvider(connection, {} as any, {
        commitment: "confirmed",
    });
}

// ── Generate Project ID (32-byte from UUID) ───────────────────────────────────

export function generateProjectId(): Uint8Array {
    // Generate a random 32-byte project ID
    const id = new Uint8Array(32);
    if (typeof window !== "undefined" && window.crypto) {
        window.crypto.getRandomValues(id);
    } else {
        for (let i = 0; i < 32; i++) id[i] = Math.floor(Math.random() * 256);
    }
    return id;
}

export function projectIdToHex(id: Uint8Array | number[]): string {
    return Array.from(id)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export function hexToProjectId(hex: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return bytes;
}

// ── Yield Rate Mapping ────────────────────────────────────────────────────────

const YIELD_RATE_MAP: Record<number, number> = {
    0: 0,
    1: 500,   // 5%
    2: 800,   // 8%
    3: 1200,  // 12%
};

export function yieldPolicyToRateBps(policy: number): number {
    return YIELD_RATE_MAP[policy] ?? 0;
}

// ── Transaction Builders ──────────────────────────────────────────────────────

export async function buildCreateOrgTx(
    program: Program,
    authority: PublicKey,
    gstinHash: number[]
) {
    const [orgPDA] = deriveOrgPDA(authority);

    return program.methods
        .createOrg(gstinHash)
        .accounts({
            authority,
            org: orgPDA,
            systemProgram: SystemProgram.programId,
        })
        .transaction();
}

export async function buildCreateProjectTx(
    program: Program,
    creator: PublicKey,
    params: {
        projectId: number[] | Uint8Array;
        hasGoal: boolean;
        totalGoalLamports: number;
        useMilestonePct: boolean;
        deadlineUnix: number;
        yieldPolicy: number;
        prefrontLamports: number;
        prefrontTranches: number;
        milestones: Array<{
            amount: number;
            releasePctBps: number;
            deadline: number;
            thresholdBps: number;
            quorumBps: number;
        }>;
    }
) {
    const [orgPDA] = deriveOrgPDA(creator);
    const projectIdArr = Array.from(params.projectId);
    const [projectPDA] = deriveProjectPDA(creator, projectIdArr);
    const [vaultPDA] = deriveVaultPDA(projectPDA);

    const milestoneInputs = params.milestones.map((m) => ({
        amount: new BN(m.amount),
        releasePctBps: m.releasePctBps,
        deadline: new BN(m.deadline),
        thresholdBps: m.thresholdBps,
        quorumBps: m.quorumBps,
    }));

    return {
        tx: await program.methods
            .createProject({
                projectId: projectIdArr,
                hasGoal: params.hasGoal,
                totalGoal: new BN(params.totalGoalLamports),
                useMilestonePct: params.useMilestonePct,
                deadline: new BN(params.deadlineUnix),
                yieldPolicy: params.yieldPolicy,
                yieldRateBps: yieldPolicyToRateBps(params.yieldPolicy),
                prefrontLamports: new BN(params.prefrontLamports),
                prefrontTranches: params.prefrontTranches,
                milestones: milestoneInputs,
            })
            .accounts({
                creator,
                org: orgPDA,
                project: projectPDA,
                vault: vaultPDA,
                systemProgram: SystemProgram.programId,
            })
            .transaction(),
        projectPDA,
        vaultPDA,
    };
}

export async function buildDonateTx(
    program: Program,
    donor: PublicKey,
    projectPDA: PublicKey,
    amountLamports: number
) {
    const [vaultPDA] = deriveVaultPDA(projectPDA);
    const [donorRecordPDA] = deriveDonorRecordPDA(projectPDA, donor);

    return program.methods
        .donate(new BN(amountLamports))
        .accounts({
            donor,
            project: projectPDA,
            donorRecord: donorRecordPDA,
            vault: vaultPDA,
            systemProgram: SystemProgram.programId,
        })
        .transaction();
}

export async function buildVoteMilestoneTx(
    program: Program,
    voter: PublicKey,
    projectPDA: PublicKey,
    milestoneIndex: number,
    approve: boolean
) {
    const [donorRecordPDA] = deriveDonorRecordPDA(projectPDA, voter);

    return program.methods
        .voteMilestone(milestoneIndex, approve)
        .accounts({
            voter,
            project: projectPDA,
            donorRecord: donorRecordPDA,
        })
        .transaction();
}

// ── Account Fetching ──────────────────────────────────────────────────────────

export async function fetchProjectAccount(
    program: Program,
    projectPDA: PublicKey
) {
    try {
        return await (program.account as any).project.fetch(projectPDA);
    } catch {
        return null;
    }
}

export async function fetchDonorRecord(
    program: Program,
    projectPDA: PublicKey,
    donor: PublicKey
) {
    const [donorRecordPDA] = deriveDonorRecordPDA(projectPDA, donor);
    try {
        return await (program.account as any).donorRecord.fetch(donorRecordPDA);
    } catch {
        return null;
    }
}

export async function fetchOrgAccount(
    program: Program,
    authority: PublicKey
) {
    const [orgPDA] = deriveOrgPDA(authority);
    try {
        return await (program.account as any).orgAccount.fetch(orgPDA);
    } catch {
        return null;
    }
}
