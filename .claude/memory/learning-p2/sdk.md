# learning P2 / sdk

オンデマンドで参照する Even Hub SDK 関連の技術仕様。

## ルール

- P2 | G2 マイク PCM stream を扱う場面（v0.9 音声コマンド実装、STT 連携など）| **公式仕様**: 16,000 Hz / signed 16-bit little-endian / mono / **100 ms / event** / **3,200 bytes/event** ≈ 32,000 B/s ≈ 10 events/sec。`bridge.audioControl(true: boolean): Promise<boolean>` でマイク ON、`onEvenHubEvent` で `event.audioEvent?.audioPcm: Uint8Array` 受信。listener 内同期 callout は再入バグなので `queueMicrotask` で coalesce。cleanup は unsub → `audioControl(false)` の順。`permissions[].name` は `g2-microphone` (enum 固定) | v0.9 音声コマンド / on-device STT 設計時の即時参照
  - 補足: 2026-05-27 v0.5-spike S4 で SDK 仕様確認 + 実装 + 9 種類の同型バグ防御。`evenhub-simulator/README.md` L109-115 に公式仕様明記、SDK index.d.ts は L25 (`EvenAppMethod.AudioControl`) / L853 (`audioEvent`) / L858 コメント / L860-862 (`AudioEventPayload`) / L899 (`audioEvent?`) / L1183-1187 (`audioControl()`) に分散記載。Whisper-tiny で on-device STT も視野（16kHz/16-bit がそのまま使える）
  - 追補: 2026-05-28 旦那様実機 5 分計測で **n=2979 / 31,776 B/s** (理論値ど真ん中) / interval 平均 ~101ms / done (timeout) 完走を確認。SDK 仕様通りの安定 stream、production 採用可と判定

- P2 | Even Hub plugin を iPhone Safari Web Inspector でデバッグしようとする場面 | **Even Hub アプリの WKWebView は `WKPreferences.isInspectable = true` を opt-in していない**ため、iOS 16.4+ でも開発メニュー → iPhone → 該当アプリの選択肢に出ず「調査可能なアプリケーションがありません」になる。**spike / 本実装の設計時に iPhone Hub アプリ画面の DOM (`status` div 等) に主要メトリクスを継続表示する STATUS UI を必ず用意し、DevTools 依存を減らす** | DevTools 接続不可で旦那様の検証作業がブロックされる事故防止
  - 補足: 2026-05-28 spike S4 検証で旦那様が DevTools 接続できず詰まる。実は spike-s4 の status div に `MIC NNN B/s NNN ms ago | n=NN t=NNs` を継続表示する設計が入っており、それだけで avgBps / events 数 / interval 平均 / first event latency / stream 完走 すべて判定可能だった。manual-verify.html に「STATUS で代替判定」セクションを追加。これは Hub アプリ側の仕様改善要請事項として Even Realities への feedback 候補