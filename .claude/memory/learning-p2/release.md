# learning P2 / release

オンデマンドで参照するリリース・パッケージング系のルール。

## ルール

- P2 | spike / 実験 branch で `pack:ehpk` を残すと spike app.json を本番ファイル名で pack してしまう誤爆リスクがある場面 | **spike branch では `pack:ehpk` を物理禁止に置換**: `"pack:ehpk": "echo 'ERROR: spike branch なので本番 pack は禁止。pack:s{n} を使ってください' && exit 1"`。`pack:s{n}` のみ使用可に。worktree merge 禁止コメントも README に追記 | spike branch から本番ファイル名で ehpk 誤爆する事故防止
  - 補足: 2026-05-27 v0.5-spike S4 が発明した防御パターン。S1 worktree では `pack:ehpk` が本番ファイル名 `g2-run-hud-0.4.0.ehpk` のまま残っており、spike app.json を指して pack すると本番名で出力される事故リスクが残った。S4 は最初から `exit 1` 物理禁止を実装。次セッションで S1 worktree にも同じ防御を入れる予定（P0-4 として記録済）