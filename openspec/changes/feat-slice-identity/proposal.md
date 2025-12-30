# Feature: Identity Slice Implementation

## Why (なぜ行うのか)
ユーザー登録、認証、ロール管理（Cast/Guest）はアプリケーションの根幹機能です。
Hanami の Slice 機能を使用して `Identity` ドメインを独立させ、堅牢な認証基盤を構築します。
バックエンドは gRPC インターフェースを提供し、BFF から利用可能にします。

## Technical Decisions (技術選定)
- **Database:** **PostgreSQL**
    - Hanami の標準であり、堅牢性と拡張性（JSONB等）から採用します。
- **ORM:** **ROM.rb (Ruby Object Mapper)**
    - Hanami デフォルト。ActiveRecord よりもドメインロジックと永続化層を分離しやすく、綺麗な設計を維持できるため。
- **Methods:**
    - **Password Hashing:** `bcrypt` (ソルト付きハッシュ化)
    - **Token:** `jwt` (Stateless Authentication)

## Architecture Discussion (アーキテクチャ論点)

### 1. DB Migration Strategy (将来の Go 移行)
- **現状:** Hanami 標準の `hanami db migrate` を使用します。
- **Go 移行時:**
    - マイクロサービスとして切り出す際（例: `Identity` を Go に書き換え）、そのサービスの DB スキーマ管理権限も移行します。
    - 移行時点でスキーマをダンプし、Go エコシステムのツール（`golang-migrate`, `sqldef`, `atlas` 等）にその時点の状態を引き継ぎます。
    - したがって、**現在のモノリス段階で Ruby のツールを使うことはロックインにはならず、将来の移行を阻害しません。**

### 4. Alternative: AWS Cognito (Impact Analysis)
もし **AWS Cognito** を ID プールとして採用した場合の影響:

#### Impact (Changes)
1.  **Responsibility Shift:**
    - パスワードハッシュ、JWT発行、アカウントリカバリー（再設定メール等）の責務が **Cognito** に移ります。
    - `Identity` Slice は「認証プロバイダ」ではなく「プロフィール管理 & トークン検証」に専念することになります。
2.  **Schema:**
    - `users` テーブルから `password_digest` が消え、代わりに `cognito_sub` (Subject ID) が主キー（またはユニークキー）となります。
    - 認証データ(AWS) と 業務データ(DB) が分断されるため、JOIN ができなくなります（アプリ層での結合が必要）。
3.  **Local Dev:**
    - ローカル開発時も AWS に接続するか、Cognito のモック（LocalStack等）が必要になり、開発環境の複雑性が増します。

#### Comparison
- **Custom (Postgres + bcrypt):**
    - **Pros:** シンプル、完全なデータコントロール、ローカル開発が容易、ベンダーロックインなし。
    - **Cons:** セキュリティ機能（MFA、ソーシャルログイン等）の自前実装コストが高い。

- **AWS Cognito:**
    - **Pros:** MFA/ソーシャルログインが容易、マネージドなセキュリティ。
    - **Cons:** **ベンダーロックイン**、ローカル開発の難易度増、データの分断。

#### Migration Path & Cost (将来移行する場合の大変さ)
Custom (DB) から Cognito へ移行する場合の最大の壁は **「パスワードの移行」** です。

1.  **User Friction (High):**
    - `bcrypt` でハッシュ化されたパスワードは復元不可能なため、Cognito にそのままインポートすることができません。
    - **移行時に全ユーザーに「パスワード再設定」を依頼する必要があります。** これが最大の UX コストです。
    - *Workaround:* 初回ログイン時にバックエンドで旧パスワードを検証し、裏で Cognito にアカウントを作成してパスワードを設定する「遅延移行（Lazy Migration）」スクリプトを書く手もありますが、実装コストは高いです。

2.  **Code Changes (Medium):**
    - `Login` / `Register` のロジックを DB 操作から AWS SDK 呼び出しに置き換える必要があります（約 2〜3日の作業）。
    - JWT の検証ロジックを「自前署名検証」から「Cognito JWKS 検証」に切り替える必要があります（ライブラリ変更レベル）。

3.  **Data Migration (Low):**
    - メールアドレス等のプロフィール情報は CSV インポート等で容易に移行可能です。

**結論:**
「パスワードリセットをユーザーにお願いする」ことが許容できるなら、移行は技術的には難しくありません。
それが許容できない（シームレスに移行したい）場合は、最初から Cognito を選ぶか、Lazy Migration の複雑な実装を覚悟する必要があります。

