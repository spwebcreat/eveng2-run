# Codex 相談 brief: v0.5-spike S1/S4 build 混入バグの修正レビュー

2026-05-27 / 旦那様の指示で Codex 第二意見を依頼。

## 目的

- 秘書 (Claude) が単独で実装計画を立てるのは不安なので、Codex に独立レビューを依頼。
- spike S1 / S4 の ehpk が「本番アプリの UI で起動する」事故が起きた。原因と修正方針を批判的にレビューしてほしい。
- 提案修正で本当に問題が解決するか、抜け漏れがないか、別の罠がないか、第二の視点で検証してほしい。

## 起きたこと（事実）

1. v0.5-spike S1 (`com.spwebcreat.g2runhud.spike.s1` / `version: 0.5.0`) を Hub Portal に「新規アプリ」として登録・アップロード
2. iPhone Hub アプリで該当 spike を起動
3. iPhone Hub アプリ画面・グラス（G2 ディスプレイ）どちらも **本番 v0.4.0 (`com.spwebcreat.g2runhud`) の UI** が表示される
4. spike S1 の 2×2 タイル image 表示は一切起きていない

## 根本原因（秘書の調査結果）

spike S1 worktree の `vite.config.ts`:

```ts
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),       // 本番 entry
        spikeS1: resolve(__dirname, 'spike-s1.html'), // spike entry
      },
    },
  },
})
```

両方ビルドされ、`dist/` に:

```
dist/
├── index.html         (本番 / main-*.js を import)
├── spike-s1.html      (spike / spikeS1-*.js を import)
└── assets/
    ├── index-*.js     (共通)
    ├── main-*.js      (本番 main.ts bundle)
    ├── main-*.css     (本番 CSS)
    └── spikeS1-*.js   (spike bundle)
```

`app.json` の `entrypoint: spike-s1.html` を指定しているが、Hub OS は **dist/index.html を優先起動** している（推定）。

S4 も同パターン。

## evenhub-cli の pack 実装確認

`node_modules/@evenrealities/evenhub-cli/main.js` の pack 関数 `Ow`:

```js
let z = hq($);  // app.json をパース
let J = z.value.entrypoint;
let U = VW.join(D, J);
if (!z5.existsSync(U)) { console.error(`Entrypoint file not found: ${U}`); return; }
n11($, VW.resolve(D), VW.resolve(X.output), X.ignore);
// n11 = create_ehpk (Rust wasm). app.json + dist/ 全体を ehpk に詰める
```

CLI は `entrypoint` 指定有無をチェックするだけで、dist/ 全体を ehpk に詰める。**Hub Portal 側で entrypoint 指定が無視され index.html が優先される挙動と推定**。

## 提案修正

### 方針 B: spike-sN.html を index.html にリネーム（本番 index.html を削除）

両 worktree (S1 / S4) で:

1. **本番 index.html を削除**
2. **spike-sN.html を index.html にリネーム**
3. **vite.config.ts を最小化**:
   ```ts
   export default defineConfig({
     server: { host: true, port: 5173 },
     build: { target: 'esnext' },
   })
   ```
   （input 指定なし → vite はデフォルトで `index.html` のみビルド）
4. **app.json 修正**:
   - S1: `entrypoint: "index.html"`, `version: "0.5.2"`
   - S4: `entrypoint: "index.html"`, `version: "0.5.3"`
5. **package.json 修正**: `pack:sN` 出力ファイル名を新 version に同期
6. **再 build → 再 pack** → spike-builds/ に新 ehpk
7. **dist/ 検証**: 本番 main-*.js が出力されていないことを確認

### 旦那様の作業

- Hub Portal の既存 spike S1 / S4 アプリ枠に **version 更新として** 新 ehpk をアップロード（同 package_id なので新規アプリ作成は不要）
- グラスで動作確認

## レビュー観点

Codex に以下を批判的に確認してほしい:

1. **方針 B が確実に問題を解決するか**: index.html リネームで Hub OS の entrypoint 解釈が正しくなるか
2. **別の見落とし**: spike-sN.html 内の `<script src="/assets/spikeS1-*.js">` 参照が rename 後も正しく解決されるか、css 等の import が壊れないか
3. **vite.config.ts 最小化の妥当性**: input 指定削除で typescript / lint chain が壊れないか
4. **app.json validator**: spike S1 を `0.5.0` → `0.5.2` のように飛ばす（`0.5.1` は S4 が使った）のは正常か
5. **Hub Portal cache 衝突**: 既に Hub Portal に上がっている spike S1 (0.5.0) と新 0.5.2 のキャッシュ問題
6. **代替方針**: 方針 B 以外に「`evenhub pack --ignore` で index.html 除外」「vite multi-build 維持で `clean dist + pack` フック」等の選択肢があるか、それらの pros/cons
7. **dispatch packet の root cause**: dispatch packet (`docs/v0.5/dispatch/s1-tiles.md`) で「本番 index.html を温存する」と書いた指示自体が間違いだった。今後の dispatch packet で何を必須項目に追加すべきか

## 参照ファイル

- 仕様: `docs/v0.5/dispatch/s1-tiles.md` / `docs/v0.5/dispatch/s4-mic-pcm.md`
- 実装: `.claude/worktrees/agent-a76eabf1014968b8f/` (S1) / `.claude/worktrees/agent-a51a4de47789f7530/` (S4)
- 既存 ehpk: `spike-builds/g2-run-hud-spike-s1-0.5.0.ehpk` (壊れている) / `g2-run-hud-spike-s4-0.5.1.ehpk` (同様に壊れているはず、未検証)
- learning P1: `.claude/rules/learning/core.md`

## 期待する出力

- 「方針 B で OK / 修正点あり / 別方針推奨」のどれか
- 見落としリスト
- 旦那様向け作業手順の改善案（特にどこを HTML で可視化すべきか）
