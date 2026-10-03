import type { ClipSequenceSpan } from "../timeline/core/timelineTypes";
import {
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "@/components/ui/toast";
import { changeClipSpan } from "../clipSpanChange";
import {
	packClipSequence,
	reorderClipSequence,
	rippleRegionAnchors,
	rippleRegions,
} from "../clipSequence";
import { getClipSourceStartMs, type AnnotationRegion, type AudioRegion } from "../types";
import { planClipSplit } from "../clipSplit";
import {
	DEFAULT_SILENCE_REMOVAL_OPTIONS,
	planSilenceRemoval,
	type SilenceRemovalControls,
	type SilenceSpan,
} from "../silenceRemoval";
import type { ClipRegion, EditorEffectSection, ZoomRegion } from "../types";
import { supportsPreviewPlaybackRate } from "../videoPlayback/playbackRate";

type Translator = (
	key: string,
	fallback?: string,
	params?: Record<string, string | number>,
) => string;

interface UseClipRegionCommandsParams {
	setAnnotationRegions: Dispatch<SetStateAction<AnnotationRegion[]>>;
	setAudioRegions: Dispatch<SetStateAction<AudioRegion[]>>;
	sourceDurationMs: number;
	videoSourcePath: string | null;
	clipRegions: ClipRegion[];
	setClipRegions: Dispatch<SetStateAction<ClipRegion[]>>;
	zoomRegions: ZoomRegion[];
	setZoomRegions: Dispatch<SetStateAction<ZoomRegion[]>>;
	selectedClipId: string | null;
	setSelectedClipId: Dispatch<SetStateAction<string | null>>;
	setSelectedZoomId: Dispatch<SetStateAction<string | null>>;
	setSelectedAnnotationId: Dispatch<SetStateAction<string | null>>;
	setSelectedAudioId: Dispatch<SetStateAction<string | null>>;
	setSelectedCaptionId: Dispatch<SetStateAction<string | null>>;
	setActiveEffectSection: Dispatch<SetStateAction<EditorEffectSection>>;
	nextClipIdRef: MutableRefObject<number>;
	t: Translator;
}

export function useClipRegionCommands({
	setAnnotationRegions,
	setAudioRegions,
	sourceDurationMs,
	videoSourcePath,
	clipRegions,
	setClipRegions,
	setZoomRegions,
	selectedClipId,
	setSelectedClipId,
	setSelectedZoomId,
	setSelectedAnnotationId,
	setSelectedAudioId,
	setSelectedCaptionId,
	setActiveEffectSection,
	nextClipIdRef,
	t,
}: UseClipRegionCommandsParams) {
	const applySequence = useCallback(
		(edited: ClipRegion[]) => {
			const next = packClipSequence(edited);
			setClipRegions(next);
			setZoomRegions((current) => rippleRegions(current, clipRegions, next));
			setAnnotationRegions((current) => rippleRegions(current, clipRegions, next));
			setAudioRegions((current) => rippleRegionAnchors(current, clipRegions, next));
		},
		[clipRegions, setClipRegions, setZoomRegions, setAnnotationRegions, setAudioRegions],
	);

	const [silenceSpans, setSilenceSpans] = useState<{
		sourcePath: string;
		spans: SilenceSpan[];
	} | null>(null);
	const [isAnalyzingSilence, setIsAnalyzingSilence] = useState(false);
	const [minSilenceMs, setMinSilenceMs] = useState(DEFAULT_SILENCE_REMOVAL_OPTIONS.minSilenceMs);
	const analyzeInFlightRef = useRef(false);

	const analyzedSpans =
		silenceSpans && silenceSpans.sourcePath === videoSourcePath ? silenceSpans.spans : null;

	const silencePreview = useMemo(() => {
		if (!analyzedSpans) return null;
		const plan = planSilenceRemoval({
			clipRegions,
			silences: analyzedSpans,
			createId: () => "preview",
			options: { minSilenceMs },
		});
		return { cutCount: plan.cutCount, removedSourceMs: plan.removedSourceMs };
	}, [analyzedSpans, clipRegions, minSilenceMs]);

	const analyzeSilence = useCallback(async () => {
		if (analyzeInFlightRef.current) return;
		if (!videoSourcePath) {
			toast.error(t("editor.silence.noSource", "No source video is loaded"));
			return;
		}
		analyzeInFlightRef.current = true;
		setIsAnalyzingSilence(true);
		try {
			const detected = await window.electronAPI.detectRecordingSilence({
				videoPath: videoSourcePath,
			});
			if (!detected.success || !detected.silences) {
				toast.error(
					detected.message ??
						t("editor.silence.failed", "Could not analyze the recording audio"),
				);
				return;
			}
			setSilenceSpans({ sourcePath: videoSourcePath, spans: detected.silences });
		} finally {
			analyzeInFlightRef.current = false;
			setIsAnalyzingSilence(false);
		}
	}, [t, videoSourcePath]);

	const applySilenceRemoval = useCallback(() => {
		if (!analyzedSpans) return;
		const plan = planSilenceRemoval({
			clipRegions,
			silences: analyzedSpans,
			createId: () => `clip-${nextClipIdRef.current++}`,
			options: { minSilenceMs },
		});
		if (plan.cutCount === 0) {
			toast.info(t("editor.silence.none", "No long pauses found"));
			return;
		}
		applySequence(plan.clips);
		setSelectedClipId(null);
		toast.success(
			t("editor.silence.removed", "Removed {{count}} pauses, {{seconds}}s cut", {
				count: plan.cutCount,
				seconds: (plan.removedSourceMs / 1000).toFixed(1),
			}),
		);
	}, [
		analyzedSpans,
		applySequence,
		clipRegions,
		minSilenceMs,
		nextClipIdRef,
		setSelectedClipId,
		t,
	]);

	const silenceRemoval: SilenceRemovalControls = {
		minSilenceMs,
		setMinSilenceMs,
		isAnalyzing: isAnalyzingSilence,
		preview: silencePreview,
		analyze: analyzeSilence,
		apply: applySilenceRemoval,
	};

	const handleSelectClip = useCallback(
		(id: string | null) => {
			setSelectedClipId(id);
			if (id) {
				setActiveEffectSection("clip");
				setSelectedZoomId(null);
				setSelectedAnnotationId(null);
				setSelectedAudioId(null);
				setSelectedCaptionId(null);
			} else {
				setActiveEffectSection((section) => (section === "clip" ? "scene" : section));
			}
		},
		[
			setActiveEffectSection,
			setSelectedAnnotationId,
			setSelectedAudioId,
			setSelectedCaptionId,
			setSelectedClipId,
			setSelectedZoomId,
		],
	);

	const handleClipSplit = useCallback(
		(splitMs: number) => {
			const plan = planClipSplit({
				clipRegions,
				splitMs,
				createId: () => `clip-${nextClipIdRef.current++}`,
			});
			if (!plan) return;
			setClipRegions((current) =>
				current.flatMap((clip) =>
					clip.id === plan.targetId ? [plan.left, plan.right] : [clip],
				),
			);
			if (selectedClipId === plan.targetId) setSelectedClipId(plan.left.id);
		},
		[clipRegions, nextClipIdRef, selectedClipId, setClipRegions, setSelectedClipId],
	);

	const handleClipSpanChange = useCallback(
		(id: string, span: ClipSequenceSpan) => {
			const oldClip = clipRegions.find((clip) => clip.id === id);
			const newStart = Math.round(span.start);
			const newEnd = Math.round(span.end);

			if (!oldClip) return;
			if (span.sequenceIndex !== undefined) {
				applySequence(reorderClipSequence(clipRegions, id, span.sequenceIndex));
				return;
			}
			applySequence(
				clipRegions.map((clip) =>
					clip.id === id
						? changeClipSpan(clip, newStart, newEnd, sourceDurationMs)
						: clip,
				),
			);
		},
		[clipRegions, applySequence, sourceDurationMs],
	);

	const handleClipSpeedChange = useCallback(
		(speed: number) => {
			if (!selectedClipId || !Number.isFinite(speed) || speed <= 0) return;
			if (!supportsPreviewPlaybackRate(speed)) {
				toast.error(
					t(
						"editor.timeline.unsupportedSpeed",
						"This speed is not supported for preview on this device.",
					),
				);
				return;
			}

			applySequence(
				clipRegions.map((clip) =>
					clip.id === selectedClipId
						? {
								...clip,
								sourceStartMs: getClipSourceStartMs(clip),
								speed,
								endMs:
									clip.startMs +
									Math.max(
										1,
										Math.round(
											((clip.endMs - clip.startMs) * clip.speed) / speed,
										),
									),
							}
						: clip,
				),
			);
		},
		[clipRegions, selectedClipId, applySequence, t],
	);

	const handleClipMutedChange = useCallback(
		(muted: boolean) => {
			if (!selectedClipId) return;
			setClipRegions((current) =>
				current.map((clip) => (clip.id === selectedClipId ? { ...clip, muted } : clip)),
			);
		},
		[selectedClipId, setClipRegions],
	);
	const handleClipShowSourceAudioChange = useCallback(
		(showSourceAudio: boolean) => {
			if (!selectedClipId) return;
			setClipRegions((current) =>
				current.map((clip) =>
					clip.id === selectedClipId ? { ...clip, showSourceAudio } : clip,
				),
			);
		},
		[selectedClipId, setClipRegions],
	);

	const handleClipDelete = useCallback(
		(id: string) => {
			applySequence(clipRegions.filter((clip) => clip.id !== id));
			if (selectedClipId === id) setSelectedClipId(null);
		},
		[clipRegions, selectedClipId, applySequence, setSelectedClipId],
	);

	return {
		handleSelectClip,
		handleClipSplit,
		handleClipSpanChange,
		handleClipSpeedChange,
		handleClipMutedChange,
		handleClipShowSourceAudioChange,
		handleClipDelete,
		silenceRemoval,
	};
}
