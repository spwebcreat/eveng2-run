# G2 Run HUD ロードマップ

> AI / 開発者向けの構造化ドキュメント。人間向けは `docs/ROADMAP.html` を参照。

- **対象**: Even Realities G2 / Even Hub Plugin
- **現在地**: v0.3.0 Phase 2 コード完成（2026-05-26）・実機テスト待ち
- **次フェーズ**: 実機テスト → R1 リング payload 確認 → デバッグログ整理
- **最終更新**: 2026-05-26

---

## Phase 進捗サマリー

| Phase | スコープ | 状態 | 完了/予定 |
|---|---|---|---|
| Phase 1 | MVP（距離・ペース・時間・自動 pause・GPS 復帰・3x3 レイアウト + メッセージ中央寄せ）| ✅ 完了 | v0.2.6 / 2026-05-24 |
| Phase 2 | **LAP 拡張 + 履歴永続化 + RUN/WALK モード + R1 リングページ送り** | ✅ コード完成（実機テスト待ち）| v0.3.0 / 2026-05-26 |
| Phase 3 | 心拍数連携（Apple Watch / HealthKit） | ⏸ 保留 | SDK 制約により凍結 |
| Phase 4 | AI 動的メッセージ（Claude API） | ⏸ 保留 | Phase 3 依存のため凍結 |

---

## 実走テスト結果（2026-05-26）

初回実走（屋外ランニング 3.5 km）でユーザビリティと精度を検証。

### 計測精度（Apple Watch 比較）

| 項目 | Apple Watch | G2 Run HUD | 誤差 |
|---|---|---|---|
| 距離 | 3.38 km | 3.50 km | +3.5 % |
| 平均ペース | 7'37"/km | 7'19"/km | -18 秒/km |
| 経過時間 | 25:45 | 25:34 | ほぼ一致 |

→ MVP 精度として実用ライン到達。

### 発覚した課題

1. **GPS 切断問題（致命的）**: スマホをポケットに入れて走ると、振動で画面が切り替わり Even Hub アプリがバックグラウンドに回って GPS が止まる。**手にずっと持って走らないと使えない**
2. ユーザー要望:
   - GPS をポケット運用でも切らない方法
   - Apple Watch の数値を G2 に反映する方法
   - G2 計測データを Apple ヘルスケアに連動する方法

---

## SDK 制約の確定（2026-05-26 調査）

公式ドキュメント・SDK の `.d.ts` 棚卸し・公式 Skill カタログ調査の結果、**Even Hub プラグイン枠ではユーザー要望 3 件すべて実現不可能**と確定。

### Even Hub SDK 0.0.10 が公開しているデバイス API（最新版）

| API | 内容 |
|---|---|
| `audioControl(isOpen)` | マイク PCM 16kHz / 16-bit / mono 取得 |
| `imuControl(isOpen, pace)` | **G2 グラス本体の IMU**（加速度/角速度）取得 |
| `getDeviceInfo()` / `onDeviceStatusChanged` | G2 のバッテリ・装着状態・充電状況 |
| `getUserInfo()` | Even Hub ログインユーザー情報 |
| `setLocalStorage` / `getLocalStorage` | プラグインスコープ KV ストア |

入力イベント源（`EventSourceType`）:
- `TOUCH_EVENT_FROM_GLASSES_R` (1): 右グラスタッチパッド
- `TOUCH_EVENT_FROM_RING` (2): **R1 リング**
- `TOUCH_EVENT_FROM_GLASSES_L` (3): 左グラスタッチパッド

入力イベント種別（`OsEventTypeList`）:
- `CLICK_EVENT` (0): Tap
- `SCROLL_TOP_EVENT` (1): スクロール上
- `SCROLL_BOTTOM_EVENT` (2): スクロール下
- `DOUBLE_CLICK_EVENT` (3): ダブルタップ

### SDK が**提供していない**もの（公式明文）

公式 `docs/guides/device-apis` に明記：
> "No direct Bluetooth access, no arbitrary pixel drawing, no audio output, ... no camera, and images are greyscale only."

加えて SDK `d.ts` 全行 grep で確認:
- ❌ GPS / Geolocation API 無し（Web 標準の `navigator.geolocation` 経由のみ）
- ❌ HealthKit bridge 無し
- ❌ Apple Watch / WatchConnectivity bridge 無し
- ❌ Background execution API 無し
  - 公式 Skill Catalog には `/background-state` が記載されるが、**現 SDK 0.0.10 の export には `setBackgroundState` / `onBackgroundRestore` 等の該当 API は存在しない**（`d.ts` 全行 grep および npm registry 最新版で確認）
  - 仮に将来 export されても state snapshot 用であって、JS 実行継続（=GPS watcher 継続）の API ではない
