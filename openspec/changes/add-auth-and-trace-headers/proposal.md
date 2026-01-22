# Change: Add Auth and Trace Headers

## Why

既存の Identity と Portfolio 機能において、認証ヘッダーの送信が欠けている箇所があり、一貫性がない。
また、リクエストの追跡（トレーサビリティ）のためのトレース ID が実装されていない。

分散システムにおいて、リクエストを追跡可能にすることはデバッグと運用において必須である。

## What Changes

### Authentication Header

- フロントエンドの全 API 呼び出しで認証ヘッダー (`Authorization: Bearer {token}`) を一貫して送信
- 認証が必要なエンドポイントで欠けている箇所を修正

### Trace ID

- リクエストごとにユニークなトレース ID を生成・伝播
- FE → BFF → Backend のログで同一リクエストを追跡可能に
- ヘッダー名: `X-Request-ID` (OpenTelemetry/W3C 互換を検討)

## Impact

- Affected specs: `identity`
- Affected code:
  - `web/nyx/workspace/src/lib/grpc.ts` (トレース ID 生成・付与)
  - `web/nyx/workspace/src/app/api/**/*.ts` (認証ヘッダー・トレース ID 伝播)
  - `services/monolith/workspace/lib/interceptors/` (トレース ID ログ出力)
  - 認証ヘッダーが欠けているフロントエンドページ
