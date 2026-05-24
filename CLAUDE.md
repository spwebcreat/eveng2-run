# G2 Run HUD 開発ルール

Even Realities G2 向け Even Hub プラグイン「G2 Run HUD」の開発ルール。
本社（my-company）から派生し、最終的にこのプロジェクト単独での継続開発を目指す。

## プロジェクト概要

- **対象**: Even Realities G2 / Even Hub Plugin
- **目的**: ランニング中の HUD 表示（距離・ペース・経過時間）
- **技術スタック**: TypeScript + Vite + `@evenrealities/even_hub_sdk`
- **状態**: MVP 実機表示成功（2026-05-24）・GPS 精度調整は実走テスト後

## ルール参照

### 本プロジェクト固有ルール
- `.claude/rules/learning/core.md` ─ G2 / Even Hub SDK 固有の技術知見（セッション開始時に自動ロードされる P1）

### 横断ルール（本社からの参照）
本社リポジトリ `/Volumes/SP-STORAGE 1TB/company/my-company` の以下を参照する：

- `.company/dept/dev/findings/` ─ 全本社開発系の汎用技術 finding
- `.company/dept/dev/CLAUDE.md` ─ 開発部運営ルール
- `.company/dept/dev/rules/` ─ 開発部技術ルール

## 過渡期運用

| フェーズ | 起動 cwd | 主な作業 | 状態 |
|---|---|---|---|
| 過渡期 | 本社（my-company） | dev-engineer 発注・Codex レビュー・本社 handoff | 現在 |
| 安定期 | G2（even-g2-run） | G2 内ルールのみで開発継続 | 目指す |

過渡期は本社経由で作業し、安定後は G2 ディレクトリで Claude Code を起動して単独運用に移行する。

## 関連ファイル

- 仕様書: `even-g2-run-hud-handoff.md`
- 旦那様向け Hub アップロード手順書: `docs/HANDOFF.md`
- 実装: `src/` 配下
- G2 案件 handoff（案件視点・セッション履歴）: `.claude/handoff/handoff-YYYY-MM-DD.md`
- 本社 handoff（本社全体俯瞰・朝会全体・支店報告等を含む）: `<本社>/.claude/handoff/handoff-YYYY-MM-DD.md`
