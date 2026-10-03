import type { ExportMetrics } from "@/lib/exporter";

export interface ExportReportInput {
	metrics: ExportMetrics | undefined;
	width: number;
	height: number;
	frameRate: number;
	bitrate?: number;
}

export interface ExportReportRow {
	id: "output" | "frames" | "elapsed" | "speed" | "pipeline";
	value: string;
}

export interface ExportReport {
	rows: ExportReportRow[];
	/** Reasons the fast native path was skipped. Empty when nothing was skipped or unknown. */
	skipReasons: string[];
}

function formatDuration(ms: number): string {
	const seconds = ms / 1000;
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	const minutes = Math.floor(seconds / 60);
	return `${minutes}m ${Math.round(seconds - minutes * 60)}s`;
}

/**
 * Only measured values go in. A figure the exporter did not report is left out
 * rather than estimated, so every row can be defended.
 */
export function buildExportReport(input: ExportReportInput): ExportReport | null {
	const { metrics } = input;
	if (!metrics) return null;

	const rows: ExportReportRow[] = [
		{
			id: "output",
			value:
				`${input.width}×${input.height} · ${input.frameRate} fps` +
				(input.bitrate ? ` · ${(input.bitrate / 1_000_000).toFixed(1)} Mbps` : ""),
		},
	];

	const hasFrames = typeof metrics.frameCount === "number" && metrics.frameCount > 0;
	if (hasFrames) {
		rows.push({ id: "frames", value: String(metrics.frameCount) });
	}

	const hasElapsed = Number.isFinite(metrics.totalElapsedMs) && metrics.totalElapsedMs > 0;
	if (hasElapsed) {
		rows.push({ id: "elapsed", value: formatDuration(metrics.totalElapsedMs) });
	}

	if (hasFrames && hasElapsed) {
		const fps = (metrics.frameCount as number) / (metrics.totalElapsedMs / 1000);
		const speed = `${fps.toFixed(1)} fps`;
		const durationSec = metrics.effectiveDurationSec;
		rows.push({
			id: "speed",
			value:
				typeof durationSec === "number" && durationSec > 0
					? `${speed} · ${(durationSec / (metrics.totalElapsedMs / 1000)).toFixed(1)}× realtime`
					: speed,
		});
	}

	const pipeline = [metrics.renderBackend, metrics.encoderName ?? metrics.encodeBackend]
		.filter(Boolean)
		.join(" → ");
	if (pipeline) rows.push({ id: "pipeline", value: pipeline });

	const skipReasons = [
		...new Set(
			metrics.nativeStaticLayoutSkipReasons?.length
				? metrics.nativeStaticLayoutSkipReasons
				: metrics.nativeStaticLayoutSkipReason
					? [metrics.nativeStaticLayoutSkipReason]
					: [],
		),
	];

	return { rows, skipReasons };
}
