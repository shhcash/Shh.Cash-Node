# SHH Node (Phase 2 - Smart Contract Required)

⚠️ **IMPORTANT: Nodes are NOT operational yet!** ⚠️

This repository allows developers to **prepare and test** node infrastructure for the **Shh.cash** privacy relay network. Nodes will only become operational in **Phase 2** when the smart contract launches.

## Current Status: Phase 1 (Centralized MVP)
- ✅ Users can make privacy transfers through shh.cash
- ❌ **Nodes are NOT active** - all processing is centralized
- 🔧 This repo is for **setup and testing only**

## Phase 2 (Coming Soon - Smart Contract)
- 🎯 Nodes will execute privacy transfers and earn SOL rewards
- 🔗 On-chain Router program will coordinate all operations
- 💰 Instant SOL payouts for successful executions

---

## What This Repo Provides

**For Phase 1 (Current)**
- 🛠️ **Setup tools** to prepare your node infrastructure
- 🧪 **Testing utilities** to validate wallet setup and configuration
- 📋 **Registration system** to get on the waitlist for Phase 2
- 📚 **Documentation** and examples for node operators

**For Phase 2 (When Smart Contract Launches)**
- 🎯 Subscribe to **part offers** from the on-chain Router program
- ⚡ Execute privacy transfers via smart contract calls
- 💰 Receive **instant SOL rewards** for successful executions
- 📊 Monitor earnings and performance through dashboard

---

## Architecture (simple + safe)

- **Node**: a small TypeScript service with two keys:
  - `NODE_SIGNER` – signs API messages to verify you are you.
  - `RELAY_SIGNER` – signs Solana transfers (spends SOL/USDC from your relay wallet).
- **Fee payer**: provided by the network; your node **does not** need extra SOL for fees in the sponsored mode. (Fallback: use your own fee payer if sponsorship is unavailable.)
- **Dispatcher**: offers parts to nodes, verifies receipts, and schedules payouts (MVP).

> Privacy note: the network prefers **multiple relay wallets**. You can list more than one `RELAY_SIGNER` in config to rotate per part.

---

## Requirements

- Node.js 18+
- Solana CLI (optional, for local testing)
- RPC endpoint (Helius, Triton, QuickNode, or public devnet RPC)
- A fresh Solana **relay wallet** with some test SOL/USDC (devnet) or mainnet when live

---

## Phase 1 Setup (Preparation Only)

**⚠️ Important: Running these commands will NOT make your node operational yet!**

```bash
# 1) Clone this preparation repo
git clone https://github.com/shh-cash/shh-node.git
cd shh-node

# 2) Install dependencies
npm install

# 3) Generate your node credentials
npm run generate:keys

# 4) Copy and configure environment
cp .env.example .env.local
# Edit .env.local with your generated keys
```

**Configure your `.env.local`:**
```env
# Your node will connect to these when Phase 2 launches
RPC_URL=https://api.mainnet-beta.solana.com
NODE_SIGNER_SECRET=[generated_by_key_script]
RELAY_SIGNERS=[generated_relay_wallets]

# Phase 2 settings (not active yet)
DISPATCHER_URL=https://router.shh.cash
FEE_PAYER_MODE=sponsored
```

**Test your setup:**
```bash
# Validate configuration
npm run test:setup

# Check wallet balances
npm run test:wallets

# Run mock node (simulation only)
npm run dev:mock
```

**Expected output:**
```
✅ Configuration valid
✅ Wallets properly funded
🧪 Mock node ready for Phase 2
⏳ Waiting for smart contract launch...
```

---

## How Offers & Execution Work

### 1) Subscribe
Node opens an SSE/WebSocket or polls: `GET /api/node/offers?since=<cursor>`  
Headers include a **signed** `X-Node-Pubkey` and `X-Signature` (HMAC/ed25519 over timestamp).

### 2) Accept
When an offer arrives:
```http
POST /api/node/accept
{
  "offerId": "uuid"
}
```
- Dispatcher marks the part **running** for your node (race-safe).

