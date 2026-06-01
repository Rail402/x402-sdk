import { createPaymentRequirements } from "./requirements";
import { parseProofHeader, requirementHeaders } from "./http";
import { verifyPayment } from "./verify";
import type { X402Options, X402VerificationResult } from "./types";

/**
 * Minimal structural types so this adapter needs no `express` runtime or type
 * dependency. Real Express `Request`/`Response` objects satisfy these.
 */
interface MinimalReq {
  headers: Record<string, string | string[] | undefined>;
  /** Populated with the verification result once payment succeeds. */
  x402?: X402VerificationResult;
}
interface MinimalRes {
  status(code: number): MinimalRes;
  json(body: unknown): unknown;
  setHeader(name: string, value: string): void;
}
type ExpressHandler<Req extends MinimalReq, Res extends MinimalRes> = (
  req: Req,
  res: Res,
) => unknown | Promise<unknown>;

/**
 * Wrap an Express handler so it requires an x402 USDC payment before running.
 *
 * @example
 * ```ts
 * app.post("/api/risk", withX402(async (req, res) => {
 *   // req.x402.payerWallet is available here
 *   res.json({ score: 0.92 });
 * }, { price: "0.05", wallet: "0xabc...", network: "base" }));
 * ```
 */
export function withX402<Req extends MinimalReq = MinimalReq, Res extends MinimalRes = MinimalRes>(
  handler: ExpressHandler<Req, Res>,
  options: X402Options,
): ExpressHandler<Req, Res> {
  return async (req, res) => {
    const requirements = createPaymentRequirements(options);
    const proof = parseProofHeader(req.headers["x-payment-proof"]);

    const reject = (error?: string) => {
      res.status(402);
      for (const [k, v] of Object.entries(requirementHeaders(requirements))) res.setHeader(k, v);
      return res.json(error ? { ...requirements, error } : requirements);
    };

    if (!proof) return reject();

    const result = await verifyPayment(proof, {
      amountAtomic: requirements.amountAtomic,
      payTo: options.wallet,
      network: options.network,
      rpcUrl: options.rpcUrl,
      minConfirmations: options.minConfirmations,
    });

    if (!result.valid) return reject(result.error);

    req.x402 = result;
    return handler(req, res);
  };
}
