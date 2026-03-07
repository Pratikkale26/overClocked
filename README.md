# Credence

> **Transparent, blockchain-powered crowdfunding for organizations that need to prove they mean it.**

Credence is a full-stack fundraising platform built on the **Solana** blockchain, designed specifically for Indian organizations (NGOs, colleges, student bodies, social enterprises). It combines the trustlessness of crypto with the familiar UX of UPI payments — so anyone can donate, and everyone can verify exactly where the money went.

---

## 🌟 What Makes Credence Different

Traditional crowdfunding platforms operate as black boxes. Credence flips this:

- **Every rupee is traceable** — donations are escrowed on-chain the moment they're received.
- **Funds release only when milestones are verified** — donors vote before the organization gets paid.
- **Organizations are accountable by design** — GSTIN verification, on-chain reputation scores, and a public activity log create unavoidable accountability.
- **No crypto experience needed** — donors can pay via UPI; the platform converts and deposits SOL into the vault automatically.

---

## ✨ Features & Functionality

### 🏛️ Organization Registry

Organizations are the primary actors on Credence. Before creating a campaign, an org must:

1. **Register on-chain** via the Anchor smart contract, receiving a permanent Program Derived Address (PDA).
2. **Verify their GSTIN** — the org's 15-character GST Identification Number is validated against the real GST registry (or a live API when configured), hashed using SHA-256, and stored on-chain. This proves the org is a real, registered Indian entity.
3. **Link their X (Twitter) handle** — automatically synced from their Privy-linked account for additional legitimacy.
4. **Upload verification documents** — stored in AWS S3 with presigned URLs.

Each org accumulates a **campaign completion rate** (`completionRateBps`) that is publicly visible, forming an on-chain reputation score that donors can evaluate before contributing.

---

### 📣 Campaigns

Each campaign is a fundraising project created by a verified org. Features include:

| Feature | Detail |
|---|---|
| **Goal Setting** | Optional fundraising goal in SOL (lamports), or open-ended amount |
| **Prefronting** | Organizations can receive a pre-approved upfront tranche (`prefrontLamports`) before milestones |
| **Categories & Tags** | Searchable metadata for the explore feed |
| **Campaign State** | `ACTIVE → COMPLETED / CANCELLED / FAILED` lifecycle |
| **Banner Images** | Uploaded to S3 via presigned URL, linked to campaign |
| **Deadline** | Optional funding deadline |
| **Yield Policy** | Campaigns can earn passive yield on escrowed funds (5%, 8%, or 12% APY) |
| **On-chain sync** | PDAs (`onchainProjectPda`, `onchainVaultPda`) are stored off-chain for easy lookup |

Campaigns are searchable by title, description, category, and org. The explore feed shows active campaigns with org reputation, milestone progress, and donor counts.

---

### 🏁 Milestones & Proof-of-Work

The heart of Credence's accountability model. Each campaign can have multiple milestones, each representing a concrete deliverable with an associated fund release.

#### Milestone Lifecycle

```
PENDING → UNDER_REVIEW → (APPROVED | REJECTED)
```

1. **Org completes milestone work** and posts DPR (Detailed Progress Report) activity updates with photos and evidence.
2. **Org submits proof** — uploads a GST invoice to S3, verifies the vendor's GSTIN, and submits the proof on-chain via the Anchor instruction `submit_milestone_proof`.
3. **Voting window opens** (48 hours to 7 days, configurable) — donors who contributed to the campaign can vote Approve or Reject.
4. **Smart contract executes** — if votes meet the approval threshold (`thresholdBps`, default 51%) and quorum (`quorumBps`, default 10%), funds are automatically released to the org's wallet.

#### GST Invoice Verification

When submitting milestone proof, the org must provide:

- **Their own GSTIN** (proves they are a real registered buyer)
- **The vendor's GSTIN** (proves they paid a real registered supplier)
- **Invoice file** (uploaded to S3)
- **Invoice number & amount (paise)**

