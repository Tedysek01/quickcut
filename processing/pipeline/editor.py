import uuid
from models.edit_config import (
    AiAnalysis, EditConfig, CutConfig, ZoomConfig, SegmentConfig,
    ReframingConfig, CaptionConfig, TransitionConfig,
    AudioConfig, OverlayConfig, SuggestedClip,
)
from models.transcript import Transcript


ZOOM_INTENSITY_MULTIPLIER = {
    "subtle": 0.7,
    "medium": 1.0,
    "aggressive": 1.3,
}

ZOOM_TYPE_DEFAULTS = {
    "emotional_peak": {"scale": 1.2, "duration": 0.8, "easing": "ease_in_out"},
    "key_insight": {"scale": 1.15, "duration": 0.5, "easing": "ease_in"},
    "humor": {"scale": 1.1, "duration": 0.3, "easing": "snap"},
    "surprise": {"scale": 1.25, "duration": 0.4, "easing": "snap"},
}

CAPTION_PRESETS = {
    "hormozi": {
        "fontSize": "large",
        "primaryColor": "#FFFFFF",
        "highlightColor": "#FFD700",
        "backgroundColor": None,
        "position": "center",
        "maxWordsPerLine": 3,
        "animation": "word_by_word",
    },
    "minimal": {
        "fontSize": "medium",
        "primaryColor": "#FFFFFF",
        "highlightColor": "#FFFFFF",
        "backgroundColor": None,
        "position": "bottom",
        "maxWordsPerLine": 6,
        "animation": "line_by_line",
    },
    "karaoke": {
        "fontSize": "large",
        "primaryColor": "#FFFFFF",
        "highlightColor": "#FF4444",
        "backgroundColor": None,
        "position": "center",
        "maxWordsPerLine": 4,
        "animation": "word_by_word",
    },
    "bold": {
        "fontSize": "large",
        "primaryColor": "#FFFFFF",
        "highlightColor": "#00FF88",
        "backgroundColor": "#00000080",
        "position": "center",
        "maxWordsPerLine": 2,
        "animation": "word_by_word",
    },
}


def generate_edit_config(
    suggestion: SuggestedClip,
    analysis: AiAnalysis,
    transcript: Transcript,
    preferences: dict,
) -> EditConfig:
    """Generate a complete edit config from AI analysis and user preferences."""

    clip_start = suggestion.start
    clip_end = suggestion.end

    # 1. Build cuts from dead moments within clip range
    cuts = []
    for dm in analysis.deadMoments:
        if dm.start >= clip_start and dm.end <= clip_end:
            cuts.append(CutConfig(
                id=str(uuid.uuid4())[:8],
                start=round(dm.start - clip_start, 2),
                end=round(dm.end - clip_start, 2),
                reason=dm.reason,
            ))

    # 2. Build zooms from key moments within clip range
    zoom_intensity = preferences.get("zoomIntensity", "medium")
    multiplier = ZOOM_INTENSITY_MULTIPLIER.get(zoom_intensity, 1.0)

    zooms = []
    for km in analysis.keyMoments:
        if clip_start <= km.time <= clip_end:
            defaults = ZOOM_TYPE_DEFAULTS.get(km.type, ZOOM_TYPE_DEFAULTS["key_insight"])
            base_scale = km.suggestedZoomScale or defaults["scale"]
            # Apply intensity multiplier: scale the zoom amount (not the base 1.0)
            adjusted_scale = 1.0 + (base_scale - 1.0) * multiplier

            zooms.append(ZoomConfig(
                id=str(uuid.uuid4())[:8],
                time=round(km.time - clip_start, 2),
                duration=defaults["duration"],
                scale=round(adjusted_scale, 2),
                easing=defaults["easing"],
                anchorX=0.5,
                anchorY=0.4,  # Slightly above center for face focus
                reason=km.description,
            ))

    # 3. Caption config from preferences
    caption_style = preferences.get("defaultCaptionStyle", "hormozi")
    preset = CAPTION_PRESETS.get(caption_style, CAPTION_PRESETS["hormozi"])

    captions = CaptionConfig(
        enabled=True,
        style=caption_style,
        font=preferences.get("captionFont", "Inter"),
        highlightKeywords=True,
        customKeywords=[],
        **preset,
    )

    # Override with user color preferences if set
    if preferences.get("captionColor"):
        captions.primaryColor = preferences["captionColor"]

    # 4. Reframing
    reframing = ReframingConfig(enabled=True, mode="face_track")

    # 5. Transitions (legacy — per-segment transitions are now the primary system)
    transitions = TransitionConfig()

    # 6. Audio
    audio = AudioConfig(normalizeVolume=True)

    # 7. Overlays
    overlays = OverlayConfig()

    # 8. Build segments (inverse of cuts) for NLE editor compatibility
    clip_duration = round(clip_end - clip_start, 2)
    sorted_cuts = sorted(cuts, key=lambda c: c.start)
    segments = []
    current_pos = 0.0
    for cut in sorted_cuts:
        if cut.start > current_pos:
            segments.append(SegmentConfig(
                id=str(uuid.uuid4())[:8],
                sourceStart=round(current_pos, 2),
                sourceEnd=round(cut.start, 2),
                transition="none" if not segments else "hard",
            ))
        current_pos = max(current_pos, cut.end)
    if current_pos < clip_duration:
        segments.append(SegmentConfig(
            id=str(uuid.uuid4())[:8],
            sourceStart=round(current_pos, 2),
            sourceEnd=clip_duration,
            transition="none" if not segments else "hard",
        ))

    return EditConfig(
        outputRatio="9:16",
        segments=segments,
        cuts=cuts,
        zooms=zooms,
        reframing=reframing,
        captions=captions,
        transitions=transitions,
        audio=audio,
        overlays=overlays,
        captionOverrides={},
        annotations=[],
    )
