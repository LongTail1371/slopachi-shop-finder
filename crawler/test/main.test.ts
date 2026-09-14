import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture } from './helpers';
import { runCrawl } from '../src/main';
import { writeArticles, writeErrors } from '../src/store';
import { REASON_NO_RESULTS } from '../src/parse/article';

const A1 = 'https://777.slopachi-station.com/a1/';
const A2 = 'https://777.slopachi-station.com/a2/';
const OLD = 'https://777.slopachi-station.com/old/';

function listingHtml(rows: { md: string; url?: string; label: string }[], next: string | null): string {
  const items = rows.map((r) => `<div class="resultRow"><div class="resultRow-detail">${r.md} ( <div class="week1">月</div> ) 【埼玉県草加市】<br>` +
    (r.url ? `<a href="${r.url}">${r.label}&nbsp;&nbsp;店</a>` : `${r.label}&nbsp;&nbsp;店`) + `</div></div>`).join('');
  const paging = next ? `<div class="pagingBox"><a class="next page-numbers" href="${next}">次へ</a></div>` : '';
  return `<html><body><section id="archiveReporList">${items}</section>${paging}</body></html>`;
}

function fakeSite(): Record<string, string> {
  const article = fixture('article-ruibee-2026-09-06.html');
  return {
    'https://777.slopachi-station.com/report_pref/tokyo/': listingHtml([], null),
    'https://777.slopachi-station.com/report/minami-kanto/': listingHtml([], null),
    'https://777.slopachi-station.com/report/kita-kanto/': listingHtml(
      [{ md: '9/6', url: A1, label: 'るいべえ実践来店' }, { md: '9/6', label: 'れんじろう実践来店 (予定)' }],
      'https://777.slopachi-station.com/report/kita-kanto/page/2',
    ),
    'https://777.slopachi-station.com/report/kita-kanto/page/2': listingHtml(
      [{ md: '9/6', url: A2, label: 'るいべえ実践来店' }, { md: '1/1', url: OLD, label: 'るいべえ実践来店' }],
      'https://777.slopachi-station.com/report/kita-kanto/page/3',
    ),
    'https://777.slopachi-station.com/report/kita-kanto/page/3': listingHtml([{ md: '1/2', url: 'https://x/older/', label: 'x' }], null),
    [A1]: article,
    [A2]: article,
  };
}

function makeDeps(site: Record<string, string>, dataDir: string) {
  const fetched: string[] = [];
  const fetchHtml = vi.fn(async (url: string) => {
    fetched.push(url);
    const html = site[url];
    if (html === undefined) throw new Error(`fetch failed: ${url} (404)`);
    return html;
  });
  return { deps: { fetchHtml, today: '2026-09-15', nowIso: () => '2026-09-15T00:00:00.000Z', dataDir, log: () => {} }, fetched };
}

