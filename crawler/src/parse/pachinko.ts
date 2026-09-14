import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import type { MachineResult } from '../../../shared/types';
import { cleanText, extractBrackets, parseSignedInt } from '../text';
import { isExcludedMachineName, machineKeyFor } from '../normalize';

const UNITS_RE = /全\s*(\d+)\s*台中、?\s*(\d+)\s*台がプラス/;
const AVG_RE = /平均差玉数\s*[:：]\s*([+\-−－]?[\d,，]+)/;
const DMM_RE = /p-town\.dmm\.com\/machines\/(\d+)/;

export function parsePachinko(body: Cheerio<Element>): MachineResult[] {
  const out: MachineResult[] = [];
  body.find('h4').each((_, h4El) => {
    const h4 = body.find(h4El);
    const name = extractBrackets(cleanText(h4.text()))[0];
    if (!name || isExcludedMachineName(name)) return;

    // 次の見出し（h2 か次の h4）までの要素だけをこの機種のセクションとみなす。
    // 記事によっては見出しごとに div でラップされず、h4/pre が本文の直接の兄弟
    // 要素として並ぶことがあるため、h4.parent() では区切れない。
    const section = h4.nextUntil('h2, h4');
    const preEls = section.filter('pre').add(section.find('pre'));
    const pres = preEls.map((_, p) => cleanText(body.find(p).text())).get();
    const unitsM = pres.map((t) => t.match(UNITS_RE)).find(Boolean);
    const avgM = pres.map((t) => t.match(AVG_RE)).find(Boolean);
    if (!unitsM || !avgM) return;
    const avgDiff = parseSignedInt(avgM[1]!);
    if (avgDiff === null) return;

    const linkSelector = 'a[href*="p-town.dmm.com/machines/"]';
    const links = section.filter(linkSelector).add(section.find(linkSelector));
    const href = links.first().attr('href') ?? '';
    const dmmId = href.match(DMM_RE)?.[1] ?? null;

    out.push({
      category: 'pachinko',
      machineKey: machineKeyFor(name, dmmId),
      machineName: name,
      units: Number(unitsM[1]),
      plusUnits: Number(unitsM[2]),
      avgDiff,
    });
  });
  return out;
}
