import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { loadBody } from '../src/parse/body';
import { parseCoverageType } from '../src/parse/coverageType';

describe('parseCoverageType', () => {
  it.each([
    ['article-ruibee-2026-09-06.html', 'るいべえ実践来店'],
    ['article-girlps-2026-09-13.html', 'スロぱちガール来店PS'],
    ['article-station-2026-09-11.html', 'スロパチステーション来店取材'],
  ])('%s → %s', (file, expected) => {
    const { body, title } = loadBody(fixture(file));
    expect(parseCoverageType(body, title)).toBe(expected);
  });

  it('本文に無ければタイトルから取る', () => {
    const { body, title } = loadBody(
      '<html><head><title>【9月1日 X店】れんじろう実践来店！何かが凄い！ | スロパチステーション</title></head><body><div class="entry col-md-12"></div></body></html>',
    );
    expect(parseCoverageType(body, title)).toBe('れんじろう実践来店');
  });

  it('どこにも無ければ null', () => {
    const { body, title } = loadBody('<html><head><title>x</title></head><body></body></html>');
    expect(parseCoverageType(body, title)).toBeNull();
  });
});
