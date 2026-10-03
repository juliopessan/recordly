/** A key press captured during recording, in source (recording) milliseconds. */
export interface KeystrokeEvent {
	timeMs: number;
	/** Lower-case key name: a single character ("k") or a name ("enter", "arrowleft"). */
	key: string;
	meta?: boolean;
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
}

export interface KeyOverlayCue {
	id: string;
	startMs: number;
	endMs: number;
	label: string;
}

export interface KeyOverlayOptions {
	/** How long a combo stays on screen. */
	holdMs: number;
	platform: "mac" | "other";
}

export const DEFAULT_KEY_OVERLAY_OPTIONS: KeyOverlayOptions = {
	holdMs: 1200,
	platform: "mac",
};

/**
 * Only combinations that include Cmd, Ctrl or Alt are shown. Plain typing, and
 * Shift+letter, is never turned into a cue: a keystroke overlay built from raw
 * typing would put passwords on screen and in the project file.
 */
export function isShortcutKeystroke(event: KeystrokeEvent): boolean {
	return Boolean(event.meta || event.ctrl || event.alt);
}

const MAC_KEY_NAMES: Record<string, string> = {
	enter: "↵",
	return: "↵",
	escape: "⎋",
	esc: "⎋",
	tab: "⇥",
	backspace: "⌫",
	delete: "⌦",
	space: "Space",
	arrowleft: "←",
	arrowright: "→",
	arrowup: "↑",
	arrowdown: "↓",
};

const OTHER_KEY_NAMES: Record<string, string> = {
	enter: "Enter",
	return: "Enter",
	escape: "Esc",
	esc: "Esc",
	tab: "Tab",
	backspace: "Backspace",
	delete: "Delete",
	space: "Space",
	arrowleft: "←",
	arrowright: "→",
	arrowup: "↑",
	arrowdown: "↓",
};

function formatKeyName(key: string, platform: KeyOverlayOptions["platform"]): string {
	const names = platform === "mac" ? MAC_KEY_NAMES : OTHER_KEY_NAMES;
	const normalized = key.toLowerCase();
	if (names[normalized]) return names[normalized];
	if (/^f\d{1,2}$/.test(normalized)) return normalized.toUpperCase();
	return normalized.length === 1 ? normalized.toUpperCase() : key;
}

export function formatKeyCombo(
	event: KeystrokeEvent,
	platform: KeyOverlayOptions["platform"] = "mac",
): string {
	const key = formatKeyName(event.key, platform);
	if (platform === "mac") {
		// Apple's modifier order: control, option, shift, command.
		return `${event.ctrl ? "⌃" : ""}${event.alt ? "⌥" : ""}${event.shift ? "⇧" : ""}${event.meta ? "⌘" : ""}${key}`;
	}
	const parts = [
		event.ctrl && "Ctrl",
		event.alt && "Alt",
		event.shift && "Shift",
		event.meta && "Win",
		key,
	].filter(Boolean);
	return parts.join(" + ");
}

/**
 * Turn captured keystrokes into on-screen cues. Cues never overlap: a combo is
 * replaced as soon as the next one is pressed, and otherwise lingers for
 * `holdMs`.
 */
export function buildKeyOverlayCues(
	events: KeystrokeEvent[],
	options?: Partial<KeyOverlayOptions>,
): KeyOverlayCue[] {
	const { holdMs, platform } = { ...DEFAULT_KEY_OVERLAY_OPTIONS, ...options };
	const shortcuts = events
		.filter(isShortcutKeystroke)
		.filter((event) => Number.isFinite(event.timeMs) && event.timeMs >= 0)
		.sort((left, right) => left.timeMs - right.timeMs);

	return shortcuts.map((event, index) => {
		const startMs = Math.round(event.timeMs);
		const nextStartMs = shortcuts[index + 1]
			? Math.round(shortcuts[index + 1].timeMs)
			: Number.POSITIVE_INFINITY;
		return {
			id: `key-${index + 1}`,
			startMs,
			endMs: Math.min(startMs + holdMs, nextStartMs),
			label: formatKeyCombo(event, platform),
		};
	});
}

export function getActiveKeyCue(cues: KeyOverlayCue[], timeMs: number): KeyOverlayCue | null {
	return cues.find((cue) => timeMs >= cue.startMs && timeMs < cue.endMs) ?? null;
}
