import { describe, expect, it } from "vitest";

describe("web foundation", () => {
  it("has a working test harness", () => {
    expect("PJ&LJ Salon Manager").toContain("Salon");
  });
});
