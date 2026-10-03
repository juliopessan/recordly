import type { SilenceSpan } from "./silenceRemoval";
import type { CaptionCue } from "./types";

/**
 * Hesitation sounds only ("um", "uh", "ahn", "hmm"). Real words that speakers
 * overuse ("like", "tipo", "né") are left alone: they are legitimate speech and
 * cutting them damages sentences.
 */
const HESITATION_PATTERN =
	/^(?:u+h+m*|u+m+|e+r+m*|e+h+m*|a+h+n*|ã+h*n*|h+m+|m+h*m+|é+h+|ahn+|hum+)$/;

function normalizeToken(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFC")
		.replace(/[\s.,;:!?¿¡…"'()[\]{}\-–—]/g, "");
}

export function isFillerWord(text: string): boolean {
	const token = normalizeToken(text);
	return token.length > 0 && HESITATION_PATTERN.test(token);
}

/** Source-time spans of hesitation words. Empty when no cue carries word timings. */
export function findFillerWordSpans(cues: CaptionCue[]): SilenceSpan[] {
	const spans: SilenceSpan[] = [];
	for (const cue of cues) {
		for (const word of cue.words ?? []) {
			if (word.endMs > word.startMs && isFillerWord(word.text)) {
				spans.push({ startMs: word.startMs, endMs: word.endMs });
			}
		}
	}
	return spans.sort((left, right) => left.startMs - right.startMs);
}

export function hasWordTimings(cues: CaptionCue[]): boolean {
	return cues.some((cue) => (cue.words?.length ?? 0) > 0);
}
