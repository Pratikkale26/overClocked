use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use crate::{
    constants::*,
    error::CredenceError,
    state::{DonorRecord, Project, MilestoneState, ProjectState},
};

#[derive(Accounts)]
pub struct WithdrawDonation<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(
        mut,
        seeds = [PROJECT_SEED, project.creator.as_ref(), &project.project_id],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    #[account(
        mut,
        seeds = [DONOR_RECORD_SEED, project.key().as_ref(), donor.key().as_ref()],
        bump = donor_record.bump,
        constraint = donor_record.donor == donor.key() @ CredenceError::NoDonorRecord,
    )]
    pub donor_record: Account<'info, DonorRecord>,

    /// CHECK: Native SOL vault
    #[account(
        mut,
        seeds = [VAULT_SEED, project.key().as_ref()],
        bump = project.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawDonation>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(!ctx.accounts.donor_record.withdrawn, CredenceError::AlreadyWithdrawn);

    let project = &ctx.accounts.project;

    // Eligible conditions:
    // 1. Project state is Failed
    // 2. Current milestone deadline has passed by more than WITHDRAWAL_GRACE_PERIOD_SECS
    let eligible = project.state == ProjectState::Failed || {
        let idx = project.current_milestone as usize;
        if idx < project.milestones.len() {
            let m = &project.milestones[idx];
            m.state == MilestoneState::Pending
                && now > m.deadline.saturating_add(WITHDRAWAL_GRACE_PERIOD_SECS)
        } else {
            false
        }
    };

    require!(eligible, CredenceError::WithdrawalNotEligible);

    let vault_balance = ctx.accounts.vault.lamports();
    let donor_stake = ctx.accounts.donor_record.amount_lamports;
    let project_raised = project.raised;

    // Proportional share: (donor_stake / project_raised) × vault_balance
    let refund_amount = if project_raised == 0 {
        0u64
    } else {
        (vault_balance as u128)
            .checked_mul(donor_stake as u128)
            .and_then(|v| v.checked_div(project_raised as u128))
            .and_then(|v| u64::try_from(v).ok())
            .ok_or(CredenceError::ArithmeticOverflow)?
    };

    if refund_amount > 0 {
        let project_key = ctx.accounts.project.key();
        let vault_bump = ctx.accounts.project.vault_bump;
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, project_key.as_ref(), &[vault_bump]];
        invoke_signed(
            &system_instruction::transfer(
                ctx.accounts.vault.key,
                ctx.accounts.donor.key,
                refund_amount,
            ),
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[vault_seeds],
        )?;
    }

    let project = &mut ctx.accounts.project;
    project.raised = project.raised.saturating_sub(refund_amount);

    ctx.accounts.donor_record.withdrawn = true;

    Ok(())
}
