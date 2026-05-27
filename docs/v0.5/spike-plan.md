# G2 Run HUD v0.5-spike 詳細実装プラン（最初の 1 週）

`docs/v0.5/decision-log.md` で全項目採用が確定した v0.5-spike の具体実装プラン。
Plan agent によって設計、本ログを SSOT として dev-engineer に発注する。

---

## 全体方針

- **v0.5-spike は計測ブランチ専用**。本実装の `main` を汚さない `feat/v0.5-spike` を切り、4 検証の各サブブランチを派生
- **既存 v0.4.0 の text container 構成を温存しつつ、image container 構成を別 entry / 別 dist で並行構築**
- **本番 app_id を汚さない**ため、spike は別 app_id・別 Hub Portal entry で 4 個作成（旦那様承認済）
- 計測結果は `docs/v0.5/spike-results/` 配下に Markdown で残し、本実装 (v0.5) スコープ確定の根拠とする

## Spike 用 app_id / version / Hub Portal 命名規則

| Spike | app.json id | app.json name | version | 出力 ehpk | Hub Portal Description |
|---|---|---|---|---|---|
| S1 | `com.spwebcreat.g2runhud.spike.s1` | `G2 Run HUD Spike S1 (Tiles)` | `0.5.0-spike.s1` | `g2-run-hud-spike-s1-0.5.0.ehpk` | "v0.5-spike S1: 2×2 タイルで 576×288 image 表示検証。本番版とは別アプリ。" |
| S2 | `com.spwebcreat.g2runhud.spike.s2` | `G2 Run HUD Spike S2 (Latency)` | `0.5.0-spike.s2` | `g2-run-hud-spike-s2-0.5.0.ehpk` | "v0.5-spike S2: image update latency 計測。30 分連続稼働。本番版とは別アプリ。" |
| S3 | （Hub upload 不要・ビルド検証のみ） | — | `0.5.0-spike.s3` | — | — |
| S4 | `com.spwebcreat.g2runhud.spike.s4` | `G2 Run HUD Spike S4 (Mic)` | `0.5.0-spike.s4` | `g2-run-hud-spike-s4-0.5.0.ehpk` | "v0.5-spike S4: G2 マイク PCM stream 検証。本番版とは別アプリ。" |

**本番 `com.spwebcreat.g2runhud`（v0.4.0）には一切手を入れない**。spike 終了後に各 spike アプリを Hub Portal から削除。

## dev-engineer prompt 必須 learning P1 ブロック

**全 spike + v0.5 本実装の dev-engineer 発注 prompt 冒頭に、以下のブロックをそのまま挿入する：**

```
## 必読: learning P1 ルール（.claude/rules/learning/core.md より）

1. 同型バグ棚卸し: 修正パターンが他経路（例: mock / restore / cleanup）に潜在しないか
   着手前に棚卸ししてから修正開始。報告に「棚卸し結果」を明記。
2. Codex 指摘は実物検証: SDK / API シグネチャ系の指摘は node_modules/*.d.ts で
   実物確認してから採否判定。鵜呑み禁止。
3. pack / publish 等 script 名衝突回避: pnpm 組み込みコマンド名と衝突するため、
   pack 等は `pack:ehpk` / `pack:s1` のような別名を必ず採用。
4. PNG/JPEG encoded bytes 必須: updateImageRawData には PNG エンコード済み bytes
   （OffscreenCanvas → convertToBlob → Uint8Array）。生 4-bit gray packed bytes は不可。
5. textContainerUpgrade の空文字は前回値残る: content='' は SDK が「変更なし」と
   扱うため、明示的にクリアしたい時は半角スペース ' ' を送る。
6. isEventCapture: 1 は 1 個だけ: 画面全体で 1 container のみ。
   複数指定で createStartUpPageContainer が validation エラー。
7. version bump 3 ファイル必須: リリース時 app.json + package.json +
   scripts.pack:* の出力ファイル名 を必ず同期。
8. Hub Portal Description 更新: リリース時に Description 欄も同時更新。
   古い記述が version またぎで残ると現状機能との乖離発生。
9. 公式 docs SPA 取得不能時: gh api repos/<owner>/<repo>/contents/<path> で
   実コード直接取得（特に LesenmiaoYu/evenhub-templates）。
10. G2 長押し終了は OS レベル: アプリ側で長押しを捕捉する API は無い。
    SYSTEM_EXIT_EVENT / ABNORMAL_EXIT_EVENT 受信で cleanup する設計。
11. 画像ガイド未確認の状態でデザイン変更しない: lightness（ライト/ダーク）判定が
    先。Even OS 2.0 公式 = ライト。
12. 視覚確認できない参照素材は画像エクスポートを依頼: Penpot / Sketch 等の
    バイナリは Read tool で開けないので、PNG エクスポートを必ず要求。
```

