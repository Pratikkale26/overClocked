pub const PLATFORM_SEED: &[u8] = b"platform_config";
pub const ORG_SEED: &[u8] = b"org";
pub const PROJECT_SEED: &[u8] = b"project";
pub const DONOR_RECORD_SEED: &[u8] = b"donor_record";
pub const VAULT_SEED: &[u8] = b"vault";

pub const PLATFORM_FEE_BPS: u16 = 200; // 2%
pub const EARLY_EXIT_PENALTY_BPS: u64 = 500; // 5% in bps
pub const DEFAULT_QUORUM_BPS: u16 = 1_000; // 10%
pub const DEFAULT_THRESHOLD_BPS: u16 = 5_100; // 51%
pub const MAX_MILESTONES: usize = 10;
pub const MAX_PROOF_URI_LEN: usize = 200;
pub const PREFRONT_INTERVAL_SECS: i64 = 604_800; // 1 week
pub const MAX_RESUBMISSIONS: u8 = 3;
pub const WITHDRAWAL_GRACE_PERIOD_SECS: i64 = 14 * 24 * 3600; // 14 days
