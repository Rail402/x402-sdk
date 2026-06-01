import type { Address, X402Network } from "./types";

/** USDC uses 6 decimals on Base. */
export const USDC_DECIMALS = 6;

/** Per-network chain id, USDC contract, and default public RPC. */
export const NETWORKS: Record<
  X402Network,
  { chainId: 8453 | 84532; usdc: Address; defaultRpc: string }
> = {
  base: {
    chainId: 8453,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    defaultRpc: "https://mainnet.base.org",
  },
  "base-sepolia": {
    chainId: 84532,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    defaultRpc: "https://sepolia.base.org",
  },
};

/**
 * keccak256("Transfer(address,address,uint256)") — topic0 of every ERC-20
 * Transfer event, including USDC.
 */
export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/** Canonical x402 header names (lowercase, as Node delivers them). */
export const X402_HEADERS = {
  paymentProof: "x-payment-proof",
  payerWallet: "x-payer-wallet",
  requestId: "x-request-id",
} as const;
