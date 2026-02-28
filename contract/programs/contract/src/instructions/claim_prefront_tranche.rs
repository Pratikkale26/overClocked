use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use crate::{
    constants::*,
    error::CredenceError,
    state::{Project, ProjectState},
};

#[derive(Accounts)]
pub struct ClaimPrefrontTranche<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [PROJECT_SEED, project.creator.as_ref(), &project.project_id],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    /// CHECK: Native SOL vault
    #[account(
        mut,
        seeds = [VAULT_SEED, project.key().as_ref()],
        bump = project.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimPrefrontTranche>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let project = &ctx.accounts.project;

    // Runtime authority check
    require!(
        ctx.accounts.creator.key() == project.creator,
        CredenceError::NotCreator
    );
    require!(
        project.state == ProjectState::Active,
        CredenceError::ProjectNotActive
    );
    require!(
        project.prefront_lamports > 0 && project.prefront_tranches > 0,
        CredenceError::NoPrefrontConfigured
    );
    require!(
        project.prefront_claimed < project.prefront_tranches,
        CredenceError::PrefrontFullyClaimed
    );

    // Prefront can only begin once campaign raised >= prefront_lamports
    require!(
        project.raised >= project.prefront_lamports,
        CredenceError::InsufficientFundsForPrefront
    );

    // Check weekly interval
    let expected_claim_time = project
        .prefront_start
        .checked_add(PREFRONT_INTERVAL_SECS.checked_mul(project.prefront_claimed as i64 + 1).ok_or(CredenceError::ArithmeticOverflow)?)
        .ok_or(CredenceError::ArithmeticOverflow)?;
    require!(now >= expected_claim_time, CredenceError::PrefrontIntervalNotElapsed);

    // Calculate tranche amount: prefront_lamports / prefront_tranches
    let tranche_amount = project
        .prefront_lamports
        .checked_div(project.prefront_tranches as u64)
        .ok_or(CredenceError::ArithmeticOverflow)?;

    let project_key = ctx.accounts.project.key();
    let vault_bump = ctx.accounts.project.vault_bump;

    // Transfer vault → creator
    let vault_seeds: &[&[u8]] = &[VAULT_SEED, project_key.as_ref(), &[vault_bump]];
    invoke_signed(
        &system_instruction::transfer(
            ctx.accounts.vault.key,
            ctx.accounts.creator.key,
            tranche_amount,
        ),
        &[
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        &[vault_seeds],
    )?;

    let project = &mut ctx.accounts.project;
    project.prefront_claimed = project.prefront_claimed.saturating_add(1);
    project.raised = project.raised.saturating_sub(tranche_amount);

    Ok(())
}
