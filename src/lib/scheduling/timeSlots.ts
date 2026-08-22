import type { AvailabilityBlock } from './types';

export interface TimeSegment {
  start: number; // ms epoch
  end: number; // ms epoch
}

/** Converts availability blocks to sorted, non-empty ms-epoch segments. */
export function toSegments(blocks: AvailabilityBlock[]): TimeSegment[] {
  return blocks
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
}

export interface AllocationPiece {
  start: number;
  end: number;
}

export interface AllocationResult {
  pieces: AllocationPiece[];
  /** Segments left over after removing the allocated pieces, sorted by start. */
  remainingSegments: TimeSegment[];
}

/**
 * Greedily accumulates `durationMs` from `segments`, earliest time first,
 * only using time within [earliestStart, latestEnd]. Returns null if the
 * full duration can't be accumulated inside that window — never partially
 * allocates. Pure: does not mutate `segments`.
 */
export function allocateFromSegments(
  segments: TimeSegment[],
  durationMs: number,
  earliestStart: number,
  latestEnd: number
): AllocationResult | null {
  let remainingMs = durationMs;
  const pieces: AllocationPiece[] = [];
  const nextSegments: TimeSegment[] = [];

  for (const seg of segments) {
    if (remainingMs <= 0) {
      nextSegments.push(seg);
      continue;
    }

    const usableStart = Math.max(seg.start, earliestStart);
    const usableEnd = Math.min(seg.end, latestEnd);
    if (usableStart >= usableEnd) {
      nextSegments.push(seg);
      continue;
    }

    const takeMs = Math.min(usableEnd - usableStart, remainingMs);
    const pieceStart = usableStart;
    const pieceEnd = usableStart + takeMs;
    pieces.push({ start: pieceStart, end: pieceEnd });
    remainingMs -= takeMs;

    if (seg.start < pieceStart) nextSegments.push({ start: seg.start, end: pieceStart });
    if (pieceEnd < seg.end) nextSegments.push({ start: pieceEnd, end: seg.end });
  }

  if (remainingMs > 0) return null;

  nextSegments.sort((a, b) => a.start - b.start);
  return { pieces, remainingSegments: nextSegments };
}

/** Total free ms across all segments — used by getScheduleHealth's ratio check. */
export function totalSegmentMs(segments: TimeSegment[]): number {
  return segments.reduce((sum, s) => sum + (s.end - s.start), 0);
}
