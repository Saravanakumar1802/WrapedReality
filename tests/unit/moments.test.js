import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  MOMENT_KINDS,
  buildPrompt,
  chaptersAsMoments,
  cleanMoments,
  compactTranscript,
  extractMoments,
  indexMoments,
  momentTarget,
  parseMomentLines,
} from "../../scripts/moments.mjs";
import { keywordMomentSearch, mergeMoments, momentText, quantize } from "@/lib/momentIndex.js";

const game = { slug: "god-of-war", title: "God of War", platform: "PS4", year: 2018 };
const video = { id: "vid00000001", title: "God of War, part 3", duration: 3600 };
const cues = [
  { t: 10, text: "Um, okay, we're back in Midgard." },
  { t: 12, text: "[Music]" },
  { t: 14, text: "Okay, we're back in Midgard." },
  { t: 600, text: "This is the the Valkyrie fight, uh, she hits hard." },
  { t: 1800, text: "Atreus, no!" },
];
const input = { game, video, duration: video.duration, chapters: [{ t: 0, title: "Intro" }], cues };

const ANSWER = `S|Kratos and Atreus head for the mountain.
600|boss|0|Boss: Valkyrie|A tough Valkyrie fight in the hidden chamber.|valkyrie,boss,Valkyrie
610|combat|0|Too close to the last one||
garbage line without fields
1800|story|1|Atreus collapses|Atreus falls ill.|atreus
9999|other|0|Past the end||`;

/** A stand-in model: records each request and returns a canned answer. */
function fakeLLM(text = ANSWER, usage = { input: 120, output: 60 }) {
  const calls = [];
  return { name: "fake", model: "fake-1", calls, complete: async (req) => (calls.push(req), { text, usage }) };
}

describe("token-lean input", () => {
  it("drops filler words, noise tags and repeated lines, and stamps plain seconds", () => {
    const lines = compactTranscript(cues);
    expect(lines[0]).toBe("10 okay, we're back in Midgard.");
    expect(lines.join(" ")).not.toMatch(/\[Music\]|\bum\b|\buh\b|the the/i);
    expect(lines).toHaveLength(3); // the repeat at 14 s is gone; 600 and 1800 are their own windows
  });

  it("asks for about one moment per four minutes, within bounds", () => {
    expect(momentTarget(3600)).toBe(15);
    expect(momentTarget(300)).toBe(4);
    expect(momentTarget(5 * 3600)).toBe(30);
    expect(momentTarget(600, 12)).toBe(12); // never fewer than the chapters
  });

  it("builds a compact prompt with real timestamps", () => {
    const prompt = buildPrompt(input);
    expect(prompt).toContain("Game: God of War (PS4 2018)");
    expect(prompt).toContain("Video: God of War, part 3 (3600 s)");
    expect(prompt).toContain("0 Intro");
    expect(prompt).toContain("600 This is the Valkyrie fight");
    expect(prompt.length).toBeLessThan(400);
  });
});

describe("compact output", () => {
  it("parses one line per moment and ignores anything malformed", () => {
    const { summary, moments } = parseMomentLines(ANSWER);
    expect(summary).toBe("Kratos and Atreus head for the mountain.");
    expect(moments.map((m) => m.t)).toEqual([600, 610, 1800, 9999]);
    expect(moments[2]).toMatchObject({ kind: "story", spoiler: true, title: "Atreus collapses" });
  });

  it("keeps moments inside the video, sorted, spaced and tidy", () => {
    const out = cleanMoments(parseMomentLines(ANSWER).moments, { duration: 3600 });
    expect(out.map((m) => m.t)).toEqual([600, 1800]); // 610 too close, 9999 past the end
    expect(out[0].tags).toEqual(["valkyrie", "boss"]); // lowercased, de-duplicated
    expect(cleanMoments([{ t: 5, title: "x", kind: "made-up" }])[0].kind).toBe("other");
    expect(MOMENT_KINDS).toContain("boss");
  });

  it("turns chapters into moments with no model at all", () => {
    expect(
      chaptersAsMoments(
        [
          { t: 0, title: "Intro" },
          { t: 754, title: "Boss" },
        ],
        3600,
      ).map((m) => m.title),
    ).toEqual(["Intro", "Boss"]);
  });
});

