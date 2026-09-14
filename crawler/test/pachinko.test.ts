import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { loadBody } from '../src/parse/body';
import { parsePachinko } from '../src/parse/pachinko';

describe('parsePachinko', () => {
  it('るいべえ記事: 機種ごとの台数・プラス台・平均差玉・DMM ID を取る', () => {
    const { body } = loadBody(fixture('article-ruibee-2026-09-06.html'));
    const r = parsePachinko(body);
    const bancho = r.find((x) => x.machineKey === 'dmm:4714');
    expect(bancho).toEqual({
      category: 'pachinko',
      machineKey: 'dmm:4714',
      machineName: '押忍！番長 漢の頂',
      units: 3,
      plusUnits: 2,
      avgDiff: 29780,
    });
    const rezero = r.find((x) => x.machineName.startsWith('Re:ゼロ'));
    expect(rezero?.avgDiff).toBe(-18210);
    expect(rezero?.plusUnits).toBe(0);
  });

  it('バラエティは除外する', () => {
    const { body } = loadBody(fixture('article-ruibee-2026-09-06.html'));
    expect(parsePachinko(body).some((x) => x.machineName === 'バラエティ')).toBe(false);
  });

  it('＜列①＞接頭辞を捨てて機種名だけにする', () => {
    const { body } = loadBody(fixture('article-girlps-2026-09-13.html'));
    const accel = parsePachinko(body).find((x) => x.machineKey === 'dmm:5051');
    expect(accel?.machineName).toBe('アクセル・ワールド');
    expect(accel?.units).toBe(3);
    expect(accel?.avgDiff).toBe(13700);
  });

  it('パチンコ無しの記事は空配列', () => {
    const { body } = loadBody(fixture('article-station-2026-09-11.html'));
    expect(parsePachinko(body)).toEqual([]);
  });

  it('h4 の直後が表（スロット形式 C）の記事ではパチンコ結果を出さない', () => {
    const { body } = loadBody(fixture('article-akamaru-2026-09-11.html'));
    expect(parsePachinko(body)).toEqual([]);
  });
});
