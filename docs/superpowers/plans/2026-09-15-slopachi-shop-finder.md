# スロパチ取材 店さがし 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スロパチステーションの関東 3 エリアの取材結果を毎日収集し、機種を選ぶとピックアップ回数順に店舗が並ぶ静的サイトを GitHub Pages に公開する。

**Architecture:** `crawler/`（Node + TypeScript）が一覧 → 記事を差分取得し `data/articles.json` を正データとして保持、`aggregate` が `data/machines.json` を派生生成する。`web/`（Vite + React）は `machines.json` を実行時に読み込み、検索・絞り込み・並び替えをブラウザ内で行う。GitHub Actions が毎日クロール → コミット → ビルド → Pages デプロイを行う。

**Tech Stack:** Node 24（native fetch）、pnpm workspace、TypeScript 5、cheerio 1.x、tsx、Vitest 3、React 19、Vite 6、@testing-library/react、GitHub Actions（actions/deploy-pages）。

**Spec:** `docs/superpowers/specs/2026-09-15-slopachi-shop-finder-design.md`

## Global Constraints

- 対象一覧 URL は次の 3 本のみ: `https://777.slopachi-station.com/report_pref/tokyo/`、`https://777.slopachi-station.com/report/minami-kanto/`、`https://777.slopachi-station.com/report/kita-kanto/`。ページ送りは `.../page/N`。
- 収集期間は「訪問日が実行日から 90 日以内」。90 日より古い記事は `articles.json` から削除する。
- リクエスト間隔 1 秒以上、並列取得なし、リトライ 3 回（指数バックオフ）。User-Agent は `slopachi-shop-finder/1.0 (private use; contact: nagao.kohei@yw.mitsubishielectric.co.jp)`。
- 1 回の実行で新規取得する記事は最大 300 件。
- 保存するのは店舗名・日付・数値・元記事 URL のみ。記事本文・画像は保存しない。
- 画面は `<meta name="robots" content="noindex">` を付ける。
- 用語は「取材」「店舗」「機種」「平均差玉」「平均差枚」「プラス台」で統一する。英字大文字ラベル、中黒区切り、カード UI、角丸、影、グラデーションは使わない。
- コミットメッセージは `<type>: <description>` 形式（feat / fix / refactor / docs / test / chore / ci）。
- すべてのテストはネットワークに出ない。fetch はモックする。
- 各タスクの最後に `pnpm test` が緑であることを確認してからコミットする。

## 調査で確定した HTML 構造（パーサ実装の根拠）

記事本文は `div.entry.col-md-12` の中。以下は実記事から抜いた構造。

**店舗情報表**（本文冒頭の `<table>` 内 `<td>`。`<br>` 区切り、ラベル後に `&nbsp;`）
```html
<td style="padding-left: 8px; vertical-align: top">
 店舗:&nbsp; 新！ガーデン八潮<br>
 訪問日:&nbsp;2026/09/06 <br>
 地域:&nbsp;埼玉県 八潮市 <br>
 設置台数:&nbsp;パチンコ 400台 / スロット 600台<br>
 営業時間:&nbsp;10:00~22:40<br>
</td>
```

**取材種別**（本文最初の `<h2>` の直後）
```html
<h2><strong>9月6日 新！ガーデン八潮(埼玉県)</strong></h2>
<p><strong>【るいべえ実践来店】</strong></p>
```

**パチンコ機種セクション**（`<h4>` は `＜列①＞` 接頭辞が付くことがある。DMM リンクが無い見出し「【バラエティ】」もある）
```html
<div>
 <h4>＜列①＞【アクセル・ワールド】</h4>
 <p><img ...></p>
 <pre>全3台中、2台がプラス（67%)</pre>
 <pre>平均差玉数:+13,700玉</pre>
 <p><a href="https://p-town.dmm.com/machines/5051">【アクセル・ワールド】<br> 機種情報はこちら</a></p>
</div>
```

**スロット形式 A**（台番号ごとの表。1 表に複数機種が混ざることがある）
```html
<h2><strong>（489～494）</strong></h2>
<table>
 <tr><th>台番号</th><th>機種</th><th>回転数</th><th>差枚</th></tr>
 <tr><td>489</td><td>戦コレ6</td><td>7,570G</td><td>-730枚</td></tr>
 <tr><td>494</td><td>防振り</td><td>7,100G</td><td>+4,110枚</td></tr>
</table>
```

**スロット形式 B**（機種見出し + 縦持ち集計表。見出しに 2 機種が並ぶことがある）
```html
<h2><strong>【東京喰種 361〜366】<br></strong><strong>勝率100%！平均差枚数+6,950枚！</strong></h2>
<p><strong>【東京喰種 361〜366】</strong></p>
<table>
 <tr><th>プラス台</th><td><strong>6台/6台</strong></td></tr>
 <tr><th>勝率</th><td>100.0%</td></tr>
 <tr><th>平均回転数</th><td>8,940G</td></tr>
 <tr><th>平均差枚数</th><td>+6,950枚</td></tr>
 <tr><th>出玉率</th><td>120.1%</td></tr>
</table>
<!-- 2 機種の例 -->
<h2><strong>【からくり2 451】<br>【スマスロゴッド 452,453】</strong><strong>勝率100%！平均差枚数+7,600枚！</strong></h2>
```

**一覧ページ**（`section#archiveReporList` 内。記事があるものだけ `<a>` を持つ。年は無い）
```html
<div class="resultRow resultRow-tile kantou_area">
 <div class="resultRow-box"><div class="resultRow-detail">
  9/13 ( <div class="week0">日</div> ) 【埼玉県草加市】<br>
  <a href="https://777.slopachi-station.com/%e3%80%90...ps%ef%bc%81sao2/">
   <svg ...></svg> スロぱちガール来店PS &nbsp;&nbsp;ピーアーク草加
  </a>
 </div></div>
</div>
<!-- 予定のみ（リンク無し） -->
<div class="resultRow-detail"> 9/13 ( <div class="week0">日</div> ) 【群馬県前橋市】<br> れんじろう実践来店 (予定) &nbsp;&nbsp;マルハンメガシティ前橋インター </div>
<!-- ページ送り -->
<div class="pagingBox"> ... <a class="next page-numbers" href="https://777.slopachi-station.com/report/kita-kanto/page/2">次へ »</a></div>
```

フィクスチャは `crawler/test/fixtures/` に配置済み:

| ファイル | 内容 |
|---|---|
| `article-ruibee-2026-09-06.html` | るいべえ実践来店。新！ガーデン八潮（埼玉県 八潮市）。スロット形式 A（11 表）＋パチンコ（バラエティ含む、DMM リンクあり） |
| `article-girlps-2026-09-13.html` | スロぱちガール来店PS。ピーアーク草加（埼玉県 草加市）。スロット形式 B（9 群）＋パチンコ「＜列①＞」接頭辞あり |
| `article-station-2026-09-11.html` | スロパチステーション来店取材。ピーアーク草加。スロット形式 B のみ、2 機種混在見出しが 2 群、パチンコ無し |
| `listing-kita-kanto-p1.html` | 北関東一覧 1 ページ目。40 行中 21 行にリンク。「(予定)」行あり。`a.next` あり |

## ファイル構成

```
パチンコ系/
├─ package.json                  pnpm workspace ルート。test / crawl / build スクリプト
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ shared/
│  └─ types.ts                   Article / MachineResult / MachineSummary / ShopHit（crawler と web が共用）
├─ crawler/
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ vitest.config.ts
│  ├─ src/
│  │  ├─ text.ts                 文字列ユーティリティ（数値・空白・全角半角）
│  │  ├─ normalize.ts            機種名正規化と machineKey 決定
│  │  ├─ parse/
│  │  │  ├─ body.ts              記事 HTML → 本文 cheerio ルート
│  │  │  ├─ storeInfo.ts         店舗名・訪問日・都道府県・市区
│  │  │  ├─ coverageType.ts      取材種別
│  │  │  ├─ pachinko.ts          パチンコ機種セクション
│  │  │  ├─ slot.ts              スロット形式 A / B
│  │  │  └─ article.ts           上記を束ねて Article を返す。検証も行う
│  │  ├─ listing.ts              一覧 HTML → エントリ列と次ページ URL
│  │  ├─ fetch.ts                UA・間隔・リトライ付き fetchHtml
│  │  ├─ store.ts                articles.json / errors.json の読み書きと 90 日 prune
│  │  ├─ aggregate.ts            Article[] → MachineSummary[]
│  │  └─ main.ts                 差分クロールの制御（依存注入で単体テスト可能）
│  └─ test/
│     ├─ fixtures/               上記 4 ファイル
│     └─ *.test.ts
├─ web/
│  ├─ package.json
│  ├─ index.html                 フォント読み込み、noindex
│  ├─ vite.config.ts             publicDir を ../data に向ける。base は VITE_BASE
│  ├─ vitest.config.ts
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx                 状態と URL 同期、画面組み立て
│     ├─ lib/
│     │  ├─ rank.ts              検索・絞り込み・並び替えの純関数
│     │  ├─ urlState.ts          URL クエリ ↔ 画面状態
│     │  └─ format.ts            数値表示（+4,620玉 など）
│     ├─ components/
│     │  ├─ CategoryToggle.tsx   パチンコ / スロット
│     │  ├─ MachineSearch.tsx    入力欄と候補
│     │  ├─ MachineHero.tsx      看板黄のヒーロー
│     │  ├─ Filters.tsx          都道府県・取材種別
│     │  ├─ ShopRow.tsx          店舗 1 行（セグメント列を含む）
│     │  ├─ ShopDetail.tsx       記事一覧
│     │  └─ StoreLookup.tsx      店舗から探す
│     └─ styles/
│        ├─ tokens.css           色・書体・寸法トークン（ライト / ダーク）
│        └─ app.css              レイアウトとコンポーネント
├─ data/
│  ├─ articles.json
│  ├─ machines.json
│  └─ errors.json
├─ .github/workflows/crawl-and-deploy.yml
└─ README.md
```

---

### Task 1: モノレポの土台と共有型

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Create: `shared/types.ts`
- Create: `crawler/package.json`, `crawler/tsconfig.json`, `crawler/vitest.config.ts`
- Test: `crawler/test/types.test.ts`

**Interfaces:**
- Produces: `shared/types.ts` の `Category`, `Article`, `MachineResult`, `MachineSummary`, `ShopHit`, `ShopArticleRef`, `ArticlesFile`, `MachinesFile`, `CrawlError`。以後の全タスクがこれを import する。

- [ ] **Step 1: ルート設定ファイルを作る**

`package.json`
```json
{
  "name": "slopachi-shop-finder",
  "private": true,
  "packageManager": "pnpm@10.33.0",
  "scripts": {
    "test": "pnpm -r test",
    "crawl": "pnpm --filter crawler crawl",
    "build": "pnpm --filter web build"
  },
  "engines": { "node": ">=24" }
}
```

`pnpm-workspace.yaml`
```yaml
packages:
  - crawler
  - web
```

`tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "types": ["node"]
  }
}
```

- [ ] **Step 2: 共有型を書く**

`shared/types.ts`
```ts
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
  avgDiff: number;       // 平均差玉(玉) / 平均差枚(枚)。符号付き整数
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
  avgDiff: number;
  shared?: true;
}

export interface ShopHit {
  storeName: string;
  prefecture: string;
  city: string;
  hitCount: number;
  lastVisitDate: string;
  avgDiffMean: number;   // 各記事 avgDiff の単純平均（四捨五入して整数）
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
```

- [ ] **Step 3: crawler パッケージを作る**

`crawler/package.json`
```json
{
  "name": "crawler",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "crawl": "tsx src/main.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "cheerio": "^1.2.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "domhandler": "^5.0.3",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

`crawler/tsconfig.json`
```json
{
  "extends": "../tsconfig.base.json",
  "include": ["src", "test", "../shared"]
}
```

`crawler/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

- [ ] **Step 4: 型が import できることを確かめる最小テストを書く**

`crawler/test/types.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import type { Article } from '../../shared/types';

describe('shared types', () => {
  it('Article を組み立てられる', () => {
    const a: Article = {
      url: 'https://example.test/a/',
      title: 't',
      visitDate: '2026-09-06',
      coverageType: 'るいべえ実践来店',
      store: { name: '新！ガーデン八潮', prefecture: '埼玉県', city: '八潮市' },
      results: [],
      fetchedAt: '2026-09-15T00:00:00.000Z',
    };
    expect(a.store.prefecture).toBe('埼玉県');
  });
});
```

- [ ] **Step 5: 依存を入れてテストを実行する**

Run: `cd /Users/kohei/Developer/パチンコ系 && pnpm install && pnpm --filter crawler test`
Expected: `1 passed`

- [ ] **Step 6: コミット**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml shared crawler/package.json crawler/tsconfig.json crawler/vitest.config.ts crawler/test/types.test.ts crawler/test/fixtures
git commit -m "chore: pnpm ワークスペースと共有型、テストフィクスチャを追加"
```

---

### Task 2: 文字列ユーティリティ

**Files:**
- Create: `crawler/src/text.ts`
- Test: `crawler/test/text.test.ts`

**Interfaces:**
- Produces:
  - `cleanText(s: string): string` — `&nbsp;`/全角空白/連続空白を半角 1 個に、前後 trim
  - `parseSignedInt(s: string): number | null` — `'+29,780玉'`→`29780`、`'-1,020枚'`→`-1020`、`'7,570G'`→`7570`、数字無し→`null`
  - `toHalfWidth(s: string): string` — 全角英数記号→半角（`Ｖｅｒ．`→`Ver.`、`〜`と`～`→`〜`に統一）
  - `extractBrackets(s: string): string[]` — `'【A】x【B】'`→`['A','B']`

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/text.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { cleanText, parseSignedInt, toHalfWidth, extractBrackets } from '../src/text';

describe('cleanText', () => {
  it('nbsp と全角空白と改行を 1 つの半角空白にする', () => {
    expect(cleanText(' 店舗:  新！ガーデン八潮\n\t\t 八潮市　')).toBe('店舗: 新！ガーデン八潮 八潮市');
  });
});

describe('parseSignedInt', () => {
  it('符号と桁区切りと単位を扱う', () => {
    expect(parseSignedInt('+29,780玉')).toBe(29780);
    expect(parseSignedInt('-1,020枚')).toBe(-1020);
    expect(parseSignedInt('7,570G')).toBe(7570);
    expect(parseSignedInt('平均差玉数:+13,700玉')).toBe(13700);
  });
  it('数字が無ければ null', () => {
    expect(parseSignedInt('なし')).toBeNull();
  });
});

describe('toHalfWidth', () => {
  it('全角英数を半角にし波ダッシュを統一する', () => {
    expect(toHalfWidth('ＳＡＯ２ ４１４～４１７')).toBe('SAO2 414〜417');
  });
});

describe('extractBrackets', () => {
  it('【】の中身を順に返す', () => {
    expect(extractBrackets('【からくり2 451】\n【スマスロゴッド 452,453】')).toEqual(['からくり2 451', 'スマスロゴッド 452,453']);
    expect(extractBrackets('なし')).toEqual([]);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- text`
Expected: FAIL（モジュールが無い）

- [ ] **Step 3: 実装する**

`crawler/src/text.ts`
```ts
export function cleanText(s: string): string {
  return s
    .replace(/ /g, ' ')
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSignedInt(s: string): number | null {
  const m = s.replace(/ /g, ' ').match(/([+\-−－]?)\s*([\d,，]+)/);
  if (!m) return null;
  const sign = m[1] && m[1] !== '+' ? -1 : 1;
  const digits = m[2]!.replace(/[,，]/g, '');
  if (digits === '') return null;
  return sign * Number(digits);
}

export function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[～~]/g, '〜');
}

export function extractBrackets(s: string): string[] {
  return [...s.matchAll(/【([^】]+)】/g)].map((m) => m[1]!.trim());
}
```

注意: `toHalfWidth` の正規表現 `[！-～]` は全角の `！`(U+FF01) から `～`(U+FF5E) までの範囲。`～`(U+FF5E) は先に半角 `~` に変換されるため、続く置換で `〜` に統一される。

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test -- text`
Expected: `7 passed` 相当（全テスト PASS）

- [ ] **Step 5: コミット**

```bash
git add crawler/src/text.ts crawler/test/text.test.ts
git commit -m "feat: 文字列ユーティリティ（数値・空白・全角半角）を追加"
```

---

### Task 3: 本文抽出と店舗情報の解析

**Files:**
- Create: `crawler/src/parse/body.ts`, `crawler/src/parse/storeInfo.ts`
- Create: `crawler/test/helpers.ts`
- Test: `crawler/test/storeInfo.test.ts`

**Interfaces:**
- Produces:
  - `loadBody(html: string): { $: CheerioAPI; body: Cheerio<Element>; title: string }` — `div.entry.col-md-12` を本文とする。無ければ `<body>` 全体
  - `parseStoreInfo(body: Cheerio<Element>): { store: StoreInfo; visitDate: string } | null` — 必須項目（店舗・訪問日・都道府県）が取れなければ `null`
- Consumes: Task 2 `cleanText`

- [ ] **Step 1: テストヘルパを書く**

`crawler/test/helpers.ts`
```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function fixture(name: string): string {
  return readFileSync(resolve(__dirname, 'fixtures', name), 'utf-8');
}
```

- [ ] **Step 2: 失敗するテストを書く**

`crawler/test/storeInfo.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { loadBody } from '../src/parse/body';
import { parseStoreInfo } from '../src/parse/storeInfo';

