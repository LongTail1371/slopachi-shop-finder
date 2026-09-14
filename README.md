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

## 初回セットアップの注意

- GitHub Pages の Source を「GitHub Actions」にしてから、ワークフローを初回実行してください（Deploy from a branch のままだと公開されません）。
- 初回クロールは 1 回あたり `MAX_NEW_ARTICLES`（既定 300 件）が上限です。直近 90 日分をまとめて取り込みたい場合は `pnpm crawl` を複数回実行するか、`MAX_NEW_ARTICLES` を大きくして実行してください（例: `MAX_NEW_ARTICLES=2000 pnpm crawl`）。
- `VITE_BASE` はプロジェクトサイト（`https://<user>.github.io/<repo>/`）を前提にしています。ユーザー・組織サイト用リポジトリ（`<user>.github.io`）で使う場合は `/` にしてください。
- 解析に失敗した記事は `data/errors.json` に記録され、7 日間は再取得されません（サイト側の HTML 構造が変わった場合、修正が反映されるまで再取得を試みないための挙動です）。7 日を過ぎると自動的に再取得されます。
- CI では `pnpm test` に加えて `pnpm --filter crawler typecheck` も実行されます。型エラーがあるとデプロイは止まります。

## 注意

- 取材データはスロパチステーションの著作物です。数値と元記事 URL のみ保存し、本文・画像は保存しません。私的利用の範囲で使ってください。
- クローラは 1 秒に 1 リクエスト、並列なし、リトライ 3 回で動きます。間隔を短くしないでください。
- `data/errors.json` に解析失敗が溜まったら、サイト側の構造変更を疑って `crawler/src/parse/` を確認してください。

## 設計資料

- 仕様: `docs/superpowers/specs/2026-09-15-slopachi-shop-finder-design.md`
- 実装計画: `docs/superpowers/plans/2026-09-15-slopachi-shop-finder.md`
