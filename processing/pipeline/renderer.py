import subprocess
import os
import json
import logging
from typing import List, Optional

from models.edit_config import EditConfig, CutConfig, ZoomConfig, SegmentConfig
from models.transcript import Word
from pipeline.captions import render_captions
from pipeline.time_map import TimeMap

logger = logging.getLogger(__name__)


def _get_video_info(video_path: str) -> dict:
    """Get video metadata via ffprobe."""
    result = subprocess.run([
        "ffprobe", "-v", "quiet", "-show_streams", "-show_format",
        "-print_format", "json", video_path,
    ], capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    video_stream = next(s for s in data["streams"] if s["codec_type"] == "video")
    fps_parts = video_stream.get("r_frame_rate", "30/1").split("/")
    return {
        "width": int(video_stream["width"]),
        "height": int(video_stream["height"]),
        "fps": round(int(fps_parts[0]) / int(fps_parts[1])) if len(fps_parts) == 2 else 30,
        "duration": float(data["format"]["duration"]),
    }


def _get_duration(video_path: str) -> float:
    """Get video duration in seconds."""
    result = subprocess.run([
        "ffprobe", "-v", "quiet", "-show_format",
        "-print_format", "json", video_path,
    ], capture_output=True, text=True, check=True)
    return float(json.loads(result.stdout)["format"]["duration"])


def extract_clip(video_path: str, start: float, end: float, output_path: str) -> str:
    """Extract a segment from the video."""
    subprocess.run([
        "ffmpeg", "-i", video_path,
        "-ss", str(start), "-to", str(end),
        "-c:v", "libx264", "-c:a", "aac",
        "-y", output_path,
    ], check=True, capture_output=True)
    return output_path


def apply_cuts(video_path: str, cuts: List[CutConfig], output_path: str) -> str:
    """Remove dead air segments from video using FFmpeg concat with audio crossfade."""
    if not cuts:
        subprocess.run([
            "ffmpeg", "-i", video_path, "-c", "copy", "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    duration = _get_duration(video_path)

    # Sort cuts by start time
    sorted_cuts = sorted(cuts, key=lambda c: c.start)

    # Calculate keep segments (inverse of cuts)
    keep_segments = []
    current = 0.0
    for cut in sorted_cuts:
        if cut.start > current:
            keep_segments.append((current, cut.start))
        current = max(current, cut.end)
    if current < duration:
        keep_segments.append((current, duration))

    return _concat_segments(video_path, keep_segments, output_path)


def apply_segments(video_path: str, segments: List[SegmentConfig], output_path: str) -> str:
    """Assemble video from explicit segments (parts to keep).

    This is the segments-first approach used by the NLE editor.
    Each segment defines a source time range to include in the output.
    Supports xfade transitions between segments when specified.
    """
    if not segments:
        subprocess.run([
            "ffmpeg", "-i", video_path, "-c", "copy", "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    sorted_segments = sorted(segments, key=lambda s: s.sourceStart)

    # Check if any segment (except first) has a non-trivial transition
    has_transitions = any(
        s.transition not in ("none", "hard", "")
        for s in sorted_segments[1:]
    )

    if has_transitions:
        return _concat_segments_with_transitions(video_path, sorted_segments, output_path)

    keep_segments = [
        (seg.sourceStart, seg.sourceEnd)
        for seg in sorted_segments
    ]

    return _concat_segments(video_path, keep_segments, output_path)


# Map ClipAI transition names to FFmpeg xfade transition names
_XFADE_MAP = {
    "crossfade": "fade",
    "fade": "fadeblack",
    "wipe_left": "wipeleft",
    "wipe_right": "wiperight",
    "slide_up": "slideup",
    "dissolve": "dissolve",
    "zoom_in": "zoomin",
    "circle": "circleopen",
}


def _concat_segments_with_transitions(
    video_path: str, segments: List[SegmentConfig], output_path: str
) -> str:
    """Concatenate segments using FFmpeg xfade for smooth transitions between cuts."""
    if len(segments) == 1:
        start, end = segments[0].sourceStart, segments[0].sourceEnd
        subprocess.run([
            "ffmpeg", "-i", video_path,
            "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
            "-c:v", "libx264", "-c:a", "aac",
            "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    # Build filter_complex with xfade between consecutive segments
    filter_parts = []
    durations = []

    # Trim each segment
    for i, seg in enumerate(segments):
        s, e = seg.sourceStart, seg.sourceEnd
        dur = e - s
        durations.append(dur)
        filter_parts.append(
            f"[0:v]trim=start={s:.3f}:end={e:.3f},setpts=PTS-STARTPTS[v{i}];"
        )
        filter_parts.append(
            f"[0:a]atrim=start={s:.3f}:end={e:.3f},asetpts=PTS-STARTPTS[a{i}];"
        )

    # Chain xfade operations between consecutive segments
    # Running offset tracks output duration as transitions overlap
    prev_v = "v0"
    prev_a = "a0"
    running_dur = durations[0]

    for i in range(1, len(segments)):
        seg = segments[i]
        xfade_name = _XFADE_MAP.get(seg.transition, None)
        trans_dur = getattr(seg, "transitionDuration", 0.3) or 0.3
        trans_dur = min(trans_dur, durations[i] * 0.5, running_dur * 0.5)

        if xfade_name and trans_dur > 0:
            offset = running_dur - trans_dur
            out_v = f"xv{i}" if i < len(segments) - 1 else "outv"
            out_a = f"xa{i}" if i < len(segments) - 1 else "outa"
            filter_parts.append(
                f"[{prev_v}][v{i}]xfade=transition={xfade_name}:duration={trans_dur:.3f}:offset={offset:.3f}[{out_v}];"
            )
            filter_parts.append(
                f"[{prev_a}][a{i}]acrossfade=d={trans_dur:.3f}:c1=tri:c2=tri[{out_a}];"
            )
            prev_v = out_v
            prev_a = out_a
            running_dur = offset + durations[i]
        else:
            # Hard cut - just concat
            out_v = f"hv{i}" if i < len(segments) - 1 else "outv"
            out_a = f"ha{i}" if i < len(segments) - 1 else "outa"
            filter_parts.append(
                f"[{prev_v}][v{i}]concat=n=2:v=1:a=0[{out_v}];"
            )
            filter_parts.append(
                f"[{prev_a}][a{i}]concat=n=2:v=0:a=1[{out_a}];"
            )
            prev_v = out_v
            prev_a = out_a
            running_dur += durations[i]

    filter_str = "".join(filter_parts).rstrip(";")

    result = subprocess.run([
        "ffmpeg", "-i", video_path,
        "-filter_complex", filter_str,
        "-map", f"[outv]", "-map", f"[outa]",
        "-c:v", "libx264", "-c:a", "aac",
        "-y", output_path,
    ], capture_output=True, text=True)

    if result.returncode != 0:
        logger.warning(f"xfade failed, falling back to hard cuts: {result.stderr[-300:]}")
        # Fallback to simple concat
        keep_segments = [(s.sourceStart, s.sourceEnd) for s in segments]
        return _concat_segments(video_path, keep_segments, output_path)

    return output_path


def _concat_segments(video_path: str, keep_segments: List[tuple], output_path: str) -> str:
    """Internal: concatenate keep-segments into a single video with audio crossfade."""
    if not keep_segments:
        subprocess.run([
            "ffmpeg", "-i", video_path, "-c", "copy", "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    if len(keep_segments) == 1:
        # Only one segment - just trim
        start, end = keep_segments[0]
        subprocess.run([
            "ffmpeg", "-i", video_path,
            "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
            "-c:v", "libx264", "-c:a", "aac",
            "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    # Build FFmpeg filter_complex with audio crossfade between segments.
    # Each segment gets a small fade out/in (50ms) to prevent audio pops.
    FADE_MS = 0.05  # 50ms crossfade
    filter_parts = []
    concat_inputs = []

    for i, (start, end) in enumerate(keep_segments):
        seg_duration = end - start

        # Trim video and audio
        v_filter = f"[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS"
        a_filter = f"[0:a]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS"

        # Add small audio fade in/out to prevent pops at cut points
        if i > 0 and seg_duration > FADE_MS * 2:
            a_filter += f",afade=t=in:d={FADE_MS}"
        if i < len(keep_segments) - 1 and seg_duration > FADE_MS * 2:
            a_filter += f",afade=t=out:st={seg_duration - FADE_MS:.3f}:d={FADE_MS}"

        filter_parts.append(f"{v_filter}[v{i}];{a_filter}[a{i}];")
        concat_inputs.append(f"[v{i}][a{i}]")

    filter_str = "".join(filter_parts)
    filter_str += f"{''.join(concat_inputs)}concat=n={len(keep_segments)}:v=1:a=1[outv][outa]"

    subprocess.run([
        "ffmpeg", "-i", video_path,
        "-filter_complex", filter_str,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-c:a", "aac",
        "-y", output_path,
    ], check=True, capture_output=True)

    return output_path


def apply_zooms(video_path: str, zooms: List[ZoomConfig], output_path: str) -> str:
    """Apply zoom keyframes to video using FFmpeg scale+crop."""
    if not zooms:
        subprocess.run([
            "ffmpeg", "-i", video_path, "-c", "copy", "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    info = _get_video_info(video_path)
    width, height = info["width"], info["height"]

    # Build a single zoom expression that combines all zoom keyframes.
    # Each zoom: between(t, start, end) → interpolated scale, else 1.0
    # We nest them so the last zoom takes priority if overlapping.
    zoom_expr = "1.0"

    for zoom in zooms:
        t_start = zoom.time
        t_end = zoom.time + zoom.duration
        t_mid = zoom.time + zoom.duration / 2
        scale = zoom.scale

        # Smooth ramp: scale up to midpoint, then scale back down
        # Using linear interpolation for reliability
        half_dur = zoom.duration / 2
        if half_dur > 0:
            # Ramp up: lerp from 1.0 to scale over first half
            ramp_up = f"1.0+({scale}-1.0)*(t-{t_start:.3f})/{half_dur:.3f}"
            # Ramp down: lerp from scale to 1.0 over second half
            ramp_down = f"{scale}-({scale}-1.0)*(t-{t_mid:.3f})/{half_dur:.3f}"
            # Pick ramp based on which half we're in
            smooth = f"if(lt(t,{t_mid:.3f}),{ramp_up},{ramp_down})"
        else:
            smooth = str(scale)

        zoom_expr = (
            f"if(between(t,{t_start:.3f},{t_end:.3f}),"
            f"{smooth},{zoom_expr})"
        )

    # Apply zoom: scale the video up, then crop back to original dimensions.
    # The anchor point determines where the crop centers.
    # Default anchor: (0.5, 0.4) = center-ish, slightly above for face focus.
    # For simplicity, use the first zoom's anchor for all (most videos have consistent framing).
    anchor_x = zooms[0].anchorX if zooms else 0.5
    anchor_y = zooms[0].anchorY if zooms else 0.4

    # crop x/y: center the crop on the anchor point
    crop_x = f"(iw-{width})*{anchor_x:.2f}"
    crop_y = f"(ih-{height})*{anchor_y:.2f}"

    filter_str = (
        f"scale='iw*({zoom_expr})':'ih*({zoom_expr})':flags=bilinear,"
        f"crop={width}:{height}:{crop_x}:{crop_y}"
    )

    result = subprocess.run([
        "ffmpeg", "-i", video_path,
        "-vf", filter_str,
        "-c:a", "copy",
        "-y", output_path,
    ], capture_output=True, text=True)

    if result.returncode != 0:
        logger.error(f"Zoom FFmpeg failed: {result.stderr}")
        raise RuntimeError(f"Zoom filter failed: {result.stderr[-500:]}")

    return output_path


def reframe_vertical(video_path: str, output_path: str) -> str:
    """Convert 16:9 to 9:16 by center-cropping (simple MVP approach)."""
    info = _get_video_info(video_path)
    width, height = info["width"], info["height"]

    # If already vertical or square, skip
    if width <= height:
        subprocess.run([
            "ffmpeg", "-i", video_path, "-c", "copy", "-y", output_path,
        ], check=True, capture_output=True)
        return output_path

    # Center crop to 9:16 ratio
    target_width = int(height * 9 / 16)
    crop_x = (width - target_width) // 2

    subprocess.run([
        "ffmpeg", "-i", video_path,
        "-vf", f"crop={target_width}:{height}:{crop_x}:0",
        "-c:a", "copy",
        "-y", output_path,
    ], check=True, capture_output=True)

    return output_path


def normalize_audio(video_path: str, output_path: str) -> str:
    """Normalize audio volume using loudnorm."""
    subprocess.run([
        "ffmpeg", "-i", video_path,
        "-af", "loudnorm=I=-16:LRA=11:TP=-1.5",
        "-c:v", "copy",
        "-y", output_path,
    ], check=True, capture_output=True)
    return output_path


_QUALITY_PRESETS = {
    "draft":    {"crf": 28, "scale": 720,  "preset": "fast",   "audio_bitrate": "96k"},
    "standard": {"crf": 23, "scale": 1080, "preset": "medium", "audio_bitrate": "128k"},
    "high":     {"crf": 18, "scale": 1080, "preset": "slow",   "audio_bitrate": "192k"},
}


def final_encode(
    video_path: str,
    output_path: str,
    width: int = 1080,
    height: int = 1920,
    export_settings: dict = None,
) -> str:
    """Final encode to consistent output format.

    export_settings: optional dict with 'quality' and 'format' from the editor.
    quality maps to crf/scale/preset via _QUALITY_PRESETS.
    format: 'mp4' (H.264) or 'mov' (ProRes).
    """
    quality = (export_settings or {}).get("quality", "standard")
    fmt = (export_settings or {}).get("format", "mp4")
    preset = _QUALITY_PRESETS.get(quality, _QUALITY_PRESETS["standard"])

    # Scale based on quality preset (height for vertical video)
    out_h = preset["scale"]
    # Maintain 9:16 aspect for vertical, otherwise use provided dimensions
    out_w = int(out_h * (width / height)) if width != 1080 else width
    out_h_actual = out_h if height >= width else int(out_w * (height / width))
    # For standard vertical video, use 1080x1920 or scaled equivalent
    if width == 1080 and height == 1920:
        out_w = preset["scale"]
        out_h_actual = int(out_w * 1920 / 1080)

    if fmt == "mov":
        # ProRes for MOV — high quality, larger files
        subprocess.run([
            "ffmpeg", "-i", video_path,
            "-vf", f"scale={out_w}:{out_h_actual}:force_original_aspect_ratio=decrease,pad={out_w}:{out_h_actual}:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "prores_ks", "-profile:v", "3",
            "-c:a", "pcm_s16le",
            "-movflags", "+faststart",
            "-y", output_path,
        ], check=True, capture_output=True)
    else:
        # MP4 H.264 — default
        subprocess.run([
            "ffmpeg", "-i", video_path,
            "-vf", f"scale={out_w}:{out_h_actual}:force_original_aspect_ratio=decrease,pad={out_w}:{out_h_actual}:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264", "-preset", preset["preset"], "-crf", str(preset["crf"]),
            "-c:a", "aac", "-b:a", preset["audio_bitrate"],
            "-movflags", "+faststart",
            "-y", output_path,
        ], check=True, capture_output=True)

    return output_path


def generate_thumbnail(video_path: str, output_path: str, time: float = 1.0) -> str:
    """Extract a frame as thumbnail."""
    subprocess.run([
        "ffmpeg", "-i", video_path,
        "-ss", str(time), "-vframes", "1",
        "-y", output_path,
    ], check=True, capture_output=True)
    return output_path


def _remap_words(words: List[Word], time_map: TimeMap, clip_start: float) -> List[Word]:
    """Remap word timestamps from source timeline to post-cut output timeline.

    Words are originally in the source video's timeline. After cuts are applied,
    the video is shorter. We need to adjust word timestamps to match the new timeline.
    """
    remapped = []
    for w in words:
        # Word timestamps are relative to clip_start (already offset in captions.py),
        # but we need them relative to the clip's internal timeline for the TimeMap.
        source_start = w.start
        source_end = w.end

        mapped = time_map.remap_time_range(source_start, source_end)
        if mapped is None:
            # Word is entirely inside a cut - skip it
            continue

        remapped.append(Word(
            word=w.word,
            start=round(mapped[0], 2),
            end=round(mapped[1], 2),
            confidence=w.confidence,
            speaker=w.speaker,
        ))

    return remapped


def _remap_zooms(zooms: List[ZoomConfig], time_map: TimeMap) -> List[ZoomConfig]:
    """Remap zoom timestamps from source timeline to post-cut output timeline."""
    remapped = []
    for z in zooms:
        source_start = z.time
        source_end = z.time + z.duration

        mapped = time_map.remap_time_range(source_start, source_end)
        if mapped is None:
            # Zoom is entirely inside a cut - skip it
            continue

        remapped.append(ZoomConfig(
            id=z.id,
            time=round(mapped[0], 2),
            duration=round(mapped[1] - mapped[0], 2),
            scale=z.scale,
            easing=z.easing,
            anchorX=z.anchorX,
            anchorY=z.anchorY,
            reason=z.reason,
        ))

    return remapped


def render_clip(
    video_path: str,
    edit_config: EditConfig,
    words: List[Word],
    clip_start: float,
    clip_end: float,
    tmp_dir: str,
    export_settings: dict = None,
) -> str:
    """Full rendering pipeline for one clip.

    Pipeline:
    1. Extract clip segment from source video
    2. Apply cuts (remove dead air) + build TimeMap
    3. Reframe to vertical (if needed)
    4. Apply zooms (remapped to post-cut timeline)
    5. Add captions (remapped to post-cut timeline)
    6. Normalize audio
    7. Final encode

    export_settings: optional dict with 'quality' ('draft'|'standard'|'high')
    and 'format' ('mp4'|'mov') from the editor's ExportModal.
    """

    # 1. Extract clip segment
    step1 = os.path.join(tmp_dir, "01_clip.mp4")
    extract_clip(video_path, clip_start, clip_end, step1)
    current = step1

    # Build TimeMap - prefer segments (NLE editor) over cuts (legacy)
    clip_duration = clip_end - clip_start
    if edit_config.segments:
        keep_segs = [(s.sourceStart, s.sourceEnd) for s in edit_config.segments]
        time_map = TimeMap.from_keep_segments(keep_segs)
    else:
        time_map = TimeMap.from_cuts(edit_config.cuts, clip_duration)

    # 2. Apply segments or cuts to assemble the output video
    if edit_config.segments:
        step2 = os.path.join(tmp_dir, "02_segments.mp4")
        current = apply_segments(current, edit_config.segments, step2)
    elif edit_config.cuts:
        step2 = os.path.join(tmp_dir, "02_cuts.mp4")
        current = apply_cuts(current, edit_config.cuts, step2)

    # 3. Reframe to vertical (if needed)
    if edit_config.reframing.enabled:
        step3 = os.path.join(tmp_dir, "03_reframe.mp4")
        current = reframe_vertical(current, step3)

    # 4. Apply zooms (remap to post-cut timeline)
    if edit_config.zooms:
        remapped_zooms = _remap_zooms(edit_config.zooms, time_map)
        if remapped_zooms:
            step4 = os.path.join(tmp_dir, "04_zooms.mp4")
            try:
                current = apply_zooms(current, remapped_zooms, step4)
            except Exception as e:
                logger.warning(f"Zoom step failed: {e}")
                # Continue with previous step's output

    # 5. Add captions (remap word timestamps to post-cut timeline)
    if edit_config.captions.enabled:
        # Filter words to clip range and offset to clip-relative timestamps
        clip_words = [
            Word(
                word=w.word,
                start=round(w.start - clip_start, 2),
                end=round(w.end - clip_start, 2),
                confidence=w.confidence,
                speaker=w.speaker,
            )
            for w in words
            if w.start >= clip_start and w.end <= clip_end
        ]

        # Remap to post-cut timeline
        remapped_words = _remap_words(clip_words, time_map, clip_start)

        if remapped_words:
            step5 = os.path.join(tmp_dir, "05_captions.mp4")
            try:
                # Pass clip_start=0 because words are already remapped
                current = render_captions(
                    current, remapped_words, edit_config.captions,
                    step5, clip_start=0,
                    caption_overrides=edit_config.captionOverrides,
                )
            except Exception as e:
                logger.warning(f"Captions step failed: {e}")

    # 6. Normalize audio
    if edit_config.audio.normalizeVolume:
        step6 = os.path.join(tmp_dir, "06_audio.mp4")
        try:
            current = normalize_audio(current, step6)
        except Exception as e:
            logger.warning(f"Audio normalize failed: {e}")

    # 7. Final encode
    fmt = (export_settings or {}).get("format", "mp4")
    ext = "mov" if fmt == "mov" else "mp4"
    final_path = os.path.join(tmp_dir, f"final.{ext}")
    final_encode(current, final_path, export_settings=export_settings)

    return final_path
