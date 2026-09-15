import type { MachineSummary } from '../../../shared/types';
import { formatHits } from '../lib/format';

export function MachineHero({ machine, windowDays }: { machine: MachineSummary; windowDays: number }) {
  return (
    <section className="hero" aria-label="選んだ機種">
      <h2 className="hero-name">{machine.displayName}</h2>
      <p className="hero-meta">直近{windowDays}日で{formatHits(machine.hitCount, machine.shopCount)}</p>
      {machine.aliases.length > 0 && <p className="hero-aliases">記事上の別表記: {machine.aliases.join('、')}</p>}
    </section>
  );
}
