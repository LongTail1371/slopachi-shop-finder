import type { Category } from '../../../shared/types';

export function CategoryToggle({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div className="toggle" role="radiogroup" aria-label="種別">
      {(['pachinko', 'slot'] as const).map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className="toggle-item" onClick={() => onChange(c)}>
          {c === 'pachinko' ? 'パチンコ' : 'スロット'}
        </button>
      ))}
    </div>
  );
}
