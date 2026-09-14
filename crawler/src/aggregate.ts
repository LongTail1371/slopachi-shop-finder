import type { Article, Category, MachineResult, MachineSummary, ShopArticleRef, ShopHit } from '../../shared/types';
import { roundHalfAwayFromZero } from './text';

interface Merged {
  category: Category;
  machineName: string;
  units: number;
  plusUnits: number;
  avgDiff: number | null;
  shared?: true;
}

/** 記事内で同じ machineKey を 1 件に統合する */
export function mergeWithinArticle(results: MachineResult[]): Map<string, Merged> {
  const acc = new Map<string, { category: Category; machineName: string; units: number; plus: number; weighted: number; weightedUnits: number; shared: boolean }>();
  for (const r of results) {
    const cur = acc.get(r.machineKey) ?? { category: r.category, machineName: r.machineName, units: 0, plus: 0, weighted: 0, weightedUnits: 0, shared: false };
    cur.units += r.units;
    cur.plus += r.plusUnits;
    if (r.avgDiff !== null) {
      cur.weighted += r.avgDiff * r.units;
      cur.weightedUnits += r.units;
    }
    cur.shared = cur.shared || r.shared === true;
    acc.set(r.machineKey, cur);
  }
  const out = new Map<string, Merged>();
  for (const [key, v] of acc) {
    out.set(key, {
      category: v.category,
      machineName: v.machineName,
      units: v.units,
      plusUnits: v.plus,
      avgDiff: v.weightedUnits > 0 ? roundHalfAwayFromZero(v.weighted / v.weightedUnits) : null,
      ...(v.shared ? { shared: true as const } : {}),
    });
  }
  return out;
}

interface ShopAcc { storeName: string; prefecture: string; city: string; articles: ShopArticleRef[] }
interface MachineAcc { category: Category; names: Map<string, number>; shops: Map<string, ShopAcc>; hitCount: number }

export function aggregate(articles: Article[]): MachineSummary[] {
  const machines = new Map<string, MachineAcc>();

  for (const a of articles) {
    for (const [key, m] of mergeWithinArticle(a.results)) {
      const macc = machines.get(key) ?? { category: m.category, names: new Map(), shops: new Map(), hitCount: 0 };
      macc.hitCount += 1;
      macc.names.set(m.machineName, (macc.names.get(m.machineName) ?? 0) + 1);

      const shopKey = `${a.store.prefecture}|${a.store.name}`;
      const sacc = macc.shops.get(shopKey) ?? { storeName: a.store.name, prefecture: a.store.prefecture, city: a.store.city, articles: [] };
      sacc.articles.push({
        url: a.url, visitDate: a.visitDate, coverageType: a.coverageType,
        units: m.units, plusUnits: m.plusUnits, avgDiff: m.avgDiff, ...(m.shared ? { shared: true as const } : {}),
      });
      macc.shops.set(shopKey, sacc);
      machines.set(key, macc);
    }
  }

  const summaries: MachineSummary[] = [];
  for (const [machineKey, macc] of machines) {
    const [displayName] = [...macc.names.entries()].sort((x, y) => y[1] - x[1])[0]!;
    const aliases = [...macc.names.keys()].filter((n) => n !== displayName);

    const shops: ShopHit[] = [...macc.shops.values()].map((s) => {
      const articlesDesc = [...s.articles].sort((x, y) => (x.visitDate < y.visitDate ? 1 : x.visitDate > y.visitDate ? -1 : 0));
      const totalUnits = articlesDesc.reduce((n, r) => n + r.units, 0);
      const totalPlus = articlesDesc.reduce((n, r) => n + r.plusUnits, 0);
      const known = articlesDesc.filter((r) => r.avgDiff !== null);
      return {
        storeName: s.storeName, prefecture: s.prefecture, city: s.city,
        hitCount: articlesDesc.length,
        lastVisitDate: articlesDesc[0]!.visitDate,
        avgDiffMean: known.length > 0 ? roundHalfAwayFromZero(known.reduce((n, r) => n + r.avgDiff!, 0) / known.length) : null,
        plusRate: totalUnits > 0 ? Math.round((totalPlus / totalUnits) * 1000) / 1000 : 0,
        articles: articlesDesc,
      };
    });
    shops.sort((x, y) =>
      y.hitCount - x.hitCount ||
      (x.lastVisitDate < y.lastVisitDate ? 1 : x.lastVisitDate > y.lastVisitDate ? -1 : 0) ||
      x.storeName.localeCompare(y.storeName, 'ja'),
    );

    summaries.push({ machineKey, displayName, category: macc.category, aliases, hitCount: macc.hitCount, shopCount: shops.length, shops });
  }

  summaries.sort((x, y) => y.hitCount - x.hitCount || x.displayName.localeCompare(y.displayName, 'ja'));
  return summaries;
}
