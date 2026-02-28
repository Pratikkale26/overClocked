use anchor_lang::prelude::*;
use crate::{
    constants::*,
    error::CredenceError,
    state::{OrgAccount, Project, MilestoneData, MilestoneState, ProjectState},
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MilestoneInput {
    /// Fixed lamport amount to release (0 if pct-based)
    pub amount: u64,
    /// Basis points of escrow to release (0 if fixed amount)
    pub release_pct_bps: u16,
    pub deadline: i64,
    /// 0 = use default DEFAULT_THRESHOLD_BPS (5100)
    pub threshold_bps: u16,
    /// 0 = use default DEFAULT_QUORUM_BPS (1000)
    pub quorum_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateProjectParams {
    pub project_id: [u8; 32],
    pub has_goal: bool,
    /// Total campaign goal in lamports (0 for open campaign). INCLUDES prefront.
    pub total_goal: u64,
    pub use_milestone_pct: bool,
    pub deadline: i64,
    pub yield_policy: u8,
    pub yield_rate_bps: u16,
    /// Advance funds the creator needs before starting. Part of total_goal.
    pub prefront_lamports: u64,
    /// How many equal weekly tranches to split the prefront into (0 = no prefront)
    pub prefront_tranches: u8,
    pub milestones: Vec<MilestoneInput>,
}

#[derive(Accounts)]
#[instruction(params: CreateProjectParams)]
pub struct CreateProject<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [ORG_SEED, creator.key().as_ref()],
        bump = org.bump,
        constraint = org.authority == creator.key(),
    )]
    pub org: Account<'info, OrgAccount>,

    #[account(
        init,
        payer = creator,
        space = Project::SPACE,
        seeds = [PROJECT_SEED, creator.key().as_ref(), &params.project_id],
        bump,
    )]
    pub project: Account<'info, Project>,

    /// CHECK: Native SOL vault — PDA seeds control all transfers via invoke_signed
    #[account(
        mut,
        seeds = [VAULT_SEED, project.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateProject>, params: CreateProjectParams) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    // ── Validations ──────────────────────────────────────────────────────────
    require!(
        !params.milestones.is_empty() && params.milestones.len() <= MAX_MILESTONES,
        CredenceError::InvalidMilestoneCount
    );
    require!(params.deadline > now, CredenceError::CampaignDeadlinePassed);
    require!(
        params.prefront_tranches <= 52, // max 52 tranches (1 year)
        CredenceError::InvalidMilestoneAmounts
    );

    // If closed goal with fixed amounts, validate milestone amounts sum correctly
    if params.has_goal && !params.use_milestone_pct {
        let milestone_sum: u64 = params
            .milestones
            .iter()
            .map(|m| m.amount)
            .try_fold(0u64, |acc, x| acc.checked_add(x))
            .ok_or(CredenceError::ArithmeticOverflow)?;

        let total_expected = params
            .total_goal
            .checked_sub(params.prefront_lamports)
            .ok_or(CredenceError::ArithmeticOverflow)?;

        require!(milestone_sum == total_expected, CredenceError::InvalidMilestoneAmounts);
    }

    // ── Build inline milestones ───────────────────────────────────────────────
    let mut milestones: Vec<MilestoneData> = Vec::with_capacity(params.milestones.len());
    for input in &params.milestones {
        milestones.push(MilestoneData {
            amount: input.amount,
            release_pct_bps: input.release_pct_bps,
            deadline: input.deadline,
            state: MilestoneState::Pending,
            proof_uri: String::new(),
            vote_yes: 0,
            vote_no: 0,
            total_eligible: 0,
            threshold_bps: if input.threshold_bps == 0 { DEFAULT_THRESHOLD_BPS } else { input.threshold_bps },
            quorum_bps: if input.quorum_bps == 0 { DEFAULT_QUORUM_BPS } else { input.quorum_bps },
            voting_start: 0,
            voting_end: 0,
            revision_count: 0,
        });
    }

    // ── Populate project ──────────────────────────────────────────────────────
    let project = &mut ctx.accounts.project;
    project.creator = ctx.accounts.creator.key();
    project.org = ctx.accounts.org.key();
    project.project_id = params.project_id;
    project.has_goal = params.has_goal;
    project.total_goal = params.total_goal;
    project.use_milestone_pct = params.use_milestone_pct;
    project.raised = 0;
    project.milestone_count = params.milestones.len() as u8;
    project.current_milestone = 0;
    project.state = ProjectState::Active;
    project.yield_policy = params.yield_policy;
    project.yield_rate_bps = params.yield_rate_bps;
    project.yield_locked_until = match params.yield_policy {
        2 => now + 30 * 24 * 3600,
        3 => now + 60 * 24 * 3600,
        _ => 0,
    };
    project.deadline = params.deadline;
    project.prefront_lamports = params.prefront_lamports;
    project.prefront_tranches = params.prefront_tranches;
    project.prefront_claimed = 0;
    project.prefront_start = 0; // set on first donation
    project.vault_bump = ctx.bumps.vault;
    project.bump = ctx.bumps.project;
    project.milestones = milestones;

    // Update org reputation
    let org = &mut ctx.accounts.org;
    org.campaigns_created = org.campaigns_created.saturating_add(1);

    Ok(())
}
