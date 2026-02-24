"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react";
import { PlaybackEngine, type PlaybackState, type ActiveZoom, type CaptionGroup } from "@/lib/editor/PlaybackEngine";
import CaptionOverlay from "@/components/editor/CaptionOverlay";
import TransitionPreview from "@/components/editor/TransitionPreview";
import AnnotationOverlay from "@/components/editor/AnnotationOverlay";
import { useEditorStore } from "@/stores/editorStore";
import type { EditConfig } from "@/types/editConfig";
import type { Word } from "@/types/project";

interface VideoPreviewProps {
  /** URL to the original source video (not the rendered video) */
  sourceUrl: string | null;
  /** Fallback: URL to the pre-rendered video (used when sourceUrl is unavailable) */
  renderedUrl?: string | null;
  poster?: string | null;
}

export default function VideoPreview({ sourceUrl, renderedUrl, poster }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    editConfig,
    transcript,
    clipStart,
    clipEnd,
    setPlaybackState,
  } = useEditorStore();

  const [muted, setMuted] = useState(false);
  const [playbackState, setLocalPlaybackState] = useState<PlaybackState | null>(null);

  // Determine which URL to use: source video for NLE mode, rendered for fallback
  const videoUrl = sourceUrl || renderedUrl || null;
  const isNLEMode = !!sourceUrl && !!editConfig;

  // Initialize PlaybackEngine when video and editConfig are ready
  useEffect(() => {
    if (!isNLEMode || !videoRef.current || !editConfig) return;

    const engine = new PlaybackEngine(
      videoRef.current,
      editConfig,
      transcript,
      clipStart,
      clipEnd
    );

    const unsubscribe = engine.subscribe((state) => {
      setLocalPlaybackState(state);
      setPlaybackState(state.isPlaying, state.outputTime, state.totalDuration);
    });

    engineRef.current = engine;

    return () => {
      unsubscribe();
      engine.destroy();
      engineRef.current = null;
    };
  // Re-create engine when source URL changes (but NOT on every editConfig change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl, isNLEMode, clipStart, clipEnd]);

  // Update engine when editConfig changes (without recreating)
  useEffect(() => {
    if (engineRef.current && editConfig) {
      engineRef.current.updateEditConfig(editConfig, transcript, clipStart);
    }
  }, [editConfig, transcript, clipStart]);

  const togglePlay = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.togglePlay();
    } else if (videoRef.current) {
      // Fallback for rendered video mode
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, []);

  // Listen for space-to-play custom event from editor page keyboard shortcuts
  useEffect(() => {
    const handler = () => togglePlay();
    window.addEventListener("editor:toggle-play", handler);
    return () => window.removeEventListener("editor:toggle-play", handler);
  }, [togglePlay]);

  // Listen for J/K/L shuttle, arrow frame-step, and timeline seek events
  useEffect(() => {
    const handleShuttle = (e: Event) => {
      const speed = (e as CustomEvent).detail?.speed ?? 0;
      if (engineRef.current) {
        engineRef.current.setShuttleSpeed(speed);
      }
    };
    const handleStep = (e: Event) => {
      const seconds = (e as CustomEvent).detail?.seconds ?? 0;
      if (engineRef.current) {
        engineRef.current.step(seconds);
      } else if (videoRef.current) {
        videoRef.current.currentTime += seconds;
      }
    };
    const handleSeekEvent = (e: Event) => {
      const time = (e as CustomEvent).detail?.time ?? 0;
      if (engineRef.current) {
        engineRef.current.seek(time);
      }
    };
    window.addEventListener("editor:shuttle", handleShuttle);
    window.addEventListener("editor:step", handleStep);
    window.addEventListener("editor:seek", handleSeekEvent);
    return () => {
      window.removeEventListener("editor:shuttle", handleShuttle);
      window.removeEventListener("editor:step", handleStep);
      window.removeEventListener("editor:seek", handleSeekEvent);
    };
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (engineRef.current) {
      engineRef.current.seek(time);
    } else if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const stepBack = useCallback(() => {
    if (engineRef.current) engineRef.current.step(-5);
  }, []);

  const stepForward = useCallback(() => {
    if (engineRef.current) engineRef.current.step(5);
  }, []);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Compute zoom CSS transform
  const zoomStyle = playbackState?.activeZoom
    ? {
        transform: `scale(${playbackState.activeZoom.scale})`,
        transformOrigin: `${playbackState.activeZoom.anchorX * 100}% ${playbackState.activeZoom.anchorY * 100}%`,
        willChange: "transform" as const,
      }
    : { transform: "scale(1)", willChange: "transform" as const };

  const currentTime = playbackState?.outputTime ?? 0;
  const duration = playbackState?.totalDuration ?? 0;
  const isPlaying = playbackState?.isPlaying ?? false;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!videoUrl) {
    return (
      <div
        className="aspect-[9/16] rounded-xl flex items-center justify-center"
        style={{ background: "var(--bg-card)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-disabled)" }}>
          No video available
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Video container with zoom transform and caption overlay */}
      <div
        ref={containerRef}
        className="relative aspect-[9/16] max-h-[600px] mx-auto overflow-hidden"
        style={{ background: "#000" }}
      >
        <div style={zoomStyle} className="w-full h-full transition-transform duration-75">
          <video
            ref={videoRef}
            src={videoUrl}
            poster={poster || undefined}
            className="w-full h-full object-contain"
            muted={muted}
            playsInline
            preload="auto"
            // Fallback mode: handle native events when no PlaybackEngine
            {...(!isNLEMode && {
              onTimeUpdate: () => {
                if (videoRef.current) {
                  setLocalPlaybackState({
                    isPlaying: !videoRef.current.paused,
                    outputTime: videoRef.current.currentTime,
                    sourceTime: videoRef.current.currentTime,
                    totalDuration: videoRef.current.duration || 0,
                    currentSegmentIndex: 0,
                    activeZoom: null,
                    activeTransition: null,
                    activeCaptions: [],
                    activeAnnotations: [],
                  });
                }
              },
              onLoadedMetadata: () => {
                if (videoRef.current) {
                  setLocalPlaybackState((prev) => ({
                    ...(prev || {
                      isPlaying: false,
                      outputTime: 0,
                      sourceTime: 0,
                      totalDuration: 0,
                      currentSegmentIndex: 0,
                      activeZoom: null,
                      activeTransition: null,
                      activeCaptions: [],
                      activeAnnotations: [],
                    }),
                    totalDuration: videoRef.current!.duration,
                  }));
                }
              },
              onEnded: () => {
                setLocalPlaybackState((prev) =>
                  prev ? { ...prev, isPlaying: false } : prev
                );
              },
            })}
          />
        </div>

        {/* Transition preview overlay */}
        {isNLEMode && (
          <TransitionPreview
            activeTransition={playbackState?.activeTransition ?? null}
          />
        )}

        {/* Annotation overlay — z-[8], between transitions and captions */}
        {isNLEMode && (playbackState?.activeAnnotations?.length ?? 0) > 0 && containerRef.current && (
          <AnnotationOverlay
            annotations={playbackState!.activeAnnotations}
            containerWidth={containerRef.current.clientWidth}
            containerHeight={containerRef.current.clientHeight}
          />
        )}

        {/* Caption overlay - only in NLE mode */}
        {isNLEMode && editConfig && (
          <CaptionOverlay
            activeCaptions={playbackState?.activeCaptions ?? []}
            config={editConfig.captions}
            currentTime={playbackState?.outputTime ?? 0}
          />
        )}
      </div>

      {/* Transport controls */}
      <div className="p-3 space-y-2">
        {/* Progress bar */}
        <div className="relative group">
          <div className="progress-bar" style={{ height: "4px" }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            style={{ height: "4px" }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <button
              onClick={stepBack}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title="Back 5s"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={stepForward}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title="Forward 5s"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setMuted(!muted)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          </div>
          <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
