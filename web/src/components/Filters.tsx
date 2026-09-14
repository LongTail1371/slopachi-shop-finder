import type { ShopFilter } from '../lib/rank';

interface Props {
  options: { prefectures: string[]; coverageTypes: string[] };
  value: ShopFilter;
  onChange: (v: ShopFilter) => void;
}

function Group({ legend, items, selected, onToggle }: { legend: string; items: string[]; selected: string[]; onToggle: (v: string) => void }) {
  if (items.length <= 1) return null;
  return (
    <fieldset className="filter-group">
      <legend>{legend}</legend>
      {items.map((it) => (
        <label key={it} className="filter-item">
          <input type="checkbox" checked={selected.includes(it)} onChange={() => onToggle(it)} />
          {it}
        </label>
      ))}
    </fieldset>
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
