import type { Category } from '../../../shared/types';
import { SORT_KEYS, type SortKey } from './rank';

export interface AppState {
  view: 'machine' | 'store';
  category: Category;
  machineKey: string | null;
  prefectures: string[];
  coverageTypes: string[];
  storeQuery: string;
  sort: SortKey;
}

export const DEFAULT_STATE: AppState = {
  view: 'machine',
  category: 'pachinko',
  machineKey: null,
  prefectures: [],
  coverageTypes: [],
  storeQuery: '',
  sort: 'count',
};

function list(v: string | null): string[] {
  return v ? v.split(',').filter(Boolean) : [];
}

export function parseState(search: string): AppState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const v = q.get('v');
  const c = q.get('c');
  const s = q.get('s');
  return {
    view: v === 'store' ? 'store' : 'machine',
    category: c === 'slot' ? 'slot' : 'pachinko',
    machineKey: q.get('m') || null,
    prefectures: list(q.get('pref')),
    coverageTypes: list(q.get('type')),
    storeQuery: q.get('shop') ?? '',
    sort: (SORT_KEYS as readonly string[]).includes(s ?? '') ? (s as SortKey) : 'count',
  };
}

export function serializeState(s: AppState): string {
  const q = new URLSearchParams();
  if (s.view !== DEFAULT_STATE.view) q.set('v', s.view);
  if (s.category !== DEFAULT_STATE.category) q.set('c', s.category);
  if (s.machineKey) q.set('m', s.machineKey);
  if (s.prefectures.length) q.set('pref', s.prefectures.join(','));
  if (s.coverageTypes.length) q.set('type', s.coverageTypes.join(','));
  if (s.storeQuery) q.set('shop', s.storeQuery);
  if (s.sort !== DEFAULT_STATE.sort) q.set('s', s.sort);
  const str = q.toString();
  return str ? `?${str}` : '';
}
