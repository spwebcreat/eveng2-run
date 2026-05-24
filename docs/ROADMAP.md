# G2 Run HUD ロードマップ

> AI / 開発者向けの構造化ドキュメント。人間向けは `docs/ROADMAP.html` を参照。

- **対象**: Even Realities G2 / Even Hub Plugin
- **現在地**: v0.2.6 MVP 完了（2026-05-24）
- **次フェーズ**: Phase 2 〜 Phase 4（優先順位は旦那様確定）
- **最終更新**: 2026-05-24

---

## Phase 進捗サマリー

| Phase | スコープ | 状態 | 完了/予定 |
|---|---|---|---|
| Phase 1 | MVP（距離・ペース・時間・自動 pause・GPS 復帰対策・3x3 レイアウト + メッセージ中央寄せ）| ✅ 完了 | v0.2.6 / 2026-05-24 |
| Phase 2 | データ保存（ラン履歴永続化） | 📋 計画中 | 未着手 |
| Phase 3 | 心拍数反映（Apple Watch 連携） | 📋 計画中 | 未着手（要ネイティブアプリ化） |
| Phase 4 | AI 動的メッセージ（Claude API 等） | 📋 計画中 | 未着手（Phase 3 後が効果的） |

---

## Phase 1: MVP（完了）

### スコープ
- HUD 表示（距離 / 平均ペース / 経過時間 / 現在時刻 / 心拍プレースホルダー）
- 3x3 グリッドレイアウト + メディアプレーヤー風ステータス記号
- 1km 自動ラップ + 励ましランダムメッセージ
- 自動 pause / resume（30 秒・5m 未満で pause、5m 以上で resume）
- GPS 復帰対策（visibilitychange / watchPosition 再起動 / Screen Wake Lock）
- ※ テストモードは v0.2.6 で完全削除（dev 環境では companion UI のメトリクス・ボタン応答確認のみ可能）
- スタート / 一時停止 / リセット（G2 タップ + コンパニオン UI 両対応）

### 実機計測精度（Apple Watch 比較・2026-05-24）
| 項目 | Apple Watch | G2 Run HUD | 誤差 |
|---|---|---|---|
| 時間 | 0:12:06 | 12:07 | ほぼ一致 |
| 距離 | 1.04 km | 1.06 km | +1.9% |
| 平均ペース | 11'33"/km | 11'27"/km | -6 秒 |

許容範囲内・MVP として実用レベル達成。

---

## Phase 2: データ保存（次フェーズ・最優先）

### 目的
ラン履歴を永続化し、過去のランを振り返れるようにする。

### スコープ案
- ラン 1 件あたりの保存項目: 日時 / 距離 / 経過時間 / 平均ペース / ラップ配列 / 心拍データ（Phase 3 連携時）
- コンパニオン UI に「履歴」タブ追加（一覧 + 詳細 + 削除）
- エクスポート機能（CSV / GPX / Strava 連携）→ 別タスクで段階的に追加

### 技術選定候補
| 方式 | 容量 | 永続性 | 実装難易度 | 備考 |
|---|---|---|---|---|
| **LocalStorage** | ~5MB | ブラウザ単位 | 低 | MVP 拡張に最適。シンプル |
| **IndexedDB** | ~50MB+ | ブラウザ単位 | 中 | 件数増加に強い・検索高速 |
| 外部 API | 無制限 | サーバー | 高 | アカウント認証必要 |

### 推奨方針
**Phase 2a**: LocalStorage で実装（〜100 件想定）
**Phase 2b**: IndexedDB 移行（履歴が増えたら）
**Phase 2c**: Strava / Google Sheets / Notion 連携（要望ベース）

### 実装影響範囲
- `src/run/state.ts`: ラン終了時の履歴保存ロジック追加
- `src/storage/`（新規）: 履歴 CRUD レイヤ
- `index.html` + `src/main.ts`: 履歴タブ UI 追加
- `docs/HANDOFF.md`: 使い方の追記

### 想定工数
- Phase 2a (LocalStorage): 1〜2 セッション
- Phase 2b (IndexedDB): 1 セッション
- Phase 2c (外部連携): 各 1〜3 セッション

---

## Phase 3: 心拍数反映（高難度・要ネイティブ化）

### 目的
Apple Watch から心拍数をリアルタイムで取得し、G2 に表示する。

### 課題
**現 MVP の Even Hub プラグイン（WebView ベース）単体では実現困難**。
仕様書 §18 Phase 2 に記載の通り、以下のネイティブ実装が必要：

