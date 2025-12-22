## MODIFIED Requirements
### Requirement: Protocol Support
Nginx Reverse Proxy は HTTP および HTTPS トラフィックを処理しなければならない（MUST）。

#### Scenario: HTTPS リクエスト
- **WHEN** ユーザーが HTTPS でリクエストを送信する
- **THEN** Nginx は TLS 終端を行い、バックエンドへ転送する
- **AND** 有効な証明書（または検証可能な証明書）を使用してハンドシェイクを完了する

#### Scenario: HTTP to HTTPS Redirect (Optional but Recommended)
- **WHEN** ユーザーが HTTP でリクエストを送信する
- **THEN** Nginx は HTTPS へ 301 リダイレクトを行う
