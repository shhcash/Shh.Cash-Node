# SHH Node (Pre-Contract Alpha)

Run a node for the **Shh.cash** privacy relay network. This repo lets developers set up and register nodes **before** the on‑chain Router program launches. In the MVP phase, nodes relay off‑chain sends and earn **SOL** fees via the dispatcher. After launch, execution and payouts will move **on‑chain** (no change to your node interface).

---

## What a Node Does (MVP → Contract)

**Today (off‑chain MVP)**
- Subscribe to **part offers** (split transfers) from the dispatcher.
- Accept offers, **build & send** Solana transactions (SOL or USDC).
- Return a signed **receipt** (tx signature).  
- Earn SOL fee share via payout jobs (off‑chain transfer).

**Later (on‑chain Router)**
- Exact same flow, but `execute_part` is an **on‑chain instruction**.  
- The program pays your node **in SOL directly** per execution.  
- No wallet change required; same `.env` and command line.

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

## Quick Start

```bash
# 1) Clone the repo
git clone https://github.com/your-org/shh-node.git
cd shh-node

# 2) Install
npm i

# 3) Copy env template
cp .env.example .env.local
```

Edit `.env.local`:
```env
# RPC
RPC_URL=https://api.devnet.solana.com

# Node identity (ed25519 base58 or base64 JSON array)
NODE_SIGNER_SECRET=[...]

# One or more relay wallets (comma-separated)
RELAY_SIGNERS=["[...key1...]", "[...key2...]"]

# Dispatcher API (provided by Shh.cash)
DISPATCHER_URL=https://dispatcher.dev.shh.cash

# Optional: Sponsored fees
FEE_PAYER_MODE=sponsored   # 'sponsored' | 'self'
FEE_PAYER_SECRET=[...]     # only used if FEE_PAYER_MODE=self

# Telemetry (optional)
HEARTBEAT_INTERVAL_MS=30000
```

Run:
```bash
npm run start
```

You should see:
```
✔ heartbeat sent
✔ subscribed to offers
…
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
