# 発注: v0.5 本実装着手前 P0 修正パッケット

Codex 総合レビュー (2026-05-27) で発覚した 5 件の P0 修正。
**次セッション開始時にこのファイルを Claude に渡す** ことで context 温存しつつ修正実施可能。

---

## 背景

`docs/v0.5/spike-results/` 配下の 3 spike 結果と Codex 総合レビュー (`/tmp/codex-spike-total-review.md` 参照、ただし /tmp は揮発性なので主要指摘を本ファイルに再記載) を受け、v0.5 本実装着手前に必須の修正。

---

## P0-1: `cleanForG2` 採用方針再決定（最重要）

### 問題

`even-toolkit/text-clean` の `cleanForG2` は以下を削除する:
- emoji regex 範囲（`▶ ◀ ● ○` などの記号を含む）
- `.trim()` で前後空白除去

検証済み挙動:
- `cleanForG2('RUN ▶')` → `'RUN'`
- `cleanForG2('●○○')` → `''`
- `cleanForG2(' ')` → `''`

### 既存 HUD への影響

v0.4.0 の `src/even/render.ts:42-83`, `:124-130` は以下に依存:
- `RUN ▶` / `WALK ▶` / `PAUSE ||` / `READY ▶ RUN` / `READY ▶ WALK`
- `●○○` / `○●○` / `○○●`（ページインジケータ）
- 全角スペースで中央寄せ近似（`'　　　　　　　START ◀'` 等）

**`cleanForG2` 全面適用すると上記が全部破壊される**。

### 対応案

1. **新規ファイル `src/even/text-clean-safe.ts` 作成**
   - `cleanForG2` の挙動を踏襲しつつ、以下の文字を保護:
     - `▶ ◀ ● ○ ▌ ▎ ▮ ▯`（HUD 記号セット）
     - 半角/全角スペース
     - 既存 HUD で使う制御文字
   - emoji だけ除去、未サポート Unicode だけ置換

2. または **`cleanForG2` を ASCII 化前提のユーザー入力（メッセージ・カスタム文字列）にのみ適用**
   - 例: `lap.message` だけ通す
   - HUD 静的部分は cleanForG2 を通さない

### 工数

30 分（実装 + snapshot test）

### テスト

```ts
expect(cleanForG2Safe('RUN ▶')).toBe('RUN ▶')
expect(cleanForG2Safe('●○○')).toBe('●○○')
expect(cleanForG2Safe(' ')).toBe(' ')
expect(cleanForG2Safe('Hello 🌍')).toBe('Hello ')
```

---

## P0-2: v0.5-6 import 訂正

### 問題

`docs/v0.5/implementation-plan.md` v0.5-6 で:
- `import { cleanForG2 } from 'even-toolkit/glasses/text-clean'` ← 誤
- `pnpm add even-toolkit upng-js` ← 余計（text-clean のみなら upng-js 不要）

### 正

- `import { cleanForG2 } from 'even-toolkit/text-clean'`
- `pnpm add even-toolkit`（upng-js は不要、png-utils 採用時のみ別途）

### 工数

5 分（implementation-plan.md 1 箇所訂正）

---

## P0-3: implementation-plan 前提条件矛盾

### 問題

`docs/v0.5/implementation-plan.md:8-12` は「v0.5 本実装は S2 完了済が前提」と書かれているが、シオン QA / Codex レビューで「v0.5 は S2 不要、image renderer は v0.6 着手前に S2 必須」と確定。

### 対応

冒頭の前提条件部分を以下に修正:
```
v0.5 本実装は S1/S3/S4 完了で着手可能。
S2 (image latency 計測) は v0.6 image HUD 着手前に必須。
v0.5 範囲では text HUD 改善 + 基盤 + GPX schema v2 + RendererPort 抽象に集中。
```

### 工数

5 分

---

## P0-4: S1 worktree の `pack:ehpk` 誤爆リスク

### 問題

