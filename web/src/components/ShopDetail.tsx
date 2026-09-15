import type { Category, ShopHit } from '../../../shared/types';
import { formatDate, formatDiff } from '../lib/format';

export function ShopDetail({ shop, category }: { shop: ShopHit; category: Category }) {
  return (
    <div className="detail-wrap">
    <table className="detail">
      <thead>
        <tr><th>訪問日</th><th>取材</th><th>台数</th><th>プラス台</th><th>平均</th><th></th></tr>
      </thead>
      <tbody>
        {shop.articles.map((a) => (
          <tr key={a.url}>
            <td>{formatDate(a.visitDate)}</td>
            <td>{a.coverageType}</td>
            <td className="num">{a.units}台{a.shared ? '（他機種と合算）' : ''}</td>
            <td className="num">{a.plusUnits}台</td>
            <td className={`num ${a.avgDiff !== null && a.avgDiff > 0 ? 'plus' : a.avgDiff !== null && a.avgDiff < 0 ? 'minus' : ''}`}>{formatDiff(a.avgDiff, category)}</td>
            <td><a href={a.url} target="_blank" rel="noopener">元記事</a></td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
