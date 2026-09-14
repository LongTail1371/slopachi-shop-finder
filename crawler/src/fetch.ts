export const USER_AGENT = 'slopachi-shop-finder/1.0 (private use; contact: nagao.kohei@yw.mitsubishielectric.co.jp)';
const MIN_INTERVAL_MS = 1000;
const MAX_RETRIES = 3;

export interface FetchDeps {
  fetchFn: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

const defaultDeps: FetchDeps = {
  fetchFn: (input, init) => fetch(input, init),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

export function createFetcher(overrides: Partial<FetchDeps> = {}): (url: string) => Promise<string> {
  const deps = { ...defaultDeps, ...overrides };
  let lastAt = -Infinity;

  async function throttle(): Promise<void> {
    const wait = MIN_INTERVAL_MS - (deps.now() - lastAt);
    if (wait > 0) await deps.sleep(wait);
    lastAt = deps.now();
  }

  async function attempt(url: string): Promise<{ ok: true; body: string } | { ok: false; retry: boolean; detail: string }> {
    await throttle();
    try {
      const r = await deps.fetchFn(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, redirect: 'follow' });
      if (r.ok) return { ok: true, body: await r.text() };
      return { ok: false, retry: r.status >= 500, detail: String(r.status) };
    } catch (e) {
      return { ok: false, retry: true, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  return async (url: string): Promise<string> => {
    let detail = '';
    for (let i = 0; i <= MAX_RETRIES; i++) {
      if (i > 0) await deps.sleep(1000 * 2 ** (i - 1));
      const r = await attempt(url);
      if (r.ok) return r.body;
      detail = r.detail;
      if (!r.retry) break;
    }
    throw new Error(`fetch failed: ${url} (${detail})`);
  };
}
