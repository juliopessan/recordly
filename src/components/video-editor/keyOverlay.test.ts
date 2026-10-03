import { describe, expect, it } from "vitest";
import {
	buildKeyOverlayCues,
	formatKeyCombo,
	getActiveKeyCue,
	isShortcutKeystroke,
	type KeystrokeEvent,
} from "./keyOverlay";

describe("isShortcutKeystroke", () => {
	it("accepts combos with cmd, ctrl or alt", () => {
		expect(isShortcutKeystroke({ timeMs: 0, key: "k", meta: true })).toBe(true);
		expect(isShortcutKeystroke({ timeMs: 0, key: "c", ctrl: true })).toBe(true);
		expect(isShortcutKeystroke({ timeMs: 0, key: "tab", alt: true })).toBe(true);
	});

	it("rejects plain typing and shift-only so passwords never become cues", () => {
		expect(isShortcutKeystroke({ timeMs: 0, key: "p" })).toBe(false);
		expect(isShortcutKeystroke({ timeMs: 0, key: "p", shift: true })).toBe(false);
	});
});

describe("formatKeyCombo", () => {
	it("uses Apple modifier order and symbols on mac", () => {
		expect(formatKeyCombo({ timeMs: 0, key: "k", meta: true, shift: true }, "mac")).toBe("⇧⌘K");
		expect(
			formatKeyCombo({ timeMs: 0, key: "z", ctrl: true, alt: true, meta: true }, "mac"),
		).toBe("⌃⌥⌘Z");
		expect(formatKeyCombo({ timeMs: 0, key: "arrowleft", meta: true }, "mac")).toBe("⌘←");
	});

	it("spells modifiers out elsewhere", () => {
		expect(formatKeyCombo({ timeMs: 0, key: "s", ctrl: true }, "other")).toBe("Ctrl + S");
		expect(formatKeyCombo({ timeMs: 0, key: "f5", ctrl: true, shift: true }, "other")).toBe(
			"Ctrl + Shift + F5",
		);
	});
});

describe("buildKeyOverlayCues", () => {
	const events: KeystrokeEvent[] = [
		{ timeMs: 5000, key: "c", meta: true },
		{ timeMs: 1000, key: "p" },
		{ timeMs: 1000, key: "k", meta: true },
		{ timeMs: 1500, key: "v", meta: true },
	];

	it("drops plain typing and orders cues by time", () => {
		const cues = buildKeyOverlayCues(events);
		expect(cues.map((cue) => cue.label)).toEqual(["⌘K", "⌘V", "⌘C"]);
	});

	it("never overlaps: a combo is replaced by the next one", () => {
		const [first, second, third] = buildKeyOverlayCues(events, { holdMs: 1200 });
		expect(first.endMs).toBe(second.startMs);
		expect(second.endMs).toBe(second.startMs + 1200);
		expect(third.endMs).toBe(third.startMs + 1200);
	});

	it("ignores invalid timestamps", () => {
		expect(
			buildKeyOverlayCues([
				{ timeMs: Number.NaN, key: "k", meta: true },
				{ timeMs: -5, key: "k", meta: true },
			]),
		).toEqual([]);
	});
});

describe("getActiveKeyCue", () => {
	const cues = buildKeyOverlayCues([{ timeMs: 1000, key: "k", meta: true }]);

	it("returns the cue only while it is on screen", () => {
		expect(getActiveKeyCue(cues, 999)).toBeNull();
		expect(getActiveKeyCue(cues, 1000)?.label).toBe("⌘K");
		expect(getActiveKeyCue(cues, 2199)?.label).toBe("⌘K");
		expect(getActiveKeyCue(cues, 2200)).toBeNull();
	});
});
