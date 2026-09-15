import type { FilterOption, ShopFilter } from '../lib/rank';

interface Props {
  options: { prefectures: FilterOption[]; coverageTypes: FilterOption[] };
  value: ShopFilter;
  onChange: (v: ShopFilter) => void;
}

function Group({ legend, items, selected, onToggle }: { legend: string; items: FilterOption[]; selected: string[]; onToggle: (v: string) => void }) {
  if (items.length <= 1) return null;
  return (
    <div className="filter-group" role="group" aria-label={legend}>
      <span className="filter-legend">{legend}</span>
      <div className="chips">
        {items.map((it) => (
          <button key={it.value} type="button" className="chip" aria-pressed={selected.includes(it.value)} onClick={() => onToggle(it.value)}>
            {it.value}<span className="chip-count">{it.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Filters({ options, value, onChange }: Props) {
  const toggle = (key: keyof ShopFilter) => (v: string) => {
    const cur = value[key];
    onChange({ ...value, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  return (
    <div className="filters">
      <Group legend="都道府県" items={options.prefectures} selected={value.prefectures} onToggle={toggle('prefectures')} />
      <Group legend="取材種別" items={options.coverageTypes} selected={value.coverageTypes} onToggle={toggle('coverageTypes')} />
    </div>
  );
}
