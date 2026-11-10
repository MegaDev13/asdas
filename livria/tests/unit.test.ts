import { describe, it, expect } from "vitest";
import {
  percent,
  minutes,
  activeSeconds,
  validPdfHeader,
  safeSearch,
  safeLink,
  streak,
} from "../src/lib/utils";
describe("reading calculations and input boundaries", () => {
  it("bounds progress and handles invalid totals", () => {
    expect(percent(12, 10)).toBe(100);
    expect(percent(-1, 10)).toBe(0);
    expect(percent(1, 0)).toBe(0);
    expect(percent(25, 100)).toBe(25);
  });
  it("does not count hidden or abandoned pages", () => {
    expect(activeSeconds(1000, 50000, 15, true)).toBe(15);
    expect(activeSeconds(1000, 61001, 15, true)).toBe(0);
    expect(activeSeconds(1000, 1001, 15, false)).toBe(0);
    expect(activeSeconds(1000, 1001, 300, true)).toBe(30);
    expect(activeSeconds(1000, 1001, -5, true)).toBe(0);
  });
  it("requires a real PDF signature", () => {
    expect(validPdfHeader(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(validPdfHeader(new TextEncoder().encode("<script>"))).toBe(false);
  });
  it("keeps filter punctuation out of PostgREST search", () => {
    expect(safeSearch("a,b_(c)%")).toBe("a b  c");
    expect(safeSearch("x".repeat(101))).toHaveLength(100);
  });
  it("only accepts HTTPS update links", () => {
    expect(safeLink("javascript:alert(1)")).toBe("");
    expect(safeLink("http://example.com")).toBe("");
    expect(safeLink("https://example.com/a.apk")).toBe(
      "https://example.com/a.apk",
    );
  });
  it("counts sequences across month boundaries", () => {
    expect(
      streak(["2026-10-30", "2026-10-31", "2026-11-01"], "2026-11-01"),
    ).toBe(3);
    expect(streak(["2026-10-31"], "2026-11-01")).toBe(1);
    expect(streak(["2026-10-30"], "2026-11-01")).toBe(0);
  });
  it("never presents negative reading minutes", () => {
    expect(minutes(-9)).toBe(0);
    expect(minutes(125)).toBe(2);
  });
});
