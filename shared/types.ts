export type Category = 'pachinko' | 'slot';

export interface StoreInfo {
  name: string;        // '新！ガーデン八潮'
  prefecture: string;  // '埼玉県'
  city: string;        // '八潮市'
}

export interface MachineResult {
  category: Category;
  machineKey: string;    // 'dmm:4714' | 'name:<正規化名>'
  machineName: string;   // 記事上の表記
  units: number;         // 集計対象台数
  plusUnits: number;     // プラス台数
  avgDiff: number | null;       // 平均差玉(玉) / 平均差枚(枚)。符号付き整数。記事に平均の記載が無ければ null
  unitNumbers?: string;  // スロットの台番 '604〜609' / '489,490'
  shared?: true;         // 2 機種以上が同じ集計値を共有する見出しから取った場合
}

export interface Article {
  url: string;
  title: string;
  visitDate: string;      // 'YYYY-MM-DD'
  coverageType: string;   // 'るいべえ実践来店' など
  store: StoreInfo;
  results: MachineResult[];
  fetchedAt: string;      // ISO 8601
}

export interface ShopArticleRef {
  url: string;
  visitDate: string;
  coverageType: string;
  units: number;
  plusUnits: number;
  avgDiff: number | null;
  shared?: true;
}

export interface ShopHit {
  storeName: string;
  prefecture: string;
  city: string;
  hitCount: number;
  lastVisitDate: string;
  avgDiffMean: number | null;   // 各記事 avgDiff の単純平均（四捨五入して整数）
  plusRate: number;      // Σplus / Σunits（0〜1）
  articles: ShopArticleRef[]; // visitDate 降順
}

export interface MachineSummary {
  machineKey: string;
  displayName: string;   // 最頻出表記
  category: Category;
  aliases: string[];     // displayName 以外の表記
  hitCount: number;      // 記事数
  shopCount: number;
  shops: ShopHit[];      // hitCount 降順、同数は lastVisitDate 降順
}

export interface ArticlesFile {
  generatedAt: string;
  articles: Article[];
}

export interface MachinesFile {
  generatedAt: string;
  windowDays: 90;
  machines: MachineSummary[];  // hitCount 降順
}

export interface CrawlError {
  url: string;
  reason: string;
  at: string;
}
