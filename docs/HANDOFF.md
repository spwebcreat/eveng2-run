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

PC ブラウザ単体での動作確認。EvenAppBridge は検出されないので、テストモードで距離 / ペース / 時間が正常に進むかをチェックする用途。

```bash
cd /Volumes/SP-STORAGE\ 1TB/company/Apps/EvenG2/even-g2-run/
pnpm dev
```

ブラウザで http://localhost:5173 を開く。

確認ポイント：

- テストモードチェックが ON
- 「スタート」を押すと距離・ペース・時間が 1 秒ごとに進む
- HUD プレビューに `RUN / 0.01 km / ... / HR -- bpm` が表示される
- 約 6 分待つと LAP 1 のラップ画面に切り替わる（5〜8 秒後に通常 HUD に戻る）
- 一時停止 → 再開 → リセット が動く

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

GPS 取得ができない制約付きの実機確認手段。テストモードでの表示確認用。

```bash
# ターミナル 1
pnpm dev

# ターミナル 2（QR コードを表示）
npx evenhub qr --url http://<PC の LAN IP>:5173
```

`<PC の LAN IP>` は `ifconfig` などで確認（例: `192.168.1.42`）。

スマホの Even Realities アプリのカメラで QR コードを読み取ると、G2 にプラグインが表示される。

**重要な制約**：

- QR サイドロード経路では **navigator.geolocation が動かない**（WebView の生成元の制約）
- したがって実機 G2 でも **テストモードでしか距離が進まない**
- 実 GPS テストは Hub アップロード経路でないと動かない（次節）

---

## 実 GPS テスト（Hub アップロード経路・本番に近い動作）

実 GPS で距離計測したい場合は `.ehpk` をビルドして Even Hub の開発者ポータルに上げる必要がある。

```bash
# .ehpk パッケージを作成（pnpm の built-in pack コマンドと衝突しないように pack:ehpk という名前にしている）
pnpm pack:ehpk
```

→ プロジェクトルートに `g2-run-hud-0.2.5.ehpk` が生成される。
（`pnpm pack` だと pnpm の built-in tarball コマンドが走って `.tgz` が出てしまうので注意）

アップロード手順：

1. Even Hub の開発者ポータル（https://hub.evenrealities.com）にログイン
2. `New plugin` → `.ehpk` をアップロード
3. プラグイン情報を確認（package_id: `com.spwebcreat.g2runhud` / version: `0.2.5`）
4. テスト配信またはサイドロード URL をスマホで開く
5. Even Realities アプリ内で起動 → G2 に HUD が表示される
6. 初回起動時に位置情報の許可ダイアログが出るので「許可」を選ぶ

その後、スマホを持って歩いてみて HUD の距離が増えれば実 GPS が動いている。

---

## テストモード ↔ GPS モード切替

コンパニオン UI（スマホの WebView 画面）の上部に「テストモード」チェックがある：

- **チェック ON（既定）**: 1 秒ごとに約 2.78m 加算（キロ 6 分相当）/ GPS 不要
- **チェック OFF**: navigator.geolocation.watchPosition で実 GPS から距離計測

走行中はチェックが disabled になる（モード変更が距離計算を破壊しないため）。リセットしてから切り替える。

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

- 1km 到達まではラップが出ない（テストモードで約 6 分必要）
- 「履歴クリア」→「リセット」を経由してから再試行

### シミュレーターが起動失敗する

- `pnpm dev` で 5173 が起動しているか確認
- node のバージョン（22.x 推奨）が古すぎないか確認

---

## 既知の制約（MVP の範囲外）

- **スマホ画面ロック中の動作未確認**: バックグラウンド常時計測は未対応
- **心拍数**: 常時 `HR -- bpm` 表示（Apple Watch + HealthKit + WatchConnectivity 連携は Phase 2 で検討）
- **マップ / ナビ表示**: 未実装（Phase 3 で検討）
- **データ保存**: ランの履歴は閉じると消える（LocalStorage 永続化未実装）
- **R1 Ring 入力**: 未対応（テンプル touchpad の Tap / Double Tap のみ）

---

## ディレクトリ構成

```
even-g2-run/
├── package.json
├── app.json                     ← Even Hub manifest
├── index.html                   ← コンパニオン UI
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.ts                  ← エントリ
│   ├── even/
│   │   ├── bridge.ts            ← EvenAppBridge ラッパー
│   │   ├── render.ts            ← HUD テキスト組み立て
│   │   └── input.ts             ← G2 入力ルーティング
│   ├── run/
│   │   ├── state.ts             ← RunStore（状態管理の中心）
│   │   ├── geolocation.ts       ← 実 GPS watchPosition
│   │   ├── pace.ts              ← 平均 / 現在ペース + Haversine
│   │   ├── lap.ts               ← ラップ検知
│   │   ├── messages.ts          ← ランダムメッセージ 10 候補
│   │   └── format.ts            ← 表示用フォーマッタ
│   ├── mock/
│   │   └── dev-mock.ts          ← テストモードのダミー位置
│   └── styles/
│       └── app.css              ← コンパニオン UI 用 dark theme
└── docs/
    └── HANDOFF.md               ← このファイル
```

---

## ロードマップ（MVP 後）

旦那様の優先順位：

1. **データ保存** — ラン履歴の永続化（距離・時間・ペース・ラップ・日付）
   - 候補: LocalStorage / IndexedDB（ブラウザ内）/ 外部 API
   - 設計検討事項: 履歴 UI（コンパニオン UI に追加 or G2 でも見られるように）/ エクスポート機能（CSV / GPX / Strava 連携）
2. **心拍数の反映** — Apple Watch 連携で HR をリアルタイム表示
   - 必要技術: watchOS アプリ + HealthKit + HKWorkoutSession + WatchConnectivity + iOS ネイティブアプリ
   - 現 MVP の WebView 制約上、Even Hub プラグイン単体では実現困難 → Phase 2 でネイティブ化が必要
3. **AI 動的メッセージ** — 心拍 / ペース / ラップから AI が状況に応じた声がけを生成
   - 必要技術: Claude API / OpenAI API 等 + リアルタイム呼び出し最適化
   - 設計検討事項: バッテリー消費 / 通信頻度 / メッセージ生成タイミング（ラップ時のみ or 一定間隔）

## バージョン情報

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
  - テストモード切替（本番ビルドにも残置）
  - Start / Pause / Reset（コンパニオン UI + G2 tap 両対応）