describe("the model call", () => {
  it("sends a short instruction with a capped answer size, and cleans the reply", async () => {
    const llm = fakeLLM();
    const result = await extractMoments(llm, input);
    expect(result.summary).toBe("Kratos and Atreus head for the mountain.");
    expect(result.moments).toHaveLength(2);
    expect(result.usage).toEqual({ input: 120, output: 60 });
    const req = llm.calls[0];
    expect(req.system.length).toBeLessThan(1200);
    expect(req.maxOutputTokens).toBeLessThanOrEqual(4000);
    expect(req.prompt).toContain("Valkyrie");
  });

  it("rejects an answer with nothing usable", async () => {
    await expect(extractMoments(fakeLLM("sorry, I can't"), input)).rejects.toThrow(/no usable moments/);
  });

  describe("indexing with a cache", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moments-"));
    const cacheFile = path.join(dir, "moments.json");
    const transcripts = { [video.id]: { cues, chapters: input.chapters } };
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it("indexes once, then serves the cache without calling the model again", async () => {
      const first = fakeLLM();
      const a = await indexMoments([{ game, video }], transcripts, { llm: first, cacheFile, gapMs: 0 });
      expect(first.calls).toHaveLength(1);
      expect(a[video.id].moments).toHaveLength(2);

      const second = fakeLLM();
      const b = await indexMoments([{ game, video }], transcripts, { llm: second, cacheFile, gapMs: 0 });
      expect(second.calls).toHaveLength(0);
      expect(b).toEqual(a);
    });

    it("switching model does not re-spend tokens on indexed videos", async () => {
      const other = { ...fakeLLM(), name: "other", model: "other-2" };
      await indexMoments([{ game, video }], transcripts, { llm: other, cacheFile, gapMs: 0 });
      expect(other.calls).toHaveLength(0);
    });

    it("without a model, chapters still become moments (free fallback)", async () => {
      const out = await indexMoments(
        [{ game, video: { ...video, id: "other000001" } }],
        { other000001: { cues: [], chapters: [{ t: 30, title: "Start" }] } },
        { llm: null, cacheFile, gapMs: 0 },
      );
      expect(out.other000001.moments[0].title).toBe("Start");
    });

    it("skips videos with no transcript or chapters", async () => {
      const llm = fakeLLM();
      expect(await indexMoments([{ game, video }], {}, { llm, cacheFile, gapMs: 0 })).toEqual({});
      expect(llm.calls).toHaveLength(0);
    });
  });
});

describe("moment index for the site", () => {
  const ai = { [video.id]: cleanMoments(parseMomentLines(ANSWER).moments, { duration: 3600 }) };
  const videos = [{ id: video.id }];

  it("merges the creator's moments with the AI's, creator first on conflicts", () => {
    const merged = mergeMoments([{ t: 590, label: "My favourite fight" }], videos, { [video.id]: { moments: ai[video.id] } });
    expect(merged.map((m) => [m.t, m.source])).toEqual([
      [590, "creator"], // the AI moment at 600 is within 30 s: dropped
      [1800, "ai"],
    ]);
    expect(merged[0].videoId).toBe(video.id);
  });

  it("builds searchable text and finds moments by keyword", () => {
    const items = ai[video.id].map((m) => ({ text: momentText({ ...m, label: m.title }, game.title) }));
    expect(items[0].text).toContain("God of War");
    expect(keywordMomentSearch("valkyrie boss", items)[0].index).toBe(0);
    expect(keywordMomentSearch("atre", items)[0].index).toBe(1);
    expect(keywordMomentSearch("", items)).toEqual([]);
  });

  it("quantises unit vectors to int8 without losing their direction", () => {
    expect([
      ...quantize([
        [1, 0, 0],
        [0, -0.6, 0.8],
      ]),
    ]).toEqual([127, 0, 0, 0, -76, 102]);
  });
});
