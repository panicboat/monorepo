# Login Flow (Frontend -> BFF -> Backend)

## Goal
安全で堅牢なログインメカニズムを実装します。

## Scope
- フロントエンドログインUI（Server Actions）。
- ログインリクエストをプロキシするBFF/アクション層。
- 資格情報の検証とトークン発行を行うIdentity Service（Backend）。
- Cookie管理（HttpOnly）とセッションハンドリング。
- 認証状態を検証するための `GetCurrentUser` RPC。
