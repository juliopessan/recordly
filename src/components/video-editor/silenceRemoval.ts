import { type ClipRegion, getClipSourceEndMs, getClipSourceStartMs, sortClipRegions } from "./types";

/** A stretch of the recording with no speech, in source (recording) milliseconds. */
export interface SilenceSpan {
	startMs: number;
	/** `Number.POSITIVE_INFINITY` for a trailing silence that runs to end-of-audio. */
	endMs: number;
}

export interface SilenceRemovalOptions {
	/** Only silences at least this long are cut. */
	minSilenceMs: number;
	/** Breathing room kept on each side of a cut so speech is not clipped. */
	keepPadMs: number;
}

export const DEFAULT_SILENCE_REMOVAL_OPTIONS: SilenceRemovalOptions = {
	minSilenceMs: 700,
	keepPadMs: 150,
};

/** Segments shorter than this are dropped; they are artefacts of adjacent cuts. */
const MIN_KEPT_SEGMENT_MS = 50;

export interface SilenceRemovalPlan {
	clips: ClipRegion[];
	/** Number of cuts made. Zero means the plan leaves the clips untouched. */
	cutCount: number;
	/** Source milliseconds removed, measured from the clips themselves. */
	removedSourceMs: number;
}

function toCutSpans(silences: SilenceSpan[], options: SilenceRemovalOptions): SilenceSpan[] {
	return silences
		.filter((silence) => silence.endMs - silence.startMs >= options.minSilenceMs)
		.map((silence) => ({
			startMs: silence.startMs + options.keepPadMs,
			endMs: silence.endMs - options.keepPadMs,
		}))
		.filter((cut) => cut.endMs > cut.startMs)
		.sort((left, right) => left.startMs - right.startMs);
}

/**
 * Cut detected silence out of the primary footage.
 *
 * Silence is expressed in source time, so each clip is split against it using
 * its own source range and the surviving pieces keep their speed and flags.
 * Pieces are laid out back to back; callers run the result through
 * `packClipSequence`/`rippleRegions` like any other ripple edit.
 */
export function planSilenceRemoval(params: {
	clipRegions: ClipRegion[];
	silences: SilenceSpan[];
	createId: () => string;
	options?: Partial<SilenceRemovalOptions>;
}): SilenceRemovalPlan {
	const options = { ...DEFAULT_SILENCE_REMOVAL_OPTIONS, ...params.options };
	const cuts = toCutSpans(params.silences, options);
	const sortedClips = sortClipRegions(params.clipRegions);

	const result: ClipRegion[] = [];
	let cursorMs = 0;
	let cutCount = 0;
	let removedSourceMs = 0;

	for (const clip of sortedClips) {
		const sourceStartMs = getClipSourceStartMs(clip);
		const sourceEndMs = getClipSourceEndMs(clip);
		const speed = Number.isFinite(clip.speed) && clip.speed > 0 ? clip.speed : 1;

		const segments: Array<{ startMs: number; endMs: number }> = [];
		let segmentStartMs = sourceStartMs;
		let clipCuts = 0;
		for (const cut of cuts) {
			if (cut.endMs <= segmentStartMs || cut.startMs >= sourceEndMs) continue;
			const cutStartMs = Math.max(cut.startMs, segmentStartMs);
			const cutEndMs = Math.min(cut.endMs, sourceEndMs);
			if (cutStartMs > segmentStartMs) {
				segments.push({ startMs: segmentStartMs, endMs: cutStartMs });
			}
			removedSourceMs += cutEndMs - cutStartMs;
			clipCuts += 1;
			segmentStartMs = cutEndMs;
		}
		if (segmentStartMs < sourceEndMs) {
			segments.push({ startMs: segmentStartMs, endMs: sourceEndMs });
		}

		if (clipCuts === 0) {
			const durationMs = clip.endMs - clip.startMs;
			result.push({ ...clip, startMs: cursorMs, endMs: cursorMs + durationMs });
			cursorMs += durationMs;
			continue;
		}

		cutCount += clipCuts;
		let isFirstPiece = true;
		for (const segment of segments) {
			if (segment.endMs - segment.startMs < MIN_KEPT_SEGMENT_MS) continue;
			const durationMs = Math.round((segment.endMs - segment.startMs) / speed);
			result.push({
				...clip,
				id: isFirstPiece ? clip.id : params.createId(),
				startMs: cursorMs,
				endMs: cursorMs + durationMs,
				sourceStartMs: Math.round(segment.startMs),
			});
			isFirstPiece = false;
			cursorMs += durationMs;
		}
	}

	return { clips: result, cutCount, removedSourceMs: Math.round(removedSourceMs) };
}
