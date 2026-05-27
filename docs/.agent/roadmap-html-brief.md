# G2 Run HUD v0.5+ ロードマップ HTML 化ブリーフ

Codex に「**人間（旦那様）がレビューして判断を返す HTML**」の構成案 + SVG イラスト案を相談する。

## 背景・コンテキスト

`docs/v0.5-roadmap-brief.md` (既に存在) → Codex 批判レビュー (済) → 修正版ロードマップ確定 (済) → これを **人間レビュー用 HTML** に翻訳する。

詳細は `docs/v0.5-roadmap-brief.md` と、本ブリーフの Section 「内容データ」を参照。

## 設計原則（参考記事より）

参照: https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html
- HTML の価値は「派手な見た目」ではなく **レビュー負荷を下げ、判断を返す速度を上げる** こと
- 100 行超 Markdown は「読む文書」ではなく「読む画面」にする必要がある
- 色・位置・動き・順序に対して **具体的に返事ができる** UI に
- 重大度を画面構造にする（blocking 赤 / nit 黄 / nice 緑 のような視覚的階層）
- スライダーやチェックボックスで「これいい」「やる/やらない」を選択 → Copy as prompt で Claude に返せる
- self-contained 単一 HTML、外部 CDN 禁止、ライトモード前提、印刷 CSS 完備、タブ・アコーディオン活用

## 制約

- 単一 HTML ファイル（CSS / JS / SVG 全てインライン）
- 外部 CDN・ネットワーク禁止
- ライトテーマ前提（v0.4.0 で確立した Even OS 2.0 公式ライト準拠）
- 印刷時にも崩れない CSS
- モバイルでも見れる（旦那様は外出先で確認することもあり）

## 内容データ（HTML に込めるもの）

### A. 現状サマリ (v0.4.0)
- 約 3,158 行、MVP 実機動作確認済、Hub Portal v0.4.0 提出済
- 構成: src/even/ (bridge/render/input) + src/run/ + src/storage/
- 既知の制約: isEventCapture=1 は 1 個、空文字は ' ' 置換、PNG encoded bytes、長押し OS 終了、HR API なし、locked-phone GPS 中断

### B. 発見 (even-toolkit v1.7.2)
- /glasses (29 ファイル、bridge/canvas-renderer/png-utils/splash/glass-screen-router/glass-display-builders 他)
- /web 55+ React components
- /web/icons 191 公式ピクセルアートアイコン (6 カテゴリ)
- /stt STT モジュール (Soniox/Whisper/Deepgram)
- peer dep: SDK ≥0.0.10, React ≥18, react-router ≥7
- **upng-js を import するが package.json deps に書いてない** (要別 install)

### C. Codex Critical Review で確定した SDK 制約
- **Image container 上限 288×144** (PB 制約)、max_count 4 → 2×2 tile で 576×288 全画面 OK
- **HR (心拍) API なし** → 内蔵 HR zone は嘘 UI、削除
- **Audio output API なし** → G2 スピーカー TTS 不可、phone speaker 経由なら可
- **Audio input API あり** (audioEvent / AudioEventPayload, PCM Uint8Array) → **G2 マイクで音声コマンド可能** (新発見)
- **Companion app の正式枠なし** (Hub plugin は単一 WebView entrypoint)
- locked-phone QA は Hub 審査で見られる

### D. 撤回した楽観前提
- 576×288 1 枚 image → 2×2 tile に
- 200ms 周期 → 1Hz / 状態変化時のみ
- React 全面 v0.5 → glasses は plain TS 維持、phone UI のみ v0.7 で React
- Companion app 正式枠 → phone UI と呼ぶ
- 心拍 zone (内蔵) → BLE 外部センサー対応 (v0.9〜)
- グラス TTS → phone speaker
- Spotify / Apple Music / turn-by-turn / 通知転送 → 削除
- AI コーチ client direct → backend proxy 必須、走行後のみ

### E. 確定したロードマップ

