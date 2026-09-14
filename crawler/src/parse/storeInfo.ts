import * as cheerio from 'cheerio';
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import type { StoreInfo } from '../../../shared/types';
import { cleanText } from '../text';

const PREF_RE = /^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)\s*(.*)$/;
const HEADING_PREF_RE = /[（(]\s*([^（）()]*?(?:都|道|府|県))\s*[)）]\s*$/;

function prefectureFromHeading(body: Cheerio<Element>): string | null {
  const h2 = cleanText(body.find('h2').first().text());
  return h2.match(HEADING_PREF_RE)?.[1] ?? null;
}

export function parseStoreInfo(body: Cheerio<Element>): { store: StoreInfo; visitDate: string } | null {
  const td = body.find('td').filter((_, el) => {
    const t = cleanText(body.find(el).text());
    return t.includes('店舗') && t.includes('訪問日');
  }).first();
  if (td.length === 0) return null;

  const fields = new Map<string, string>();
  for (const raw of (td.html() ?? '').split(/<br\s*\/?>/i)) {
    // Use cheerio to properly decode HTML entities like &nbsp;
    const wrapper = cheerio.load('<div>' + raw + '</div>');
    const line = cleanText(wrapper('div').text());
    const m = line.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (m) fields.set(m[1]!.trim(), m[2]!.trim());
  }

  const name = fields.get('店舗');
  const dateRaw = fields.get('訪問日');
  const area = fields.get('地域');
  if (!name || !dateRaw) return null;

  const d = dateRaw.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!d) return null;
  const visitDate = `${d[1]}-${d[2]!.padStart(2, '0')}-${d[3]!.padStart(2, '0')}`;

  if (!area) {
    const prefecture = prefectureFromHeading(body);
    if (!prefecture) return null;
    return { store: { name, prefecture, city: '' }, visitDate };
  }

  const p = area.match(PREF_RE);
  if (!p) return null;
  return { store: { name, prefecture: p[1]!, city: p[2]!.trim() }, visitDate };
}
