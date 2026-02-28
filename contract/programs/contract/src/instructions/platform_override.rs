use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use crate::{
    constants::*,
    error::CredenceError,
    state::{PlatformConfig, Project, ProjectState},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum OverrideAction {
    Freeze,
    Unfreeze,
    ForceReleaseMilestone,
    ForceRefundAll,
}

#[derive(Accounts)]
pub struct PlatformOverride<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [PLATFORM_SEED],
        bump = platform_config.bump,
        constraint = platform_config.admin == admin.key() @ CredenceError::NotAdmin,
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(
        mut,
        seeds = [PROJECT_SEED, project.creator.as_ref(), &project.project_id],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    /// CHECK: Creator wallet — needed for ForceReleaseMilestone / ForceRefundAll
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,

    /// CHECK: Native SOL vault
    #[account(
        mut,
        seeds = [VAULT_SEED, project.key().as_ref()],
        bump = project.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<PlatformOverride>,
    action: OverrideAction,
    milestone_index: u8,
) -> Result<()> {
    let project_key = ctx.accounts.project.key();
    let vault_bump = ctx.accounts.project.vault_bump;
    let vault_seeds: &[&[u8]] = &[VAULT_SEED, project_key.as_ref(), &[vault_bump]];

    match action {
        OverrideAction::Freeze => {
            ctx.accounts.project.state = ProjectState::Frozen;
        }

        OverrideAction::Unfreeze => {
            ctx.accounts.project.state = ProjectState::Active;
        }

        OverrideAction::ForceReleaseMilestone => {
            require!(
                (milestone_index as usize) < ctx.accounts.project.milestones.len(),
                CredenceError::MilestoneIndexOutOfRange
            );

            let amount = {
                let m = &ctx.accounts.project.milestones[milestone_index as usize];
                if m.release_pct_bps > 0 {
                    let vault_balance = ctx.accounts.vault.lamports();
                    (vault_balance as u128)
                        .checked_mul(m.release_pct_bps as u128)
                        .and_then(|v| v.checked_div(10_000))
                        .and_then(|v| u64::try_from(v).ok())
                        .ok_or(CredenceError::ArithmeticOverflow)?
                } else {
                    m.amount
                }
            };

            invoke_signed(
                &system_instruction::transfer(
                    ctx.accounts.vault.key,
                    ctx.accounts.creator.key,
                    amount,
                ),
                &[
                    ctx.accounts.vault.to_account_info(),
                    ctx.accounts.creator.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[vault_seeds],
            )?;

            let project = &mut ctx.accounts.project;
            project.raised = project.raised.saturating_sub(amount);
            project.milestones[milestone_index as usize].state =
                crate::state::MilestoneState::Approved;
            project.current_milestone = project.current_milestone.saturating_add(1);
        }

        OverrideAction::ForceRefundAll => {
            // Return entire vault balance to creator for redistribution
            // (In prod, a separate refund-by-donor ix handles individual donors)
            let vault_balance = ctx.accounts.vault.lamports();
            if vault_balance > 0 {
                invoke_signed(
                    &system_instruction::transfer(
                        ctx.accounts.vault.key,
                        ctx.accounts.creator.key,
                        vault_balance,
                    ),
                    &[
                        ctx.accounts.vault.to_account_info(),
                        ctx.accounts.creator.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[vault_seeds],
                )?;
            }
            ctx.accounts.project.state = ProjectState::Failed;
            ctx.accounts.project.raised = 0;
        }
    }

    Ok(())
}
