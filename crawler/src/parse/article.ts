import type { Article } from '../../../shared/types';
import { loadBody } from './body';
import { parseStoreInfo } from './storeInfo';
import { parseCoverageType } from './coverageType';
import { parsePachinko } from './pachinko';
import { parseSlot } from './slot';

export type ParseResult = { ok: true; article: Article } | { ok: false; reason: string };

export const REASON_NO_STORE_INFO = '店舗情報が見つからない';
export const REASON_NO_COVERAGE_TYPE = '取材種別が見つからない';
export const REASON_NO_RESULTS = '機種結果が 0 件';

/** parseArticle が返しうる「記事の内容自体が解析できない」失敗理由。サイト側の一時的な
 * 障害（fetch 失敗）とは区別し、日をまたいでも再取得しない対象を判定するために使う。 */
export const PARSE_FAILURE_REASONS: ReadonlySet<string> = new Set([
  REASON_NO_STORE_INFO,
  REASON_NO_COVERAGE_TYPE,
  REASON_NO_RESULTS,
]);

export function parseArticle(html: string, url: string, fetchedAt: string): ParseResult {
  const { body, title } = loadBody(html);

  const info = parseStoreInfo(body);
  if (!info) return { ok: false, reason: REASON_NO_STORE_INFO };

  const coverageType = parseCoverageType(body, title);
  if (!coverageType) return { ok: false, reason: REASON_NO_COVERAGE_TYPE };

  const results = [...parsePachinko(body), ...parseSlot(body)];
  if (results.length === 0) return { ok: false, reason: REASON_NO_RESULTS };

  return {
    ok: true,
    article: { url, title, visitDate: info.visitDate, coverageType, store: info.store, results, fetchedAt },
  };
}
