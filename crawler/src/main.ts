import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Article, CrawlError } from '../../shared/types';
import { AREAS, inferVisitDate, parseListing, type ListingEntry } from './listing';
import { parseArticle, PARSE_FAILURE_REASONS } from './parse/article';
import { createFetcher } from './fetch';
import { aggregate } from './aggregate';
import { cutoffDate, pruneOld, readArticles, readErrors, writeArticles, writeErrors, writeMachines } from './store';

export const WINDOW_DAYS = 90;
const DEFAULT_MAX_NEW = 300;
const DEFAULT_MAX_PAGES = 60;
const FAILURE_THRESHOLD = 10;
export const PARSE_FAILURE_RETRY_DAYS = 7;

export interface CrawlDeps {
  fetchHtml: (url: string) => Promise<string>;
  today: string;             // 'YYYY-MM-DD'
  nowIso: () => string;
  dataDir: string;
  maxNewArticles?: number;
  maxPagesPerArea?: number;
  log: (msg: string) => void;
}

export interface CrawlResult { added: number; removed: number; errors: CrawlError[]; total: number; skipped: number }

interface CollectedUrls { queue: string[]; areasOk: number }

async function collectNewUrls(deps: CrawlDeps, known: Set<string>, errors: CrawlError[]): Promise<CollectedUrls> {
  const cutoff = cutoffDate(deps.today, WINDOW_DAYS);
  const today = new Date(`${deps.today}T00:00:00`);
  const maxPages = deps.maxPagesPerArea ?? DEFAULT_MAX_PAGES;
  const queue: string[] = [];
  const seen = new Set<string>();
  let areasOk = 0;

  for (const area of AREAS) {
    let url: string | null = area.url;
    for (let page = 0; url && page < maxPages; page++) {
      let entries: ListingEntry[];
      let nextUrl: string | null;
      try {
        ({ entries, nextUrl } = parseListing(await deps.fetchHtml(url)));
      } catch (e) {
        errors.push({ url, reason: e instanceof Error ? e.message : String(e), at: deps.nowIso() });
        deps.log(`一覧取得失敗: ${url}`);
        break;
      }
      if (page === 0) areasOk++;
      const inWindow = entries.filter((e) => inferVisitDate(e.month, e.day, today) >= cutoff);
      for (const e of inWindow) {
        if (!known.has(e.url) && !seen.has(e.url)) { seen.add(e.url); queue.push(e.url); }
      }
      deps.log(`${area.name} p${page + 1}: ${entries.length} 件中 期間内 ${inWindow.length} 件`);
      if (entries.length > 0 && inWindow.length === 0) break;
      url = nextUrl;
    }
  }
  return { queue, areasOk };
}

export async function runCrawl(deps: CrawlDeps): Promise<CrawlResult> {
  const articlesPath = join(deps.dataDir, 'articles.json');
  const errorsPath = join(deps.dataDir, 'errors.json');
  const errors: CrawlError[] = [];

  const existing = await readArticles(articlesPath);
  const kept = pruneOld(existing, deps.today, WINDOW_DAYS);
  const removed = existing.length - kept.length;
  const known = new Set(kept.map((a) => a.url));

  // 直近 PARSE_FAILURE_RETRY_DAYS 日以内に解析失敗した URL は今回スキップし、
  // 前回のエラー内容をそのまま繰り越す（無駄な再取得と失敗閾値への誤カウントを防ぐ）。
  const previousErrors = await readErrors(errorsPath);
  const parseFailureCutoff = cutoffDate(deps.today, PARSE_FAILURE_RETRY_DAYS);
  const carried: CrawlError[] = [];
  const skipUrls = new Set<string>();
  for (const e of previousErrors) {
    if (PARSE_FAILURE_REASONS.has(e.reason) && e.at.slice(0, 10) >= parseFailureCutoff) {
      carried.push(e);
      skipUrls.add(e.url);
    }
  }

  const { queue: rawQueue, areasOk } = await collectNewUrls(deps, known, errors);
  if (areasOk === 0) {
    throw new Error('全エリアの一覧取得に失敗しました');
  }
  const skippableQueue = rawQueue.filter((u) => !skipUrls.has(u));
  const skipped = rawQueue.length - skippableQueue.length;
  const queue = skippableQueue.slice(0, deps.maxNewArticles ?? DEFAULT_MAX_NEW);
  deps.log(`新規取得対象 ${queue.length} 件（解析失敗のためスキップ ${skipped} 件）`);

  const added: Article[] = [];
  for (const url of queue) {
    try {
      const html = await deps.fetchHtml(url);
      const r = parseArticle(html, url, deps.nowIso());
      if (r.ok) added.push(r.article);
      else errors.push({ url, reason: r.reason, at: deps.nowIso() });
    } catch (e) {
      errors.push({ url, reason: e instanceof Error ? e.message : String(e), at: deps.nowIso() });
    }
  }

  const all = pruneOld([...kept, ...added], deps.today, WINDOW_DAYS);
  const generatedAt = deps.nowIso();
  await writeArticles(articlesPath, all, generatedAt);
  await writeErrors(errorsPath, [...carried, ...errors]);
  await writeMachines(join(deps.dataDir, 'machines.json'), aggregate(all), generatedAt);

  deps.log(`追加 ${added.length} / 削除 ${removed} / 失敗 ${errors.length}（繰越 ${carried.length}）/ 合計 ${all.length}`);
  if (added.length === 0 && errors.length >= FAILURE_THRESHOLD) {
    throw new Error(`解析失敗が多すぎます（${errors.length} 件）。サイト構造の変更を確認してください`);
  }
  return { added: added.length, removed, errors, total: all.length, skipped };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const dataDir = join(fileURLToPath(new URL('../../data/', import.meta.url)));
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }); // 'YYYY-MM-DD'
  runCrawl({
    fetchHtml: createFetcher(),
    today,
    nowIso: () => new Date().toISOString(),
    dataDir,
    maxNewArticles: Number(process.env['MAX_NEW_ARTICLES'] ?? DEFAULT_MAX_NEW),
    log: (m) => console.log(m),
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
