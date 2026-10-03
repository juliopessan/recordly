import { describe, expect, it } from "vitest";
import {
	EXPORT_PLATFORM_PRESETS,
	getExportPlatformPreset,
	matchExportPlatformPreset,
} from "./exportPlatformPresets";

describe("export platform presets", () => {
	it("has one preset per platform with a unique id", () => {
		const ids = EXPORT_PLATFORM_PRESETS.map((preset) => preset.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("matches a preset when every option equals it", () => {
		const tiktok = getExportPlatformPreset("tiktok");
		expect(
			matchExportPlatformPreset({
				aspectRatio: tiktok.aspectRatio,
				quality: tiktok.quality,
				frameRate: tiktok.frameRate,
			}),
		).toBe("tiktok");
	});

	it("stops matching as soon as one option is changed", () => {
		expect(
			matchExportPlatformPreset({ aspectRatio: "9:16", quality: "high", frameRate: 30 }),
		).toBeNull();
		expect(
			matchExportPlatformPreset({ aspectRatio: "9:16", quality: "good", frameRate: 60 }),
		).toBeNull();
	});

	it("never ties two presets to the same combination", () => {
		const combos = EXPORT_PLATFORM_PRESETS.map(
			(preset) => `${preset.aspectRatio}|${preset.quality}|${preset.frameRate}`,
		);
		expect(new Set(combos).size).toBe(combos.length);
	});
});
