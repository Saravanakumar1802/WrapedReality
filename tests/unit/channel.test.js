import { describe, expect, it } from "vitest";
import { durationLabel, formatCompact, timeAgo, yearsSince } from "@/lib/channel.js";
import { summariseUploads } from "../../scripts/channel.mjs";

const now = new Date("2026-11-15T12:00:00Z");

describe("channel formatting", () => {
  it("formats big numbers compactly", () => {
    expect(formatCompact(63689)).toBe("63.7K");
    expect(formatCompact(218)).toBe("218");
    expect(formatCompact(1_250_000)).toBe("1.3M");
    expect(formatCompact(NaN)).toBe("–");
  });

  it("counts whole years and relative dates", () => {
    expect(yearsSince("2021-04-18T15:51:46Z", now)).toBe(5);
    expect(yearsSince("not a date", now)).toBeNull();
    expect(timeAgo("2026-11-15T08:00:00Z", now)).toBe("today");
    expect(timeAgo("2026-11-12T12:00:00Z", now)).toBe("3 days ago");
    expect(timeAgo("2026-10-31T12:00:00Z", now)).toBe("2 weeks ago");
    expect(timeAgo("2026-05-01T12:00:00Z", now)).toBe("6 months ago");
    expect(timeAgo("2024-11-01T12:00:00Z", now)).toBe("2 years ago");
  });

  it("labels video lengths", () => {
    expect(durationLabel(754)).toBe("12:34");
    expect(durationLabel(3723)).toBe("1:02:03");
  });
});

describe("channel summary from uploads", () => {
  it("totals hours, drops Shorts from latest, newest first, links games", () => {
    const uploads = [
      { id: "a", title: "Old", publishedAt: "2025-01-01", duration: 3600 },
      { id: "b", title: "Short", publishedAt: "2026-11-01", duration: 40 },
      { id: "c", title: "New", publishedAt: "2026-11-10", duration: 5400 },
    ];
    const { hours, latest } = summariseUploads(uploads, { "god-of-war": [{ id: "c" }] });
    expect(hours).toBe(3);
    expect(latest.map((v) => v.id)).toEqual(["c", "a"]);
    expect(latest[0].slug).toBe("god-of-war");
  });
});
