import type { Category } from '../../../shared/types';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [{ key: 'pachinko', label: 'パチンコ' }, { key: 'slot', label: 'スロット' }] as const;

export function CategoryToggle({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return <SegmentedControl<Category> value={value} options={OPTIONS} onChange={onChange} ariaLabel="種別" />;
}
