"use client";

import type { CaptionGroup } from "@/lib/editor/PlaybackEngine";
import type { CaptionConfig } from "@/types/editConfig";

interface CaptionOverlayProps {
  activeCaptions: CaptionGroup[];
  config: CaptionConfig;
}

const FONT_SIZE_MAP: Record<string, string> = {
  small: "text-lg",
  medium: "text-2xl",
  large: "text-3xl",
};

const POSITION_MAP: Record<string, string> = {
  top: "top-[15%]",
  center: "top-[70%]",
  bottom: "top-[82%]",
};

export default function CaptionOverlay({ activeCaptions, config }: CaptionOverlayProps) {
  if (!config.enabled || !activeCaptions.length) return null;

  const fontClass = FONT_SIZE_MAP[config.fontSize] || FONT_SIZE_MAP.medium;
  const positionClass = POSITION_MAP[config.position] || POSITION_MAP.center;

  return (
    <div
      className={`absolute left-0 right-0 ${positionClass} flex flex-col items-center pointer-events-none z-10 px-2`}
    >
      {activeCaptions.map((group, i) => (
        <div
          key={`${group.startTime}-${i}`}
          className={`${fontClass} font-bold text-center leading-tight`}
          style={{
            color: config.primaryColor,
            textShadow: "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.5)",
            backgroundColor: config.backgroundColor || undefined,
            padding: config.backgroundColor ? "4px 12px" : undefined,
            borderRadius: config.backgroundColor ? "6px" : undefined,
            fontFamily: config.font !== "Inter" ? config.font : undefined,
          }}
        >
          {group.text}
        </div>
      ))}
    </div>
  );
}
