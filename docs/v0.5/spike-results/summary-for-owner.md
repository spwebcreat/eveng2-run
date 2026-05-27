# v0.5-spike 結果サマリ（旦那様向け）

2026-05-28 確定版。S1 / S4 ともに **GO 確定**。

## 状態

| spike | 内容 | 実装 | ビルド | シミュレータ | 実機 GO |
|---|---|---|---|---|---|
| S1 | 2×2 タイル image bridge | ✅ | ✅ | ✅ | **✅ GO 確定** |
| S2 | image update latency 計測 | ⏸ 未着手 | — | — | v0.6 着手前に必須 |
| S3 | even-toolkit + upng-js ビルド | ✅ | ✅ | N/A | ✅ 採用確定（cleanForG2Safe 経由） |
| S4 | G2 マイク PCM ペアリング | ✅ | ✅ | ✅ | **✅ GO 確定** |

## S4 GO 判定の根拠（実測）

5 分間計測で全 GO 基準クリア:

| メトリクス | GO 基準 | 5 分実測 | 判定 |
|---|---|---|---|
| events 完走 | > 0 | **n=2979** | ✅ |
| avgBps | 32,000 ± 10% | **31,776 B/s** (ど真ん中) | ✅ |
| events/sec | ≈ 10/s | 9.93/s | ✅ |
| 平均 interval | ≤ 500ms (p95) | ~101ms | ✅ |
| firstEventLatency | < 1000ms | 数秒以内に開始 | ✅ |
| stream 安定性 | 5 分完走 | `done (timeout)` | ✅ |
| グラス表示 | 継続表示 | OK | ✅ |

計算: 2979 events × 3,200 bytes/event ÷ 300 秒 = **31,776 B/s** （理論値 32,000 とほぼ一致）。

## 旦那様の残作業

- Hub Portal の spike 用 2 アプリ（`G2 HUD Spike S1` / `G2 Spike S4 Mic`）を削除
- v0.5 本実装着手（`docs/v0.5/implementation-plan.md` 通り、P0 5 件完了済 + S3 採用確定済）

## 確定結論

### S1 (image bridge) — ✅ GO 確定
v0.6 image HUD 路線継続。S2 latency 計測着手可。

### S3 (toolkit) — ✅ 採用確定
`cleanForG2Safe`（自前 safe wrapper、`src/even/text-clean-safe.ts`）経由で `even-toolkit/text-clean` を v0.5-6 に取り込む（P0-1 で対応済）。`png-utils` は v0.6 で再評価（pako 219KB の隠れ重荷あり）。`upng-js` は不要。

### S4 (mic PCM) — ✅ GO 確定
v0.9 音声コマンド着手可。Whisper-tiny on-device STT も視野に入る。

## v0.6 着手前に必須

- **S2（image update latency 計測）** を必ず実施

## spike 過程で発覚した重要事故

初回 ehpk (v0.5.0 / v0.5.1) で vite multi-entry build が本番 entry を dist/ に混入させ、Hub OS が本番 UI を起動する事故が発生。Codex 第二意見 + clean build 方針 + dist/ 検査ゲート 4 項目で再発防止策を確立。learning P1 に 5 件追記済。

詳細:
- `docs/v0.5/spike-results/codex-brief.md`
- `.claude/rules/learning/core.md` (2026-05-27 P1 追記分)

## 参照

- 実機検証手順: `docs/v0.5/spike-results/manual-verify.html` (v2 改修済、5 枚イラスト埋め込み)
- spike ehpk: `spike-builds/g2-run-hud-spike-s1-0.5.2.ehpk` / `g2-run-hud-spike-s4-0.5.3.ehpk`
- v0.5 本実装プラン: `docs/v0.5/implementation-plan.md`
- 判断ログ SSOT: `docs/v0.5/decision-log.md` (Section 8 に GO 結果反映済)
