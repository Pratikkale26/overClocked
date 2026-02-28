use anchor_lang::prelude::*;

#[account]
pub struct PlatformConfig {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub treasury: Pubkey,
    pub bump: u8,
}

impl PlatformConfig {
    // 8 discriminator + 32 admin + 2 fee_bps + 32 treasury + 1 bump
    pub const SPACE: usize = 8 + 32 + 2 + 32 + 1; // 75
}
