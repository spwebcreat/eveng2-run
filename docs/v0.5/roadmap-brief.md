# G2 Run HUD v0.5+ Roadmap Brief

Even Realities G2 向け Even Hub プラグイン「G2 Run HUD」の v0.5 以降の方向性を、
even-toolkit（fabioglimb/even-toolkit）導入を起点に再設計するためのブリーフ。
Codex CLI に Critical Reviewer として渡し、計画の盲点・代替案・優先度を評価させる。

---

## 1. プロジェクト現状 (v0.4.0)

- **対象**: Even Realities G2 / Even Hub Plugin (4-bit gray 576×288 monochrome display)
- **目的**: ランニング HUD（距離・ペース・経過時間・心拍・LAP）
- **技術スタック**: TypeScript + Vite + `@evenrealities/even_hub_sdk@^0.0.10` (plain TS, React 未使用)
- **コード規模**: 約 3,158 行
  - `src/even/bridge.ts` (240) ─ SDK ラッパー (text container 8 個構成)
  - `src/even/render.ts` (243) ─ RenderMap 構築 (3x3 グリッド)
  - `src/even/input.ts` (150) ─ 入力イベント処理
  - `src/main.ts` (701) ─ glue
  - `src/run/*` (~880) ─ state / pace / lap / format / geolocation
  - `src/storage/*` (~250) ─ SDK adapter / browser adapter
- **状態**: MVP 実機動作確認済、Hub Portal 提出済（v0.4.0）

### 既知の制約と learning

- `isEventCapture: 1` は container 1 個だけ（multiple event listeners >1 でハネられる）
- text container の content `''` は「変更なし」扱い → `' '` 半角スペースに変換要
- PNG image container は **encoded PNG bytes** を要求（生 4-bit gray packed bytes は不可）
- G2 長押しは OS レベルでアプリ強制終了
- アプリ再アップロードはバージョン bump 必須（同一 version はキャッシュで反映されない）
- v0.2.x で 4-bit gray アイコン / PNG アイコン (24×24) を試したが視認性問題で v0.2.3 で全廃 → テキスト + 媒体プレーヤー風記号 (▶ || ●○) に切替
- v0.3.0 でデザインガイド未確認のまま提出 → v0.4.0 で Even OS 2.0 公式 = ライトテーマと判明、companion なし HUD 単独構成のまま

---

## 2. 発見：even-toolkit (v1.7.2)

https://github.com/fabioglimb/even-toolkit

- Even Realities G2 専用デザインシステム + コンポーネントライブラリ
- `/glasses` ─ G2 SDK ラッパー (29 ファイル: bridge / canvas-renderer / png-utils / splash / gestures / glass-screen-router / glass-display-builders / glass-nav / glass-mode / paginate-text / text-clean 他)
- `/web` ─ 55+ React コンポーネント (Calendar / LineChart / BarChart / Timeline / VoiceInput / FileUpload / SettingsGroup 他)
- `/web/icons` ─ **191 公式ピクセルアートアイコン** (32×32 / 2×2px グリッド / 6 カテゴリ: Edit&Settings 32, Feature 50, Guide 20, Menu Bar 8, Navigate 23, Status 54, Health 12)
- `/stt` ─ Speech-to-Text モジュール (Soniox / Whisper / Deepgram)
- peer dep: `@evenrealities/even_hub_sdk` ≥0.0.10, React ≥18, react-router ≥7
- v1.7.2、★58、昨日 (2026-05-26) 更新

### 最大の発見：描画パラダイムの転換

| | 我々の現状 (v0.4.0) | toolkit 方式 |
|---|---|---|
| 描画単位 | text container 8 個 | **1 枚の 576×288 Canvas → PNG bytes → image container** |
| フォント | G2 既定 (proportional) | 自由 (Courier New / 任意) |
| アラインメント | 全角スペースで近似 | 自由 (centerX / right-align) |
| アイコン | テキスト記号 ▶ || ●○ | **191 公式アイコン描画可** |
| 図形 / グラフ | 不可 | 自由 (lineTo / fillRect / arc) |
| インバート反転表示 | 不可 | 実装済み |

これにより「テキストだけの HUD」から「本物のデザインを持つグラフィカル HUD」へ
質的変化が可能。アイコン視認性問題も canvas 上で任意サイズ描画で解決可能。

---

## 3. 提案ロードマップ

### Phase A: v0.5 (2 週間) ─ Canvas 化 + 公式アイコン採用

**目的**: グラス UI の質的向上

