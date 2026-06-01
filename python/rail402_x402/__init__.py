"""rail402-x402 — make any REST endpoint x402-payable with USDC on Base."""

from .types import (
    NETWORKS,
    USDC_DECIMALS,
    Network,
    PaymentRequirements,
    VerificationResult,
    to_atomic,
)
from .verify import verify_payment

__all__ = [
    "NETWORKS",
    "USDC_DECIMALS",
    "Network",
    "PaymentRequirements",
    "VerificationResult",
    "to_atomic",
    "verify_payment",
    "X402Middleware",
]

__version__ = "0.1.0"


def __getattr__(name: str):
    # Lazily import the FastAPI middleware so `web3`-only installs don't need
    # Starlette/FastAPI present unless they actually use the middleware.
    if name == "X402Middleware":
        from .middleware import X402Middleware

        return X402Middleware
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
