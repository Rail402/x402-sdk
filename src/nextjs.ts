import { createPaymentRequirements } from "./requirements";
import { parseProofHeader, requirementHeaders } from "./http";
import { verifyPayment } from "./verify";
import type { X402Options, X402VerificationResult } from "./types";

/** Handler receives the standard Web `Request` plus the verified payment. */
type NextHandler = (
  req: Request,
  ctx: { x402: X402VerificationResult },
) => Response | Promise<Response>;

/**
 * Wrap a Next.js App Router route handler so it requires an x402 payment.
 *
 * @example
 * ```ts
 * // app/api/risk/route.ts
 * export const POST = withX402Payment(async (req, { x402 }) => {
 *   return Response.json({ score: 0.92, paidBy: x402.payerWallet });
 * }, { price: "0.05", wallet: "0xabc...", network: "base" });
 * ```
 */
export function withX402Payment(handler: NextHandler, options: X402Options) {
  return async (req: Request): Promise<Response> => {
    const requirements = createPaymentRequirements(options);
    const proof = parseProofHeader(req.headers.get("x-payment-proof"));

    const reject = (error?: string) =>
      Response.json(error ? { ...requirements, error } : requirements, {
        status: 402,
        headers: requirementHeaders(requirements),
      });

    if (!proof) return reject();

    const result = await verifyPayment(proof, {
      amountAtomic: requirements.amountAtomic,
      payTo: options.wallet,
      network: options.network,
      rpcUrl: options.rpcUrl,
      minConfirmations: options.minConfirmations,
    });

    if (!result.valid) return reject(result.error);

    return handler(req, { x402: result });
  };
}