この 12 項目のうち、各タスクに関連する番号を「**特に重視**」として個別にハイライトすること。

---

## S1. 2×2 タイルで 576×288 image を実機表示

### 準備
- ブランチ: `feat/v0.5-spike/s1-tiles`
- 新規ファイル:
  - `src/even/image-bridge.ts`（240 行規模、image 4 枚 + event capture text 1 枚構成）
  - `src/even/png-encode.ts`（80 行規模、OffscreenCanvas → PNG `Uint8Array`）
  - `src/spike/s1-tiles.ts`（120 行規模、テストパターン生成 + 描画スクリプト）
- 既存変更: なし（v0.4.0 の `bridge.ts` は touch しない）
- app.json: `name` を `g2-run-hud-spike-s1` に差し替え、`version: "0.5.0-spike.s1"`
- フラグ: `?spike=s1` URL クエリで分岐
- 一時 `vite.config.ts` 変更: `build.rollupOptions.input` に `spike-s1.html` を追加

### 実装ステップ

1. **`src/even/png-encode.ts` 新設**（約 60 行）
   - `OffscreenCanvas(288, 144)` → 2D context → 任意描画関数を受け取り → `convertToBlob({type:'image/png'})` → `Uint8Array`
   - `ctx.imageSmoothingEnabled = false` で 1bit/4-bit 風モノクロ描画
   - learning P1: 「PNG encoded bytes を渡す（生 4-bit gray packed bytes は不可）」

2. **`src/even/image-bridge.ts` 新設**（約 220 行）
   - `attachG2HudImage(bridge, initialTiles)` を export
   - `CreateStartUpPageContainer({ containerTotalNum: 5, imageObject: [tile00..tile11], textObject: [eventCapture] })`
   - container ID 配置:
     - `imgTopLeft = 20`（x=0, y=0, w=288, h=144）
     - `imgTopRight = 21`（x=288, y=0, w=288, h=144）
     - `imgBotLeft = 22`（x=0, y=144, w=288, h=144）
     - `imgBotRight = 23`（x=288, y=144, w=288, h=144）
     - `textEvents = 10`（x=0, y=0, w=576, h=288, `isEventCapture=1`, content=`' '`, paddingLength=0）
   - `renderTiles(tiles: Map<ContainerId, Uint8Array>)`: 既存 `bridge.ts` と同じ Promise チェーン直列化 + `lastSent` dedup（PNG bytes 比較: SHA-1 or 簡易バイト比較）
   - `updateImageRawData(new ImageRawDataUpdate({ containerID, containerName, imageData: bytes }))` 経由
   - learning P1: 「`isEventCapture: 1` は 1 個だけ」

3. **`src/spike/s1-tiles.ts` 新設**（約 120 行）
   - テストパターン 3 種:
     - **A. 境界線パターン**: 各タイル外周に黒 1px 枠 + タイル中央に座標文字（`TL` `TR` `BL` `BR`）
     - **B. 連続グラデーション**: 4 タイルを跨ぐ横方向グラデーション（黒→白→黒）
     - **C. 大型タイポ**: タイル境界を跨ぐ巨大「12:34」テキスト（H=120px Courier New）
   - `attachG2HudImage` で 4 枚同時生成・送信、各パターンを 5 秒ずつ切替

4. **`spike-s1.html` 新設 + `vite.config.ts` 修正**（合計 30 行）
5. **`app.json` の `entry` を `spike-s1.html` に変更し、`pack:ehpk` を `pack:s1` として新設**（5 行）

### 検証ステップ

1. **シミュレータ**（先行確認）
   - `pnpm dev` + simulator で `?spike=s1` 起動
   - Console: `[s1] tile sent containerID=20 bytes=NNNN ms=NN` を 4 枚分ログ出力
   - **境界の物理ズレは実機判定が必須**

