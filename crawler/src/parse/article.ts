import type { Article } from '../../../shared/types';
import { loadBody } from './body';
import { parseStoreInfo } from './storeInfo';
import { parseCoverageType } from './coverageType';
import { parsePachinko } from './pachinko';
import { parseSlot } from './slot';

export type ParseResult = { ok: true; article: Article } | { ok: false; reason: string };

export function parseArticle(html: string, url: string, fetchedAt: string): ParseResult {
  const { body, title } = loadBody(html);

  const info = parseStoreInfo(body);
  if (!info) return { ok: false, reason: '店舗情報が見つからない' };

  const coverageType = parseCoverageType(body, title);
  if (!coverageType) return { ok: false, reason: '取材種別が見つからない' };

  const results = [...parsePachinko(body), ...parseSlot(body)];
  if (results.length === 0) return { ok: false, reason: '機種結果が 0 件' };

  return {
    ok: true,
    article: { url, title, visitDate: info.visitDate, coverageType, store: info.store, results, fetchedAt },
  };
}
