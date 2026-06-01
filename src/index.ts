/**
 * @rail402/x402 — make any REST endpoint x402-payable on Base.
 *
 * Server adapters:  withX402 (Express), withX402Payment (Next.js)
 * Verification:     verifyPayment
 * Client helpers:   fetchWithPayment, payRequirements, isPaymentRequired
 */

export { withX402 } from "./express";
export { withX402Payment } from "./nextjs";
export { verifyPayment, type VerifyExpectation } from "./verify";
export { createPaymentRequirements, toAtomic, fromAtomic } from "./requirements";
export { fetchWithPayment, payRequirements, isPaymentRequired } from "./client";
export { parseProofHeader, requirementHeaders } from "./http";
export { NETWORKS, USDC_DECIMALS, TRANSFER_TOPIC, X402_HEADERS } from "./constants";
export type {
  Address,
  TxHash,
  X402Network,
  X402Options,
  X402PaymentProof,
  X402PaymentRequirements,
  X402VerificationResult,
} from "./types";
