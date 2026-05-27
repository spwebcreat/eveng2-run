# G2 Run HUD v0.5 本実装プラン（spike 後の 2 週間）

`docs/v0.5/decision-log.md` で確定した v0.5 の 6 項目を実装するためのプラン。
v0.5-spike 完了後に開始。spike の結果によって RendererPort 抽象の中身が変わる。

---

## 前提条件

- v0.5-spike のうち **S1 / S3 / S4 が完了済**（`docs/v0.5/spike-plan.md`）
  - S2（image update latency 計測）は v0.5 では不要、**v0.6 image HUD 着手前に必須**
- S3 toolkit 判断確定（text-clean は safe wrapper 経由で採用 = P0-1 で対応済）
- S1 / S4 の実機 GO/NO-GO は v0.5 着手判定に**不要**（S1 は v0.6 で判定、S4 は v0.9 まで影響なし）
- v0.5 範囲は text HUD 改善 + 基盤（RendererPort 抽象 / Settings / GPX schema v2 / HR 削除 / text-clean）に集中
- 旦那様の最終 GO

---

## v0.5 採用 6 項目（全採用確定）

### v0.5-1. Locked-phone QA 強化 [阻害 / QA]

**目的**: Hub 審査で見られる「スマホロック状態 / バックグラウンド遷移時」の挙動を担保。

**現状の弱点**（`docs/HANDOFF.md:146` 等）:
- iOS WebView はバックグラウンドで JS 実行が ~5 秒で凍結
- `watchPosition` callback が停止 → 経過時間と距離が乖離
- Wake Lock が visibility 切替で自動解放される
- 復帰時の補正が一部しか効いていない

**実装内容**:
1. `src/main.ts` の Wake Lock + Visibility 補正を強化（既存 + 60〜100 行）
   - 復帰時に「lock 状態だった時間」を `Date` 差分で再計算
   - Wake Lock 再取得失敗時の retry（最大 3 回）
2. **Service Worker 導入**（新規 `public/sw.js`、約 100 行）
   - 主目的は「バックグラウンド継続」ではなく「PWA としての install/offline」
   - `Cache API` で静的アセットをキャッシュし、Hub 審査の offline test 通過
3. `src/run/state.ts` の elapsedMs 補正ロジックを Date 差分ベース統一に
4. 復帰時の `setStatus('GPS restoring...')` UX 追加

**QA テストチェックリスト**（Codex 指摘で具体化）:

| 項目 | シナリオ | 期待動作 | 計測値 |
|---|---|---|---|
| **L-1** | スマホロック 5 分 → 復帰 | elapsedMs 誤差 ≤ 2 秒、distance 連続性維持 | `elapsedMs` / `distanceM` 記録 |
| **L-2** | スマホロック 10 分 → 復帰 | 同上、誤差 ≤ 3 秒 | 同上 |
| **L-3** | スマホロック 30 分 → 復帰 | 同上、誤差 ≤ 5 秒、クラッシュなし | 同上 |
| **L-4** | アプリバックグラウンド 5 分 → 復帰 | Wake Lock 自動再取得、GPS 再開 | console.log `wake lock reacquired` |
| **L-5** | Wake Lock 取得失敗時 | retry 3 回まで実施、最終的に失敗時は UI で通知 | console.warn `wake lock failed N times` |
| **L-6** | Service Worker offline test | 静的アセット キャッシュから配信、起動成功 | DevTools Network panel |

**Regression テストチェックリスト**（既存 v0.4.0 機能維持確認）:

| 項目 | シナリオ | 期待動作 |
|---|---|---|
| **R-1** | アプリ起動 | bridge 接続成功、HUD 初期化 |
| **R-2** | GPS / mock 切替 | 両モードで距離計測 OK |
| **R-3** | start / pause / resume | 状態遷移正常 |
| **R-4** | 1km ラップ完了 | LAP 通知 6 秒、history 追加 |
| **R-5** | auto pause（停止検知） | 静止 N 秒後に自動 pause |
| **R-6** | mode toggle (run/walk) | R1 ボタンで切替 |
| **R-7** | G2 ハードボタン全種 | tap / double tap / long press 動作 |
| **R-8** | SYSTEM_EXIT_EVENT | cleanup 実行、history 永続化 |
| **R-9** | history empty clear | localStorage クリア後の表示正常 |
| **R-10** | ページ間切替（Page 1/2/3） | 各ページ正常表示 |