2. **実機 G2**
   - ehpk を Hub Portal に上げて launch（Dev Mode）
   - パターン A: 各タイル外周枠が **連続した 576×288 外周枠**として見えるか
   - パターン B: グラデーションの段差・1 列ずれ・色ジャンプの有無
   - パターン C: 大型タイポが境界をまたいでも 1 文字に見えるか
   - 1 枚だけ更新時、他 3 枚が前回値を保持するか

3. **ログ収集**
   - 各 tile の `updateImageRawData` の戻り値 (`ImageRawDataUpdateResult`) を全件ログ
   - `isImageSizeInvalid` / `isImageToGray4Failed` / `isSendFailed` の検出

### 完了判定

- **GO 条件（全て満たす）**:
  - パターン A の外周枠が連続して見える（タイル間隙間 ≤ 1px 目視）
  - パターン B のグラデーションが境界で段差を起こさない
  - パターン C の文字が境界で分断されない
  - `ImageRawDataUpdateResult.success` が 4/4 タイル
- **部分 GO**: 1〜2 タイルだけ更新する場合に問題なし、4 同時は不安定 → v0.6 は「部分更新」に制限
- **NO-GO**: 境界が明確に見える/タイル更新が独立しない → v0.6 image HUD 路線は全廃

### dev-engineer 発注 Prompt 雛形

```
# v0.5-spike S1: 2×2 タイルで 576×288 image 実機表示検証

## 目的
G2 image container の max_count=4 / width≤288 / height≤144 制約下で、
2×2 配置で 576×288 全画面を 1 枚絵として表示できるかを実機で実証する。

## 成果物
- src/even/png-encode.ts （新規、約 60 行）
- src/even/image-bridge.ts （新規、約 220 行）
- src/spike/s1-tiles.ts （新規、約 120 行）
- spike-s1.html（新規、最小 HTML）
- vite.config.ts に entry 追加
- app.json を spike 用 entry に切替
- package.json に pack:s1 script 追加

## 制約（必読）
1. learning P1「PNG encoded bytes を渡す（生 4-bit gray packed bytes は不可）」
   → OffscreenCanvas → convertToBlob({type:'image/png'}) → Uint8Array
2. learning P1「isEventCapture: 1 は 1 個だけ」
   → image 4 枚は全て isEventCapture なし、text 1 枚（透明全画面）のみ capture=1
3. learning P1「textContainerUpgrade の '' は前回値残る → スペース必須」
4. SDK 制約: containerTotalNum 1〜12、imageObject max_count=4
5. learning P1「version bump 3 ファイル必須」

## 同型バグの棚卸し（重要）
- 既存 src/even/bridge.ts の lastSent dedup / Promise チェーン直列化パターンを
  image-bridge.ts でも踏襲する
- F8 系の「同期 onError 再入バグ」は image 経路にも潜む可能性あり

## 完了条件
- シミュレータで 4 タイル描画ログが全件 success
- ehpk が pack:s1 で正常出力

## NG: 着手しないでよいこと
- 実機検証手順の自動化（秘書が手動でやる）
- v0.4.0 の text container bridge.ts への変更
- companion UI 側の DOM 変更
```

---

## S2. image update p95 latency 計測

### 準備
- ブランチ: `feat/v0.5-spike/s2-latency`（S1 に依存）
- S1 の `image-bridge.ts` を再利用
- 新規ファイル:
  - `src/spike/s2-latency.ts`（約 200 行、3 パターン × 30 分計測ハーネス）
  - `src/spike/latency-meter.ts`（約 80 行、histogram）
- フラグ: `?spike=s2&pattern=A|B|C&duration=1800` URL クエリ

### 実装ステップ

1. **`src/spike/latency-meter.ts` 新設**（約 80 行）
   - `class LatencyMeter`: 各 sample を `Array<number>` に push、`p50()/p95()/p99()`
   - フレーム脱落判定（想定 - 実際 > 100ms）
   - `dump()`: JSON 文字列 + localStorage 永続化

2. **`src/spike/s2-latency.ts` 新設**（約 200 行）
   - 現実的なペース変動データ（距離、ペース、HR）
   - 3 パターン:
     - **A. 1Hz**: `setInterval(render, 1000)`
     - **B. 状態変化のみ**: distance 0.01km / pace 1s / hr 1bpm / time 1s 変化時のみ
     - **C. 200ms**: `setInterval(render, 200)`
   - 各 render: encode 開始 → 完了 → resolve の latency 計測
   - 30 分経過で自動停止 → `meter.dump()`
   - **重要**: パターン B では sentinel で二重 render 防止

