use anchor_lang::prelude::*;

#[error_code]
pub enum CredenceError {
    // Auth
    #[msg("Unauthorized: admin only")]
    NotAdmin,
    #[msg("Unauthorized: only the project creator")]
    NotCreator,

    // Org
    #[msg("Org already exists for this authority")]
    OrgAlreadyExists,

    // Project
    #[msg("Project is not active")]
    ProjectNotActive,
    #[msg("Project is frozen by platform admin")]
    ProjectFrozen,
    #[msg("Campaign deadline has already passed")]
    CampaignDeadlinePassed,
    #[msg("Invalid milestone count: must be 1-10")]
    InvalidMilestoneCount,
    #[msg("Milestone amounts must sum to total goal")]
    InvalidMilestoneAmounts,
    #[msg("Invalid milestone index")]
    MilestoneIndexOutOfRange,
    #[msg("Donation amount must be greater than zero")]
    InvalidAmount,

    // Milestone
    #[msg("Milestone is not in Pending state")]
    MilestoneNotPending,
    #[msg("Milestone is not under review")]
    MilestoneNotUnderReview,
    #[msg("Proof URI exceeds 200 characters")]
    InvalidProofUri,
    #[msg("Max resubmissions (3) reached: project has failed")]
    MaxResubmissionsReached,

    // Voting
    #[msg("Voting window is not open for this milestone")]
    VotingNotOpen,
    #[msg("Voting window has not yet expired")]
    VotingWindowNotExpired,
    #[msg("Donor has already voted on this milestone")]
    AlreadyVoted,
    #[msg("No donation record found for this donor on this project")]
    NoDonorRecord,

    // Withdrawal
    #[msg("Withdrawal conditions not met")]
    WithdrawalNotEligible,
    #[msg("Funds already withdrawn")]
    AlreadyWithdrawn,
    #[msg("Milestone deadline has not passed yet")]
    MilestoneDeadlineNotPassed,

    // Prefront
    #[msg("Raised amount is insufficient to start prefront tranches")]
    InsufficientFundsForPrefront,
    #[msg("All prefront tranches have been claimed")]
    PrefrontFullyClaimed,
    #[msg("Prefront interval has not elapsed (one tranche per week)")]
    PrefrontIntervalNotElapsed,
    #[msg("No prefront configured for this campaign")]
    NoPrefrontConfigured,

    // Math
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
