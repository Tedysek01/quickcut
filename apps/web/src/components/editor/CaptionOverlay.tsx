"use client";

import { motion, AnimatePresence } from "motion/react";
import type { CaptionGroup, CaptionWord } from "@/lib/editor/PlaybackEngine";
import type { CaptionConfig } from "@/types/editConfig";
import type { Word } from "@/types/project";

interface CaptionOverlayProps {
  activeCaptions: CaptionGroup[];
  config: CaptionConfig;
  currentTime: number; // output time from PlaybackState
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

// Motion spring config for word highlight pop
const WORD_SPRING = { stiffness: 300, damping: 20, mass: 0.8 };

export default function CaptionOverlay({
  activeCaptions,
  config,
  currentTime,
}: CaptionOverlayProps) {
  if (!config.enabled || !activeCaptions.length) return null;

  const fontClass = FONT_SIZE_MAP[config.fontSize] || FONT_SIZE_MAP.medium;
  const positionClass = POSITION_MAP[config.position] || POSITION_MAP.center;
  const animation = config.animation || "none";

  // Common text style for TikTok-quality contrast
  const textStrokeStyle = {
    WebkitTextStroke: "1.5px rgba(0,0,0,0.8)",
    paintOrder: "stroke fill" as const,
  };

  return (
    <div
      className={`absolute left-0 right-0 ${positionClass} flex flex-col items-center pointer-events-none z-10 px-2`}
    >
      <AnimatePresence mode="popLayout">
        {activeCaptions.map((group, i) => (
          <CaptionLine
            key={`${group.startTime}-${i}`}
            group={group}
            config={config}
            currentTime={currentTime}
            animation={animation}
            fontClass={fontClass}
            textStrokeStyle={textStrokeStyle}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface CaptionLineProps {
  group: CaptionGroup;
  config: CaptionConfig;
  currentTime: number;
  animation: CaptionConfig["animation"];
  fontClass: string;
  textStrokeStyle: Record<string, string>;
}

function CaptionLine({
  group,
  config,
  currentTime,
  animation,
  fontClass,
  textStrokeStyle,
}: CaptionLineProps) {
  // Line-level animation: entire group fades/slides in
  const lineMotionProps =
    animation === "line_by_line"
      ? {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -8 },
          transition: { type: "spring" as const, stiffness: 200, damping: 20 },
        }
      : animation === "fade"
        ? {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            transition: { duration: 0.2 },
          }
        : {
            initial: { opacity: 1 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            transition: { duration: 0.1 },
          };

  return (
    <motion.div
      layout
      className={`${fontClass} font-bold text-center leading-tight`}
      style={{
        ...textStrokeStyle,
        backgroundColor: config.backgroundColor || undefined,
        padding: config.backgroundColor ? "4px 12px" : undefined,
        borderRadius: config.backgroundColor ? "6px" : undefined,
        fontFamily: config.font !== "Inter" ? config.font : undefined,
      }}
      {...lineMotionProps}
    >
      {animation === "word_by_word" || animation === "fade" ? (
        // Per-word rendering with highlight/animation
        group.words.map((word, wi) => (
          <WordSpan
            key={`${word.start}-${wi}`}
            word={word}
            config={config}
            currentTime={currentTime}
            animation={animation}
            isLast={wi === group.words.length - 1}
          />
        ))
      ) : (
        // "none" and "line_by_line": render as flat text with primary color
        <span style={{ color: config.primaryColor }}>{group.text}</span>
      )}
    </motion.div>
  );
}

interface WordSpanProps {
  word: CaptionWord;
  config: CaptionConfig;
  currentTime: number;
  animation: CaptionConfig["animation"];
  isLast: boolean;
}

function WordSpan({ word, config, currentTime, animation, isLast }: WordSpanProps) {
  const isActive = currentTime >= word.start && currentTime <= word.end;
  const hasBeenSpoken = currentTime > word.end;
  // Manual highlight from captionOverrides — always shows highlight color
  const isManualHighlight = word.highlight === true;

  if (animation === "word_by_word") {
    // Active word or manually highlighted word gets highlight color + scale pop
    const shouldHighlight = isActive || isManualHighlight;
    return (
      <motion.span
        animate={{
          color: shouldHighlight ? config.highlightColor : config.primaryColor,
          scale: isActive ? 1.08 : isManualHighlight ? 1.04 : 1,
        }}
        transition={{
          color: { type: "spring", ...WORD_SPRING },
          scale: { type: "spring", ...WORD_SPRING },
        }}
        style={{ display: "inline-block" }}
      >
        {word.word}
        {!isLast && "\u00A0"}
      </motion.span>
    );
  }

  // "fade" mode: each word fades in when it becomes active
  const isVisible = isActive || hasBeenSpoken;
  return (
    <motion.span
      animate={{
        opacity: isVisible ? 1 : 0.15,
        color: isActive || isManualHighlight ? config.highlightColor : config.primaryColor,
      }}
      transition={{ duration: 0.15 }}
      style={{ display: "inline-block" }}
    >
      {word.word}
      {!isLast && "\u00A0"}
    </motion.span>
  );
}
