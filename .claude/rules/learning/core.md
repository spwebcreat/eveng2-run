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

- P1 | Even Hub SDK の `updateImageRawData` で画像 container にアイコンを送る場面 | **PNG / JPEG エンコード済み bytes** を `Uint8Array` で渡す（生 4-bit gray packed bytes ではない）。SDK 内部で decode → resize → 4-bit gray 変換される | `imageToGray4Failed` エラーで詰まる事故防止
  - 補足: 2026-05-24 v0.2.1 で自前で 4-bit gray packed bytes を生成して送信したらアイコン全部表示されず縦線だけ残った。公式 image テンプレ (`LesenmiaoYu/evenhub-templates/image/src/image/renderer.ts`) を読み「encoded bytes 期待」と判明 → Canvas → toBlob('image/png') → Uint8Array で再実装

- P1 | Even Hub SDK の `textContainerUpgrade` で text container を空にしたい場面 | content に `''`（空文字）を送ると SDK 側で「変更なし」扱いになり前回値が残る。**半角スペース `' '` を送って明示的にクリア** する | 走行中に pause ガイドが消えない等の表示バグ防止
  - 補足: 2026-05-24 v0.2.4 で「running 時にガイド非表示」が効かず実機で常時表示。bridge.ts の render() に `requested === '' ? ' ' : requested` 変換を追加して解決

- P1 | Even Hub SDK で複数 container 構成を作る場面 | **`isEventCapture: 1` は container 全体で 1 個だけ**（複数指定で `multiple event listeners (>1) not allowed` と createStartUpPageContainer が validation エラー）。透明・全画面のイベントキャプチャ専用 container を 1 つ用意し、他は `isEventCapture: 0` にする | 起動失敗 + 「Glasses Display が真っ黒」で詰まる事故防止
  - 補足: 2026-05-24 v0.2.1 で 8 つの text container 全てに `isEventCapture: 1` を付けてシミュレータ起動失敗。公式 image テンプレ準拠で透明 eventLayer（576x288 / content=' ' / paddingLength=0）を 1 つ追加する方式に変更

- P1 | Even Realities G2 でアプリ終了の UX を設計する場面 | **G2 の長押しは OS ハードレベルでアプリ強制終了**する挙動（SDK の `OsEventTypeList` に `LONG_PRESS_EVENT` は存在しない）。アプリ側は `SYSTEM_EXIT_EVENT` / `ABNORMAL_EXIT_EVENT` 受信で cleanup する設計にする | 終了 UX を JS 側で実装しようとして詰まる事故防止
  - 補足: 2026-05-24 旦那様から「end は長押しで終了でした」と訂正。SDK 全 enum を確認して LONG_PRESS なし → ハード側挙動と判定 → 表示文言のみ修正で対応（既存 input.ts の onSystemExit ルートで cleanup が既に走る）

- P1 | Even Hub Portal に `.ehpk` を再アップロードして検証する場面 | **同一バージョンだとキャッシュが効いて更新されない**。毎アップロード時に patch bump 必須（app.json `version` + package.json `version` + package.json `scripts.pack:ehpk` 出力ファイル名 の 3 ヶ所同期） | 「変更したのに反映されない」事故防止
  - 補足: 2026-05-24 旦那様が複数回 `.ehpk` 上げても内容が変わらず気付いた。公式 packaging docs (https://hub.evenrealities.com/docs/reference/packaging) には明記なしだが、実運用上 patch bump で確実に反映される

- P1 | 4-bit gray モノクロディスプレイ（G2 の 576x288 / 16 階調緑）向けに UI を設計する場面 | **小型アイコンは難易度高**（24x24 でも視認性低い・潰れる・パッと識別困難）。MVP は **純テキスト UI + 媒体プレーヤー風記号**（`RUN ▶` / `PAUSE \|\|` / `READY ▶` 等）で代替を優先する | アイコン設計の無駄な反復削減
  - 補足: 2026-05-24 v0.2.1 〜 v0.2.2 で 4-bit gray アイコン（pin / shoe / heart / runner）→ PNG bytes 方式 → 24x24 縮小と反復したが視認性課題が残り、v0.2.3 で全廃止 → 3x3 グリッド + 媒体プレーヤー記号で大幅にクリーンに

- P1 | ユーザーが「参照」「ガイド」「素材」として渡したファイルが Read tool で開けない場面（バイナリ・100MB 級・Penpot / Sketch / Figma 等の design source）| **視覚確認できないならユーザーに画像エクスポート / 別形式提供を依頼してから着手**。確認できないものを「参照した」扱いせず、デザインガイド画像を明示的に取得する | 「ちゃんと確認しましたか？」指摘 → 全面リライト級の手戻り防止
  - 補足: 2026-05-26 v0.3.0 実装時に `docs/EvenRealities.pen`（Penpot 形式 100MB）が「参照素材」として渡されていたが Read tool で開けず素通り。結果 v0.3.0 リリース後に旦那様から「ちゃんとデザインガイド確認しましたか？」と指摘 → 旦那様が `docs/design/` に画像エクスポートしてくれた 5 PNG を確認 → Even OS 2.0 公式は **ライトテーマ**と判明 → v0.4.0 で全面リライト。受け取った時点で「画像で頂けますか」を聞くべきだった

- P1 | デザインガイド・参照素材が渡されている状況で「デザイン変更」を依頼される場面 | **既存スタイル踏襲だけで終わらせない**。公式ガイドの lightness（ライト/ダーク）・カラーパレット・タイポグラフィを最初に判定し、既存実装との乖離があれば必ず明示・確認してから着手する | 機能追加だけで「デザイン変えてない」と指摘される手戻り防止
  - 補足: 2026-05-26 v0.3.0 で `ui-ux-pro-max` スキル invoke 時に「既存スタイル踏襲」で機能追加のみして提出 → 旦那様から「アプリ側 UI が全然変わってない」と指摘。公式ガイドを見たら **ライト** が公式（既存は dark `#232323`）→ v0.4.0 で全面ライトテーマ化。スキル invoke の args で「既存スタイル継承」と書くのは危険、ガイドが渡されていれば必ず lightness 判定が先

- P1 | Even Hub plugin の version リリース手順 | **Hub Portal Description 欄もリリースのたびに更新する**（version bump 3 ファイル + Description = 4 箇所同期）。「今後のフェーズで追加」等の古い記述が version またぎで残ると現状機能と乖離 | Description と実機機能の乖離防止
  - 補足: 2026-05-26 旦那様の Hub Portal Description が v0.2.6 当時の内容のまま残っており、心拍が「Apple Watch / HealthKit 連携は今後のフェーズで追加予定」と書かれていた。実際は v0.3.0 時点で SDK 制約により実装不能と確定済 → v0.4.0 リリース時に description 更新文を旦那様に提示。HANDOFF.md のリリース手順に「Description 更新」ステップを次回追加すべき
