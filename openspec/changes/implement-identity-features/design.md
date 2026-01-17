# Design: Identity Enhancements

## Context
現在、認証には短命なアクセストークン（JWT）のみが使用されており、有効期限が切れるとユーザーは再ログインを強制されます。また、ログアウトはクライアント側でのトークン破棄のみに依存しており、サーバー側でセッションを無効化する手段がありません。さらに、ゲストログイン画面がルートパスに配置されており、将来的なLP配置やSEOの観点から分離が望ましい状態です。

## Refresh Token Strategy
- **Token Type**: Opaque string (Random hex) stored in DB.
- **Rotation**: リフレッシュトークン使用時に新しいリフレッシュトークンを発行する（Rotation Token Family）。
- **Storage**: `refresh_tokens` テーブルを作成し、`user_id`, `token_hash` (or raw if acceptable for now), `expires_at` を保存。
- **Revocation**: ログアウト時またはセキュリティイベント時に該当ユーザーのトークンレコードを削除または無効化フラグを立てる。

## Guest Login Path
- **Current**: `/` (Guest Home) checks auth, checks specific query params? No, just renders `LoginGate` if no user.
- **New**:
    - `/`: Check auth. If no user, Redirect to `/login`. If user, render Guest Home.
    - `/login`: Render `LoginGate`.
- **Consideration**: `LoginGate` component logic needs to be decoupled from "Home" logic.

## Security Considerations
- リフレッシュトークンはHttpOnly Cookieに保存すべきだが、現状のMobile App/SPA構成を鑑み、まずはLocalStorage + Autorization Header (Bearer) の既存フローを踏襲し、Bodyで返すか検討する。今回は既存のアクセストークン同様にレスポンスボディで返し、クライアント（JS）で保存するアプローチをとる（実装コストと現状の整合性優先）。
