import type { Category } from '../../../shared/types';
import { SORT_KEYS, type SortKey } from '../lib/rank';
import { SegmentedControl } from './SegmentedControl';

interface Props { value: SortKey; onChange: (k: SortKey) => void; category: Category }

function label(key: SortKey, category: Category): string {
  switch (key) {
    case 'count': return '回数';
    case 'avg': return category === 'slot' ? '平均差枚' : '平均差玉';
    case 'plusRate': return 'プラス台率';
    case 'recent': return '直近訪問';
  }
}

export function SortControl({ value, onChange, category }: Props) {
  const options = SORT_KEYS.map((k) => ({ key: k, label: label(k, category) }));
  return (
    <div className="sort">
      <span className="sort-label">並び順</span>
      <SegmentedControl<SortKey> value={value} options={options} onChange={onChange} ariaLabel="並び順" />
    </div>
  );
}
