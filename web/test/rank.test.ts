import { describe, it, expect } from 'vitest';
import type { MachineSummary, ShopHit } from '../../shared/types';
import { searchMachines, filterShops, availableFilters, lookupStores, normalizeForSearch, sortShops } from '../src/lib/rank';

function shop(storeName: string, prefecture: string, articles: { d: string; t: string; avg: number | null; units?: number; plus?: number }[]): ShopHit {
  const arts = articles.map((a) => ({ url: `u-${a.d}`, visitDate: a.d, coverageType: a.t, units: a.units ?? 4, plusUnits: a.plus ?? 2, avgDiff: a.avg }));
  arts.sort((x, y) => (x.visitDate < y.visitDate ? 1 : -1));
  const known = arts.filter((a): a is typeof a & { avgDiff: number } => a.avgDiff !== null);
  return {
    storeName, prefecture, city: 'c', hitCount: arts.length, lastVisitDate: arts[0]!.visitDate,
    avgDiffMean: known.length > 0 ? Math.round(known.reduce((n, a) => n + a.avgDiff, 0) / known.length) : null,
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
  it('取材種別で記事を絞り、数値を再計算する（順序は変えない）', () => {
    const r = filterShops(hokuto, { prefectures: [], coverageTypes: ['るいべえ実践来店'] });
    expect(r.map((s) => [s.storeName, s.hitCount])).toEqual([['A店', 1], ['B店', 1]]);
    expect(r[0]).toMatchObject({ avgDiffMean: 1000, lastVisitDate: '2026-09-01' });
  });
  it('絞り込み後に count で並べると、同数なら直近が新しい店が先', () => {
    const r = sortShops(filterShops(hokuto, { prefectures: [], coverageTypes: ['るいべえ実践来店'] }), 'count');
    expect(r.map((s) => s.storeName)).toEqual(['B店', 'A店']);
  });
  it('記事が 0 件になった店舗は消える', () => {
    expect(filterShops(hokuto, { prefectures: [], coverageTypes: ['スロパチステーション来店取材'] }).map((s) => s.storeName)).toEqual(['A店']);
  });
  it('絞り込んだ結果 avg が全て null の店舗は avgDiffMean が null', () => {
    const noAvgShop = machine('dmm:3', '無平均機種', 'pachinko', [
      shop('D店', '埼玉県', [{ d: '2026-09-01', t: 'るいべえ実践来店', avg: null }, { d: '2026-09-02', t: 'スロパチステーション来店取材', avg: 500 }]),
    ]);
    const r = filterShops(noAvgShop, { prefectures: [], coverageTypes: ['るいべえ実践来店'] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ avgDiffMean: null });
  });
});

describe('availableFilters', () => {
  it('件数付きで、件数の多い順に並ぶ', () => {
    expect(availableFilters(hokuto)).toEqual({
      prefectures: [{ value: '埼玉県', count: 2 }, { value: '千葉県', count: 1 }],
      coverageTypes: [{ value: 'るいべえ実践来店', count: 2 }, { value: 'スロパチステーション来店取材', count: 1 }],
    });
  });
});

describe('sortShops', () => {
  const shops = [
    shop('回数店', '埼玉県', [{ d: '2026-08-01', t: 'x', avg: -100, units: 10, plus: 1 }, { d: '2026-08-02', t: 'x', avg: -100, units: 10, plus: 1 }, { d: '2026-08-03', t: 'x', avg: -100, units: 10, plus: 1 }]),
    shop('平均店', '埼玉県', [{ d: '2026-08-10', t: 'x', avg: 9000, units: 10, plus: 5 }]),
    shop('率店', '埼玉県', [{ d: '2026-08-20', t: 'x', avg: 500, units: 10, plus: 9 }]),
    shop('直近店', '埼玉県', [{ d: '2026-09-10', t: 'x', avg: null, units: 10, plus: 2 }]),
  ];
  it('count は回数降順、同数なら直近が新しい順', () => {
    expect(sortShops(shops, 'count').map((s) => s.storeName)).toEqual(['回数店', '直近店', '率店', '平均店']);
  });
  it('avg は平均差玉の降順、平均なしは最後', () => {
    expect(sortShops(shops, 'avg').map((s) => s.storeName)).toEqual(['平均店', '率店', '回数店', '直近店']);
  });
  it('plusRate はプラス台率の降順', () => {
    expect(sortShops(shops, 'plusRate').map((s) => s.storeName)).toEqual(['率店', '平均店', '直近店', '回数店']);
  });
  it('recent は直近訪問日の新しい順', () => {
    expect(sortShops(shops, 'recent').map((s) => s.storeName)).toEqual(['直近店', '率店', '平均店', '回数店']);
  });
  it('元の配列を変更しない', () => {
    const before = shops.map((s) => s.storeName);
    sortShops(shops, 'avg');
    expect(shops.map((s) => s.storeName)).toEqual(before);
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