**完了条件**:
- 上記 L-1〜L-6 / R-1〜R-10 すべて旦那様の手動確認で PASS
- Hub Portal の「offline check」項目をクリア
- 旦那様 QA セッション 60〜90 分を確保（後述 v0.5 リリース手順参照）

---

### v0.5-2. RendererPort 抽象（text/image 切替）[推奨 / グラスUI]

**目的**: v0.6 で image renderer を experimental として並走可能にする抽象化。
Codex 抜け漏れチェック指摘により、image renderer に必要な capabilities / renderPolicy / fallbackKind を含む拡張版に。

**実装内容**:
1. **新規 `src/even/renderer-port.ts`**（約 120 行）
   ```ts
   export type RendererKind = 'text' | 'image'

   export interface RendererCapabilities {
     /** 1秒あたりの最大更新回数。0=制限なし */
     maxUpdatesPerSec: number
     /** 部分更新サポート（true: container 単位、false: 全画面） */
     supportsPartialUpdate: boolean
     /** PNG ベース描画か */
     usesImageContainer: boolean
     /** 連続更新がドリフト/欠落する閾値 (ms) */
     updateThrottleMs: number
   }

   export interface RenderPolicy {
     /** lap 完了時のみ更新 / 1Hz / 状態変化のみ / 200ms */
     mode: 'lap-only' | '1hz' | 'on-change' | '200ms'
     /** asset / font の管理担当 */
     assetSource: 'inline' | 'bundled' | 'runtime-encoded'
   }

   export interface RendererPort {
     readonly kind: RendererKind
     readonly capabilities: RendererCapabilities
     readonly policy: RenderPolicy
     /** image renderer が失敗時に text fallback できるか */
     readonly fallbackKind: RendererKind | null

     init(bridge: EvenAppBridge, initialState: RunState): Promise<void>
     render(state: RunState, now: Date): Promise<void>
     shutdown(): Promise<void>
   }
   ```
2. **既存 `src/even/bridge.ts` + `src/even/render.ts` を `text-renderer.ts` にリパッケージ**（差分 +50 行 / -0 行）
   - capabilities: `{ maxUpdatesPerSec: 1, supportsPartialUpdate: true, usesImageContainer: false, updateThrottleMs: 50 }`
   - policy: `{ mode: 'on-change', assetSource: 'inline' }`
   - fallbackKind: `null`（text 自体が fallback）
3. **`src/main.ts` の bridge 取得後を Port 経由に**（変更 ~50 行）
   - URL クエリ `?renderer=image` で image renderer 切替可能（v0.6 で実装）
   - v0.5 範囲では `?renderer=image` 指定時に「image renderer not implemented yet」と一時 status 表示 → text fallback で起動継続
4. v0.5 範囲では **text-renderer のみ完成**。image-renderer は v0.6 で別タスク
5. テスト: 既存 v0.4.0 と完全に同じ動作（regression なし）

**完了条件**:
- 既存全機能が text-renderer 経由で v0.4.0 同等動作
- `?renderer=image` で fallback が機能し、エラー status が表示されつつ text で起動
- `tsc --noEmit` で型安全
- main.ts の行数 ≤ 760（現状 701）

**S1/S2 spike 結果による微調整**:
- S1 GO / S2 採用パターン確定 → image renderer の policy.mode が確定（lap-only / on-change / 1hz いずれか）
- S1 NO-GO → RendererPort は維持（text-renderer の抽象化価値は単独でも有意）、image renderer は永久に未実装

---

### v0.5-3. Settings UI 新設 [推奨 / スマホUI]

