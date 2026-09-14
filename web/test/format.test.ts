import { describe, it, expect } from 'vitest';
import { formatDiff, formatRate, formatShortDate, formatDate } from '../src/lib/format';

describe('format', () => {
  it('差玉・差枚', () => {
    expect(formatDiff(4620, 'pachinko')).toBe('+4,620玉');
    expect(formatDiff(-300, 'slot')).toBe('-300枚');
    expect(formatDiff(0, 'pachinko')).toBe('±0玉');
    expect(formatDiff(null, 'pachinko')).toBe('—');
  });
  it('率と日付', () => {
    expect(formatRate(0.667)).toBe('67%');
    expect(formatShortDate('2026-09-13')).toBe('9/13');
    expect(formatDate('2026-09-13')).toBe('2026年9月13日');
  });
});
