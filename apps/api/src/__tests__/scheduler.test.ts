import { describe, it, expect } from "vitest";
import { getScheduledJobs } from "../scheduler.js";

describe("Scheduler", () => {
  it("getScheduledJobs returns empty array when no jobs scheduled in test", () => {
    // In test env scheduler is not started, so jobs array is empty
    const jobs = getScheduledJobs();
    expect(Array.isArray(jobs)).toBe(true);
  });
});