The backend:
1. Validates both GSTINs against the GST registry
2. Computes a **SHA-256 commitment hash** of `(S3 key | vendor GSTIN | invoice number)`
3. Stores a **Proof-of-History chain** — each milestone's proof includes the hash of the previous milestone's proof, creating a tamper-evident audit trail
4. Returns hashes for the Anchor on-chain call, anchoring the commitment in the Solana ledger

#### DPR Activity Log (Commit-style Timeline)

Organizations post structured **progress updates** for each milestone — think of it like a git commit history for real-world work:

| Update Type | Description |
|---|---|
| `PROGRESS` | General progress note with photos |
| `EXPENSE` | Expense log entry |
| `PHOTO` | Photo documentation |
| `ANNOUNCEMENT` | Public announcement to donors |
| `COMPLETION` | Final completion declaration (one per milestone) |

Each update is content-hashed on creation for integrity. Donors can view the full timeline before voting.

#### Proof Chain & Audit Page

The `/audit` endpoint returns the **complete Proof-of-History chain** for any campaign — all milestone proofs in sequential order, linked by `prevProofHash`. Each entry includes:

- GSTIN verification status & vendor legal name
- Invoice integrity check (hash re-computed and compared on each fetch)
- On-chain proof URI
- Full DPR update timeline

---

### 💸 Donations — Dual Payment Rails

Credence supports two donation flows, unified under the same escrow vault:

#### SOL (Crypto Native)
- Donor connects their Solana wallet (Phantom, Solflare, etc.) via `@solana/wallet-adapter`
- Donor signs an on-chain `Donate` transaction directly
- After confirmation, the frontend calls `POST /api/donations/sol` to record the donation in the DB
- Duplicate recording is prevented via `txSignature` unique constraint

#### UPI / Bank Transfer (Fiat)
- Donor selects UPI and enters an INR amount
- Backend creates a **Razorpay order** and returns an `orderId` to the frontend
- Razorpay checkout handles the UPI payment
- On `payment.captured`, the **Razorpay webhook** fires:
  1. HMAC signature is verified
  2. INR amount is converted to lamports at a configurable rate (default: 1 SOL = ₹4,000)
  3. Platform **hot wallet** sends the equivalent SOL to the campaign vault on-chain
  4. Donation is confirmed in the DB atomically

Both flows prevent self-donation (orgs cannot donate to their own campaigns).

---

### 📈 Yield Accrual System

Campaigns can opt into a **yield policy** at creation time:

| Policy | Annual Rate |
|---|---|
| None | 0% |
| Conservative | 5% APY |
| Moderate | 8% APY |
| Aggressive | 12% APY |

A **daily cron job** (runs at 00:01 UTC) calculates yield on `raisedLamports` for all active campaigns with a yield policy:

```
Daily Yield = (raisedLamports × rateBps) / (10,000 × 365)
```

Accruals are stored in `YieldAccrual` records with per-period deduplication. Donors can see yield history on the campaign detail page (last 30 days shown).

> **Note**: Yield is mocked for the hackathon demo. Production would integrate with a DeFi lending protocol (e.g., Kamino, MarginFi on Solana) to generate real yield on escrowed SOL.

---

### 🔗 Helius Webhook Integration

Credence listens to on-chain events via a **Helius Enhanced Webhook**, allowing the backend to stay in sync with the Solana program without polling:

- **`Donate` instruction** → Upserts donation record + increments `raisedLamports` on the campaign
- **`FinalizeMilestone` instruction** → Syncs milestone approval state to DB
- **`PlatformOverride` instruction** → Logged for admin review

Additionally, a manual `POST /api/webhook/sync-campaign/:id` endpoint allows the frontend to push state updates after it confirms an on-chain transaction.

---

### 🛡️ Authentication & Security

- **Privy** handles all authentication — supports email, social login (Google, X/Twitter), and embedded wallets for non-crypto users
- Every protected endpoint validates the Privy JWT via middleware
- Org/campaign ownership is verified server-side before any write operation
- Razorpay webhooks are verified via **HMAC-SHA256 signature**
- Invoice hashes are deterministic commitments tied to file content, vendor, and invoice number

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
│                      Next.js Frontend (web/)                    │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │  Privy SDK │  │ Wallet Adapt.│  │  Anchor Client (IDL)  │   │
│  └────────────┘  └──────────────┘  └───────────────────────┘   │
└────────────┬───────────────────────────────────┬────────────────┘
             │ REST API                          │ Solana RPC
             ▼                                  ▼