S1 worktree (`.claude/worktrees/agent-a76eabf1014968b8f/`) の `package.json` で:
- `pack:ehpk` script が **本番ファイル名** `g2-run-hud-0.4.0.ehpk` のまま残存
- spike app.json を指して pack すると本番ファイル名で出力される事故リスク

S4 は `pack:ehpk` を `exit 1` に置換して物理禁止にしている（learning P1 追加候補）。

### 対応

S1 worktree の `package.json` で:
```json
"pack:ehpk": "echo 'ERROR: spike branch なので本番 pack は禁止。pack:s1 を使ってください' && exit 1"
```

または、S1 worktree を本流に merge しない方針を徹底（merge 禁止コメントを README に追記）。

### 工数

5 分

---

## P0-5: 旦那様向け報告書ドラフト

### 問題

Codex 指摘:
- 「S4 を v0.9 音声コマンド GO」は強すぎる
- S1/S4 ともに「build/pack/シミュレータ起動 OK」と「実機 GO」を分けて報告すべき
- S2 が v0.6 前必須を明記

### 対応

新規ファイル `docs/v0.5/spike-results/summary-for-owner.md` 作成:

```
# v0.5-spike 結果サマリ（旦那様向け）

## 状態

| spike | 実装 | ビルド | シミュレータ | 実機 GO |
|---|---|---|---|---|
| S1 image | ✅ | ✅ | ✅ | **未確認** |
| S3 build | ✅ | ✅ | N/A | N/A |
| S4 mic | ✅ | ✅ | ✅ | **未確認** |

## 結論候補（実機 GO 後に確定）
- S1 GO: v0.6 image HUD 路線継続、S2 latency 計測着手可
- S1 NO-GO: v0.6 縮小、text HUD 改善のみ
- S3: text-clean は安全（要 cleanForG2 wrapper、P0-1 で対応）。png-utils は v0.6 で再評価
- S4 GO: v0.9 音声コマンド着手可、Whisper-tiny も視野
- S4 NO-GO: v0.9 を PWA Web Speech API へ転換

## v0.6 着手前に必須
- S2 (image update latency 計測) 実施
- S1 NO-GO だった場合は S2 を単タイル × 3 パターンに縮小

## v0.5 本実装着手判定
- S1 実機 GO 不要（v0.5 は text HUD + 基盤、image は v0.6）
- S4 実機 GO 不要（v0.9 まで影響なし）
- S3 結果反映: text-clean は cleanForG2 safe wrapper 経由で採用
```

### 工数

30 分

---

## 全体まとめ

| P0 | 内容 | 工数 |
|---|---|---|
| 1 | cleanForG2 safe wrapper 作成 | 30 分 |
| 2 | v0.5-6 import 訂正 | 5 分 |
| 3 | implementation-plan 前提条件修正 | 5 分 |
| 4 | S1 worktree pack:ehpk 物理禁止 | 5 分 |
| 5 | 旦那様向け報告書ドラフト | 30 分 |

**合計 75 分**

---

## 次セッション開始時の指示テンプレート

新しい Claude セッションを開いて、以下をプロンプトに貼ってください:

```
docs/v0.5/dispatch/p0-fixes.md を読んで、P0-1 〜 P0-5 をすべて実施してください。
完了後、v0.5 本実装着手の準備が整ったことを報告してください。
context 節約のため、各 P0 は最小限の編集に留めてください。
```

---

## 参照

- `docs/v0.5/decision-log.md` (SSOT)
- `docs/v0.5/implementation-plan.md` (修正対象)
- `docs/v0.5/spike-plan.md`
- 各 worktree:
  - S1: `.claude/worktrees/agent-a76eabf1014968b8f/`
  - S3: `.claude/worktrees/agent-a748ac95112cd40e2/`
  - S4: `.claude/worktrees/agent-a51a4de47789f7530/`
- 実機検証手順: `docs/v0.5/spike-results/manual-verify.md`
- spike ehpk: `spike-builds/` 配下
