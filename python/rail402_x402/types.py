"""Core x402 dataclasses and network configuration."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

Network = Literal["base", "base-sepolia"]

USDC_DECIMALS = 6

# keccak256("Transfer(address,address,uint256)")
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

NETWORKS = {
    "base": {
        "chain_id": 8453,
        "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "default_rpc": "https://mainnet.base.org",
    },
    "base-sepolia": {
        "chain_id": 84532,
        "usdc": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "default_rpc": "https://sepolia.base.org",
    },
}


def to_atomic(price: str | float, decimals: int = USDC_DECIMALS) -> str:
    """Convert a human-readable price to atomic USDC units (string, no float)."""
    s = f"{price:.{decimals}f}" if isinstance(price, float) else str(price).strip()
    if "." in s:
        whole, frac = s.split(".", 1)
    else:
        whole, frac = s, ""
    frac_padded = (frac + "0" * decimals)[:decimals]
    combined = (whole + frac_padded).lstrip("0")
    return combined or "0"


@dataclass
class PaymentRequirements:
    pay_to: str
    amount: str
    amount_atomic: str
    network: Network = "base"
    currency: str = "USDC"
    chain_id: int = 8453
    description: Optional[str] = None
    resource: Optional[str] = None
    expires_at: str = field(default="")
    type: str = "x402_payment_required"

    @classmethod
    def create(
        cls,
        price: str | float,
        wallet: str,
        network: Network = "base",
        description: Optional[str] = None,
        resource: Optional[str] = None,
        expires_in_seconds: int = 600,
    ) -> "PaymentRequirements":
        net = NETWORKS[network]
        expires = datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
        return cls(
            pay_to=wallet,
            amount=str(price),
            amount_atomic=to_atomic(price),
            network=network,
            chain_id=net["chain_id"],
            description=description,
            resource=resource,
            expires_at=expires.isoformat(),
        )

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "amount": self.amount,
            "amountAtomic": self.amount_atomic,
            "currency": self.currency,
            "network": self.network,
            "chainId": self.chain_id,
            "payTo": self.pay_to,
            "resource": self.resource,
            "description": self.description,
            "expiresAt": self.expires_at,
        }


@dataclass
class VerificationResult:
    valid: bool
    tx_hash: Optional[str] = None
    payer_wallet: Optional[str] = None
    amount_atomic: Optional[str] = None
    error: Optional[str] = None
