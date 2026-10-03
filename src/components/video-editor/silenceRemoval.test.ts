import { describe, expect, it } from "vitest";
import { planSilenceRemoval } from "./silenceRemoval";
import { type ClipRegion, getClipSourceEndMs, getClipSourceStartMs } from "./types";

function idFactory() {
	let next = 1;
	return () => `piece-${next++}`;
}

const fullClip: ClipRegion = { id: "clip-1", startMs: 0, endMs: 10_000, speed: 1 };

describe("planSilenceRemoval", () => {
	it("leaves clips untouched when no silence is long enough", () => {
		const plan = planSilenceRemoval({
			clipRegions: [fullClip],
			silences: [{ startMs: 2000, endMs: 2500 }],
			createId: idFactory(),
		});
		expect(plan.cutCount).toBe(0);
		expect(plan.removedSourceMs).toBe(0);
		expect(plan.clips).toEqual([fullClip]);
	});

	it("cuts a long silence but keeps padding on both sides", () => {
		const plan = planSilenceRemoval({
			clipRegions: [fullClip],
			silences: [{ startMs: 4000, endMs: 6000 }],
			createId: idFactory(),
			options: { minSilenceMs: 700, keepPadMs: 150 },
		});
		expect(plan.cutCount).toBe(1);
		expect(plan.removedSourceMs).toBe(1700);
		expect(plan.clips).toHaveLength(2);
		const [left, right] = plan.clips;
		expect(getClipSourceStartMs(left)).toBe(0);
		expect(getClipSourceEndMs(left)).toBe(4150);
		expect(getClipSourceStartMs(right)).toBe(5850);
		expect(getClipSourceEndMs(right)).toBe(10_000);
	});

	it("lays pieces out back to back so the timeline has no gap", () => {
		const plan = planSilenceRemoval({
			clipRegions: [fullClip],
			silences: [{ startMs: 4000, endMs: 6000 }],
			createId: idFactory(),
		});
		const [left, right] = plan.clips;
		expect(left.startMs).toBe(0);
		expect(right.startMs).toBe(left.endMs);
		expect(right.endMs).toBe(10_000 - 1700);
	});

	it("handles a trailing silence that runs to the end of the audio", () => {
		const plan = planSilenceRemoval({
			clipRegions: [fullClip],
			silences: [{ startMs: 8000, endMs: Number.POSITIVE_INFINITY }],
			createId: idFactory(),
		});
		expect(plan.cutCount).toBe(1);
		expect(plan.clips).toHaveLength(1);
		expect(getClipSourceEndMs(plan.clips[0])).toBe(8150);
	});

	it("keeps the original id on the first piece and fresh ids on the rest", () => {
		const plan = planSilenceRemoval({
			clipRegions: [fullClip],
			silences: [
				{ startMs: 2000, endMs: 3000 },
				{ startMs: 6000, endMs: 7000 },
			],
			createId: idFactory(),
		});
		expect(plan.clips.map((clip) => clip.id)).toEqual(["clip-1", "piece-1", "piece-2"]);
	});

	it("respects clip speed when computing durations", () => {
		const fast: ClipRegion = { id: "fast", startMs: 0, endMs: 5000, speed: 2 };
		const plan = planSilenceRemoval({
			clipRegions: [fast],
			silences: [{ startMs: 4000, endMs: 6000 }],
			createId: idFactory(),
		});
		const [left, right] = plan.clips;
		expect(left.speed).toBe(2);
		expect(left.endMs - left.startMs).toBe(2075);
		expect(getClipSourceStartMs(right)).toBe(5850);
	});

	it("ignores silence that falls outside every clip", () => {
		const clip: ClipRegion = { id: "c", startMs: 0, endMs: 2000, sourceStartMs: 0, speed: 1 };
		const plan = planSilenceRemoval({
			clipRegions: [clip],
			silences: [{ startMs: 5000, endMs: 7000 }],
			createId: idFactory(),
		});
		expect(plan.cutCount).toBe(0);
		expect(plan.clips).toEqual([clip]);
	});

	it("drops fragments left between adjacent cuts that are too short to keep", () => {
		const plan = planSilenceRemoval({
			clipRegions: [fullClip],
			silences: [
				{ startMs: 2000, endMs: 3000 },
				{ startMs: 3200, endMs: 4200 },
			],
			createId: idFactory(),
			options: { minSilenceMs: 700, keepPadMs: 100 },
		});
		// The 3100–3100 sliver between the two cuts is below the minimum.
		expect(plan.clips.every((clip) => clip.endMs - clip.startMs >= 50)).toBe(true);
	});
});