┌────────────────────────┐         ┌─────────────────────────────┐
│   Backend API (api/)   │         │      Solana Devnet/Mainnet   │
│   Bun + Express        │◄───────►│  Anchor Program (contract/) │
│   Prisma ORM           │ Helius  │  - create_org               │
│   PostgreSQL / libSQL  │ Webhook │  - create_project           │
│   Razorpay SDK         │         │  - donate                   │
│   AWS S3 (assets)      │         │  - submit_milestone_proof   │
│   GSTIN Validator      │         │  - vote_milestone           │
│   Yield Cron (daily)   │         │  - finalize_milestone       │
└────────────────────────┘         └─────────────────────────────┘
         │                                        ▲
         │ Hot Wallet sends SOL                   │
         │ (UPI → SOL conversion)                 │
         └────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
ghrhack2/
├── api/                        # Backend — Bun + Express
│   └── src/
│       ├── index.ts            # Server entry point, route registration
│       ├── db.ts               # Prisma client singleton
│       ├── middleware/
│       │   └── auth.ts         # Privy JWT verification middleware
│       ├── routes/
│       │   ├── auth.ts         # User profile & wallet sync
│       │   ├── campaigns.ts    # Campaign CRUD, banner upload
│       │   ├── milestones.ts   # Proof submission, voting, DPR updates, audit chain
│       │   ├── donations.ts    # SOL & UPI donation flows
│       │   ├── orgs.ts         # Org registration, GSTIN verification, logo upload
│       │   └── webhook.ts      # Helius on-chain event listener, manual sync
│       └── services/
│           ├── gstin.service.ts# GSTIN format validation + live GST API integration
│           ├── s3.ts           # AWS S3 presigned URL helpers
│           ├── solana.ts       # Hot wallet SOL transfer (UPI conversion)
│           ├── user.service.ts # Privy user upsert
│           └── yield.ts        # Daily yield accrual cron job
│
├── web/                        # Frontend — Next.js 16 + Tailwind CSS v4
│   └── app/
│       ├── page.tsx            # Landing page
│       ├── explore/            # Campaign discovery feed
│       ├── campaign/[id]/      # Campaign detail & milestone voting
│       ├── create/             # Campaign creation flow
│       ├── dashboard/          # Org dashboard (my campaigns, donations)
│       └── org/[wallet]/       # Public org profile page
│
└── contract/                   # Solana Smart Contracts — Anchor Framework
    └── programs/               # On-chain escrow, milestone voting, org registry
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Purpose |
|---|---|
| [Bun](https://bun.sh/) | API runtime & package manager |
| [Node.js 20+](https://nodejs.org/) | Next.js frontend runtime |
| [Rust + Cargo](https://www.rust-lang.org/) | Anchor contract compilation |
| [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) | Local validator & wallet management |
| [Anchor CLI](https://www.anchor-lang.com/docs/installation) | Smart contract build & deploy |

### 1. Clone & Install

```bash
git clone <repo-url>
cd ghrhack2

# Install API dependencies
cd api && bun install && cd ..

# Install frontend dependencies
cd web && npm install && cd ..
```

### 2. Configure Environment Variables

**`api/.env`**
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/credence"

# Privy
PRIVY_APP_ID="your-privy-app-id"
PRIVY_APP_SECRET="your-privy-app-secret"

# AWS S3
AWS_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
S3_BUCKET_NAME="credence-assets"

# Razorpay (UPI payments)
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."

# Hot wallet (for UPI → SOL conversion)
HOT_WALLET_PRIVATE_KEY="[1,2,3,...]"  # JSON byte array
SOLANA_RPC_URL="https://api.devnet.solana.com"

# Optional: live GSTIN validation
GST_VALIDATE_MODE="live"   # or leave unset for mock mode
GST_API_URL="https://api.mastergst.com/masterapi/official/gstin"
GST_API_KEY="..."

# SOL/INR conversion rate
SOL_INR_RATE=4000
```

**`web/.env.local`**
```env
NEXT_PUBLIC_PRIVY_APP_ID="your-privy-app-id"
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com"
```

### 3. Set Up Database

```bash
cd api
bunx prisma generate      # Generate Prisma client types
bunx prisma db push       # Push schema to your database
```

### 4. Run Locally

**Start the backend (port 3001):**
```bash
cd api
bun run dev
```

**Start the frontend (port 3000):**
```bash
cd web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy Smart Contract (Devnet)

```bash
cd contract
anchor build
anchor deploy --provider.cluster devnet
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/orgs/gstin/verify` | Validate a GSTIN and get its hash for on-chain use |
| `POST` | `/api/orgs` | Register a new org (after on-chain `create_org`) |
| `GET` | `/api/orgs/:walletAddress` | Get org profile + all campaigns |
| `POST` | `/api/campaigns` | Create a new campaign (after on-chain `create_project`) |
| `GET` | `/api/campaigns` | List active campaigns (filterable by org, category, search) |
| `GET` | `/api/campaigns/mine` | Authenticated user's campaigns |
| `GET` | `/api/campaigns/donated` | Campaigns the user has donated to |
| `GET` | `/api/campaigns/:id` | Full campaign detail (donations + yield history) |
| `POST` | `/api/milestones/:id/proof` | Submit GST-verified milestone proof |
| `GET` | `/api/milestones/:id/proof` | Fetch proof details for donor review |
| `POST` | `/api/milestones/:id/updates` | Post a DPR activity log update |
| `GET` | `/api/milestones/:id/updates` | Fetch full activity timeline |
| `GET` | `/api/milestones/:id/full` | Full milestone: proof + DPR timeline |
| `GET` | `/api/milestones/campaign/:id/proof-chain` | Complete audit chain for a campaign |
| `POST` | `/api/donations/upi-intent` | Create Razorpay order for UPI donation |
| `POST` | `/api/donations/upi-webhook` | Razorpay webhook (payment.captured) |
| `POST` | `/api/donations/sol` | Record an on-chain SOL donation |
| `GET` | `/api/donations/:campaignId` | List confirmed donations for a campaign |
| `POST` | `/api/webhook/helius` | Helius on-chain event listener |
| `POST` | `/api/webhook/sync-campaign/:id` | Manual state sync after on-chain tx |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Blockchain** | Solana, Anchor Framework |
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4 |
| **Authentication** | Privy (email, social, embedded wallets) |
| **Wallet** | `@solana/wallet-adapter` (Phantom, Solflare, etc.) |
| **Backend** | Bun runtime, Express 5 |
| **Database** | Prisma ORM, PostgreSQL (LibSQL compatible) |
| **Storage** | AWS S3 (presigned URLs for uploads) |
| **Payments** | Razorpay (UPI / bank transfers) |
| **On-chain events** | Helius Enhanced Webhooks |
| **Scheduling** | `node-cron` (daily yield accrual) |
| **Icons** | Lucide React |
| **Toasts** | Sonner |

---

## 🗓️ Hackathon Scope (V1)

- [x] On-chain org registry with GSTIN hash
- [x] Campaign creation with milestone definitions
- [x] SOL donation flow (native wallet)
- [x] UPI donation flow (Razorpay → hot wallet conversion)
- [x] GST invoice proof submission with vendor verification
- [x] Milestone DPR activity log (commit-style)
- [x] Proof-of-History audit chain
- [x] Donor voting via on-chain Anchor instruction
- [x] Yield accrual simulation (mocked DeFi)
- [x] Helius webhook for on-chain event listening
- [ ] Real DeFi yield integration (Kamino/MarginFi)
- [ ] Full on-chain donor vote tallying (currently relies on Anchor for vote counting)
- [ ] Mobile app

---

## 📜 License

MIT — built with ❤️ for the hackathon.