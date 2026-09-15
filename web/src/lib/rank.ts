import type { Category, MachineSummary, ShopArticleRef, ShopHit } from '../../../shared/types';

export function normalizeForSearch(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, '')
    .toLowerCase();
}

export function searchMachines(machines: MachineSummary[], category: Category, query: string, limit = 20): MachineSummary[] {
  const inCategory = machines.filter((m) => m.category === category);
  const q = normalizeForSearch(query);
  if (q === '') return inCategory.slice(0, limit);
  return inCategory.filter((m) => [m.displayName, ...m.aliases].some((n) => normalizeForSearch(n).includes(q)));
}

export interface ShopFilter {
  prefectures: string[];
  coverageTypes: string[];
}

function rebuildShop(base: ShopHit, articles: ShopArticleRef[]): ShopHit {
  const totalUnits = articles.reduce((n, a) => n + a.units, 0);
  const totalPlus = articles.reduce((n, a) => n + a.plusUnits, 0);
  const known = articles.filter((a) => a.avgDiff !== null);
  return {
    ...base,
    hitCount: articles.length,
    lastVisitDate: articles[0]!.visitDate,
    avgDiffMean: known.length > 0 ? Math.round(known.reduce((n, a) => n + a.avgDiff!, 0) / known.length) : null,
    plusRate: totalUnits > 0 ? Math.round((totalPlus / totalUnits) * 1000) / 1000 : 0,
    articles,
  };
}

function compareShops(x: ShopHit, y: ShopHit): number {
  return (
    y.hitCount - x.hitCount ||
    (x.lastVisitDate < y.lastVisitDate ? 1 : x.lastVisitDate > y.lastVisitDate ? -1 : 0) ||
    x.storeName.localeCompare(y.storeName, 'ja')
  );
}

/** 絞り込みだけを行う。順序は sortShops が決める */
export function filterShops(machine: MachineSummary, f: ShopFilter): ShopHit[] {
  const byPref = f.prefectures.length ? machine.shops.filter((s) => f.prefectures.includes(s.prefecture)) : machine.shops;
  if (f.coverageTypes.length === 0) return byPref;
  return byPref
    .map((s) => ({ s, arts: s.articles.filter((a) => f.coverageTypes.includes(a.coverageType)) }))
    .filter(({ arts }) => arts.length > 0)
    .map(({ s, arts }) => rebuildShop(s, arts));
}

export interface FilterOption { value: string; count: number }

function countDesc(items: string[]): FilterOption[] {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .map(([value, count]) => ({ value, count }));
}

export function availableFilters(machine: MachineSummary): { prefectures: FilterOption[]; coverageTypes: FilterOption[] } {
  return {
    prefectures: countDesc(machine.shops.flatMap((s) => s.articles.map(() => s.prefecture))),
    coverageTypes: countDesc(machine.shops.flatMap((s) => s.articles.map((a) => a.coverageType))),
  };
}

export const SORT_KEYS = ['count', 'avg', 'plusRate', 'recent'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

function compareByKey(key: SortKey): (x: ShopHit, y: ShopHit) => number {
  switch (key) {
    case 'count':
      return compareShops;
    case 'avg':
      // 平均の記載が無い店舗は末尾に置く
      return (x, y) => {
        if (x.avgDiffMean === null || y.avgDiffMean === null) {
          if (x.avgDiffMean === y.avgDiffMean) return compareShops(x, y);
          return x.avgDiffMean === null ? 1 : -1;
        }
        return y.avgDiffMean - x.avgDiffMean || compareShops(x, y);
      };
    case 'plusRate':
      return (x, y) => y.plusRate - x.plusRate || compareShops(x, y);
    case 'recent':
      return (x, y) => (x.lastVisitDate < y.lastVisitDate ? 1 : x.lastVisitDate > y.lastVisitDate ? -1 : 0) || compareShops(x, y);
  }
}

export function sortShops(shops: ShopHit[], key: SortKey): ShopHit[] {
  return [...shops].sort(compareByKey(key));
}

export interface StoreMatch {
  storeName: string;
  prefecture: string;
  city: string;
  machines: { machineKey: string; displayName: string; category: Category; hitCount: number; lastVisitDate: string; avgDiffMean: number | null }[];
}

export function lookupStores(machines: MachineSummary[], query: string, category: Category): StoreMatch[] {
  const q = normalizeForSearch(query);
  if (q === '') return [];
  const acc = new Map<string, StoreMatch>();
  for (const m of machines) {
    if (m.category !== category) continue;
    for (const s of m.shops) {
      if (!normalizeForSearch(s.storeName).includes(q)) continue;
      const key = `${s.prefecture}|${s.storeName}`;
      const cur = acc.get(key) ?? { storeName: s.storeName, prefecture: s.prefecture, city: s.city, machines: [] };
      cur.machines.push({ machineKey: m.machineKey, displayName: m.displayName, category: m.category, hitCount: s.hitCount, lastVisitDate: s.lastVisitDate, avgDiffMean: s.avgDiffMean });
      acc.set(key, cur);
    }
  }
  const out = [...acc.values()];
  for (const st of out) st.machines.sort((a, b) => b.hitCount - a.hitCount || (a.lastVisitDate < b.lastVisitDate ? 1 : -1));
  out.sort((a, b) => b.machines.length - a.machines.length || a.storeName.localeCompare(b.storeName, 'ja'));
  return out;
}
