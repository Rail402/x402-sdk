import { NETWORKS, USDC_DECIMALS } from "./constants";
import type { X402Network, X402Options, X402PaymentRequirements } from "./types";

/**
 * Convert a human-readable price into atomic USDC units (no floating point).
 *
 * @example toAtomic("0.05") // "50000"
 * @example toAtomic(1)      // "1000000"
 */
export function toAtomic(price: string | number, decimals = USDC_DECIMALS): string {
  const str = typeof price === "number" ? price.toFixed(decimals) : price.trim();
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid price "${price}": expected a non-negative decimal`);
  }
  const [whole, frac = ""] = str.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, "");
  return combined === "" ? "0" : combined;
}

/** Convert atomic USDC units back to a human-readable string. */
export function fromAtomic(atomic: string, decimals = USDC_DECIMALS): string {
  const padded = atomic.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Build the JSON body returned with an HTTP 402 response.
 */
export function createPaymentRequirements(options: X402Options): X402PaymentRequirements {
  const network: X402Network = options.network ?? "base";
  const net = NETWORKS[network];
  const expiresInSeconds = options.expiresInSeconds ?? 600;

  return {
    type: "x402_payment_required",
    amount: typeof options.price === "number" ? String(options.price) : options.price,
    amountAtomic: toAtomic(options.price),
    currency: "USDC",
    network,
    chainId: net.chainId,
    payTo: options.wallet,
    resource: options.resource,
    description: options.description,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
}