describe('runCrawl', () => {
  it('新規記事だけ取得し、古い一覧に達したら止まり、JSON を書く', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const { deps, fetched } = makeDeps(fakeSite(), dir);
    const r = await runCrawl(deps);

    expect(r.added).toBe(2);
    expect(fetched).toContain(A1);
    expect(fetched).toContain(A2);
    expect(fetched).not.toContain(OLD);                                        // 1/1 は 90 日より古い
    expect(fetched).toContain('https://777.slopachi-station.com/report/kita-kanto/page/3'); // 2 ページ目に期間内が 1 件あるので続く
    expect(fetched).not.toContain('https://x/older/');                         // 3 ページ目は全て古い → 記事は取らず走査終了

    const articles = JSON.parse(await readFile(join(dir, 'articles.json'), 'utf-8'));
    expect(articles.articles).toHaveLength(2);
    const machines = JSON.parse(await readFile(join(dir, 'machines.json'), 'utf-8'));
    expect(machines.machines.length).toBeGreaterThan(10);
    expect(machines.windowDays).toBe(90);
    expect(JSON.parse(await readFile(join(dir, 'errors.json'), 'utf-8'))).toEqual([]);
  });

  it('既知 URL は再取得しない', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const { deps, fetched } = makeDeps(fakeSite(), dir);
    await runCrawl(deps);
    fetched.length = 0;
    const r = await runCrawl(deps);
    expect(r.added).toBe(0);
    expect(fetched.filter((u) => u === A1 || u === A2)).toHaveLength(0);
  });

  it('90 日より古い既存記事は削除される', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    await writeArticles(join(dir, 'articles.json'), [{
      url: OLD, title: 't', visitDate: '2026-01-01', coverageType: 'x',
      store: { name: 's', prefecture: '埼玉県', city: 'c' }, results: [], fetchedAt: 'f',
    }], 'g');
    const { deps } = makeDeps(fakeSite(), dir);
    const r = await runCrawl(deps);
    expect(r.removed).toBe(1);
  });

  it('記事取得に失敗しても続行し errors.json に残す', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const site = fakeSite();
    delete site[A2];
    const { deps } = makeDeps(site, dir);
    const r = await runCrawl(deps);
    expect(r.added).toBe(1);
    expect(r.errors).toEqual([{ url: A2, reason: expect.stringContaining('404'), at: '2026-09-15T00:00:00.000Z' }]);
  });

  it('一覧取得に失敗したエリアはスキップして続行する', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const site = fakeSite();
    delete site['https://777.slopachi-station.com/report_pref/tokyo/'];
    const { deps } = makeDeps(site, dir);
    const r = await runCrawl(deps);
    expect(r.added).toBe(2);
    expect(r.errors.some((e) => e.url.includes('report_pref/tokyo'))).toBe(true);
  });

  it('全エリアの一覧取得に失敗したら例外', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const { deps } = makeDeps({}, dir); // 3 エリアすべて 404
    await expect(runCrawl(deps)).rejects.toThrow('全エリアの一覧取得に失敗しました');
  });

  it('直近 7 日以内に解析失敗した URL は再取得せず errors.json に維持する', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    await writeErrors(join(dir, 'errors.json'), [{ url: A2, reason: REASON_NO_RESULTS, at: '2026-09-15T00:00:00.000Z' }]);
    const { deps, fetched } = makeDeps(fakeSite(), dir);
    const r = await runCrawl(deps);
    expect(r.added).toBe(1);
    expect(fetched).not.toContain(A2);
    const errors = JSON.parse(await readFile(join(dir, 'errors.json'), 'utf-8'));
    expect(errors).toContainEqual({ url: A2, reason: REASON_NO_RESULTS, at: '2026-09-15T00:00:00.000Z' });
    expect(r.skipped).toBe(1);
  });

  it('7 日以上前の解析失敗 URL は再取得する', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    await writeErrors(join(dir, 'errors.json'), [{ url: A2, reason: REASON_NO_RESULTS, at: '2026-09-07T00:00:00.000Z' }]);
    const { deps, fetched } = makeDeps(fakeSite(), dir);
    await runCrawl(deps);
    expect(fetched).toContain(A2);
  });

  it('繰越の解析失敗が 10 件あっても新規失敗 0 件なら例外にならない', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const carried = Array.from({ length: 10 }, (_, i) => ({
      url: `https://777.slopachi-station.com/old-fail-${i}/`, reason: REASON_NO_RESULTS, at: '2026-09-15T00:00:00.000Z',
    }));
    await writeErrors(join(dir, 'errors.json'), carried);
    const site: Record<string, string> = {
      'https://777.slopachi-station.com/report_pref/tokyo/': listingHtml([], null),
      'https://777.slopachi-station.com/report/minami-kanto/': listingHtml([], null),
      'https://777.slopachi-station.com/report/kita-kanto/': listingHtml([], null),
    };
    const { deps } = makeDeps(site, dir);
    const r = await runCrawl(deps);
    expect(r.added).toBe(0);
    const errors = JSON.parse(await readFile(join(dir, 'errors.json'), 'utf-8'));
    expect(errors).toHaveLength(10);
  });

  it('新規 0 件かつ解析失敗 10 件以上なら例外', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const rows = Array.from({ length: 10 }, (_, i) => ({ md: '9/6', url: `https://777.slopachi-station.com/bad${i}/`, label: 'x' }));
    const site: Record<string, string> = {
      'https://777.slopachi-station.com/report_pref/tokyo/': listingHtml([], null),
      'https://777.slopachi-station.com/report/minami-kanto/': listingHtml([], null),
      'https://777.slopachi-station.com/report/kita-kanto/': listingHtml(rows, null),
    };
    for (const r of rows) site[r.url] = '<html><head><title>t</title></head><body><div class="entry col-md-12"></div></body></html>';
    const { deps } = makeDeps(site, dir);
    await expect(runCrawl(deps)).rejects.toThrow('解析失敗が多すぎます');
  });
});
