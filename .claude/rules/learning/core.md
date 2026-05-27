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

- P1 | 大規模ロードマップ / 新ライブラリ全面採用 / バージョン跨ぎリファクタなど、楽観的に広い計画を立てた場面 | **Codex 批判レビュー → SDK 実物検証 → 判断 UI HTML 化 → 旦那様の意思決定回収 → SSOT として確定** の 5 ステップを必ず踏む。Claude 単独で「最大限」を提案すると SDK 非対応機能を含む / 工数過小評価 / 撤回判断の根拠が弱いまま実装着手する事故が起きる | 大規模計画の手戻り防止
  - 補足: 2026-05-27 even-toolkit 採用検討で Claude 単独「最大限」案（Phase A〜C / 5-6 ヶ月 / 30+ 機能）を出した後、Codex 批判レビューで NO-GO 多数（576×288 single image / HR API 不在 / G2 speaker TTS 不在 / companion 正式枠不在）が判明 → SDK index.d.ts で全件事実確認 → roadmap-v0.5.html（判断 UI / Keep-Drop-Defer / Copy as prompt）で旦那様が判断を返す → docs/v0.5-decision-log.md として確定。Claude 提案 → Codex 反論 → SDK 検証 → 旦那様判断の 4 角形を SSOT 化するフローは「機能数で広げる楽観」を「SDK 範囲で深さを出す現実案」に転換するのに有効

- P1 | 大量情報（100 行超 Markdown / 7 フェーズ計画 / 多数のトレードオフ）を旦那様にレビューさせる場面 | **判断を返すための単一 self-contained HTML** に変換する。インライン SVG 図版・Keep/Drop/Defer セグメントコントロール・localStorage 永続化・Copy as prompt（JSON+Markdown）の 4 点セットで「読む文書」を「判断を返す画面」に変える。Anthropic「HTML で受け取れ」原則準拠 | 100 行超 Markdown が「合意形成」できない事故防止
  - 補足: 2026-05-27 v0.5+ ロードマップを Markdown のみで提示 → 旦那様が「視覚的に見せて」と要求 → 参考記事 (https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html) 準拠で docs/roadmap-v0.5.html を作成（7 セクション / 7 SVG / フィルタ 3 種 / 印刷 CSS / モバイル対応）。Codex に構成と SVG を相談、Claude が HTML 組立。結果として 29 機能すべてに判断が即座に返り、却下 1 + 保留 1 のメモまで含めて回収できた。UI ラベル（採用/却下/保留 / 阻害/重要/推奨/情報/不採用）は日本語ベース、内部値（keep/drop/defer）は英語維持の 2 層構造

- P1 | 外部ライブラリ / npm パッケージの関数を採用する場面（型定義や docs だけで判断しがちな場面）| **関数挙動を実物テストで確認**してから採用判定する。`node ... ... ; console.log(fn('test input'))` 程度で実測ログを取り、想定と一致するか検証。型と挙動は別物 | 関数 docstring・型定義の解釈ミスで既存仕様破壊する事故防止
  - 補足: 2026-05-27 v0.5 で `even-toolkit/text-clean.cleanForG2` を採用判定する際、「emoji / 未サポート文字を除去」という説明だけ読んで「安全な軽量化」と結論。Codex 総合レビューで実物挙動 (`cleanForG2('RUN ▶')` → `'RUN'`、`cleanForG2('●○○')` → `''`、`cleanForG2(' ')` → `''`) を指摘されて初めて気付いた。既存 HUD が `RUN ▶` / `●○○` / 全角スペース中央寄せに依存していたため、全面適用すると HUD 仕様が全部壊れる。私とシオン QA の両方で見逃した重要見落とし

- P1 | Even Hub アプリの `app.json` を新規作成・編集する場面（spike / 本実装どちらも）| **3 つの validator 制約を厳守**: `name` 20 字以内 / `version` は `x.y.z` 厳格（prerelease tag 不可、識別子は `package_id` で表現）/ `permissions[].name` は enum (`g2-microphone` / `phone-microphone` / `album` / `location` / `network` / `camera`) | evenhub-cli pack 失敗 / Hub Portal upload 拒否事故防止
  - 補足: 2026-05-27 v0.5-spike S1 / S4 で dispatch packet 通りの `version: "0.5.0-spike.s1"` や 27 字 name (`G2 Run HUD Spike S1 (Tiles)`) を試して validator 拒否。実装 agent が独自に短縮 (`G2 HUD Spike S1`) + `version: "0.5.0"` + spike 識別子は `package_id` (`com.spwebcreat.g2runhud.spike.s1`) と ehpk ファイル名で表現する形に修正。S4 で permission enum (`g2-microphone`) も判明。dispatch packet 作成時の見落としで全 spike が独立に手戻りした

