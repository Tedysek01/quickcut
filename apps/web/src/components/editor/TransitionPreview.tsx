"use client";

import type { ActiveTransition } from "@/lib/editor/PlaybackEngine";
import { getTransitionStyle } from "@/lib/editor/transitions";

interface TransitionPreviewProps {
  activeTransition: ActiveTransition | null;
}

/**
 * CSS overlay that renders a visual approximation of the active transition
 * during playback. Sits between the video container and captions.
 *
 * LIMITATION: The browser editor uses a single <video> element, so true
 * two-stream compositing (e.g. crossfade between outgoing and incoming frames)
 * is not possible. This overlay simulates the visual effect using CSS
 * opacity/clip-path on a solid color layer. The actual rendered video
 * (via FFmpeg xfade in renderer.py) produces correct frame-blending.
 *
 * Future improvement: Use PixiJS or dual <video> elements with WebGL
 * compositing to preview real frame-blending transitions.
 */
export default function TransitionPreview({ activeTransition }: TransitionPreviewProps) {
  if (!activeTransition) return null;

  const style = getTransitionStyle(
    activeTransition.transition,
    activeTransition.progress
  );

  if (!style) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[5]"
      style={style}
    />
  );
}
