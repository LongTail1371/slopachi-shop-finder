import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { parseListing, inferVisitDate, AREAS } from '../src/listing';

describe('parseListing', () => {
  const { entries, nextUrl } = parseListing(fixture('listing-kita-kanto-p1.html'));

  it('リンクがあり (予定) でない行だけを取る（40 行中 リンク 17、(予定) 付きリンク 2 → 15 件）', () => {
    expect(entries).toHaveLength(15);
  });
  it('先頭エントリの内容', () => {
    expect(entries[0]).toEqual({
      url: expect.stringMatching(/^https:\/\/777\.slopachi-station\.com\/.+sao2\/$/),
      month: 9,
      day: 13,
      coverageType: 'スロぱちガール来店PS',
      storeName: 'ピーアーク草加',
      prefectureCity: '埼玉県草加市',
    });
  });
  it('(予定) 行を含まない', () => {
    expect(entries.some((e) => e.coverageType.includes('予定'))).toBe(false);
  });
  it('次ページ URL', () => {
    expect(nextUrl).toBe('https://777.slopachi-station.com/report/kita-kanto/page/2');
  });
  it('最終ページでは nextUrl が null', () => {
    expect(parseListing('<html><body><section id="archiveReporList"></section></body></html>').nextUrl).toBeNull();
  });
});

describe('inferVisitDate', () => {
  it('今日以前ならその年', () => {
    expect(inferVisitDate(9, 13, new Date('2026-09-15'))).toBe('2026-09-13');
  });
  it('未来になる月日は前年', () => {
    expect(inferVisitDate(12, 20, new Date('2026-09-15'))).toBe('2025-12-20');
  });
  it('当日は今年', () => {
    expect(inferVisitDate(9, 15, new Date('2026-09-15'))).toBe('2026-09-15');
  });
});

describe('AREAS', () => {
  it('3 エリア', () => {
    expect(AREAS.map((a) => a.url)).toEqual([
      'https://777.slopachi-station.com/report_pref/tokyo/',
      'https://777.slopachi-station.com/report/minami-kanto/',
      'https://777.slopachi-station.com/report/kita-kanto/',
    ]);
  });
});
