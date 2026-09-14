import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { loadBody } from '../src/parse/body';
import { parseStoreInfo } from '../src/parse/storeInfo';

describe('parseStoreInfo', () => {
  it('るいべえ記事から店舗・訪問日・地域を取る', () => {
    const { body } = loadBody(fixture('article-ruibee-2026-09-06.html'));
    expect(parseStoreInfo(body)).toEqual({
      store: { name: '新！ガーデン八潮', prefecture: '埼玉県', city: '八潮市' },
      visitDate: '2026-09-06',
    });
  });
  it('スロぱちガール記事も同じ形で取れる', () => {
    const { body } = loadBody(fixture('article-girlps-2026-09-13.html'));
    expect(parseStoreInfo(body)).toEqual({
      store: { name: 'ピーアーク草加', prefecture: '埼玉県', city: '草加市' },
      visitDate: '2026-09-13',
    });
  });
  it('店舗情報が無ければ null', () => {
    const { body } = loadBody('<html><body><div class="entry col-md-12"><p>x</p></div></body></html>');
    expect(parseStoreInfo(body)).toBeNull();
  });
  it('東京都は都道府県「東京都」市区「豊島区」に分かれる', () => {
    const { body } = loadBody(
      '<html><body><div class="entry col-md-12"><table><tr><td>店舗:&nbsp;X店<br>訪問日:&nbsp;2026/08/01<br>地域:&nbsp;東京都 豊島区<br></td></tr></table></div></body></html>',
    );
    expect(parseStoreInfo(body)?.store).toEqual({ name: 'X店', prefecture: '東京都', city: '豊島区' });
  });
  it('地域行が無い記事は最初の h2 の括弧から都道府県を取り、市区は空', () => {
    const { body } = loadBody(fixture('article-station-nopref-2026-09-10.html'));
    expect(parseStoreInfo(body)).toEqual({
      store: { name: 'エクス・アリーナ 東京', prefecture: '東京都', city: '' },
      visitDate: '2026-09-10',
    });
  });
});
