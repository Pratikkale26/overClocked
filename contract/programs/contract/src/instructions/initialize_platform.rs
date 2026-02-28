use anchor_lang::prelude::*;
use crate::{constants::PLATFORM_SEED, state::PlatformConfig};

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = PlatformConfig::SPACE,
        seeds = [PLATFORM_SEED],
        bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializePlatform>,
    fee_bps: u16,
    treasury: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.platform_config;
    config.admin = ctx.accounts.admin.key();
    config.fee_bps = fee_bps;
    config.treasury = treasury;
    config.bump = ctx.bumps.platform_config;
    Ok(())
}
