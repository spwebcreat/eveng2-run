# 発注: v0.5-spike S4 ─ G2 マイク PCM stream ペアリング検証

**発注先**: dev-engineer (本社経由)
**プロジェクト**: G2 Run HUD (`/Volumes/SP-STORAGE 1TB/company/Apps/EvenG2/even-g2-run`)
**ブランチ**: `feat/v0.5-spike/s4-audio-pcm`
**発注日**: 2026-05-27
**並列発注**: S1 / S3 と完全並列で着手可（独立性高）
**SSOT**: `docs/v0.5/decision-log.md`

---

## 目的

`@evenrealities/even_hub_sdk 0.0.10` の `audioControl` + `audioEvent` API が
**G2 実機でマイク PCM を受信できるか**を実証する。

S4 GO → v0.9 で実装する「G2 マイク音声コマンド (pause / lap / next)」の投資判断 OK。
S4 NO-GO → v0.9 の音声コマンドは **PWA Web Speech API 経由（スマホで音声認識）** へ方針転換。

v0.5 / v0.6 / v0.7 / v0.8 には**影響なし**（独立 spike）。

---

## 必読: learning P1 ルール

1. **同型バグ棚卸し**（★本タスクで特に重要）: `audioEvent` listener 内で同期 bridge メソッド呼ぶと再入する可能性 → `queueMicrotask` 経由で処理
2. Codex 指摘は実物検証
3. pack / publish 等 script 名衝突回避
4. PNG/JPEG encoded bytes 必須（本タスク無関係だが念のため）
5. textContainerUpgrade の空文字は前回値残る
6. **isEventCapture: 1 は 1 個だけ**（★本タスクで特に重要）: S4 でも eventCapture 1 個 + status text 1 個構成を厳守
7. version bump 3 ファイル必須
8. Hub Portal Description 更新
9. 公式 docs SPA 取得不能時
10. G2 長押し終了は OS レベル
11. デザインガイド lightness 判定先行
12. 視覚確認できない参照素材は画像エクスポート依頼

---

## 成果物

1. `src/spike/s4-bridge.ts`（最小 text bridge 複製、約 30 行）
2. `src/spike/s4-audio.ts`（新規、約 150 行）
3. `spike-s4.html`（最小 HTML）
4. `app.json` を spike 用に切替: **id を `com.spwebcreat.g2runhud.spike.s4` に変更**
5. `package.json` に `pack:s4` script 追加

---

## 実装詳細

### 1. `src/spike/s4-bridge.ts`（約 30 行）

既存 `src/even/bridge.ts` の最小複製:
- T0 (event capture 全画面、isEventCapture=1、content=' ')
- T1 (status text 中央、isEventCapture=0、リアルタイム情報表示用)

### 2. `src/spike/s4-audio.ts`（約 150 行）

```ts
// 1. await bridge.audioControl(true) でマイク ON
// 2. bridge.onEvenHubEvent で audioEvent.audioPcm を受信
// 3. 受信ごとに記録:
//    - 受信時刻 performance.now()
//    - PCM bytes 長
//    - 直近 100ms の bytes 合計（実効サンプルレート推定）
// 4. text container T1 にリアルタイム表示: "MIC: NNN B/s NNN ms ago"
// 5. 10 秒に 1 回サマリ console.log: avg bps、receive interval p50/p95
// 6. 5 分後 bridge.audioControl(false) で自動 OFF
```

#### PCM フォーマット検出（推測補助）

- 1 秒分の PCM bytes 合計を計測 → 想定サンプルレート逆算
  - 16kHz 16bit mono = 32,000 B/s
  - 8kHz 16bit mono = 16,000 B/s
  - 16kHz 8bit mono = 16,000 B/s
- 先頭 16 byte を hex で console.log（WAV header 風なら bit 深さ判別）

#### エラーパターン

