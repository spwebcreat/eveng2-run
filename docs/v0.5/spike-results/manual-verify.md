# spike 実機検証手順（旦那様向け）

3 spike 実装完了。実機検証で GO/NO-GO 確定をお願いします。

## 検証対象 ehpk と推奨アップロード順

`spike-builds/` 配下に配置済（git ignored）。

**learning P1「同一 version はキャッシュで反映されない」回避のため、version を昇順に振っています。アップロードはこの順で。**

| 順 | ehpk | version | 担当 | 優先度理由 |
|---|---|---|---|---|
| **1** | `g2-run-hud-spike-s1-0.5.0.ehpk` (46KB) | `0.5.0` | S1 image tile | v0.6 を block するので最優先 |
| **2** | `g2-run-hud-spike-s4-0.5.1.ehpk` (47KB) | `0.5.1` | S4 マイク PCM | v0.9 入口 |

S3 はビルド検証のみで ehpk なし（実機テスト不要）。

---

## S1: 2×2 タイル image 表示検証

### 事前

- 本番 `com.spwebcreat.g2runhud` (v0.4.0) と **別アプリ** として Hub Portal に登録
- package_id: `com.spwebcreat.g2runhud.spike.s1`
- name: `G2 HUD Spike S1`
- version: `0.5.0`（先にアップロード）
- Description: 「v0.5-spike S1: 2×2 タイルで 576×288 image 表示検証。本番版とは別アプリ。検証後削除予定」

### 検証手順

1. Hub Portal に `g2-run-hud-spike-s1-0.5.0.ehpk` をアップロード（先）
2. G2 で起動
3. 自動で 3 パターンが 5 秒ずつ切替（無限ループ）

### GO 判定基準（全て満たす）

| パターン | 視覚チェック |
|---|---|
| **A 境界線** | 各タイル外周 1px 黒枠が **連続した 576×288 外周枠**として見えるか／中央の `TL/TR/BL/BR` 文字が正しい位置 |
| **B グラデーション** | 中央付近の段差・色ジャンプ・タイル境界の不連続が **無い** |
| **C 大型タイポ** | 境界をまたぐ `12:34` が **1 文字として読める**／字の上下/左右で段差なし |

3 パターン全て GO なら **S1 GO 確定** → v0.6 image HUD 路線継続。
1 つでも NG なら **S1 NO-GO** → v0.6 縮小（text HUD 改善のみ）。

---

## S4: G2 マイク PCM stream 検証

### 事前

- 本番と別アプリ
- package_id: `com.spwebcreat.g2runhud.spike.s4`
- name: `G2 HUD Spike S4`
- version: `0.5.1`（S1 の後にアップロード）
- permission `g2-microphone` の同意ダイアログを「許可」

### 検証手順

1. Hub Portal に `g2-run-hud-spike-s4-0.5.1.ehpk` をアップロード（S1 の後）
2. G2 で起動 → permission 許可
3. iPhone 側で `chrome://inspect` または `Safari Web Inspector` で DevTools コンソール接続
4. 自動で 5 分マイク ON（手動停止は G2 長押し）
5. G2 ディスプレイに `MIC NNN B/s NNN ms ago | n=NN t=NNs` が継続表示されるか確認

### GO 判定基準

| メトリクス | GO 値 |
|---|---|
| `audioControl(true)=true` | true |
| `audioControlOnLatencyMs` | < 200ms |
| `firstEventLatencyMs` | < 1000ms |
| `events` (totalEvents) | > 0 |
| `avgBps` | ≈32,000 ± 10%（16kHz/16-bit/100ms 公式仕様） |
| `bytes/event` p50/p95 | 一定 (3200/3200 想定) |
| `interval` p95 | ≤ 500ms |

GO なら → v0.9 音声コマンド実装着手可能、**Whisper-tiny on-device STT も視野**。
NO-GO なら → v0.9 を PWA Web Speech API 方針に転換。

---

## 検証後の後処理

- DevTools コンソールのログをスクショ or copy 保存
- Hub Portal の spike アプリは検証完了後に削除
- 結果（GO/NO-GO + ログ）を秘書（Claude）に共有

---

## 注意

両 spike とも **本番 (v0.4.0) と完全独立** なので、共存しても本番動作に影響ありません。
万一の安全のため本番アプリは触らないでください。
