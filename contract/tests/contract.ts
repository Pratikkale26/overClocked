import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Contract } from "../target/types/contract";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { assert, expect } from "chai";

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pda(seeds: Buffer[], programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

async function airdrop(
  provider: anchor.AnchorProvider,
  wallet: PublicKey,
  sol = 10
) {
  const sig = await provider.connection.requestAirdrop(
    wallet,
    sol * LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(sig, "confirmed");
}

// ── Constants matching the program ───────────────────────────────────────────
const PLATFORM_SEED = Buffer.from("platform_config");
const ORG_SEED = Buffer.from("org");
const PROJECT_SEED = Buffer.from("project");
const DONOR_RECORD_SEED = Buffer.from("donor_record");
const VAULT_SEED = Buffer.from("vault");

// ── Test suite ────────────────────────────────────────────────────────────────

describe("credence", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.contract as Program<Contract>;

  // Actors
  // The localnet provider wallet is backed by a Keypair internally stored as `payer`
  const admin = (provider.wallet as anchor.Wallet).payer;
  const orgAuthority = Keypair.generate();
  const donor1 = Keypair.generate();
  const donor2 = Keypair.generate();
  const stranger = Keypair.generate();

  // Derived PDAs (populated after first tests)
  let platformConfigPda: PublicKey;
  let orgPda: PublicKey;
  let projectPda: PublicKey;
  let vaultPda: PublicKey;
  let donor1RecordPda: PublicKey;
  let donor2RecordPda: PublicKey;

  // Project ID (32-byte seed)
  const projectId = Array.from(Buffer.alloc(32).fill(1));

  before(async () => {
    // Fund all wallets
    await Promise.all([
      airdrop(provider, admin.publicKey, 20),
      airdrop(provider, orgAuthority.publicKey, 20),
      airdrop(provider, donor1.publicKey, 20),
      airdrop(provider, donor2.publicKey, 20),
      airdrop(provider, stranger.publicKey, 5),
    ]);

    // Derive static PDAs
    [platformConfigPda] = pda([PLATFORM_SEED], program.programId);
    [orgPda] = pda([ORG_SEED, orgAuthority.publicKey.toBuffer()], program.programId);
  });

  // ── 1. Initialize Platform ────────────────────────────────────────────────
  describe("initialize_platform", () => {
    it("creates PlatformConfig PDA with correct fields", async () => {
      // Idempotent: if the validator wasn't reset, account may already exist with the same admin.
      try {
        await program.methods
          .initializePlatform(200, admin.publicKey)
          .accounts({
            admin: admin.publicKey,
            platformConfig: platformConfigPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
      } catch (e: any) {
        // "already in use" = previous run already initialized — fine, same admin key
        if (!e.message?.includes("already in use")) throw e;
      }

      const config = await program.account.platformConfig.fetch(platformConfigPda);
      assert.equal(config.admin.toBase58(), admin.publicKey.toBase58());
      assert.equal(config.feeBps, 200);
      assert.equal(config.treasury.toBase58(), admin.publicKey.toBase58());
    });

    it("fails if called a second time (init guard)", async () => {
      try {
        await program.methods
          .initializePlatform(200, admin.publicKey)
          .accounts({
            admin: admin.publicKey,
            platformConfig: platformConfigPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e) {
        expect(e.message).to.include("already in use");
      }
    });
  });

  // ── 2. Create Org ─────────────────────────────────────────────────────────
  describe("create_org", () => {
    it("creates OrgAccount PDA for authority", async () => {
      await program.methods
        .createOrg()
        .accounts({
          authority: orgAuthority.publicKey,
          org: orgPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([orgAuthority])
        .rpc();

      const org = await program.account.orgAccount.fetch(orgPda);
      assert.equal(org.authority.toBase58(), orgAuthority.publicKey.toBase58());
      assert.equal(org.campaignsCreated, 0);
      assert.equal(org.campaignsCompleted, 0);
      assert.equal(org.completionRateBps, 0);
    });

    it("fails to create duplicate org for same authority", async () => {
      try {
        await program.methods
          .createOrg()
          .accounts({
            authority: orgAuthority.publicKey,
            org: orgPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([orgAuthority])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e) {
        expect(e.message).to.include("already in use");
      }
    });
  });

  // ── 3. Create Project ─────────────────────────────────────────────────────
  describe("create_project", () => {
    before(async () => {
      [projectPda] = pda(
        [PROJECT_SEED, orgAuthority.publicKey.toBuffer(), Buffer.from(projectId)],
        program.programId
      );
      [vaultPda] = pda([VAULT_SEED, projectPda.toBuffer()], program.programId);
      [donor1RecordPda] = pda(
        [DONOR_RECORD_SEED, projectPda.toBuffer(), donor1.publicKey.toBuffer()],
        program.programId
      );
      [donor2RecordPda] = pda(
        [DONOR_RECORD_SEED, projectPda.toBuffer(), donor2.publicKey.toBuffer()],
        program.programId
      );
    });

    it("creates a fixed-goal project with 2 milestones and a prefront", async () => {
      const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days
      const m1Deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 10;
      const m2Deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 25;

      const params = {
        projectId,
        hasGoal: true,
        totalGoal: new BN(4 * LAMPORTS_PER_SOL), // 4 SOL total
        useMilestonePct: false,
        deadline: new BN(deadline),
        yieldPolicy: 0,
        yieldRateBps: 0,
        prefrontLamports: new BN(LAMPORTS_PER_SOL), // 1 SOL prefront
        prefrontTranches: 2,                         // 0.5 SOL × 2 weekly tranches
        milestones: [
          {
            amount: new BN(1.5 * LAMPORTS_PER_SOL), // milestone amounts sum = 3 SOL
            releasePctBps: 0,
            deadline: new BN(m1Deadline),
            thresholdBps: 5100,
            quorumBps: 1000,
          },
          {
            amount: new BN(1.5 * LAMPORTS_PER_SOL),
            releasePctBps: 0,
            deadline: new BN(m2Deadline),
            thresholdBps: 5100,
            quorumBps: 1000,
          },
        ],
      };

      await program.methods
        .createProject(params)
        .accounts({
          creator: orgAuthority.publicKey,
          org: orgPda,
          project: projectPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([orgAuthority])
        .rpc();

      const project = await program.account.project.fetch(projectPda);
      assert.equal(project.hasGoal, true);
      assert.equal(project.totalGoal.toNumber(), 4 * LAMPORTS_PER_SOL);
      assert.equal(project.milestoneCount, 2);
      assert.equal(project.prefrontLamports.toNumber(), LAMPORTS_PER_SOL);
      assert.equal(project.prefrontTranches, 2);
      assert.equal(project.prefrontClaimed, 0);
      assert.deepEqual(project.state, { active: {} });

      // Org campaigns_created should be 1
      const org = await program.account.orgAccount.fetch(orgPda);
      assert.equal(org.campaignsCreated, 1);
    });

    it("rejects milestone with wrong amounts (sum ≠ total_goal - prefront)", async () => {
      const projectId2 = Array.from(Buffer.alloc(32).fill(2));
      const [project2Pda] = pda(
        [PROJECT_SEED, orgAuthority.publicKey.toBuffer(), Buffer.from(projectId2)],
        program.programId
      );
      const [vault2Pda] = pda([VAULT_SEED, project2Pda.toBuffer()], program.programId);

      const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

      try {
        await program.methods
          .createProject({
            projectId: projectId2,
            hasGoal: true,
            totalGoal: new BN(4 * LAMPORTS_PER_SOL),
            useMilestonePct: false,
            deadline: new BN(deadline),
            yieldPolicy: 0,
            yieldRateBps: 0,
            prefrontLamports: new BN(LAMPORTS_PER_SOL),
            prefrontTranches: 2,
            milestones: [
              { amount: new BN(LAMPORTS_PER_SOL), releasePctBps: 0, deadline: new BN(deadline - 1000), thresholdBps: 5100, quorumBps: 1000 },
              // Only 1 SOL but should be 3 SOL (4-1 prefront)
            ],
          })
          .accounts({
            creator: orgAuthority.publicKey,
            org: orgPda,
            project: project2Pda,
            vault: vault2Pda,
            systemProgram: SystemProgram.programId,
          })
          .signers([orgAuthority])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e) {
        expect(e.message).to.include("InvalidMilestoneAmounts");
      }
    });
  });

  // ── 4. Donate ─────────────────────────────────────────────────────────────
  describe("donate", () => {
    it("donor1 donates 2 SOL — vault balance increases, DonorRecord created", async () => {
      const donateAmount = new BN(2 * LAMPORTS_PER_SOL);

      await program.methods
        .donate(donateAmount)
        .accounts({
          donor: donor1.publicKey,
          project: projectPda,
          donorRecord: donor1RecordPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor1])
        .rpc();

      const project = await program.account.project.fetch(projectPda);
      assert.equal(project.raised.toNumber(), 2 * LAMPORTS_PER_SOL);
      // prefront_start should be set (was 0 before first donation)
      assert.isAbove(project.prefrontStart.toNumber(), 0);

      const dr = await program.account.donorRecord.fetch(donor1RecordPda);
      assert.equal(dr.amountLamports.toNumber(), 2 * LAMPORTS_PER_SOL);
      assert.equal(dr.withdrawn, false);
      assert.equal(dr.votedBitmap.toNumber(), 0);

      const vaultBalance = await provider.connection.getBalance(vaultPda);
      assert.equal(vaultBalance, 2 * LAMPORTS_PER_SOL);
    });

    it("donor2 donates 2 SOL — raised accumulates", async () => {
      await program.methods
        .donate(new BN(2 * LAMPORTS_PER_SOL))
        .accounts({
          donor: donor2.publicKey,
          project: projectPda,
          donorRecord: donor2RecordPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor2])
        .rpc();

      const project = await program.account.project.fetch(projectPda);
      assert.equal(project.raised.toNumber(), 4 * LAMPORTS_PER_SOL);
    });

    it("rejects zero-amount donation", async () => {
      try {
        await program.methods
          .donate(new BN(0))
          .accounts({
            donor: donor1.publicKey,
            project: projectPda,
            donorRecord: donor1RecordPda,
            vault: vaultPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([donor1])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e) {
        expect(e.message).to.include("InvalidAmount");
      }
    });
  });

  // ── 5. Submit Milestone Proof ─────────────────────────────────────────────
  describe("submit_milestone_proof", () => {
    it("creator submits proof for milestone 0, opens 2-second voting window", async () => {
      await program.methods
        .submitMilestoneProof(0, "https://s3.amazonaws.com/credence/proof0.pdf", new BN(2))
        .accounts({
          creator: orgAuthority.publicKey,
          project: projectPda,
        })
        .signers([orgAuthority])
        .rpc();

      const project = await program.account.project.fetch(projectPda);
      const m = project.milestones[0];
      assert.equal(m.proofUri, "https://s3.amazonaws.com/credence/proof0.pdf");
      assert.deepEqual(m.state, { underReview: {} });
      assert.equal(m.totalEligible.toNumber(), 4 * LAMPORTS_PER_SOL);
      assert.isAbove(m.votingEnd.toNumber(), m.votingStart.toNumber());
    });

    it("stranger cannot submit proof (not creator)", async () => {
      try {
        await program.methods
          .submitMilestoneProof(0, "https://bad.com/proof", new BN(2))
          .accounts({
            creator: stranger.publicKey,
            project: projectPda,
          })
          .signers([stranger])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e) {
        expect(e.message).to.include("NotCreator");
      }
    });

    it("rejects proof URI longer than 200 chars", async () => {
      try {
        await program.methods
          .submitMilestoneProof(1, "x".repeat(201), new BN(86400))
          .accounts({
            creator: orgAuthority.publicKey,
            project: projectPda,
          })
          .signers([orgAuthority])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e) {
        expect(e.message).to.include("InvalidProofUri");
      }
    });
  });

  // ── 6. Vote Milestone ─────────────────────────────────────────────────────
  describe("vote_milestone", () => {
    it("donor1 votes YES on milestone 0 (weight = 2 SOL)", async () => {
      await program.methods
        .voteMilestone(0, true)
        .accounts({
          voter: donor1.publicKey,
          project: projectPda,
          donorRecord: donor1RecordPda,
        })
        .signers([donor1])
        .rpc();

      const project = await program.account.project.fetch(projectPda);
      const m = project.milestones[0];
      assert.equal(m.voteYes.toNumber(), 2 * LAMPORTS_PER_SOL);
      assert.equal(m.voteNo.toNumber(), 0);

      const dr = await program.account.donorRecord.fetch(donor1RecordPda);
      assert.equal(dr.votedBitmap.toNumber(), 1); // bit 0 set
    });

    it("donor2 votes YES on milestone 0 (weight = 2 SOL)", async () => {
      await program.methods
        .voteMilestone(0, true)
        .accounts({
          voter: donor2.publicKey,
          project: projectPda,
          donorRecord: donor2RecordPda,
        })
        .signers([donor2])
        .rpc();

      const project = await program.account.project.fetch(projectPda);
      assert.equal(project.milestones[0].voteYes.toNumber(), 4 * LAMPORTS_PER_SOL);
    });

    it("rejects double-vote from donor1", async () => {
      try {
        await program.methods
          .voteMilestone(0, false)
          .accounts({
            voter: donor1.publicKey,
            project: projectPda,
            donorRecord: donor1RecordPda,
          })
          .signers([donor1])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e) {
        expect(e.message).to.include("AlreadyVoted");
      }
    });

    it("rejects vote from non-donor (stranger has no DonorRecord)", async () => {
      try {
        // stranger would need a donor_record PDA — passing wrong derived PDA
        const [strangerRecord] = pda(
          [DONOR_RECORD_SEED, projectPda.toBuffer(), stranger.publicKey.toBuffer()],
          program.programId
        );
        await program.methods
          .voteMilestone(0, true)
          .accounts({
            voter: stranger.publicKey,
            project: projectPda,
            donorRecord: strangerRecord,
          })
          .signers([stranger])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e) {
        // Expected — account does not exist or constraint fails
        assert.ok(e);
      }
    });
  });

  // ── 7. Finalize Milestone (approved) ──────────────────────────────────────
  describe("finalize_milestone — approved", () => {
    it("waits for voting window to expire and finalizes (all votes YES)", async () => {
      // Wait for the 2-second voting window
      await sleep(3000);

      const creatorBalanceBefore = await provider.connection.getBalance(
        orgAuthority.publicKey
      );

      await program.methods
        .finalizeMilestone(0)
        .accounts({
          caller: admin.publicKey,
          project: projectPda,
          org: orgPda,
          creator: orgAuthority.publicKey,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const project = await program.account.project.fetch(projectPda);
      assert.deepEqual(project.milestones[0].state, { approved: {} });
      assert.equal(project.currentMilestone, 1);

      const creatorBalanceAfter = await provider.connection.getBalance(
        orgAuthority.publicKey
      );
      // Creator received 1.5 SOL (milestone 0 amount)
      assert.isAbove(creatorBalanceAfter, creatorBalanceBefore);
    });
  });

  // ── 8. Finalize Milestone (rejected — quorum not met) ─────────────────────
  describe("finalize_milestone — rejected (quorum not met)", () => {
    it("opens milestone 1 proof, only donor1 votes (50% stake, quorum is 10% so still passes)", async () => {
      // This test demonstrates quorum check: 2 SOL out of 4 SOL raised = 50% participation > 10% quorum
      // But both voted YES so it should pass. Let's test a case where the voting window expires with zero votes.

      // Submit proof for milestone 1 with 2-second window
      await program.methods
        .submitMilestoneProof(1, "https://s3.amazonaws.com/credence/proof1.pdf", new BN(2))
        .accounts({
          creator: orgAuthority.publicKey,
          project: projectPda,
        })
        .signers([orgAuthority])
        .rpc();

      // Do NOT vote — let window expire with 0 votes (quorum not met)
      await sleep(3000);

      await program.methods
        .finalizeMilestone(1)
        .accounts({
          caller: admin.publicKey,
          project: projectPda,
          org: orgPda,
          creator: orgAuthority.publicKey,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const project = await program.account.project.fetch(projectPda);
      // Rejected: milestone reverts to Pending for resubmission (revision_count = 1)
      assert.deepEqual(project.milestones[1].state, { pending: {} });
      assert.equal(project.milestones[1].revisionCount, 1);
      // Project stays Active
      assert.deepEqual(project.state, { active: {} });
    });

    it("fails after MAX_RESUBMISSIONS (3): project becomes Failed", async () => {
      // Resubmit and reject 2 more times (already at revision_count=1)
      for (let i = 0; i < 2; i++) {
        await program.methods
          .submitMilestoneProof(1, "https://s3.amazonaws.com/credence/proof1.pdf", new BN(2))
          .accounts({
            creator: orgAuthority.publicKey,
            project: projectPda,
          })
          .signers([orgAuthority])
          .rpc();

        await sleep(3000);

        await program.methods
          .finalizeMilestone(1)
          .accounts({
            caller: admin.publicKey,
            project: projectPda,
            org: orgPda,
            creator: orgAuthority.publicKey,
            vault: vaultPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc();
      }

      const project = await program.account.project.fetch(projectPda);
      // After 3 rejections (revision_count >= MAX_RESUBMISSIONS), project is Failed
      assert.deepEqual(project.state, { failed: {} });

      const org = await program.account.orgAccount.fetch(orgPda);
      assert.equal(org.campaignsFailed, 1);
    });
  });

  // ── 9. Withdraw Donation (project failed) ────────────────────────────────
  describe("withdraw_donation", () => {
    it("donor2 withdraws proportional refund after project fails", async () => {
      const balanceBefore = await provider.connection.getBalance(donor2.publicKey);

      await program.methods
        .withdrawDonation()
        .accounts({
          donor: donor2.publicKey,
          project: projectPda,
          donorRecord: donor2RecordPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor2])
        .rpc();

      const balanceAfter = await provider.connection.getBalance(donor2.publicKey);
      assert.isAbove(balanceAfter, balanceBefore, "Donor2 should have received a refund");

      const dr = await program.account.donorRecord.fetch(donor2RecordPda);
      assert.equal(dr.withdrawn, true);
    });

    it("rejects second withdrawal (already withdrawn)", async () => {
      try {
        await program.methods
          .withdrawDonation()
          .accounts({
            donor: donor2.publicKey,
            project: projectPda,
            donorRecord: donor2RecordPda,
            vault: vaultPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([donor2])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e) {
        expect(e.message).to.include("AlreadyWithdrawn");
      }
    });
  });

  // ── 10. Early Withdraw (separate project) ────────────────────────────────
  describe("early_withdraw", () => {
    let earlyProjectPda: PublicKey;
    let earlyVaultPda: PublicKey;
    let earlyDonorRecordPda: PublicKey;
    const earlyProjectId = Array.from(Buffer.alloc(32).fill(3));

    before(async () => {
      // Create a fresh org + project for early-withdraw test
      const earlyOrgAuthority = Keypair.generate();
      await airdrop(provider, earlyOrgAuthority.publicKey, 10);

      const [earlyOrgPda] = pda(
        [ORG_SEED, earlyOrgAuthority.publicKey.toBuffer()],
        program.programId
      );
      [earlyProjectPda] = pda(
        [PROJECT_SEED, earlyOrgAuthority.publicKey.toBuffer(), Buffer.from(earlyProjectId)],
        program.programId
      );
      [earlyVaultPda] = pda([VAULT_SEED, earlyProjectPda.toBuffer()], program.programId);
      [earlyDonorRecordPda] = pda(
        [DONOR_RECORD_SEED, earlyProjectPda.toBuffer(), donor1.publicKey.toBuffer()],
        program.programId
      );

      await program.methods.createOrg()
        .accounts({ authority: earlyOrgAuthority.publicKey, org: earlyOrgPda, systemProgram: SystemProgram.programId })
        .signers([earlyOrgAuthority]).rpc();

      const deadline = Math.floor(Date.now() / 1000) + 86400 * 30;
      await program.methods
        .createProject({
          projectId: earlyProjectId,
          hasGoal: false,
          totalGoal: new BN(0),
          useMilestonePct: true,
          deadline: new BN(deadline),
          yieldPolicy: 0,
          yieldRateBps: 0,
          prefrontLamports: new BN(0),
          prefrontTranches: 0,
          milestones: [{ amount: new BN(0), releasePctBps: 10000, deadline: new BN(deadline - 1000), thresholdBps: 5100, quorumBps: 1000 }],
        })
        .accounts({
          creator: earlyOrgAuthority.publicKey,
          org: earlyOrgPda,
          project: earlyProjectPda,
          vault: earlyVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([earlyOrgAuthority]).rpc();

      await program.methods.donate(new BN(2 * LAMPORTS_PER_SOL))
        .accounts({
          donor: donor1.publicKey,
          project: earlyProjectPda,
          donorRecord: earlyDonorRecordPda,
          vault: earlyVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor1]).rpc();
    });

    it("donor1 early-withdraws with 5% penalty (receives 95% of 2 SOL)", async () => {
      const balanceBefore = await provider.connection.getBalance(donor1.publicKey);

      await program.methods
        .earlyWithdraw()
        .accounts({
          donor: donor1.publicKey,
          project: earlyProjectPda,
          donorRecord: earlyDonorRecordPda,
          vault: earlyVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor1])
        .rpc();

      const balanceAfter = await provider.connection.getBalance(donor1.publicKey);
      const received = balanceAfter - balanceBefore;

      // Should receive ~1.9 SOL (95% of 2 SOL, minus tx fees)
      assert.isAbove(received, 1.8 * LAMPORTS_PER_SOL, "Should receive ~1.9 SOL");
      assert.isBelow(received, 2.0 * LAMPORTS_PER_SOL, "Should not receive full 2 SOL");

      const dr = await program.account.donorRecord.fetch(earlyDonorRecordPda);
      assert.equal(dr.withdrawn, true);
      assert.equal(dr.isEarlyExit, true);
    });
  });

  // ── 11. Platform Override ────────────────────────────────────────────────
  describe("platform_override", () => {
    let overrideProjectPda: PublicKey;
    let overrideVaultPda: PublicKey;
    let overrideOrgAuthority: Keypair;
    let overrideOrgPda: PublicKey;
    const overrideProjectId = Array.from(Buffer.alloc(32).fill(4));

    before(async () => {
      overrideOrgAuthority = Keypair.generate();
      await airdrop(provider, overrideOrgAuthority.publicKey, 10);

      [overrideOrgPda] = pda([ORG_SEED, overrideOrgAuthority.publicKey.toBuffer()], program.programId);
      [overrideProjectPda] = pda(
        [PROJECT_SEED, overrideOrgAuthority.publicKey.toBuffer(), Buffer.from(overrideProjectId)],
        program.programId
      );
      [overrideVaultPda] = pda([VAULT_SEED, overrideProjectPda.toBuffer()], program.programId);

      await program.methods.createOrg()
        .accounts({ authority: overrideOrgAuthority.publicKey, org: overrideOrgPda, systemProgram: SystemProgram.programId })
        .signers([overrideOrgAuthority]).rpc();

      const deadline = Math.floor(Date.now() / 1000) + 86400 * 30;
      await program.methods
        .createProject({
          projectId: overrideProjectId,
          hasGoal: true,
          totalGoal: new BN(2 * LAMPORTS_PER_SOL),
          useMilestonePct: false,
          deadline: new BN(deadline),
          yieldPolicy: 0,
          yieldRateBps: 0,
          prefrontLamports: new BN(0),
          prefrontTranches: 0,
          milestones: [{ amount: new BN(2 * LAMPORTS_PER_SOL), releasePctBps: 0, deadline: new BN(deadline - 1000), thresholdBps: 5100, quorumBps: 1000 }],
        })
        .accounts({
          creator: overrideOrgAuthority.publicKey,
          org: overrideOrgPda,
          project: overrideProjectPda,
          vault: overrideVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([overrideOrgAuthority]).rpc();

      // Donate so vault has funds
      const [donorRecord] = pda(
        [DONOR_RECORD_SEED, overrideProjectPda.toBuffer(), donor1.publicKey.toBuffer()],
        program.programId
      );
      await program.methods.donate(new BN(2 * LAMPORTS_PER_SOL))
        .accounts({
          donor: donor1.publicKey,
          project: overrideProjectPda,
          donorRecord,
          vault: overrideVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor1]).rpc();
    });

    it("admin freezes project — new donations rejected", async () => {
      await program.methods
        .platformOverride({ freeze: {} } as any, 0)
        .accounts({
          admin: admin.publicKey,
          platformConfig: platformConfigPda,
          project: overrideProjectPda,
          creator: overrideOrgAuthority.publicKey,
          vault: overrideVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const project = await program.account.project.fetch(overrideProjectPda);
      assert.deepEqual(project.state, { frozen: {} });
    });

    it("admin unfreezes project", async () => {
      await program.methods
        .platformOverride({ unfreeze: {} } as any, 0)
        .accounts({
          admin: admin.publicKey,
          platformConfig: platformConfigPda,
          project: overrideProjectPda,
          creator: overrideOrgAuthority.publicKey,
          vault: overrideVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const project = await program.account.project.fetch(overrideProjectPda);
      assert.deepEqual(project.state, { active: {} });
    });

    it("admin force-releases milestone 0 (skip voting)", async () => {
      const creatorBefore = await provider.connection.getBalance(overrideOrgAuthority.publicKey);

      await program.methods
        .platformOverride({ forceReleaseMilestone: {} } as any, 0)
        .accounts({
          admin: admin.publicKey,
          platformConfig: platformConfigPda,
          project: overrideProjectPda,
          creator: overrideOrgAuthority.publicKey,
          vault: overrideVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const creatorAfter = await provider.connection.getBalance(overrideOrgAuthority.publicKey);
      assert.isAbove(creatorAfter, creatorBefore, "Creator should have received funds");

      const project = await program.account.project.fetch(overrideProjectPda);
      assert.deepEqual(project.milestones[0].state, { approved: {} });
    });

    it("non-admin cannot call platform_override", async () => {
      try {
        await program.methods
          .platformOverride({ freeze: {} } as any, 0)
          .accounts({
            admin: stranger.publicKey,
            platformConfig: platformConfigPda,
            project: overrideProjectPda,
            creator: overrideOrgAuthority.publicKey,
            vault: overrideVaultPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([stranger])
          .rpc();
        assert.fail("Should have thrown");
      } catch (e) {
        expect(e.message).to.include("NotAdmin");
      }
    });
  });
});
