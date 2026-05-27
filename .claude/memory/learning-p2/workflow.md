# learning P2 / workflow

オンデマンドで参照する作業フロー系のルール。

## ルール

- P2 | Agent Teams（TeamCreate + Agent with team_name）で複数 agent を並列実行したい場面 | `backendType: "in-process"` は idle 多発で実装系の重い作業に向かない。**`Agent` ツール直接呼び出し + `isolation: "worktree"` + `run_in_background: true`** が確実。チーム機能は軽い coordination 向け | Agent Teams で実装が進まずに時間を失う事故防止
  - 補足: 2026-05-27 v0.5-spike で Team `g2-v0.5-spike` を作って 3 teammate spawn したが、全 agent が idle 連発で実作業未着手。team config の `backendType: "in-process"` 確認、worktree も作られず（変更ゼロで auto-cleanup された可能性）。Team 解散 → Agent ツール直接呼び出しに切り替えて成功。in-process は idle reactive 性が強く実装には向かない

- P2 | 大規模実装を subagent に発注する場面 | **Codex を 4 ポイントで関与させる**: ①pre-impl (実装計画確認) ②post-impl (diff レビュー) ③debug (詰まり時相談) ④総合 (全 spike 完了後の整合性確認)。各 agent prompt に明示的に「`codex exec` で /tmp/codex-s{n}-pre.md / post.md に保存」と書く | 単独 agent の品質ぶれと見落とし防止
  - 補足: 2026-05-27 v0.5-spike S1/S3/S4 すべてで効果実証。S1 は pre 5 件 + post 1 件指摘採用、S3 は pre レビューで dispatch packet 誤記発見、S4 は 3 周クリアで 9 種類の同型バグ防御。総合 Codex レビューでも P0 5 件発見。learning P1#2「Codex 鵜呑み禁止」と相補で機能

- P2 | Codex CLI 経由で gpt-image-2 画像を生成する場面（旦那様向け説明画像 / spec 図 / 手描き風イラスト等）| `codex exec --skip-git-repo-check "プロンプト..."` で Codex 内蔵 `image_gen` ツールが gpt-image-2 を呼び `~/.codex/generated_images/<session-uuid>/ig_*.png` に保存される。プロンプトには (1) 参照画像 path (2) スタイル要件 (3) 構成詳細 (4) 出力ファイル名 を含める。生成後は指定ファイル名にコピー | 本社 image-gen.ts と同等方式で簡易生成可
  - 補足: 2026-05-28 manual-verify.html v2 用に手描き風イラスト 5 枚生成。fig-01 生成時に「クラフト紙 + 紺色鉛筆 + 眼鏡作業着キャラ」のスタイル指定が成功 → fig-02 以降は fig-01 を「参照画像」としてプロンプトに含めると完全に同スタイル統一できた。Codex は内蔵 image_gen を自動で使うので、プロンプトで「画像を生成して」と指示するだけで OK

- P2 | subagent (general-purpose) に Monitor で外部処理（codex exec / 長時間 cron 等）完了を待つタスクを発注する場面 | subagent 自体が Monitor の応答を待ち続けて context 圧迫 / 途中 exit する可能性あり。**short task に限定**（例: codex exec 1 回 + コピー 1 回）して発注。複数並列実行が必要なら親側で fan-out する | subagent 中途終了で成果物欠落する事故防止
  - 補足: 2026-05-28 画像生成 5 枚を 1 subagent に並列発注したら、Monitor 待機中に 1 枚目だけ完了した状態で subagent context が exit。残り 4 枚は親側で codex exec を直接呼んで完成。subagent の役割は「Codex 呼び出し + 結果コピー」のような short closure に限定するのが安全