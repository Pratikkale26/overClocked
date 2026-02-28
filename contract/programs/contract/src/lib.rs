pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("G5WtbViVihHkgX9FrxZYup7qRKLudyzzNpiE96xMVZ8a");

#[program]
pub mod contract {
    use super::*;

    // ── Platform ──────────────────────────────────────────────────────────────
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        fee_bps: u16,
        treasury: Pubkey,
    ) -> Result<()> {
        initialize_platform::handler(ctx, fee_bps, treasury)
    }

    // ── Org ───────────────────────────────────────────────────────────────────
    pub fn create_org(ctx: Context<CreateOrg>) -> Result<()> {
        create_org::handler(ctx)
    }

    // ── Campaign ──────────────────────────────────────────────────────────────
    pub fn create_project(
        ctx: Context<CreateProject>,
        params: CreateProjectParams,
    ) -> Result<()> {
        create_project::handler(ctx, params)
    }

    pub fn donate(ctx: Context<Donate>, amount_lamports: u64) -> Result<()> {
        donate::handler(ctx, amount_lamports)
    }

    // ── Milestone lifecycle ───────────────────────────────────────────────────
    pub fn submit_milestone_proof(
        ctx: Context<SubmitMilestoneProof>,
        milestone_index: u8,
        proof_uri: String,
        voting_window_secs: i64,
    ) -> Result<()> {
        submit_milestone_proof::handler(ctx, milestone_index, proof_uri, voting_window_secs)
    }

    pub fn vote_milestone(
        ctx: Context<VoteMilestone>,
        milestone_index: u8,
        approve: bool,
    ) -> Result<()> {
        vote_milestone::handler(ctx, milestone_index, approve)
    }

    pub fn finalize_milestone(
        ctx: Context<FinalizeMilestone>,
        milestone_index: u8,
    ) -> Result<()> {
        finalize_milestone::handler(ctx, milestone_index)
    }

    // ── Prefront ──────────────────────────────────────────────────────────────
    pub fn claim_prefront_tranche(ctx: Context<ClaimPrefrontTranche>) -> Result<()> {
        claim_prefront_tranche::handler(ctx)
    }

    // ── Withdrawals ───────────────────────────────────────────────────────────
    pub fn withdraw_donation(ctx: Context<WithdrawDonation>) -> Result<()> {
        withdraw_donation::handler(ctx)
    }

    pub fn early_withdraw(ctx: Context<EarlyWithdraw>) -> Result<()> {
        early_withdraw::handler(ctx)
    }

    // ── Admin ─────────────────────────────────────────────────────────────────
    pub fn platform_override(
        ctx: Context<PlatformOverride>,
        action: OverrideAction,
        milestone_index: u8,
    ) -> Result<()> {
        platform_override::handler(ctx, action, milestone_index)
    }
}
