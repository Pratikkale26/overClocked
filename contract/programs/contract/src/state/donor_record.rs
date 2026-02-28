use anchor_lang::prelude::*;

#[account]
pub struct DonorRecord {
    pub donor: Pubkey,
    pub project: Pubkey,
    pub amount_lamports: u64,
    pub withdrawn: bool,
    pub is_early_exit: bool,
    /// Each bit i = has voted on milestone index i (up to 64 milestones)
    pub voted_bitmap: u64,
    pub bump: u8,
}

impl DonorRecord {
    // 8 + 32 + 32 + 8 + 1 + 1 + 8 + 1 = 91
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1 + 1 + 8 + 1; // 91
}
