import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { loadBody } from '../src/parse/body';
import { parseSlot } from '../src/parse/slot';

describe('parseSlot 形式 A（台番号ごとの表）', () => {
  const { body } = loadBody(fixture('article-ruibee-2026-09-06.html'));
  const r = parseSlot(body);

  it('機種ごとに行を束ねる（14 機種）', () => {
    expect(r).toHaveLength(14);
  });
  it('複数表にまたがる機種も 1 つにまとめる', () => {
    const otome = r.find((x) => x.machineName === '乙女5');
    expect(otome).toEqual({
      category: 'slot',
      machineKey: 'name:乙女5',
      machineName: '乙女5',
      units: 9,
      plusUnits: 6,
      avgDiff: 5351,
      unitNumbers: '604,605,606,607,608,609,610,611,612',
    });
  });
  it('1 台だけの機種も扱う', () => {
    const persona = r.find((x) => x.machineName === 'ペルソナ5');
    expect(persona).toMatchObject({ units: 1, plusUnits: 0, avgDiff: -690, unitNumbers: '828' });
  });
  it('平均は四捨五入した整数', () => {
    expect(r.find((x) => x.machineName === '戦コレ6')?.avgDiff).toBe(128);
  });
});

describe('parseSlot 形式 B（機種見出し + 縦持ち表）', () => {
  it('スロぱちガール記事: 9 群を機種ごとに読む', () => {
    const { body } = loadBody(fixture('article-girlps-2026-09-13.html'));
    const r = parseSlot(body);
    expect(r).toHaveLength(9);
    expect(r[0]).toEqual({
      category: 'slot',
      machineKey: 'name:ヴヴヴ2',
      machineName: 'ヴヴヴ2',
      units: 4,
      plusUnits: 2,
      avgDiff: 4620,
      unitNumbers: '584〜587',
    });
    expect(r.filter((x) => x.machineName === '東京喰種')).toHaveLength(2);
    expect(r.find((x) => x.machineName === 'スマスロゴッド')?.avgDiff).toBe(-300);
  });

  it('来店取材記事: 2 機種混在の見出しは shared 付きで 2 件になる', () => {
    const { body } = loadBody(fixture('article-station-2026-09-11.html'));
    const r = parseSlot(body);
    expect(r).toHaveLength(12);
    const karakuri = r.find((x) => x.machineName === 'からくり2');
    const god = r.find((x) => x.machineName === 'スマスロゴッド');
    expect(karakuri).toEqual({
      category: 'slot',
      machineKey: 'name:からくり2',
      machineName: 'からくり2',
      units: 3,
      plusUnits: 3,
      avgDiff: 7600,
      unitNumbers: '451',
      shared: true,
    });
    expect(god).toMatchObject({ units: 3, plusUnits: 3, avgDiff: 7600, unitNumbers: '452,453', shared: true });
    expect(r.find((x) => x.machineName === 'かぐや様')).toMatchObject({ units: 3, plusUnits: 2, avgDiff: 190, shared: true });
  });
});

describe('parseSlot 形式 C（h4 見出し + 縦持ち表、台番なし）', () => {
  const { body } = loadBody(fixture('article-akamaru-2026-09-11.html'));
  const r = parseSlot(body);

  it('17 機種を読む', () => {
    expect(r).toHaveLength(17);
  });
  it('先頭は炎炎ノ消防隊2。台番も shared も付かない', () => {
    expect(r[0]).toEqual({
      category: 'slot',
      machineKey: 'name:炎炎ノ消防隊2',
      machineName: '炎炎ノ消防隊2',
      units: 5,
      plusUnits: 5,
      avgDiff: 5510,
    });
  });
  it('負の平均も読む', () => {
    expect(r.find((x) => x.machineName === '甲鉄城のカバネリ 海門決戦')).toMatchObject({ units: 16, plusUnits: 5, avgDiff: -140 });
  });
  it('DMM リンクがあってもスロットのキーは name: のまま', () => {
    expect(r.every((x) => x.machineKey.startsWith('name:'))).toBe(true);
  });
});