### 3) Execute
- Build the Solana transaction for the part:
  - **SOL**: SystemProgram.transfer(from=`RELAY_SIGNER`, to=recipient, lamports=amount)
  - **USDC**: Ensure recipient ATA (create if missing), then SPL transfer from your relay ATA.
- **Fee payer**: if `FEE_PAYER_MODE=sponsored`, set `tx.feePayer = SponsoredPubkey` and include sponsor signature (dispatcher provides a signed blockhash + payer partial sig or co-signs after you attach your sig). Otherwise use your own `FEE_PAYER_SECRET`.
- Send and wait for `confirmed`.

### 4) Receipt
```http
POST /api/node/receipt
{
  "partId": "uuid",
  "txSig": "5q...",
  "spentLamports": 5000
}
```
Dispatcher verifies on-chain, then schedules **SOL payout** to your `RELAY_SIGNER` (MVP).

> After the Router contract launches, step 3 becomes a program call `execute_part(...)`. The **program** pays your SOL reward instantly; no off‑chain payout job.

---

## Security Best Practices

- Keep `NODE_SIGNER` and `RELAY_SIGNERS` in `.env.local` **only** on the node machine (never commit).  
- Use a dedicated RPC key.  
- Set per‑tx and per‑day caps in `config.json` (included template).  
- Run under a process manager (PM2, systemd) with log rotation.

---

## Payouts (MVP vs. On‑Chain)

- **MVP**: The dispatcher transfers your SOL rewards periodically (e.g., every N confirmations or hourly). Check `/api/node/earnings` for your running total.
- **On‑Chain**: Each successful `execute_part` triggers an immediate **SOL payout from the program’s fee vault** to your signer wallet.

---

## Local Testing

```bash
# fund relay on devnet
solana airdrop 2 <RELAY_PUBKEY> --url https://api.devnet.solana.com

# generate a test USDC mint + ATA (scripts provided)
npm run mint:usdc
```

Send yourself a test offer using the mock dispatcher:
```bash
npm run dispatcher:mock-offer -- --asset SOL --amount 10000000 --recipient <RECIP_PUBKEY>
```

---

## Node JSON Config (optional fine‑tuning)

`config.json`:
```json
{
  "maxConcurrent": 3,
  "retry": { "max": 3, "backoffMs": 1500 },
  "caps": { "perTxLamports": 500000000, "perDayLamports": 5000000000 },
  "rotation": { "strategy": "round_robin" },
  "privacy": { "avoidPercents": [5,10,20,25,33,50], "delayJitterSec": [0, 600] }
}
```

---

## API Spec (Dispatcher)

- `GET /api/node/offers?since=cursor` → stream/poll offers
- `POST /api/node/accept` → claim a part
- `POST /api/node/receipt` → submit tx signature
- `GET /api/node/earnings` → running SOL total
- `POST /api/node/heartbeat` → health (balance, version, latency)

All requests must include `X-Node-Pubkey` and `X-Signature: sign(ed25519, timestamp + path + body)`.

---

## Roadmap

- ✅ Off‑chain MVP payouts in SOL  
- 🔜 Router program (on‑chain `prepare_send`, `execute_part`, payout in SOL)  
- 🔜 Node registry + optional SHH stake (anti‑sybil)  
- 🔜 Open telemetry dashboard + leaderboards  
- 🔜 Multirelay rotation & fee sponsorship by default

---

## FAQ

**Q: Do I need SOL to pay fees?**  
A: In sponsored mode, **no**—the network pays. Otherwise set `FEE_PAYER_MODE=self` and fund your payer wallet.

**Q: Do I get paid in SHH?**  
A: No. Operators are paid in **SOL**. SHH is **burned by users** to access private sends.

**Q: Will I need to change anything after the smart contract launches?**  
A: No code changes to your wallet setup. The execution call becomes an on‑chain instruction; payouts happen on‑chain automatically.


---

## Community
- Site: https://www.shh.cash/
- X/Twitter: [https://x.com/shh_cash](https://x.com/i/communities/1955482872564855202)
- Whitepaper: [https://shh.cash/docs](https://www.shh.cash/WhitePaper.pdf)
