import { useId } from 'react';
import type { Category, MachineSummary } from '../../../shared/types';
import { searchMachines } from '../lib/rank';

interface Props {
  machines: MachineSummary[];
  category: Category;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (machineKey: string) => void;
  windowDays: number;
}

export function MachineSearch({ machines, category, query, onQueryChange, onSelect, windowDays }: Props) {
  const id = useId();
  const candidates = searchMachines(machines, category, query);
  const isBrowsing = query.trim() === '';

  return (
    <section className="search">
      <label id={`${id}-label`} htmlFor={`${id}-input`} className="search-label">機種名で探す</label>
      <input
        id={`${id}-input`}
        className="search-input"
        type="search"
        value={query}
        placeholder="例: 北斗、エヴァ、番長"
        autoComplete="off"
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <p className="search-hint">{isBrowsing ? `直近${windowDays}日でよく取材に載った機種` : `${candidates.length}件`}</p>
      {candidates.length === 0 ? (
        <p className="empty">{`この名前の機種は直近${windowDays}日の取材に載っていません。別の表記で試してください。`}</p>
      ) : (
        <ul className="candidates" role="listbox" aria-label="機種の候補">
          {candidates.map((m) => (
            <li key={m.machineKey} role="option" aria-selected={false} className="candidate" tabIndex={0}
                onClick={() => onSelect(m.machineKey)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(m.machineKey); } }}>
              <span className="candidate-name">{m.displayName}</span>
              <span className="candidate-meta">取材{m.hitCount}件、{m.shopCount}店舗</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
