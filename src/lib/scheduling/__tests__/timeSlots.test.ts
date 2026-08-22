import { allocateFromSegments, MIN_SESSION_MINUTES, type TimeSegment } from '../timeSlots';

const MIN = 60_000;

describe('allocateFromSegments: minimum session length', () => {
  it('skips a too-small non-final fragment in favor of a larger contiguous piece later', () => {
    // Reproduces the exact bug seen live: a 15-minute leftover slot before a
    // much larger block, for a task that needs far more than 15 minutes.
    const segments: TimeSegment[] = [
      { start: 0, end: 15 * MIN }, // 15 min — too small, and would leave more of the task unscheduled
      { start: 60 * MIN, end: 240 * MIN }, // 180 min — plenty of room
    ];

    const result = allocateFromSegments(segments, 180 * MIN, 0, Infinity);

    expect(result).not.toBeNull();
    expect(result!.pieces).toHaveLength(1);
    expect(result!.pieces[0]).toEqual({ start: 60 * MIN, end: 240 * MIN });
    // The 15-minute segment was never touched — it's untouched in what's left over.
    expect(result!.remainingSegments).toContainEqual({ start: 0, end: 15 * MIN });
  });

  it('does not enforce a minimum for a task whose entire requirement is naturally short', () => {
    const segments: TimeSegment[] = [{ start: 0, end: 15 * MIN }];

    const result = allocateFromSegments(segments, 15 * MIN, 0, Infinity);

    expect(result).not.toBeNull();
    expect(result!.pieces).toEqual([{ start: 0, end: 15 * MIN }]);
  });

  it('defers to overflow rather than fragmenting into several sub-minimum pieces, even when they would sum to exactly enough time', () => {
    const belowMinimum = (MIN_SESSION_MINUTES - 10) * MIN; // e.g. 10 min if MIN_SESSION_MINUTES is 20
    const segments: TimeSegment[] = [
      { start: 0, end: belowMinimum },
      { start: 100 * MIN, end: 100 * MIN + belowMinimum },
      { start: 200 * MIN, end: 200 * MIN + belowMinimum },
    ];
    const totalAvailable = belowMinimum * 3;

    const result = allocateFromSegments(segments, totalAvailable, 0, Infinity);

    expect(result).toBeNull();
  });

  it('still accepts a piece exactly at the minimum threshold', () => {
    const segments: TimeSegment[] = [
      { start: 0, end: MIN_SESSION_MINUTES * MIN }, // exactly the minimum, more of the task remains
      { start: 100 * MIN, end: 200 * MIN },
    ];

    const result = allocateFromSegments(segments, MIN_SESSION_MINUTES * MIN + 30 * MIN, 0, Infinity);

    expect(result).not.toBeNull();
    expect(result!.pieces[0]).toEqual({ start: 0, end: MIN_SESSION_MINUTES * MIN });
  });
});
