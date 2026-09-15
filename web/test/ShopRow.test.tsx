import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShopHit } from '../../shared/types';
import { ShopRow } from '../src/components/ShopRow';

const shop: ShopHit = {
  storeName: 'ピーアーク草加', prefecture: '埼玉県', city: '草加市', hitCount: 3, lastVisitDate: '2026-09-13',
  avgDiffMean: 4620, plusRate: 0.667,
  articles: [
    { url: 'https://s/3/', visitDate: '2026-09-13', coverageType: 'るいべえ実践来店', units: 3, plusUnits: 2, avgDiff: 13700 },
    { url: 'https://s/2/', visitDate: '2026-09-06', coverageType: 'スロぱちガール来店PS', units: 4, plusUnits: 1, avgDiff: -1830 },
    { url: 'https://s/1/', visitDate: '2026-08-30', coverageType: 'るいべえ実践来店', units: 2, plusUnits: 2, avgDiff: 2000 },
  ],
};

describe('ShopRow', () => {
  it('回数・店舗名・所在地・平均・プラス台率・直近日を出す', () => {
    render(<ul><ShopRow shop={shop} category="pachinko" open={false} onToggle={() => {}} /></ul>);
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('ピーアーク草加')).toBeInTheDocument();
    expect(within(row).getByText('埼玉県 草加市')).toBeInTheDocument();
    expect(within(row).getByText('+4,620玉')).toBeInTheDocument();
    expect(within(row).getByText('67%')).toBeInTheDocument();
    expect(within(row).getByText('9/13')).toBeInTheDocument();
  });

  it('セグメントは記事数ぶん、古い順に赤青が付く', () => {
    render(<ul><ShopRow shop={shop} category="pachinko" open={false} onToggle={() => {}} /></ul>);
    const segs = screen.getByRole('listitem').querySelectorAll('.seg');
    expect(segs).toHaveLength(3);
    expect(segs[0]).toHaveClass('plus');   // 8/30 +2000
    expect(segs[1]).toHaveClass('minus');  // 9/6 -1830
    expect(segs[2]).toHaveClass('plus');   // 9/13 +13700
  });

  it('各セグメントに日付と差玉の読み上げラベルが付く', () => {
    render(<ul><ShopRow shop={shop} category="pachinko" open={false} onToggle={() => {}} /></ul>);
    const segs = screen.getByRole('listitem').querySelectorAll('.seg');
    expect(segs[0]).toHaveAttribute('aria-label', '8/30 +2,000玉');
    expect(segs[1]).toHaveAttribute('aria-label', '9/6 -1,830玉');
  });

  it('平均が 0 のときは色クラスを付けない（中立表示）', () => {
    const neutralShop: ShopHit = { ...shop, avgDiffMean: 0 };
    render(<ul><ShopRow shop={neutralShop} category="pachinko" open={false} onToggle={() => {}} /></ul>);
    const row = screen.getByRole('listitem');
    const avgValue = within(row).getByText('±0玉');
    expect(avgValue).not.toHaveClass('plus');
    expect(avgValue).not.toHaveClass('minus');
  });

  it('avgDiff が null の記事は seg none クラスになり plus/minus は付かない', () => {
    const withNull: ShopHit = {
      ...shop,
      articles: [
        ...shop.articles,
        { url: 'https://s/4/', visitDate: '2026-08-20', coverageType: 'るいべえ実践来店', units: 5, plusUnits: 3, avgDiff: null },
      ],
    };
    render(<ul><ShopRow shop={withNull} category="pachinko" open={false} onToggle={() => {}} /></ul>);
    const segs = screen.getByRole('listitem').querySelectorAll('.seg');
    expect(segs).toHaveLength(4);
    const noneSeg = segs[0]!;
    expect(noneSeg).toHaveClass('none');
    expect(noneSeg).not.toHaveClass('plus');
    expect(noneSeg).not.toHaveClass('minus');
  });

  it('avgDiffMean が null の店舗は — を表示する', () => {
    const nullMeanShop: ShopHit = { ...shop, avgDiffMean: null };
    render(<ul><ShopRow shop={nullMeanShop} category="pachinko" open={false} onToggle={() => {}} /></ul>);
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('—')).toBeInTheDocument();
  });

  it('開くと記事一覧と元記事リンクが出る', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ul><ShopRow shop={shop} category="pachinko" open={false} onToggle={onToggle} /></ul>);
    await userEvent.click(screen.getByRole('button', { expanded: false }));
    expect(onToggle).toHaveBeenCalled();
    rerender(<ul><ShopRow shop={shop} category="pachinko" open={true} onToggle={onToggle} /></ul>);
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: '元記事' });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', 'https://s/3/');
    expect(screen.getByText('2026年9月6日')).toBeInTheDocument();
  });
});
