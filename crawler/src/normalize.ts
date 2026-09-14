import { toHalfWidth } from './text';

export const EXCLUDED_HEADINGS: ReadonlySet<string> = new Set(['バラエティ', 'その他', '総括', '今後のスケジュール']);

export function normalizeMachineName(raw: string): string {
  return toHalfWidth(raw)
    .replace(/\s+/g, '')
    .replace(/ver\./gi, 'ver.')
    .replace(/[・･\-‐－]/g, '')
    .toLowerCase();
}

export function machineKeyFor(raw: string, dmmId: string | null): string {
  return dmmId ? `dmm:${dmmId}` : `name:${normalizeMachineName(raw)}`;
}

export function isExcludedMachineName(raw: string): boolean {
  return EXCLUDED_HEADINGS.has(raw.trim());
}
