import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { parseArticle } from '../src/parse/article';

const URL = 'https://777.slopachi-station.com/x/';
const AT = '2026-09-15T00:00:00.000Z';

describe('parseArticle', () => {
  it('るいべえ記事を Article にする', () => {
    const r = parseArticle(fixture('article-ruibee-2026-09-06.html'), URL, AT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.article.url).toBe(URL);
    expect(r.article.visitDate).toBe('2026-09-06');
    expect(r.article.coverageType).toBe('るいべえ実践来店');
    expect(r.article.store.name).toBe('新！ガーデン八潮');
    expect(r.article.title).toContain('るいべえ実践来店');
    expect(r.article.results.filter((x) => x.category === 'pachinko').length).toBeGreaterThan(5);
    expect(r.article.results.filter((x) => x.category === 'slot')).toHaveLength(14);
    expect(r.article.fetchedAt).toBe(AT);
  });

  it('店舗情報が無い HTML は失敗', () => {
    const r = parseArticle('<html><head><title>t</title></head><body><div class="entry col-md-12"></div></body></html>', URL, AT);
    expect(r).toEqual({ ok: false, reason: '店舗情報が見つからない' });
  });

  it('機種結果が無い記事は失敗', () => {
    const html =
      '<html><head><title>【9月1日 X店】れんじろう実践来店！x</title></head><body><div class="entry col-md-12">' +
      '<table><tr><td>店舗:&nbsp;X店<br>訪問日:&nbsp;2026/09/01<br>地域:&nbsp;埼玉県 川口市<br></td></tr></table>' +
      '<h2>9月1日 X店</h2><p><strong>【れんじろう実践来店】</strong></p></div></body></html>';
    expect(parseArticle(html, URL, AT)).toEqual({ ok: false, reason: '機種結果が 0 件' });
  });

  it('地域行なし記事: パチンコ 2 機種を読み、都道府県は h2 から補う', () => {
    const r = parseArticle(fixture('article-station-nopref-2026-09-10.html'), URL, AT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.article.store).toEqual({ name: 'エクス・アリーナ 東京', prefecture: '東京都', city: '' });
    expect(r.article.coverageType).toBe('スロパチステーション来店取材');
    expect(r.article.results).toHaveLength(2);
    expect(r.article.results[0]).toEqual({
      category: 'pachinko', machineKey: 'dmm:4782', machineName: '東京喰種', units: 30, plusUnits: 21, avgDiff: 8760,
    });
    expect(r.article.results[1]).toMatchObject({ machineKey: 'dmm:4846', avgDiff: -3250, plusUnits: 10 });
  });

  it('あかまる記事: スロット形式 C を 17 件読む', () => {
    const r = parseArticle(fixture('article-akamaru-2026-09-11.html'), URL, AT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.article.coverageType).toBe('東京あかまる来店取材');
    expect(r.article.store).toEqual({ name: 'マルハンメガシティ2000蒲田1', prefecture: '東京都', city: '大田区' });
    expect(r.article.results).toHaveLength(17);
    expect(r.article.results.every((x) => x.category === 'slot')).toBe(true);
  });
});