3. **温度・電池記録**（手動）
   - 30 分連続後の `navigator.getBattery()` と「触感」
   - 専用 UI: 経過秒・サンプル数・現在の p50/p95 をリアルタイム表示

4. **`app.json` / pack スクリプト**
   - 3 パターンを 1 つの ehpk で URL クエリ切替

### 検証ステップ

1. **シミュレータ**: パターン A を 5 分実行、サンプル ≈ 300、p50/p95 ログ確認
2. **実機 G2 × 3 パターン × 30 分 = 計 90 分**
3. **観察項目**: p95 latency、フレーム脱落率、SDK エラー、触感、電池消費

### 完了判定（仮基準、Codex 確認後確定）

- **A 採用**: p95 ≤ 300ms、脱落率 ≤ 1%、電池 30 分で ≤ 5%
- **B 採用**: p95 ≤ 150ms、脱落率 ≤ 0.5%、電池 30 分で ≤ 3%
- **C 採用**: p95 ≤ 250ms、脱落率 ≤ 2%、電池 30 分で ≤ 8%

### dev-engineer 発注 Prompt 雛形

```
# v0.5-spike S2: image update p95 latency 計測

## 前提
S1 の image-bridge.ts が完成し、4 タイル更新が安定動作している前提。
S1 が NG なら本タスクは凍結。

## 成果物
- src/spike/latency-meter.ts（新規、約 80 行）
- src/spike/s2-latency.ts（新規、約 200 行）
- ?spike=s2&pattern=A|B|C URL クエリ切替

## 制約
1. learning P1「dev 環境では EvenAppBridge 未検出のスタンドアロンモード」
2. learning P1「同型バグの棚卸し」F8 系
   → パターン B の状態変化検出 → render 経路で同期 callout 再帰を防御
3. 30 分連続稼働中の Wake Lock を `navigator.wakeLock.request('screen')` で試みる
4. latency 計測は performance.now() のみ使用

## 計測項目
- p50/p95/p99 latency (ms): PNG encode 開始 → updateImageRawData resolve まで
- 内部 breakdown: encode-only / send-only / total
- フレーム脱落数 / SDK エラー回数

## 同型バグ棚卸し
- F8 系: 状態変化 callback で同期 render 再入
- W4 系: cleanup 時に setInterval / wakeLock release
- 既存 bridge.ts の lastSent dedup を image-bridge.ts でも適用済か

## NG
- グラフ可視化の凝った UI（プレーンテキストで十分）
- 計測値の Claude 経由 push 通知などの過剰機能
```

---

## S3. even-toolkit + upng-js ビルド検証

### 準備
- ブランチ: `feat/v0.5-spike/s3-toolkit-build`
- **独立性高い（S1/S2 と並列可）**
- 新規ファイル:
  - `docs/v0.5/spike-results/s3-toolkit-build-report.md`
- 既存変更: `package.json` に `even-toolkit@^1.7.2` を追加
- ブランチ専用なので main に merge しない

### 実装ステップ

1. **`pnpm add even-toolkit upng-js`**（5 分）
2. **テスト用 import スクリプト 3 種**を `src/spike/s3-imports/` 配下に作成（合計 120 行）
   - `text-clean-only.ts`: `import { cleanForG2 } from 'even-toolkit/glasses/text-clean'`
   - `png-utils-only.ts`: `import { someUtil } from 'even-toolkit/png-utils'`
   - `full-glasses.ts`: `import * from 'even-toolkit/glasses'`
3. **3 種それぞれを vite build → bundle size 計測**
   - `dist/assets/*.js` を `du -h` / `gzip -c | wc -c`
   - **比較基準**: 現 v0.4.0（toolkit 無し）の bundle size
4. **tree-shaking 動作確認**
   - 成果物から関数名を grep
5. **SDK 0.0.10 互換性**
   - `node_modules/even-toolkit/package.json` の peer dep 確認
   - `tsc --noEmit` でコンパイル確認
6. **報告書スケルトン**

### 完了判定

- **部分採用 GO**:
  - `text-clean-only` ビルドが React/react-router を引かない
  - subpath import が動く
  - bundle size 増加が +50KB gzip 以内
  - SDK 0.0.10 互換 OK
- **NO-GO**: subpath import 不可 → 自前で `text-clean` 相当を 30 行実装

