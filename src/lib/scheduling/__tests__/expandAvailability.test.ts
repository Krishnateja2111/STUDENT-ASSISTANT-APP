import { expandAvailability } from '../expandAvailability';
import type { AvailabilityRule, FixedCommitment, TemporaryUnavailablePeriod } from '../availabilityRules';
import type { AvailabilityBlock } from '../types';

// 2026-08-24 is a Monday; 2026-09-21 is exactly 4 weeks later (also a
// Monday) — a horizon this length always contains exactly 4 instances of
// every weekday, regardless of which weekday it starts on, so tests don't
// need to hand-derive day-of-week alignment beyond this one fixed anchor.
const HORIZON_START = '2026-08-24T00:00:00';
const HORIZON_END_4WK = '2026-09-21T00:00:00'; // exclusive
const MONDAY = 1;
const WEDNESDAY = 3;
const FRIDAY = 5;

function rule(overrides: Partial<AvailabilityRule> & Pick<AvailabilityRule, 'id' | 'weekday'>): AvailabilityRule {
  return { startTime: '09:00', endTime: '17:00', ...overrides };
}

function block(id: string, start: string, end: string, label?: string): AvailabilityBlock {
  return label ? { id, start, end, label } : { id, start, end };
}

describe('expandAvailability', () => {
  test('A. basic recurring expansion — one Monday rule expands to each Monday in the horizon', () => {
    const rules = [rule({ id: 'r1', weekday: MONDAY, startTime: '09:00', endTime: '11:00' })];
    const result = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);

    expect(result).toHaveLength(4);
    expect(result.map((b) => b.start)).toEqual([
      '2026-08-24T09:00:00',
      '2026-08-31T09:00:00',
      '2026-09-07T09:00:00',
      '2026-09-14T09:00:00',
    ]);
    expect(result.every((b) => b.end.endsWith('T11:00:00'))).toBe(true);
  });

  test('B. multiple weekdays — Monday + Wednesday + Friday all expand correctly', () => {
    const rules = [
      rule({ id: 'mon', weekday: MONDAY, startTime: '09:00', endTime: '10:00' }),
      rule({ id: 'wed', weekday: WEDNESDAY, startTime: '14:00', endTime: '15:00' }),
      rule({ id: 'fri', weekday: FRIDAY, startTime: '16:00', endTime: '17:00' }),
    ];
    const result = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);

    expect(result).toHaveLength(12); // 4 of each
    const mondays = result.filter((b) => b.start.endsWith('T09:00:00'));
    const wednesdays = result.filter((b) => b.start.endsWith('T14:00:00'));
    const fridays = result.filter((b) => b.start.endsWith('T16:00:00'));
    expect(mondays).toHaveLength(4);
    expect(wednesdays).toHaveLength(4);
    expect(fridays).toHaveLength(4);
  });

  test('C. one-time availability — a concrete AvailabilityBlock appears unchanged (same id, same range)', () => {
    const oneTime = [block('extra-1', '2026-08-25T10:00:00', '2026-08-25T12:00:00', 'Study session')];
    const result = expandAvailability([], oneTime, [], [], HORIZON_START, HORIZON_END_4WK);

    expect(result).toEqual([{ id: 'extra-1', start: '2026-08-25T10:00:00', end: '2026-08-25T12:00:00', label: 'Study session' }]);
  });

  test('D. recurring commitment subtraction removes time from recurring availability', () => {
    const rules = [rule({ id: 'r1', weekday: MONDAY, startTime: '09:00', endTime: '17:00' })];
    const commitments: FixedCommitment[] = [
      { id: 'c1', kind: 'recurring', weekday: MONDAY, startTime: '12:00', endTime: '13:00' },
    ];
    const result = expandAvailability(rules, [], commitments, [], HORIZON_START, HORIZON_END_4WK);

    // Every Monday split into 09-12 and 13-17.
    expect(result).toHaveLength(8);
    const firstMonday = result.filter((b) => b.start.startsWith('2026-08-24'));
    expect(firstMonday).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ start: '2026-08-24T09:00:00', end: '2026-08-24T12:00:00' }),
        expect.objectContaining({ start: '2026-08-24T13:00:00', end: '2026-08-24T17:00:00' }),
      ])
    );
  });

  test('E. temporary unavailable subtraction removes the appropriate range', () => {
    const oneTime = [block('b1', '2026-08-25T09:00:00', '2026-08-25T17:00:00')];
    const unavailable: TemporaryUnavailablePeriod[] = [
      { id: 'u1', start: '2026-08-25T12:00:00', end: '2026-08-25T13:00:00' },
    ];
    const result = expandAvailability([], oneTime, [], unavailable, HORIZON_START, HORIZON_END_4WK);

    expect(result).toEqual([
      { id: expect.any(String), start: '2026-08-25T09:00:00', end: '2026-08-25T12:00:00' },
      { id: expect.any(String), start: '2026-08-25T13:00:00', end: '2026-08-25T17:00:00' },
    ]);
  });

  test('F. overlapping availability produces union behavior, no duplicate segments', () => {
    const oneTime = [
      block('a', '2026-08-25T09:00:00', '2026-08-25T13:00:00'),
      block('b', '2026-08-25T12:00:00', '2026-08-25T17:00:00'),
    ];
    const result = expandAvailability([], oneTime, [], [], HORIZON_START, HORIZON_END_4WK);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ start: '2026-08-25T09:00:00', end: '2026-08-25T17:00:00' });
  });

  test('G. overlapping unavailable periods behave like their union', () => {
    const oneTime = [block('b1', '2026-08-25T09:00:00', '2026-08-25T17:00:00')];
    const unavailable: TemporaryUnavailablePeriod[] = [
      { id: 'u1', start: '2026-08-25T11:00:00', end: '2026-08-25T13:00:00' },
      { id: 'u2', start: '2026-08-25T12:00:00', end: '2026-08-25T14:00:00' },
    ];
    const result = expandAvailability([], oneTime, [], unavailable, HORIZON_START, HORIZON_END_4WK);

    // Union of 11-13 and 12-14 is 11-14 -> remaining is 09-11 and 14-17.
    expect(result).toEqual([
      { id: expect.any(String), start: '2026-08-25T09:00:00', end: '2026-08-25T11:00:00' },
      { id: expect.any(String), start: '2026-08-25T14:00:00', end: '2026-08-25T17:00:00' },
    ]);
  });

  test('H. commitment outside availability has no effect', () => {
    const oneTime = [block('b1', '2026-08-25T09:00:00', '2026-08-25T11:00:00')];
    const commitments: FixedCommitment[] = [
      { id: 'c1', kind: 'one-time', date: '2026-08-25', startTime: '14:00', endTime: '15:00' },
    ];
    const result = expandAvailability([], oneTime, commitments, [], HORIZON_START, HORIZON_END_4WK);

    expect(result).toEqual([{ id: 'b1', start: '2026-08-25T09:00:00', end: '2026-08-25T11:00:00' }]);
  });

  test('I. adjacent boundaries remain separate segments (touching, not overlapping)', () => {
    const oneTime = [
      block('a', '2026-08-25T09:00:00', '2026-08-25T12:00:00'),
      block('b', '2026-08-25T12:00:00', '2026-08-25T15:00:00'),
    ];
    const result = expandAvailability([], oneTime, [], [], HORIZON_START, HORIZON_END_4WK);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ start: '2026-08-25T09:00:00', end: '2026-08-25T12:00:00' });
    expect(result[1]).toMatchObject({ start: '2026-08-25T12:00:00', end: '2026-08-25T15:00:00' });
  });

  test('J. multi-week expansion — rules expand correctly across multiple weeks', () => {
    const rules = [rule({ id: 'r1', weekday: FRIDAY, startTime: '16:00', endTime: '17:00' })];
    const result = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);
    expect(result.map((b) => b.start.slice(0, 10))).toEqual(['2026-08-28', '2026-09-04', '2026-09-11', '2026-09-18']);
  });

  test('K. horizon boundary — no instances generated outside [horizonStart, horizonEnd)', () => {
    const rules = [rule({ id: 'r1', weekday: MONDAY, startTime: '09:00', endTime: '10:00' })];
    // A 1-week horizon should produce exactly the first Monday, nothing beyond it.
    const result = expandAvailability(rules, [], [], [], HORIZON_START, '2026-08-31T00:00:00');
    expect(result).toHaveLength(1);
    expect(result[0].start).toBe('2026-08-24T09:00:00');

    // Nothing before horizonStart either: a rule instance that would fall
    // exactly ON horizonEnd (exclusive) must not appear.
    const resultExact = expandAvailability(rules, [], [], [], HORIZON_START, '2026-08-24T09:00:00');
    expect(resultExact).toHaveLength(0);
  });

  test('L. availability blocked completely — an unavailable period covering the whole block leaves nothing', () => {
    const oneTime = [block('b1', '2026-08-25T09:00:00', '2026-08-25T17:00:00')];
    const unavailable: TemporaryUnavailablePeriod[] = [
      { id: 'u1', start: '2026-08-25T08:00:00', end: '2026-08-25T18:00:00' },
    ];
    const result = expandAvailability([], oneTime, [], unavailable, HORIZON_START, HORIZON_END_4WK);
    expect(result).toEqual([]);
  });

  test('M. multiple subtraction splits — one block split into three or more pieces', () => {
    const oneTime = [block('b1', '2026-08-25T09:00:00', '2026-08-25T17:00:00')];
    const unavailable: TemporaryUnavailablePeriod[] = [
      { id: 'u1', start: '2026-08-25T11:00:00', end: '2026-08-25T12:00:00' },
      { id: 'u2', start: '2026-08-25T14:00:00', end: '2026-08-25T15:00:00' },
    ];
    const result = expandAvailability([], oneTime, [], unavailable, HORIZON_START, HORIZON_END_4WK);
    expect(result).toEqual([
      { id: expect.any(String), start: '2026-08-25T09:00:00', end: '2026-08-25T11:00:00' },
      { id: expect.any(String), start: '2026-08-25T12:00:00', end: '2026-08-25T14:00:00' },
      { id: expect.any(String), start: '2026-08-25T15:00:00', end: '2026-08-25T17:00:00' },
    ]);
  });

  test('N. overnight availability is rejected — 22:00-02:00 produces no block', () => {
    const rules = [rule({ id: 'r1', weekday: MONDAY, startTime: '22:00', endTime: '02:00' })];
    const result = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);
    expect(result).toEqual([]);
  });

  test('O. zero-length range is rejected — 09:00-09:00 produces no block', () => {
    const rules = [rule({ id: 'r1', weekday: MONDAY, startTime: '09:00', endTime: '09:00' })];
    const result = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);
    expect(result).toEqual([]);
  });

  test('P. invalid weekday is rejected — 7 and -1 produce no block', () => {
    const rules = [
      rule({ id: 'r1', weekday: 7, startTime: '09:00', endTime: '10:00' }),
      rule({ id: 'r2', weekday: -1, startTime: '09:00', endTime: '10:00' }),
    ];
    const result = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);
    expect(result).toEqual([]);
  });

  test('Q. invalid time strings are rejected', () => {
    const rules = [
      rule({ id: 'r1', weekday: MONDAY, startTime: '9:00', endTime: '10:00' }), // not two-digit hour
      rule({ id: 'r2', weekday: MONDAY, startTime: '25:00', endTime: '26:00' }), // out of range
      rule({ id: 'r3', weekday: MONDAY, startTime: 'nope', endTime: '10:00' }),
    ];
    const result = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);
    expect(result).toEqual([]);
  });

  test('R. one-time commitment subtracts exactly the requested date/time', () => {
    const oneTime = [block('b1', '2026-08-25T09:00:00', '2026-08-25T17:00:00')];
    const commitments: FixedCommitment[] = [
      { id: 'c1', kind: 'one-time', date: '2026-08-25', startTime: '13:00', endTime: '14:00' },
    ];
    const result = expandAvailability([], oneTime, commitments, [], HORIZON_START, HORIZON_END_4WK);
    expect(result).toEqual([
      { id: expect.any(String), start: '2026-08-25T09:00:00', end: '2026-08-25T13:00:00' },
      { id: expect.any(String), start: '2026-08-25T14:00:00', end: '2026-08-25T17:00:00' },
    ]);
  });

  test('S. multi-day temporary unavailable period removes availability across every affected date', () => {
    const rules = [rule({ id: 'r1', weekday: MONDAY, startTime: '09:00', endTime: '11:00' })];
    // Covers 2026-08-24 (first Monday) through 2026-08-31 (second Monday) inclusive.
    const unavailable: TemporaryUnavailablePeriod[] = [
      { id: 'vacation', start: '2026-08-24T00:00:00', end: '2026-09-01T00:00:00' },
    ];
    const result = expandAvailability(rules, [], [], unavailable, HORIZON_START, HORIZON_END_4WK);
    // Only the 3rd and 4th Mondays should survive.
    expect(result.map((b) => b.start.slice(0, 10))).toEqual(['2026-09-07', '2026-09-14']);
  });

  test('T. deterministic IDs — repeated expansion of identical inputs produces identical IDs', () => {
    const rules = [rule({ id: 'r1', weekday: MONDAY, startTime: '09:00', endTime: '11:00' })];
    const result1 = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);
    const result2 = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);
    expect(result1.map((b) => b.id)).toEqual(result2.map((b) => b.id));
    expect(result1[0].id).toBe('rule-r1-2026-08-24');
  });

  test('U. deterministic ordering — repeated expansion produces identical ordering', () => {
    const rules = [
      rule({ id: 'fri', weekday: FRIDAY, startTime: '16:00', endTime: '17:00' }),
      rule({ id: 'mon', weekday: MONDAY, startTime: '09:00', endTime: '10:00' }),
    ];
    const result1 = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);
    const result2 = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);
    expect(result1).toEqual(result2);
    // Sorted by start ascending regardless of input rule order.
    const starts = result1.map((b) => b.start);
    expect(starts).toEqual([...starts].sort());
  });

  test('V. recurring availability labels survive into generated blocks', () => {
    const rules = [rule({ id: 'r1', weekday: MONDAY, startTime: '09:00', endTime: '10:00', label: 'Morning study' })];
    const result = expandAvailability(rules, [], [], [], HORIZON_START, HORIZON_END_4WK);
    expect(result.every((b) => b.label === 'Morning study')).toBe(true);
  });

  test('malformed source entries are safely ignored, never throw', () => {
    const rules = [rule({ id: 'r1', weekday: MONDAY, startTime: '09:00', endTime: '10:00' })];
    const commitments: FixedCommitment[] = [
      { id: 'bad', kind: 'recurring', weekday: 9, startTime: '99:99', endTime: '10:00' },
    ];
    expect(() => expandAvailability(rules, [], commitments, [], HORIZON_START, HORIZON_END_4WK)).not.toThrow();
    const result = expandAvailability(rules, [], commitments, [], HORIZON_START, HORIZON_END_4WK);
    expect(result).toHaveLength(4); // the valid Monday rule still expands normally
  });
});
