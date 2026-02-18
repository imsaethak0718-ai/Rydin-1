import { describe, expect, it } from "vitest";
import { fuzzyNameMatch } from "@/lib/idScanner";

describe("fuzzyNameMatch", () => {
  it("matches exact name", () => {
    const result = fuzzyNameMatch("VISHAL SINGH", "VISHAL SINGH");
    expect(result.match).toBe(true);
    expect(result.similarity).toBeGreaterThan(0.95);
  });

  it("matches when middle name is missing on ID", () => {
    const result = fuzzyNameMatch("SHAYAAN MUHAMED SUBAIR", "SHAYAAN SUBAIR");
    expect(result.match).toBe(true);
    expect(result.similarity).toBeGreaterThan(0.65);
  });

  it("matches split surname OCR output", () => {
    const result = fuzzyNameMatch("MANGALWEDHEKAR SARTHAK", "MANGALWED HEKAR SARTHAK");
    expect(result.match).toBe(true);
    expect(result.similarity).toBeGreaterThan(0.65);
  });

  it("rejects unrelated names", () => {
    const result = fuzzyNameMatch("PRITHISH MISRA", "VISHAL SINGH");
    expect(result.match).toBe(false);
    expect(result.similarity).toBeLessThan(0.67);
  });
});
