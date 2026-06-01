/**
 * Core x402 protocol types.
 *
 * x402 is an open payment protocol built on HTTP 402 ("Payment Required").
 * A server responds with payment *requirements*; the client settles a USDC
 * payment on Base and retries the request carrying a payment *proof*.
 */

/** Supported Base networks. */
export type X402Network = "base" | "base-sepolia";

/** Hex-encoded EVM address. */
export type Address = `0x${string}`;

/** Hex-encoded 32-byte transaction hash. */
export type TxHash = `0x${string}`;

/**
 * The body a server returns alongside an HTTP 402 response. Describes exactly
 * what the caller must pay, to whom, and on which network.
 */
export interface X402PaymentRequirements {
  /** Discriminator so clients can detect an x402 challenge. */
  type: "x402_payment_required";
  /** Human-readable price, e.g. "0.05". */
  amount: string;
  /** Price in atomic USDC units (6 decimals), e.g. "50000". */
  amountAtomic: string;
  /** Settlement currency. Only USDC is supported today. */
  currency: "USDC";
  /** Base network the payment must settle on. */
  network: X402Network;
  /** EVM chain id for `network` (8453 mainnet, 84532 sepolia). */
  chainId: 8453 | 84532;
  /** Wallet that must receive the funds. */
  payTo: Address;
  /** Optional resource identifier (e.g. the API route being paid for). */
  resource?: string;
  /** Optional human-readable description of what is being purchased. */
  description?: string;
  /** Optional memo for reconciliation. */
  memo?: string;
  /** ISO-8601 timestamp after which this challenge is stale. */
  expiresAt: string;
}

/**
 * Proof of payment supplied by the caller on the retried request, typically in
 * the `X-Payment-Proof` header (JSON-encoded).
 */
export interface X402PaymentProof {
  /** On-chain transaction hash of the USDC transfer. */
  txHash: TxHash;
  /** Wallet that paid. Optional — verification derives it from the tx. */
  payerWallet?: Address;
  /** ISO-8601 timestamp the client believes it paid. Informational only. */
  paidAt?: string;
}

/** Result of verifying a payment proof against on-chain state. */
export interface X402VerificationResult {
  /** True only when a matching, sufficient USDC transfer was confirmed. */
  valid: boolean;
  /** The verified transaction hash, when valid. */
  txHash?: TxHash;
  /** The address funds actually came from, derived from the transfer log. */
  payerWallet?: Address;
  /** The atomic amount actually transferred. */
  amountAtomic?: string;
  /** Machine-readable reason when `valid` is false. */
  error?: string;
}

/** Options shared by every framework adapter. */
export interface X402Options {
  /** Human-readable USDC price, e.g. "0.05" or 0.05. */
  price: string | number;
  /** Wallet that receives payment (the `payTo` address). */
  wallet: Address;
  /** Target network. Defaults to "base" (mainnet). */
  network?: X402Network;
  /** Optional description surfaced in the 402 challenge. */
  description?: string;
  /** Optional resource identifier surfaced in the 402 challenge. */
  resource?: string;
  /** Override the Base RPC endpoint used for verification. */
  rpcUrl?: string;
  /** Minimum confirmations required before a payment is accepted. Default 1. */
  minConfirmations?: number;
  /** Seconds until the issued challenge expires. Default 600. */
  expiresInSeconds?: number;
}
