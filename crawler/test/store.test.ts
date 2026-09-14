import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Article } from '../../shared/types';
import { readArticles, writeArticles, pruneOld, cutoffDate, writeErrors, readErrors } from '../src/store';

function art(url: string, visitDate: string): Article {
  return {
    url, title: 't', visitDate, coverageType: 'x',
    store: { name: 's', prefecture: '埼玉県', city: 'c' }, results: [], fetchedAt: '2026-09-15T00:00:00.000Z',
  };
}

describe('store', () => {
  it('無いファイルは空配列', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'store-'));
    expect(await readArticles(join(dir, 'none.json'))).toEqual([]);
  });

  it('書いて読める。url 昇順で並ぶ', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'store-'));
    const p = join(dir, 'articles.json');
    await writeArticles(p, [art('https://b/', '2026-09-01'), art('https://a/', '2026-09-02')], '2026-09-15T00:00:00.000Z');
    const back = await readArticles(p);
    expect(back.map((a) => a.url)).toEqual(['https://a/', 'https://b/']);
    const raw = await readFile(p, 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(JSON.parse(raw).generatedAt).toBe('2026-09-15T00:00:00.000Z');
  });

  it('errors.json を書く', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'store-'));
    const p = join(dir, 'errors.json');
    await writeErrors(p, [{ url: 'u', reason: 'r', at: 't' }]);
    expect(JSON.parse(await readFile(p, 'utf-8'))).toEqual([{ url: 'u', reason: 'r', at: 't' }]);
  });

  it('errors.json を書いて読める', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'store-'));
    const p = join(dir, 'errors.json');
    await writeErrors(p, [{ url: 'u', reason: 'r', at: 't' }]);
    expect(await readErrors(p)).toEqual([{ url: 'u', reason: 'r', at: 't' }]);
  });

  it('無い errors.json は空配列', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'store-'));
    expect(await readErrors(join(dir, 'none.json'))).toEqual([]);
  });
});

describe('cutoffDate / pruneOld', () => {
  it('90 日前の日付', () => {
    expect(cutoffDate('2026-09-15', 90)).toBe('2026-06-17');
  });
  it('境界日は残し、その前日は落とす', () => {
    const kept = pruneOld([art('a', '2026-06-17'), art('b', '2026-06-16'), art('c', '2026-09-15')], '2026-09-15', 90);
    expect(kept.map((a) => a.url)).toEqual(['a', 'c']);
  });
});