- P1 | 外部 npm パッケージの subpath import (`pkg/subpath`) を使う場面 | **`gh api repos/<owner>/<repo>/contents/package.json` で exports field を実物確認**してから import 文を書く。docs / README の記述や類推による subpath 命名は誤記しがち | subpath 誤記でビルド失敗・ESM 解決失敗の事故防止
  - 補足: 2026-05-27 v0.5-spike S3 dispatch packet で `even-toolkit/glasses/text-clean` と書いたが、実際の exports field は `even-toolkit/text-clean` （`/glasses/` prefix 不要）。Codex 事前指摘 + `gh api repos/fabioglimb/even-toolkit/contents/package.json` で実物確認して訂正。learning P1「Codex 鵜呑み禁止」と相補で機能した好例

- P1 | Even Hub Portal に ehpk を再アップロードする場面（同一 package_id でも、別 package_id の spike アプリでも）| **`version` は必ず昇順に振る**（同一 version はキャッシュで反映されない）。複数 spike を同日にアップロードする場合は順番に `0.5.0` → `0.5.1` → `0.5.2` のように事前に振り分けてから pack | spike 検証時の「アップロードしたのに反映されない」事故防止
  - 補足: 2026-05-27 v0.5-spike で S1 / S4 ehpk を両方 `version: "0.5.0"` で生成。旦那様指摘「同名だとプラグインの仕様でキャッシュのためか反映されない」を受け、S4 を `0.5.1` に昇順化して再 pack。別 package_id でも同 version は Hub Portal 側でキャッシュ衝突する経験則あり

- P1 | spike / 検証用 ehpk を本番リポと同じ source tree で build する場面（vite multi-entry / dispatch packet で「本番 entry を温存」と書きそうになる場面）| **本番 entry を絶対に dist/ に残してはいけない**。spike branch では `spike-sN.html` を `index.html` にリネームし、vite.config.ts の input 指定を最小化（spike だけ build）する。**Hub OS は app.json.entrypoint を無視して `dist/index.html` を優先起動する経験則** | spike 起動時に本番アプリの UI が表示される事故防止
  - 補足: 2026-05-27 v0.5-spike S1 (`com.spwebcreat.g2runhud.spike.s1` / 0.5.0) を旦那様が Hub Portal に新規アプリで上げて起動 → iPhone Hub アプリ・グラス両方に本番 v0.4.0 UI (READY / RUN / 計測データ) が表示された。原因: vite.config.ts で `input: { main: index.html, spikeS1: spike-s1.html }` の両 entry build で dist/ に本番 main-*.js が混入し、Hub OS が dist/index.html を優先起動。Codex 批判レビュー + dispatch packet 再設計で「本番 index.html 温存」指示を撤回、spike-s1.html → index.html リネーム方針で 0.5.2 / 0.5.3 を再生成して解決

- P1 | spike / 検証用 ehpk を pack する直前 | **dist/ 検査ゲート 4 項目を必ず通す**: (a) `ls dist/assets/ | grep -E '^main-'` が空 = 本番 bundle 不在 / (b) `dist/index.html` 内に spike タイトル文字列が含まれる / (c) `dist/index.html` が spike bundle (`spikeS1-*.js` 等、build 設定によっては `index-*.js` で OK) を import / (d) `grep 'RUN HUD\|metric-distance\|history-list' dist/assets/*.js` で本番 UI 文言の混入なし。共通 chunk `index-*.js` は残ってよい（NG 判定にしない、Codex 指摘） | pack 後に旦那様の手元で本番 UI が起動する事故防止
  - 補足: 2026-05-27 上記 spike build 混入事故の修正後、Codex が必須ゲートとして提案。実装で S1 / S4 両方の clean build (`rm -rf dist && pnpm build`) 後にこの 4 項目を確認、全 PASS で再 pack。ehpk サイズが 46-47KB → 33KB に縮小（本番 bundle 除去の証拠）

