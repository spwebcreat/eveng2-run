# G2 Run HUD — 旦那様向けハンドオフ

ローカル開発から実機 G2 表示までの手順をまとめたドキュメントです。

---

## 必要な事前準備

### スマホ側

- **Even Realities iOS / Android アプリ**（コンパニオンアプリ）
  - App Store / Google Play から「Even Realities」で検索してインストール
  - G2 と Bluetooth ペアリング済みの状態にしておく
- **Even Hub plugin の有効化**
  - コンパニオンアプリ内で Hub のページが表示できることを確認

### PC 側

- Node.js 22.x（volta 管理推奨）
- pnpm 10.x
- 同一 LAN（PC と スマホ が同じ Wi-Fi に接続されていること）

---

## ローカル開発（PC ブラウザ確認）

PC ブラウザ単体での動作確認。EvenAppBridge は検出されないので、companion UI のメトリクス表示・ボタン応答・HUD プレビュー組み立てが正しく動くかをチェックする用途。GPS は PC ブラウザでは許可されても屋内では取得困難なため、距離・ペースの実動作確認は実機 Hub アップロード経路で行う。

```bash
cd /Volumes/SP-STORAGE\ 1TB/company/Apps/EvenG2/even-g2-run/
pnpm dev
```

ブラウザで http://localhost:5173 を開く。

確認ポイント：

- 「スタート」を押すと `状態: running / 画面: gps-waiting` に遷移する
- HUD プレビューに `[ステータス] RUN ▶` 等が表示される
- 一時停止 → 再開 → リセット が動く（GPS サンプルが来なくても経過時間は進む）

---

## シミュレーター動作（PC で G2 表示模擬）

EvenAppBridge をモックして G2 描画 API の呼び出しを確認できる。

```bash
# ターミナル 1
pnpm dev

# ターミナル 2
pnpm simulate
```

`pnpm simulate` は `evenhub-simulator http://localhost:5173` を起動するので、別ウィンドウで G2 表示の模擬画面が見える。

---

## 実機 G2 ローカル接続（QR サイドロード）

QR サイドロード経路は **navigator.geolocation が動かない**（WebView の生成元制約）。レイアウト・UI 配置の確認のみに使い、距離・ペースの実動作確認は Hub アップロード経路で行う。

```bash
# ターミナル 1
pnpm dev

# ターミナル 2（QR コードを表示）
npx evenhub qr --url http://<PC の LAN IP>:5173
```

`<PC の LAN IP>` は `ifconfig` などで確認（例: `192.168.1.42`）。

スマホの Even Realities アプリのカメラで QR コードを読み取ると、G2 にプラグインが表示される。

---

## 実 GPS テスト（Hub アップロード経路・本番動作）

実 GPS で距離計測したい場合は `.ehpk` をビルドして Even Hub の開発者ポータルに上げる必要がある。

```bash
# .ehpk パッケージを作成（pnpm の built-in pack コマンドと衝突しないように pack:ehpk という名前にしている）
pnpm pack:ehpk
```

→ プロジェクトルートに `g2-run-hud-0.4.0.ehpk` が生成される。
（`pnpm pack` だと pnpm の built-in tarball コマンドが走って `.tgz` が出てしまうので注意）

アップロード手順：

1. Even Hub の開発者ポータル（https://hub.evenrealities.com）にログイン
2. `New plugin` → `.ehpk` をアップロード
3. プラグイン情報を確認（package_id: `com.spwebcreat.g2runhud` / version: `0.4.0`）
4. テスト配信またはサイドロード URL をスマホで開く
5. Even Realities アプリ内で起動 → G2 に HUD が表示される
6. 初回起動時に位置情報の許可ダイアログが出るので「許可」を選ぶ

その後、スマホを持って歩いてみて HUD の距離が増えれば実 GPS が動いている。

---

## トラブルシュート

### Vite dev で `Error: EACCES` 等が出る

`/Volumes/SP-STORAGE 1TB/...` のパスにスペースが含まれている影響の可能性。パスをダブルクォートで囲って実行：

```bash
cd "/Volumes/SP-STORAGE 1TB/company/Apps/EvenG2/even-g2-run/"
pnpm dev
```

### `pnpm simulate` で「ポート使用中」

`pnpm dev` を先に起動して 5173 を占有してから `pnpm simulate` を起動。逆順だと simulator が起動しない。

### G2 に何も表示されない（QR サイドロード経由）

- スマホと G2 の Bluetooth が切れていないか確認（Even Realities アプリ内の接続ステータス）
- スマホと PC が同じ LAN にいるか確認
- ブラウザ（コンパニオン UI）でステータス欄を見る:
  - 「G2 ブリッジ: 接続済」→ G2 側で表示が出ているはず
  - 「G2 ブリッジ: スタンドアロン」→ EvenAppBridge が来ていない（QR ではなく Hub アップロードで再試行）

### GPS モードに切り替えても距離が進まない

- スマホで位置情報の許可をしているか確認（Even Realities アプリの権限設定）
- 屋内では精度（accuracy）が悪く 30m 超で弾く実装なので、屋外で再試行
- コンパニオン UI のステータス欄に `GPS エラー: 位置情報を許可してください` 等が出ていれば原因が分かる

