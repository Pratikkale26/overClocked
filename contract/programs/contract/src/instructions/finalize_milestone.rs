use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke_signed, system_instruction};
use crate::{
    constants::*,
    error::CredenceError,
    state::{OrgAccount, Project, MilestoneState, ProjectState},
};

#[derive(Accounts)]
pub struct FinalizeMilestone<'info> {
    /// CHECK: Anyone can call finalize once voting window expires
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [PROJECT_SEED, project.creator.as_ref(), &project.project_id],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    #[account(
        mut,
        seeds = [ORG_SEED, project.creator.as_ref()],
        bump = org.bump,
    )]
    pub org: Account<'info, OrgAccount>,

    /// CHECK: Destination for released funds
    #[account(mut, constraint = creator.key() == project.creator)]
    pub creator: UncheckedAccount<'info>,

    /// CHECK: Native SOL vault — lamports deducted via invoke_signed
    #[account(
        mut,
        seeds = [VAULT_SEED, project.key().as_ref()],
        bump = project.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<FinalizeMilestone>, milestone_index: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        ctx.accounts.project.state == ProjectState::Active,
        CredenceError::ProjectNotActive
    );
    require!(
        (milestone_index as usize) < ctx.accounts.project.milestones.len(),
        CredenceError::MilestoneIndexOutOfRange
    );

    {
        let m = &ctx.accounts.project.milestones[milestone_index as usize];
        require!(
            m.state == MilestoneState::UnderReview,
            CredenceError::MilestoneNotUnderReview
        );
        require!(now > m.voting_end, CredenceError::VotingWindowNotExpired);
    }

    let project_key = ctx.accounts.project.key();
    let vault_bump = ctx.accounts.project.vault_bump;

    // Tally
    let (vote_yes, vote_no, total_eligible, threshold_bps, quorum_bps, amount, release_pct_bps) = {
        let m = &ctx.accounts.project.milestones[milestone_index as usize];
        (m.vote_yes, m.vote_no, m.total_eligible, m.threshold_bps, m.quorum_bps, m.amount, m.release_pct_bps)
    };

    let total_votes = vote_yes.saturating_add(vote_no);

    // Check quorum: (total_votes / total_eligible) >= quorum_bps / 10000
    let quorum_met = if total_eligible == 0 {
        false
    } else {
        total_votes.checked_mul(10_000).ok_or(CredenceError::ArithmeticOverflow)?
            >= (quorum_bps as u64).checked_mul(total_eligible).ok_or(CredenceError::ArithmeticOverflow)?
    };

    // Check threshold: (vote_yes / total_votes) >= threshold_bps / 10000
    let approved = quorum_met && {
        if total_votes == 0 {
            false
        } else {
            vote_yes.checked_mul(10_000).ok_or(CredenceError::ArithmeticOverflow)?
                >= (threshold_bps as u64).checked_mul(total_votes).ok_or(CredenceError::ArithmeticOverflow)?
        }
    };

    if approved {
        // Calculate release amount
        let release_amount = if release_pct_bps > 0 {
            // pct-based: release_pct_bps/10000 × current escrow
            let vault_balance = ctx.accounts.vault.lamports();
            (vault_balance as u128)
                .checked_mul(release_pct_bps as u128)
                .and_then(|v| v.checked_div(10_000))
                .and_then(|v| u64::try_from(v).ok())
                .ok_or(CredenceError::ArithmeticOverflow)?
        } else {
            amount
        };

        // Transfer vault → creator via invoke_signed
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, project_key.as_ref(), &[vault_bump]];
        invoke_signed(
            &system_instruction::transfer(
                ctx.accounts.vault.key,
                ctx.accounts.creator.key,
                release_amount,
            ),
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.creator.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[vault_seeds],
        )?;

        // Update project
        let project = &mut ctx.accounts.project;
        project.raised = project.raised.saturating_sub(release_amount);
        let m = &mut project.milestones[milestone_index as usize];
        m.state = MilestoneState::Approved;
        project.current_milestone = project.current_milestone.saturating_add(1);

        // Update org reputation
        let org = &mut ctx.accounts.org;
        org.total_released_lamports = org.total_released_lamports.saturating_add(release_amount);

        // Mark project complete if all milestones done
        if project.current_milestone >= project.milestone_count {
            project.state = ProjectState::Completed;
            org.campaigns_completed = org.campaigns_completed.saturating_add(1);
            org.total_raised_lamports = org.total_raised_lamports.saturating_add(project.raised);
            let total = org.campaigns_created as u64;
            let completed = org.campaigns_completed as u64;
            if total > 0 {
                org.completion_rate_bps = (completed.saturating_mul(10_000) / total) as u16;
            }
        }
    } else {
        // Rejected
        let project = &mut ctx.accounts.project;
        let m = &mut project.milestones[milestone_index as usize];
        m.state = MilestoneState::Rejected;
        m.revision_count = m.revision_count.saturating_add(1);

        if m.revision_count >= MAX_RESUBMISSIONS {
            project.state = ProjectState::Failed;
            ctx.accounts.org.campaigns_failed =
                ctx.accounts.org.campaigns_failed.saturating_add(1);
        } else {
            // Reset to Pending so creator can resubmit
            m.state = MilestoneState::Pending;
        }
    }

    Ok(())
}
