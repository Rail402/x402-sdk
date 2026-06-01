"""FastAPI / Starlette middleware that gates routes behind an x402 payment."""
from __future__ import annotations

import json
from typing import Iterable, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .types import Network, PaymentRequirements
from .verify import verify_payment


class X402Middleware(BaseHTTPMiddleware):
    """Require a USDC payment on Base before protected routes run.

    Example::

        app = FastAPI()
        X402Middleware(
            app,
            price="0.05",
            wallet="0xYourWallet",
            network="base",
            protected_paths=["/api/risk"],
        )
    """

    def __init__(
        self,
        app,
        price: str | float,
        wallet: str,
        network: Network = "base",
        protected_paths: Optional[Iterable[str]] = None,
        rpc_url: Optional[str] = None,
        min_confirmations: int = 1,
        description: Optional[str] = None,
    ) -> None:
        super().__init__(app)
        self.price = price
        self.wallet = wallet
        self.network = network
        self.protected_paths = list(protected_paths) if protected_paths else None
        self.rpc_url = rpc_url
        self.min_confirmations = min_confirmations
        self.description = description

    def _is_protected(self, path: str) -> bool:
        if self.protected_paths is None:
            return True
        return any(path.startswith(p) for p in self.protected_paths)

    async def dispatch(self, request: Request, call_next):
        if not self._is_protected(request.url.path):
            return await call_next(request)

        requirements = PaymentRequirements.create(
            self.price,
            self.wallet,
            network=self.network,
            description=self.description,
            resource=request.url.path,
        )

        def challenge(error: Optional[str] = None) -> JSONResponse:
            body = requirements.to_dict()
            if error:
                body["error"] = error
            return JSONResponse(
                body,
                status_code=402,
                headers={
                    "X-Payment-Required": "true",
                    "X-Payment-Network": requirements.network,
                    "X-Payment-Amount": requirements.amount_atomic,
                    "X-Payment-Currency": requirements.currency,
                    "X-Payment-Address": requirements.pay_to,
                },
            )

        raw_proof = request.headers.get("x-payment-proof")
        if not raw_proof:
            return challenge()

        try:
            proof = json.loads(raw_proof)
        except (ValueError, TypeError):
            return challenge("Malformed x-payment-proof header")

        tx_hash = proof.get("txHash") if isinstance(proof, dict) else None
        if not tx_hash:
            return challenge()

        result = verify_payment(
            tx_hash,
            requirements.amount_atomic,
            self.wallet,
            network=self.network,
            rpc_url=self.rpc_url,
            min_confirmations=self.min_confirmations,
        )
        if not result.valid:
            return challenge(result.error)

        # Expose the verified payment to downstream handlers.
        request.state.x402 = result
        return await call_next(request)
