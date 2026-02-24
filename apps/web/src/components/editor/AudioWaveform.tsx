"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useEditorStore } from "@/stores/editorStore";

/**
 * Audio waveform visualization for the Timeline.
 *
 * Decodes audio from the source/proxy video, extracts peaks,
 * and renders them as bars aligned with the output timeline (segment positions).
 * Uses Web Audio API for decoding — no external dependency needed.
 */

const PEAKS_PER_SECOND = 200;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB — covers ~15 min of 480p proxy
const MAX_FILE_SIZE_LABEL = "50 MB";

interface AudioWaveformProps {
  timelineZoom: number;
  onClick: (e: React.MouseEvent) => void;
}

export default function AudioWaveform({ timelineZoom, onClick }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [tooLarge, setTooLarge] = useState(false);

  const sourceVideoUrl = useEditorStore((s) => s.sourceVideoUrl);
  const proxyVideoUrl = useEditorStore((s) => s.proxyVideoUrl);
  const useProxy = useEditorStore((s) => s.useProxy);
  const editConfig = useEditorStore((s) => s.editConfig);
  const clipStart = useEditorStore((s) => s.clipStart);

  // Prefer proxy for audio decode (smaller file, same audio)
  const url = proxyVideoUrl || sourceVideoUrl;

  // Decode audio and extract peaks
  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    setLoading(true);
    setError(false);
    setTooLarge(false);

    (async () => {
      try {
        const response = await fetch(url);
        if (cancelled) return;

        // Check Content-Length header first (fast path)
        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
          setTooLarge(true);
          setLoading(false);
          return;
        }

        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        // Also check actual buffer size (Content-Length may be missing with CORS)
        if (buffer.byteLength > MAX_FILE_SIZE) {
          setTooLarge(true);
          setLoading(false);
          return;
        }

        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(buffer);
        if (cancelled) return;

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const samplesPerPeak = Math.floor(sampleRate / PEAKS_PER_SECOND);
        const peakCount = Math.ceil(channelData.length / samplesPerPeak);
        const peakData = new Float32Array(peakCount);

        for (let i = 0; i < peakCount; i++) {
          const start = i * samplesPerPeak;
          const end = Math.min(start + samplesPerPeak, channelData.length);
          let max = 0;
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > max) max = abs;
          }
          peakData[i] = max;
        }

        // 3-sample moving average smoothing to reduce visual noise
        const smoothed = new Float32Array(peakCount);
        for (let i = 0; i < peakCount; i++) {
          const prev = i > 0 ? peakData[i - 1] : peakData[i];
          const next = i < peakCount - 1 ? peakData[i + 1] : peakData[i];
          smoothed[i] = (prev + peakData[i] + next) / 3;
        }

        setPeaks(smoothed);
        setAudioDuration(audioBuffer.duration);
        audioCtx.close();
      } catch (err) {
        console.warn("Audio waveform decode failed:", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Compute segment-aligned peak slices for rendering
  // Segments use clip-relative times (0 = clip start), but peaks cover
  // the full source video audio, so we add clipStart to get source-absolute indices.
  const segmentPeaks = useMemo(() => {
    if (!peaks || !audioDuration || !editConfig?.segments) return [];

    const peaksPerSec = peaks.length / audioDuration;

    let outputOffset = 0;
    return editConfig.segments.map((seg) => {
      const startIdx = Math.floor((seg.sourceStart + clipStart) * peaksPerSec);
      const endIdx = Math.ceil((seg.sourceEnd + clipStart) * peaksPerSec);
      const slice = peaks.slice(
        Math.max(0, startIdx),
        Math.min(peaks.length, endIdx)
      );

      const result = {
        id: seg.id,
        peaks: slice,
        outputStart: outputOffset,
        duration: seg.sourceEnd - seg.sourceStart,
      };
      outputOffset += result.duration;
      return result;
    });
  }, [peaks, audioDuration, editConfig?.segments, clipStart]);

  // Render peaks to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !segmentPeaks.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const totalDur = segmentPeaks.reduce((acc, s) => acc + s.duration, 0);
    const canvasWidth = Math.ceil(totalDur * timelineZoom);
    const height = 28;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, height);

    for (const seg of segmentPeaks) {
      const x0 = seg.outputStart * timelineZoom;
      const segWidth = seg.duration * timelineZoom;
      const barCount = seg.peaks.length;

      if (barCount === 0) continue;

      const barWidth = segWidth / barCount;

      for (let i = 0; i < barCount; i++) {
        const barHeight = seg.peaks[i] * (height * 0.8);
        if (barHeight < 0.5) continue;

        const x = x0 + i * barWidth;
        const y = (height - barHeight) / 2;

        // Accent color at low opacity for the waveform
        ctx.fillStyle = "rgba(191, 255, 10, 0.35)";
        ctx.fillRect(x, y, Math.max(barWidth - 0.3, 0.5), barHeight);
      }
    }
  }, [segmentPeaks, timelineZoom]);

  if (!url) return null;

  const totalDuration = editConfig?.segments
    ? editConfig.segments.reduce(
        (acc, s) => acc + s.sourceEnd - s.sourceStart,
        0
      )
    : 0;
  const totalWidth = totalDuration * timelineZoom;

  return (
    <div
      className="relative flex-1"
      style={{ height: "28px" }}
      onClick={onClick}
    >
      {tooLarge ? (
        <span
          className="px-1 text-[8px] leading-7"
          style={{ color: "var(--text-disabled)" }}
        >
          File too large for waveform (max {MAX_FILE_SIZE_LABEL})
        </span>
      ) : error ? (
        <span
          className="px-1 text-[8px] leading-7"
          style={{ color: "var(--text-disabled)" }}
        >
          Waveform unavailable
        </span>
      ) : loading ? (
        <span
          className="px-1 text-[8px] leading-7"
          style={{ color: "var(--text-disabled)" }}
        >
          Analyzing audio...
        </span>
      ) : peaks ? (
        <canvas
          ref={canvasRef}
          style={{
            width: `${totalWidth}px`,
            height: "28px",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        />
      ) : null}
    </div>
  );
}