```
v0.5-spike (1 週)   検証
                   ├─ 2×2 tile で 576×288 image 実機表示
                   ├─ image update p95 latency 計測 (1Hz vs 状態変化のみ)
                   ├─ even-toolkit + upng-js ビルド検証
                   └─ G2 mic PCM stream (toolkit/stt 実機ペアリング)

v0.5 (2 週)         text HUD 改善 + 基盤
                   ├─ Locked-phone QA 強化
                   ├─ RendererPort 抽象 (text/image 切替)
                   ├─ Settings UI
                   ├─ GPX export
                   ├─ HR zone 削除
                   └─ text-clean サニタイズ採用

v0.6 (3 週)         image 部分採用 (低頻度)
                   ├─ Splash グラフィカル化
                   ├─ Pace sparkline (lap 完了時)
                   ├─ ミニマップ (5 秒更新)
                   ├─ 公式アイコン採用
                   └─ Lap summary グラフ化

v0.7 (1 ヶ月)       phone UI 拡充 + 多画面
                   ├─ React + Vite + even-toolkit/web
                   ├─ Calendar / LineChart / Timeline / StatGrid
                   ├─ IndexedDB 移行
                   ├─ glass-screen-router で多画面
                   └─ Manual lap + GPS quality

v0.8 (1 ヶ月)       Interval workout
                   ├─ phone でプラン作成 (ScrollPicker)
                   ├─ glass でプラン実行
                   ├─ Target pace 差分
                   └─ シューズ管理

v0.9 (1 ヶ月)       BLE HR + Strava + 音声コマンド
                   ├─ Web Bluetooth HR センサー
                   ├─ Strava OAuth + export (backend proxy)
                   ├─ G2 mic 音声コマンド
                   └─ 走行後音声メモ

v1.0 (1 ヶ月)       AI コーチ + 音声 fb + 仕上げ
                   ├─ Claude API backend proxy 走行後 summary
                   ├─ phone speaker 音声通知
                   ├─ オンボーディング
                   └─ Hub Portal cleanup

合計 約 6 ヶ月（副業ペース週 10〜15h 想定）
```

### F. NO-GO リスト
- G2 スピーカー TTS
- Spotify / Apple Music 制御
- Turn-by-turn ナビ
- 通知転送
- ソーシャル
- 内蔵 HR（外部 BLE で代替）

## Codex に求めるアウトプット

### Q1. HTML 全体構成（セクション構成・ナビ・インタラクション）
- どんなセクション分けが「判断を返しやすい」か
- ナビゲーション形式（タブ / アコーディオン / スクロール固定サイドバー / どれか）
- 旦那様が「これやる/やらない」「これ優先度上げる/下げる」を返せる UI 要素はどう入れるか
- 印刷 / モバイル時の崩しを最小にする工夫

### Q2. SVG イラスト案（要所要所に入れる画像）
以下の役割を担う SVG をいくつ、どんな内容で、どこに配置すべきか提案して：

候補 (a) **SDK image container 制約の図解** ─ 288×144 × 2×2 tile = 576×288 を 1 枚絵で
候補 (b) **G2 画面 wireframe** ─ 現状 v0.4.0 HUD vs v0.6 image HUD before/after
候補 (c) **Phase timeline (Gantt 風)** ─ v0.5-spike〜v1.0 を時間軸で
候補 (d) **NO-GO vs GO 比較**ビジュアル ─ Codex 修正の効果を一目で
候補 (e) **Architecture diagram** ─ G2 ↔ phone WebView ↔ backend proxy ↔ Strava/Claude API
候補 (f) **判断インタラクション例** ─ 「これやる/やらない」のチェック UI のイメージ図
候補 (g) **HR API 不在の説明図** ─ なぜ嘘 UI になるかを視覚化
候補 (h) その他 Codex が必要と判断するもの

各 SVG について以下を返してほしい：
- 配置位置 (どのセクション内のどこか)
- 役割 (何を伝えるか)
- 描画案 (テキストで構造を説明、または直接 SVG コード)

### Q3. カラースキーム提案
- 既存 ROADMAP.html (v0.3.x 当時) のライトテーマを継続するか、新規パレットを提案するか
- 重大度 (blocking 赤 / 重要 黄 / 推奨 緑 / 情報 青 / NO-GO 灰) の配色

### Q4. 「判断を返す」UI 部品の具体案
- 各 Phase / 機能に「Keep / Drop / Defer」ボタンを置いて選択結果を JSON / Markdown で出力する案
- フィルタ (時間軸 / 重大度 / カテゴリで絞り込む) の有無
- Copy as prompt ボタンの設置位置

### Q5. 既存 ROADMAP.html (1000 行) を残すか刷新するか
- 残して新規 `roadmap-v0.5.html` を作る案
- ROADMAP.html を全面書き換える案
- どちらが運用上有利か

## 出力フォーマット

Markdown で構造化。各 Q に答え、SVG はコードブロックで返す（インライン埋め込み前提）。
回答は日本語で。
