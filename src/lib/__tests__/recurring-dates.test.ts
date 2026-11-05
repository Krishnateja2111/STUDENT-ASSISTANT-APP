import { enumerateRecurringDates } from '../recurring-dates';

describe('enumerateRecurringDates', () => {
  it('includes both the start and end date when they match a selected weekday', () => {
    // 2026-09-18 is a Friday, 2026-09-20 is a Sunday.
    const dates = enumerateRecurringDates('2026-09-18', '2026-09-20', [5, 0]); // Fri, Sun
    expect(dates).toEqual(['2026-09-18', '2026-09-20']);
  });

  it('returns every day in range for all seven weekdays selected', () => {
    const dates = enumerateRecurringDates('2026-09-18', '2026-09-21', [0, 1, 2, 3, 4, 5, 6]);
    expect(dates).toEqual(['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21']);
  });

  it('filters to weekdays only (Mon-Fri), skipping weekends', () => {
    // 2026-09-18 Fri, 19 Sat, 20 Sun, 21 Mon
    const dates = enumerateRecurringDates('2026-09-18', '2026-09-21', [1, 2, 3, 4, 5]);
    expect(dates).toEqual(['2026-09-18', '2026-09-21']);
  });

  it('returns an empty array for an inverted range', () => {
    expect(enumerateRecurringDates('2026-09-20', '2026-09-18', [0, 1, 2, 3, 4, 5, 6])).toEqual([]);
  });

  it('returns an empty array when no weekdays are selected', () => {
    expect(enumerateRecurringDates('2026-09-18', '2026-09-25', [])).toEqual([]);
  });

  it('returns an empty array for a malformed date', () => {
    expect(enumerateRecurringDates('not-a-date', '2026-09-25', [0, 1, 2, 3, 4, 5, 6])).toEqual([]);
  });

  it('handles a same-day range', () => {
    // 2026-09-18 is a Friday.
    expect(enumerateRecurringDates('2026-09-18', '2026-09-18', [5])).toEqual(['2026-09-18']);
    expect(enumerateRecurringDates('2026-09-18', '2026-09-18', [1])).toEqual([]);
  });
});