- P1 | 旦那様向けに dispatch packet / 手順書を書く場面で「本番ファイルを温存して spike entry を追加する」のような **maintenance friendly に見えるが crash safety を欠く** 設計を書きかける場面 | **「本番ファイルを spike 専用に置き換える」明示**に切り替える。dev-engineer は dispatch packet 通りに素直に実装するため、温存指示は dist/ への本番混入を必ず引き起こす | 秘書の発注設計バグで spike が動かない事故防止
  - 補足: 2026-05-27 spike S1 / S4 の dispatch packet (`docs/v0.5/dispatch/s1-tiles.md` / `s4-mic-pcm.md`) で「既存 `index.html` (本番 v0.4.0) は build.rollupOptions.input.main に温存」と書いたのが root cause。dev-engineer はその通り実装し、Codex 事前レビューでも通過した（本番 entry を残す前提に違和感が出にくい設計）。redesign 後の packet では「spike branch では本番ファイル削除 + spike-sN.html → index.html リネーム」を明示

- P1 | 旦那様の「過去の経験則ラベル」（例: "version 衝突"）に直面した場面 | **実際のエラーメッセージ文字列を一字一句確認**してから経験則に当てはめて判断する。経験則は記憶ラベルなので、別バグでも文字列が同じだと取り違える | 真因 (package_id mismatch) を見逃して version bump で空振りする事故防止
  - 補足: 2026-05-27 spike S1 アップロード失敗の Hub Portal エラー `manifest package_id does not match the app package_id` を旦那様が「いつもの version 被り」と認識 → 私が一度引き下がった → Codex / SDK 調査後に「本番アプリ枠に spike ehpk を入れていた package_id mismatch」と判明。旦那様の経験則 (version 衝突時にも同文言を見たかも) は否定せず、独立に文字列から原因をたどると正確に切り分けできた

- P1 | 旦那様向け実機検証手順 HTML を書く場面 | **「期待画面」「失敗時の対処」「DevTools 接続手順」を必ず本文に含める**。動作 OK 系の手順だけだと、実機で何も見えない / 想定外画面が出た時に旦那様が動けなくなる。最低限以下を盛り込む: (1) 起動直後の期待画面（iPhone Hub アプリのタイトル文字 + グラス側の像）、(2) NG パターン（本番 UI が出たら即中止 等）、(3) DevTools 接続手順（Safari Web Inspector で `[s1]` / `[s4]` ログ）、(4) トラブルシューティング表（症状 → 原因候補 → 対処）、(5) 旧 artifact 警告（cache が効くため version を上げた経緯と新 ehpk の SHA256 / filename） | 旦那様が「何を確認すれば良いか分からない」状態になる事故防止
  - 補足: 2026-05-27 manual-verify.html v1 では「2×2 タイル像を見て GO/NO-GO」しか書いておらず、旦那様が S1 spike 起動後「実機側 UI 何も変わっていなさそう」「何を確認したら良いの？」とブロックされた。v2 で「期待画面表（iPhone タイトル + グラス像）」「DevTools 接続手順」「トラブルシューティング 6 行表」「ehpk 詳細カード（SHA256 / version / 生成日時）」「旧 artifact 禁止カード」を追加して旦那様が独力で進めれる構造に改修

- P1 | 旦那様の作業が止まる規模の大規模事故（spike が動かない / 本番 UI 起動 / 同型エラー連発 等）に直面した場面 | **Plan モード + Codex 第二意見** で必ず一度立ち止まる。旦那様の「ちょっと不安すぎます」「他にも確認してもらってください」等のシグナルは秘書単独判断を再考する明示的サインとして尊重し、独断で進めない | 秘書単独判断の連続失敗回避
  - 補足: 2026-05-28 spike S1 本番 UI 起動事故で旦那様「ちょっと不安すぎます」「Codex にも確認してもらってください」「抜け漏れない修正プラン」要請 → Plan モード + Codex brief 投入 → Codex 承認 + 改善指摘 5 件 (simulate:s4 URL 修正漏れ / dist 検査ゲート 4 項目 / 評価必須項目 / manual-verify 改善要素) → 実装で全反映 → S1/S4 両方 GO 確定。Codex 関与なしで進めていたら simulate:s4 URL 漏れ等で再発リスクあり。「Codex 提案 → Codex 反論 → SDK 検証 → 旦那様判断」の 4 角形 SSOT 化フロー（既存 P1）と相補で機能