- ❌ 心拍 / 歩数 / ペドメータ API 無し

### 結論

| 要望 | 結論 |
|---|---|
| **画面ロック・Even Hub バックグラウンド中の GPS 継続** | SDK 提供不能・プラグイン枠で不可能 |
| **Even Hub 前面維持時の GPS 復帰耐性向上** | 改善余地あり（Wake Lock / visibilitychange 復帰時の watchPosition restart は既存実装あり） |
| Apple Watch → G2 | 不可能 |
| G2 → HealthKit | 不可能 |

**Even Realities への feature request は旦那様の意思で見送り**（対応を待ちつつ、現状制約下の機能充実を優先）。

---

## Phase 2: LAP + 履歴 + RUN/WALK（✅ コード完成・実機テスト待ち）

### 完了サマリ（2026-05-26 / v0.3.0）

| カテゴリ | 成果物 |
|---|---|
| 型・スキーマ | `RunState` に `mode` / `currentPage` 追加、`RunHistoryEntry` / `RunHistory` 定義、`StoragePort` interface |
| G2 表示 | Page 1 (HUD) / Page 2 (LAP リスト 3 件) / Page 3 (最速・最遅・平均サマリ) の 3 ページ構成。`screenMode === 'lap'` 時は currentPage 無視で既存ラップ通知優先 |
| 入力 | R1 リング SCROLL = ページ送り（running/paused）/ モード切替（READY）。Tap / Double Tap は既存維持。`console.debug` で payload ダンプ（実機確認用） |
| 履歴永続化 | `reset()` 時に距離>0 で自動保存。SDK storage 優先 / browser localStorage fallback。100 件上限で末尾 drop。JSON 破損は空 fallback + warn |
| Companion UI | モード選択（READY のみ有効）/ 現在の LAP（強化版）/ 過去の走行（折りたたみ）/ 履歴クリア 2 段階確認 |
| 旧「履歴クリア」ボタン | 削除（reset と意味が同じだったため） |

**実機テスト残項目**:
- 走行履歴の永続化動作確認
- R1 リング SCROLL が `sysEvent` / `textEvent` どちらに来るか（`console.debug` で確認 → 確定後デバッグログ削除）

### 目的
SDK 制約下で実現可能な機能を全部入れて、運用満足度を上げる。

### 既存実装の確認（CODEX 補正で発覚・2026-05-26）

Phase 2a は「LAP 新規実装」ではなく、**既存 LAP 機能の拡張**であることが判明。確認済みの既存実装：

| 既存実装 | 場所 |
|---|---|
| `detectLap()` 1km 検知ロジック | `src/run/lap.ts` |
| `laps: ReadonlyArray<Lap>` / `currentLapKm` / `fireLap()` | `src/run/state.ts:43-44, 364` |
| Companion UI の LAP 表示 + クリアボタン | `src/main.ts:37, 211, 249`（`renderLapsDom`） |

### スコープ

#### 2a. LAP 表示・サマリ・履歴スキーマ拡張（既存 LAP の活用）
- 既存 `detectLap()` の出力を G2 ページ表示に拡張
- LAP サマリ算出ロジック新規（最速 LAP / 最遅 LAP / 平均ペース）
- 履歴保存用のスキーマを LAP 配列込みで固める
- G2 表示にページ追加（既存 1 ページ → 3 ページ構成）:
  - **Page 1**: 現在値（距離・ペース・経過時間） ← 既存
  - **Page 2**: LAP リスト（`list_container` 使用） ← 新規
  - **Page 3**: サマリ（最速 LAP / 最遅 LAP / 平均ペース） ← 新規

#### 2b. データ永続化（SDK storage 優先 / browser fallback）
- **保存先の方針**:
  - Hub 接続時: SDK の `bridge.setLocalStorage` / `bridge.getLocalStorage` を優先
  - Hub 未接続 / dev 環境: browser `localStorage` に fallback
- **設計パターン**: storage port 注入（`StoragePort` interface + Hub adapter / Browser adapter）
- 配置: `src/storage/runHistory.ts` （新規）
- 保存項目: 日時 / モード / 距離 / 経過時間 / 平均ペース / LAP 配列
- 件数上限: 100 件（古いものから drop）
- JSON parse 失敗時: 空配列に戻し、console warning を出す（破損データ握りつぶし禁止）
- iPhone プラグイン画面に「**過去の走行**」セクション追加
- 履歴項目タップで詳細表示（各 LAP 内訳）

#### 2c. RUN/WALK モード選択
- 停止中（READY 状態）のみモード切替可能（走行中の切替は不可）
- 切替方法: R1 リングのスクロール（候補・実機確認待ち / 2d 参照）
- 差異は **ラベルと履歴の分類のみ**（最小実装）
  - HUD 表示: `RUN ▶` / `WALK ▶`
  - 履歴に `mode: "run" | "walk"` で保存

