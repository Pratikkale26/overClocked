use anchor_lang::prelude::*;
use crate::constants::*;

// ─── Enums ───────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default)]
pub enum ProjectState {
    #[default]
    Active,
    Completed,
    Failed,
    Frozen,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Default)]
pub enum MilestoneState {
    #[default]
    Pending,
    UnderReview,
    Approved,
    Rejected,
}

// ─── MilestoneData (stored inline in Project) ────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MilestoneData {
    /// Fixed lamport release. Use 0 if pct-based.
    pub amount: u64,
    /// Basis points of current escrow balance to release. Use 0 if fixed.
    pub release_pct_bps: u16,
    pub deadline: i64,
    pub state: MilestoneState,
    /// S3 / IPFS URI of proof. Max MAX_PROOF_URI_LEN chars.
    pub proof_uri: String,
    /// Sum of lamport weights voting yes
    pub vote_yes: u64,
    /// Sum of lamport weights voting no
    pub vote_no: u64,
    /// Snapshot of project.raised when voting window opened
    pub total_eligible: u64,
    /// Min yes/(yes+no) ratio in bps to approve (default 5100 = 51%)
    pub threshold_bps: u16,
    /// Min (yes+no)/total_eligible ratio in bps for valid vote (default 1000 = 10%)
    pub quorum_bps: u16,
    pub voting_start: i64,
    pub voting_end: i64,
    /// Times creator resubmitted proof after rejection
    pub revision_count: u8,
}

impl Default for MilestoneData {
    fn default() -> Self {
        Self {
            amount: 0,
            release_pct_bps: 0,
            deadline: i64::MAX,
            state: MilestoneState::Pending,
            proof_uri: String::new(),
            vote_yes: 0,
            vote_no: 0,
            total_eligible: 0,
            threshold_bps: DEFAULT_THRESHOLD_BPS,
            quorum_bps: DEFAULT_QUORUM_BPS,
            voting_start: 0,
            voting_end: 0,
            revision_count: 0,
        }
    }
}

impl MilestoneData {
    /// Borsh-serialized size of one MilestoneData.
    /// String = 4 (len prefix) + MAX_PROOF_URI_LEN bytes.
    pub const SPACE: usize =
        8   // amount u64
        + 2 // release_pct_bps u16
        + 8 // deadline i64
        + 1 // state (enum → u8)
        + (4 + MAX_PROOF_URI_LEN) // proof_uri String
        + 8 // vote_yes u64
        + 8 // vote_no u64
        + 8 // total_eligible u64
        + 2 // threshold_bps u16
        + 2 // quorum_bps u16
        + 8 // voting_start i64
        + 8 // voting_end i64
        + 1; // revision_count u8
    // Total: 268 bytes per milestone
}

// ─── Project ─────────────────────────────────────────────────────────────────

#[account]
#[derive(Default)]
pub struct Project {
    pub creator: Pubkey,
    pub org: Pubkey,
    /// 32-byte unique project ID (UUID bytes). Used in PDA seeds.
    pub project_id: [u8; 32],
    pub has_goal: bool,
    /// Total campaign goal in lamports (0 = open campaign). Includes prefront.
    pub total_goal: u64,
    /// If true, milestones release a % of current escrow instead of a fixed amount
    pub use_milestone_pct: bool,
    /// Total lamports currently in escrow
    pub raised: u64,
    pub milestone_count: u8,
    pub current_milestone: u8,
    pub state: ProjectState,
    /// 0=none, 1=flexible(5%), 2=30d(8%), 3=60d(12%) — mocked for hackathon
    pub yield_policy: u8,
    pub yield_rate_bps: u16,
    pub yield_locked_until: i64,
    pub deadline: i64,

    // ── Prefront fields ──
    /// Total advance funds the creator needs before work can begin.
    /// This is part of total_goal (Option A). 0 = no prefront.
    pub prefront_lamports: u64,
    /// Number of equal weekly tranches (e.g. 4 = 25% per week for 4 weeks)
    pub prefront_tranches: u8,
    /// Number of tranches claimed so far
    pub prefront_claimed: u8,
    /// Unix timestamp of first donation (prefront clock starts here)
    pub prefront_start: i64,

    // ── PDA bumps ──
    pub vault_bump: u8,
    pub bump: u8,

    /// Inline milestone data (up to MAX_MILESTONES = 10)
    pub milestones: Vec<MilestoneData>,
}

impl Project {
    /// Base fields (no milestones)
    ///  8 disc + 32 + 32 + 32 + 1 + 8 + 1 + 8 + 1 + 1 + 1 + 1 + 2 + 8 + 8
    /// + 8 + 1 + 1 + 8 + 1 + 1 + 4 (vec prefix) = 159
    pub const BASE_SPACE: usize = 8
        + 32 // creator
        + 32 // org
        + 32 // project_id
        + 1  // has_goal
        + 8  // total_goal
        + 1  // use_milestone_pct
        + 8  // raised
        + 1  // milestone_count
        + 1  // current_milestone
        + 1  // state
        + 1  // yield_policy
        + 2  // yield_rate_bps
        + 8  // yield_locked_until
        + 8  // deadline
        + 8  // prefront_lamports
        + 1  // prefront_tranches
        + 1  // prefront_claimed
        + 8  // prefront_start
        + 1  // vault_bump
        + 1  // bump
        + 4; // Vec length prefix

    /// Total space: base + room for 10 milestones × 268 bytes = ~2839 → 3000
    pub const SPACE: usize = Self::BASE_SPACE + MAX_MILESTONES * MilestoneData::SPACE;
}
