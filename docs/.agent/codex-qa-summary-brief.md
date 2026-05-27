# G2 Run HUD v0.5-spike 総合レビュー brief (Codex 用)

旦那様の判断確定後、3 並列 spike (S1/S3/S4) を実施完了。
シオン QA cross-cut で P1 違反ゼロを確認したが、最終 GO/NO-GO 判定の前に
Codex に独立 critical review を依頼する。

---

## 1. spike 結果サマリ

### S1: 2×2 タイルで 576×288 image 実機検証
- **状態**: 実装完了、ehpk 出力 (46,661 bytes)、シミュレータ起動成功
- **branch**: `feat/v0.5-spike/s1-tiles` @ worktree `.claude/worktrees/agent-a76eabf1014968b8f`
- **新規ファイル**: `src/even/png-encode.ts` (93) / `src/even/image-bridge.ts` (320) / `src/spike/s1-tiles.ts` (243) / `spike-s1.html` (49)
- **重要発見**:
  - `ImageContainerProperty` に `isEventCapture` フィールド無し（SDK d.ts L389-406）→ image 4 枚は capture 設定不要、text 1 枚で event capture
  - dedup は full byte compare で実装、`lastSent.set(id, bytes.slice())` で snapshot 化（Codex post 指摘で訂正）
  - パターン B/C は 576×288 全画面 canvas に描画 → 4 タイル crop が正解（独立描画は font metrics/AA 差で境界汚染）
- **実機検証残課題**: シミュレータ native binary 自動検証不可、4 タイル境界視認 / 段差検出 / 大型タイポ分断検出は旦那様手動

### S3: even-toolkit + upng-js ビルド検証
- **状態**: 6 シナリオ計測完了、報告書あり、tsc PASS
- **branch**: `feat/v0.5-spike/s3-toolkit-build` @ worktree `.claude/worktrees/agent-a748ac95112cd40e2`
- **重要発見**:
  - toolkit subpath は `/text-clean` `/png-utils` `(root)` が正（dispatch packet の `/glasses/text-clean` 等は誤記）
  - toolkit deps に upng-js 未記載 → **undeclared dependency**、利用側で `pnpm add upng-js` 明示必須
  - **pako 219 KB が upng-js の直 dep として自動同梱**される（隠れた重荷）
  - `useGlasses` 単体採用は react-router 必須でビルドエラー（実物検証で再現）
- **bundle size (gzip-9)**:
  - baseline (SDK only): 27.1 KB
  - **A (text-clean のみ): 0.9 KB** ← 超軽量
  - B (png-utils): 22.5 KB（うち pako 含）
  - AB (text+png): 23.0 KB
  - C1 (root): 3.9 KB
  - C2 (root + 12 subpaths, React 系除外): 61.5 KB
- **結論候補 (事実)**:
  - text-clean 部分採用: 安全
  - png-utils 採用: 自前 Canvas.toBlob との比較が要検証（S1 で既に自前実装あり）
  - フル採用: v0.7 React 化まで延期妥当

### S4: G2 マイク PCM stream ペアリング検証
- **状態**: 実装完了、ehpk 出力 (47,206 bytes)、シミュレータ audio device 認識
- **branch**: `feat/v0.5-spike/s4-audio-pcm` @ worktree `.claude/worktrees/agent-a51a4de47789f7530`
- **新規ファイル**: `src/spike/s4-bridge.ts` (164) / `src/spike/s4-audio.ts` (445) / `spike-s4.html` (61)
- **重要発見**:
  - **シミュレータ audio 公式仕様判明** (`evenhub-simulator/README.md` L109-115):
    - 16,000 Hz / signed 16-bit LE / mono
    - 100 ms / event = 3,200 bytes/event
    - ≈10 events/sec ≈32,000 B/s
  - **app.json validator 制約全件判明**:
    - `name`: 20 字以内
    - `version`: `x.y.z` 厳格
    - `permissions[].name` enum: `g2-microphone` / `phone-microphone` / `album` / `location` / `network` / `camera`
  - 同型バグ 9 パターン全件防御 (listener 再入 / cleanup 順序 / TDZ レース / マイク放置レース / 二重 OFF / NG 上書き / stall 検出 / 本番 ehpk 誤爆防止)
  - **pack:ehpk を `exit 1` に置換** で spike branch から本番 ehpk 物理生成不可に
