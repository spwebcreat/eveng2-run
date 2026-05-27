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

## v0.5+ ロードマップ（2026-05-27 確定）

- 全体像: v0.5-spike → v0.5 → v0.6 → v0.7 → v0.8 → v0.9 → v1.0（約 6 ヶ月、副業ペース週 10〜15h）
- 採用 30 機能 + 4 メタ判断 / 却下 1 件（v0.8 シューズ管理）/ 保留扱い 1 件（NO-GO リスト確定保留 = 公式対応状況を見て再検討）
- 詳細は `docs/v0.5/decision-log.md` を SSOT として参照
- 着手は v0.5-spike の 4 検証（2×2 タイル / latency / toolkit ビルド / G2 マイク PCM）から

過渡期は本社経由で作業し、安定後は G2 ディレクトリで Claude Code を起動して単独運用に移行する。

## 関連ファイル

### 常時参照
- 仕様書: `even-g2-run-hud-handoff.md`
- 旦那様向け Hub アップロード手順書: `docs/HANDOFF.md`
- Even Hub 公式ドキュメント URL 一式: `docs/REFERENCES.md`
- デザインガイド画像: `docs/design/*.png`（Even OS 2.0 公式、ライトテーマ準拠）
- 実装: `src/` 配下

### 現フェーズ (v0.5+)
- 判断ログ SSOT: `docs/v0.5/decision-log.md`
- 観察リスト（NO-GO 保留）: `docs/v0.5/watch-list.md`
- spike 詳細実装プラン: `docs/v0.5/spike-plan.md`
- v0.5 本実装プラン: `docs/v0.5/implementation-plan.md`
- Codex 相談用 brief（前段）: `docs/v0.5/roadmap-brief.md`
- 判断レビュー HTML: `docs/v0.5/roadmap-review.html`

### 過去フェーズ
- `docs/archive/v0.4.0-*` ─ v0.3.x〜v0.4.0 期のロードマップ・brief
- G2 案件 handoff（案件視点・セッション履歴）: `.claude/handoff/handoff-YYYY-MM-DD.md`
- 本社 handoff（本社全体俯瞰・朝会全体・支店報告等を含む）: `<本社>/.claude/handoff/handoff-YYYY-MM-DD.md`
