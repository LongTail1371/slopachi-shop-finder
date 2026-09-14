import { describe, it, expect } from 'vitest';
import type { Article } from '../../shared/types';

describe('shared types', () => {
  it('Article を組み立てられる', () => {
    const a: Article = {
      url: 'https://example.test/a/',
      title: 't',
      visitDate: '2026-09-06',
      coverageType: 'るいべえ実践来店',
      store: { name: '新！ガーデン八潮', prefecture: '埼玉県', city: '八潮市' },
      results: [],
      fetchedAt: '2026-09-15T00:00:00.000Z',
    };
    expect(a.store.prefecture).toBe('埼玉県');
  });
});
