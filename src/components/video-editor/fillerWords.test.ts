import { describe, expect, it } from "vitest";
import { findFillerWordSpans, hasWordTimings, isFillerWord } from "./fillerWords";
import type { CaptionCue } from "./types";

describe("isFillerWord", () => {
	it.each([
		"um",
		"Uh,",
		"umm",
		"uhm",
		"hmm",
		"ahn",
		"Ahn...",
		"éh",
		"erm",
	])("treats %s as a hesitation", (word) => {
		expect(isFillerWord(word)).toBe(true);
	});

	it.each([
		"tipo",
		"né",
		"am",
		"like",
		"hello",
		"umbrella",
		"ah!?x",
		"",
		"...",
	])("keeps %s", (word) => {
		expect(isFillerWord(word)).toBe(false);
	});
});

describe("findFillerWordSpans", () => {
	const cues: CaptionCue[] = [
		{
			id: "a",
			startMs: 0,
			endMs: 3000,
			text: "so um this is uh fine",
			words: [
				{ text: "so", startMs: 0, endMs: 300 },
				{ text: "um", startMs: 400, endMs: 700 },
				{ text: "this", startMs: 800, endMs: 1000 },
				{ text: "uh,", startMs: 2000, endMs: 2300 },
			],
		},
	];

	it("returns source-time spans for hesitation words in order", () => {
		expect(findFillerWordSpans(cues)).toEqual([
			{ startMs: 400, endMs: 700 },
			{ startMs: 2000, endMs: 2300 },
		]);
	});

	it("returns nothing for cues without word timings", () => {
		const plain: CaptionCue[] = [{ id: "b", startMs: 0, endMs: 1000, text: "um" }];
		expect(findFillerWordSpans(plain)).toEqual([]);
		expect(hasWordTimings(plain)).toBe(false);
		expect(hasWordTimings(cues)).toBe(true);
	});
});