### dev-engineer 発注 Prompt 雛形

```
# v0.5-spike S3: even-toolkit + upng-js ビルド検証

## 目的
fabioglimb/even-toolkit v1.7.2 を部分採用できるかをビルドだけで判定する。
実機テストは不要。

## 成果物
- src/spike/s3-imports/text-clean-only.ts
- src/spike/s3-imports/png-utils-only.ts
- src/spike/s3-imports/full-glasses.ts
- 各シナリオの vite build 出力サイズ計測ログ
- docs/v0.5/spike-results/s3-toolkit-build-report.md（事実のみ、判断は秘書）

## 検証項目
1. pnpm add even-toolkit upng-js で peer dep 警告
2. text-clean 単体 import の tree-shaking
3. png-utils 単体 import で upng-js が自動引かれるか
4. SDK 0.0.10 と toolkit 1.7.2 の peer dep 互換性
5. bundle size: 各シナリオで raw / gzip

## 制約
1. learning P1「Codex 指摘は鵜呑み禁止で実物検証」
   → toolkit の peer dep / sub-path export を package.json で直接確認
2. 既存 v0.4.0 の text container 構成は壊さない
3. main ブランチに merge しない

## 同型バグ棚卸し
- 既存 SDK peer dep 0.0.10 で fix されているか
- vite 5.x + TypeScript 5.7 で toolkit が ES module 解決失敗しないか

## NG
- 「採用すべき / すべきでない」の結論を勝手に書く
- 既存 src/main.ts に toolkit を導入する
```

---

## S4. G2 マイク PCM stream ペアリング

### 準備
- ブランチ: `feat/v0.5-spike/s4-audio-pcm`
- **独立性高い（S1/S2/S3 と並列可）**
- 新規ファイル:
  - `src/spike/s4-audio.ts`（約 150 行）
  - `src/spike/s4-bridge.ts`（既存 bridge.ts の最小複製、約 30 行）
- フラグ: `?spike=s4` URL クエリ

### 実装ステップ

1. **シンプルな text-only bridge を spike 用に複製**（30 行）
2. **`src/spike/s4-audio.ts` 新設**（約 150 行）
   - `await bridge.audioControl(true)` でマイク ON
   - `bridge.onEvenHubEvent` で `audioEvent.audioPcm` を受信
   - 受信ごとに時刻、bytes 長を記録、リアルタイム表示
   - 10 秒に 1 回サマリ console.log
   - 5 分後自動 OFF
3. **PCM フォーマット検出**
   - 1 秒分の bytes 合計でサンプルレート逆算
   - 先頭 16 byte hex
4. **エラーパターン** を明確に区別

### 完了判定

- **GO**:
  - `audioControl(true)` が true
  - 1 秒以内に初回 `audioEvent` 発火
  - 連続発火 interval p95 ≤ 500ms
  - 1 秒あたり ≥ 8,000 B/s
- **NO-GO**: audioEvent が来ない → v0.9 音声コマンドは PWA 側 Web Speech API へ方針転換

### dev-engineer 発注 Prompt 雛形

```
# v0.5-spike S4: G2 マイク PCM stream ペアリング検証

## 成果物
- src/spike/s4-bridge.ts（最小複製、約 30 行）
- src/spike/s4-audio.ts（新規、約 150 行）
- spike-s4.html

## 制約
1. SDK 既知挙動:
   - bridge.audioControl(isOpen: boolean): Promise<boolean>
   - event.audioEvent?.audioPcm: Uint8Array
2. learning P1「isEventCapture: 1 は 1 個だけ」
3. learning P1「textContainerUpgrade の '' は前回値残る」

## 計測項目
- audioControl 戻り値 + latency
- 初回 audioEvent latency
- 連続発火 interval (p50, p95)
- 平均受信レート (bytes/sec)
- PCM 先頭 16 byte hex

## 同型バグ棚卸し
- F8 系: audioEvent listener 内の同期再入
- W4 系: cleanup 時 audioControl(false) と unsub 順序
- 同期 onError 再入

## NG
- STT エンジン組み込み（v0.9 で実施）
- PCM の音声処理（FFT 等）
- companion UI への音声波形表示
```

---

## 優先順位と並列実行可否

