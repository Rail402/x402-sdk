"""On-chain verification of x402 payment proofs on Base via web3.py."""
from __future__ import annotations

import re
from typing import Optional

from web3 import Web3

from .types import NETWORKS, TRANSFER_TOPIC, Network, VerificationResult

_TX_HASH_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")


def _topic_to_address(topic: str | bytes) -> str:
    hexstr = topic.hex() if isinstance(topic, (bytes, bytearray)) else topic
    hexstr = hexstr[2:] if hexstr.startswith("0x") else hexstr
    return Web3.to_checksum_address("0x" + hexstr[-40:])


def verify_payment(
    tx_hash: str,
    amount_atomic: str,
    pay_to: str,
    network: Network = "base",
    rpc_url: Optional[str] = None,
    min_confirmations: int = 1,
) -> VerificationResult:
    """Verify a USDC payment by inspecting its transaction receipt on Base.

    A proof is valid only when the transaction exists, succeeded, has enough
    confirmations, and contains a USDC ``Transfer`` to ``pay_to`` of at least
    ``amount_atomic``.
    """
    if not tx_hash or not _TX_HASH_RE.match(tx_hash):
        return VerificationResult(valid=False, error="Invalid or missing transaction hash")

    net = NETWORKS[network]
    w3 = Web3(Web3.HTTPProvider(rpc_url or net["default_rpc"]))

    try:
        receipt = w3.eth.get_transaction_receipt(tx_hash)
    except Exception:  # noqa: BLE001 - any RPC/lookup failure is "not found"
        return VerificationResult(valid=False, error="Transaction not found or not yet mined")

    if receipt.get("status") != 1:
        return VerificationResult(valid=False, error="Transaction reverted on-chain")

    if min_confirmations > 1:
        confirmations = w3.eth.block_number - receipt["blockNumber"] + 1
        if confirmations < min_confirmations:
            return VerificationResult(
                valid=False,
                error=f"Insufficient confirmations ({confirmations}/{min_confirmations})",
            )

    usdc = Web3.to_checksum_address(net["usdc"])
    expected_to = Web3.to_checksum_address(pay_to)
    required = int(amount_atomic)

    for log in receipt["logs"]:
        if Web3.to_checksum_address(log["address"]) != usdc:
            continue
        topics = log["topics"]
        if len(topics) < 3:
            continue
        topic0 = topics[0].hex() if hasattr(topics[0], "hex") else topics[0]
        if not topic0.lower().endswith(TRANSFER_TOPIC[2:]):
            continue
        if _topic_to_address(topics[2]) != expected_to:
            continue
        value = int(log["data"].hex() if hasattr(log["data"], "hex") else log["data"], 16)
        if value >= required:
            return VerificationResult(
                valid=True,
                tx_hash=tx_hash,
                payer_wallet=_topic_to_address(topics[1]),
                amount_atomic=str(value),
            )

    return VerificationResult(valid=False, error="No matching USDC transfer found in transaction")
