# Claude Code Implementation Brief

> Phase 2 実装を進める Claude Code 向け確認資料。`docs/ROADMAP.md` の実装可否判断を補正し、実装前に確認すべき論点を整理する。

## 目的

`docs/ROADMAP.md` は Phase 2 の方向性として概ね妥当。ただし、いくつか断定が強い箇所と、既存実装とのズレがある。実装前にこの資料を読んで、ROADMAP をそのまま鵜呑みにせず、下記の前提で進めること。

## 結論サマリー

| 要望 | 現時点の判断 | 実装方針 |
|---|---|---|
| GPS をポケットで継続 | 「画面ロック / Even Hub バックグラウンド中も継続」はプラグイン単体では信頼できる手段なし。ただし「Even Hub を前面維持」なら改善余地あり | Phase 2 では background GPS を前提にしない。前面維持・復帰時再開の堅牢化だけ扱う |
| Apple Watch → G2 | Even Hub SDK に HealthKit / WatchConnectivity / 心拍 API がないため不可 | Phase 3 は保留のまま |
| G2 → Apple ヘルスケア | HealthKit 書き込み bridge がないため不可 | Phase 3 または別ネイティブプロジェクトまで保留 |
| LAP / 履歴 / RUN-WALK / R1 | SDK 制約内で実装可能 | Phase 2 の主対象 |

## 重要な補正

### 1. GPS の「不可能」は範囲を限定する

ROADMAP では「GPS をポケットで継続 = SDK 提供不能」としている。これは概ね正しいが、表現は以下に分ける。

- 不可に近い: 画面ロック、Even Hub がバックグラウンド、iOS WebView が凍結された状態で GPS を継続取得すること
- 可能性あり: Even Hub を前面に維持したまま、ポケット内の誤操作や画面遷移を減らすこと
- 実装済み: Screen Wake Lock、`visibilitychange` 復帰時の `watchPosition` restart、Date 差分による elapsed 補正

参照:
- `src/main.ts`: Wake Lock と visibility 復帰処理
- `src/run/geolocation.ts`: `navigator.geolocation.watchPosition` wrapper
- `app.json`: `location` permission はあるが `background-location` のような権限はない

実装時は「バックグラウンド GPS を実現する」と書かず、「復帰耐性を上げる」「前面維持時の運用安定性を上げる」と表現する。

### 2. 公式 background-state skill の扱いに注意

公式 Skill Catalog には `background-state` があり、headless WebView migration / state snapshot について説明している。一方で、ローカルの `@evenrealities/even_hub_sdk@0.0.10` は `setBackgroundState` / `onBackgroundRestore` を export していない。

確認済み:

```bash
node -e "import('@evenrealities/even_hub_sdk').then(m => console.log(Object.keys(m).sort().join('\n')))"
```

上記 export 一覧に `setBackgroundState` / `onBackgroundRestore` は無い。

したがって、現時点では background-state を実装前提にしない。もし Claude Code 側でこの API を使う提案が出た場合は、まず型定義と実機 SDK version を確認すること。

### 3. LAP は完全新規ではない

ROADMAP の Phase 2a は「LAP 記録機能」と書かれているが、既に以下が存在する。

- `src/run/lap.ts`: 1km ごとの `detectLap`
- `src/run/state.ts`: `laps`, `currentLapKm`, `fireLap`
- `src/main.ts`: companion UI 上の簡易 lap 表示

Phase 2a の実態は「LAP 新規実装」ではなく、以下の拡張。

- G2 側 Page 2 / Page 3 表示
- LAP サマリ算出
- 履歴保存用のスキーマ整備
- companion UI の詳細表示改善

### 4. 履歴保存は SDK storage を優先する

ROADMAP では `localStorage` と書かれているが、Even Hub SDK には `bridge.setLocalStorage` / `bridge.getLocalStorage` がある。Hub 実機環境では SDK storage を優先し、スタンドアロン / dev 環境では browser `localStorage` fallback にする方がよい。

推奨レイヤ:

- `src/storage/runHistory.ts` を追加
- `loadRunHistory(storagePort)` / `saveRunHistory(storagePort, history)` のように storage port を注入可能にする
- Hub 接続後は SDK storage adapter
- Hub 未接続時は browser localStorage adapter
- JSON parse 失敗時は空配列に戻し、破損データを握りつぶさず console warning を出す

### 5. R1 リング由来判別は実機確認が必要

SDK 型定義では `EventSourceType.TOUCH_EVENT_FROM_RING` は `Sys_ItemEvent.eventSource` にある。一方、現在の実装は `textEvent` の scroll を MVP では無視している。

注意点:

- `textEvent` には型上 `eventSource` が無い
- `sysEvent` には `eventSource` がある
- 実機で R1 scroll が `textEvent` として来るのか、`sysEvent` として来るのか確認が必要

実装時は、まずイベントログを出せるデバッグ導線を入れると安全。

例:

```ts
console.debug('[g2-run-hud] event', JSON.stringify(event))
```

本番では noisy にならないよう、dev flag か一時実装に留める。

## Phase 2 実装チェックリスト

### 先に確認すること

- `pnpm build` が現状で通るか
- `@evenrealities/even_hub_sdk` の export / `.d.ts` に追加 API がないか
- R1 リングイベントの payload shape
- G2 container 制約: `containerTotalNum` 1-12、`textObject` max 8、`listObject` 利用時の total 数

### 実装順の推奨

1. `RunState` の mode / page state / summary selector を追加
2. `src/storage/runHistory.ts` を追加し、保存スキーマを固める
3. reset / run 終了相当のタイミングで履歴保存する。ただし running 中 reset は現在ガードされているので、保存トリガー設計を明確にする
4. G2 Page 1 / Page 2 / Page 3 の render を分ける
5. R1 / scroll 入力を page cycling と READY 中 mode toggle に割り当てる
6. companion UI に履歴・LAP 詳細・モード選択を追加
7. docs/HANDOFF.md と ROADMAP の記述を同期する

### テスト観点

- idle → start → gps-waiting → running
- running → pause → resume
- running 中 reset が効かないこと
- paused / idle で reset できること
- 1km / 2km 到達時に lap が重複記録されないこと
- 履歴保存が 100 件上限で古いものを落とすこと
- JSON 破損時に UI が壊れないこと
- SDK storage 不在時に browser localStorage fallback が効くこと
- R1 scroll と glasses tap が役割衝突しないこと

## ROADMAP に反映するなら

以下のように書き換えると正確。

- 「GPS をポケットで継続: SDK 提供不能」
  - 「画面ロック / background 中の GPS 継続は SDK 提供不能。前面維持時の誤操作対策と復帰耐性改善は継続検討」
- 「background-state skill は state snapshot のための物」
  - 「background-state は状態復元の可能性を示すが、現在の SDK export には該当 API がなく、GPS 継続 APIではない」
- 「LAP 記録機能」
  - 「LAP 表示・永続化・サマリ拡張」

## 参照リンク

- Even Hub Device APIs: https://hub.evenrealities.com/docs/guides/device-apis
- Even Hub Packaging permissions: https://hub.evenrealities.com/docs/reference/packaging
- Even Hub Skill Catalog: https://hub.evenrealities.com/docs/AI-tooling/claude%20code/skill-catalog
- background-state skill source: https://raw.githubusercontent.com/even-realities/everything-evenhub/main/skills/background-state/SKILL.md
