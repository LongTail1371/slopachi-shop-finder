import { describe, it, expect, vi } from 'vitest';
import { createFetcher, USER_AGENT } from '../src/fetch';

function res(status: number, body = 'ok'): Response {
  return new Response(body, { status });
}

describe('createFetcher', () => {
  it('UA を付けて本文を返す', async () => {
    const fetchFn = vi.fn(async () => res(200, '<html>x</html>'));
    const sleep = vi.fn(async () => {});
    const f = createFetcher({ fetchFn, sleep, now: () => 0 });
    await expect(f('https://a.test/')).resolves.toBe('<html>x</html>');
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(USER_AGENT);
  });

  it('前回から 1 秒未満なら待つ', async () => {
    let t = 0;
    const fetchFn = vi.fn(async () => res(200));
    const sleep = vi.fn(async (ms: number) => { t += ms; });
    const f = createFetcher({ fetchFn, sleep, now: () => t });
    await f('https://a.test/1');
    t += 300;
    await f('https://a.test/2');
    expect(sleep).toHaveBeenCalledWith(700);
  });

  it('5xx は 3 回まで再試行して成功を返す', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(502))
      .mockResolvedValueOnce(res(200, 'fine'));
    const sleep = vi.fn(async () => {});
    const f = createFetcher({ fetchFn, sleep, now: () => 0 });
    await expect(f('https://a.test/')).resolves.toBe('fine');
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('4 回目も失敗なら例外', async () => {
    const fetchFn = vi.fn(async () => res(500));
    const f = createFetcher({ fetchFn, sleep: async () => {}, now: () => 0 });
    await expect(f('https://a.test/')).rejects.toThrow('fetch failed: https://a.test/ (500)');
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('404 は再試行しない', async () => {
    const fetchFn = vi.fn(async () => res(404));
    const f = createFetcher({ fetchFn, sleep: async () => {}, now: () => 0 });
    await expect(f('https://a.test/')).rejects.toThrow('(404)');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('ネットワーク例外は再試行し、成功すれば本文を返す', async () => {
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(res(200, 'recovered'));
    const sleep = vi.fn(async () => {});
    const f = createFetcher({ fetchFn, sleep, now: () => 0 });
    await expect(f('https://a.test/')).resolves.toBe('recovered');
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });
});
