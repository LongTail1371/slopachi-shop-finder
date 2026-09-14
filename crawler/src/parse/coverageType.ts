import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { cleanText, extractBrackets } from '../text';

export function parseCoverageType(body: Cheerio<Element>, title: string): string | null {
  const firstH2 = body.find('h2').first();
  if (firstH2.length > 0) {
    const p = firstH2.nextAll('p').first();
    const found = extractBrackets(cleanText(p.text()))[0];
    if (found) return found;
  }
  const m = title.match(/】\s*([^！!]+)/);
  if (m) return cleanText(m[1]!);
  return null;
}
