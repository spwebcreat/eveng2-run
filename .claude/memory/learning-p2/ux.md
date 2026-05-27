# learning P2 / ux

オンデマンドで参照する UX / 旦那様向けインターフェース系のルール。

## ルール

- P2 | 大量情報（100 行超 Markdown / 多数の判断要請 / 7 フェーズ計画など）を旦那様レビューに渡す場面 | **判断 UI HTML** に変換する: 採用/却下/保留 segmented control + localStorage 永続化 + Copy as prompt (JSON + Markdown) + フィルタ (Phase / Severity / Category) + 印刷 CSS + モバイル対応。Anthropic「HTML で受け取れ」原則準拠。SVG イラストを inline で 5〜7 枚配置すると認知負荷激減 | 100 行超 Markdown が「合意形成」できない事故防止（P1 #13 と同根、本 P2 は補強事例）
  - 補足: 2026-05-27 v0.5+ ロードマップの旦那様判断回収で実証。Codex に構成 + 7 SVG イラストを相談、Claude が HTML 組立、結果として 29 機能すべてに判断が即座に返り却下 1 + 保留 1 のメモまで含めて回収できた。UI ラベルは日本語ベース（採用/却下/保留 / 阻害/重要/推奨/情報/不採用）、内部値は英語維持（keep/drop/defer）の 2 層構造が機能