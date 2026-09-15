import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MachineSummary } from '../../shared/types';
import { MachineSearch } from '../src/components/MachineSearch';

function m(key: string, displayName: string, hitCount: number, category: 'pachinko' | 'slot' = 'pachinko'): MachineSummary {
  return { machineKey: key, displayName, category, aliases: [], hitCount, shopCount: 1, shops: [] };
}
const machines = [m('dmm:1', '真・北斗無双 第5章', 9), m('dmm:2', '押忍！番長 漢の頂', 5), m('name:喰種', '東京喰種', 7, 'slot')];

describe('MachineSearch', () => {
  it('空入力では種別内の上位機種を候補に出す', () => {
    render(<MachineSearch machines={machines} category="pachinko" query="" onQueryChange={() => {}} onSelect={() => {}} windowDays={90} />);
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('真・北斗無双 第5章'), expect.stringContaining('押忍！番長 漢の頂')]);
  });

  it('入力で候補が絞られ、選ぶと onSelect が呼ばれる', async () => {
    const onSelect = vi.fn();
    render(<MachineSearch machines={machines} category="pachinko" query="番長" onQueryChange={() => {}} onSelect={onSelect} windowDays={90} />);
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.click(screen.getByRole('option'));
    expect(onSelect).toHaveBeenCalledWith('dmm:2');
  });

  it('該当なしの文言', () => {
    render(<MachineSearch machines={machines} category="pachinko" query="存在しない" onQueryChange={() => {}} onSelect={() => {}} windowDays={90} />);
    expect(screen.getByText('この名前の機種は直近90日の取材に載っていません。別の表記で試してください。')).toBeInTheDocument();
  });

  it('windowDays を反映する', () => {
    render(<MachineSearch machines={machines} category="pachinko" query="存在しない" onQueryChange={() => {}} onSelect={() => {}} windowDays={30} />);
    expect(screen.getByText('この名前の機種は直近30日の取材に載っていません。別の表記で試してください。')).toBeInTheDocument();
  });

  it('候補行は機種名と、取材件数・店舗数を別々に出す', () => {
    render(<MachineSearch machines={machines} category="pachinko" query="" onQueryChange={() => {}} onSelect={() => {}} windowDays={90} />);
    expect(screen.getByText('取材9件・1店舗')).toBeInTheDocument();
  });

  it('機種を選択中で空入力なら候補を隠し、「上位20機種を見る」で開く', async () => {
    render(<MachineSearch machines={machines} category="pachinko" query="" onQueryChange={() => {}} onSelect={() => {}} windowDays={90} selected />);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('別の機種を探すには名前を入力')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '上位20機種を見る' }));
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('機種を選択中でも入力があれば候補を出す', () => {
    render(<MachineSearch machines={machines} category="pachinko" query="番長" onQueryChange={() => {}} onSelect={() => {}} windowDays={90} selected />);
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
});
