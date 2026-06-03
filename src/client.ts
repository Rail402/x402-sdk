import { encodeFunctionData, getAddress, type WalletClient } from "viem";
import { NETWORKS } from "./constants";
import type {
  X402PaymentProof,
  X402PaymentRequirements,
} from "./types";

/** Type guard: is this response body an x402 challenge? */
export function isPaymentRequired(body: unknown): body is X402PaymentRequirements {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { type?: unknown }).type === "x402_payment_required"
  );
}

/**
 * Extract the x402 requirements from a 402 response body, whether the gateway
 * returns them at the top level or nested under a `payment` key.
 */
export function extractRequirements(body: unknown): X402PaymentRequirements | null {
  if (isPaymentRequired(body)) return body;
  const nested = (body as { payment?: unknown } | null)?.payment;
  if (isPaymentRequired(nested)) return nested;
  return null;
}

const USDC_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * Settle an x402 challenge by sending the required USDC transfer on Base using
 * the supplied viem WalletClient, returning a proof the caller can attach to
 * the retried request.
 */
export async function payRequirements(
  wallet: WalletClient,
  requirements: X402PaymentRequirements,
): Promise<X402PaymentProof> {
  const net = NETWORKS[requirements.network];
  const account = wallet.account;
  if (!account) throw new Error("WalletClient has no account configured");

  const data = encodeFunctionData({
    abi: USDC_TRANSFER_ABI,
    functionName: "transfer",
    args: [getAddress(requirements.payTo), BigInt(requirements.amountAtomic)],
  });

  const txHash = await wallet.sendTransaction({
    account,
    chain: null,
    to: getAddress(net.usdc),
    data,
  });

  return {
    txHash,
    payerWallet: account.address,
    paidAt: new Date().toISOString(),
  };
}

/**
 * Convenience wrapper: fetch a URL, and if it returns 402, pay and retry once.
 *
 * @example
 * ```ts
 * const res = await fetchWithPayment("https://api.rail402.app/api/services/x/call", {
 *   method: "POST",
 *   body: JSON.stringify({ input: { address: "0x..." } }),
 * }, walletClient);
 * ```
 */
export async function fetchWithPayment(
  url: string,
  init: RequestInit,
  wallet: WalletClient,
): Promise<Response> {
  const first = await fetch(url, init);
  if (first.status !== 402) return first;

  const body: unknown = await first.clone().json().catch(() => null);
  const requirements = extractRequirements(body);
  if (!requirements) return first;

  const proof = await payRequirements(wallet, requirements);
  const headers = new Headers(init.headers);
  headers.set("x-payment-proof", JSON.stringify(proof));
  if (proof.payerWallet) headers.set("x-payer-wallet", proof.payerWallet);

  return fetch(url, { ...init, headers });
}
