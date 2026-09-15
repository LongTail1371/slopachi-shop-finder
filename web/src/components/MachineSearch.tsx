import { useId, useState } from 'react';
import type { Category, MachineSummary } from '../../../shared/types';
import { searchMachines } from '../lib/rank';
import { formatHits } from '../lib/format';

interface Props {
  machines: MachineSummary[];
  category: Category;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (machineKey: string) => void;
  windowDays: number;
  /** 機種を選択中なら、空入力時の上位一覧を折りたたむ */
  selected?: boolean;
}

export function MachineSearch({ machines, category, query, onQueryChange, onSelect, windowDays, selected = false }: Props) {
  const id = useId();
  const [showTop, setShowTop] = useState(false);
  const candidates = searchMachines(machines, category, query);
  const isBrowsing = query.trim() === '';
  const collapsed = isBrowsing && selected && !showTop;

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
      <div className="search-hint">
        {isBrowsing && selected
          ? (
            <>
              <span>別の機種を探すには名前を入力</span>
              <button type="button" className="linklike" aria-expanded={showTop} onClick={() => setShowTop(!showTop)}>
                {showTop ? '候補を閉じる' : '上位20機種を見る'}
              </button>
            </>
          )
          : <span>{isBrowsing ? `直近${windowDays}日でよく取材に載った機種` : `${candidates.length}件`}</span>}
      </div>
      {collapsed ? null : candidates.length === 0 ? (
        <p className="empty">{`この名前の機種は直近${windowDays}日の取材に載っていません。別の表記で試してください。`}</p>
      ) : (
        <ul className="candidates" role="listbox" aria-label="機種の候補">
          {candidates.map((m) => (
            <li key={m.machineKey} role="option" aria-selected={false} className="candidate" tabIndex={0}
                onClick={() => onSelect(m.machineKey)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(m.machineKey); } }}>
              <span className="candidate-name">{m.displayName}</span>
              <span className="candidate-meta">{formatHits(m.hitCount, m.shopCount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
