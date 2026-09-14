import { describe, it, expect } from 'vitest';
import type { MachineSummary, ShopHit } from '../../shared/types';
import { searchMachines, filterShops, availableFilters, lookupStores, normalizeForSearch } from '../src/lib/rank';

function shop(storeName: string, prefecture: string, articles: { d: string; t: string; avg: number; units?: number; plus?: number }[]): ShopHit {
  const arts = articles.map((a) => ({ url: `u-${a.d}`, visitDate: a.d, coverageType: a.t, units: a.units ?? 4, plusUnits: a.plus ?? 2, avgDiff: a.avg }));
  arts.sort((x, y) => (x.visitDate < y.visitDate ? 1 : -1));
  return {
    storeName, prefecture, city: 'c', hitCount: arts.length, lastVisitDate: arts[0]!.visitDate,
    avgDiffMean: Math.round(arts.reduce((n, a) => n + a.avgDiff, 0) / arts.length),
    plusRate: arts.reduce((n, a) => n + a.plusUnits, 0) / arts.reduce((n, a) => n + a.units, 0), articles: arts,
  };
}
function machine(key: string, displayName: string, category: 'pachinko' | 'slot', shops: ShopHit[], aliases: string[] = []): MachineSummary {
  return { machineKey: key, displayName, category, aliases, hitCount: shops.reduce((n, s) => n + s.hitCount, 0), shopCount: shops.length, shops };
}

const hokuto = machine('dmm:1', '真・北斗無双 第5章', 'pachinko', [
  shop('A店', '埼玉県', [{ d: '2026-09-01', t: 'るいべえ実践来店', avg: 1000 }, { d: '2026-09-05', t: 'スロパチステーション来店取材', avg: -500 }]),
  shop('B店', '千葉県', [{ d: '2026-09-10', t: 'るいべえ実践来店', avg: 8000 }]),
]);
const bancho = machine('dmm:2', '押忍！番長 漢の頂', 'pachinko', [shop('A店', '埼玉県', [{ d: '2026-09-01', t: 'るいべえ実践来店', avg: 100 }])]);
const gul = machine('name:東京喰種', '東京喰種', 'slot', [shop('C店', '埼玉県', [{ d: '2026-09-02', t: 'るいべえ実践来店', avg: 3000 }])]);
const all = [hokuto, bancho, gul];

describe('normalizeForSearch', () => {
  it('全角・空白・大文字を吸収', () => {
    expect(normalizeForSearch('ＳＡＯ２ 閃光')).toBe('sao2閃光');
  });
});

describe('searchMachines', () => {
  it('空クエリは種別内の回数上位', () => {
    expect(searchMachines(all, 'pachinko', '').map((m) => m.machineKey)).toEqual(['dmm:1', 'dmm:2']);
    expect(searchMachines(all, 'slot', '')).toHaveLength(1);
  });
  it('部分一致（空白・全角を無視）', () => {
    expect(searchMachines(all, 'pachinko', '北斗無双第５章').map((m) => m.machineKey)).toEqual(['dmm:1']);
    expect(searchMachines(all, 'pachinko', '喰種')).toEqual([]);
  });
  it('別名にも当たる', () => {
    const m = machine('dmm:9', '正式名', 'pachinko', [], ['ニックネーム']);
    expect(searchMachines([m], 'pachinko', 'ニック')).toHaveLength(1);
  });
});

describe('filterShops', () => {
  it('絞り込み無しは元の順', () => {
    expect(filterShops(hokuto, { prefectures: [], coverageTypes: [] }).map((s) => s.storeName)).toEqual(['A店', 'B店']);
  });
  it('都道府県で店舗を絞る', () => {
    expect(filterShops(hokuto, { prefectures: ['千葉県'], coverageTypes: [] }).map((s) => s.storeName)).toEqual(['B店']);
  });
  it('取材種別で記事を絞り、数値を再計算する', () => {
    const r = filterShops(hokuto, { prefectures: [], coverageTypes: ['るいべえ実践来店'] });
    expect(r.map((s) => [s.storeName, s.hitCount])).toEqual([['B店', 1], ['A店', 1]]); // 同数 → 直近が新しい B が先
    expect(r[1]).toMatchObject({ avgDiffMean: 1000, lastVisitDate: '2026-09-01' });
  });
  it('記事が 0 件になった店舗は消える', () => {
    expect(filterShops(hokuto, { prefectures: [], coverageTypes: ['スロパチステーション来店取材'] }).map((s) => s.storeName)).toEqual(['A店']);
  });
});

describe('availableFilters', () => {
  it('件数の多い順に並ぶ', () => {
    expect(availableFilters(hokuto)).toEqual({ prefectures: ['埼玉県', '千葉県'], coverageTypes: ['るいべえ実践来店', 'スロパチステーション来店取材'] });
  });
});

describe('lookupStores', () => {
  it('店舗名の部分一致で、その店の機種を回数順に返す', () => {
    const r = lookupStores(all, 'A', 'pachinko');
    expect(r).toHaveLength(1);
    expect(r[0]!.storeName).toBe('A店');
    expect(r[0]!.machines.map((m) => m.displayName)).toEqual(['真・北斗無双 第5章', '押忍！番長 漢の頂']);
  });
  it('空クエリは空配列', () => {
    expect(lookupStores(all, '', 'pachinko')).toEqual([]);
  });
});
