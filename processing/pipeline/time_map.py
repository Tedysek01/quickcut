"""
TimeMap: Bidirectional mapping between source video timeline and output timeline.

When cuts remove segments from a video, the output timeline is shorter than the source.
This module handles converting timestamps between the two timelines.

Example:
    Source:  |---A---|##CUT##|---B---|##CUT##|---C---|
             0       5       7       12      14      30

    Output:  |---A---|---B---|---C---|
             0       5       10      26

    TimeMap allows:
    - output_to_source(6.0) → 8.0  (6s in output = 8s in source, inside segment B)
    - source_to_output(8.0) → 6.0  (8s in source = 6s in output)
    - source_to_output(6.0) → None (6s is inside a cut, not in output)
"""
from typing import List, Optional, Tuple
from models.edit_config import CutConfig, SegmentConfig


class Segment:
    """A keep-segment in the source video."""
    __slots__ = ("source_start", "source_end", "output_start")

    def __init__(self, source_start: float, source_end: float, output_start: float):
        self.source_start = source_start
        self.source_end = source_end
        self.output_start = output_start

    @property
    def duration(self) -> float:
        return self.source_end - self.source_start

    @property
    def output_end(self) -> float:
        return self.output_start + self.duration


class TimeMap:
    """Bidirectional time mapping between source and output timelines."""

    def __init__(self, segments: List[Segment]):
        self.segments = segments

    @classmethod
    def from_cuts(cls, cuts: List[CutConfig], source_duration: float) -> "TimeMap":
        """Build a TimeMap from a list of cuts and the source video duration.

        Cuts define segments to REMOVE. We compute the inverse (segments to KEEP).
        """
        if not cuts:
            # No cuts = entire video is one segment
            return cls([Segment(0.0, source_duration, 0.0)])

        # Sort cuts by start time
        sorted_cuts = sorted(cuts, key=lambda c: c.start)

        # Compute keep segments (inverse of cuts)
        keep_segments: List[Segment] = []
        current = 0.0
        output_offset = 0.0

        for cut in sorted_cuts:
            if cut.start > current:
                seg = Segment(current, cut.start, output_offset)
                keep_segments.append(seg)
                output_offset += seg.duration
            current = max(current, cut.end)

        if current < source_duration:
            seg = Segment(current, source_duration, output_offset)
            keep_segments.append(seg)

        return cls(keep_segments)

    @classmethod
    def from_segment_configs(cls, segments: List[SegmentConfig]) -> "TimeMap":
        """Build a TimeMap from SegmentConfig objects (as used by the NLE editor)."""
        tuples = [(s.sourceStart, s.sourceEnd) for s in segments]
        return cls.from_keep_segments(tuples)

    @classmethod
    def from_keep_segments(
        cls,
        segments: List[Tuple[float, float]],
    ) -> "TimeMap":
        """Build a TimeMap from explicit keep segments [(source_start, source_end), ...]."""
        result = []
        output_offset = 0.0
        for source_start, source_end in segments:
            seg = Segment(source_start, source_end, output_offset)
            result.append(seg)
            output_offset += seg.duration
        return cls(result)

    @property
    def total_duration(self) -> float:
        """Total output duration after cuts."""
        if not self.segments:
            return 0.0
        last = self.segments[-1]
        return last.output_end

    def output_to_source(self, output_time: float) -> float:
        """Convert output time to source time.

        Returns the corresponding source time for a given position in the output.
        Clamps to valid range.
        """
        if not self.segments:
            return 0.0

        for seg in self.segments:
            if output_time <= seg.output_end:
                offset = output_time - seg.output_start
                return seg.source_start + max(0.0, offset)

        # Past the end - return end of last segment
        last = self.segments[-1]
        return last.source_end

    def source_to_output(self, source_time: float) -> Optional[float]:
        """Convert source time to output time.

        Returns None if the source time falls inside a cut (not in any segment).
        """
        for seg in self.segments:
            if seg.source_start <= source_time <= seg.source_end:
                offset = source_time - seg.source_start
                return seg.output_start + offset

        # Source time is in a cut region - find nearest segment
        return None

    def source_to_output_clamped(self, source_time: float) -> float:
        """Convert source time to output time, clamping to nearest segment edge if in a cut."""
        result = self.source_to_output(source_time)
        if result is not None:
            return result

        # Find the nearest segment boundary
        for i, seg in enumerate(self.segments):
            if source_time < seg.source_start:
                # Before this segment - clamp to its start
                return seg.output_start
            if source_time > seg.source_end and i + 1 < len(self.segments):
                next_seg = self.segments[i + 1]
                if source_time < next_seg.source_start:
                    # Between two segments (in a cut) - clamp to end of current
                    return seg.output_end

        # Past everything
        if self.segments:
            return self.segments[-1].output_end
        return 0.0

    def remap_time_range(
        self, source_start: float, source_end: float
    ) -> Optional[Tuple[float, float]]:
        """Remap a source time range to output time range.

        Returns None if the range is entirely within a cut.
        If partially overlapping, returns the overlapping portion.
        """
        out_start = self.source_to_output_clamped(source_start)
        out_end = self.source_to_output_clamped(source_end)

        if out_start >= out_end:
            return None

        return (out_start, out_end)

    def get_keep_segments(self) -> List[Tuple[float, float]]:
        """Return keep segments as (source_start, source_end) tuples."""
        return [(seg.source_start, seg.source_end) for seg in self.segments]
