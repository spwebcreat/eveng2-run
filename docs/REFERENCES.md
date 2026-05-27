# Even Hub / G2 開発リファレンス URL 一式

Even Realities G2 / Even Hub Plugin 開発で参照する公式ドキュメントと外部リソース。

> 公式 docs サイトは React/Next.js SPA で WebFetch が初期 HTML タイトルしか取れない場合がある。
> その場合は GitHub API で `LesenmiaoYu/evenhub-templates` の実コードを直接取得すること
> （`.claude/rules/learning/core.md` P1 参照）。

## Getting Started

- 概要: https://hub.evenrealities.com/docs/getting-started/overview
- インストール: https://hub.evenrealities.com/docs/getting-started/installation
- First App: https://hub.evenrealities.com/docs/getting-started/first-app
- アーキテクチャ: https://hub.evenrealities.com/docs/getting-started/architecture

## Guides

- ページライフサイクル: https://hub.evenrealities.com/docs/guides/page-lifecycle
- 入力とイベント: https://hub.evenrealities.com/docs/guides/input-events
- ディスプレイ: https://hub.evenrealities.com/docs/guides/display
- Device API: https://hub.evenrealities.com/docs/guides/device-apis
- **UI/UX デザインガイドライン**: https://hub.evenrealities.com/docs/guides/design-guidelines （Even OS 2.0 公式 = ライトテーマ）
- ネットワーク: https://hub.evenrealities.com/docs/guides/networking
- ヘッドレステスト: https://hub.evenrealities.com/docs/guides/headless-testing

## AI Tooling

- Claude Code: https://hub.evenrealities.com/docs/AI-tooling/claude%20code/
- スキルカタログ: https://hub.evenrealities.com/docs/AI-tooling/claude%20code/skill-catalog

## Reference

- シミュレーター: https://hub.evenrealities.com/docs/reference/simulator
- パッケージング: https://hub.evenrealities.com/docs/reference/packaging
- CLI: https://hub.evenrealities.com/docs/reference/cli
- アプリ提出ガイドライン: https://hub.evenrealities.com/docs/reference/app-submission

## Community / 外部リソース

- コミュニティ: https://hub.evenrealities.com/docs/community/resources
- Even Toolkit (公式 GitHub): https://github.com/fabioglimb/even-toolkit
- 開発ノート (コミュニティ): https://github.com/nickustinov/even-g2-notes/blob/main/docs/README.md
- 公式テンプレ集 (GitHub): https://github.com/LesenmiaoYu/evenhub-templates （SPA 取得不能時のフォールバック源）

## 設計・ロードマップ参考

- Anthropic「Claude Code は HTML で受け取れ」: https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html （判断 UI HTML の設計原則）

## 使い分けメモ

- **SDK API シグネチャ確認** → 第一に `node_modules/@evenrealities/even_hub_sdk/**/*.d.ts` を grep。docs と齟齬があれば `.d.ts` 優先
- **実装パターン** → GitHub `LesenmiaoYu/evenhub-templates` の minimal / text-heavy / image を `gh api repos/...` で取得
- **デザイン判断** → design-guidelines を最初に開いて lightness（ライト/ダーク）判定
- **パッケージング手順** → reference/packaging（patch bump 3 ヶ所 + Hub Portal Description 更新の 4 箇所同期）
