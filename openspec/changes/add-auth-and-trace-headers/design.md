# Design: Auth and Trace Headers

## Context

現在の実装では:
- 認証ヘッダーの送信が一部の API 呼び出しで欠けている
- リクエストの追跡手段がなく、デバッグが困難

## Goals / Non-Goals

### Goals

- 認証ヘッダーの一貫した送信
- リクエストごとのトレース ID 生成・伝播
- ログでのリクエスト追跡可能性

### Non-Goals

- OpenTelemetry の完全な導入（将来検討）
- 分散トレーシングサービス（Jaeger等）との統合

## Decisions

### Trace ID Header Name

**決定**: `X-Request-ID`

**理由**:
- 業界標準として広く使用されている
- Nginx, Kong, AWS ALB 等が自動生成・伝播をサポート
- OpenTelemetry への移行時も互換性を保てる

**代替案**:
- `X-Trace-ID`: 一般的だが、W3C Trace Context との混同リスク
- `X-Correlation-ID`: 意味は同じだが、`X-Request-ID` の方が普及

### Trace ID Format

**決定**: UUIDv4 (例: `550e8400-e29b-41d4-a716-446655440000`)

**理由**:
- 衝突確率が極めて低い
- 生成が容易（crypto.randomUUID）
- ログ検索で一意に識別可能

### Implementation Layers

```
┌─────────────────────────────────────────────────────────┐
│ Browser                                                  │
│  - Generate X-Request-ID if not present                  │
│  - Attach Authorization header                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Next.js API Routes (BFF)                                 │
│  - Forward X-Request-ID to gRPC metadata                 │
│  - Forward Authorization header                          │
│  - Log with X-Request-ID                                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Monolith (gRPC Server)                                   │
│  - Extract X-Request-ID from metadata                    │
│  - Set to Current context for logging                    │
│  - Log with X-Request-ID                                 │
└─────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

- **オーバーヘッド**: UUID 生成のコストは無視できるレベル
- **ログ量増加**: トレース ID 追加でログサイズが若干増加するが、デバッグ効率向上の方が重要

## Open Questions

- [ ] エラーレスポンスにも X-Request-ID を含めるか？ → 推奨
- [ ] クライアント生成の ID をそのまま信頼するか、サーバー側で再生成するか？ → クライアント生成を尊重、なければサーバー生成
