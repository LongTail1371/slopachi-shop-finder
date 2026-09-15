import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Filters } from '../src/components/Filters';

const options = {
  prefectures: [{ value: '埼玉県', count: 5 }, { value: '千葉県', count: 2 }],
  coverageTypes: [{ value: 'るいべえ実践来店', count: 4 }, { value: 'スロパチステーション来店取材', count: 3 }],
};

describe('Filters', () => {
  it('件数付きのトグルボタンで出し、選択状態を aria-pressed で示す', () => {
    render(<Filters options={options} value={{ prefectures: ['千葉県'], coverageTypes: [] }} onChange={() => {}} />);
    const chiba = screen.getByRole('button', { name: /千葉県/ });
    expect(chiba).toHaveAttribute('aria-pressed', 'true');
    expect(chiba).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /埼玉県/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('押すと選択が切り替わって onChange が呼ばれる', async () => {
    const onChange = vi.fn();
    render(<Filters options={options} value={{ prefectures: ['千葉県'], coverageTypes: [] }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /埼玉県/ }));
    expect(onChange).toHaveBeenCalledWith({ prefectures: ['千葉県', '埼玉県'], coverageTypes: [] });
    await userEvent.click(screen.getByRole('button', { name: /千葉県/ }));
    expect(onChange).toHaveBeenCalledWith({ prefectures: [], coverageTypes: [] });
  });

  it('選択肢が 1 つしかない群は出さない', () => {
    render(<Filters options={{ ...options, prefectures: [{ value: '埼玉県', count: 5 }] }} value={{ prefectures: [], coverageTypes: [] }} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /埼玉県/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /るいべえ実践来店/ })).toBeInTheDocument();
  });
});
