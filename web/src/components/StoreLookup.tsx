import { useId } from 'react';
import type { StoreMatch } from '../lib/rank';
import { formatDiff, formatShortDate } from '../lib/format';

interface Props {
  matches: StoreMatch[];
  query: string;
  onQueryChange: (q: string) => void;
  onSelectMachine: (machineKey: string) => void;
  windowDays: number;
}

export function StoreLookup({ matches, query, onQueryChange, onSelectMachine, windowDays }: Props) {
  const id = useId();
  return (
    <section className="search">
      <label id={`${id}-label`} htmlFor={`${id}-input`} className="search-label">店舗名で探す</label>
      <input id={`${id}-input`} className="search-input" type="search" value={query} placeholder="例: 草加、マルハン" autoComplete="off"
             onChange={(e) => onQueryChange(e.target.value)} />
      {query.trim() === '' ? (
        <p className="empty">{`店舗名の一部を入れると、その店で直近${windowDays}日に取材で載った機種が出ます。`}</p>
      ) : matches.length === 0 ? (
        <p className="empty">{`この名前の店舗は直近${windowDays}日の取材にありません。`}</p>
      ) : (
        matches.map((st) => (
          <section key={`${st.prefecture}|${st.storeName}`} className="store">
            <h3 className="store-name">{st.storeName} <span className="shop-place">{st.prefecture} {st.city}</span></h3>
            <ul className="store-machines">
              {st.machines.map((m) => (
                <li key={m.machineKey}>
                  <button type="button" className="linklike" onClick={() => onSelectMachine(m.machineKey)}>{m.displayName}</button>
                  <span className="candidate-meta">{m.hitCount}回、平均 {formatDiff(m.avgDiffMean, m.category)}、直近 {formatShortDate(m.lastVisitDate)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
