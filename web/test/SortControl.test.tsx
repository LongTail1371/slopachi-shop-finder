import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SortControl } from '../src/components/SortControl';

describe('SortControl', () => {
  it('4 つの並び順をラジオで出し、現在値に aria-checked を付ける', () => {
    render(<SortControl value="count" category="pachinko" onChange={() => {}} />);
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['回数', '平均差玉', 'プラス台率', '直近訪問']);
    expect(screen.getByRole('radio', { name: '回数' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '平均差玉' })).toHaveAttribute('aria-checked', 'false');
  });

  it('選ぶと onChange にキーが渡る', async () => {
    const onChange = vi.fn();
    render(<SortControl value="count" category="pachinko" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'プラス台率' }));
    expect(onChange).toHaveBeenCalledWith('plusRate');
  });

  it('矢印キーで隣の並び順に移り、選択中のものだけが Tab 停止になる', async () => {
    const onChange = vi.fn();
    render(<SortControl value="avg" category="pachinko" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: '平均差玉' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: '回数' })).toHaveAttribute('tabindex', '-1');
    screen.getByRole('radio', { name: '平均差玉' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('plusRate');
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('count');
  });

  it('スロットでは平均差枚と表示する', () => {
    render(<SortControl value="count" category="slot" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: '平均差枚' })).toBeInTheDocument();
  });
});
