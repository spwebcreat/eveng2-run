# 発注: v0.5-spike S1 ─ 2×2 タイルで 576×288 image 実機表示検証

**発注先**: dev-engineer (本社経由)
**プロジェクト**: G2 Run HUD (`/Volumes/SP-STORAGE 1TB/company/Apps/EvenG2/even-g2-run`)
**ブランチ**: `feat/v0.5-spike/s1-tiles`
**発注日**: 2026-05-27
**並列発注**: S3 (toolkit ビルド検証) / S4 (G2 マイク PCM) と完全並列で着手可
**SSOT**: `docs/v0.5/decision-log.md`

---

## 目的

G2 image container の制約（max_count=4 / width≤288 / height≤144）下で、
**2×2 配置で 576×288 全画面を 1 枚絵として表示できるか**を実機で実証する。

S1 NO-GO だと v0.6 以降の画像 HUD 路線が全廃となるため、ロードマップ全体の **ブロッキング検証**。

---

## 必読: learning P1 ルール（`.claude/rules/learning/core.md` より）

1. **同型バグ棚卸し**: 修正パターンが他経路（mock / restore / cleanup）に潜在しないか着手前に棚卸ししてから修正開始。報告に「棚卸し結果」を明記
2. **Codex 指摘は実物検証**: SDK / API シグネチャ系の指摘は `node_modules/*.d.ts` で実物確認してから採否判定。鵜呑み禁止
3. **pack / publish 等 script 名衝突回避**: pnpm 組み込みコマンド名と衝突するため、`pack:ehpk` / `pack:s1` のような別名を必ず採用
4. **PNG/JPEG encoded bytes 必須**（★本タスクで特に重要）: `updateImageRawData` には PNG エンコード済み bytes（`OffscreenCanvas → convertToBlob → Uint8Array`）。生 4-bit gray packed bytes は不可
5. **textContainerUpgrade の空文字は前回値残る**: content='' は SDK が「変更なし」扱い、明示的にクリアしたい時は半角スペース `' '`
6. **isEventCapture: 1 は 1 個だけ**（★本タスクで特に重要）: 画面全体で 1 container のみ。複数指定で `createStartUpPageContainer` が validation エラー
7. **version bump 3 ファイル必須**: リリース時 `app.json` + `package.json` + `scripts.pack:*` の出力ファイル名 を必ず同期
8. **Hub Portal Description 更新**: リリース時に Description 欄も同時更新
9. **公式 docs SPA 取得不能時**: `gh api repos/<owner>/<repo>/contents/<path>` で実コード直接取得
10. **G2 長押し終了は OS レベル**: アプリ側で長押し捕捉 API は無い
11. **デザインガイド lightness 判定先行**: Even OS 2.0 公式 = ライト
12. **視覚確認できない参照素材は画像エクスポート依頼**

---

## 成果物

1. `src/even/png-encode.ts`（新規、約 60 行）
2. `src/even/image-bridge.ts`（新規、約 220 行）
3. `src/spike/s1-tiles.ts`（新規、約 120 行）
4. `spike-s1.html`（新規、最小 HTML）
5. `vite.config.ts` に spike entry 追加
6. `app.json` を spike 用に切替: **id を `com.spwebcreat.g2runhud.spike.s1` に変更**（本番 `com.spwebcreat.g2runhud` を絶対に汚さない）
7. `package.json` に `pack:s1` script 追加

---

## 実装詳細

### 1. `src/even/png-encode.ts`（約 60 行）

```ts
// OffscreenCanvas → 任意描画関数 → PNG Uint8Array
// imageSmoothingEnabled = false で 1bit/4-bit 風モノクロ
// learning P1 #4: PNG encoded bytes 必須
export async function encodeTilePng(
  width: number,
  height: number,
  draw: (ctx: OffscreenCanvasRenderingContext2D, w: number, h: number) => void
): Promise<Uint8Array> { ... }
```

### 2. `src/even/image-bridge.ts`（約 220 行）

- `attachG2HudImage(bridge, initialTiles)` を export
- `CreateStartUpPageContainer({ containerTotalNum: 5, imageObject: [tile00..tile11], textObject: [eventCapture] })`
- Container ID 配置（learning P1 #6 厳守）:
  - `imgTopLeft = 20`（x=0, y=0, w=288, h=144）
  - `imgTopRight = 21`（x=288, y=0, w=288, h=144）
  - `imgBotLeft = 22`（x=0, y=144, w=288, h=144）
  - `imgBotRight = 23`（x=288, y=144, w=288, h=144）
  - `textEvents = 10`（x=0, y=0, w=576, h=288, **isEventCapture=1**, content=`' '`, paddingLength=0）