```
Apple Watch App (watchOS)
  ↓ HealthKit / HKWorkoutSession
iPhone App (iOS native)
  ↓ WatchConnectivity
Even Hub Plugin (WebView) ← Bridge 経由で受信
  ↓ EvenAppBridge
G2 ディスプレイ
```

### 必要技術
- **watchOS アプリ**: Apple Watch 上で `HKWorkoutSession` で心拍取得
- **iOS ネイティブアプリ**: `WatchConnectivity` で Watch から受信
- **WebView ↔ Native ブリッジ**: iOS アプリと Even Hub プラグインの通信路
- **HealthKit 権限**: Info.plist + 認証 UI

### 工数見積もり
- ネイティブアプリ開発: **2〜4 週間**（旦那様の iOS 開発経験次第）
- HealthKit / WatchConnectivity 学習込みで初回は **1 ヶ月見込み**

### 代替案
- Phase 3a: 手動入力（ランニング開始前に推定 HR を入力 → 経過時間ベースで概算表示）
- Phase 3b: BLE 直結（Polar 等の BLE 心拍計を G2 直接接続できれば理想だが、SDK 制約調査要）

### 推奨着手タイミング
Phase 2（データ保存）完了後、運用 1 ヶ月程度経過し、本当に必要だと判断できてから着手。先にネイティブアプリ化の影響範囲を別 spec で起こす。

---

## Phase 4: AI 動的メッセージ

### 目的
心拍 / ペース / ラップ進捗から状況に応じた声がけメッセージを AI が動的生成。

### スコープ案
- ラップ完了時に Claude API を呼んでメッセージ生成（固定 10 種からの卒業）
- インプット: 現在ラップタイム / 平均ペース / 心拍トレンド / 累計距離
- アウトプット: 励まし / ペース調整提案 / 給水アラート等

### 例
```
入力: ラップ 3 完了、ラップタイム 5'42"、平均より 8 秒速い、心拍 165（やや高い）
出力: 「ペース上がってきてるね！心拍は無理しない範囲で。次は呼吸整えていこう」
```

### 技術選定
- **Claude API**（推奨・旦那様の現在の AI 開発基盤）
- OpenAI API（代替）

### 設計検討事項
| 項目 | 検討内容 |
|---|---|
| 呼び出し頻度 | ラップ時のみ（バッテリー・通信効率優先） |
| レイテンシ | < 2 秒目標（ラップ画面 5〜8 秒表示内に収める） |
| プロンプト設計 | キャラ設定 / トーン調整 / NG 表現リスト |
| フォールバック | API 失敗時は既存 10 種からランダム |
| コスト | 月あたりラン頻度 × ラップ数 × ~$0.001/call（Haiku 4.5 想定） |

### 推奨着手タイミング
Phase 3（心拍数）完了後。心拍データが取れることで AI メッセージの精度が大きく上がるため。

### 実装影響範囲
- `src/ai/`（新規）: AI 呼び出しラッパー + プロンプトテンプレート
- `src/run/state.ts`: ラップ生成時に AI message を待つロジック
- `src/run/messages.ts`: フォールバック専用に縮退
- 設定 UI: API キー入力 + キャラ選択 + ON/OFF トグル

### 想定工数
- 基本実装: 1〜2 セッション
- プロンプトチューニング + テスト: 1 セッション
- 設定 UI: 1 セッション

---

## 技術的負債 / 改善候補

MVP 期間中に積み残した小さな改善候補：

| 項目 | 影響 | 優先度 |
|---|---|---|
| PositionSource interface 注入 | テスト容易性 / Apple Watch 着手時のリファクタ削減 | 中（Phase 3 前に） |
| GPS フィルタ責務分離 | テスト整備時 | 低 |
| `detectLap` の pure 化 | テスト整備時 | 低 |
| ラップ表示時間のパラメータ化 | 現在 6 秒ハードコード | 低 |
| ESLint / Prettier 設定 | コード品質 | 低 |
| ユニットテスト整備（vitest） | リファクタ安全性 | 中（Phase 2 着手前推奨） |
| GitHub Actions による自動ビルド + .ehpk 自動添付 | リリース自動化 | 中（v0.3 以降） |

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
- 学習メモ: `.claude/rules/learning/core.md`
- セッション履歴: `.claude/handoff/handoff-YYYY-MM-DD.md`
- Even Hub 公式: https://hub.evenrealities.com/docs/
- Even Hub テンプレ: https://github.com/even-realities/evenhub-templates
- Even Hub SDK: `@evenrealities/even_hub_sdk` (npm)
