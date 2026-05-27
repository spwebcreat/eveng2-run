# G2 Run HUD v0.5+ 判断ログ

旦那様による `docs/v0.5/roadmap-review.html` レビュー判断（2026-05-27）の正式記録。
以降の実装計画はすべてこのログを SSOT として参照する。

---

## サマリ

| 区分 | 件数 | 内容 |
|---|---|---|
| ✅ 採用（ユニーク機能） | **30 件** | v0.5-spike 4 + v0.5 6 + v0.6 5 + v0.7 4 + v0.8 3 + v0.9 4 + v1.0 4 |
| ✅ 採用（重要判断メタ） | 4 件 | exec.spike / exec.image-partial / exec.react-defer / exec.hr-remove |
| ❌ 却下 | 2 件 | シューズ管理 + 距離追跡 (v0.8) / 不採用リストの承認メタ (= 保留化扱い) |

レビュー結果が示すスコープは「**Codex 批判レビュー後の現実案を、ほぼ全面採用してフルパスで v1.0 まで走る**」方針。

> **訂正**: 初版で「採用 27 件」と記載したが、Codex 抜け漏れチェックで誤りと判明。
> 正しくは **ユニーク機能 30 件 + 重要判断メタ 4 件 = 採用 34 件**（exec.\* は同名機能を指す上位メタなので、機能ベース表記では 30 件で固定）。

---

## 1. 確定する v0.5+ フェーズスコープ

### v0.5-spike（1 週）
4 項目すべて採用：

1. 2×2 タイルで 576×288 image を実機表示
2. image update p95 latency 計測（1Hz / 状態変化 / 200ms の 3 パターン × 30 分連続）
3. even-toolkit + upng-js ビルド検証（部分 import / tree-shaking / SDK 0.0.10 互換）
4. G2 マイク PCM stream ペアリング（toolkit/stt と接続できるか）

### v0.5（2 週）
6 項目すべて採用：

- Locked-phone QA 強化（Wake Lock + Service Worker + Page Visibility）
- RendererPort 抽象（text/image 切替可能化）
- Settings UI 新設
- GPX export
- HR zone UI 削除（render.ts / bridge.ts から物理削除）
- text-clean サニタイズ採用

### v0.6（3 週）
5 項目すべて採用：

- Splash グラフィカル化
- ペース sparkline（ラップ完了時更新）
- ミニマップ（5 秒更新）
- 公式 191 アイコン採用
- ラップサマリのグラフ化

### v0.7（1 ヶ月）
4 項目すべて採用：

- React + Vite + even-toolkit/web 導入（スマホ UI のみ）
- Calendar / LineChart / Timeline / StatGrid
- IndexedDB 移行
- glass-screen-router 多画面化

### v0.8（1 ヶ月）
3 項目採用、**1 項目却下**：

- ✅ スマホでプラン作成（ScrollPicker）
- ✅ グラスでプラン実行（timer-display）
- ✅ Target pace 差分大表示
- ❌ **シューズ管理 + 距離追跡 ─ 却下**

### v0.9（1 ヶ月）
4 項目すべて採用：

- Web Bluetooth で外部 HR センサー
- Strava OAuth + export（バックエンド proxy）
- G2 マイク音声コマンド（"pause" / "lap" / "next"）
- 走行後音声メモ

### v1.0（1 ヶ月）
4 項目すべて採用：

- Claude API バックエンド proxy で走行後 summary
- スマホスピーカー音声通知
- オンボーディングフロー
- Hub Portal submission cleanup

---

## 2. 重要な解釈：不採用リスト承認の「却下」

旦那様メモ：**「公式対応状況を見てまた別の機会に」**

### 当初の私の提案
以下を「完全 NO-GO」として roadmap-v0.5.html / docs に確定記録する：
- G2 スピーカー TTS
- Spotify / Apple Music 制御
- ターンバイターン・ナビ
- 通知転送（SMS / LINE）
- ソーシャル機能
- 内蔵 HR センサー（→ BLE 外部で代替）

### 旦那様の判断と意図
**「NO-GO として確定すること」自体を却下** ＝ **完全に諦めず、SDK / Hub の対応状況を見て将来再検討する余地を残す**。

### 計画上の取り扱い変更