- **Codex 関与**: pre + post + 残レース で計 3 周クリア

---

## 2. シオン QA cross-cut 結果

### learning P1 横串チェック (12 項目)
- **違反ゼロ**
- S4 が pack:ehpk 物理禁止という追加防御発明

### Dispatch packet 共通見落とし（要訂正）
1. `app.json.name` 20 字制限 (S1, S4)
2. `app.json.version` は `x.y.z` 厳格 (S1, S4)
3. `permissions[].name` enum (S4)
4. toolkit subpath は `/text-clean` (not `/glasses/text-clean`) (S3)

### learning P1 追加候補（3 件）
1. **app.json validator 制約**: name 20字 / version x.y.z / permissions enum
2. **toolkit subpath は exports field 実物確認**: `gh api repos/<owner>/<repo>/contents/package.json` で確認
3. **シミュレータ audio 公式仕様**: 16kHz/16-bit LE/100ms/3200B (README L109-115)

### v0.5+ 本実装への含意
- **v0.5 で text-clean 採用は確定 GO** (0.9 KB)
- **v0.6 image HUD の S1 GO**、ただし latency (S2) は未測定
- **v0.6 で toolkit/png-utils 採用は再検討要** (S1 で自前 PNG encode 完成、pako 219KB の重荷を背負う価値があるか)
- **v0.9 音声コマンド GO** (16kHz/16-bit/100ms 確認、Whisper-tiny on-device STT も視野)

### S2 (latency 計測) 必要性
- v0.5 本実装は **S2 完了を待たずに進められる** (v0.5 は text HUD + 基盤、image は v0.6)
- S2 は v0.6 着手前に必須

---

## 3. Codex に評価してほしい論点

### A. spike 結果の互いの整合性
- 3 spike の発見に矛盾はないか
- S1 で自前 PNG encode を作った事実と S3 の toolkit/png-utils 結論は整合するか

### B. dispatch packet 見落としの影響範囲
- 4 件の見落とし（name 20字 / version x.y.z / permissions enum / toolkit subpath）が v0.5+ 計画の他の箇所にも潜んでいないか
- `docs/v0.5/implementation-plan.md` v0.5-6 (text-clean 採用) の記述を訂正必要か

### C. v0.5 本実装への移行妥当性
- S2 未実施で v0.5 本実装に移行する判断は妥当か
- v0.5 で text-clean を採用する場合、`pnpm add even-toolkit` で disk に 8MB（recharts 等）が乗る点は許容範囲か
- 自前 PNG encode が S1 に既にある事実を v0.6 計画にどう反映するか

### D. learning P1 追加 3 件の優先度
- どれを必ず P1 化すべきか、どれは P2 (オンデマンド) で十分か

### E. 旦那様への報告で漏らしてはいけない点
- 上記サマリで旦那様判断に必要な情報が揃っているか
- 実機検証手順 (S1 + S4 のみ) の優先順位

### F. spike 完了後のクリーンアップ手順
- 3 worktree × commit 未実施の状態をどう本流に反映するか
- Hub Portal にアップロードした spike アプリ (s1, s4) の削除タイミング

### G. 見落としている潜在リスク
- 上記論点以外で、v0.5 本実装着手前に確認すべきこと

---

## 4. 期待アウトプット

各論点 A〜G について以下形式で:

```
## 論点 X. {タイトル}
- **判定**: GO / NO-GO / CONDITIONAL
- **根拠**: ...
- **対応案**: ...
- **要検証**: ...
```

冒頭に **Executive Summary (最重要 3〜5 点)**、最後に **v0.5 本実装着手前 P0 リスト**。

---

## 5. 参照

- `docs/v0.5/decision-log.md` (SSOT)
- `docs/v0.5/watch-list.md`
- `docs/v0.5/spike-plan.md`
- `docs/v0.5/implementation-plan.md`
- `docs/v0.5/dispatch/s{1,3,4}-*.md`
- `.claude/rules/learning/core.md` (P1 ルール 12 項目)
- 各 worktree:
  - `.claude/worktrees/agent-a76eabf1014968b8f/` (S1)
  - `.claude/worktrees/agent-a748ac95112cd40e2/` (S3、報告書 `docs/v0.5/spike-results/s3-toolkit-build-report.md` あり)
  - `.claude/worktrees/agent-a51a4de47789f7530/` (S4)
