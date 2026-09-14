import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import type { MachineResult } from '../../../shared/types';
import { cleanText, extractBrackets, parseSignedInt, roundHalfAwayFromZero } from '../text';
import { isExcludedMachineName, machineKeyFor } from '../normalize';

export function parseSlot(body: Cheerio<Element>): MachineResult[] {
  return [...parseUnitTables(body), ...parseGroupHeadings(body)];
}

function cellTexts(body: Cheerio<Element>, row: Element, tag: 'th' | 'td'): string[] {
  return body.find(row).find(tag).map((_, c) => cleanText(body.find(c).text())).get();
}

/** 形式 A: 台番号 / 機種 / 回転数 / 差枚 */
function parseUnitTables(body: Cheerio<Element>): MachineResult[] {
  const diffs = new Map<string, number[]>();
  const units = new Map<string, string[]>();

  body.find('table').each((_, tableEl) => {
    const rows = body.find(tableEl).find('tr').toArray();
    const header = rows[0] ? cellTexts(body, rows[0], 'th') : [];
    if (header[0] !== '台番号') return;
    const iMachine = header.indexOf('機種');
    const iDiff = header.indexOf('差枚');
    if (iMachine < 0 || iDiff < 0) return;

    for (const row of rows.slice(1)) {
      const cells = cellTexts(body, row, 'td');
      const name = cells[iMachine];
      const diff = parseSignedInt(cells[iDiff] ?? '');
      const unitNo = cells[0];
      if (!name || diff === null || !unitNo) continue;
      diffs.set(name, [...(diffs.get(name) ?? []), diff]);
      units.set(name, [...(units.get(name) ?? []), unitNo]);
    }
  });

  return [...diffs.entries()].map(([name, ds]) => ({
    category: 'slot' as const,
    machineKey: machineKeyFor(name, null),
    machineName: name,
    units: ds.length,
    plusUnits: ds.filter((d) => d > 0).length,
    avgDiff: roundHalfAwayFromZero(ds.reduce((a, b) => a + b, 0) / ds.length),
    unitNumbers: (units.get(name) ?? []).join(','),
  }));
}

/** 形式 B: <h2>【機種 台番】</h2> … <table><th>プラス台</th>… */
function parseGroupHeadings(body: Cheerio<Element>): MachineResult[] {
  const out: MachineResult[] = [];

  body.find('h2').each((_, h2El) => {
    const h2 = body.find(h2El);
    const labels = extractBrackets(cleanText(h2.text()));
    if (labels.length === 0) return;

    const table = h2.nextAll('table').first();
    if (table.length === 0) return;
    if (table.prevAll('h2').first()[0] !== h2El) return; // 別の h2 の表

    const rowValue = (label: string): string => {
      const tr = table.find('tr').filter((_, trEl) => cellTexts(body, trEl, 'th')[0] === label).first();
      return cleanText(tr.find('td').first().text());
    };
    const plusM = rowValue('プラス台').match(/(\d+)\s*台\s*\/\s*(\d+)\s*台/);
    const avgDiff = parseSignedInt(rowValue('平均差枚数'));
    if (!plusM || avgDiff === null) return;

    const parsed = labels.map(splitNameAndUnits).filter((p) => !isExcludedMachineName(p.name));
    for (const { name, unitNumbers } of parsed) {
      out.push({
        category: 'slot',
        machineKey: machineKeyFor(name, null),
        machineName: name,
        units: Number(plusM[2]),
        plusUnits: Number(plusM[1]),
        avgDiff,
        ...(unitNumbers ? { unitNumbers } : {}),
        ...(parsed.length > 1 ? { shared: true as const } : {}),
      });
    }
  });

  return out;
}

/** '東京喰種 361〜366' → { name: '東京喰種', unitNumbers: '361〜366' } */
export function splitNameAndUnits(label: string): { name: string; unitNumbers?: string } {
  const m = label.match(/^(.*?)\s+([\d０-９,，〜～\-]+)$/);
  if (!m) return { name: label.trim() };
  return { name: m[1]!.trim(), unitNumbers: m[2]!.replace(/～/g, '〜').replace(/，/g, ',') };
}
