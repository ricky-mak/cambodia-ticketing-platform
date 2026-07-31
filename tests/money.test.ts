import { describe, it, expect } from "vitest";
import {
  toMinor,
  sumMinor,
  multiplyMinor,
  formatMoney,
} from "@/lib/money";

describe("money", () => {
  it("converts major units to integer minor units", () => {
    expect(toMinor(25)).toBe(2500);
    expect(toMinor(25.5)).toBe(2550);
    // rounds to the nearest minor unit rather than leaving a float
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it("sums minor units without float drift", () => {
    expect(sumMinor([2500, 999, 1])).toBe(3500);
    expect(sumMinor([])).toBe(0);
  });

  it("multiplies unit price by quantity", () => {
    expect(multiplyMinor(2500, 3)).toBe(7500);
    expect(multiplyMinor(2500, 0)).toBe(0);
  });

  it("rejects invalid quantities", () => {
    expect(() => multiplyMinor(2500, -1)).toThrow();
    expect(() => multiplyMinor(2500, 1.5)).toThrow();
  });

  it("formats minor units for display only", () => {
    expect(formatMoney(2500, "USD")).toBe("$25.00");
  });
});