### ラップ画面が出ない

- 1km 到達まではラップが出ない
- 「リセット」を経由してから再試行（v0.3.0 で「履歴クリア」ボタンは削除されています）

### シミュレーターが起動失敗する

- `pnpm dev` で 5173 が起動しているか確認
- node のバージョン（22.x 推奨）が古すぎないか確認

---

## 既知の制約（v0.3.0 時点）

- **スマホ画面ロック中・Even Hub バックグラウンド中の GPS は止まる**: SDK が Background Location を提供しないため。前面維持時の復帰耐性は Wake Lock + visibilitychange で改善済だが、ポケット運用は不可（手持ち推奨）
- **心拍数**: 常時 `HR -- bpm` 表示（SDK に HealthKit / WatchConnectivity bridge が無く実装不能）
- **マップ / ナビ表示**: 未実装
- **AI 動的メッセージ**: 未実装（心拍データ無しでの設計再検討待ち）

### v0.3.0 で対応済（旧 MVP 制約からの解消）

- **データ保存**: ラン履歴を SDK storage / browser localStorage に永続化（100 件上限、古いものから drop）
- **R1 Ring 入力**: SCROLL_TOP / SCROLL_BOTTOM 対応。実機での payload shape 確認は debug log で行う（後述）

---

## ディレクトリ構成

```
even-g2-run/
├── package.json
├── app.json                     ← Even Hub manifest
├── index.html                   ← コンパニオン UI（モード選択 + 現在 LAP + 過去の走行）
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.ts                  ← エントリ（DOM / 履歴連携 / bootstrap）
│   ├── even/
│   │   ├── bridge.ts            ← EvenAppBridge ラッパー（8 text container 構成）
│   │   ├── render.ts            ← HUD テキスト組み立て（Page 1/2/3 切替対応）
│   │   └── input.ts             ← G2 入力ルーティング（Tap / Double Tap / R1 SCROLL）
│   ├── run/
│   │   ├── state.ts             ← RunStore（status / mode / currentPage / onHistorySave）
│   │   ├── geolocation.ts       ← 実 GPS watchPosition
│   │   ├── pace.ts              ← 平均 / 現在ペース + Haversine
│   │   ├── lap.ts               ← ラップ検知
│   │   ├── summary.ts           ← LAP サマリ算出（最速 / 最遅 / 平均）
│   │   ├── messages.ts          ← ランダムメッセージ 10 候補
│   │   └── format.ts            ← 表示用フォーマッタ
│   ├── storage/
│   │   ├── types.ts             ← RunHistory / RunHistoryEntry スキーマ
│   │   ├── ports.ts             ← StoragePort interface
│   │   ├── sdk-adapter.ts       ← Even Hub SDK localStorage adapter
│   │   ├── browser-adapter.ts   ← window.localStorage fallback adapter
│   │   └── run-history.ts       ← load / append / clear（100 件上限）
│   └── styles/
│       └── app.css              ← コンパニオン UI 用 dark theme
└── docs/
    ├── HANDOFF.md               ← このファイル（旦那様向け）
    ├── ROADMAP.md               ← AI 用ロードマップ
    ├── ROADMAP.html             ← 旦那様向けロードマップ（ブラウザ）
    └── CLAUDE_IMPLEMENTATION_BRIEF.md ← CODEX 補正資料
```

---

## ロードマップ

詳細は `docs/ROADMAP.md` / `docs/ROADMAP.html` 参照。サマリのみ:

- **Phase 1** ✅ MVP（v0.2.6 / 2026-05-24）
- **Phase 2** ✅ LAP + 履歴 + RUN/WALK + R1 リング（v0.3.0 / 2026-05-26）
- **Phase 2.1** ✅ UI を Even OS 2.0 公式ガイド準拠化 + ページインジケータ + 日付別履歴（v0.4.0 / 2026-05-26）
- **Phase 3** ⏸ 心拍数（Apple Watch / HealthKit）— SDK に bridge が無く保留
- **Phase 4** ⏸ AI 動的メッセージ — Phase 3 依存で保留

## バージョン情報

- v0.4.0（2026-05-26）: **Even OS 2.0 公式デザイン準拠化 + G2 ページインジケータ + 履歴日付別**
  - **iPhone UI 全面リライト**: 公式 `docs/design/` ガイドの Color Palette / Layout / Typography / Group コンポーネントに準拠
    - ライトテーマ（BC-3rd `#F3F3F3` ベース・TC-1st `#252525` 本文）に転換（旧ダーク `#232323` から完全変更）
    - 公式 Selector パターンで RUN / WALK モード選択（黒塗りアクティブ）
    - 公式 Card / Lists パターンで現在 LAP・過去の走行カード
    - フォント代替: Inter / Helvetica Neue（FK Grotesk 代替）、letter-spacing 公式値 (-0.72px〜-0.11px) を採用
    - Type scale 公式準拠（Very Large 24 / Large 20 / 17 / 15 / 13 / 11）
  - **G2 ページインジケータ**: 下段右 textStatus にドット表示（Page 1=`●○○` / 2=`○●○` / 3=`○○●`）。Page 2/3 でも表示維持で現在ページが分かるように
  - **G2 mode 視覚化**: READY 表示に mode を含める（`READY ▶ RUN` / `READY ▶ WALK`）、走行中も `WALK ▶` を出すように statusLabel を拡張。R1 リング READY 中切替の効果が画面で見える
  - **過去ログ日付別グループ化**: 「今日 / 昨日 / 今週 / それ以前」の 4 グループにヘッダー付きで分類
  - 視覚的に大きく変わるが、内部ロジック（state / storage / input）は無変更で互換性維持
