import * as cheerio from 'cheerio';
import { cleanText } from './text';

export interface ListingEntry {
  url: string;
  month: number;
  day: number;
  coverageType: string;
  storeName: string;
  prefectureCity: string;
}

export const AREAS = [
  { name: '東京', url: 'https://777.slopachi-station.com/report_pref/tokyo/' },
  { name: '南関東', url: 'https://777.slopachi-station.com/report/minami-kanto/' },
  { name: '北関東', url: 'https://777.slopachi-station.com/report/kita-kanto/' },
] as const;

export function parseListing(html: string): { entries: ListingEntry[]; nextUrl: string | null } {
  const $ = cheerio.load(html);
  const entries: ListingEntry[] = [];

  $('#archiveReporList .resultRow-detail').each((_, el) => {
    const detail = $(el);
    const a = detail.find('a[href]').first();
    if (a.length === 0) return;

    const whole = cleanText(detail.text());
    const dateM = whole.match(/(\d{1,2})\/(\d{1,2})/);
    const placeM = whole.match(/【([^】]+)】/);
    const linkText = cleanText(a.text());
    if (!dateM || !placeM || linkText.includes('(予定)') || linkText.includes('（予定）')) return;

    // 'スロぱちガール来店PS ピーアーク草加' → 種別は元 HTML で &nbsp;&nbsp; 区切り。cleanText 後は最後の空白で分ける
    const rawLink = (a.html() ?? '').replace(/<svg[\s\S]*?<\/svg>/g, '');
    const parts = rawLink
      .split(/(?:&nbsp;|\u00A0)+/)
      .map((s) => cleanText(s.replace(/<[^>]+>/g, '')))
      .filter((s) => s.length > 0);
    const coverageType = parts[0] ?? linkText;
    const storeName = parts.slice(1).join(' ') || '';

    entries.push({
      url: a.attr('href')!,
      month: Number(dateM[1]),
      day: Number(dateM[2]),
      coverageType,
      storeName,
      prefectureCity: placeM[1]!,
    });
  });

  const nextUrl = $('.pagingBox a.next').first().attr('href') ?? null;
  return { entries, nextUrl };
}

export function inferVisitDate(month: number, day: number, today: Date): string {
  const y = today.getFullYear();
  const candidate = new Date(y, month - 1, day);
  const todayMidnight = new Date(y, today.getMonth(), today.getDate());
  const year = candidate > todayMidnight ? y - 1 : y;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