#### 2d. R1 リング入力対応（実機確認フェーズあり）
- **型定義の事実**:
  - `Sys_ItemEvent` ✅ `eventSource?: EventSourceType` フィールドあり
  - `Text_ItemEvent` ❌ `eventSource` フィールド**無し**（containerID / containerName / eventType のみ）
- **未確定事項**: 実機で R1 リングのスクロールが `sysEvent` / `textEvent` どちらに来るか不明
  - `sysEvent` に来るなら → `eventSource === TOUCH_EVENT_FROM_RING` でリング限定可能
  - `textEvent` に来るなら → 型上 `eventSource` 無しで判別不能 → 全 scroll をリングと見なすか、リング判別を諦める
- **実装手順**:
  1. **デバッグログ導線を最初に入れる**: `console.debug('[g2-run-hud] event', JSON.stringify(event))`
  2. 実機で R1 リングを回して payload shape を確認
  3. 確認結果に基づいて scroll 振り分けロジック実装
  4. 本番では noisy にならないよう dev flag 化 or 削除
- 既存 `src/even/input.ts:70` の「将来拡張用」コメントを実装に置換

### 操作系の再設計

| 状態 | グラスタッチパッド | R1 リング |
|---|---|---|
| 停止中（READY） | Tap = 開始 / Double = リセット | スクロール = モード切替（RUN ⇄ WALK） |
| 走行中（RUN/WALK） | Tap = 一時停止 / Double = リセット | スクロール = ページ送り |
| 一時停止中（PAUSED） | Tap = 再開 / Double = リセット | スクロール = ページ送り |

長押し = OS 終了（変更不可・G2 ハード固定）

### 実装影響範囲

| ファイル | 変更内容 |
|---|---|
| `src/run/state.ts` | LAP 配列管理 / RUN/WALK モード保持 / 走行終了時に履歴保存 |
| `src/storage/` （新規） | 履歴 CRUD レイヤ（localStorage ラッパー） |
| `src/even/bridge.ts` | Page 2 (list_container) / Page 3 (summary) 追加 |
| `src/even/input.ts` | SCROLL_TOP / SCROLL_BOTTOM 実装、R1 リング由来判別 |
| `index.html` + `src/main.ts` | LAP 詳細・履歴・モード選択 UI（**ui-ux-pro-max スキルで設計**） |
| `docs/HANDOFF.md` | 操作変更点 + 新機能の使い方 |

### iPhone プラグイン UI（ui-ux-pro-max で設計）

参照素材:
- `docs/EvenRealities.pen`（Penpot 形式デザインソース）
- 公式 design-guidelines（グラス側のみだが Brand トーン把握用）
- 既存 `index.html` のスタイル（黒背景 + 緑アクセント）

新規追加セクション:
- 「LAP 詳細」（現在走行）
- 「モード選択」（RUN / WALK）
- 「過去の走行履歴」（一覧 + 詳細）

### 想定工数
- 2a (LAP + ページ追加): 1 セッション
- 2b (履歴永続化): 1 セッション
- 2c (RUN/WALK): 0.5 セッション
- 2d (R1 リング): 0.5 セッション（実機確認込み）
- UI 設計（ui-ux-pro-max）: 0.5 セッション
- 実機テスト + 微調整: 0.5〜1 セッション
- **合計: 4〜5 セッション**

### 実装着手前に確認すること

- `pnpm build` が現状で通るか
- `@evenrealities/even_hub_sdk` の export / `.d.ts` に追加 API がないか
- R1 リングイベントの payload shape（sysEvent / textEvent どちらに来るか）
- G2 container 制約: `containerTotalNum` 1-12、`textObject` max 8、`listObject` 利用時の total 数

### 実装順（CODEX 推奨を採用）

1. `RunState` の **mode / page state / summary selector** を追加
2. `src/storage/runHistory.ts` を追加し、**保存スキーマを固める**（SDK adapter / Browser adapter 注入パターン）
3. **保存トリガー設計を明確にする**: reset / run 終了相当のタイミングで履歴保存。ただし running 中 reset は現在ガードされているので、どこで保存するか明示
4. **G2 Page 1 / Page 2 / Page 3** の render を分ける（`src/even/bridge.ts`）
5. **R1 / scroll 入力** を page cycling と READY 中 mode toggle に割り当てる（実機ログで sysEvent / textEvent 確認後）
6. **Companion UI** に履歴・LAP 詳細・モード選択を追加（`ui-ux-pro-max` で設計）
7. **`docs/HANDOFF.md` と ROADMAP** の記述を同期する

