import subprocess
from typing import List, Optional

from models.transcript import Word
from models.edit_config import CaptionConfig


def render_captions(
    video_path: str,
    words: List[Word],
    config: CaptionConfig,
    output_path: str,
    clip_start: float = 0,
    caption_overrides: Optional[dict] = None,
) -> str:
    """Overlay captions on video using FFmpeg drawtext filter.

    Words should already be remapped to the post-cut timeline by the caller.
    When clip_start=0 (default for remapped words), no further offset is applied.

    caption_overrides: dict mapping word index to {text, hidden, highlight} overrides.
    """
    if not config.enabled or not words:
        subprocess.run([
            "ffmpeg", "-i", video_path, "-c", "copy", "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    overrides = caption_overrides or {}

    # Filter words to clip range and adjust timestamps
    clip_words = []
    for i, w in enumerate(words):
        adjusted_start = round(w.start - clip_start, 2)
        adjusted_end = round(w.end - clip_start, 2)

        # Skip words before clip start
        if adjusted_end < 0:
            continue

        # Apply caption overrides
        override = overrides.get(str(i)) or overrides.get(i)
        if override:
            if isinstance(override, dict):
                if override.get("hidden"):
                    continue
                word_text = override.get("text", w.word)
            else:
                word_text = w.word
        else:
            word_text = w.word

        clip_words.append(Word(
            word=word_text,
            start=max(0, adjusted_start),
            end=adjusted_end,
            confidence=w.confidence,
            speaker=w.speaker,
        ))

    if not clip_words:
        subprocess.run([
            "ffmpeg", "-i", video_path, "-c", "copy", "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    # Build drawtext filter chain
    font_size = {"small": 36, "medium": 48, "large": 64}.get(config.fontSize, 48)
    y_position = {
        "top": "h*0.15",
        "center": "h*0.75",
        "bottom": "h*0.85",
    }.get(config.position, "h*0.75")

    # Group words into lines
    lines = _group_words_into_lines(clip_words, config.maxWordsPerLine)

    # Build filter for each line group
    drawtext_filters = []
    for line_words, line_start, line_end in lines:
        text = " ".join(w.word for w in line_words)
        # Escape special characters for FFmpeg
        text = _escape_ffmpeg_text(text)

        drawtext = (
            f"drawtext=text='{text}'"
            f":fontsize={font_size}"
            f":fontcolor={config.primaryColor}"
            f":x=(w-text_w)/2"
            f":y={y_position}"
            f":enable='between(t,{line_start:.2f},{line_end:.2f})'"
            f":shadowcolor=black:shadowx=2:shadowy=2"
        )
        drawtext_filters.append(drawtext)

    if not drawtext_filters:
        subprocess.run([
            "ffmpeg", "-i", video_path, "-c", "copy", "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    filter_str = ",".join(drawtext_filters)

    subprocess.run([
        "ffmpeg", "-i", video_path,
        "-vf", filter_str,
        "-c:a", "copy",
        "-y", output_path,
    ], check=True, capture_output=True)

    return output_path


def _escape_ffmpeg_text(text: str) -> str:
    """Escape special characters for FFmpeg drawtext filter."""
    # Order matters: escape backslash first
    text = text.replace("\\", "\\\\")
    text = text.replace("'", "'\\''")
    text = text.replace(":", "\\:")
    text = text.replace("[", "\\[")
    text = text.replace("]", "\\]")
    text = text.replace(";", "\\;")
    text = text.replace(",", "\\,")
    return text


def _group_words_into_lines(
    words: List[Word], max_words: int
) -> List[tuple]:
    """Group words into caption lines with timing."""
    lines = []
    i = 0
    while i < len(words):
        line_words = words[i : i + max_words]
        line_start = line_words[0].start
        line_end = line_words[-1].end
        lines.append((line_words, line_start, line_end))
        i += max_words
    return lines
