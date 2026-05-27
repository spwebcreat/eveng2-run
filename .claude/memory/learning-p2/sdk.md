# learning P2 / sdk

オンデマンドで参照する Even Hub SDK 関連の技術仕様。

## ルール

- P2 | G2 マイク PCM stream を扱う場面（v0.9 音声コマンド実装、STT 連携など）| **公式仕様**: 16,000 Hz / signed 16-bit little-endian / mono / **100 ms / event** / **3,200 bytes/event** ≈ 32,000 B/s ≈ 10 events/sec。`bridge.audioControl(true: boolean): Promise<boolean>` でマイク ON、`onEvenHubEvent` で `event.audioEvent?.audioPcm: Uint8Array` 受信。listener 内同期 callout は再入バグなので `queueMicrotask` で coalesce。cleanup は unsub → `audioControl(false)` の順。`permissions[].name` は `g2-microphone` (enum 固定) | v0.9 音声コマンド / on-device STT 設計時の即時参照
  - 補足: 2026-05-27 v0.5-spike S4 で SDK 仕様確認 + 実装 + 9 種類の同型バグ防御。`evenhub-simulator/README.md` L109-115 に公式仕様明記、SDK index.d.ts は L25 (`EvenAppMethod.AudioControl`) / L853 (`audioEvent`) / L858 コメント / L860-862 (`AudioEventPayload`) / L899 (`audioEvent?`) / L1183-1187 (`audioControl()`) に分散記載。Whisper-tiny で on-device STT も視野（16kHz/16-bit がそのまま使える）