- `EvenHubBridge` (toolkit) 採用、image container ベースに再設計
- `canvas-renderer` + `png-utils` で全画面 Canvas 描画
- 公式 191 アイコン採用（Health 12 / Status 54 / Navigate 23 から心拍・距離・ペース・方角等）
- 主指標 (距離 or ペース) を 72px 巨大表示
- 心拍ゾーンバー (Z1〜Z5 視覚化)
- 直近 5km pace sparkline
- React 化 (`useGlasses` hook 採用)
- `glass-screen-router` で複数画面対応 (HUD / Laps / HR Zone / Settings ほか)
- `text-clean.cleanForG2` で emoji / 未サポート文字サニタイズ
- 既存 8 text container → 1 image + 1 透明 event capture text の構成へ
- 既存 `state.ts` / `pace.ts` / `lap.ts` / `format.ts` は維持（render 層だけ書き換え）

**移行リスク**:
- React 化が破壊的（main.ts 701 行全書き換え）
- canvas → PNG → SDK 経路の性能（毎フレーム encode コストは？）
- toolkit の `EvenHubBridge` は textPage/columnPage/splitPage プリセットで、我々の自由配置 HUD と相性がどうか

### Phase B: v0.6 (1 ヶ月) ─ Companion App 新設

**目的**: スマホ側で履歴・チャート・設定 UI

- Vite + React + toolkit/web 構成
- 走行履歴 Calendar (日別ヒートマップ)
- 走行詳細 LineChart (pace/hr 時系列) + BarChart (splits)
- StatGrid (BEST/AVG/TOTAL)
- Timeline (時系列ラップ)
- SettingsGroup + Toggle + Slider で設定
- FileUpload で GPX import/export
- データレイヤ: 現 localStorage → IndexedDB に強化
- G2 ↔ companion 通信: SDK の networking API 経由 (or BLE)

**未確認事項**:
- Even Hub Plugin の "companion" は SDK で正式サポートされているか
- companion app は G2 グラスに付随するスマホアプリとして Hub に提出するのか別配布か
- networking API で realtime ペアリングは可能か

### Phase C: v0.7+ (数ヶ月) ─ エコシステム統合

- **v0.7 (1-2 ヶ月)**: 地図 (Leaflet/Mapbox) + GPX + Strava 連携 + ミニマップ HUD
- **v0.8 (2-3 ヶ月)**: ワークアウトプラン + インターバル実行 (HIIT / build / recovery)
- **v0.9 (3-4 ヶ月)**: AI コーチ (Claude API) + TTS 音声フィードバック + 通知転送
- **v1.0 (5-6 ヶ月)**: ソーシャル (フィード/応援) + 音楽 (Spotify/Apple Music) + turn-by-turn ナビ

---

## 4. Codex に評価してほしい論点

1. **canvas → PNG → image container** 経路の性能リスクは？
   毎フレーム (200ms 周期想定) PNG encode + bytes 送信は G2 / SDK の負荷として現実的か？
   text container 直接更新と比較してフレームレート・電力消費は？

2. **React 化のコスト対効果** は妥当か？
   現状 plain TS + Vite で動いている MVP を React に移すコスト vs 得られる利益
   （toolkit hook 活用、companion 共用、コンポーネント再利用）

3. **even-toolkit の依存リスク**：
   v1.x（破壊的変更あり得る）、開発者 1 人、peer dep 多い
   pin 戦略・fork 戦略・部分採用戦略のどれが最適か

4. **Phase B (companion app) の前提が成立するか**：
   Even Hub Plugin として companion app は正式サポートされるか
   別 PWA 配布として独立させる方が現実的か

5. **Phase 順序の妥当性**：
   Phase A (UI) → B (companion) → C (連携) の順は最適か？
   例えば Phase C の Strava 連携を先に入れて履歴データソースを確保すべきでは？

6. **Phase C-AI コーチ (Claude API)** の現実性：
   プラグインからの外部 API call は SDK / Hub のセキュリティポリシー的に許容されるか
   ローカル LLM や事前生成テンプレに留めるべきか

7. **見落としている機能・リスク**：
   ランナー向けキラーアプリとして、上記以外で重要な機能は？
   逆に上記の中で「優先度が低い」「実装しても価値が薄い」ものは？

8. **MVP→v1.0 の現実的所要期間**：
   提示の "5-6 ヶ月" は妥当か（旦那様は個人開発 + Claude Code + 副業ペース想定）
   先に絞るべき Phase / 後回しにすべき Phase の組み替え案は？

---

## 5. 制約・前提

- 開発者：個人（旦那様 + Claude Code）
- 実機テスト：手元に G2 一台あり、シミュレータ併用
- Hub Portal：v0.4.0 まで提出経験あり、リリースサイクルは患つかんでいる
- 過渡期：本社経由 (my-company リポジトリ) で dev-engineer 発注 + Codex レビューのワークフロー
- 安定期目標：G2 ディレクトリ単独運用に移行
- learning P1 ルール：dev-engineer 発注時は「同型バグの棚卸し」明示、Codex 指摘は鵜呑み禁止で実物検証
