import { describe, expect, it } from "vitest";
import { createPaymentRequirements, fromAtomic, toAtomic } from "../src/requirements";

describe("toAtomic", () => {
  it("converts decimal strings to atomic USDC units", () => {
    expect(toAtomic("0.05")).toBe("50000");
    expect(toAtomic("1")).toBe("1000000");
    expect(toAtomic("1.5")).toBe("1500000");
    expect(toAtomic("0")).toBe("0");
    expect(toAtomic("0.000001")).toBe("1");
  });

  it("accepts numbers", () => {
    expect(toAtomic(0.05)).toBe("50000");
    expect(toAtomic(2)).toBe("2000000");
  });

  it("truncates beyond 6 decimals", () => {
    expect(toAtomic("0.0000019")).toBe("1");
  });

  it("rejects invalid prices", () => {
    expect(() => toAtomic("abc")).toThrow();
    expect(() => toAtomic("-1")).toThrow();
  });
});

describe("fromAtomic", () => {
  it("is the inverse of toAtomic", () => {
    expect(fromAtomic("50000")).toBe("0.05");
    expect(fromAtomic("1000000")).toBe("1");
    expect(fromAtomic("1500000")).toBe("1.5");
    expect(fromAtomic("1")).toBe("0.000001");
  });
});

describe("createPaymentRequirements", () => {
  const wallet = "0x1234567890abcdef1234567890abcdef12345678" as const;

  it("builds a base mainnet challenge by default", () => {
    const req = createPaymentRequirements({ price: "0.05", wallet });
    expect(req.type).toBe("x402_payment_required");
    expect(req.network).toBe("base");
    expect(req.chainId).toBe(8453);
    expect(req.amount).toBe("0.05");
    expect(req.amountAtomic).toBe("50000");
    expect(req.payTo).toBe(wallet);
    expect(new Date(req.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("honors the sepolia network", () => {
    const req = createPaymentRequirements({ price: 1, wallet, network: "base-sepolia" });
    expect(req.network).toBe("base-sepolia");
    expect(req.chainId).toBe(84532);
  });
});