**目的**: 単位 / 目標ペース / GPS 精度 / mode 切替を companion UI に集約。

**現状**:
- 単位はメートル法固定
- 目標ペース UI なし
- GPS 精度設定なし
- mode（run/walk）は実機 R1 ボタンで切替

**実装内容**:
1. **新規 `src/settings/` モジュール**（合計 ~200 行）
   - `src/settings/schema.ts`: Settings 型 + デフォルト値
   - `src/settings/persistence.ts`: localStorage / SDK localStorage 両対応
   - `src/settings/applier.ts`: state.ts に反映するルール
2. **companion UI に Settings パネル追加**（既存 `index.html` + ~150 行）
   - 折り畳み式（デフォルト閉、ヘッダクリックで展開）
   - 項目:
     - 単位: メートル法 / ヤード法
     - 目標ペース: 4'00〜10'00 / km（無効可）
     - GPS 精度: `enableHighAccuracy: true/false`
     - 表示モード初期値: run / walk
3. v0.7 で React 化される予定なので、v0.5 では **plain HTML + 最小 JS** で実装
4. Settings 変更は即時反映、リロード不要

**完了条件**:
- 単位切替で表示単位が更新される
- 目標ペース設定が render.ts に伝播（v0.6 で Target pace 差分表示）
- localStorage 永続化（リロード後も保持）

---

### v0.5-4. GPX export（schema v2 + trkpt 保存込み）[推奨 / スマホUI]

**目的**: Strava 連携前の手動投稿経路。走行履歴を GPX 形式でダウンロード。
Codex 抜け漏れチェック指摘により、現行 `RunHistoryEntry` には trackpoint が無いため、**schema v2 + 走行中 trackpoint 保存**を本タスクに含める（旦那様承認済）。

**作業を 3 段階に分割**:

#### v0.5-4a. RunHistoryEntry schema v2（trackpoint 追加）
1. **`src/storage/types.ts` を schema v2 化**（+30 行）
   ```ts
   export interface TrackPoint {
     t: number  // epoch ms
     lat: number
     lon: number
     ele?: number  // GPS altitude
     pace?: number  // sec/km
   }

   export interface RunHistoryEntry {
     // existing v1 fields ...
     schemaVersion: 2  // 新規必須
     trackpoints?: TrackPoint[]  // 新規（v0.4.0 までの古いデータは undefined）
   }
   ```
2. **`src/storage/run-history.ts` の migration ロジック追加**（+30 行）
   - `loadHistory()` で `schemaVersion` 未指定なら 1 として読み込み、`trackpoints: undefined` で受け入れ
   - 保存時は必ず schemaVersion: 2 で記録

#### v0.5-4b. 走行中 trackpoint サンプリング
1. **`src/run/state.ts` に trackpoints buffer 追加**（+40 行）
   - 5 秒に 1 回 GPS 位置を `state.trackpoints` (ReadonlyArray<TrackPoint>) に push
   - max 容量: 10,000 ポイント（5 秒 × 10,000 = 13.8 時間ぶん）
   - クラッシュ復元: pause / resume 跨ぎで保持
2. **`src/run/geolocation.ts` から `onPosition` callback で trackpoint 追加**（+15 行）
3. **state finalize 時に history へ書き込み**: `summary.ts` で `entry.trackpoints = state.trackpoints` 設定

#### v0.5-4c. GPX export 本体
1. **新規 `src/export/gpx.ts`**（約 120 行）
   - `RunHistoryEntry` → GPX 1.1 XML 変換
   - メタデータ: name, time, type=running
   - trkpt: lat/lon/ele/time（v0.4.0 旧データは時系列なし、距離 + ペース要約のみ）
2. **companion UI に「GPX で書き出し」ボタン追加**（既存 `index.html` + 30 行）
   - 履歴 1 件選択 → blob 生成 → ダウンロード
   - 全件まとめて zip にする機能は v0.7 以降

