import { describe, expect, it } from "vitest";
import { buildExportReport } from "./exportReport";

const base = { width: 1920, height: 1080, frameRate: 60, bitrate: 18_000_000 };

describe("buildExportReport", () => {
	it("returns null when the exporter reported no metrics", () => {
		expect(buildExportReport({ ...base, metrics: undefined })).toBeNull();
	});

	it("derives speed from measured frames and elapsed time", () => {
		const report = buildExportReport({
			...base,
			metrics: { totalElapsedMs: 10_000, frameCount: 600, effectiveDurationSec: 10 },
		});
		const byId = Object.fromEntries(report?.rows.map((row) => [row.id, row.value]) ?? []);
		expect(byId.output).toBe("1920×1080 · 60 fps · 18.0 Mbps");
		expect(byId.frames).toBe("600");
		expect(byId.elapsed).toBe("10.0s");
		expect(byId.speed).toBe("60.0 fps · 1.0× realtime");
	});

	it("omits figures the exporter did not report instead of estimating them", () => {
		const report = buildExportReport({ ...base, metrics: { totalElapsedMs: 0 } });
		expect(report?.rows.map((row) => row.id)).toEqual(["output"]);
	});

	it("names the render and encode pipeline", () => {
		const report = buildExportReport({
			...base,
			metrics: {
				totalElapsedMs: 4000,
				frameCount: 120,
				renderBackend: "webgpu",
				encoderName: "h264_videotoolbox",
			},
		});
		expect(report?.rows.find((row) => row.id === "pipeline")?.value).toBe(
			"webgpu → h264_videotoolbox",
		);
	});

	it("surfaces unique native-path skip reasons", () => {
		const report = buildExportReport({
			...base,
			metrics: {
				totalElapsedMs: 4000,
				nativeStaticLayoutSkipReasons: ["webcam overlay", "webcam overlay", "annotations"],
			},
		});
		expect(report?.skipReasons).toEqual(["webcam overlay", "annotations"]);
	});

	it("falls back to the single skip reason", () => {
		const report = buildExportReport({
			...base,
			metrics: { totalElapsedMs: 4000, nativeStaticLayoutSkipReason: "gif" },
		});
		expect(report?.skipReasons).toEqual(["gif"]);
	});

	it("formats long exports in minutes", () => {
		const report = buildExportReport({ ...base, metrics: { totalElapsedMs: 125_000 } });
		expect(report?.rows.find((row) => row.id === "elapsed")?.value).toBe("2m 5s");
	});
});
