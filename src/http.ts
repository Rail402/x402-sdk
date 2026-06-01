import { X402_HEADERS } from "./constants";
import type { X402PaymentProof, X402PaymentRequirements } from "./types";

/** Parse an `X-Payment-Proof` header value into a proof object, or null. */
export function parseProofHeader(
  value: string | string[] | undefined | null,
): X402PaymentProof | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as X402PaymentProof;
    return parsed && typeof parsed.txHash === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/** Standard headers to accompany a 402 challenge response. */
export function requirementHeaders(req: X402PaymentRequirements): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Payment-Required": "true",
    "X-Payment-Network": req.network,
    "X-Payment-Amount": req.amountAtomic,
    "X-Payment-Currency": req.currency,
    "X-Payment-Address": req.payTo,
  };
}

export { X402_HEADERS };