**完了条件**:
- v0.4.0 旧データ（trackpoint なし）も「サマリのみ GPX」として書き出せる
- v0.5 以降の新規走行は trackpoint 込み GPX
- 生成 GPX を Strava にアップロードして地図表示 OK
- 生成 GPX を `xmlstarlet val` でスキーマ検証 OK
- localStorage の容量制限（5MB / origin）に注意 → IndexedDB 移行 (v0.7) で本格解決

**プライバシー考慮**:
- trackpoint は localStorage に保存され、デバイス内のみ。クラウド送信は v0.9 Strava 連携時に明示同意で初めて発生
- v0.5 リリース時の Hub Portal Description に「走行中の GPS 位置を端末内に記録、外部送信は手動 GPX エクスポートのみ」と明記

---

### v0.5-5. HR zone UI 削除 [阻害 / グラスUI]

**目的**: SDK に HR API がない以上、内蔵 HR 表示は嘘 UI なので物理削除。
Codex 抜け漏れチェック指摘により、**`heartRateBpm` は削除に統一**（曖昧表現解消）、`externalHr` を予約フィールドとして v0.9 復活に備える。

**削除箇所**:
1. `src/even/render.ts`:89-92 の `heartRateText()` 関数削除
2. `src/even/render.ts`:194 の `map.set(CONTAINER_IDS.textHr, ...)` 削除
3. `src/even/bridge.ts`:46 の `textHr: 15` を削除（container 1 個減らす）
4. `src/even/bridge.ts`:88 の `{ id: CONTAINER_IDS.textHr, ... }` slot 定義削除
5. `src/run/state.ts` の `heartRateBpm` フィールドを **完全削除**（`null` 設定箇所も全て削除）
6. `src/main.ts`:216 等の `elMetricHr.textContent = ...` を companion 側でも削除
7. companion `index.html` の `<div id="metricHr">` 削除

**v0.9 BLE 復活時の伏線（予約のみ、本実装は v0.9）**:
- `RunState` 型に **`externalHr` フィールドを新規定義**:
  ```ts
  // reserved for v0.9 BLE HR sensor integration
  readonly externalHr?: {
    bpm: number
    source: 'ble'
    sensor: string  // device name
    receivedAt: number  // epoch ms
  } | null
  ```
- v0.5 では `externalHr` を一切 set しない（型予約のみ）
- container ID `15` は予約番号として確保し、コメントで「v0.9 BLE HR 表示で復活予定」と明記

**完了条件**:
- グラス HUD から HR 表示が完全消滅
- companion UI から HR 表示が完全消滅
- 削除後の text container 数が 7 個（events + time + dist + clock + msg + pace + status）に
- `RunState` から `heartRateBpm` が grep でヒットしない（完全削除）
- `RunState.externalHr` 型が定義済み、ただし参照箇所はゼロ
- regression なし（既存機能維持）

---

### v0.5-6. text-clean サニタイズ採用 [推奨 / グラスUI]

**目的**: emoji / 未サポート Unicode が bridge を通る前に除去し、SDK エラーを予防。

**実装内容**（S3 結果次第で 2 通り）:

**A. toolkit 採用パターン（S3 GO 確定済・safe wrapper 経由）**
1. `pnpm add even-toolkit`（package.json 1 行追加。`upng-js` は不要、`png-utils` 採用時のみ別途追加）
2. **safe wrapper 経由で適用**:
   - `src/even/text-clean-safe.ts`（P0-1 で作成済）から `cleanForG2Safe` を import
   - even-toolkit の `cleanForG2` は `▶◀●○` / 前後空白を破壊するため直接使用禁止（learning P1 に追加予定）
   - safe wrapper は emoji と VS16/ZWJ のみ除去し、HUD 記号と空白を保護
3. `src/even/bridge.ts` で `import { cleanForG2Safe } from './text-clean-safe'`
4. `render()` 内で全 text container の content を `cleanForG2Safe(content)` に通す（~10 行追加）

**B. 自前実装パターン（参考・既に P0-1 で自前実装済）**
P0-1 で `src/even/text-clean-safe.ts` を作成済のため B パターン単独採用は不要。
将来 even-toolkit の `cleanForG2` 仕様変更で safe wrapper の保護機能が壊れたら本ファイル単体運用に戻る。

