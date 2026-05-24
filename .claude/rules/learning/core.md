# G2 Run HUD 開発ルール（learning core）

Even Realities G2 向け Even Hub プラグイン開発で得た技術知見の蓄積。

セッション開始時に自動ロードされる P1 ルール。
将来 P2 構造（カテゴリ別オンデマンド参照）が必要になったら本社 learning 形式に倣う。

## 技術知見

- P1 | subagent に同型バグ修正を発注する場面で、既知パターン（F8 のような同期 callout 再帰問題）が他経路に存在する可能性がある | 発注 prompt に「同じパターンが他経路に潜在しないか棚卸ししてから修正」を明示する | 修正漏れで MVP コア機能が動かない事故防止
  - 補足: 2026-05-24 EvenG2 MVP 実装時に dev-engineer が F8（`startGeolocation` の同期 onError）を修正したが mock 側で同型バグ（`startMockRun` の同期 callout）が残り、distance 加算が 0 のまま固まる事故が発生。秘書直接修正（`queueMicrotask` + `mockStarting` sentinel）で解決

- P1 | Codex CLI レビューで SDK / API シグネチャ系の指摘を受けた場面 | 鵜呑みにせず実物（`node_modules/.../.d.ts` / `.d.cts` / 公式 docs）で検証してから採否判定する | Codex も誤指摘あり
  - 補足: 2026-05-24 Codex 指摘 N2「`shutDownPageContainer(1)` を `CONTAINER_ID` に統一」が、実は SDK 上 `shutDownPageContainer(exitMode?: number)` で 1=exitMode の正しい用法だった事例。dev-engineer 判断（実装変更不要）が正解

- P1 | npm / pnpm の組み込みコマンド名（pack / publish / install / test 等）を `package.json` の scripts キーに使おうとする場面 | 衝突回避のため別名（例 `pack:ehpk`）を採用、ドキュメント側もコマンド名を明示する | 組み込みコマンドが優先実行されて scripts が無視される事故防止
  - 補足: 2026-05-24 `pnpm pack` が pnpm built-in tarball コマンドを優先実行し scripts.pack を無視 → `.tgz` 生成で旦那様が「.ehpk が出ない」と発覚 → `pack:ehpk` に改名で解決

- P1 | 公式 docs サイトが React / Next.js SPA で WebFetch / scrapling fetch が初期 HTML タイトルしか取れない場面 | GitHub リポが公開されているなら `gh api repos/<owner>/<repo>/contents/<path>` で実装サンプル（README / main.ts / package.json）を直接取得する方が早い | SPA レンダリング待ちで時間浪費せず、実コードから API パターンを学ぶ
  - 補足: 2026-05-24 Even Hub の Your First App / Reference ページが SPA で取得不能 → GitHub API で `LesenmiaoYu/evenhub-templates` の minimal / text-heavy 実コード取得して SDK API map（`waitForEvenAppBridge` / `createStartUpPageContainer` / `textContainerUpgrade` / `onEvenHubEvent` / `shutDownPageContainer` + sysEvent/textEvent イベント振り分け + Protobuf zero-value coalesce）を完全把握
