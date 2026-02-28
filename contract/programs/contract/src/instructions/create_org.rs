use anchor_lang::prelude::*;
use crate::{constants::ORG_SEED, state::OrgAccount};

#[derive(Accounts)]
pub struct CreateOrg<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = OrgAccount::SPACE,
        seeds = [ORG_SEED, authority.key().as_ref()],
        bump,
    )]
    pub org: Account<'info, OrgAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateOrg>) -> Result<()> {
    let org = &mut ctx.accounts.org;
    org.authority = ctx.accounts.authority.key();
    org.campaigns_created = 0;
    org.campaigns_completed = 0;
    org.campaigns_failed = 0;
    org.total_raised_lamports = 0;
    org.total_released_lamports = 0;
    org.completion_rate_bps = 0;
    org.bump = ctx.bumps.org;
    Ok(())
}
