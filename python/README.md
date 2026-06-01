# rail402-x402 (Python)

[![PyPI](https://img.shields.io/pypi/v/rail402-x402.svg)](https://pypi.org/project/rail402-x402/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

The Python distribution of the [`@rail402/x402`](https://github.com/rail402/x402-sdk)
SDK — make any REST endpoint x402-payable with USDC on Base.

## Install

```bash
pip install rail402-x402             # core + web3 verification
pip install "rail402-x402[fastapi]"  # + FastAPI / Starlette middleware
```

## FastAPI middleware

```python
from fastapi import FastAPI, Request
from rail402_x402 import X402Middleware

app = FastAPI()
X402Middleware(
    app,
    price="0.05",
    wallet="0xYourPayoutWallet",
    network="base",            # or "base-sepolia"
    protected_paths=["/api/risk"],
)

@app.post("/api/risk")
async def risk(request: Request):
    # request.state.x402 holds the verified payment
    return {"score": 0.92, "paidBy": request.state.x402.payer_wallet}
```

## Standalone verification

```python
from rail402_x402 import verify_payment

result = verify_payment(
    tx_hash="0x...",
    amount_atomic="50000",
    pay_to="0xYourPayoutWallet",
    network="base",
)
if result.valid:
    print("paid by", result.payer_wallet)
```

## Develop

```bash
pip install -e ".[dev,fastapi]"
pytest
ruff check .
```

MIT © Rail402
