# G2 Run HUD 観察リスト（v0.5+ で保留扱い）

`docs/v0.5/decision-log.md` Section 2 で「NO-GO 確定を保留」とした機能群の追跡。
**v0.5〜v1.0 では着手しない**が、Even Hub SDK / Hub Portal の進化次第で復活させる。

---

## 観察対象機能

### 1. G2 スピーカー TTS / 音声出力
- **保留理由**: SDK に audio output API が存在しない（2026-05 時点）
- **復活条件**: SDK に音声出力 API が追加 / 骨伝導への送信経路が公開
- **影響範囲**: 1km 毎ペース通知、ラップ完了通知、警告音
- **代替（採用済）**: スマホスピーカー経由通知（v1.0 採用）
- **チェック方法**: `node_modules/@evenrealities/even_hub_sdk/dist/index.d.ts` を新版で grep
  ```
  grep -i "audio\|sound\|tts\|speech\|play" node_modules/.../index.d.ts
  ```

### 2. Spotify / Apple Music 制御
- **保留理由**: Even Hub plugin から音楽制御 API なし、Bluetooth 経由実装手段なし
- **復活条件**: Hub plugin に音楽制御 capability が追加 / Web MediaSession API 連携が可能に
- **影響範囲**: 走行中の曲送り、音量調整、再生/停止
- **代替**: なし（スマホ画面で操作）
- **チェック方法**: Hub Portal docs `https://hub.evenrealities.com/docs/guides/device-apis` の更新確認

### 3. ターンバイターン・ナビ
- **保留理由**: 地図 SDK / map tile 配信なし、外部地図 API 統合コスト過大
- **復活条件**:
  - Mapbox / Komoot 等の WebView 統合手段が公式サポート、または
  - Even Hub 自身が map tile API を提供
- **影響範囲**: ランニングコース案内、次の交差点表示、距離付き矢印
- **代替**: なし
- **チェック方法**: Hub Portal docs / community resources 更新確認

### 4. 通知転送（SMS / LINE / iMessage 等）
- **保留理由**: SDK にスマホ通知（Push Notifications / Notification Listener）API なし
- **復活条件**: SDK にスマホ通知ミラーリング API が追加
- **影響範囲**: 走行中のメッセージ確認、応援メッセージ表示
- **代替**: なし
- **チェック方法**: SDK の OsEvent / SysEvent 系新規 enum を grep
  ```
  grep -i "notif\|message\|push" node_modules/.../index.d.ts
  ```

### 5. ソーシャル機能（フィード / 応援メッセージ / バーチャル併走）
- **保留理由**: バックエンド運用コスト過大、優先度最下位
- **復活条件**: v1.0 達成後の v2 計画フェーズで本格検討
- **影響範囲**: 友達フィード、応援メッセージ、バーチャル併走、Strava クラブ
- **代替**: Strava 連携（v0.9 採用）で間接的に達成
- **チェック方法**: v1.0 リリース時の振り返りで再評価

---

## チェックタイミング

- **各リリース時**（v0.5 / v0.6 / v0.7 / v0.8 / v0.9 / v1.0）に Even Hub SDK の最新バージョンを確認
- **SDK バージョンアップ時**: `node_modules/@evenrealities/even_hub_sdk/package.json` の version 変動を見て本リストを更新
- **Hub Portal docs 更新確認**: `https://hub.evenrealities.com/docs/` のリリースノート / device-apis を月 1 回確認

---

## 復活させる場合のワークフロー

1. 本リストから該当機能を抽出
2. `docs/v0.5/decision-log.md` に「観察リスト → 復活」とログ追記
3. 該当バージョンの実装計画に追加
4. dev-engineer 発注 / Codex レビュー → 通常の v0.x 流れ

---

## 履歴

| 日付 | 変更 |
|---|---|
| 2026-05-27 | 初版作成。旦那様の `exec.nogo-approval` 却下判断を反映 |
