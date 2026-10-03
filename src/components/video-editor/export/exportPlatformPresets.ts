import type { ExportMp4FrameRate, ExportQuality } from "@/lib/exporter";
import type { AspectRatio } from "@/utils/aspectRatioUtils";

export type ExportPlatformPresetId = "youtube" | "tiktok" | "instagram" | "linkedin";

export interface ExportPlatformPreset {
	id: ExportPlatformPresetId;
	aspectRatio: AspectRatio;
	quality: ExportQuality;
	frameRate: ExportMp4FrameRate;
}

/**
 * Starting points for each platform's native frame shape. They only set options
 * the export dialog already exposes; the user can still change any of them.
 */
export const EXPORT_PLATFORM_PRESETS: readonly ExportPlatformPreset[] = [
	{ id: "youtube", aspectRatio: "16:9", quality: "high", frameRate: 30 },
	{ id: "tiktok", aspectRatio: "9:16", quality: "good", frameRate: 30 },
	{ id: "instagram", aspectRatio: "4:5", quality: "good", frameRate: 30 },
	{ id: "linkedin", aspectRatio: "1:1", quality: "good", frameRate: 30 },
];

export function getExportPlatformPreset(id: ExportPlatformPresetId): ExportPlatformPreset {
	const preset = EXPORT_PLATFORM_PRESETS.find((candidate) => candidate.id === id);
	if (!preset) throw new Error(`Unknown export platform preset: ${id}`);
	return preset;
}

/** The preset the current settings exactly match, or null once any option is changed. */
export function matchExportPlatformPreset(current: {
	aspectRatio: AspectRatio;
	quality: ExportQuality;
	frameRate: ExportMp4FrameRate;
}): ExportPlatformPresetId | null {
	return (
		EXPORT_PLATFORM_PRESETS.find(
			(preset) =>
				preset.aspectRatio === current.aspectRatio &&
				preset.quality === current.quality &&
				preset.frameRate === current.frameRate,
		)?.id ?? null
	);
}
