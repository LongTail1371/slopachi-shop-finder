import type { Category, ShopHit } from '../../../shared/types';
import { formatDiff, formatRate, formatShortDate } from '../lib/format';
import { ShopDetail } from './ShopDetail';

interface Props { shop: ShopHit; category: Category; open: boolean; onToggle: () => void }

export function ShopRow({ shop, category, open, onToggle }: Props) {
  const chronological = [...shop.articles].reverse();
  return (
    <li className="shop">
      <button type="button" className="shop-row" aria-expanded={open} onClick={onToggle}>
        <span className="shop-count"><b>{shop.hitCount}</b><small>回</small></span>
        <span className="shop-main">
          <span className="shop-name">{shop.storeName}</span>
          <span className="shop-place">{shop.prefecture} {shop.city}</span>
        </span>
        <span className="shop-stats">
          <span className="segs" aria-label={`取材${shop.hitCount}件のうちプラス${chronological.filter((a) => a.avgDiff !== null && a.avgDiff > 0).length}件`}>
            {chronological.map((a) => (
              <i key={a.url} className={`seg ${a.avgDiff === null ? 'none' : a.avgDiff > 0 ? 'plus' : 'minus'}`} title={`${formatShortDate(a.visitDate)} ${formatDiff(a.avgDiff, category)}`} />
            ))}
          </span>
          <span className="stat"><span className="stat-label">平均</span><span className={shop.avgDiffMean !== null && shop.avgDiffMean > 0 ? 'plus' : shop.avgDiffMean !== null && shop.avgDiffMean < 0 ? 'minus' : ''}>{formatDiff(shop.avgDiffMean, category)}</span></span>
          <span className="stat"><span className="stat-label">プラス台</span><span>{formatRate(shop.plusRate)}</span></span>
          <span className="stat"><span className="stat-label">直近</span><span>{formatShortDate(shop.lastVisitDate)}</span></span>
        </span>
      </button>
      {open && <ShopDetail shop={shop} category={category} />}
    </li>
  );
}