### テスト観点（CODEX 推奨）

- `idle` → `start` → `gps-waiting` → `running` 遷移
- `running` → `pause` → `resume` 遷移
- `running` 中 reset が効かないこと（既存ガード継続）
- `paused` / `idle` で reset できること
- 1km / 2km 到達時に LAP が重複記録されないこと
- 履歴保存が 100 件上限で古いものを落とすこと
- JSON 破損時に UI が壊れないこと
- SDK storage 不在時に browser localStorage fallback が効くこと
- R1 scroll と glasses tap が役割衝突しないこと

---

## Phase 3: 心拍数反映（⏸ 保留）

### 経緯
2026-05-26 の SDK 調査で、Even Hub プラグイン枠での実装が不可能と確定。
Even Realities への feature request も旦那様意思で見送り。

### 保留中の理由
- 必要技術: HealthKit / WatchConnectivity → SDK に bridge 無し
- ネイティブアプリ化（iOS native + watchOS）の工数（2〜4 週間）と価値の比較で当面着手しない判断
- Even Realities が SDK で対応してくれた場合は即座に再開

### 解除条件（どれかが成立したら再開検討）
1. Even Hub SDK に HealthKit / Watch 連携 API が追加される
2. 旦那様が feature request を出して対応が得られる
3. ネイティブアプリ化を専用プロジェクトとして別途立ち上げる判断をする

---

## Phase 4: AI 動的メッセージ（⏸ 保留）

### 経緯
Phase 3（心拍）依存で価値が最大化される設計のため、Phase 3 保留と連動して凍結。

### 再開条件
- Phase 3 解除、または
- 心拍データ無しでも価値が出る設計（距離・ペース・LAP のみで AI メッセージ）に組み直す判断

---

## 技術的負債 / 改善候補

| 項目 | 影響 | 優先度 |
|---|---|---|
| PositionSource interface 注入 | テスト容易性 | 中 |
| GPS フィルタ責務分離 | テスト整備時 | 低 |
| `detectLap` の pure 化 | テスト整備時 | 低（Phase 2 で着手見込み） |
| ラップ表示時間のパラメータ化 | 現在 6 秒ハードコード | 低 |
| ESLint / Prettier 設定 | コード品質 | 低 |
| ユニットテスト整備（vitest） | リファクタ安全性 | 中（Phase 2 着手前推奨） |
| GitHub Actions 自動ビルド + .ehpk 自動添付 | リリース自動化 | 中（v0.3 以降） |

---

## バージョニング方針

- **SemVer**（major.minor.patch）
- Hub Portal は同一バージョン再アップロードでキャッシュが効くため、**アップロードのたびに patch bump 必須**
- 互換性破壊変更（permission 追加 / app.json 大改造）は minor bump
- 大規模機能追加（Phase 2 / 3 / 4）完了時は minor bump

### 変更時に同期するファイル
| ファイル | フィールド |
|---|---|
| `app.json` | `version` |
| `package.json` | `version` |
| `package.json` | `scripts.pack:ehpk`（出力ファイル名）|
| `docs/HANDOFF.md` | バージョン情報セクション |

---

## リリース手順

```bash
# 1. バージョン bump（手動で 3 ファイル更新）
#    app.json + package.json (version + pack:ehpk) + docs/HANDOFF.md

# 2. ビルド + .ehpk 生成
pnpm pack:ehpk

# 3. git tag + push
git tag v0.x.y
git push origin main --tags

# 4. GitHub Releases に .ehpk 添付（将来は GitHub Actions で自動化）

# 5. Hub Portal にアップロード（手動）
#    https://hub.evenrealities.com → アプリ管理 → 新バージョン
```

---

## 参考リンク

- 仕様書: `even-g2-run-hud-handoff.md`
- 旦那様向けハンドオフ: `docs/HANDOFF.md`
- **CODEX 補正資料**: `docs/CLAUDE_IMPLEMENTATION_BRIEF.md`（実装前に必読）
- 学習メモ: `.claude/rules/learning/core.md`
- セッション履歴: `.claude/handoff/handoff-YYYY-MM-DD.md`
- Even Hub 公式: https://hub.evenrealities.com/docs/
- Even Hub Device APIs: https://hub.evenrealities.com/docs/guides/device-apis
- Even Hub Design Guidelines: https://hub.evenrealities.com/docs/guides/design-guidelines
- Even Hub Skill Catalog: https://hub.evenrealities.com/docs/AI-tooling/claude%20code/skill-catalog
- Even Hub テンプレ: https://github.com/even-realities/evenhub-templates
- Even Hub SDK: `@evenrealities/even_hub_sdk` (npm) — 現在 v0.0.10