- v0.3.0（2026-05-26）: **Phase 2 完成 — LAP 拡張 + 履歴永続化 + RUN/WALK + R1 リング**
  - **G2 表示の 3 ページ化**: Page 1 = HUD（既存）/ Page 2 = 直近 3 LAP リスト / Page 3 = サマリ（最速/最遅/平均）
  - **R1 リング SCROLL 入力**: 走行中 / 一時停止中はページ送り、READY 中はモード切替（RUN ⇄ WALK）
  - **RUN / WALK モード選択**: コンパニオン UI セグメンテッドコントロール。走行中は disabled。履歴に記録
  - **走行履歴の永続化**: `reset()` 時に距離 > 0 なら自動保存（SDK localStorage 優先 / browser localStorage fallback）
  - **過去の走行カード**: 日時・モード・距離・経過時間・平均ペース表示。タップで LAP 詳細展開
  - **履歴クリア**: 2 段階確認（「クリア」→ 3 秒以内「もう一度タップで確定」）
  - 旧「履歴クリア」ボタンは削除（reset と意味が同じため簡素化）
  - **入力デバッグログ**: R1 リング由来 payload 確認用に `console.debug` 出力（実機 sysEvent / textEvent 判別後に削除予定）
- v0.2.6（2026-05-24）: テストモード完全削除
  - `src/mock/dev-mock.ts` と関連 UI / state（`isTestMode` / `setTestMode`）を削除
  - 常に実 GPS モードで動作（QR サイドロード時は GPS 取得不可・Hub アップロード経路必須）
  - dev 環境では companion UI のメトリクス表示・ボタン応答・HUD プレビュー組み立て確認のみ可能
  - bundle サイズ 88.79 → 85.03 kB に縮小
- v0.2.5（2026-05-24）: メッセージ中央寄せ + 終了操作の文言修正
  - idle / paused メッセージを全角スペース padding で中央寄せ近似
  - paused 時の終了案内を「ダブルタップで終了」→ **「長押しで終了」** に修正
    （長押しは G2 ハードレベルでアプリ強制終了する挙動。`SYSTEM_EXIT_EVENT` 受信時に cleanup 実行）
  - ダブルタップは引き続きリセット動作
- v0.2.4（2026-05-24）: メッセージ領域に START / END 視覚ガイド追加
  - idle 時: `START ◀`（タップで開始のヒント・スタート時のみ表示）
  - paused 時: `END   ダブルタップで終了`（v0.2.5 で「長押しで終了」に訂正）
  - 実機計測精度確認済: Apple Watch 比較で距離 +0.02km、ペース差 6 秒（許容範囲）
- v0.2.3（2026-05-24）: アイコン廃止 + 3x3 グリッドレイアウト確定 + ステータス記号化
  - アイコン（v0.2.x で試行）を完全廃止し、純テキスト 3x3 グリッド構成に
  - 上段: 経過時間 / 距離 / 日付時刻、中央: メッセージ表示領域、下段: 心拍数 / 平均ペース / ステータス
  - ステータスを媒体プレーヤー風記号付きに変更（RUN ▶ / PAUSE \|\| / READY ▶ / GPS / ERROR / LAP）
  - 操作ガイド（II TAP=... / X HOLD=...）を完全廃止
  - text 8 container（events 1 + 表示 7）構成、image container は使わない
- v0.2.1（2026-05-24・未公開）: UI 12 container 構成 + アイコン追加 + 実機表示修正
  - アイコン採用（4-bit gray → PNG bytes 方式）。実機表示で大きさ/デザインに課題が残り v0.2.3 で廃止
  - 現在時刻・日付表示を追加（`5月24日  10:36` 形式）
  - 中央にメッセージ表示領域を追加（ラップ時 / GPS 待ち / エラー時に内容差替）
  - 表示ラベルを日本語に統一（経過時間 / 距離 / 平均ペース / 心拍数）
  - GPS 復帰対策: visibilitychange で watchPosition 再起動 + Screen Wake Lock
  - 自動 pause / resume: 直近 30 秒・5m 未満で pause、5m 以上の移動で resume
- v0.1.0（2026-05-24）: 初回 MVP
  - 距離 / 平均ペース / 経過時間 / 心拍プレースホルダー表示
  - 1km ラップ自動検知 + ランダムメッセージ
  - テストモード切替（v0.2.6 で削除）
  - Start / Pause / Reset（コンパニオン UI + G2 tap 両対応）