**完了条件**:
- emoji 入りメッセージを送っても SDK エラーなし
- 既存 ASCII / CJK / `▶◀●○` / 全角スペース は変化なし
- `cleanForG2Safe('RUN ▶')` === `'RUN ▶'`, `cleanForG2Safe('Hello 🌍')` === `'Hello '`

---

## 実装順序

### Week 1（spike 直後）

| Day | タスク | 担当 |
|---|---|---|
| 1-2 | v0.5-2 RendererPort 抽象実装 | dev-engineer 発注 |
| 3 | v0.5-5 HR zone 削除（軽量、並列可） | dev-engineer 発注 |
| 4-5 | v0.5-1 Locked-phone QA 強化 | dev-engineer 発注 |

### Week 2

| Day | タスク | 担当 |
|---|---|---|
| 1-2 | v0.5-3 Settings UI 新設 | dev-engineer 発注 |
| 3 | v0.5-4 GPX export | dev-engineer 発注 |
| 4 | v0.5-6 text-clean 採用 | dev-engineer 発注 |
| 5 | 統合テスト + Codex レビュー + v0.5.0 リリース準備 | 秘書 |

### 並列発注の組み合わせ

- **Day 1-2**: RendererPort + HR 削除 を 1 名に集約発注（後者は前者のリファクタの一部）
- **Day 4-5**: Locked-phone QA は単独で並列負荷高
- Week 2 はシーケンシャル（settings → GPX → text-clean）

---

## v0.5.0 リリース手順

1. version bump 3 ヶ所:
   - `app.json` の `version: "0.5.0"`
   - `package.json` の `version: "0.5.0"`
   - `package.json` の `scripts.pack:ehpk` の出力ファイル名 → `g2-run-hud-0.5.0.ehpk`
2. **Hub Portal Description 更新** (learning P1)
   - HR 表示を完全削除した旨を明記（「v0.9 で BLE 外部センサー対応予定」と将来予告）
   - Settings UI 機能追加
   - GPX export 機能追加（trkpt 込み）
   - locked-phone 挙動改善
   - 走行中の GPS 位置を端末内に記録、外部送信は手動 GPX エクスポートのみ（プライバシー）
3. **旦那様 QA セッション 60〜90 分を実施**:
   - Locked-phone QA L-1〜L-6 全項目チェック
   - Regression R-1〜R-10 全項目チェック
   - 結果を `docs/v0.5/qa-results.md` に記録
4. ehpk pack & Hub Portal 提出
5. spike 用 4 アプリ（com.spwebcreat.g2runhud.spike.s1/s2/s4）を Hub Portal から削除

---

## v0.5 完了後の状態

- 既存 v0.4.0 機能は完全維持（regression 0）
- RendererPort 抽象化により v0.6 image renderer 受け入れ準備完了
- HR 嘘 UI 撤去完了
- Settings / GPX で companion UI が拡張済（v0.7 React 化で再利用）
- Hub Portal QA リスク（locked-phone）解消
- text-clean サニタイズで SDK エラー予防

**コード規模**: 約 3,158 行 → 約 3,500 行（純増 350 行、削除 100 行、追加 450 行）

---

## v0.5 → v0.6 への引き継ぎ事項

- RendererPort 抽象は完成、image-renderer.ts を v0.6 で追加するだけで切替可能
- v0.5-spike S1〜S4 結果が v0.6 の採用範囲を決定
- HR 削除済みなので v0.6 image HUD の中央領域が空く → main 指標巨大表示の好機

---

## 参照ファイル

- `docs/v0.5/decision-log.md` (SSOT)
- `docs/v0.5/spike-plan.md` (前段)
- `docs/v0.5/watch-list.md` (NO-GO 保留)
- `docs/HANDOFF.md` (Hub アップロード手順)
- `docs/v0.5/roadmap-review.html` (判断レビュー画面)