| 機能 | 当初 v0.5+ ロードマップ上の位置づけ | 変更後 |
|---|---|---|
| G2 スピーカー TTS | NO-GO 確定 | 🟡 **保留**。SDK に audio output API が追加されたら再評価 |
| Spotify / Apple Music | NO-GO 確定 | 🟡 **保留**。Even Hub plugin から音楽制御 API が公開されたら再評価 |
| ターンバイターン・ナビ | NO-GO 確定 | 🟡 **保留**。地図 SDK / map tile 配信が出れば実装検討 |
| 通知転送 | NO-GO 確定 | 🟡 **保留**。SDK にスマホ通知 API が追加されたら再評価 |
| ソーシャル機能 | NO-GO 確定 | 🟡 **保留**。バックエンド運用コスト問題が解決したら再検討（v2 以降） |
| 内蔵 HR センサー | NO-GO 確定（BLE で代替） | ➡️ **既に v0.9 で外部 BLE 採用済**。本体内蔵が仮に出ても上書きせず BLE 維持 |

### 保留扱いの運用ルール
- v0.5〜v1.0 の実装計画には **含めない**（着手しない）
- 「諦めた機能」ではなく「**観察リスト**」として別管理
- Even Hub SDK のリリースノートを節目ごとに確認し、対応 API が追加されたら本ログを更新
- v1.0 リリース後の v2 計画フェーズで本リストを再評価

→ 観察リスト管理ファイル: **`docs/v0.5/watch-list.md`**（次タスクで作成）

---

## 3. 却下確定（v0.8 シューズ管理）

理由メモは無し。優先度判断と推定。

- v0.8 では interval workout / Target pace 差分の 3 項目に集中
- シューズ管理は v1.0 以降にも復活させない（再議論したい場合は旦那様から明示）

---

## 4. 重要判断（exec.*）の処理

`exec.spike` / `exec.image-partial` / `exec.react-defer` / `exec.hr-remove` の 4 件はすべて採用。これらは下層の個別判断と整合：

- exec.spike ⟷ v0.5-spike 4 項目すべて採用 = 一貫
- exec.image-partial ⟷ v0.6 image 部分採用 5 項目すべて採用 = 一貫
- exec.react-defer ⟷ v0.7 で React 導入 = 一貫
- exec.hr-remove ⟷ v0.5 で HR zone UI 削除 = 一貫

`exec.nogo-approval` のみ却下 → 上記 Section 2 の通り保留化処理。

---

## 5. 直近 1 週間のアクション

1. **本ログを SSOT として確定**
2. **`docs/v0.5/watch-list.md` を新設**（NO-GO 保留リストを別管理）
3. **`docs/v0.5/spike-plan.md` を Plan agent で詳細化**（最初の 1 週分の具体手順）
4. **`docs/v0.5/implementation-plan.md` を作成**（v0.5 本実装 2 週分のスコープ確定）
5. **CLAUDE.md / REFERENCES.md に本ログへのリンクを追記**
6. **learning P1 に「Codex 批判レビュー → SDK 実物検証 → 判断 UI 化 → 確定」の流れを記録**

---

## 6. ステークホルダー間の整合性

- `docs/v0.5/roadmap-review.html` 上の選択状態は本ログの SSOT 化により確定済（旦那様の localStorage 内に残る）
- HTML 側の表示も SSOT と同期させる（nogo-approval は「保留扱い」表示、完全不採用リスト → 観察リスト表記、シューズ管理は却下確定表示）
- `docs/archive/v0.4.0-roadmap.html`（v0.3.x〜v0.4.0 履歴）は引き続き保存
- `docs/v0.5/roadmap-brief.md` は Codex 相談用の brief として保持（仕様の素となる）
- 以降の dev-engineer 発注や Codex レビューは本ログを参照させる

---

## 7. v0.6 以降の運用ルール

Codex 抜け漏れチェックで「v0.5 だけ詳細化されている / v0.6 以降は bullet レベル」と指摘あり。
全 phase を今すぐ詳細化すると変動性に追随できないため、以下の運用に統一する：

- **各 phase 着手前に mini decision-log + mini implementation-plan を新規作成**
- ファイル命名: `docs/v0.6-decision-log.md` / `docs/v0.6-implementation-plan.md` 等
- 前 phase の振り返り（実機 QA / Codex レビュー / 旦那様判断）を必ず含める
- 本 v0.5 ログの「現実案 30 機能」は変動するが、phase 開始時の最新版 SDK / toolkit 状況に合わせて再評価
- 観察リスト (`docs/v0.5/watch-list.md`) は phase 開始時に必ず読み返して、復活機能の有無を確認

---

レビュー日: **2026-05-27**
判断者: 旦那様（sp.webcreatpro@gmail.com）
記録者: Claude Code（Opus 4.7 1M）

---

## 改訂履歴

| 日付 | 改訂内容 |
|---|---|
| 2026-05-27 | 初版作成 |
| 2026-05-27 | Codex 抜け漏れチェック結果反映: 採用数訂正 (27 → 30 機能 + 4 メタ)、Section 7 運用ルール追加、HTML 同期方針追記 |
