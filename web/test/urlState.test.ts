import { describe, it, expect } from 'vitest';
import { parseState, serializeState, DEFAULT_STATE } from '../src/lib/urlState';

describe('urlState', () => {
  it('空クエリは既定値', () => {
    expect(parseState('')).toEqual(DEFAULT_STATE);
    expect(parseState('?')).toEqual(DEFAULT_STATE);
  });
  it('往復で一致する', () => {
    const s = { view: 'machine' as const, category: 'slot' as const, machineKey: 'name:東京喰種', prefectures: ['埼玉県', '千葉県'], coverageTypes: ['るいべえ実践来店'], storeQuery: '' };
    const q = serializeState(s);
    expect(q.startsWith('?')).toBe(true);
    expect(parseState(q)).toEqual(s);
  });
  it('既定値は省く', () => {
    expect(serializeState(DEFAULT_STATE)).toBe('');
    expect(serializeState({ ...DEFAULT_STATE, category: 'slot' })).toBe('?c=slot');
  });
  it('店舗ビュー', () => {
    expect(parseState('?v=store&shop=草加')).toMatchObject({ view: 'store', storeQuery: '草加' });
  });
  it('不正な値は既定値に落とす', () => {
    expect(parseState('?c=bogus&v=x').category).toBe('pachinko');
    expect(parseState('?c=bogus&v=x').view).toBe('machine');
  });
});