describe('parseStoreInfo', () => {
  it('るいべえ記事から店舗・訪問日・地域を取る', () => {
    const { body } = loadBody(fixture('article-ruibee-2026-09-06.html'));
    expect(parseStoreInfo(body)).toEqual({
      store: { name: '新！ガーデン八潮', prefecture: '埼玉県', city: '八潮市' },
      visitDate: '2026-09-06',
    });
  });
  it('スロぱちガール記事も同じ形で取れる', () => {
    const { body } = loadBody(fixture('article-girlps-2026-09-13.html'));
    expect(parseStoreInfo(body)).toEqual({
      store: { name: 'ピーアーク草加', prefecture: '埼玉県', city: '草加市' },
      visitDate: '2026-09-13',
    });
  });
  it('店舗情報が無ければ null', () => {
    const { body } = loadBody('<html><body><div class="entry col-md-12"><p>x</p></div></body></html>');
    expect(parseStoreInfo(body)).toBeNull();
  });
  it('東京都は都道府県「東京都」市区「豊島区」に分かれる', () => {
    const { body } = loadBody(
      '<html><body><div class="entry col-md-12"><table><tr><td>店舗:&nbsp;X店<br>訪問日:&nbsp;2026/08/01<br>地域:&nbsp;東京都 豊島区<br></td></tr></table></div></body></html>',
    );
    expect(parseStoreInfo(body)?.store).toEqual({ name: 'X店', prefecture: '東京都', city: '豊島区' });
  });
});
```

- [ ] **Step 3: 失敗を確認する**

Run: `pnpm --filter crawler test -- storeInfo`
Expected: FAIL

- [ ] **Step 4: 実装する**

`crawler/src/parse/body.ts`
```ts
import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';

export interface LoadedBody {
  $: CheerioAPI;
  body: Cheerio<Element>;
  title: string;
}

export function loadBody(html: string): LoadedBody {
  const $ = cheerio.load(html);
  const entry = $('div.entry.col-md-12');
  const body = entry.length > 0 ? entry.first() : $('body');
  const title = $('title').first().text().replace(/\s*\|\s*スロパチステーション.*$/, '').trim();
  return { $, body, title };
}
```

`crawler/src/parse/storeInfo.ts`
```ts
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import type { StoreInfo } from '../../../shared/types';
import { cleanText } from '../text';

const PREF_RE = /^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)\s*(.*)$/;

export function parseStoreInfo(body: Cheerio<Element>): { store: StoreInfo; visitDate: string } | null {
  const td = body.find('td').filter((_, el) => {
    const t = cleanText(body.find(el).text());
    return t.includes('店舗') && t.includes('訪問日');
  }).first();
  if (td.length === 0) return null;

  const fields = new Map<string, string>();
  for (const raw of (td.html() ?? '').split(/<br\s*\/?>/i)) {
    const line = cleanText(raw.replace(/<[^>]+>/g, ''));
    const m = line.match(/^([^:：]+)[:：]\s*(.*)$/);
    if (m) fields.set(m[1]!.trim(), m[2]!.trim());
  }

  const name = fields.get('店舗');
  const dateRaw = fields.get('訪問日');
  const area = fields.get('地域');
  if (!name || !dateRaw || !area) return null;

  const d = dateRaw.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!d) return null;
  const visitDate = `${d[1]}-${d[2]!.padStart(2, '0')}-${d[3]!.padStart(2, '0')}`;

  const p = area.match(PREF_RE);
  if (!p) return null;
  return { store: { name, prefecture: p[1]!, city: p[2]!.trim() }, visitDate };
}
```

- [ ] **Step 5: 通ることを確認する**

Run: `pnpm --filter crawler test -- storeInfo`
Expected: PASS（4 件）

- [ ] **Step 6: コミット**

```bash
git add crawler/src/parse/body.ts crawler/src/parse/storeInfo.ts crawler/test/helpers.ts crawler/test/storeInfo.test.ts
git commit -m "feat: 記事本文の抽出と店舗情報パーサを追加"
```

---

### Task 4: 取材種別の解析

**Files:**
- Create: `crawler/src/parse/coverageType.ts`
- Test: `crawler/test/coverageType.test.ts`

**Interfaces:**
- Produces: `parseCoverageType(body: Cheerio<Element>, title: string): string | null`
  - 本文最初の `<h2>` 以降で最初に現れる `<p>` の `【…】` を返す。無ければタイトル `【日付 店舗】種別！…` の `】` 直後から最初の `！` or `!` までを返す。どちらも無ければ `null`。

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/coverageType.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { loadBody } from '../src/parse/body';
import { parseCoverageType } from '../src/parse/coverageType';

describe('parseCoverageType', () => {
  it.each([
    ['article-ruibee-2026-09-06.html', 'るいべえ実践来店'],
    ['article-girlps-2026-09-13.html', 'スロぱちガール来店PS'],
    ['article-station-2026-09-11.html', 'スロパチステーション来店取材'],
  ])('%s → %s', (file, expected) => {
    const { body, title } = loadBody(fixture(file));
    expect(parseCoverageType(body, title)).toBe(expected);
  });

  it('本文に無ければタイトルから取る', () => {
    const { body, title } = loadBody(
      '<html><head><title>【9月1日 X店】れんじろう実践来店！何かが凄い！ | スロパチステーション</title></head><body><div class="entry col-md-12"></div></body></html>',
    );
    expect(parseCoverageType(body, title)).toBe('れんじろう実践来店');
  });

  it('どこにも無ければ null', () => {
    const { body, title } = loadBody('<html><head><title>x</title></head><body></body></html>');
    expect(parseCoverageType(body, title)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- coverageType`
Expected: FAIL

- [ ] **Step 3: 実装する**

`crawler/src/parse/coverageType.ts`
```ts
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { cleanText, extractBrackets } from '../text';

export function parseCoverageType(body: Cheerio<Element>, title: string): string | null {
  const firstH2 = body.find('h2').first();
  if (firstH2.length > 0) {
    const p = firstH2.nextAll('p').first();
    const found = extractBrackets(cleanText(p.text()))[0];
    if (found) return found;
  }
  const m = title.match(/】\s*([^！!]+)/);
  if (m) return cleanText(m[1]!);
  return null;
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test -- coverageType`
Expected: PASS（5 件）

- [ ] **Step 5: コミット**

```bash
git add crawler/src/parse/coverageType.ts crawler/test/coverageType.test.ts
git commit -m "feat: 取材種別パーサを追加"
```

---

### Task 5: 機種名の正規化と machineKey

**Files:**
- Create: `crawler/src/normalize.ts`
- Test: `crawler/test/normalize.test.ts`

**Interfaces:**
- Produces:
  - `normalizeMachineName(raw: string): string` — `toHalfWidth` → 空白除去 → `ver.`/`Ver.`/`VER.`→`ver.` → 記号 `・`/`･`/`-`/`‐`/`－` を除去 → 小文字化
  - `machineKeyFor(raw: string, dmmId: string | null): string` — `dmmId` があれば `dmm:${id}`、無ければ `name:${normalizeMachineName(raw)}`
  - `EXCLUDED_HEADINGS: ReadonlySet<string>` — `'バラエティ'`, `'その他'`, `'総括'`, `'今後のスケジュール'`
  - `isExcludedMachineName(raw: string): boolean`
- Consumes: Task 2 `toHalfWidth`

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/normalize.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { normalizeMachineName, machineKeyFor, isExcludedMachineName } from '../src/normalize';

describe('normalizeMachineName', () => {
  it('全角・空白・記号・大文字小文字のゆれを吸収する', () => {
    expect(normalizeMachineName('真・北斗無双 Re:319ver.')).toBe('真北斗無双re:319ver.');
    expect(normalizeMachineName('真北斗無双　Ｒｅ：３１９Ｖｅｒ．')).toBe('真北斗無双re:319ver.');
    expect(normalizeMachineName('ソードアート・オンライン 閃光の軌跡')).toBe('ソードアートオンライン閃光の軌跡');
  });
});

describe('machineKeyFor', () => {
  it('DMM ID 優先', () => {
    expect(machineKeyFor('押忍！番長 漢の頂', '4714')).toBe('dmm:4714');
  });
  it('ID が無ければ正規化名', () => {
    expect(machineKeyFor('東京喰種', null)).toBe('name:東京喰種');
  });
});

