use anchor_lang::prelude::*;

#[account]
pub struct OrgAccount {
    pub authority: Pubkey,
    pub campaigns_created: u32,
    pub campaigns_completed: u32,
    pub campaigns_failed: u32,
    pub total_raised_lamports: u64,
    pub total_released_lamports: u64,
    pub completion_rate_bps: u16,
    pub bump: u8,
}

impl OrgAccount {
    // 8 + 32 + 4 + 4 + 4 + 8 + 8 + 2 + 1 = 71
    pub const SPACE: usize = 8 + 32 + 4 + 4 + 4 + 8 + 8 + 2 + 1; // 71
}
