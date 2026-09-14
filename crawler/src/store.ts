import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Article, ArticlesFile, CrawlError, MachineSummary, MachinesFile } from '../../shared/types';

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

export async function readArticles(path: string): Promise<Article[]> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf-8')) as ArticlesFile;
    return parsed.articles ?? [];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

export async function writeArticles(path: string, articles: Article[], generatedAt: string): Promise<void> {
  const sorted = [...articles].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const file: ArticlesFile = { generatedAt, articles: sorted };
  await writeJson(path, file);
}

export async function writeErrors(path: string, errors: CrawlError[]): Promise<void> {
  await writeJson(path, errors);
}

export async function writeMachines(path: string, machines: MachineSummary[], generatedAt: string): Promise<void> {
  const file: MachinesFile = { generatedAt, windowDays: 90, machines };
  await writeJson(path, file);
}

export function cutoffDate(today: string, windowDays: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - windowDays);
  return d.toISOString().slice(0, 10);
}

export function pruneOld(articles: Article[], today: string, windowDays: number): Article[] {
  const cutoff = cutoffDate(today, windowDays);
  return articles.filter((a) => a.visitDate >= cutoff);
}
