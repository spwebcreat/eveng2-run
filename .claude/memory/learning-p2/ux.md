# learning P2 / ux

オンデマンドで参照する UX / 旦那様向けインターフェース系のルール。

## ルール

- P2 | 大量情報（100 行超 Markdown / 多数の判断要請 / 7 フェーズ計画など）を旦那様レビューに渡す場面 | **判断 UI HTML** に変換する: 採用/却下/保留 segmented control + localStorage 永続化 + Copy as prompt (JSON + Markdown) + フィルタ (Phase / Severity / Category) + 印刷 CSS + モバイル対応。Anthropic「HTML で受け取れ」原則準拠。SVG イラストを inline で 5〜7 枚配置すると認知負荷激減 | 100 行超 Markdown が「合意形成」できない事故防止（P1 #13 と同根、本 P2 は補強事例）
  - 補足: 2026-05-27 v0.5+ ロードマップの旦那様判断回収で実証。Codex に構成 + 7 SVG イラストを相談、Claude が HTML 組立、結果として 29 機能すべてに判断が即座に返り却下 1 + 保留 1 のメモまで含めて回収できた。UI ラベルは日本語ベース（採用/却下/保留 / 阻害/重要/推奨/情報/不採用）、内部値は英語維持（keep/drop/defer）の 2 層構造が機能

- P2 | 旦那様向け説明 HTML に手描き風イラストを embed する場面（spec / spike 検証手順 / トラブルシューティング 等）| **本社風スタイルで統一**: クラフト紙背景 (#d4b896 系) + 紺色手描き鉛筆線 (#1f3a52 系) + 日本語手書き見出し + 眼鏡 + 作業着の若い男性キャラクター + 吹き出し + マスタード黄/レンガ赤アクセント + 16:9 or 3:2 (1536×1024 PNG 標準)。1 枚目を「参照画像」としてプロンプトに含めると残り図も完全同スタイル統一できる。Codex CLI 経由 gpt-image-2 で生成 | 旦那様の認知負荷を下げ、複数 HTML 間でビジュアル統一感を出す
  - 補足: 2026-05-28 manual-verify.html v2 用に 5 枚生成 (fig-01 Hub Portal flow / fig-02 build バグ BEFORE-AFTER / fig-03 グラス OK vs NG / fig-04 DevTools 接続 3 ステップ / fig-05 判定フロー) ですべて 3-3.6 MB / 1536×1024 PNG。fig-01 を「参照画像 fig-01-hub-portal-flow.png と完全に同じビジュアルスタイル」とプロンプトに明記すると残り 4 枚も完全統一。各 figure に `<figcaption>📐 図 N: タイトル — サブ説明</figcaption>` で短い解説を添えると HTML 構造が引き締まる