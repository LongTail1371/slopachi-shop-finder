import { useEffect, useMemo, useState } from 'react';
import type { MachinesFile } from '../../shared/types';
import { CategoryToggle } from './components/CategoryToggle';
import { MachineSearch } from './components/MachineSearch';
import { MachineHero } from './components/MachineHero';
import { Filters } from './components/Filters';
import { ShopRow } from './components/ShopRow';
import { StoreLookup } from './components/StoreLookup';
import { availableFilters, filterShops, lookupStores } from './lib/rank';
import { parseState, serializeState, type AppState } from './lib/urlState';
import { formatDate } from './lib/format';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: MachinesFile };

function useMachinesFile(): Load {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}machines.json`, { cache: 'no-cache' })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as MachinesFile;
      })
      .then((data) => { if (alive) setLoad({ status: 'ready', data }); })
      .catch(() => { if (alive) setLoad({ status: 'error' }); });
    return () => { alive = false; };
  }, []);
  return load;
}

type HistoryMode = 'push' | 'replace';

function useUrlState(): [AppState, (next: AppState, mode?: HistoryMode) => void] {
  const [state, setState] = useState<AppState>(() => parseState(window.location.search));
  useEffect(() => {
    const onPop = () => setState(parseState(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const update = (next: AppState, mode: HistoryMode = 'replace') => {
    setState(next);
    const q = serializeState(next);
    const url = `${window.location.pathname}${q}`;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  };
  return [state, update];
}

export function App() {
  const load = useMachinesFile();
  const [state, setState] = useUrlState();
  const [query, setQuery] = useState('');
  const [openShop, setOpenShop] = useState<string | null>(null);

  useEffect(() => {
    setOpenShop(null);
  }, [state.machineKey, state.category, state.view]);

  const machines = load.status === 'ready' ? load.data.machines : [];
  const machine = useMemo(() => machines.find((m) => m.machineKey === state.machineKey) ?? null, [machines, state.machineKey]);
  const options = useMemo(() => (machine ? availableFilters(machine) : { prefectures: [], coverageTypes: [] }), [machine]);
  const shops = useMemo(() => (machine ? filterShops(machine, { prefectures: state.prefectures, coverageTypes: state.coverageTypes }) : []), [machine, state.prefectures, state.coverageTypes]);
  const storeMatches = useMemo(() => lookupStores(machines, state.storeQuery, state.category), [machines, state.storeQuery, state.category]);

  const selectMachine = (machineKey: string) => {
    const target = machines.find((m) => m.machineKey === machineKey);
    setState({ ...state, view: 'machine', category: target?.category ?? state.category, machineKey, prefectures: [], coverageTypes: [] }, 'push');
  };

  return (
    <div className="page">
      <header className="top">
        <h1>スロパチ取材 店さがし</h1>
        <nav className="top-nav" aria-label="表示">
          <CategoryToggle value={state.category} onChange={(c) => { setQuery(''); setState({ ...state, category: c, machineKey: null, prefectures: [], coverageTypes: [] }); }} />
          {state.view === 'machine'
            ? <button type="button" className="linklike" onClick={() => setState({ ...state, view: 'store' }, 'push')}>店舗から探す</button>
            : <button type="button" className="linklike" onClick={() => setState({ ...state, view: 'machine', storeQuery: '' }, 'push')}>機種から探す</button>}
        </nav>
      </header>

      {load.status === 'loading' && <p className="empty">読み込み中です。</p>}
      {load.status === 'error' && <p className="empty">データを読み込めませんでした。ページを再読み込みしてください。</p>}

      {load.status === 'ready' && state.view === 'store' && (
        <StoreLookup matches={storeMatches} query={state.storeQuery} onQueryChange={(q) => setState({ ...state, storeQuery: q })} onSelectMachine={selectMachine} />
      )}

      {load.status === 'ready' && state.view === 'machine' && (
        <>
          <MachineSearch machines={machines} category={state.category} query={query} onQueryChange={setQuery} onSelect={selectMachine} />
          {state.machineKey && !machine && (
            <p className="empty">この機種は直近{load.data.windowDays}日の取材に載っていません。別の機種を選んでください。</p>
          )}
          {machine && (
            <>
              <MachineHero machine={machine} windowDays={load.data.windowDays} />
              <Filters options={options} value={{ prefectures: state.prefectures, coverageTypes: state.coverageTypes }}
                       onChange={(v) => setState({ ...state, prefectures: v.prefectures, coverageTypes: v.coverageTypes })} />
              {shops.length === 0
                ? <p className="empty">この条件に合う店舗はありません。絞り込みを外してください。</p>
                : (
                  <ol className="shops">
                    {shops.map((s) => {
                      const key = `${s.prefecture}|${s.storeName}`;
                      return <ShopRow key={key} shop={s} category={machine.category} open={openShop === key} onToggle={() => setOpenShop(openShop === key ? null : key)} />;
                    })}
                  </ol>
                )}
            </>
          )}
        </>
      )}

      {load.status === 'ready' && (
        <footer className="foot">
          <p>データ更新: {formatDate(load.data.generatedAt.slice(0, 10))}。直近{load.data.windowDays}日の取材結果を集計しています。</p>
          <p>出典: <a href="https://777.slopachi-station.com/" target="_blank" rel="noopener">スロパチステーション</a>。数値は各記事の記載に基づきます。私的利用のためのページです。</p>
        </footer>
      )}
    </div>
  );
}
