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
});
