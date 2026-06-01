# @rail402/x402

[![npm](https://img.shields.io/npm/v/@rail402/x402.svg)](https://www.npmjs.com/package/@rail402/x402)
[![PyPI](https://img.shields.io/pypi/v/rail402-x402.svg)](https://pypi.org/project/rail402-x402/)
[![CI](https://github.com/rail402/x402-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/rail402/x402-sdk/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Base](https://img.shields.io/badge/network-Base-0052FF.svg)](https://base.org)

> Make any REST endpoint **x402-payable** with USDC on **Base** — in one line.

`@rail402/x402` (npm) and `rail402-x402` (PyPI) turn an ordinary HTTP endpoint
into one that requires a USDC micropayment before it runs. It implements the
[x402 protocol](https://github.com/rail402/agent-services-spec): a server replies
`402 Payment Required` with machine-readable payment terms, the caller settles
USDC on Base and retries with a proof, and the SDK verifies that proof **directly
against on-chain state** — no indexer, no custodian, no third-party API.

It's the same verification logic that powers the [Rail402 marketplace](https://rail402.app).

---

## Why x402?

AI agents can't fill in credit-card forms. x402 revives the long-dormant HTTP
`402` status code as a programmatic payment handshake, so an autonomous agent can
discover a price, pay it in stablecoin, and get its result — all in two HTTP
round-trips, with zero human in the loop.

```
┌────────┐   POST /api/risk            ┌────────┐
│        │ ─────────────────────────▶  │        │
│ Agent  │   402 + payment terms       │ Your   │
│        │ ◀─────────────────────────  │  API   │
│        │   ── pay USDC on Base ──▶ 🔗 │        │
│        │   POST + X-Payment-Proof    │        │
│        │ ─────────────────────────▶  │        │
│        │   200 + result              │        │
└────────┘ ◀─────────────────────────  └────────┘
```

---

## Install

```bash
# TypeScript / JavaScript
npm install @rail402/x402 viem

# Python
pip install rail402-x402            # core + web3
pip install "rail402-x402[fastapi]" # + FastAPI middleware
```

`viem` is a peer dependency (TS) and `web3` a dependency (Python); these are the
SDK's only runtime requirements.

---

## Quick start

### Express

```ts
import express from "express";
import { withX402 } from "@rail402/x402";

const app = express();
app.use(express.json());

app.post(
  "/api/risk",
  withX402(
    async (req, res) => {
      // Only runs after a verified USDC payment.
      // req.x402.payerWallet holds the address that paid.
      res.json({ score: 0.92, paidBy: req.x402!.payerWallet });
    },
    { price: "0.05", wallet: "0xYourPayoutWallet", network: "base" },
  ),
);

app.listen(3000);
```

### Next.js (App Router)

```ts
// app/api/risk/route.ts
import { withX402Payment } from "@rail402/x402";

export const POST = withX402Payment(
  async (req, { x402 }) => {
    return Response.json({ score: 0.92, paidBy: x402.payerWallet });
  },
  { price: "0.05", wallet: "0xYourPayoutWallet", network: "base" },
);
```

### FastAPI (Python)

```python
from fastapi import FastAPI, Request
from rail402_x402 import X402Middleware

app = FastAPI()
X402Middleware(
    app,
    price="0.05",
    wallet="0xYourPayoutWallet",
    network="base",
    protected_paths=["/api/risk"],
)

@app.post("/api/risk")
async def risk(request: Request):
    return {"score": 0.92, "paidBy": request.state.x402.payer_wallet}
```

### Calling a paid endpoint (client)

```ts
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { fetchWithPayment } from "@rail402/x402";

const wallet = createWalletClient({
  account: privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`),
  chain: base,
  transport: http(),
});

// Automatically settles the 402 challenge and retries once.
const res = await fetchWithPayment(
  "https://api.example.com/api/risk",
  { method: "POST", body: JSON.stringify({ address: "0x..." }) },
  wallet,
);
console.log(await res.json());
```

---

## API reference

### Server adapters

#### `withX402(handler, options)` — Express

Wraps an Express handler. Returns `402` with payment terms until a valid proof
arrives, then attaches `req.x402` (an `X402VerificationResult`) and calls your
handler.

#### `withX402Payment(handler, options)` — Next.js App Router

Wraps a route handler `(req: Request) => Response`. On success calls
`handler(req, { x402 })`.

#### `X402Middleware(app, price, wallet, network, ...)` — FastAPI / Starlette

ASGI middleware. Protects all routes, or just `protected_paths`. On success sets
`request.state.x402`.

### `X402Options`

| Field              | Type                        | Default  | Description                                  |
| ------------------ | --------------------------- | -------- | -------------------------------------------- |
| `price`            | `string \| number`          | —        | Human-readable USDC price, e.g. `"0.05"`.    |
| `wallet`           | `0x${string}`               | —        | Payout address (`payTo`).                    |
| `network`          | `"base" \| "base-sepolia"`  | `"base"` | Settlement network.                          |
| `description`      | `string`                    | —        | Surfaced in the 402 challenge.               |
| `resource`         | `string`                    | —        | Resource identifier in the challenge.        |
| `rpcUrl`           | `string`                    | public   | Override the Base RPC used for verification. |
| `minConfirmations` | `number`                    | `1`      | Confirmations required before accepting.     |
| `expiresInSeconds` | `number`                    | `600`    | Challenge validity window.                   |

### Verification

#### `verifyPayment(proof, expected) → Promise<X402VerificationResult>`

Verifies a proof against the on-chain receipt. Checks that the transaction
exists, succeeded, has enough confirmations, and contains a USDC `Transfer` to
`expected.payTo` of at least `expected.amountAtomic`.

```ts
const result = await verifyPayment(
  { txHash: "0x..." },
  { amountAtomic: "50000", payTo: "0x...", network: "base" },
);
// { valid: true, payerWallet: "0x...", amountAtomic: "50000", txHash: "0x..." }
```

### Client helpers

| Function                              | Purpose                                                      |
| ------------------------------------- | ------------------------------------------------------------ |
| `fetchWithPayment(url, init, wallet)` | `fetch` that auto-settles a 402 and retries once.            |
| `payRequirements(wallet, reqs)`       | Send the USDC transfer for a challenge, return a proof.      |
| `isPaymentRequired(body)`             | Type guard for an x402 challenge body.                       |

### Utilities

| Function                       | Purpose                                          |
| ------------------------------ | ------------------------------------------------ |
| `createPaymentRequirements(o)` | Build a 402 challenge body.                      |
| `toAtomic(price)`              | `"0.05"` → `"50000"` (6-decimal USDC, no float). |
| `fromAtomic(atomic)`           | `"50000"` → `"0.05"`.                            |
| `parseProofHeader(value)`      | Parse `X-Payment-Proof` JSON safely.             |

### Networks

| Network         | Chain ID | USDC                                         |
| --------------- | -------- | -------------------------------------------- |
| `base`          | `8453`   | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `base-sepolia`  | `84532`  | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

---

## The 402 wire format

A challenge response (`HTTP 402`):

```json
{
  "type": "x402_payment_required",
  "amount": "0.05",
  "amountAtomic": "50000",
  "currency": "USDC",
  "network": "base",
  "chainId": 8453,
  "payTo": "0xYourPayoutWallet",
  "resource": "/api/risk",
  "expiresAt": "2026-06-01T12:34:56.000Z"
}
```

The retried request carries the proof:

```
X-Payment-Proof: {"txHash":"0xabc...","payerWallet":"0xdef..."}
```

See the full spec at [rail402/agent-services-spec](https://github.com/rail402/agent-services-spec).

---

## Publishing to the Rail402 marketplace

Once your endpoint is live and x402-payable, list it so agents can discover it:

1. Connect your wallet at **[rail402.app/publish](https://rail402.app/publish)**.
2. Provide your endpoint URL, price, and JSON Schemas.
3. Submit for review — approved services appear in the marketplace and the
   `/.well-known/agent-services.json` discovery feed.

The `wallet` you pass to the SDK should match your provider payout wallet.

---

## Development

```bash
npm install
npm run build       # tsup → ESM + CJS + d.ts
npm test            # vitest
npm run typecheck   # tsc --noEmit

# Python
cd python
pip install -e ".[dev,fastapi]"
pytest
```

## Contributing

Issues and PRs welcome. Please:

1. Fork and branch from `main`.
2. Add tests for any behavior change (`npm test` must stay green).
3. Run `npm run typecheck` and `npm run lint` before opening a PR.
4. Keep the runtime dependency surface at **viem only** (TS) / **web3 only** (Python core).

## License

MIT © Rail402
