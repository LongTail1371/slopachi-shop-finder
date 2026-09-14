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

  it('div で囲まれていない（h4/pre が直接の兄弟要素の）記事でも機種ごとに区切る', () => {
    const html = `<html><body><div id="entry">
      <h4>【機種A】</h4>
      <pre>全3台中、2台がプラス（67%)</pre>
      <pre>平均差玉数:+1,000玉</pre>
      <a href="https://p-town.dmm.com/machines/1111">機種情報はこちら</a>
      <h4>【機種B】</h4>
      <pre>全5台中、1台がプラス（20%)</pre>
      <pre>平均差玉数:-2,000玉</pre>
      <a href="https://p-town.dmm.com/machines/2222">機種情報はこちら</a>
    </div></body></html>`;
    const { body } = loadBody(html);
    const r = parsePachinko(body);
    expect(r).toHaveLength(2);
    const a = r.find((x) => x.machineName === '機種A');
    const b = r.find((x) => x.machineName === '機種B');
    expect(a).toMatchObject({ units: 3, plusUnits: 2, avgDiff: 1000, machineKey: 'dmm:1111' });
    expect(b).toMatchObject({ units: 5, plusUnits: 1, avgDiff: -2000, machineKey: 'dmm:2222' });
  });
});
