import type { useI18n } from "@/contexts/I18nContext";
import type { ExportReport, ExportReportRow } from "./exportReport";

const ROW_LABELS: Record<ExportReportRow["id"], [string, string]> = {
	output: ["editor.exportStatus.ledger.output", "Output"],
	frames: ["editor.exportStatus.ledger.frames", "Frames"],
	elapsed: ["editor.exportStatus.ledger.elapsed", "Rendered in"],
	speed: ["editor.exportStatus.ledger.speed", "Speed"],
	pipeline: ["editor.exportStatus.ledger.pipeline", "Pipeline"],
};

/**
 * What the exporter measured, as an inset. Values are mono and tabular so the
 * numbers line up; the only colour is the clay flag, reserved for a fast path
 * that was skipped.
 */
export function ExportLedger({
	report,
	t,
}: {
	report: ExportReport;
	t: ReturnType<typeof useI18n>["t"];
}) {
	return (
		<div className="mt-3 rounded-md bg-[#14140f] px-3 py-2.5 text-[#efece4]">
			<p className="font-mono text-[10px] uppercase tracking-[0.17em] text-[#85817a]">
				{t("editor.exportStatus.ledger.title", "Measured")}
			</p>
			<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px] tabular-nums">
				{report.rows.map((row) => (
					<div key={row.id} className="contents">
						<dt className="text-[#85817a]">{t(...ROW_LABELS[row.id])}</dt>
						<dd className="text-right">{row.value}</dd>
					</div>
				))}
			</dl>
			{report.skipReasons.length > 0 ? (
				<p className="mt-2 border-t border-[#2c2b25] pt-2 font-mono text-[11px] text-[#f57d51]">
					{t(
						"editor.exportStatus.ledger.skipped",
						"Fast native path skipped: {{reasons}}",
						{
							reasons: report.skipReasons.join(", "),
						},
					)}
				</p>
			) : null}
		</div>
	);
}