| 検証 | 優先度 | 依存関係 | 並列可否 |
|---|---|---|---|
| **S1. 2×2 タイル** | 最優先（ブロッキング） | なし | 単独着手 |
| **S2. latency 計測** | 高 | **S1 GO 必須** | S1 完了後 |
| **S3. toolkit ビルド** | 中 | なし（ビルドのみ） | **S1/S2/S4 と完全並列** |
| **S4. PCM stream** | 中 | なし（独立 spike） | **S1/S2/S3 と完全並列** |

### 推奨実行順
1. **Day 1〜2**: S1 + S3 + S4 を並列着手（dev-engineer に 3 並列発注）
2. **Day 3**: S1 結果評価 → GO/NO-GO 判定
3. **Day 4〜6**: S1 GO なら S2 開始
4. **Day 7**: 全 4 検証結果を `docs/v0.5/spike-results/summary.md` に集約

### S1 がブロッキングである理由
- S2 は「image を 4 タイルで更新できる前提」が崩れたら計測自体が成立しない
- S1 NO-GO 時は S2 を「単タイル × 3 パターン」に縮小して継続

---

## 総所要時間見積（副業ペース週 10〜15h 想定）

| 項目 | 秘書作業 | dev-engineer 作業 | 実機検証（旦那様 + 秘書） |
|---|---|---|---|
| S1 発注準備 + レビュー | 2h | 5h | 1h |
| S2 発注準備 + レビュー | 2h | 6h | 3h |
| S3 発注準備 + レビュー | 1h | 3h | 0h |
| S4 発注準備 + レビュー | 1h | 4h | 0.5h |
| 結果集約 + Codex 相談 | 3h | 0h | 0h |
| 小計 | **9h** | **18h** | **4.5h** |
| **バッファ +25%**（差し戻し / Hub upload / 再計測） | **2.5h** | **4.5h** | **1.5h** |
| **合計** | **11.5h** | **22.5h** | **6h** |

- **副業ペース週 10〜15h** で秘書 11.5h + 実機 6h = **17.5h** → **1〜1.5 週間で収まる現実レンジ**
- dev-engineer 22.5h は 3 並列発注で実時間 1〜1.5 週間に圧縮可能
- バッファの内訳:
  - **差し戻し**: dev-engineer 提出物に learning P1 違反やバグがあった場合の再修正
  - **Hub Portal upload**: 4 個の spike アプリ登録 + Description 設定 + 削除作業
  - **再計測**: S2 latency が初回 NG 値だった場合の追加計測 / S1 視認性問題の写真追加

---

## 成功時 / 失敗時の v0.5 本実装への影響

### 全 4 GO シナリオ
- v0.5 本実装は計画通り 6 項目を 2 週間で実装
- v0.6 image HUD への基盤確定

### S1 NO-GO（最大インパクト）
- v0.6 image HUD 路線が全廃 → **v0.6 縮小**: text container 改善、HR sparkline は text 文字描画で擬似実装
- v0.7 React 化は維持（companion 用）、v0.8/v0.9 は影響軽微
- 旦那様 + Codex に **「画像 HUD 諦め判断」の正式記録**を判断ログに追記

### S2 部分 NO-GO
- 採用パターンを **B（状態変化のみ）** に限定 → v0.6 は **静的画面 image + 走行中 text** ハイブリッド

### S3 NO-GO
- toolkit 部分採用断念 → **自前 text-clean 実装**（30 行）
- v0.7 React + toolkit/web 導入は再評価

### S4 NO-GO
- v0.9 音声コマンドが **PWA Web Speech API 経由に方針転換**
- v0.5/v0.6/v0.7/v0.8 に影響なし

---

## 参照ファイル

- `/Volumes/SP-STORAGE 1TB/company/Apps/EvenG2/even-g2-run/src/even/bridge.ts`（既存 text bridge、image-bridge.ts の参考実装パターン元）
- `/Volumes/SP-STORAGE 1TB/company/Apps/EvenG2/even-g2-run/node_modules/@evenrealities/even_hub_sdk/dist/index.d.ts`（SDK API 仕様 SSOT）
- `/Volumes/SP-STORAGE 1TB/company/Apps/EvenG2/even-g2-run/package.json`（pack スクリプト / dep 追加）
- `/Volumes/SP-STORAGE 1TB/company/Apps/EvenG2/even-g2-run/app.json`（entry / version 切替）
- `/Volumes/SP-STORAGE 1TB/company/Apps/EvenG2/even-g2-run/.claude/rules/learning/core.md`（dev-engineer 発注 prompt に必須参照）
