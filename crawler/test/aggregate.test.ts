import { describe, it, expect } from 'vitest';
import type { Article, MachineResult } from '../../shared/types';
import { aggregate } from '../src/aggregate';

function res(machineKey: string, machineName: string, units: number, plusUnits: number, avgDiff: number, extra: Partial<MachineResult> = {}): MachineResult {
  return { category: 'pachinko', machineKey, machineName, units, plusUnits, avgDiff, ...extra };
}
function art(url: string, visitDate: string, storeName: string, results: MachineResult[], coverageType = 'るいべえ実践来店'): Article {
  return { url, title: 't', visitDate, coverageType, store: { name: storeName, prefecture: '埼玉県', city: 'c' }, results, fetchedAt: 'f' };
}

describe('aggregate', () => {
  it('機種ごとに店舗を回数順に並べる', () => {
    const out = aggregate([
      art('u1', '2026-09-01', 'A店', [res('dmm:1', '北斗', 3, 2, 1000)]),
      art('u2', '2026-09-05', 'A店', [res('dmm:1', '北斗', 2, 0, -500)]),
      art('u3', '2026-09-10', 'B店', [res('dmm:1', '北斗', 4, 4, 8000)]),
    ]);
    expect(out).toHaveLength(1);
    const m = out[0]!;
    expect(m.machineKey).toBe('dmm:1');
    expect(m.hitCount).toBe(3);
    expect(m.shopCount).toBe(2);
    expect(m.shops.map((s) => s.storeName)).toEqual(['A店', 'B店']);
    expect(m.shops[0]).toMatchObject({ hitCount: 2, lastVisitDate: '2026-09-05', avgDiffMean: 250, plusRate: 0.4 });
    expect(m.shops[0]!.articles.map((a) => a.visitDate)).toEqual(['2026-09-05', '2026-09-01']);
  });

  it('同数の店舗は直近訪問日が新しい方を先に', () => {
    const out = aggregate([
      art('u1', '2026-09-01', 'A店', [res('dmm:1', '北斗', 1, 1, 1)]),
      art('u2', '2026-09-09', 'B店', [res('dmm:1', '北斗', 1, 1, 1)]),
    ]);
    expect(out[0]!.shops.map((s) => s.storeName)).toEqual(['B店', 'A店']);
  });

  it('記事内の同一機種は 1 件に統合し重み付き平均をとる', () => {
    const out = aggregate([
      art('u1', '2026-09-01', 'A店', [
        res('name:東京喰種', '東京喰種', 6, 6, 6950, { category: 'slot' }),
        res('name:東京喰種', '東京喰種', 3, 2, 2000, { category: 'slot' }),
      ]),
    ]);
    const hit = out[0]!.shops[0]!;
    expect(hit.hitCount).toBe(1);
    expect(hit.articles[0]).toMatchObject({ units: 9, plusUnits: 8, avgDiff: 5300 });
  });

  it('表記ゆれは displayName と aliases に分かれる', () => {
    const out = aggregate([
      art('u1', '2026-09-01', 'A店', [res('dmm:1', '真・北斗無双 第5章', 1, 1, 1)]),
      art('u2', '2026-09-02', 'B店', [res('dmm:1', '真・北斗無双 第5章', 1, 1, 1)]),
      art('u3', '2026-09-03', 'C店', [res('dmm:1', '北斗無双5', 1, 1, 1)]),
    ]);
    expect(out[0]!.displayName).toBe('真・北斗無双 第5章');
    expect(out[0]!.aliases).toEqual(['北斗無双5']);
  });

  it('機種は記事数の多い順', () => {
    const out = aggregate([
      art('u1', '2026-09-01', 'A店', [res('dmm:1', 'X', 1, 1, 1), res('dmm:2', 'Y', 1, 1, 1)]),
      art('u2', '2026-09-02', 'B店', [res('dmm:2', 'Y', 1, 1, 1)]),
    ]);
    expect(out.map((m) => m.machineKey)).toEqual(['dmm:2', 'dmm:1']);
  });
});
