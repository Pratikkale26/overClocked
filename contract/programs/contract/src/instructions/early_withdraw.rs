use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use crate::{
    constants::*,
    error::CredenceError,
    state::{DonorRecord, Project, ProjectState},
};

#[derive(Accounts)]
pub struct EarlyWithdraw<'info> {
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

pub fn handler(ctx: Context<EarlyWithdraw>) -> Result<()> {
    require!(!ctx.accounts.donor_record.withdrawn, CredenceError::AlreadyWithdrawn);
    require!(
        ctx.accounts.project.state == ProjectState::Active,
        CredenceError::ProjectNotActive
    );

    let donor_stake = ctx.accounts.donor_record.amount_lamports;

    // 5% penalty stays in vault (benefits remaining donors / creator)
    let penalty = donor_stake
        .checked_mul(EARLY_EXIT_PENALTY_BPS)
        .and_then(|v| v.checked_div(10_000))
        .ok_or(CredenceError::ArithmeticOverflow)?;

    let payout = donor_stake
        .checked_sub(penalty)
        .ok_or(CredenceError::ArithmeticOverflow)?;

    let project_key = ctx.accounts.project.key();
    let vault_bump = ctx.accounts.project.vault_bump;
    let vault_seeds: &[&[u8]] = &[VAULT_SEED, project_key.as_ref(), &[vault_bump]];

    invoke_signed(
        &system_instruction::transfer(
            ctx.accounts.vault.key,
            ctx.accounts.donor.key,
            payout,
        ),
        &[
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.donor.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[vault_seeds],
    )?;

    // Deduct full stake from raised (payout + penalty, penalty stays in vault)
    let project = &mut ctx.accounts.project;
    project.raised = project.raised.saturating_sub(donor_stake);

    let dr = &mut ctx.accounts.donor_record;
    dr.withdrawn = true;
    dr.is_early_exit = true;

    Ok(())
}
