import { createPublicClient, getAddress, http, type Hash } from "viem";
import { NETWORKS, TRANSFER_TOPIC } from "./constants";
import type {
  Address,
  TxHash,
  X402Network,
  X402PaymentProof,
  X402VerificationResult,
} from "./types";

/** A 32-byte topic encodes an address in its low 20 bytes. */
function topicToAddress(topic: string): Address {
  return getAddress(`0x${topic.slice(-40)}`);
}

export interface VerifyExpectation {
  /** Required amount in atomic USDC units. */
  amountAtomic: string;
  /** Wallet that must have received the funds. */
  payTo: Address;
  /** Network to verify against. Default "base". */
  network?: X402Network;
  /** Override RPC endpoint. */
  rpcUrl?: string;
  /** Minimum confirmations. Default 1. */
  minConfirmations?: number;
}

/**
 * Verify a payment proof by inspecting the on-chain transaction receipt on
 * Base. A proof is valid only when the referenced transaction:
 *   1. exists and succeeded,
 *   2. has the required number of confirmations, and
 *   3. contains a USDC `Transfer` to `payTo` of at least `amountAtomic`.
 *
 * Uses viem's JSON-RPC client; no indexer or third-party API required.
 */
export async function verifyPayment(
  proof: X402PaymentProof,
  expected: VerifyExpectation,
): Promise<X402VerificationResult> {
  if (!proof?.txHash || !/^0x[0-9a-fA-F]{64}$/.test(proof.txHash)) {
    return { valid: false, error: "Invalid or missing transaction hash" };
  }

  const network = expected.network ?? "base";
  const net = NETWORKS[network];
  const client = createPublicClient({ transport: http(expected.rpcUrl ?? net.defaultRpc) });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: proof.txHash as Hash });
  } catch {
    return { valid: false, error: "Transaction not found or not yet mined" };
  }

  if (receipt.status !== "success") {
    return { valid: false, error: "Transaction reverted on-chain" };
  }

  const minConfirmations = expected.minConfirmations ?? 1;
  if (minConfirmations > 1) {
    const head = await client.getBlockNumber();
    const confirmations = head - receipt.blockNumber + 1n;
    if (confirmations < BigInt(minConfirmations)) {
      return {
        valid: false,
        error: `Insufficient confirmations (${confirmations}/${minConfirmations})`,
      };
    }
  }

  const usdc = getAddress(net.usdc);
  const expectedTo = getAddress(expected.payTo);
  const requiredAmount = BigInt(expected.amountAtomic);

  for (const log of receipt.logs) {
    if (getAddress(log.address) !== usdc) continue;
    if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    if (log.topics.length < 3) continue;

    const to = topicToAddress(log.topics[2] as string);
    if (to !== expectedTo) continue;

    const value = BigInt(log.data);
    if (value >= requiredAmount) {
      return {
        valid: true,
        txHash: proof.txHash as TxHash,
        payerWallet: topicToAddress(log.topics[1] as string),
        amountAtomic: value.toString(),
      };
    }
  }

  return { valid: false, error: "No matching USDC transfer found in transaction" };
}
