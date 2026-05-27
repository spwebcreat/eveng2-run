# v0.5-spike 発注パケット集

dev-engineer に発注する 3 タスク分の self-contained プロンプト。

## 構成

| ファイル | 検証内容 | 並列性 | 所要時間 |
|---|---|---|---|
| `s1-tiles.md` | 2×2 タイルで 576×288 image 実機表示 | S3/S4 と並列 | 約 5h + バッファ |
| `s3-toolkit-build.md` | even-toolkit + upng-js ビルド検証 | S1/S4 と並列、ビルドのみ | 約 3h + バッファ |
| `s4-mic-pcm.md` | G2 マイク PCM stream ペアリング | S1/S3 と並列 | 約 4h + バッファ |

**S2 (image latency 計測)** は S1 完了後に依存するため、本パケットには含めない。
S1 GO 判定後に別途発注する。

## 発注方法（過渡期: 本社経由）

1. 本社 (`/Volumes/SP-STORAGE 1TB/company/my-company`) で Claude Code を起動
2. dev-engineer subagent / Agent ツールに S1/S3/S4 を 3 並列で発注:
   ```
   このパケットの内容に厳密に従って実装してください: /Volumes/SP-STORAGE 1TB/company/Apps/EvenG2/even-g2-run/docs/v0.5/dispatch/s1-tiles.md
   ```
3. 各タスクは別ブランチ (`feat/v0.5-spike/s1-tiles` / `s3-toolkit-build` / `s4-audio-pcm`) で進める
4. 完了報告は本ディレクトリの `s{n}-result.md` として保存（dev-engineer が作成）

## 全タスク完了後

1. 秘書（このディレクトリの Claude Code）が各成果物を `docs/v0.5/spike-results/summary.md` に集約
2. Codex に最終レビュー依頼（learning P1: 鵜呑み禁止で実物検証）
3. 旦那様が GO/NO-GO 判定 → v0.5 本実装 or 縮小プラン or 旋回

## 共通の必読

- `docs/v0.5/decision-log.md` ─ SSOT
- `docs/v0.5/spike-plan.md` ─ 全体プラン（本パケットの根拠）
- `.claude/rules/learning/core.md` ─ learning P1 ルール 12 項目
- `node_modules/@evenrealities/even_hub_sdk/dist/index.d.ts` ─ SDK API 仕様

## 発注前チェックリスト

着手前に dev-engineer 側で確認すべき項目:

- [ ] `git status` で feature ブランチ作成済み（main から派生、本番未汚染）
- [ ] `node_modules/@evenrealities/even_hub_sdk` がインストール済み
- [ ] `app.json` の `id` が **本番 `com.spwebcreat.g2runhud` を絶対に汚さない**（必ず `.spike.s{n}` suffix）
- [ ] learning P1 12 項目を読み終えた
- [ ] 同型バグ棚卸しを着手前に実施（着手後ではない）
