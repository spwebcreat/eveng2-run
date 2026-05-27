# learning P2 / workflow

オンデマンドで参照する作業フロー系のルール。

## ルール

- P2 | Agent Teams（TeamCreate + Agent with team_name）で複数 agent を並列実行したい場面 | `backendType: "in-process"` は idle 多発で実装系の重い作業に向かない。**`Agent` ツール直接呼び出し + `isolation: "worktree"` + `run_in_background: true`** が確実。チーム機能は軽い coordination 向け | Agent Teams で実装が進まずに時間を失う事故防止
  - 補足: 2026-05-27 v0.5-spike で Team `g2-v0.5-spike` を作って 3 teammate spawn したが、全 agent が idle 連発で実作業未着手。team config の `backendType: "in-process"` 確認、worktree も作られず（変更ゼロで auto-cleanup された可能性）。Team 解散 → Agent ツール直接呼び出しに切り替えて成功。in-process は idle reactive 性が強く実装には向かない

- P2 | 大規模実装を subagent に発注する場面 | **Codex を 4 ポイントで関与させる**: ①pre-impl (実装計画確認) ②post-impl (diff レビュー) ③debug (詰まり時相談) ④総合 (全 spike 完了後の整合性確認)。各 agent prompt に明示的に「`codex exec` で /tmp/codex-s{n}-pre.md / post.md に保存」と書く | 単独 agent の品質ぶれと見落とし防止
  - 補足: 2026-05-27 v0.5-spike S1/S3/S4 すべてで効果実証。S1 は pre 5 件 + post 1 件指摘採用、S3 は pre レビューで dispatch packet 誤記発見、S4 は 3 周クリアで 9 種類の同型バグ防御。総合 Codex レビューでも P0 5 件発見。learning P1#2「Codex 鵜呑み禁止」と相補で機能