describe('isExcludedMachineName', () => {
  it('バラエティは機種ではない', () => {
    expect(isExcludedMachineName('バラエティ')).toBe(true);
    expect(isExcludedMachineName('東京喰種')).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- normalize`
Expected: FAIL

- [ ] **Step 3: 実装する**

`crawler/src/normalize.ts`
```ts
import { toHalfWidth } from './text';

export const EXCLUDED_HEADINGS: ReadonlySet<string> = new Set(['バラエティ', 'その他', '総括', '今後のスケジュール']);

export function normalizeMachineName(raw: string): string {
  return toHalfWidth(raw)
    .replace(/\s+/g, '')
    .replace(/ver\./gi, 'ver.')
    .replace(/[・･\-‐－]/g, '')
    .toLowerCase();
}

export function machineKeyFor(raw: string, dmmId: string | null): string {
  return dmmId ? `dmm:${dmmId}` : `name:${normalizeMachineName(raw)}`;
}

export function isExcludedMachineName(raw: string): boolean {
  return EXCLUDED_HEADINGS.has(raw.trim());
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test -- normalize`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add crawler/src/normalize.ts crawler/test/normalize.test.ts
git commit -m "feat: 機種名の正規化と machineKey 決定を追加"
```

---

### Task 6: パチンコ機種セクションの解析

**Files:**
- Create: `crawler/src/parse/pachinko.ts`
- Test: `crawler/test/pachinko.test.ts`

**Interfaces:**
- Produces: `parsePachinko(body: Cheerio<Element>): MachineResult[]`
  - 各 `<h4>` について、見出し内の `【…】` を機種名とする（`＜列①＞` などの接頭辞は捨てる）。同じ親 `<div>` 内の `<pre>` から `全N台中、M台がプラス` と `平均差玉数:X玉` を読む。`a[href*="p-town.dmm.com/machines/"]` から ID を取る。
  - 除外見出し（Task 5）や `<pre>` が揃わない見出しは結果に含めない。
- Consumes: Task 2 `cleanText`, `parseSignedInt`, `extractBrackets`; Task 5 `machineKeyFor`, `isExcludedMachineName`

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/pachinko.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { loadBody } from '../src/parse/body';
import { parsePachinko } from '../src/parse/pachinko';

describe('parsePachinko', () => {
  it('るいべえ記事: 機種ごとの台数・プラス台・平均差玉・DMM ID を取る', () => {
    const { body } = loadBody(fixture('article-ruibee-2026-09-06.html'));
    const r = parsePachinko(body);
    const bancho = r.find((x) => x.machineKey === 'dmm:4714');
    expect(bancho).toEqual({
      category: 'pachinko',
      machineKey: 'dmm:4714',
      machineName: '押忍！番長 漢の頂',
      units: 3,
      plusUnits: 2,
      avgDiff: 29780,
    });
    const rezero = r.find((x) => x.machineName.startsWith('Re:ゼロ'));
    expect(rezero?.avgDiff).toBe(-18210);
    expect(rezero?.plusUnits).toBe(0);
  });

  it('バラエティは除外する', () => {
    const { body } = loadBody(fixture('article-ruibee-2026-09-06.html'));
    expect(parsePachinko(body).some((x) => x.machineName === 'バラエティ')).toBe(false);
  });

  it('＜列①＞接頭辞を捨てて機種名だけにする', () => {
    const { body } = loadBody(fixture('article-girlps-2026-09-13.html'));
    const accel = parsePachinko(body).find((x) => x.machineKey === 'dmm:5051');
    expect(accel?.machineName).toBe('アクセル・ワールド');
    expect(accel?.units).toBe(3);
    expect(accel?.avgDiff).toBe(13700);
  });

  it('パチンコ無しの記事は空配列', () => {
    const { body } = loadBody(fixture('article-station-2026-09-11.html'));
    expect(parsePachinko(body)).toEqual([]);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- pachinko`
Expected: FAIL

- [ ] **Step 3: 実装する**

`crawler/src/parse/pachinko.ts`
```ts
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import type { MachineResult } from '../../../shared/types';
import { cleanText, extractBrackets, parseSignedInt } from '../text';
import { isExcludedMachineName, machineKeyFor } from '../normalize';

const UNITS_RE = /全\s*(\d+)\s*台中、?\s*(\d+)\s*台がプラス/;
const AVG_RE = /平均差玉数\s*[:：]\s*([+\-−－]?[\d,，]+)/;
const DMM_RE = /p-town\.dmm\.com\/machines\/(\d+)/;

export function parsePachinko(body: Cheerio<Element>): MachineResult[] {
  const out: MachineResult[] = [];
  body.find('h4').each((_, h4El) => {
    const h4 = body.find(h4El);
    const name = extractBrackets(cleanText(h4.text()))[0];
    if (!name || isExcludedMachineName(name)) return;

    const section = h4.parent();
    const pres = section.find('pre').map((_, p) => cleanText(body.find(p).text())).get();
    const unitsM = pres.map((t) => t.match(UNITS_RE)).find(Boolean);
    const avgM = pres.map((t) => t.match(AVG_RE)).find(Boolean);
    if (!unitsM || !avgM) return;
    const avgDiff = parseSignedInt(avgM[1]!);
    if (avgDiff === null) return;

    const href = section.find('a[href*="p-town.dmm.com/machines/"]').first().attr('href') ?? '';
    const dmmId = href.match(DMM_RE)?.[1] ?? null;

    out.push({
      category: 'pachinko',
      machineKey: machineKeyFor(name, dmmId),
      machineName: name,
      units: Number(unitsM[1]),
      plusUnits: Number(unitsM[2]),
      avgDiff,
    });
  });
  return out;
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test -- pachinko`
Expected: PASS（4 件）

- [ ] **Step 5: コミット**

```bash
git add crawler/src/parse/pachinko.ts crawler/test/pachinko.test.ts
git commit -m "feat: パチンコ機種セクションのパーサを追加"
```

---

### Task 7: スロット表（形式 A / B）の解析

**Files:**
- Create: `crawler/src/parse/slot.ts`
- Test: `crawler/test/slot.test.ts`

**Interfaces:**
- Produces: `parseSlot(body: Cheerio<Element>): MachineResult[]`
  - 形式 A: 先頭行の `<th>` が `台番号 / 機種 / 回転数 / 差枚` の表。記事内の全形式 A 表の行を機種名で束ね、`units` = 行数、`plusUnits` = 差枚 > 0 の行数、`avgDiff` = 差枚の平均（四捨五入）、`unitNumbers` = 台番をカンマ結合。
  - 形式 B: `【機種名 台番】` を含む `<h2>` の直後（次の `<h2>` より前）にある `<th>プラス台</th>` を持つ表。`プラス台` の `M台/N台` と `平均差枚数` を読む。見出しに 2 機種以上あれば各機種に同じ値を入れて `shared: true`。
  - 同じ機種が別群で複数回現れた場合はそれぞれ別の `MachineResult` として返す（記事内の統合は Task 12 の集計で行う）。
- Consumes: Task 2 `cleanText`, `parseSignedInt`, `extractBrackets`; Task 5 `machineKeyFor`, `isExcludedMachineName`

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/slot.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { loadBody } from '../src/parse/body';
import { parseSlot } from '../src/parse/slot';

describe('parseSlot 形式 A（台番号ごとの表）', () => {
  const { body } = loadBody(fixture('article-ruibee-2026-09-06.html'));
  const r = parseSlot(body);

  it('機種ごとに行を束ねる（14 機種）', () => {
    expect(r).toHaveLength(14);
  });
  it('複数表にまたがる機種も 1 つにまとめる', () => {
    const otome = r.find((x) => x.machineName === '乙女5');
    expect(otome).toEqual({
      category: 'slot',
      machineKey: 'name:乙女5',
      machineName: '乙女5',
      units: 9,
      plusUnits: 6,
      avgDiff: 5351,
      unitNumbers: '604,605,606,607,608,609,610,611,612',
    });
  });
  it('1 台だけの機種も扱う', () => {
    const persona = r.find((x) => x.machineName === 'ペルソナ5');
    expect(persona).toMatchObject({ units: 1, plusUnits: 0, avgDiff: -690, unitNumbers: '828' });
  });
  it('平均は四捨五入した整数', () => {
    expect(r.find((x) => x.machineName === '戦コレ6')?.avgDiff).toBe(128);
  });
});

describe('parseSlot 形式 B（機種見出し + 縦持ち表）', () => {
  it('スロぱちガール記事: 9 群を機種ごとに読む', () => {
    const { body } = loadBody(fixture('article-girlps-2026-09-13.html'));
    const r = parseSlot(body);
    expect(r).toHaveLength(9);
    expect(r[0]).toEqual({
      category: 'slot',
      machineKey: 'name:ヴヴヴ2',
      machineName: 'ヴヴヴ2',
      units: 4,
      plusUnits: 2,
      avgDiff: 4620,
      unitNumbers: '584〜587',
    });
    expect(r.filter((x) => x.machineName === '東京喰種')).toHaveLength(2);
    expect(r.find((x) => x.machineName === 'スマスロゴッド')?.avgDiff).toBe(-300);
  });

  it('来店取材記事: 2 機種混在の見出しは shared 付きで 2 件になる', () => {
    const { body } = loadBody(fixture('article-station-2026-09-11.html'));
    const r = parseSlot(body);
    expect(r).toHaveLength(12);
    const karakuri = r.find((x) => x.machineName === 'からくり2');
    const god = r.find((x) => x.machineName === 'スマスロゴッド');
    expect(karakuri).toEqual({
      category: 'slot',
      machineKey: 'name:からくり2',
      machineName: 'からくり2',
      units: 3,
      plusUnits: 3,
      avgDiff: 7600,
      unitNumbers: '451',
      shared: true,
    });
    expect(god).toMatchObject({ units: 3, plusUnits: 3, avgDiff: 7600, unitNumbers: '452,453', shared: true });
    expect(r.find((x) => x.machineName === 'かぐや様')).toMatchObject({ units: 3, plusUnits: 2, avgDiff: 190, shared: true });
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- slot`
Expected: FAIL

- [ ] **Step 3: 実装する**

`crawler/src/parse/slot.ts`
```ts
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import type { MachineResult } from '../../../shared/types';
import { cleanText, extractBrackets, parseSignedInt } from '../text';
import { isExcludedMachineName, machineKeyFor } from '../normalize';

export function parseSlot(body: Cheerio<Element>): MachineResult[] {
  return [...parseUnitTables(body), ...parseGroupHeadings(body)];
}

function cellTexts(body: Cheerio<Element>, row: Element, tag: 'th' | 'td'): string[] {
  return body.find(row).find(tag).map((_, c) => cleanText(body.find(c).text())).get();
}

/** 形式 A: 台番号 / 機種 / 回転数 / 差枚 */
function parseUnitTables(body: Cheerio<Element>): MachineResult[] {
  const diffs = new Map<string, number[]>();
  const units = new Map<string, string[]>();

  body.find('table').each((_, tableEl) => {
    const rows = body.find(tableEl).find('tr').toArray();
    const header = rows[0] ? cellTexts(body, rows[0], 'th') : [];
    if (header[0] !== '台番号') return;
    const iMachine = header.indexOf('機種');
    const iDiff = header.indexOf('差枚');
    if (iMachine < 0 || iDiff < 0) return;

    for (const row of rows.slice(1)) {
      const cells = cellTexts(body, row, 'td');
      const name = cells[iMachine];
      const diff = parseSignedInt(cells[iDiff] ?? '');
      const unitNo = cells[0];
      if (!name || diff === null || !unitNo) continue;
      diffs.set(name, [...(diffs.get(name) ?? []), diff]);
      units.set(name, [...(units.get(name) ?? []), unitNo]);
    }
  });

  return [...diffs.entries()].map(([name, ds]) => ({
    category: 'slot' as const,
    machineKey: machineKeyFor(name, null),
    machineName: name,
    units: ds.length,
    plusUnits: ds.filter((d) => d > 0).length,
    avgDiff: Math.round(ds.reduce((a, b) => a + b, 0) / ds.length),
    unitNumbers: (units.get(name) ?? []).join(','),
  }));
}

/** 形式 B: <h2>【機種 台番】</h2> … <table><th>プラス台</th>… */
function parseGroupHeadings(body: Cheerio<Element>): MachineResult[] {
  const out: MachineResult[] = [];

  body.find('h2').each((_, h2El) => {
    const h2 = body.find(h2El);
    const labels = extractBrackets(cleanText(h2.text()));
    if (labels.length === 0) return;

    const table = h2.nextAll('table').first();
    if (table.length === 0) return;
    if (table.prevAll('h2').first()[0] !== h2El) return; // 別の h2 の表

    const rowValue = (label: string): string => {
      const tr = table.find('tr').filter((_, trEl) => cellTexts(body, trEl, 'th')[0] === label).first();
      return cleanText(tr.find('td').first().text());
    };
    const plusM = rowValue('プラス台').match(/(\d+)\s*台\s*\/\s*(\d+)\s*台/);
    const avgDiff = parseSignedInt(rowValue('平均差枚数'));
    if (!plusM || avgDiff === null) return;

    const parsed = labels.map(splitNameAndUnits).filter((p) => !isExcludedMachineName(p.name));
    for (const { name, unitNumbers } of parsed) {
      out.push({
        category: 'slot',
        machineKey: machineKeyFor(name, null),
        machineName: name,
        units: Number(plusM[2]),
        plusUnits: Number(plusM[1]),
        avgDiff,
        ...(unitNumbers ? { unitNumbers } : {}),
        ...(parsed.length > 1 ? { shared: true as const } : {}),
      });
    }
  });

  return out;
}

/** '東京喰種 361〜366' → { name: '東京喰種', unitNumbers: '361〜366' } */
export function splitNameAndUnits(label: string): { name: string; unitNumbers?: string } {
  const m = label.match(/^(.*?)\s+([\d０-９,，〜～\-]+)$/);
  if (!m) return { name: label.trim() };
  return { name: m[1]!.trim(), unitNumbers: m[2]!.replace(/～/g, '〜').replace(/，/g, ',') };
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test -- slot`
Expected: PASS（6 件）。`toHaveLength(12)` が合わない場合は station フィクスチャの `<h2>` を確認し、`prevAll('h2')` の判定が効いているかを見る。

- [ ] **Step 5: コミット**

```bash
git add crawler/src/parse/slot.ts crawler/test/slot.test.ts
git commit -m "feat: スロット表（台番号形式・機種見出し形式）のパーサを追加"
```

---

### Task 8: 記事全体の解析と検証

**Files:**
- Create: `crawler/src/parse/article.ts`
- Test: `crawler/test/article.test.ts`

**Interfaces:**
- Produces:
  - `parseArticle(html: string, url: string, fetchedAt: string): ParseResult`
  - `type ParseResult = { ok: true; article: Article } | { ok: false; reason: string }`
  - 失敗理由は文字列で固定: `'店舗情報が見つからない'`, `'取材種別が見つからない'`, `'機種結果が 0 件'`
- Consumes: Task 3 `loadBody`, `parseStoreInfo`; Task 4 `parseCoverageType`; Task 6 `parsePachinko`; Task 7 `parseSlot`

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/article.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { parseArticle } from '../src/parse/article';

const URL = 'https://777.slopachi-station.com/x/';
const AT = '2026-09-15T00:00:00.000Z';

describe('parseArticle', () => {
  it('るいべえ記事を Article にする', () => {
    const r = parseArticle(fixture('article-ruibee-2026-09-06.html'), URL, AT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.article.url).toBe(URL);
    expect(r.article.visitDate).toBe('2026-09-06');
    expect(r.article.coverageType).toBe('るいべえ実践来店');
    expect(r.article.store.name).toBe('新！ガーデン八潮');
    expect(r.article.title).toContain('るいべえ実践来店');
    expect(r.article.results.filter((x) => x.category === 'pachinko').length).toBeGreaterThan(5);
    expect(r.article.results.filter((x) => x.category === 'slot')).toHaveLength(14);
    expect(r.article.fetchedAt).toBe(AT);
  });

  it('店舗情報が無い HTML は失敗', () => {
    const r = parseArticle('<html><head><title>t</title></head><body><div class="entry col-md-12"></div></body></html>', URL, AT);
    expect(r).toEqual({ ok: false, reason: '店舗情報が見つからない' });
  });

  it('機種結果が無い記事は失敗', () => {
    const html =
      '<html><head><title>【9月1日 X店】れんじろう実践来店！x</title></head><body><div class="entry col-md-12">' +
      '<table><tr><td>店舗:&nbsp;X店<br>訪問日:&nbsp;2026/09/01<br>地域:&nbsp;埼玉県 川口市<br></td></tr></table>' +
      '<h2>9月1日 X店</h2><p><strong>【れんじろう実践来店】</strong></p></div></body></html>';
    expect(parseArticle(html, URL, AT)).toEqual({ ok: false, reason: '機種結果が 0 件' });
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- article`
Expected: FAIL

- [ ] **Step 3: 実装する**

`crawler/src/parse/article.ts`
```ts
import type { Article } from '../../../shared/types';
import { loadBody } from './body';
import { parseStoreInfo } from './storeInfo';
import { parseCoverageType } from './coverageType';
import { parsePachinko } from './pachinko';
import { parseSlot } from './slot';

export type ParseResult = { ok: true; article: Article } | { ok: false; reason: string };

export function parseArticle(html: string, url: string, fetchedAt: string): ParseResult {
  const { body, title } = loadBody(html);

  const info = parseStoreInfo(body);
  if (!info) return { ok: false, reason: '店舗情報が見つからない' };

  const coverageType = parseCoverageType(body, title);
  if (!coverageType) return { ok: false, reason: '取材種別が見つからない' };

  const results = [...parsePachinko(body), ...parseSlot(body)];
  if (results.length === 0) return { ok: false, reason: '機種結果が 0 件' };

  return {
    ok: true,
    article: { url, title, visitDate: info.visitDate, coverageType, store: info.store, results, fetchedAt },
  };
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test -- article`
Expected: PASS（3 件）

- [ ] **Step 5: コミット**

```bash
git add crawler/src/parse/article.ts crawler/test/article.test.ts
git commit -m "feat: 記事パーサを統合し必須項目を検証"
```

---

### Task 9: 一覧ページの解析

**Files:**
- Create: `crawler/src/listing.ts`
- Test: `crawler/test/listing.test.ts`

**Interfaces:**
- Produces:
  - `interface ListingEntry { url: string; month: number; day: number; coverageType: string; storeName: string; prefectureCity: string }`
  - `parseListing(html: string): { entries: ListingEntry[]; nextUrl: string | null }` — `<a>` を持たない行（予定のみ）と、テキストに `(予定)` を含む行は除外
  - `inferVisitDate(month: number, day: number, today: Date): string` — `today` 以前で最も近い同月日の `YYYY-MM-DD`（未来になるなら前年）
  - `AREAS: readonly { name: string; url: string }[]` — 東京 / 南関東 / 北関東の一覧 URL
- Consumes: Task 2 `cleanText`

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/listing.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { fixture } from './helpers';
import { parseListing, inferVisitDate, AREAS } from '../src/listing';

describe('parseListing', () => {
  const { entries, nextUrl } = parseListing(fixture('listing-kita-kanto-p1.html'));

  it('リンクのある行だけを取る（40 行中 21 行）', () => {
    expect(entries).toHaveLength(21);
  });
  it('先頭エントリの内容', () => {
    expect(entries[0]).toEqual({
      url: expect.stringMatching(/^https:\/\/777\.slopachi-station\.com\/.+sao2\/$/),
      month: 9,
      day: 13,
      coverageType: 'スロぱちガール来店PS',
      storeName: 'ピーアーク草加',
      prefectureCity: '埼玉県草加市',
    });
  });
  it('(予定) 行を含まない', () => {
    expect(entries.some((e) => e.coverageType.includes('予定'))).toBe(false);
  });
  it('次ページ URL', () => {
    expect(nextUrl).toBe('https://777.slopachi-station.com/report/kita-kanto/page/2');
  });
  it('最終ページでは nextUrl が null', () => {
    expect(parseListing('<html><body><section id="archiveReporList"></section></body></html>').nextUrl).toBeNull();
  });
});

describe('inferVisitDate', () => {
  it('今日以前ならその年', () => {
    expect(inferVisitDate(9, 13, new Date('2026-09-15'))).toBe('2026-09-13');
  });
  it('未来になる月日は前年', () => {
    expect(inferVisitDate(12, 20, new Date('2026-09-15'))).toBe('2025-12-20');
  });
  it('当日は今年', () => {
    expect(inferVisitDate(9, 15, new Date('2026-09-15'))).toBe('2026-09-15');
  });
});

describe('AREAS', () => {
  it('3 エリア', () => {
    expect(AREAS.map((a) => a.url)).toEqual([
      'https://777.slopachi-station.com/report_pref/tokyo/',
      'https://777.slopachi-station.com/report/minami-kanto/',
      'https://777.slopachi-station.com/report/kita-kanto/',
    ]);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- listing`
Expected: FAIL

- [ ] **Step 3: 実装する**

`crawler/src/listing.ts`
```ts
import * as cheerio from 'cheerio';
import { cleanText } from './text';

export interface ListingEntry {
  url: string;
  month: number;
  day: number;
  coverageType: string;
  storeName: string;
  prefectureCity: string;
}

export const AREAS = [
  { name: '東京', url: 'https://777.slopachi-station.com/report_pref/tokyo/' },
  { name: '南関東', url: 'https://777.slopachi-station.com/report/minami-kanto/' },
  { name: '北関東', url: 'https://777.slopachi-station.com/report/kita-kanto/' },
] as const;

export function parseListing(html: string): { entries: ListingEntry[]; nextUrl: string | null } {
  const $ = cheerio.load(html);
  const entries: ListingEntry[] = [];

  $('#archiveReporList .resultRow-detail').each((_, el) => {
    const detail = $(el);
    const a = detail.find('a[href]').first();
    if (a.length === 0) return;

    const whole = cleanText(detail.text());
    const dateM = whole.match(/(\d{1,2})\/(\d{1,2})/);
    const placeM = whole.match(/【([^】]+)】/);
    const linkText = cleanText(a.text());
    if (!dateM || !placeM || linkText.includes('(予定)') || linkText.includes('（予定）')) return;

    // 'スロぱちガール来店PS ピーアーク草加' → 種別は元 HTML で &nbsp;&nbsp; 区切り。cleanText 後は最後の空白で分ける
    const rawLink = (a.html() ?? '').replace(/<svg[\s\S]*?<\/svg>/g, '');
    const parts = rawLink.split(/(?:&nbsp;|\u00a0){2,}/).map((s) => cleanText(s.replace(/<[^>]+>/g, '')));
    const coverageType = parts[0] ?? linkText;
    const storeName = parts.slice(1).join(' ') || '';

    entries.push({
      url: a.attr('href')!,
      month: Number(dateM[1]),
      day: Number(dateM[2]),
      coverageType,
      storeName,
      prefectureCity: placeM[1]!,
    });
  });

  const nextUrl = $('.pagingBox a.next').first().attr('href') ?? null;
  return { entries, nextUrl };
}

export function inferVisitDate(month: number, day: number, today: Date): string {
  const y = today.getFullYear();
  const candidate = new Date(y, month - 1, day);
  const todayMidnight = new Date(y, today.getMonth(), today.getDate());
  const year = candidate > todayMidnight ? y - 1 : y;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test -- listing`
Expected: PASS（9 件）。`storeName` が空になる場合は `a.html()` の `&nbsp;` が実体参照のままか文字 ` ` かをログで確認し、split の正規表現に合わせる。

- [ ] **Step 5: コミット**

```bash
git add crawler/src/listing.ts crawler/test/listing.test.ts
git commit -m "feat: 一覧ページのパーサと年推定を追加"
```

---

### Task 10: 礼節付き HTTP 取得

**Files:**
- Create: `crawler/src/fetch.ts`
- Test: `crawler/test/fetch.test.ts`

**Interfaces:**
- Produces:
  - `interface FetchDeps { fetchFn: typeof fetch; sleep: (ms: number) => Promise<void>; now: () => number }`
  - `createFetcher(deps?: Partial<FetchDeps>): (url: string) => Promise<string>` — 前回リクエストから 1000ms 未満なら待つ。HTTP 5xx / ネットワーク例外は 1s, 2s, 4s 待って最大 3 回再試行。4xx は即失敗。失敗時は `Error('fetch failed: <url> (<status or message>)')`
  - `USER_AGENT` 定数

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/fetch.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest';
import { createFetcher, USER_AGENT } from '../src/fetch';

function res(status: number, body = 'ok'): Response {
  return new Response(body, { status });
}

describe('createFetcher', () => {
  it('UA を付けて本文を返す', async () => {
    const fetchFn = vi.fn(async () => res(200, '<html>x</html>'));
    const sleep = vi.fn(async () => {});
    const f = createFetcher({ fetchFn, sleep, now: () => 0 });
    await expect(f('https://a.test/')).resolves.toBe('<html>x</html>');
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(USER_AGENT);
  });

  it('前回から 1 秒未満なら待つ', async () => {
    let t = 0;
    const fetchFn = vi.fn(async () => res(200));
    const sleep = vi.fn(async (ms: number) => { t += ms; });
    const f = createFetcher({ fetchFn, sleep, now: () => t });
    await f('https://a.test/1');
    t += 300;
    await f('https://a.test/2');
    expect(sleep).toHaveBeenCalledWith(700);
  });

  it('5xx は 3 回まで再試行して成功を返す', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(502))
      .mockResolvedValueOnce(res(200, 'fine'));
    const sleep = vi.fn(async () => {});
    const f = createFetcher({ fetchFn, sleep, now: () => 0 });
    await expect(f('https://a.test/')).resolves.toBe('fine');
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('4 回目も失敗なら例外', async () => {
    const fetchFn = vi.fn(async () => res(500));
    const f = createFetcher({ fetchFn, sleep: async () => {}, now: () => 0 });
    await expect(f('https://a.test/')).rejects.toThrow('fetch failed: https://a.test/ (500)');
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('404 は再試行しない', async () => {
    const fetchFn = vi.fn(async () => res(404));
    const f = createFetcher({ fetchFn, sleep: async () => {}, now: () => 0 });
    await expect(f('https://a.test/')).rejects.toThrow('(404)');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- fetch`
Expected: FAIL

- [ ] **Step 3: 実装する**

`crawler/src/fetch.ts`
```ts
export const USER_AGENT = 'slopachi-shop-finder/1.0 (private use; contact: nagao.kohei@yw.mitsubishielectric.co.jp)';
const MIN_INTERVAL_MS = 1000;
const MAX_RETRIES = 3;

export interface FetchDeps {
  fetchFn: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

const defaultDeps: FetchDeps = {
  fetchFn: (input, init) => fetch(input, init),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

export function createFetcher(overrides: Partial<FetchDeps> = {}): (url: string) => Promise<string> {
  const deps = { ...defaultDeps, ...overrides };
  let lastAt = -Infinity;

  async function throttle(): Promise<void> {
    const wait = MIN_INTERVAL_MS - (deps.now() - lastAt);
    if (wait > 0) await deps.sleep(wait);
    lastAt = deps.now();
  }

  async function attempt(url: string): Promise<{ ok: true; body: string } | { ok: false; retry: boolean; detail: string }> {
    await throttle();
    try {
      const r = await deps.fetchFn(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, redirect: 'follow' });
      if (r.ok) return { ok: true, body: await r.text() };
      return { ok: false, retry: r.status >= 500, detail: String(r.status) };
    } catch (e) {
      return { ok: false, retry: true, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  return async (url: string): Promise<string> => {
    let detail = '';
    for (let i = 0; i <= MAX_RETRIES; i++) {
      if (i > 0) await deps.sleep(1000 * 2 ** (i - 1));
      const r = await attempt(url);
      if (r.ok) return r.body;
      detail = r.detail;
      if (!r.retry) break;
    }
    throw new Error(`fetch failed: ${url} (${detail})`);
  };
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test -- fetch`
Expected: PASS（5 件）

- [ ] **Step 5: コミット**

```bash
git add crawler/src/fetch.ts crawler/test/fetch.test.ts
git commit -m "feat: 間隔・リトライ付きの HTTP 取得を追加"
```

---

### Task 11: データファイルの読み書きと 90 日 prune

**Files:**
- Create: `crawler/src/store.ts`
- Test: `crawler/test/store.test.ts`

**Interfaces:**
- Produces:
  - `readArticles(path: string): Promise<Article[]>` — 無ければ `[]`
  - `writeArticles(path: string, articles: Article[], generatedAt: string): Promise<void>` — `ArticlesFile` 形式、`url` 昇順で安定ソート、末尾改行付き JSON（2 スペース）
  - `writeErrors(path: string, errors: CrawlError[]): Promise<void>`
  - `writeMachines(path: string, machines: MachineSummary[], generatedAt: string): Promise<void>` — `MachinesFile` 形式
  - `pruneOld(articles: Article[], today: string, windowDays: number): Article[]` — `visitDate < today - windowDays` を除く
  - `cutoffDate(today: string, windowDays: number): string` — `'2026-09-15', 90` → `'2026-06-17'`

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/store.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Article } from '../../shared/types';
import { readArticles, writeArticles, pruneOld, cutoffDate, writeErrors } from '../src/store';

function art(url: string, visitDate: string): Article {
  return {
    url, title: 't', visitDate, coverageType: 'x',
    store: { name: 's', prefecture: '埼玉県', city: 'c' }, results: [], fetchedAt: '2026-09-15T00:00:00.000Z',
  };
}

describe('store', () => {
  it('無いファイルは空配列', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'store-'));
    expect(await readArticles(join(dir, 'none.json'))).toEqual([]);
  });

  it('書いて読める。url 昇順で並ぶ', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'store-'));
    const p = join(dir, 'articles.json');
    await writeArticles(p, [art('https://b/', '2026-09-01'), art('https://a/', '2026-09-02')], '2026-09-15T00:00:00.000Z');
    const back = await readArticles(p);
    expect(back.map((a) => a.url)).toEqual(['https://a/', 'https://b/']);
    const raw = await readFile(p, 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(JSON.parse(raw).generatedAt).toBe('2026-09-15T00:00:00.000Z');
  });

  it('errors.json を書く', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'store-'));
    const p = join(dir, 'errors.json');
    await writeErrors(p, [{ url: 'u', reason: 'r', at: 't' }]);
    expect(JSON.parse(await readFile(p, 'utf-8'))).toEqual([{ url: 'u', reason: 'r', at: 't' }]);
  });
});

describe('cutoffDate / pruneOld', () => {
  it('90 日前の日付', () => {
    expect(cutoffDate('2026-09-15', 90)).toBe('2026-06-17');
  });
  it('境界日は残し、その前日は落とす', () => {
    const kept = pruneOld([art('a', '2026-06-17'), art('b', '2026-06-16'), art('c', '2026-09-15')], '2026-09-15', 90);
    expect(kept.map((a) => a.url)).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- store`
Expected: FAIL

- [ ] **Step 3: 実装する**

`crawler/src/store.ts`
```ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Article, ArticlesFile, CrawlError, MachineSummary, MachinesFile } from '../../shared/types';

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

export async function readArticles(path: string): Promise<Article[]> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf-8')) as ArticlesFile;
    return parsed.articles ?? [];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

export async function writeArticles(path: string, articles: Article[], generatedAt: string): Promise<void> {
  const sorted = [...articles].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const file: ArticlesFile = { generatedAt, articles: sorted };
  await writeJson(path, file);
}

export async function writeErrors(path: string, errors: CrawlError[]): Promise<void> {
  await writeJson(path, errors);
}

export async function writeMachines(path: string, machines: MachineSummary[], generatedAt: string): Promise<void> {
  const file: MachinesFile = { generatedAt, windowDays: 90, machines };
  await writeJson(path, file);
}

export function cutoffDate(today: string, windowDays: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - windowDays);
  return d.toISOString().slice(0, 10);
}

export function pruneOld(articles: Article[], today: string, windowDays: number): Article[] {
  const cutoff = cutoffDate(today, windowDays);
  return articles.filter((a) => a.visitDate >= cutoff);
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test -- store`
Expected: PASS（5 件）

- [ ] **Step 5: コミット**

```bash
git add crawler/src/store.ts crawler/test/store.test.ts
git commit -m "feat: データファイルの読み書きと 90 日 prune を追加"
```

---

### Task 12: 機種 → 店舗の集計

**Files:**
- Create: `crawler/src/aggregate.ts`
- Test: `crawler/test/aggregate.test.ts`

**Interfaces:**
- Produces: `aggregate(articles: Article[]): MachineSummary[]`
  - 記事内で同じ `machineKey` が複数 `MachineResult` に分かれている場合（スロット形式 B の別群）は 1 件に統合: `units` 合計、`plusUnits` 合計、`avgDiff` は `units` 重み付き平均（四捨五入）、`shared` はいずれかが true なら true。
  - `ShopHit.hitCount` = 記事数、`avgDiffMean` = 記事ごとの統合 avgDiff の単純平均（四捨五入）、`plusRate` = Σplus/Σunits（小数第 3 位で丸め）。
  - `shops` は `hitCount` 降順、同数は `lastVisitDate` 降順、さらに同じなら `storeName` 昇順。
  - `displayName` は最頻出の `machineName`（同数なら先に現れたもの）。`aliases` は他の表記（重複なし）。
  - `machines` は `hitCount` 降順、同数は `displayName` 昇順。
  - 店舗の同一性は `prefecture + storeName`。

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/aggregate.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import type { Article, MachineResult } from '../../shared/types';
import { aggregate } from '../src/aggregate';

function res(machineKey: string, machineName: string, units: number, plusUnits: number, avgDiff: number, extra: Partial<MachineResult> = {}): MachineResult {
  return { category: 'pachinko', machineKey, machineName, units, plusUnits, avgDiff, ...extra };
}
function art(url: string, visitDate: string, storeName: string, results: MachineResult[], coverageType = 'るいべえ実践来店'): Article {
  return { url, title: 't', visitDate, coverageType, store: { name: storeName, prefecture: '埼玉県', city: 'c' }, results, fetchedAt: 'f' };
}

describe('aggregate', () => {
  it('機種ごとに店舗を回数順に並べる', () => {
    const out = aggregate([
      art('u1', '2026-09-01', 'A店', [res('dmm:1', '北斗', 3, 2, 1000)]),
      art('u2', '2026-09-05', 'A店', [res('dmm:1', '北斗', 2, 0, -500)]),
      art('u3', '2026-09-10', 'B店', [res('dmm:1', '北斗', 4, 4, 8000)]),
    ]);
    expect(out).toHaveLength(1);
    const m = out[0]!;
    expect(m.machineKey).toBe('dmm:1');
    expect(m.hitCount).toBe(3);
    expect(m.shopCount).toBe(2);
    expect(m.shops.map((s) => s.storeName)).toEqual(['A店', 'B店']);
    expect(m.shops[0]).toMatchObject({ hitCount: 2, lastVisitDate: '2026-09-05', avgDiffMean: 250, plusRate: 0.4 });
    expect(m.shops[0]!.articles.map((a) => a.visitDate)).toEqual(['2026-09-05', '2026-09-01']);
  });

  it('同数の店舗は直近訪問日が新しい方を先に', () => {
    const out = aggregate([
      art('u1', '2026-09-01', 'A店', [res('dmm:1', '北斗', 1, 1, 1)]),
      art('u2', '2026-09-09', 'B店', [res('dmm:1', '北斗', 1, 1, 1)]),
    ]);
    expect(out[0]!.shops.map((s) => s.storeName)).toEqual(['B店', 'A店']);
  });

  it('記事内の同一機種は 1 件に統合し重み付き平均をとる', () => {
    const out = aggregate([
      art('u1', '2026-09-01', 'A店', [
        res('name:東京喰種', '東京喰種', 6, 6, 6950, { category: 'slot' }),
        res('name:東京喰種', '東京喰種', 3, 2, 2000, { category: 'slot' }),
      ]),
    ]);
    const hit = out[0]!.shops[0]!;
    expect(hit.hitCount).toBe(1);
    expect(hit.articles[0]).toMatchObject({ units: 9, plusUnits: 8, avgDiff: 5300 });
  });

  it('表記ゆれは displayName と aliases に分かれる', () => {
    const out = aggregate([
      art('u1', '2026-09-01', 'A店', [res('dmm:1', '真・北斗無双 第5章', 1, 1, 1)]),
      art('u2', '2026-09-02', 'B店', [res('dmm:1', '真・北斗無双 第5章', 1, 1, 1)]),
      art('u3', '2026-09-03', 'C店', [res('dmm:1', '北斗無双5', 1, 1, 1)]),
    ]);
    expect(out[0]!.displayName).toBe('真・北斗無双 第5章');
    expect(out[0]!.aliases).toEqual(['北斗無双5']);
  });

  it('機種は記事数の多い順', () => {
    const out = aggregate([
      art('u1', '2026-09-01', 'A店', [res('dmm:1', 'X', 1, 1, 1), res('dmm:2', 'Y', 1, 1, 1)]),
      art('u2', '2026-09-02', 'B店', [res('dmm:2', 'Y', 1, 1, 1)]),
    ]);
    expect(out.map((m) => m.machineKey)).toEqual(['dmm:2', 'dmm:1']);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- aggregate`
Expected: FAIL

- [ ] **Step 3: 実装する**

`crawler/src/aggregate.ts`
```ts
import type { Article, Category, MachineResult, MachineSummary, ShopArticleRef, ShopHit } from '../../shared/types';

interface Merged {
  category: Category;
  machineName: string;
  units: number;
  plusUnits: number;
  avgDiff: number;
  shared?: true;
}

/** 記事内で同じ machineKey を 1 件に統合する */
export function mergeWithinArticle(results: MachineResult[]): Map<string, Merged> {
  const acc = new Map<string, { category: Category; machineName: string; units: number; plus: number; weighted: number; shared: boolean }>();
  for (const r of results) {
    const cur = acc.get(r.machineKey) ?? { category: r.category, machineName: r.machineName, units: 0, plus: 0, weighted: 0, shared: false };
    cur.units += r.units;
    cur.plus += r.plusUnits;
    cur.weighted += r.avgDiff * r.units;
    cur.shared = cur.shared || r.shared === true;
    acc.set(r.machineKey, cur);
  }
  const out = new Map<string, Merged>();
  for (const [key, v] of acc) {
    out.set(key, {
      category: v.category,
      machineName: v.machineName,
      units: v.units,
      plusUnits: v.plus,
      avgDiff: v.units > 0 ? Math.round(v.weighted / v.units) : 0,
      ...(v.shared ? { shared: true as const } : {}),
    });
  }
  return out;
}

interface ShopAcc { storeName: string; prefecture: string; city: string; articles: ShopArticleRef[] }
interface MachineAcc { category: Category; names: Map<string, number>; shops: Map<string, ShopAcc>; hitCount: number }

export function aggregate(articles: Article[]): MachineSummary[] {
  const machines = new Map<string, MachineAcc>();

  for (const a of articles) {
    for (const [key, m] of mergeWithinArticle(a.results)) {
      const macc = machines.get(key) ?? { category: m.category, names: new Map(), shops: new Map(), hitCount: 0 };
      macc.hitCount += 1;
      macc.names.set(m.machineName, (macc.names.get(m.machineName) ?? 0) + 1);

      const shopKey = `${a.store.prefecture}|${a.store.name}`;
      const sacc = macc.shops.get(shopKey) ?? { storeName: a.store.name, prefecture: a.store.prefecture, city: a.store.city, articles: [] };
      sacc.articles.push({
        url: a.url, visitDate: a.visitDate, coverageType: a.coverageType,
        units: m.units, plusUnits: m.plusUnits, avgDiff: m.avgDiff, ...(m.shared ? { shared: true as const } : {}),
      });
      macc.shops.set(shopKey, sacc);
      machines.set(key, macc);
    }
  }

  const summaries: MachineSummary[] = [];
  for (const [machineKey, macc] of machines) {
    const [displayName] = [...macc.names.entries()].sort((x, y) => y[1] - x[1])[0]!;
    const aliases = [...macc.names.keys()].filter((n) => n !== displayName);

    const shops: ShopHit[] = [...macc.shops.values()].map((s) => {
      const articlesDesc = [...s.articles].sort((x, y) => (x.visitDate < y.visitDate ? 1 : x.visitDate > y.visitDate ? -1 : 0));
      const totalUnits = articlesDesc.reduce((n, r) => n + r.units, 0);
      const totalPlus = articlesDesc.reduce((n, r) => n + r.plusUnits, 0);
      return {
        storeName: s.storeName, prefecture: s.prefecture, city: s.city,
        hitCount: articlesDesc.length,
        lastVisitDate: articlesDesc[0]!.visitDate,
        avgDiffMean: Math.round(articlesDesc.reduce((n, r) => n + r.avgDiff, 0) / articlesDesc.length),
        plusRate: totalUnits > 0 ? Math.round((totalPlus / totalUnits) * 1000) / 1000 : 0,
        articles: articlesDesc,
      };
    });
    shops.sort((x, y) =>
      y.hitCount - x.hitCount ||
      (x.lastVisitDate < y.lastVisitDate ? 1 : x.lastVisitDate > y.lastVisitDate ? -1 : 0) ||
      x.storeName.localeCompare(y.storeName, 'ja'),
    );

    summaries.push({ machineKey, displayName, category: macc.category, aliases, hitCount: macc.hitCount, shopCount: shops.length, shops });
  }

  summaries.sort((x, y) => y.hitCount - x.hitCount || x.displayName.localeCompare(y.displayName, 'ja'));
  return summaries;
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test -- aggregate`
Expected: PASS（5 件）

- [ ] **Step 5: コミット**

```bash
git add crawler/src/aggregate.ts crawler/test/aggregate.test.ts
git commit -m "feat: 機種→店舗の集計を追加"
```

---

### Task 13: 差分クロールの制御と実行

**Files:**
- Create: `crawler/src/main.ts`
- Create: `data/.gitkeep`（空ファイル。初回実行までディレクトリを保つ）
- Test: `crawler/test/main.test.ts`

**Interfaces:**
- Produces:
  - `interface CrawlDeps { fetchHtml: (url: string) => Promise<string>; today: string; nowIso: () => string; dataDir: string; maxNewArticles?: number; maxPagesPerArea?: number; log: (msg: string) => void }`
  - `runCrawl(deps: CrawlDeps): Promise<{ added: number; removed: number; errors: CrawlError[]; total: number }>`
  - 異常終了条件: `added === 0 && errors.length >= 10` のとき `Error('解析失敗が多すぎます')` を投げる
  - `main.ts` を直接実行すると `createFetcher()` と `data/` を使って `runCrawl` を呼び、結果をログし、例外時は exit code 1
- Consumes: Task 8 `parseArticle`; Task 9 `parseListing`, `inferVisitDate`, `AREAS`; Task 10 `createFetcher`; Task 11 `readArticles`, `writeArticles`, `writeErrors`, `writeMachines`, `pruneOld`, `cutoffDate`; Task 12 `aggregate`

- [ ] **Step 1: 失敗するテストを書く**

`crawler/test/main.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture } from './helpers';
import { runCrawl } from '../src/main';
import { writeArticles } from '../src/store';

const A1 = 'https://777.slopachi-station.com/a1/';
const A2 = 'https://777.slopachi-station.com/a2/';
const OLD = 'https://777.slopachi-station.com/old/';

function listingHtml(rows: { md: string; url?: string; label: string }[], next: string | null): string {
  const items = rows.map((r) => `<div class="resultRow"><div class="resultRow-detail">${r.md} ( <div class="week1">月</div> ) 【埼玉県草加市】<br>` +
    (r.url ? `<a href="${r.url}">${r.label}&nbsp;&nbsp;店</a>` : `${r.label}&nbsp;&nbsp;店`) + `</div></div>`).join('');
  const paging = next ? `<div class="pagingBox"><a class="next page-numbers" href="${next}">次へ</a></div>` : '';
  return `<html><body><section id="archiveReporList">${items}</section>${paging}</body></html>`;
}

function fakeSite(): Record<string, string> {
  const article = fixture('article-ruibee-2026-09-06.html');
  return {
    'https://777.slopachi-station.com/report_pref/tokyo/': listingHtml([], null),
    'https://777.slopachi-station.com/report/minami-kanto/': listingHtml([], null),
    'https://777.slopachi-station.com/report/kita-kanto/': listingHtml(
      [{ md: '9/6', url: A1, label: 'るいべえ実践来店' }, { md: '9/6', label: 'れんじろう実践来店 (予定)' }],
      'https://777.slopachi-station.com/report/kita-kanto/page/2',
    ),
    'https://777.slopachi-station.com/report/kita-kanto/page/2': listingHtml(
      [{ md: '9/6', url: A2, label: 'るいべえ実践来店' }, { md: '1/1', url: OLD, label: 'るいべえ実践来店' }],
      'https://777.slopachi-station.com/report/kita-kanto/page/3',
    ),
    'https://777.slopachi-station.com/report/kita-kanto/page/3': listingHtml([{ md: '1/2', url: 'https://x/older/', label: 'x' }], null),
    [A1]: article,
    [A2]: article,
  };
}

function makeDeps(site: Record<string, string>, dataDir: string) {
  const fetched: string[] = [];
  const fetchHtml = vi.fn(async (url: string) => {
    fetched.push(url);
    const html = site[url];
    if (html === undefined) throw new Error(`fetch failed: ${url} (404)`);
    return html;
  });
  return { deps: { fetchHtml, today: '2026-09-15', nowIso: () => '2026-09-15T00:00:00.000Z', dataDir, log: () => {} }, fetched };
}

describe('runCrawl', () => {
  it('新規記事だけ取得し、古い一覧に達したら止まり、JSON を書く', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const { deps, fetched } = makeDeps(fakeSite(), dir);
    const r = await runCrawl(deps);

    expect(r.added).toBe(2);
    expect(fetched).toContain(A1);
    expect(fetched).toContain(A2);
    expect(fetched).not.toContain(OLD);                                        // 1/1 は 90 日より古い
    expect(fetched).toContain('https://777.slopachi-station.com/report/kita-kanto/page/3'); // 2 ページ目に期間内が 1 件あるので続く
    expect(fetched).not.toContain('https://x/older/');                         // 3 ページ目は全て古い → 記事は取らず走査終了

    const articles = JSON.parse(await readFile(join(dir, 'articles.json'), 'utf-8'));
    expect(articles.articles).toHaveLength(2);
    const machines = JSON.parse(await readFile(join(dir, 'machines.json'), 'utf-8'));
    expect(machines.machines.length).toBeGreaterThan(10);
    expect(machines.windowDays).toBe(90);
    expect(JSON.parse(await readFile(join(dir, 'errors.json'), 'utf-8'))).toEqual([]);
  });

  it('既知 URL は再取得しない', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const { deps, fetched } = makeDeps(fakeSite(), dir);
    await runCrawl(deps);
    fetched.length = 0;
    const r = await runCrawl(deps);
    expect(r.added).toBe(0);
    expect(fetched.filter((u) => u === A1 || u === A2)).toHaveLength(0);
  });

  it('90 日より古い既存記事は削除される', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    await writeArticles(join(dir, 'articles.json'), [{
      url: OLD, title: 't', visitDate: '2026-01-01', coverageType: 'x',
      store: { name: 's', prefecture: '埼玉県', city: 'c' }, results: [], fetchedAt: 'f',
    }], 'g');
    const { deps } = makeDeps(fakeSite(), dir);
    const r = await runCrawl(deps);
    expect(r.removed).toBe(1);
  });

  it('記事取得に失敗しても続行し errors.json に残す', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const site = fakeSite();
    delete site[A2];
    const { deps } = makeDeps(site, dir);
    const r = await runCrawl(deps);
    expect(r.added).toBe(1);
    expect(r.errors).toEqual([{ url: A2, reason: expect.stringContaining('404'), at: '2026-09-15T00:00:00.000Z' }]);
  });

  it('一覧取得に失敗したエリアはスキップして続行する', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const site = fakeSite();
    delete site['https://777.slopachi-station.com/report_pref/tokyo/'];
    const { deps } = makeDeps(site, dir);
    const r = await runCrawl(deps);
    expect(r.added).toBe(2);
    expect(r.errors.some((e) => e.url.includes('report_pref/tokyo'))).toBe(true);
  });

  it('新規 0 件かつ解析失敗 10 件以上なら例外', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crawl-'));
    const rows = Array.from({ length: 10 }, (_, i) => ({ md: '9/6', url: `https://777.slopachi-station.com/bad${i}/`, label: 'x' }));
    const site: Record<string, string> = {
      'https://777.slopachi-station.com/report_pref/tokyo/': listingHtml([], null),
      'https://777.slopachi-station.com/report/minami-kanto/': listingHtml([], null),
      'https://777.slopachi-station.com/report/kita-kanto/': listingHtml(rows, null),
    };
    for (const r of rows) site[r.url] = '<html><head><title>t</title></head><body><div class="entry col-md-12"></div></body></html>';
    const { deps } = makeDeps(site, dir);
    await expect(runCrawl(deps)).rejects.toThrow('解析失敗が多すぎます');
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter crawler test -- main`
Expected: FAIL

- [ ] **Step 3: 実装する**

`crawler/src/main.ts`
```ts
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Article, CrawlError } from '../../shared/types';
import { AREAS, inferVisitDate, parseListing, type ListingEntry } from './listing';
import { parseArticle } from './parse/article';
import { createFetcher } from './fetch';
import { aggregate } from './aggregate';
import { cutoffDate, pruneOld, readArticles, writeArticles, writeErrors, writeMachines } from './store';

export const WINDOW_DAYS = 90;
const DEFAULT_MAX_NEW = 300;
const DEFAULT_MAX_PAGES = 60;
const FAILURE_THRESHOLD = 10;

export interface CrawlDeps {
  fetchHtml: (url: string) => Promise<string>;
  today: string;             // 'YYYY-MM-DD'
  nowIso: () => string;
  dataDir: string;
  maxNewArticles?: number;
  maxPagesPerArea?: number;
  log: (msg: string) => void;
}

export interface CrawlResult { added: number; removed: number; errors: CrawlError[]; total: number }

async function collectNewUrls(deps: CrawlDeps, known: Set<string>, errors: CrawlError[]): Promise<string[]> {
  const cutoff = cutoffDate(deps.today, WINDOW_DAYS);
  const today = new Date(`${deps.today}T00:00:00`);
  const maxPages = deps.maxPagesPerArea ?? DEFAULT_MAX_PAGES;
  const queue: string[] = [];
  const seen = new Set<string>();

  for (const area of AREAS) {
    let url: string | null = area.url;
    for (let page = 0; url && page < maxPages; page++) {
      let entries: ListingEntry[];
      let nextUrl: string | null;
      try {
        ({ entries, nextUrl } = parseListing(await deps.fetchHtml(url)));
      } catch (e) {
        errors.push({ url, reason: e instanceof Error ? e.message : String(e), at: deps.nowIso() });
        deps.log(`一覧取得失敗: ${url}`);
        break;
      }
      const inWindow = entries.filter((e) => inferVisitDate(e.month, e.day, today) >= cutoff);
      for (const e of inWindow) {
        if (!known.has(e.url) && !seen.has(e.url)) { seen.add(e.url); queue.push(e.url); }
      }
      deps.log(`${area.name} p${page + 1}: ${entries.length} 件中 期間内 ${inWindow.length} 件`);
      if (entries.length > 0 && inWindow.length === 0) break;
      url = nextUrl;
    }
  }
  return queue;
}

export async function runCrawl(deps: CrawlDeps): Promise<CrawlResult> {
  const articlesPath = join(deps.dataDir, 'articles.json');
  const errors: CrawlError[] = [];

  const existing = await readArticles(articlesPath);
  const kept = pruneOld(existing, deps.today, WINDOW_DAYS);
  const removed = existing.length - kept.length;
  const known = new Set(kept.map((a) => a.url));

  const queue = (await collectNewUrls(deps, known, errors)).slice(0, deps.maxNewArticles ?? DEFAULT_MAX_NEW);
  deps.log(`新規取得対象 ${queue.length} 件`);

  const added: Article[] = [];
  for (const url of queue) {
    try {
      const html = await deps.fetchHtml(url);
      const r = parseArticle(html, url, deps.nowIso());
      if (r.ok) added.push(r.article);
      else errors.push({ url, reason: r.reason, at: deps.nowIso() });
    } catch (e) {
      errors.push({ url, reason: e instanceof Error ? e.message : String(e), at: deps.nowIso() });
    }
  }

  const all = pruneOld([...kept, ...added], deps.today, WINDOW_DAYS);
  const generatedAt = deps.nowIso();
  await writeArticles(articlesPath, all, generatedAt);
  await writeErrors(join(deps.dataDir, 'errors.json'), errors);
  await writeMachines(join(deps.dataDir, 'machines.json'), aggregate(all), generatedAt);

  deps.log(`追加 ${added.length} / 削除 ${removed} / 失敗 ${errors.length} / 合計 ${all.length}`);
  if (added.length === 0 && errors.length >= FAILURE_THRESHOLD) {
    throw new Error(`解析失敗が多すぎます（${errors.length} 件）。サイト構造の変更を確認してください`);
  }
  return { added: added.length, removed, errors, total: all.length };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const dataDir = join(fileURLToPath(new URL('../../data/', import.meta.url)));
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }); // 'YYYY-MM-DD'
  runCrawl({
    fetchHtml: createFetcher(),
    today,
    nowIso: () => new Date().toISOString(),
    dataDir,
    maxNewArticles: Number(process.env['MAX_NEW_ARTICLES'] ?? DEFAULT_MAX_NEW),
    log: (m) => console.log(m),
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

`data/.gitkeep` は空ファイル。

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter crawler test`
Expected: 全テスト PASS。`vi.fn` の型で `fetchHtml` が合わなければ `fetchHtml: fetchHtml as (url: string) => Promise<string>` とキャストする。

- [ ] **Step 5: 実サイトで小さく動作確認する（新規 5 件だけ）**

Run: `cd /Users/kohei/Developer/パチンコ系 && MAX_NEW_ARTICLES=5 pnpm crawl && ls -la data && node -e "const m=require('./data/machines.json');console.log(m.machines.length, m.machines.slice(0,3).map(x=>[x.displayName,x.category,x.hitCount]))"`
Expected: `data/articles.json`（5 件）、`machines.json`、`errors.json` が生成される。errors.json が空でなければ理由を読み、パーサの取りこぼしなら該当記事を HTML として保存してフィクスチャに加え、Task 6〜8 のテストを増やして直す。

- [ ] **Step 6: コミット（生成データは含めない）**

```bash
git add crawler/src/main.ts crawler/test/main.test.ts data/.gitkeep
git commit -m "feat: 差分クロールの制御と実行エントリを追加"
```

---

### Task 14: Web パッケージの土台とデザイントークン

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/vitest.config.ts`, `web/index.html`
- Create: `web/src/main.tsx`, `web/src/App.tsx`（仮。Task 17 で置き換える）
- Create: `web/src/styles/tokens.css`
- Create: `web/test/setup.ts`
- Test: `web/test/App.test.tsx`

**Interfaces:**
- Produces: `web/` が `pnpm --filter web dev|build|test` で動く。`import.meta.env.BASE_URL + 'machines.json'` で `data/machines.json` が配信される（`publicDir` を `../data` に向ける）。CSS 変数 `--bg --surface --ink --ink-soft --rule --plus --minus --sign --sign-ink --font-display --font-body --measure`。

- [ ] **Step 1: パッケージ設定を書く**

`web/package.json`
```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

`web/tsconfig.json`
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "noEmit": true
  },
  "include": ["src", "test", "../shared", "vite.config.ts", "vitest.config.ts"]
}
```

`web/vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: process.env['VITE_BASE'] ?? '/',
  publicDir: resolve(__dirname, '../data'),
  server: { fs: { allow: [resolve(__dirname, '..')] } },
});
```

`web/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['test/setup.ts'], include: ['test/**/*.test.{ts,tsx}'] },
});
```

`web/test/setup.ts`
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: index.html（フォント・noindex）を書く**

`web/index.html`
```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>スロパチ取材 店さがし</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Dela+Gothic+One&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: トークン CSS を書く**

`web/src/styles/tokens.css`
```css
:root {
  color-scheme: light dark;
  --bg: #eef0f3;
  --surface: #ffffff;
  --ink: #1c2230;
  --ink-soft: #5b6270;
  --rule: #c9cdd4;
  --plus: #e03a2f;
  --minus: #2e6fd1;
  --sign: #f5c400;
  --sign-ink: #1c2230;
  --font-display: 'Dela Gothic One', 'BIZ UDPGothic', sans-serif;
  --font-body: 'BIZ UDPGothic', 'Hiragino Sans', 'Yu Gothic', sans-serif;
  --measure: 880px;
  --space: 8px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14171c;
    --surface: #1e232b;
    --ink: #e9ecf1;
    --ink-soft: #a5acb8;
    --rule: #3a414c;
  }
}

html { background: var(--bg); }
body {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.7;
  font-feature-settings: 'palt';
}
* { box-sizing: border-box; }
:focus-visible { outline: 3px solid var(--sign); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}
```

- [ ] **Step 4: 仮の App と main を書く**

`web/src/main.tsx`
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`web/src/App.tsx`（仮）
```tsx
export function App() {
  return <h1>スロパチ取材 店さがし</h1>;
}
```

- [ ] **Step 5: スモークテストを書く**

`web/test/App.test.tsx`
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../src/App';

describe('App', () => {
  it('タイトルを表示する', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'スロパチ取材 店さがし' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: インストールしてテストとビルドを通す**

Run: `cd /Users/kohei/Developer/パチンコ系 && pnpm install && pnpm --filter web test && pnpm --filter web build && ls web/dist`
Expected: テスト PASS、`web/dist/index.html` と `web/dist/machines.json`（Task 13 Step 5 のデータがあれば）が生成される

- [ ] **Step 7: コミット**

```bash
git add web pnpm-lock.yaml
git commit -m "chore: Web パッケージ（Vite + React）とデザイントークンを追加"
```

---

### Task 15: 画面ロジック（検索・絞り込み・URL 状態・表示整形）

**Files:**
- Create: `web/src/lib/rank.ts`, `web/src/lib/urlState.ts`, `web/src/lib/format.ts`
- Test: `web/test/rank.test.ts`, `web/test/urlState.test.ts`, `web/test/format.test.ts`

**Interfaces:**
- Produces（`rank.ts`）:
  - `searchMachines(machines: MachineSummary[], category: Category, query: string, limit = 20): MachineSummary[]` — `category` 一致のみ。`query` 空なら `hitCount` 上位 `limit` 件。非空なら表示名・別名を `normalizeForSearch` した部分一致
  - `normalizeForSearch(s: string): string` — 全角英数→半角、空白除去、小文字化、カタカナ→ひらがなは行わない
  - `interface ShopFilter { prefectures: string[]; coverageTypes: string[] }`
  - `filterShops(machine: MachineSummary, f: ShopFilter): ShopHit[]` — 都道府県で店舗を絞り、取材種別で記事を絞って `hitCount / lastVisitDate / avgDiffMean / plusRate` を再計算。記事 0 件になった店舗は除く。並びは回数降順→直近降順→店舗名昇順
  - `availableFilters(machine: MachineSummary): { prefectures: string[]; coverageTypes: string[] }` — 出現順ではなく件数の多い順
  - `interface StoreMatch { storeName: string; prefecture: string; city: string; machines: { machineKey: string; displayName: string; category: Category; hitCount: number; lastVisitDate: string; avgDiffMean: number }[] }`
  - `lookupStores(machines: MachineSummary[], query: string, category: Category): StoreMatch[]` — 店舗名部分一致。店舗ごとに機種を `hitCount` 降順
- Produces（`urlState.ts`）:
  - `interface AppState { view: 'machine' | 'store'; category: Category; machineKey: string | null; prefectures: string[]; coverageTypes: string[]; storeQuery: string }`
  - `DEFAULT_STATE: AppState` — `{ view: 'machine', category: 'pachinko', machineKey: null, prefectures: [], coverageTypes: [], storeQuery: '' }`
  - `parseState(search: string): AppState` — クエリ `v, c, m, pref, type, shop`。`pref`/`type` はカンマ区切り
  - `serializeState(s: AppState): string` — 既定値と同じ項目は省く。先頭 `?`。全て既定なら空文字
- Produces（`format.ts`）:
  - `formatDiff(n: number, category: Category): string` — `'+4,620玉'` / `'-300枚'` / `'±0玉'`
  - `formatRate(r: number): string` — `0.667` → `'67%'`
  - `formatShortDate(iso: string): string` — `'2026-09-13'` → `'9/13'`
  - `formatDate(iso: string): string` — `'2026年9月13日'`
  - `unitLabel(category: Category): string` — `'玉'` / `'枚'`

- [ ] **Step 1: 失敗するテストを書く**

`web/test/format.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { formatDiff, formatRate, formatShortDate, formatDate } from '../src/lib/format';

describe('format', () => {
  it('差玉・差枚', () => {
    expect(formatDiff(4620, 'pachinko')).toBe('+4,620玉');
    expect(formatDiff(-300, 'slot')).toBe('-300枚');
    expect(formatDiff(0, 'pachinko')).toBe('±0玉');
  });
  it('率と日付', () => {
    expect(formatRate(0.667)).toBe('67%');
    expect(formatShortDate('2026-09-13')).toBe('9/13');
    expect(formatDate('2026-09-13')).toBe('2026年9月13日');
  });
});
```

`web/test/urlState.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { parseState, serializeState, DEFAULT_STATE } from '../src/lib/urlState';

describe('urlState', () => {
  it('空クエリは既定値', () => {
    expect(parseState('')).toEqual(DEFAULT_STATE);
    expect(parseState('?')).toEqual(DEFAULT_STATE);
  });
  it('往復で一致する', () => {
    const s = { view: 'machine' as const, category: 'slot' as const, machineKey: 'name:東京喰種', prefectures: ['埼玉県', '千葉県'], coverageTypes: ['るいべえ実践来店'], storeQuery: '' };
    const q = serializeState(s);
    expect(q.startsWith('?')).toBe(true);
    expect(parseState(q)).toEqual(s);
  });
  it('既定値は省く', () => {
    expect(serializeState(DEFAULT_STATE)).toBe('');
    expect(serializeState({ ...DEFAULT_STATE, category: 'slot' })).toBe('?c=slot');
  });
  it('店舗ビュー', () => {
    expect(parseState('?v=store&shop=草加')).toMatchObject({ view: 'store', storeQuery: '草加' });
  });
  it('不正な値は既定値に落とす', () => {
    expect(parseState('?c=bogus&v=x').category).toBe('pachinko');
    expect(parseState('?c=bogus&v=x').view).toBe('machine');
  });
});
```

`web/test/rank.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import type { MachineSummary, ShopHit } from '../../shared/types';
import { searchMachines, filterShops, availableFilters, lookupStores, normalizeForSearch } from '../src/lib/rank';

function shop(storeName: string, prefecture: string, articles: { d: string; t: string; avg: number; units?: number; plus?: number }[]): ShopHit {
  const arts = articles.map((a) => ({ url: `u-${a.d}`, visitDate: a.d, coverageType: a.t, units: a.units ?? 4, plusUnits: a.plus ?? 2, avgDiff: a.avg }));
  arts.sort((x, y) => (x.visitDate < y.visitDate ? 1 : -1));
  return {
    storeName, prefecture, city: 'c', hitCount: arts.length, lastVisitDate: arts[0]!.visitDate,
    avgDiffMean: Math.round(arts.reduce((n, a) => n + a.avgDiff, 0) / arts.length),
    plusRate: arts.reduce((n, a) => n + a.plusUnits, 0) / arts.reduce((n, a) => n + a.units, 0), articles: arts,
  };
}
function machine(key: string, displayName: string, category: 'pachinko' | 'slot', shops: ShopHit[], aliases: string[] = []): MachineSummary {
  return { machineKey: key, displayName, category, aliases, hitCount: shops.reduce((n, s) => n + s.hitCount, 0), shopCount: shops.length, shops };
}

const hokuto = machine('dmm:1', '真・北斗無双 第5章', 'pachinko', [
  shop('A店', '埼玉県', [{ d: '2026-09-01', t: 'るいべえ実践来店', avg: 1000 }, { d: '2026-09-05', t: 'スロパチステーション来店取材', avg: -500 }]),
  shop('B店', '千葉県', [{ d: '2026-09-10', t: 'るいべえ実践来店', avg: 8000 }]),
]);
const bancho = machine('dmm:2', '押忍！番長 漢の頂', 'pachinko', [shop('A店', '埼玉県', [{ d: '2026-09-01', t: 'るいべえ実践来店', avg: 100 }])]);
const gul = machine('name:東京喰種', '東京喰種', 'slot', [shop('C店', '埼玉県', [{ d: '2026-09-02', t: 'るいべえ実践来店', avg: 3000 }])]);
const all = [hokuto, bancho, gul];

describe('normalizeForSearch', () => {
  it('全角・空白・大文字を吸収', () => {
    expect(normalizeForSearch('ＳＡＯ２ 閃光')).toBe('sao2閃光');
  });
});

describe('searchMachines', () => {
  it('空クエリは種別内の回数上位', () => {
    expect(searchMachines(all, 'pachinko', '').map((m) => m.machineKey)).toEqual(['dmm:1', 'dmm:2']);
    expect(searchMachines(all, 'slot', '')).toHaveLength(1);
  });
  it('部分一致（空白・全角を無視）', () => {
    expect(searchMachines(all, 'pachinko', '北斗無双第５章').map((m) => m.machineKey)).toEqual(['dmm:1']);
    expect(searchMachines(all, 'pachinko', '喰種')).toEqual([]);
  });
  it('別名にも当たる', () => {
    const m = machine('dmm:9', '正式名', 'pachinko', [], ['ニックネーム']);
    expect(searchMachines([m], 'pachinko', 'ニック')).toHaveLength(1);
  });
});

describe('filterShops', () => {
  it('絞り込み無しは元の順', () => {
    expect(filterShops(hokuto, { prefectures: [], coverageTypes: [] }).map((s) => s.storeName)).toEqual(['A店', 'B店']);
  });
  it('都道府県で店舗を絞る', () => {
    expect(filterShops(hokuto, { prefectures: ['千葉県'], coverageTypes: [] }).map((s) => s.storeName)).toEqual(['B店']);
  });
  it('取材種別で記事を絞り、数値を再計算する', () => {
    const r = filterShops(hokuto, { prefectures: [], coverageTypes: ['るいべえ実践来店'] });
    expect(r.map((s) => [s.storeName, s.hitCount])).toEqual([['B店', 1], ['A店', 1]]); // 同数 → 直近が新しい B が先
    expect(r[1]).toMatchObject({ avgDiffMean: 1000, lastVisitDate: '2026-09-01' });
  });
  it('記事が 0 件になった店舗は消える', () => {
    expect(filterShops(hokuto, { prefectures: [], coverageTypes: ['スロパチステーション来店取材'] }).map((s) => s.storeName)).toEqual(['A店']);
  });
});

describe('availableFilters', () => {
  it('件数の多い順に並ぶ', () => {
    expect(availableFilters(hokuto)).toEqual({ prefectures: ['埼玉県', '千葉県'], coverageTypes: ['るいべえ実践来店', 'スロパチステーション来店取材'] });
  });
});

describe('lookupStores', () => {
  it('店舗名の部分一致で、その店の機種を回数順に返す', () => {
    const r = lookupStores(all, 'A', 'pachinko');
    expect(r).toHaveLength(1);
    expect(r[0]!.storeName).toBe('A店');
    expect(r[0]!.machines.map((m) => m.displayName)).toEqual(['真・北斗無双 第5章', '押忍！番長 漢の頂']);
  });
  it('空クエリは空配列', () => {
    expect(lookupStores(all, '', 'pachinko')).toEqual([]);
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter web test`
Expected: FAIL（3 ファイル）

- [ ] **Step 3: 実装する**

`web/src/lib/format.ts`
```ts
import type { Category } from '../../../shared/types';

export function unitLabel(category: Category): string {
  return category === 'pachinko' ? '玉' : '枚';
}

export function formatDiff(n: number, category: Category): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '±';
  return `${sign}${Math.abs(n).toLocaleString('ja-JP')}${unitLabel(category)}`;
}

export function formatRate(r: number): string {
  return `${Math.round(r * 100)}%`;
}

export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}
```

`web/src/lib/urlState.ts`
```ts
import type { Category } from '../../../shared/types';

export interface AppState {
  view: 'machine' | 'store';
  category: Category;
  machineKey: string | null;
  prefectures: string[];
  coverageTypes: string[];
  storeQuery: string;
}

export const DEFAULT_STATE: AppState = {
  view: 'machine',
  category: 'pachinko',
  machineKey: null,
  prefectures: [],
  coverageTypes: [],
  storeQuery: '',
};

function list(v: string | null): string[] {
  return v ? v.split(',').filter(Boolean) : [];
}

export function parseState(search: string): AppState {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const v = q.get('v');
  const c = q.get('c');
  return {
    view: v === 'store' ? 'store' : 'machine',
    category: c === 'slot' ? 'slot' : 'pachinko',
    machineKey: q.get('m') || null,
    prefectures: list(q.get('pref')),
    coverageTypes: list(q.get('type')),
    storeQuery: q.get('shop') ?? '',
  };
}

export function serializeState(s: AppState): string {
  const q = new URLSearchParams();
  if (s.view !== DEFAULT_STATE.view) q.set('v', s.view);
  if (s.category !== DEFAULT_STATE.category) q.set('c', s.category);
  if (s.machineKey) q.set('m', s.machineKey);
  if (s.prefectures.length) q.set('pref', s.prefectures.join(','));
  if (s.coverageTypes.length) q.set('type', s.coverageTypes.join(','));
  if (s.storeQuery) q.set('shop', s.storeQuery);
  const str = q.toString();
  return str ? `?${str}` : '';
}
```

`web/src/lib/rank.ts`
```ts
import type { Category, MachineSummary, ShopArticleRef, ShopHit } from '../../../shared/types';

export function normalizeForSearch(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　]+/g, '')
    .toLowerCase();
}

export function searchMachines(machines: MachineSummary[], category: Category, query: string, limit = 20): MachineSummary[] {
  const inCategory = machines.filter((m) => m.category === category);
  const q = normalizeForSearch(query);
  if (q === '') return inCategory.slice(0, limit);
  return inCategory.filter((m) => [m.displayName, ...m.aliases].some((n) => normalizeForSearch(n).includes(q)));
}

export interface ShopFilter {
  prefectures: string[];
  coverageTypes: string[];
}

function rebuildShop(base: ShopHit, articles: ShopArticleRef[]): ShopHit {
  const totalUnits = articles.reduce((n, a) => n + a.units, 0);
  const totalPlus = articles.reduce((n, a) => n + a.plusUnits, 0);
  return {
    ...base,
    hitCount: articles.length,
    lastVisitDate: articles[0]!.visitDate,
    avgDiffMean: Math.round(articles.reduce((n, a) => n + a.avgDiff, 0) / articles.length),
    plusRate: totalUnits > 0 ? Math.round((totalPlus / totalUnits) * 1000) / 1000 : 0,
    articles,
  };
}

function compareShops(x: ShopHit, y: ShopHit): number {
  return (
    y.hitCount - x.hitCount ||
    (x.lastVisitDate < y.lastVisitDate ? 1 : x.lastVisitDate > y.lastVisitDate ? -1 : 0) ||
    x.storeName.localeCompare(y.storeName, 'ja')
  );
}

export function filterShops(machine: MachineSummary, f: ShopFilter): ShopHit[] {
  const byPref = f.prefectures.length ? machine.shops.filter((s) => f.prefectures.includes(s.prefecture)) : machine.shops;
  if (f.coverageTypes.length === 0) return [...byPref].sort(compareShops);
  return byPref
    .map((s) => ({ s, arts: s.articles.filter((a) => f.coverageTypes.includes(a.coverageType)) }))
    .filter(({ arts }) => arts.length > 0)
    .map(({ s, arts }) => rebuildShop(s, arts))
    .sort(compareShops);
}

function countDesc(items: string[]): string[] {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja')).map(([k]) => k);
}

export function availableFilters(machine: MachineSummary): { prefectures: string[]; coverageTypes: string[] } {
  return {
    prefectures: countDesc(machine.shops.flatMap((s) => s.articles.map(() => s.prefecture))),
    coverageTypes: countDesc(machine.shops.flatMap((s) => s.articles.map((a) => a.coverageType))),
  };
}

export interface StoreMatch {
  storeName: string;
  prefecture: string;
  city: string;
  machines: { machineKey: string; displayName: string; category: Category; hitCount: number; lastVisitDate: string; avgDiffMean: number }[];
}

export function lookupStores(machines: MachineSummary[], query: string, category: Category): StoreMatch[] {
  const q = normalizeForSearch(query);
  if (q === '') return [];
  const acc = new Map<string, StoreMatch>();
  for (const m of machines) {
    if (m.category !== category) continue;
    for (const s of m.shops) {
      if (!normalizeForSearch(s.storeName).includes(q)) continue;
      const key = `${s.prefecture}|${s.storeName}`;
      const cur = acc.get(key) ?? { storeName: s.storeName, prefecture: s.prefecture, city: s.city, machines: [] };
      cur.machines.push({ machineKey: m.machineKey, displayName: m.displayName, category: m.category, hitCount: s.hitCount, lastVisitDate: s.lastVisitDate, avgDiffMean: s.avgDiffMean });
      acc.set(key, cur);
    }
  }
  const out = [...acc.values()];
  for (const st of out) st.machines.sort((a, b) => b.hitCount - a.hitCount || (a.lastVisitDate < b.lastVisitDate ? 1 : -1));
  out.sort((a, b) => b.machines.length - a.machines.length || a.storeName.localeCompare(b.storeName, 'ja'));
  return out;
}
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter web test`
Expected: 全 PASS

- [ ] **Step 5: コミット**

```bash
git add web/src/lib web/test/rank.test.ts web/test/urlState.test.ts web/test/format.test.ts
git commit -m "feat: 画面ロジック（検索・絞り込み・URL 状態・表示整形）を追加"
```

---

### Task 16: コンポーネントとスタイル

**Files:**
- Create: `web/src/components/CategoryToggle.tsx`, `MachineSearch.tsx`, `MachineHero.tsx`, `Filters.tsx`, `ShopRow.tsx`, `ShopDetail.tsx`, `StoreLookup.tsx`
- Create: `web/src/styles/app.css`
- Test: `web/test/ShopRow.test.tsx`, `web/test/MachineSearch.test.tsx`

**Interfaces:**
- Produces（props はすべて制御コンポーネント。状態は App が持つ）:
  - `CategoryToggle({ value: Category; onChange(c: Category): void })`
  - `MachineSearch({ machines: MachineSummary[]; category: Category; query: string; onQueryChange(q: string): void; onSelect(key: string): void })` — 候補は `searchMachines` で計算。候補行に表示名・件数・店舗数
  - `MachineHero({ machine: MachineSummary; windowDays: number })`
  - `Filters({ options: { prefectures: string[]; coverageTypes: string[] }; value: ShopFilter; onChange(v: ShopFilter): void })` — チェックボックス群 2 組
  - `ShopRow({ shop: ShopHit; category: Category; open: boolean; onToggle(): void })` — `<li>` を返す。ボタンに `aria-expanded`。セグメント列は `articles` を古い順に並べ、`avgDiff > 0` で `seg plus`、それ以外 `seg minus`。`open` なら `ShopDetail` を描く
  - `ShopDetail({ shop: ShopHit; category: Category })` — 記事ごとに日付・取材種別・台数・プラス台・平均差玉・元記事リンク（`target="_blank" rel="noopener"`）
  - `StoreLookup({ matches: StoreMatch[]; query: string; onQueryChange(q: string): void; onSelectMachine(key: string): void })`
- Consumes: Task 15 の `searchMachines`, `formatDiff`, `formatRate`, `formatShortDate`, `formatDate`, `ShopFilter`, `StoreMatch`

- [ ] **Step 1: 失敗するテストを書く**

`web/test/ShopRow.test.tsx`
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShopHit } from '../../shared/types';
import { ShopRow } from '../src/components/ShopRow';

const shop: ShopHit = {
  storeName: 'ピーアーク草加', prefecture: '埼玉県', city: '草加市', hitCount: 3, lastVisitDate: '2026-09-13',
  avgDiffMean: 4620, plusRate: 0.667,
  articles: [
    { url: 'https://s/3/', visitDate: '2026-09-13', coverageType: 'るいべえ実践来店', units: 3, plusUnits: 2, avgDiff: 13700 },
    { url: 'https://s/2/', visitDate: '2026-09-06', coverageType: 'スロぱちガール来店PS', units: 4, plusUnits: 1, avgDiff: -1830 },
    { url: 'https://s/1/', visitDate: '2026-08-30', coverageType: 'るいべえ実践来店', units: 2, plusUnits: 2, avgDiff: 2000 },
  ],
};

describe('ShopRow', () => {
  it('回数・店舗名・所在地・平均・プラス台率・直近日を出す', () => {
    render(<ul><ShopRow shop={shop} category="pachinko" open={false} onToggle={() => {}} /></ul>);
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('ピーアーク草加')).toBeInTheDocument();
    expect(within(row).getByText('埼玉県 草加市')).toBeInTheDocument();
    expect(within(row).getByText('+4,620玉')).toBeInTheDocument();
    expect(within(row).getByText('67%')).toBeInTheDocument();
    expect(within(row).getByText('9/13')).toBeInTheDocument();
  });

  it('セグメントは記事数ぶん、古い順に赤青が付く', () => {
    render(<ul><ShopRow shop={shop} category="pachinko" open={false} onToggle={() => {}} /></ul>);
    const segs = screen.getByRole('listitem').querySelectorAll('.seg');
    expect(segs).toHaveLength(3);
    expect(segs[0]).toHaveClass('plus');   // 8/30 +2000
    expect(segs[1]).toHaveClass('minus');  // 9/6 -1830
    expect(segs[2]).toHaveClass('plus');   // 9/13 +13700
  });

  it('開くと記事一覧と元記事リンクが出る', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ul><ShopRow shop={shop} category="pachinko" open={false} onToggle={onToggle} /></ul>);
    await userEvent.click(screen.getByRole('button', { expanded: false }));
    expect(onToggle).toHaveBeenCalled();
    rerender(<ul><ShopRow shop={shop} category="pachinko" open={true} onToggle={onToggle} /></ul>);
    expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: '元記事' });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', 'https://s/3/');
    expect(screen.getByText('2026年9月6日')).toBeInTheDocument();
  });
});
```

`web/test/MachineSearch.test.tsx`
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MachineSummary } from '../../shared/types';
import { MachineSearch } from '../src/components/MachineSearch';

function m(key: string, displayName: string, hitCount: number, category: 'pachinko' | 'slot' = 'pachinko'): MachineSummary {
  return { machineKey: key, displayName, category, aliases: [], hitCount, shopCount: 1, shops: [] };
}
const machines = [m('dmm:1', '真・北斗無双 第5章', 9), m('dmm:2', '押忍！番長 漢の頂', 5), m('name:喰種', '東京喰種', 7, 'slot')];

describe('MachineSearch', () => {
  it('空入力では種別内の上位機種を候補に出す', () => {
    render(<MachineSearch machines={machines} category="pachinko" query="" onQueryChange={() => {}} onSelect={() => {}} />);
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('真・北斗無双 第5章'), expect.stringContaining('押忍！番長 漢の頂')]);
  });

  it('入力で候補が絞られ、選ぶと onSelect が呼ばれる', async () => {
    const onSelect = vi.fn();
    render(<MachineSearch machines={machines} category="pachinko" query="番長" onQueryChange={() => {}} onSelect={onSelect} />);
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.click(screen.getByRole('option'));
    expect(onSelect).toHaveBeenCalledWith('dmm:2');
  });

  it('該当なしの文言', () => {
    render(<MachineSearch machines={machines} category="pachinko" query="存在しない" onQueryChange={() => {}} onSelect={() => {}} />);
    expect(screen.getByText('この名前の機種は直近90日の取材に載っていません。別の表記で試してください。')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter web test`
Expected: FAIL（ShopRow, MachineSearch）

- [ ] **Step 3: コンポーネントを実装する**

`web/src/components/CategoryToggle.tsx`
```tsx
import type { Category } from '../../../shared/types';

export function CategoryToggle({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div className="toggle" role="radiogroup" aria-label="種別">
      {(['pachinko', 'slot'] as const).map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} className="toggle-item" onClick={() => onChange(c)}>
          {c === 'pachinko' ? 'パチンコ' : 'スロット'}
        </button>
      ))}
    </div>
  );
}
```

`web/src/components/MachineSearch.tsx`
```tsx
import { useId } from 'react';
import type { Category, MachineSummary } from '../../../shared/types';
import { searchMachines } from '../lib/rank';

interface Props {
  machines: MachineSummary[];
  category: Category;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (machineKey: string) => void;
}

export function MachineSearch({ machines, category, query, onQueryChange, onSelect }: Props) {
  const id = useId();
  const candidates = searchMachines(machines, category, query);
  const isBrowsing = query.trim() === '';

  return (
    <section className="search" aria-labelledby={`${id}-label`}>
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
      <p className="search-hint">{isBrowsing ? '直近90日でよく取材に載った機種' : `${candidates.length}件`}</p>
      {candidates.length === 0 ? (
        <p className="empty">この名前の機種は直近90日の取材に載っていません。別の表記で試してください。</p>
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
```

`web/src/components/MachineHero.tsx`
```tsx
import type { MachineSummary } from '../../../shared/types';

export function MachineHero({ machine, windowDays }: { machine: MachineSummary; windowDays: number }) {
  return (
    <section className="hero" aria-label="選んだ機種">
      <h2 className="hero-name">{machine.displayName}</h2>
      <p className="hero-meta">直近{windowDays}日で取材{machine.hitCount}件、{machine.shopCount}店舗</p>
      {machine.aliases.length > 0 && <p className="hero-aliases">記事上の別表記: {machine.aliases.join('、')}</p>}
    </section>
  );
}
```

`web/src/components/Filters.tsx`
```tsx
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
```

`web/src/components/ShopDetail.tsx`
```tsx
import type { Category, ShopHit } from '../../../shared/types';
import { formatDate, formatDiff } from '../lib/format';

export function ShopDetail({ shop, category }: { shop: ShopHit; category: Category }) {
  return (
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
            <td className={`num ${a.avgDiff > 0 ? 'plus' : a.avgDiff < 0 ? 'minus' : ''}`}>{formatDiff(a.avgDiff, category)}</td>
            <td><a href={a.url} target="_blank" rel="noopener">元記事</a></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`web/src/components/ShopRow.tsx`
```tsx
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
          <span className="segs" aria-label={`取材${shop.hitCount}件のうちプラス${chronological.filter((a) => a.avgDiff > 0).length}件`}>
            {chronological.map((a) => (
              <i key={a.url} className={`seg ${a.avgDiff > 0 ? 'plus' : 'minus'}`} title={`${formatShortDate(a.visitDate)} ${formatDiff(a.avgDiff, category)}`} />
            ))}
          </span>
          <span className="stat"><span className="stat-label">平均</span><span className={shop.avgDiffMean > 0 ? 'plus' : shop.avgDiffMean < 0 ? 'minus' : ''}>{formatDiff(shop.avgDiffMean, category)}</span></span>
          <span className="stat"><span className="stat-label">プラス台</span><span>{formatRate(shop.plusRate)}</span></span>
          <span className="stat"><span className="stat-label">直近</span><span>{formatShortDate(shop.lastVisitDate)}</span></span>
        </span>
      </button>
      {open && <ShopDetail shop={shop} category={category} />}
    </li>
  );
}
```

`web/src/components/StoreLookup.tsx`
```tsx
import { useId } from 'react';
import type { StoreMatch } from '../lib/rank';
import { formatDiff, formatShortDate } from '../lib/format';

interface Props {
  matches: StoreMatch[];
  query: string;
  onQueryChange: (q: string) => void;
  onSelectMachine: (machineKey: string) => void;
}

export function StoreLookup({ matches, query, onQueryChange, onSelectMachine }: Props) {
  const id = useId();
  return (
    <section className="search" aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={`${id}-input`} className="search-label">店舗名で探す</label>
      <input id={`${id}-input`} className="search-input" type="search" value={query} placeholder="例: 草加、マルハン" autoComplete="off"
             onChange={(e) => onQueryChange(e.target.value)} />
      {query.trim() === '' ? (
        <p className="empty">店舗名の一部を入れると、その店で直近90日に取材で載った機種が出ます。</p>
      ) : matches.length === 0 ? (
        <p className="empty">この名前の店舗は直近90日の取材にありません。</p>
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
```

- [ ] **Step 4: スタイルを書く**

`web/src/styles/app.css`
```css
.page { max-width: var(--measure); margin: 0 auto; padding: 16px 16px 64px; }

/* 上部 */
.top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; padding-block: 8px 16px; border-bottom: 1px solid var(--rule); }
.top h1 { font-family: var(--font-display); font-size: 22px; font-weight: 400; margin: 0; letter-spacing: 0.02em; }
.top-nav { display: flex; gap: 16px; align-items: center; }
.toggle { display: inline-flex; border: 1px solid var(--ink); }
.toggle-item { font: inherit; padding: 4px 14px; background: var(--surface); color: var(--ink); border: 0; cursor: pointer; }
.toggle-item[aria-checked='true'] { background: var(--ink); color: var(--bg); }
.linklike { font: inherit; background: none; border: 0; padding: 0; color: var(--ink); text-decoration: underline; cursor: pointer; }

/* 検索 */
.search { padding-block: 24px 8px; }
.search-label { display: block; font-weight: 700; margin-bottom: 4px; }
.search-input { width: 100%; font: inherit; font-size: 18px; padding: 10px 12px; border: 2px solid var(--ink); background: var(--surface); color: var(--ink); }
.search-hint { margin: 8px 0 0; color: var(--ink-soft); }
.candidates { list-style: none; margin: 8px 0 0; padding: 0; border-top: 1px solid var(--rule); }
.candidate { display: flex; justify-content: space-between; gap: 12px; padding: 10px 4px; border-bottom: 1px solid var(--rule); cursor: pointer; }
.candidate:hover, .candidate:focus-visible { background: var(--surface); }
.candidate-name { font-weight: 700; }
.candidate-meta { color: var(--ink-soft); white-space: nowrap; font-variant-numeric: tabular-nums; }
.empty { margin: 16px 0; padding: 16px; background: var(--surface); border-left: 4px solid var(--rule); }

/* 看板 */
.hero { margin: 24px -16px 0; padding: 24px 16px 20px; background: var(--sign); color: var(--sign-ink); }
.hero-name { font-family: var(--font-display); font-weight: 400; font-size: clamp(28px, 6vw, 48px); line-height: 1.15; margin: 0; letter-spacing: 0.01em; overflow-wrap: anywhere; }
.hero-meta { margin: 12px 0 0; font-size: 16px; font-weight: 700; }
.hero-aliases { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }

/* 絞り込み */
.filters { display: flex; flex-wrap: wrap; gap: 8px 32px; padding-block: 16px 8px; }
.filter-group { border: 0; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }
.filter-group legend { float: left; padding: 0; margin-right: 8px; color: var(--ink-soft); }
.filter-item { display: inline-flex; gap: 4px; align-items: center; }

/* 店舗一覧 */
.shops { list-style: none; margin: 8px 0 0; padding: 0; border-top: 2px solid var(--ink); counter-reset: none; }
.shop { border-bottom: 1px solid var(--rule); }
.shop-row { display: grid; grid-template-columns: 56px 1fr; gap: 4px 12px; width: 100%; text-align: left; font: inherit; color: inherit; background: none; border: 0; padding: 12px 4px; cursor: pointer; }
.shop-row[aria-expanded='true'] { background: var(--surface); }
.shop-count { grid-row: 1 / span 2; font-variant-numeric: tabular-nums; line-height: 1; align-self: start; }
.shop-count b { font-size: 32px; font-weight: 700; }
.shop-count small { font-size: 12px; margin-left: 2px; }
.shop-main { display: flex; flex-wrap: wrap; gap: 0 12px; align-items: baseline; }
.shop-name { font-weight: 700; font-size: 17px; }
.shop-place { color: var(--ink-soft); font-size: 13px; }
.shop-stats { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: center; font-variant-numeric: tabular-nums; }
.segs { display: inline-flex; gap: 3px; }
.seg { display: inline-block; width: 10px; height: 14px; background: var(--rule); }
.seg.plus { background: var(--plus); }
.seg.minus { background: var(--minus); }
.stat { display: inline-flex; gap: 6px; align-items: baseline; }
.stat-label { color: var(--ink-soft); font-size: 13px; }
.plus { color: var(--plus); font-weight: 700; }
.minus { color: var(--minus); font-weight: 700; }

/* 記事一覧 */
.detail { width: 100%; border-collapse: collapse; margin: 0 0 12px; font-size: 14px; }
.detail th, .detail td { text-align: left; padding: 6px 8px; border-top: 1px solid var(--rule); }
.detail th { color: var(--ink-soft); font-weight: 400; }
.detail .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.detail a { color: var(--ink); }

/* 店舗から探す */
.store { margin-top: 20px; }
.store-name { font-size: 18px; margin: 0 0 4px; }
.store-machines { list-style: none; margin: 0; padding: 0; }
.store-machines li { display: flex; flex-wrap: wrap; gap: 0 12px; padding: 6px 0; border-bottom: 1px solid var(--rule); }

/* 末尾 */
.foot { margin-top: 48px; padding-top: 12px; border-top: 1px solid var(--rule); color: var(--ink-soft); font-size: 13px; }
.foot a { color: inherit; }

@media (max-width: 480px) {
  .shop-row { grid-template-columns: 44px 1fr; }
  .shop-count b { font-size: 26px; }
  .detail th:nth-child(3), .detail td:nth-child(3) { display: none; }
}
```

- [ ] **Step 5: 通ることを確認する**

Run: `pnpm --filter web test`
Expected: 全 PASS（`ShopRow` の `getByText('3')` が複数ヒットする場合は `within(row).getByText('3', { selector: 'b' })` にする）

- [ ] **Step 6: コミット**

```bash
git add web/src/components web/src/styles/app.css web/test/ShopRow.test.tsx web/test/MachineSearch.test.tsx
git commit -m "feat: 画面コンポーネントとスタイルを追加"
```

---

### Task 17: App の組み立て（データ読み込み・URL 同期・空/エラー状態）

**Files:**
- Modify: `web/src/App.tsx`（Task 14 の仮実装を全面置換）
- Modify: `web/src/main.tsx`（`app.css` の import を追加）
- Test: `web/test/App.test.tsx`（全面置換）

**Interfaces:**
- Consumes: Task 15 全て、Task 16 全コンポーネント
- Produces: `App()` — 起動時に `${import.meta.env.BASE_URL}machines.json` を fetch。`history.replaceState` で URL クエリに状態を書き、`popstate` で読み戻す。

- [ ] **Step 1: 失敗するテストを書く**

`web/test/App.test.tsx`
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MachinesFile } from '../../shared/types';
import { App } from '../src/App';

const file: MachinesFile = {
  generatedAt: '2026-09-15T00:00:00.000Z', windowDays: 90,
  machines: [
    { machineKey: 'dmm:1', displayName: '真・北斗無双 第5章', category: 'pachinko', aliases: [], hitCount: 2, shopCount: 2, shops: [
      { storeName: 'A店', prefecture: '埼玉県', city: '川口市', hitCount: 1, lastVisitDate: '2026-09-01', avgDiffMean: 1000, plusRate: 0.5,
        articles: [{ url: 'https://s/1/', visitDate: '2026-09-01', coverageType: 'るいべえ実践来店', units: 2, plusUnits: 1, avgDiff: 1000 }] },
      { storeName: 'B店', prefecture: '千葉県', city: '柏市', hitCount: 1, lastVisitDate: '2026-09-02', avgDiffMean: -200, plusRate: 0,
        articles: [{ url: 'https://s/2/', visitDate: '2026-09-02', coverageType: 'スロパチステーション来店取材', units: 2, plusUnits: 0, avgDiff: -200 }] },
    ] },
    { machineKey: 'name:東京喰種', displayName: '東京喰種', category: 'slot', aliases: [], hitCount: 1, shopCount: 1, shops: [
      { storeName: 'A店', prefecture: '埼玉県', city: '川口市', hitCount: 1, lastVisitDate: '2026-09-03', avgDiffMean: 3000, plusRate: 1,
        articles: [{ url: 'https://s/3/', visitDate: '2026-09-03', coverageType: 'るいべえ実践来店', units: 6, plusUnits: 6, avgDiff: 3000 }] },
    ] },
  ],
};

function mockFetch(ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => (ok ? new Response(JSON.stringify(file), { status: 200 }) : new Response('x', { status: 500 }))));
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('読み込み後、上位機種が出て、選ぶと店舗一覧と URL が更新される', async () => {
    mockFetch();
    render(<App />);
    expect(await screen.findByRole('option', { name: /真・北斗無双 第5章/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: /真・北斗無双 第5章/ }));
    expect(screen.getByRole('heading', { level: 2, name: '真・北斗無双 第5章' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(window.location.search).toBe('?m=dmm%3A1');
  });

  it('URL の状態から復元する', async () => {
    mockFetch();
    window.history.replaceState(null, '', '/?c=slot&m=name%3A%E6%9D%B1%E4%BA%AC%E5%96%B0%E7%A8%AE');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 2, name: '東京喰種' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'スロット' })).toHaveAttribute('aria-checked', 'true');
  });

  it('都道府県で絞り込める', async () => {
    mockFetch();
    window.history.replaceState(null, '', '/?m=dmm%3A1');
    render(<App />);
    await screen.findByRole('heading', { level: 2, name: '真・北斗無双 第5章' });
    await userEvent.click(screen.getByRole('checkbox', { name: '千葉県' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('B店')).toBeInTheDocument();
    expect(window.location.search).toContain('pref=');
  });

  it('種別を切り替えると機種選択が解除される', async () => {
    mockFetch();
    window.history.replaceState(null, '', '/?m=dmm%3A1');
    render(<App />);
    await screen.findByRole('heading', { level: 2, name: '真・北斗無双 第5章' });
    await userEvent.click(screen.getByRole('radio', { name: 'スロット' }));
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /東京喰種/ })).toBeInTheDocument();
  });

  it('店舗から探すビュー', async () => {
    mockFetch();
    render(<App />);
    await screen.findByRole('option', { name: /真・北斗無双 第5章/ });
    await userEvent.click(screen.getByRole('button', { name: '店舗から探す' }));
    await userEvent.type(screen.getByLabelText('店舗名で探す'), 'A');
    expect(screen.getByRole('button', { name: '真・北斗無双 第5章' })).toBeInTheDocument();
  });

  it('読み込み失敗の文言', async () => {
    mockFetch(false);
    render(<App />);
    expect(await screen.findByText('データを読み込めませんでした。ページを再読み込みしてください。')).toBeInTheDocument();
  });

  it('更新日時と出典を出す', async () => {
    mockFetch();
    render(<App />);
    await waitFor(() => expect(screen.getByText(/2026年9月15日/)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'スロパチステーション' })).toHaveAttribute('href', 'https://777.slopachi-station.com/');
  });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `pnpm --filter web test -- App`
Expected: FAIL

- [ ] **Step 3: 実装する**

`web/src/main.tsx` に 1 行追加:
```tsx
import './styles/app.css';
```
（`./styles/tokens.css` の import の直後）

`web/src/App.tsx`
```tsx
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

function useUrlState(): [AppState, (next: AppState) => void] {
  const [state, setState] = useState<AppState>(() => parseState(window.location.search));
  useEffect(() => {
    const onPop = () => setState(parseState(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const update = (next: AppState) => {
    setState(next);
    const q = serializeState(next);
    window.history.replaceState(null, '', `${window.location.pathname}${q}`);
  };
  return [state, update];
}

export function App() {
  const load = useMachinesFile();
  const [state, setState] = useUrlState();
  const [query, setQuery] = useState('');
  const [openShop, setOpenShop] = useState<string | null>(null);

  const machines = load.status === 'ready' ? load.data.machines : [];
  const machine = useMemo(() => machines.find((m) => m.machineKey === state.machineKey) ?? null, [machines, state.machineKey]);
  const options = useMemo(() => (machine ? availableFilters(machine) : { prefectures: [], coverageTypes: [] }), [machine]);
  const shops = useMemo(() => (machine ? filterShops(machine, { prefectures: state.prefectures, coverageTypes: state.coverageTypes }) : []), [machine, state.prefectures, state.coverageTypes]);
  const storeMatches = useMemo(() => lookupStores(machines, state.storeQuery, state.category), [machines, state.storeQuery, state.category]);

  const selectMachine = (machineKey: string) => {
    const target = machines.find((m) => m.machineKey === machineKey);
    setOpenShop(null);
    setState({ ...state, view: 'machine', category: target?.category ?? state.category, machineKey, prefectures: [], coverageTypes: [] });
  };

  return (
    <div className="page">
      <header className="top">
        <h1>スロパチ取材 店さがし</h1>
        <nav className="top-nav" aria-label="表示">
          <CategoryToggle value={state.category} onChange={(c) => { setQuery(''); setOpenShop(null); setState({ ...state, category: c, machineKey: null, prefectures: [], coverageTypes: [] }); }} />
          {state.view === 'machine'
            ? <button type="button" className="linklike" onClick={() => setState({ ...state, view: 'store' })}>店舗から探す</button>
            : <button type="button" className="linklike" onClick={() => setState({ ...state, view: 'machine', storeQuery: '' })}>機種から探す</button>}
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
```

- [ ] **Step 4: 通ることを確認する**

Run: `pnpm --filter web test && pnpm --filter web build`
Expected: 全 PASS、ビルド成功

- [ ] **Step 5: 実データで目視確認する**

Run: `cd /Users/kohei/Developer/パチンコ系 && pnpm --filter web dev`
ブラウザで `http://localhost:5173/` を開き、次を確認して閉じる:
1. パチンコ / スロットの切替で候補が変わる
2. 機種を選ぶと看板黄のヒーローと店舗一覧が出る。行を開くと記事表と元記事リンクが出る
3. 幅 400px で横スクロールが出ない
4. macOS の外観をダークにしても文字が読める
問題があれば該当コンポーネント／CSS を直し、テストが必要なら追加する。

- [ ] **Step 6: コミット**

```bash
git add web/src/App.tsx web/src/main.tsx web/test/App.test.tsx
git commit -m "feat: App を組み立て、URL 同期と空・エラー状態を実装"
```

---

### Task 18: GitHub Actions（毎日クロール → コミット → Pages デプロイ）と README

**Files:**
- Create: `.github/workflows/crawl-and-deploy.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: ルート `pnpm test` / `pnpm crawl` / `pnpm build`（Task 1）、`VITE_BASE`（Task 14）

- [ ] **Step 1: ワークフローを書く**

`.github/workflows/crawl-and-deploy.yml`
```yaml
name: crawl-and-deploy

on:
  schedule:
    - cron: '0 21 * * *'   # JST 06:00
  workflow_dispatch:
  push:
    branches: [main]

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: crawl-and-deploy
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 90
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm test

      - name: クロール（push 起動時は行わない）
        if: github.event_name != 'push'
        run: pnpm crawl

      - name: データをコミット
        if: github.event_name != 'push'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data
          if git diff --cached --quiet; then
            echo "変更なし"
          else
            git commit -m "chore: 取材データを更新 $(TZ=Asia/Tokyo date +%Y-%m-%d) [skip ci]"
            git push
          fi

      - name: Web をビルド
        env:
          VITE_BASE: /${{ github.event.repository.name }}/
        run: pnpm build

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README を書く**

`README.md`
```markdown
# スロパチ取材 店さがし

スロパチステーションの取材結果（関東 3 エリア、直近 90 日）から、機種を選ぶとピックアップ回数の多い店舗が並ぶ私的な検索サイト。

## 構成

- `crawler/` 記事の差分取得と集計（Node + TypeScript）
- `web/` 画面（Vite + React）
- `data/` 生成データ。`articles.json` が正、`machines.json` は派生
- `.github/workflows/` 毎朝 6 時（JST）にクロールして GitHub Pages へ公開

## ローカルで動かす

```bash
pnpm install
pnpm test                 # 全テスト
MAX_NEW_ARTICLES=20 pnpm crawl   # 新規 20 件まで取得して data/ を更新
pnpm --filter web dev     # http://localhost:5173/
```

## 注意

- 取材データはスロパチステーションの著作物です。数値と元記事 URL のみ保存し、本文・画像は保存しません。私的利用の範囲で使ってください。
- クローラは 1 秒に 1 リクエスト、並列なし、リトライ 3 回で動きます。間隔を短くしないでください。
- `data/errors.json` に解析失敗が溜まったら、サイト側の構造変更を疑って `crawler/src/parse/` を確認してください。

## 設計資料

- 仕様: `docs/superpowers/specs/2026-09-15-slopachi-shop-finder-design.md`
- 実装計画: `docs/superpowers/plans/2026-09-15-slopachi-shop-finder.md`
```

- [ ] **Step 3: YAML の構文を確認する**

Run: `cd /Users/kohei/Developer/パチンコ系 && node -e "const y=require('fs').readFileSync('.github/workflows/crawl-and-deploy.yml','utf8'); console.log(y.split('\n').length,'lines')" && pnpm test`
Expected: 行数が表示され、テスト全 PASS（YAML の厳密検証は Task 19 の初回実行で行う）

- [ ] **Step 4: コミット**

```bash
git add .github/workflows/crawl-and-deploy.yml README.md
git commit -m "ci: 毎日クロールして GitHub Pages へデプロイするワークフローを追加"
```

---

### Task 19: 初回データ投入、GitHub リポジトリ作成、公開確認

**Files:**
- Modify: `data/articles.json`, `data/machines.json`, `data/errors.json`（クローラが生成）

**Interfaces:**
- Consumes: Task 13 `pnpm crawl`、Task 18 ワークフロー

- [ ] **Step 1: 90 日分を取り切るまでクロールを繰り返す**

Run（1 回あたり最大 300 件。`追加 0` が出るまで繰り返す。1 回 5〜8 分）:
```bash
cd /Users/kohei/Developer/パチンコ系
for i in 1 2 3 4 5; do pnpm crawl | tail -3; done
node -e "const a=require('./data/articles.json');const m=require('./data/machines.json');console.log('記事',a.articles.length,'機種',m.machines.length);const e=require('./data/errors.json');console.log('errors',e.length);console.log(e.slice(0,10))"
```
Expected: 最終ループで `追加 0`。記事数は数百件。`errors.json` の件数を確認し、10 件を超える場合は理由別に数え、パーサの取りこぼしが多いパターンなら該当記事を `crawler/test/fixtures/` に保存してテストを追加し、Task 6〜8 のパーサを直してから再実行する（`fix:` でコミット）。「(予定)」や結果未掲載など正当な失敗は放置してよい。

- [ ] **Step 2: 生成データをコミット**

```bash
git add data
git commit -m "chore: 初回の取材データを投入"
```

- [ ] **Step 3: GitHub にプライベートリポジトリを作って push**

Run:
```bash
cd /Users/kohei/Developer/パチンコ系
gh repo create slopachi-shop-finder --private --source=. --remote=origin --push
```
Expected: `https://github.com/<owner>/slopachi-shop-finder` が作られ、`main` が push される

- [ ] **Step 4: GitHub Pages を Actions ソースで有効化する**

Run:
```bash
OWNER=$(gh repo view --json owner -q .owner.login)
gh api -X POST "repos/$OWNER/slopachi-shop-finder/pages" -f build_type=workflow || gh api -X PUT "repos/$OWNER/slopachi-shop-finder/pages" -f build_type=workflow
```
Expected: 201 か 204。すでに有効なら PUT 側が通る。

- [ ] **Step 5: ワークフローを手動実行して結果を待つ**

Run:
```bash
gh workflow run crawl-and-deploy
sleep 60
gh run list --workflow crawl-and-deploy --limit 1
RUN_ID=$(gh run list --workflow crawl-and-deploy --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
gh api "repos/$OWNER/slopachi-shop-finder/pages" -q .html_url
```
Expected: `build` と `deploy` の両ジョブが成功。最後に Pages の URL が出る。失敗したらログ `gh run view "$RUN_ID" --log-failed` を読み、原因（pnpm バージョン、権限、`VITE_BASE`）を直して `ci:` でコミット・push し、再実行する。

- [ ] **Step 6: 公開ページを確認する**

Pages の URL をブラウザで開き、次を確認する:
1. 機種候補が出る（`machines.json` が `/<repo>/machines.json` で取れている）
2. 機種を選んで店舗が並び、元記事リンクが開く
3. URL をコピーして別タブで開くと同じ状態が復元される

問題がなければ完了。URL を README の冒頭に追記して `docs:` でコミット・push する。

---

## 自己レビュー結果

**仕様カバレッジ**

| 仕様の項目 | 実装タスク |
|---|---|
| 2. スコープ（3 エリア・90 日・両種別・回数順・静的＋自動更新・TS） | 9, 11, 12, 13, 14, 18 |
| 4. 全体構成（articles.json が正、machines.json は派生） | 11, 13 |
| 5. データモデル | 1 |
| 6. クローラ（差分・停止条件・(予定)除外・上限 300・UA・間隔・リトライ・errors.json・機種キー） | 5, 9, 10, 13 |
| 7. 画面（切替・検索・上位 20・ヒーロー・絞り込み・一覧・詳細・店舗から探す・URL 状態・空状態） | 15, 16, 17 |
| 8. ビジュアル（色・書体・レイアウト・セグメント・角丸なし・reduced-motion・フォーカス） | 14, 16 |
| 9. 自動更新とデプロイ（JST 6:00・手動可・差分時のみコミット・失敗通知） | 18 |
| 10. エラー処理（一覧失敗スキップ・記事失敗続行・全滅時異常終了・画面の読み込み失敗文言） | 10, 13, 17 |
| 11. テスト（パーサ 3 種・正規化集計・一覧・画面・fetch モック） | 3〜13, 15〜17 |
| 12. 法的配慮（数値と URL のみ・出典リンク・noindex） | 1（型に本文なし）, 14, 17 |

**型の整合**: `MachineResult.shared` / `ShopArticleRef.shared` は Task 1 で定義し Task 7・12・16 で参照。`ShopFilter` は Task 15 で定義し Task 16・17 で参照。`StoreMatch` は Task 15 で定義し Task 16 で参照。`WINDOW_DAYS` は Task 13、画面側は `MachinesFile.windowDays` を使う。

**既知の判断**
- スロット形式 A の `unitNumbers` はカンマ結合（範囲表記へ圧縮しない）。表示にしか使わない。
- 2 機種混在見出しは各機種に同じ集計値を入れ `shared: true` を付け、画面の記事表に「（他機種と合算）」と出す。
- 一覧の年推定は停止判定にのみ使い、保存する `visitDate` は記事本文の `訪問日` を使う。
