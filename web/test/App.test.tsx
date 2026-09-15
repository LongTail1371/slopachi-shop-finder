import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MachinesFile } from '../../shared/types';
import { App } from '../src/App';

const file: MachinesFile = {
  generatedAt: '2026-09-15T00:00:00.000Z', windowDays: 90,
  machines: [
    { machineKey: 'dmm:1', displayName: '真・北斗無双 第5章', category: 'pachinko', aliases: [], hitCount: 2, shopCount: 2, shops: [
      { storeName: 'A店', prefecture: '埼玉県', city: '川口市', hitCount: 1, lastVisitDate: '2026-09-01', avgDiffMean: 1000, plusRate: 0.5,
        articles: [{ url: 'https://s/1/', visitDate: '2026-09-01', coverageType: 'るいべえ実践来店', units: 2, plusUnits: 1, avgDiff: 1000 }] },
      { storeName: 'B店', prefecture: '千葉県', city: '柏市', hitCount: 1, lastVisitDate: '2026-09-02', avgDiffMean: -200, plusRate: 0,
        articles: [{ url: 'https://s/2/', visitDate: '2026-09-02', coverageType: 'スロパチステーション来店取材', units: 2, plusUnits: 0, avgDiff: -200 }] },
    ] },
    { machineKey: 'name:東京喰種', displayName: '東京喰種', category: 'slot', aliases: [], hitCount: 1, shopCount: 1, shops: [
      { storeName: 'A店', prefecture: '埼玉県', city: '川口市', hitCount: 1, lastVisitDate: '2026-09-03', avgDiffMean: 3000, plusRate: 1,
        articles: [{ url: 'https://s/3/', visitDate: '2026-09-03', coverageType: 'るいべえ実践来店', units: 6, plusUnits: 6, avgDiff: 3000 }] },
    ] },
  ],
};

