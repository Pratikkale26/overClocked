use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use crate::{
    constants::*,
    error::CredenceError,
    state::{DonorRecord, Project, ProjectState},
};

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(
        mut,
        seeds = [PROJECT_SEED, project.creator.as_ref(), &project.project_id],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    #[account(
        init_if_needed,
        payer = donor,
        space = DonorRecord::SPACE,
        seeds = [DONOR_RECORD_SEED, project.key().as_ref(), donor.key().as_ref()],
        bump,
    )]
    pub donor_record: Account<'info, DonorRecord>,

    /// CHECK: Native SOL vault — transfers in via system_program CPI
    #[account(
        mut,
        seeds = [VAULT_SEED, project.key().as_ref()],
        bump = project.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Donate>, amount_lamports: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(amount_lamports > 0, CredenceError::InvalidAmount);
    require!(
        ctx.accounts.project.state == ProjectState::Active,
        CredenceError::ProjectNotActive
    );
    require!(now < ctx.accounts.project.deadline, CredenceError::CampaignDeadlinePassed);

    // Transfer SOL: donor → vault
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.donor.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount_lamports,
    )?;

    let project = &mut ctx.accounts.project;

    // Set prefront_start on the very first donation
    if project.raised == 0 && project.prefront_lamports > 0 {
        project.prefront_start = now;
    }

    project.raised = project
        .raised
        .checked_add(amount_lamports)
        .ok_or(CredenceError::ArithmeticOverflow)?;

    // Init or update DonorRecord
    let dr = &mut ctx.accounts.donor_record;
    if dr.donor == Pubkey::default() {
        dr.donor = ctx.accounts.donor.key();
        dr.project = ctx.accounts.project.key();
        dr.voted_bitmap = 0;
        dr.withdrawn = false;
        dr.is_early_exit = false;
        dr.bump = ctx.bumps.donor_record;
    }
    dr.amount_lamports = dr
        .amount_lamports
        .checked_add(amount_lamports)
        .ok_or(CredenceError::ArithmeticOverflow)?;

    Ok(())
}
