"""Build FFmpeg drawtext filters for text annotations overlay.

Converts percentage-based AnnotationConfig positions to pixel coordinates
and generates drawtext filter expressions with enable/disable timing.
"""

from typing import List

from models.edit_config import AnnotationConfig


def _escape_ffmpeg_text(text: str) -> str:
    """Escape special characters for FFmpeg drawtext filter."""
    text = text.replace("\\", "\\\\")
    text = text.replace("'", "'\\''")
    text = text.replace(":", "\\:")
    text = text.replace("[", "\\[")
    text = text.replace("]", "\\]")
    text = text.replace(";", "\\;")
    text = text.replace(",", "\\,")
    return text


def build_annotation_filters(
    annotations: List[AnnotationConfig],
    video_width: int,
    video_height: int,
) -> str:
    """Generate FFmpeg drawtext filter string for all text annotations.

    Each annotation is rendered as a drawtext with:
    - Position converted from percentage to pixels
    - enable='between(t, start, end)' for timing
    - Optional box background via drawbox or drawtext box option

    Returns a comma-separated filter string, or empty string if no annotations.
    """
    if not annotations:
        return ""

    filters = []
    for ann in annotations:
        if ann.type != "text" or not ann.content.strip():
            continue

        # Convert percentage position to pixels
        x_px = int(ann.x / 100 * video_width)
        y_px = int(ann.y / 100 * video_height)
        font_size = ann.style.fontSize

        text = _escape_ffmpeg_text(ann.content)
        font = ann.style.fontFamily or "Inter"

        # Build drawtext filter
        parts = [
            f"drawtext=text='{text}'",
            f":fontsize={font_size}",
            f":fontcolor={ann.style.color}",
            f":x={x_px}",
            f":y={y_px}",
            f":enable='between(t,{ann.startTime:.2f},{ann.endTime:.2f})'",
            ":borderw=2:bordercolor=black",
        ]

        # Background box if specified
        if ann.style.backgroundColor:
            parts.append(f":box=1:boxcolor={ann.style.backgroundColor}:boxborderw=6")

        filters.append("".join(parts))

    return ",".join(filters)
