import { describe, expect, it } from "vitest";
import { clock, parseCaptions, parseChapters, parseCueTime, parseIsoDuration, transcriptLines } from "../../scripts/transcripts.mjs";

const SRT = `1
00:00:01,000 --> 00:00:03,500
Welcome back to the <i>playthrough</i>.

2
00:00:04,000 --> 00:00:06,000
Welcome back to the playthrough.
Today we fight Sigrun.

3
01:02:03,450 --> 01:02:05,000
She&#39;s down!
`;

const VTT = `WEBVTT
Kind: captions

00:00.500 --> 00:02.000
<v Narrator>The valley opens up.</v>

00:21.000 --> 00:23.000 align:start position:0%
A <c.yellow>raven</c> lands nearby.
`;

describe("caption parsing", () => {
  it("reads cue times in every format captions use", () => {
    expect(parseCueTime("01:02:03,450")).toBeCloseTo(3723.45);
    expect(parseCueTime("02:03.5")).toBeCloseTo(123.5);
    expect(parseCueTime("0:07")).toBe(7);
    expect(parseCueTime("nonsense")).toBeNaN();
  });

  it("parses SRT, strips tags and entities, drops rolling duplicate lines", () => {
    const cues = parseCaptions(SRT);
    expect(cues.map((c) => c.text)).toEqual(["Welcome back to the playthrough.", "Today we fight Sigrun.", "She's down!"]);
    expect(cues[2].t).toBeCloseTo(3723.45);
  });

  it("parses WebVTT with voice and class tags", () => {
    const cues = parseCaptions(VTT);
    expect(cues).toEqual([
      { t: 0.5, text: "The valley opens up." },
      { t: 21, text: "A raven lands nearby." },
    ]);
  });

  it("merges cues into timestamped lines", () => {
    const lines = transcriptLines(parseCaptions(VTT), 20);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ t: 0.5, text: "The valley opens up." });
  });
});

describe("chapters and durations", () => {
  it("finds chapters in a description, in any common style", () => {
    const desc = "My run of the game!\n0:00 Intro\n12:34 - Boss: Baldur\n(1:05:00) The ending\nFollow me on socials";
    expect(parseChapters(desc)).toEqual([
      { t: 0, title: "Intro" },
      { t: 754, title: "Boss: Baldur" },
      { t: 3900, title: "The ending" },
    ]);
    expect(parseChapters("")).toEqual([]);
  });

  it("reads ISO 8601 durations from the YouTube API", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("P1DT1S")).toBe(86401);
    expect(parseIsoDuration(undefined)).toBeNull();
  });

  it("formats clock times for prompts", () => {
    expect(clock(5)).toBe("0:05");
    expect(clock(754)).toBe("12:34");
    expect(clock(3723)).toBe("1:02:03");
  });
});
