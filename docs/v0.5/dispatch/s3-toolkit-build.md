# 発注: v0.5-spike S3 ─ even-toolkit + upng-js ビルド検証

**発注先**: dev-engineer (本社経由)
**プロジェクト**: G2 Run HUD (`/Volumes/SP-STORAGE 1TB/company/Apps/EvenG2/even-g2-run`)
**ブランチ**: `feat/v0.5-spike/s3-toolkit-build`
**発注日**: 2026-05-27
**並列発注**: S1 / S4 と完全並列で着手可（独立性最高）
**実機テスト**: 不要（ビルドのみで完結）
**SSOT**: `docs/v0.5/decision-log.md`

---

## 目的

`fabioglimb/even-toolkit v1.7.2` を **G2 Run HUD に部分採用できるか**をビルドだけで判定する。

特に懸念点:
- toolkit の `glasses/png-utils.ts` が `upng-js` を import しているが、toolkit `package.json` の `dependencies` には書かれていない（peer or transitive 未明確）
- `even-toolkit/web` が React + react-router を peer dep にしているが、subpath import で tree-shaking が効くか
- SDK 0.0.10 と toolkit 1.7.2 の互換性

---

## 必読: learning P1 ルール

1. **同型バグ棚卸し**: 着手前に棚卸ししてから着手
2. **Codex 指摘は実物検証**（★本タスクで特に重要）: toolkit の peer dep / sub-path export 構造は `package.json` と `exports` field を必ず直接読んで確認
3. **pack / publish 等 script 名衝突回避**
4. PNG/JPEG encoded bytes 必須
5. textContainerUpgrade の空文字は前回値残る
6. isEventCapture: 1 は 1 個だけ
7. version bump 3 ファイル必須
8. Hub Portal Description 更新
9. **公式 docs SPA 取得不能時**: `gh api repos/fabioglimb/even-toolkit/contents/<path>` で生コード取得
10. G2 長押し終了は OS レベル
11. デザインガイド lightness 判定先行
12. 視覚確認できない参照素材は画像エクスポート依頼

---

## 成果物

1. `src/spike/s3-imports/text-clean-only.ts`（新規）
   ```ts
   import { cleanForG2 } from 'even-toolkit/glasses/text-clean'
   export const sample = cleanForG2('Hello 🌍 World')
   ```
2. `src/spike/s3-imports/png-utils-only.ts`（新規）
   ```ts
   // toolkit の png-utils 実 API 名は要確認 (gh api で確認)
   import { /* actual exports */ } from 'even-toolkit/png-utils'
   ```
3. `src/spike/s3-imports/full-glasses.ts`（新規）
   ```ts
   import * as glasses from 'even-toolkit/glasses'
   ```
4. 各シナリオの `vite build` 出力サイズ計測ログ
5. `docs/v0.5/spike-results/s3-toolkit-build-report.md`（事実のみ、判断は秘書）

---

## 実装手順

### Step 1: 依存追加（5 分）

```bash
pnpm add even-toolkit upng-js
```

- `pnpm install` 出力を `s3-pnpm-install.log` に保存
- peer dep 警告（React / react-router 等）を全件記録

### Step 2: テスト import スクリプト作成（合計 120 行）

3 シナリオ:
- A. `text-clean-only.ts`: 最小 subpath import
- B. `png-utils-only.ts`: upng-js 依存確認用（実 API 名は `gh api repos/fabioglimb/even-toolkit/contents/glasses/png-utils.ts` で確認）
- C. `full-glasses.ts`: 全 glasses 再 export 込み（最大ケース）

### Step 3: ビルドサイズ計測

各シナリオを別 vite mode でビルド:

```bash
vite build --mode spike-s3-a  # output: dist/spike-s3-a/
vite build --mode spike-s3-b
vite build --mode spike-s3-c
```

各 `dist/spike-s3-*/assets/*.js` のサイズを記録:

```bash
du -h dist/spike-s3-a/assets/*.js
gzip -c dist/spike-s3-a/assets/*.js | wc -c
```

**比較基準**: 現 v0.4.0 build（toolkit 無し）の bundle size

### Step 4: tree-shaking 動作確認

各シナリオの成果物から手動 grep:

| 確認項目 | A (text-clean) | B (png-utils) | C (full) |
|---|---|---|---|
| `canvas-renderer` 関数名含む | ❌ 想定 | ❌ 想定 | ✅ |
| `paginate-text` 含む | ❌ 想定 | ❌ 想定 | ✅ |
| React の関数名含む | ❌ 必須 | ❌ 必須 | ❌ 必須 |
| `upng-js` (`UPNG`) 含む | ❌ 想定 | ✅ 想定 | ✅ |

### Step 5: SDK 0.0.10 互換性

- `node_modules/even-toolkit/package.json` の `peerDependencies.@evenrealities/even_hub_sdk` を確認
- 既存 `src/even/bridge.ts` の `waitForEvenAppBridge` / `EvenAppBridge` 型と toolkit の `EvenHubBridge` 型が衝突しないか `tsc --noEmit` 確認

### Step 6: 報告書 `docs/v0.5/spike-results/s3-toolkit-build-report.md`

事実のみ記載（判断は秘書）:

```md
# v0.5-spike S3 結果報告

## 1. 依存追加
- pnpm add 警告: ...
- 追加された node_modules サイズ: ...

## 2. bundle size 比較
| シナリオ | raw | gzip | 増加分（vs v0.4.0） |
|---|---|---|---|
| A. text-clean | ... | ... | ... |
| B. png-utils | ... | ... | ... |
| C. full | ... | ... | ... |
| v0.4.0 baseline | ... | ... | — |

## 3. tree-shaking 検証
（grep 結果テーブル）

## 4. SDK 互換性
- toolkit peer dep `@evenrealities/even_hub_sdk`: `>=...`
- `tsc --noEmit` 結果: PASS / FAIL（詳細）

## 5. peer dep 警告
（pnpm install 警告の全件）

## 6. 結論候補（事実のみ）
- 部分採用 OK の条件: ...
- フル採用 OK の条件: ...
- 採用 NG の条件: ...
```

---

## 同型バグ棚卸し

- `vite 5.x + TypeScript 5.7` で toolkit が ES module 解決失敗しないか
- toolkit の `exports` field が pnpm 10.x で正しく解決されるか
- `upng-js` が CommonJS 形式の場合の interop 問題

---

## 完了条件

- 各シナリオの bundle size 計測ログがコミット
- 報告書スケルトンが事実ベースで埋まる（判断は秘書）
- `tsc --noEmit` PASS
- **main ブランチに merge しない**（spike 専用ブランチで完結）

---

## やらないこと（明示）

- 「採用すべき / すべきでない」の結論を勝手に書く
- 既存 `src/main.ts` / `src/even/bridge.ts` に toolkit を導入する（本実装フェーズの仕事）
- 実機テスト（不要）

---

## 所要時間目安

dev-engineer 作業: **約 3h**（バッファ込み 4h）
秘書レビュー: 1h
旦那様判断: 0h（事実ベース報告のみ）

---

## 報告フォーマット

1. 同型バグ棚卸し結果
2. learning P1 反映チェック
3. `docs/v0.5/spike-results/s3-toolkit-build-report.md` を作成
4. `s3-pnpm-install.log` で警告全件提示
5. 結論候補（事実ベース）3 種

---

## 参照

- `docs/v0.5/spike-plan.md` Section S3
- `docs/v0.5/decision-log.md` (SSOT)
- https://github.com/fabioglimb/even-toolkit (toolkit 公式)
- `gh api repos/fabioglimb/even-toolkit/contents/package.json` で peer dep 確認
- `gh api repos/fabioglimb/even-toolkit/contents/glasses/png-utils.ts` で upng-js 依存確認