- `renderTiles(tiles: Map<ContainerId, Uint8Array>)`:
  - 既存 `src/even/bridge.ts` と同じ Promise チェーン直列化 + `lastSent` dedup
  - PNG bytes の同一性比較: バイト長 + 先頭/末尾 16 byte の簡易比較（高速化）
- `updateImageRawData(new ImageRawDataUpdate({ containerID, containerName, imageData: bytes }))` 経由

### 3. `src/spike/s1-tiles.ts`（約 120 行）

3 種のテストパターンを各 5 秒ずつ自動切替:

- **A. 境界線パターン**: 各タイル外周に黒 1px 枠 + タイル中央に座標文字（`TL` `TR` `BL` `BR`）
- **B. 連続グラデーション**: 4 タイルを跨ぐ横方向グラデーション（黒→白→黒）
- **C. 大型タイポ**: タイル境界を跨ぐ巨大「12:34」テキスト（H=120px Courier New）

ログ出力: `[s1] tile sent containerID=20 bytes=NNNN ms=NN`（秘書が画面で見て判断できる粒度）

### 4. `spike-s1.html` + `vite.config.ts`

- 最小 HTML（status only）
- `vite build` で `dist/spike-s1.html` + `dist/spike-s1-*.js` 出力

### 5. `app.json` 切替（**本番を汚さない**）

| 項目 | spike S1 値 |
|---|---|
| id | `com.spwebcreat.g2runhud.spike.s1` |
| name | `G2 Run HUD Spike S1 (Tiles)` |
| version | `0.5.0-spike.s1` |
| entry | `spike-s1.html` |
| Hub Portal Description | "v0.5-spike S1: 2×2 タイルで 576×288 image 表示検証。本番版とは別アプリ。" |

### 6. `package.json` の `pack:s1`

```json
"pack:s1": "pnpm build && evenhub pack app.json dist -o g2-run-hud-spike-s1-0.5.0.ehpk"
```

---

## 同型バグ棚卸し（着手前に必須）

報告書に以下の確認結果を明記すること:

- 既存 `src/even/bridge.ts` の `lastSent` dedup / Promise チェーン直列化パターンを `image-bridge.ts` でも踏襲したか（並列 send で SDK 詰まりを防ぐ）
- F8 系（同期 onError 再入バグ）が image 経路に潜む可能性: `updateImageRawData` の戻り値が同期的に reject されるケースで sentinel が必要か
- W4 系 cleanup 順序: subscriptions clear → shutdown の順を守っているか

---

## 完了条件

- **シミュレータ**: 4 タイル描画ログが全件 success、`pnpm dev` + `?spike=s1` で起動成功
- **ビルド**: `pnpm pack:s1` で `g2-run-hud-spike-s1-0.5.0.ehpk` が正常出力
- **型安全**: `tsc --noEmit` でエラーなし
- **本番無汚染**: 既存 `src/even/bridge.ts` / `src/even/render.ts` / `src/main.ts` には一切手を入れていない
- 実機検証は秘書 + 旦那様が手動で実施するため、ログ出力（`[s1]` prefix）は秘書が画面で見て判断できる粒度にする

---

## やらないこと（明示）

- 実機検証手順の自動化（秘書が手動でやる）
- v0.4.0 の text container bridge への変更
- companion UI 側の DOM 変更
- v0.6 以降の image renderer 設計

---

## 所要時間目安

dev-engineer 作業: **約 5h**（バッファ込み 6.5h）
秘書レビュー: 2h
旦那様実機検証: 1h

---

## 報告フォーマット

完了時に以下を含む報告を返してください:

1. 同型バグ棚卸し結果（着手前確認）
2. learning P1 ルール反映チェック（12 項目どれを踏まえたか）
3. 成果物のファイル一覧 + 行数
4. シミュレータ起動ログ（`[s1]` prefix のサンプル）
5. 既知の制約 / 実機検証時の確認ポイント
6. 次タスク (S2 latency) への引き継ぎ事項

---

## 参照

- `docs/v0.5/spike-plan.md` (全体プラン)
- `docs/v0.5/decision-log.md` (SSOT)
- `node_modules/@evenrealities/even_hub_sdk/dist/index.d.ts`:392-395, :637-653 (image container PB 仕様)
- `.claude/rules/learning/core.md` (learning P1 ルール 12 項目)
- `src/even/bridge.ts` (text bridge 実装、image-bridge.ts の参考)
