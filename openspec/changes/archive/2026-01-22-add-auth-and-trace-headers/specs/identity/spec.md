# Identity Spec Delta

## ADDED Requirements

### Requirement: Request Tracing

システムは、リクエストごとにユニークなトレース ID を生成し、全レイヤーで伝播しなければならない (MUST)。

#### Scenario: Trace ID Generation

- **WHEN** クライアントが API リクエストを送信するとき
- **THEN** リクエストには `X-Request-ID` ヘッダーが含まれなければならない (MUST)
- **AND** 値は UUIDv4 形式である

#### Scenario: Trace ID Propagation

- **GIVEN** `X-Request-ID` ヘッダーを含むリクエストが
- **WHEN** BFF を経由して Backend に到達するとき
- **THEN** 同一の `X-Request-ID` が gRPC metadata として伝播される
- **AND** Backend のログに `X-Request-ID` が含まれる

#### Scenario: Trace ID in Response

- **WHEN** API がレスポンスを返すとき
- **THEN** レスポンスヘッダーに同一の `X-Request-ID` が含まれる

### Requirement: Consistent Authentication Header

認証が必要な全ての API リクエストは、一貫して認証ヘッダーを送信しなければならない (MUST)。

#### Scenario: Authenticated Request

- **GIVEN** ログイン済みのユーザーが
- **WHEN** 認証が必要な API を呼び出すとき
- **THEN** リクエストには `Authorization: Bearer {token}` ヘッダーが含まれる
- **AND** トークンが存在しない場合はログインページにリダイレクトされる

#### Scenario: Token Refresh on Expiry

- **GIVEN** アクセストークンが期限切れのとき
- **WHEN** API リクエストが 401 を返したとき
- **THEN** システムはリフレッシュトークンで新しいアクセストークンを取得する
- **AND** 元のリクエストを再試行する
