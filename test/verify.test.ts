import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getTransactionReceipt: vi.fn(), getBlockNumber: vi.fn() }));

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: () => ({
      getTransactionReceipt: mocks.getTransactionReceipt,
      getBlockNumber: mocks.getBlockNumber,
    }),
  };
});

import { verifyPayment } from "../src/verify";
import { TRANSFER_TOPIC, NETWORKS } from "../src/constants";

const PAY_TO = "0x1111111111111111111111111111111111111111" as const;
const PAYER = "0x2222222222222222222222222222222222222222" as const;

function addrToTopic(addr: string): string {
  return `0x${"0".repeat(24)}${addr.slice(2).toLowerCase()}`;
}

function receiptWithTransfer(to: string, amountAtomic: bigint) {
  return {
    status: "success" as const,
    blockNumber: 100n,
    logs: [
      {
        address: NETWORKS.base.usdc,
        topics: [TRANSFER_TOPIC, addrToTopic(PAYER), addrToTopic(to)],
        data: `0x${amountAtomic.toString(16).padStart(64, "0")}`,
      },
    ],
  };
}

describe("verifyPayment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a malformed tx hash without hitting the chain", async () => {
    const res = await verifyPayment({ txHash: "0xnope" as `0x${string}` }, {
      amountAtomic: "50000",
      payTo: PAY_TO,
    });
    expect(res.valid).toBe(false);
    expect(mocks.getTransactionReceipt).not.toHaveBeenCalled();
  });

  it("accepts a matching USDC transfer of sufficient value", async () => {
    mocks.getTransactionReceipt.mockResolvedValue(receiptWithTransfer(PAY_TO, 50000n));
    const res = await verifyPayment(
      { txHash: `0x${"a".repeat(64)}` as `0x${string}` },
      { amountAtomic: "50000", payTo: PAY_TO },
    );
    expect(res.valid).toBe(true);
    expect(res.amountAtomic).toBe("50000");
    expect(res.payerWallet?.toLowerCase()).toBe(PAYER);
  });

  it("rejects when the transfer is under the required amount", async () => {
    mocks.getTransactionReceipt.mockResolvedValue(receiptWithTransfer(PAY_TO, 49999n));
    const res = await verifyPayment(
      { txHash: `0x${"a".repeat(64)}` as `0x${string}` },
      { amountAtomic: "50000", payTo: PAY_TO },
    );
    expect(res.valid).toBe(false);
  });

  it("rejects when funds went to the wrong address", async () => {
    mocks.getTransactionReceipt.mockResolvedValue(
      receiptWithTransfer("0x9999999999999999999999999999999999999999", 50000n),
    );
    const res = await verifyPayment(
      { txHash: `0x${"a".repeat(64)}` as `0x${string}` },
      { amountAtomic: "50000", payTo: PAY_TO },
    );
    expect(res.valid).toBe(false);
  });

  it("rejects a reverted transaction", async () => {
    mocks.getTransactionReceipt.mockResolvedValue({ status: "reverted", blockNumber: 100n, logs: [] });
    const res = await verifyPayment(
      { txHash: `0x${"a".repeat(64)}` as `0x${string}` },
      { amountAtomic: "50000", payTo: PAY_TO },
    );
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/reverted/i);
  });

  it("enforces minimum confirmations", async () => {
    mocks.getTransactionReceipt.mockResolvedValue(receiptWithTransfer(PAY_TO, 50000n));
    mocks.getBlockNumber.mockResolvedValue(100n); // only 1 confirmation
    const res = await verifyPayment(
      { txHash: `0x${"a".repeat(64)}` as `0x${string}` },
      { amountAtomic: "50000", payTo: PAY_TO, minConfirmations: 5 },
    );
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/confirmation/i);
  });
});
