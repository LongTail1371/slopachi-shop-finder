import type { Category } from '../../../shared/types';

export function unitLabel(category: Category): string {
  return category === 'pachinko' ? '玉' : '枚';
}

export function formatDiff(n: number, category: Category): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '±';
  return `${sign}${Math.abs(n).toLocaleString('ja-JP')}${unitLabel(category)}`;
}

export function formatRate(r: number): string {
  return `${Math.round(r * 100)}%`;
}

export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}