#### Recommended Decision
今回は「開発スピード」と「シンプルさ」を優先し、また将来のマイクロサービス化（Go移行）の際も実装をコントロールしやすい **Custom (Postgres)** 案を推奨します。MFA等が必須になった段階で Cognito/Auth0 への移行を検討します。

### 5. Future Isolation (Cognito 移行時の影響範囲)
**Q: Custom から Cognito へ切り替える際、修正は Identity Service だけで完結しますか？**
**A: はい、適切に設計すれば完結します。**

そのための設計方針（Strategy）:
1.  **Contract First:**
    - gRPC の `Register`, `Login` インターフェースを守る限り、裏側の実装が DB なのか Cognito なのかを BFF は知る必要がありません。
2.  **Auth Interceptor Pattern:**
    - 他の Slice（Portfolio等）での認証チェックには、Identity Slice が提供する共通の **Interceptor (Middleware)** を使用します。
    - 将来 Cognito に移行する際は、この Interceptor の中身（署名検証ロジック）を「Cognito 公開鍵を使う版」に差し替えるだけで、各 Slice のビジネスロジックには一切影響を与えません。

## What Changes (何を変更するのか)

#### A. Global Pattern (`app/grpc/handlers/identity_handler.rb`)
- **Merit:** gRPC が「アプリケーション全体の入口」として一箇所にまとまり、一覧性が高い。
- **Demerit:** ビジネスロジック (`slices/identity`) と インターフェース (`app/grpc`) が物理的に離れる。将来マイクロサービスとして切り出す際、2箇所からファイルを集める必要がある。

#### B. Slice Pattern (`slices/identity/grpc/handler.rb`) **(推奨)**
- **Structure:**
    ```text
    slices/identity/
    ├── repositories/       # User Repository
    ├── relations/          # Users Relation (DB Table)
    └── grpc/               # gRPC Handler (ここに配置)
        └── handler.rb      # class Identity::GRPC::Handler
    ```
- **Merit:** `Identity` の責務がこのディレクトリに完結しており、他を探す必要がない。`transport` 層を省くことで階層も浅く保てます。
- **Demerit:** `app/` 直下よりは少し深いですが、許容範囲内と考えます。

- **結論:** 将来のマイクロサービス化を見据え、**Slice パターン** を採用しつつ、階層は `slices/identity/grpc/` とシンプルにします。

### 3. Authentication & Authorization Mechanism
**Stateless JWT (JSON Web Token)** 方式を採用します。

1.  **Register/Login:**
    - クライアントが `Login(email, password)` をコール。
    - サーバーは `bcrypt` でハッシュ検証。
    - 成功時、`User ID` と `Role` をペイロードに含む **JWT** を署名（HMAC SHA256）して返す。
2.  **Access:**
    - クライアントは以降の全リクエストの Metadata (Header) に `Authorization: Bearer <token>` を付与。
    - サーバー（Interceptor）がトークンを検証し、`Current User` を特定する。
3.  **BFF の役割:**
    - 今回の BFF は **Gateway** 的な振る舞いをするため、トークンはブラウザ（Cookie/LocalStorage）ではなく、**BFF サーバーサイド（Session）** で管理し、ブラウザへは `Session ID` のみを返す（Secure, HttpOnly Cookie）のが最もセキュアです。
    - *Initial Phase:* 簡易化のため、まずは BFF が JWT をそのままブラウザに返し、ブラウザが保持する構成から開始しても良いですが、本番・セキュリティ要件に応じて BFF でのトークン隠蔽（Token Handler Pattern）に移行します。

## What Changes (何を変更するのか)
- **Monolith:** `slices/identity` の実装。
    - **Gemfile:** `pg`, `bcrypt`, `jwt` の追加。
    - **Proto:** `proto/identity/v1/service.proto` に `Login`, `Register` メソッドを追加。
    - **Action/Repository:** ユーザー情報の CRUD、パスワードハッシュ化 (bcrypt)。
    - **Token:** JWT 発行ロジック。
    - **gRPC Handler:** `lib/identity/handler.rb` の実装。
- **DB:** `users` テーブルのマイグレーション作成。

## Verification Plan (検証計画)
- `hanami db migrate`: マイグレーションの適用。
- `grpcurl` or `rpc-debug` (BFF Server Action): 登録・ログインの正常系動作確認。