function mockFetch(ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => (ok ? new Response(JSON.stringify(file), { status: 200 }) : new Response('x', { status: 500 }))));
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('読み込み後、上位機種が出て、選ぶと店舗一覧と URL が更新される', async () => {
    mockFetch();
    render(<App />);
    expect(await screen.findByRole('option', { name: /真・北斗無双 第5章/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: /真・北斗無双 第5章/ }));
    expect(screen.getByRole('heading', { level: 2, name: '真・北斗無双 第5章' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(window.location.search).toBe('?m=dmm%3A1');
  });

  it('URL の状態から復元する', async () => {
    mockFetch();
    window.history.replaceState(null, '', '/?c=slot&m=name%3A%E6%9D%B1%E4%BA%AC%E5%96%B0%E7%A8%AE');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 2, name: '東京喰種' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'スロット' })).toHaveAttribute('aria-checked', 'true');
  });

  it('都道府県で絞り込める', async () => {
    mockFetch();
    window.history.replaceState(null, '', '/?m=dmm%3A1');
    render(<App />);
    await screen.findByRole('heading', { level: 2, name: '真・北斗無双 第5章' });
    await userEvent.click(within(screen.getByRole('group', { name: '都道府県' })).getByRole('button', { name: /千葉県/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('B店')).toBeInTheDocument();
    expect(window.location.search).toContain('pref=');
  });

  it('種別を切り替えると機種選択が解除される', async () => {
    mockFetch();
    window.history.replaceState(null, '', '/?m=dmm%3A1');
    render(<App />);
    await screen.findByRole('heading', { level: 2, name: '真・北斗無双 第5章' });
    await userEvent.click(screen.getByRole('radio', { name: 'スロット' }));
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /東京喰種/ })).toBeInTheDocument();
  });

  it('店舗から探すビュー', async () => {
    mockFetch();
    render(<App />);
    await screen.findByRole('option', { name: /真・北斗無双 第5章/ });
    await userEvent.click(screen.getByRole('button', { name: '店舗から探す' }));
    await userEvent.type(screen.getByLabelText('店舗名で探す'), 'A');
    expect(screen.getByRole('button', { name: '真・北斗無双 第5章' })).toBeInTheDocument();
  });

  it('読み込み失敗の文言', async () => {
    mockFetch(false);
    render(<App />);
    expect(await screen.findByText('データを読み込めませんでした。ページを再読み込みしてください。')).toBeInTheDocument();
  });

  it('機種を選ぶと履歴が積まれ、戻ると一覧表示に戻る', async () => {
    mockFetch();
    const pushSpy = vi.spyOn(window.history, 'pushState');
    render(<App />);
    expect(await screen.findByRole('option', { name: /真・北斗無双 第5章/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: /真・北斗無双 第5章/ }));
    expect(screen.getByRole('heading', { level: 2, name: '真・北斗無双 第5章' })).toBeInTheDocument();
    expect(pushSpy).toHaveBeenCalled();

    // ブラウザの戻る操作をシミュレートする
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => expect(screen.queryByRole('heading', { level: 2, name: '真・北斗無双 第5章' })).not.toBeInTheDocument());
    expect(await screen.findByRole('option', { name: /真・北斗無双 第5章/ })).toBeInTheDocument();
  });

  it('表示切替も履歴に積まれる', async () => {
    mockFetch();
    render(<App />);
    await screen.findByRole('option', { name: /真・北斗無双 第5章/ });
    const pushSpy = vi.spyOn(window.history, 'pushState');
    await userEvent.click(screen.getByRole('button', { name: '店舗から探す' }));
    expect(pushSpy).toHaveBeenCalled();
  });

  it('絞り込みは履歴を汚さない（replaceState のみ）', async () => {
    mockFetch();
    window.history.replaceState(null, '', '/?m=dmm%3A1');
    render(<App />);
    await screen.findByRole('heading', { level: 2, name: '真・北斗無双 第5章' });
    const pushSpy = vi.spyOn(window.history, 'pushState');
    await userEvent.click(within(screen.getByRole('group', { name: '都道府県' })).getByRole('button', { name: /千葉県/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('更新日時と出典を出す', async () => {
    mockFetch();
    render(<App />);
    await waitFor(() => expect(screen.getByText(/2026年9月15日/)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'スロパチステーション' })).toHaveAttribute('href', 'https://777.slopachi-station.com/');
  });

  it('機種を選ぶと候補一覧が消え、看板が検索欄の直下に来る', async () => {
    mockFetch();
    render(<App />);
    await userEvent.click(await screen.findByRole('option', { name: /真・北斗無双 第5章/ }));
    expect(screen.getByRole('heading', { level: 2, name: '真・北斗無双 第5章' })).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('並び替えを平均差玉にすると順序と URL が変わる', async () => {
    mockFetch();
    window.history.replaceState(null, '', '/?m=dmm%3A1');
    render(<App />);
    await screen.findByRole('heading', { level: 2, name: '真・北斗無双 第5章' });
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('B店'); // 同回数なら直近が新しい B が先
    await userEvent.click(screen.getByRole('radio', { name: '平均差玉' }));
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('A店');
    expect(window.location.search).toContain('s=avg');
  });

  it('店舗一覧の上にセグメント列の凡例を出す', async () => {
    mockFetch();
    window.history.replaceState(null, '', '/?m=dmm%3A1');
    render(<App />);
    await screen.findByRole('heading', { level: 2, name: '真・北斗無双 第5章' });
    expect(screen.getByText(/左が古く右が新しい/)).toBeInTheDocument();
  });

  it('入力途中で戻ると検索語もリセットされ、上位一覧に戻る', async () => {
    mockFetch();
    window.history.replaceState(null, '', '/?m=dmm%3A1');
    render(<App />);
    await screen.findByRole('heading', { level: 2, name: '真・北斗無双 第5章' });
    await userEvent.type(screen.getByLabelText('機種名で探す'), '存在しない');
    expect(screen.getByText(/この名前の機種は/)).toBeInTheDocument();

    window.history.pushState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(await screen.findByRole('option', { name: /真・北斗無双 第5章/ })).toBeInTheDocument();
    expect(screen.getByLabelText('機種名で探す')).toHaveValue('');
  });
});