明確な NG ログとして区別:
- `audioControl(true)` が false を返す（権限ない / マイクなし）
- `audioEvent` が一度も発火しない
- PCM bytes が 0 byte
- これらを `console.error` 出力

### 3. `spike-s4.html`

最小 HTML（status only）

### 4. `app.json` 切替

| 項目 | spike S4 値 |
|---|---|
| id | `com.spwebcreat.g2runhud.spike.s4` |
| name | `G2 Run HUD Spike S4 (Mic)` |
| version | `0.5.0-spike.s4` |
| entry | `spike-s4.html` |
| Hub Portal Description | "v0.5-spike S4: G2 マイク PCM stream 検証。本番版とは別アプリ。" |

### 5. `package.json` の `pack:s4`

```json
"pack:s4": "pnpm build && evenhub pack app.json dist -o g2-run-hud-spike-s4-0.5.0.ehpk"
```

---

## SDK 既知挙動の確認

実物 (`node_modules/@evenrealities/even_hub_sdk/dist/index.d.ts`) で以下を確認後着手:

- `audioControl(isOpen: boolean): Promise<boolean>` ─ index.d.ts:1187 付近
- `event.audioEvent?.audioPcm: Uint8Array` ─ index.d.ts:856-862 付近
- `EvenAppMethod.AudioControl = "audioControl"` ─ index.d.ts:25 付近

---

## 同型バグ棚卸し

報告書に確認結果を明記:

- **F8 系**: `audioEvent` listener 内で同期的に bridge メソッドを呼ぶと再入する可能性 → `queueMicrotask` 経由で処理する設計か
- **W4 系**: cleanup 時に `audioControl(false)` と unsub の順序（先に unsub → 後で audioControl(false) でないと最後のイベントを取りこぼす）
- **同期 onError 再入**: `audioControl` が即座に reject されるケースへの防御

---

## 完了条件

- **シミュレータ**: `audioControl` 呼び出しが成立（PCM 来なくても OK、シミュレータでは音声サポート不明）
- **ビルド**: `pnpm pack:s4` で ehpk 出力
- **型安全**: `tsc --noEmit` PASS
- 実機検証は秘書が手動で 5 分間実施

### GO/NO-GO 判定基準（実機検証後）

- **GO**:
  - `audioControl(true)` が true を返す
  - `audioEvent` が 1 秒以内に最初の発火
  - 連続発火 interval p95 ≤ 500ms
  - 1 秒あたり ≥ 8,000 B/s
- **NO-GO**: audioEvent が一度も来ない / audioControl が false → v0.9 音声コマンドを PWA Web Speech API に方針転換

---

## やらないこと（明示）

- STT エンジン（Whisper / Soniox / Deepgram）の組み込み（v0.9 で実施）
- PCM の音声処理（FFT / VAD 等）
- companion UI への音声波形表示
- 音声コマンド認識ロジック（v0.9）

---

## 所要時間目安

dev-engineer 作業: **約 4h**（バッファ込み 5h）
秘書レビュー: 1h
旦那様実機検証: 0.5h（5 分マイク ON テスト）

---

## 報告フォーマット

1. 同型バグ棚卸し結果
2. learning P1 反映チェック
3. SDK index.d.ts での実 API 仕様確認結果（行番号付き）
4. シミュレータ起動ログサンプル
5. PCM フォーマット推測の理論計算（バッチ単位の bytes/sec で逆算）
6. 実機検証時の確認手順（5 分マイク ON で観察するメトリクス一覧）
7. GO/NO-GO 判定後の次アクション（GO → v0.9 投資確定 / NO-GO → PWA 方針転換）

---

## 参照

- `docs/v0.5/spike-plan.md` Section S4
- `docs/v0.5/decision-log.md` (SSOT)
- `node_modules/@evenrealities/even_hub_sdk/dist/index.d.ts`:25, :856-862, :1175-1187
- `src/even/bridge.ts` (text bridge、s4-bridge.ts の複製元)
- `.claude/rules/learning/core.md` (learning P1 ルール)
