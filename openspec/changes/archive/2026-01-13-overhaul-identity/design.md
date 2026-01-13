# Design: Identity System Overhaul

## Architecture

### Authentication Flow (認証フロー)

#### Registration (登録)
1.  **Request SMS**: ユーザーが電話番号を入力。クライアントが `SendSms(phone)` を呼び出す。
2.  **Verify SMS**: ユーザーがコードを入力。クライアントが `VerifySms(phone, code)` を呼び出す。サーバーは電話番号が検証されたことを証明する一時的な `verification_token` を返す。
3.  **Finish Registration**: ユーザーがパスワードを入力。クライアントが `Register(phone, password, verification_token)` を呼び出す。サーバーはユーザーを作成し、 `auth_token` + `UserProfile` を返す。

#### Login (ログイン)
1.  **Login**: ユーザーが電話番号とパスワードを入力。クライアントが `Login(phone, password)` を呼び出す。
2.  **Success**: サーバーがハッシュを検証し、 `auth_token` + `UserProfile` を返す。

### Database Schema (Monolith)
> **Note**: 既存の `users` テーブル関連は全て破棄し、ゼロベースで再構築します。

#### `users` table
- `id`: UUID (Primary Key)
- `phone_number`: String (Unique, Indexed, Nullable: false)
- `password_digest`: String (Bcrypt, Nullable: false)
- `role`: Integer/String (Default: Guest)
- `created_at`: Datetime
- `updated_at`: Datetime

#### `sms_verifications` table (Redis or SQL)
- `id`: UUID (Primary Key)
- `phone_number`: String (Indexed)
- `code`: String
- `expires_at`: Datetime
- `verified_at`: Datetime (Nullable, used to check if verified)
