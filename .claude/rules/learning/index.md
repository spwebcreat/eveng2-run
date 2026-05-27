# Learning Index (auto-generated)

P1 は常駐、P2 はオンデマンドで参照する。

最終更新: 2026-05-28

## P1 (常駐)

- `.claude/rules/learning/core.md` — G2 Run HUD 開発で得た技術知見（Even Hub SDK / Even Realities G2 固有 + 横断的判断ルール）

## P2 (オンデマンド)

- `.claude/memory/learning-p2/workflow.md` — Agent Teams / subagent 発注 / Codex 関与パターン等の作業フロー系
- `.claude/memory/learning-p2/ux.md` — 判断 UI HTML / 旦那様向けインターフェース設計
- `.claude/memory/learning-p2/sdk.md` — Even Hub SDK の細部仕様（マイク PCM フォーマット等）
- `.claude/memory/learning-p2/release.md` — リリース・パッケージング系（spike branch pack:ehpk 物理禁止等）

## 参照ルール

- P1 は session 開始時に自動ロード
- P2 は当該ドメインの作業をする時にロード（例: 「Agent Teams を使いたい」場面で `workflow.md` を読む）
- 新規ルール追加時は `.claude/learning-state/domain-catalog.json` 同期
