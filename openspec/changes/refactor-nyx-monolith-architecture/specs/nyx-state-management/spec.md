# nyx-state-management Spec Delta

## ADDED Requirements

### Requirement: State Management Pattern

フロントエンドは Zustand と SWR を組み合わせた統一的な状態管理パターンを採用しなければならない (MUST)。

| 状態タイプ | ツール | 用途 |
|-----------|--------|------|
| グローバル状態 | Zustand | 認証、UI状態、ローカル永続化 |
| サーバー状態 | SWR | リモートデータ取得、キャッシュ |
| フォーム状態 | useState / React Hook Form | ローカルコンポーネント内 |

#### Scenario: Global state with Zustand
- **GIVEN** 認証トークン、UI状態（モーダル、サイドバー）
- **WHEN** これらの状態を管理する
- **THEN** Zustand Store を使用する
- **AND** 永続化が必要な場合は `persist` ミドルウェアを使用する

#### Scenario: Server state with SWR
- **GIVEN** ユーザープロフィール、キャスト一覧などのサーバーデータ
- **WHEN** これらのデータを取得・キャッシュする
- **THEN** SWR を使用する
- **AND** Zustand Store にはサーバーデータを保持しない

### Requirement: Store Directory Structure

Zustand Store は `stores/` ディレクトリ（src直下）に配置しなければならない (MUST)。

#### Scenario: Store file locations
- **GIVEN** Zustand Store ファイル
- **WHEN** ファイルを配置する
- **THEN** `stores/` ディレクトリ（src直下）に配置される
- **AND** ファイル名は `*Store.ts` パターンに従う

#### Scenario: Store directory independence
- **GIVEN** stores/ ディレクトリ
- **WHEN** ディレクトリ構造を確認する
- **THEN** src直下に独立したディレクトリとして存在する
- **AND** lib/ の一部ではない

### Requirement: Token Management Separation

トークン操作ロジックは `lib/auth/` に分離しなければならない (MUST)。

#### Scenario: Token operation module
- **GIVEN** トークン操作（取得、保存、削除）
- **WHEN** これらの操作を実装する
- **THEN** `lib/auth/tokens.ts` に配置される
- **AND** stores/authStore.ts から呼び出される

#### Scenario: Token migration module
- **GIVEN** 旧トークンのマイグレーションロジック
- **WHEN** マイグレーションを実装する
- **THEN** `lib/auth/migration.ts` に配置される

#### Scenario: Auth module structure
- **GIVEN** lib/auth/ ディレクトリ
- **WHEN** 構造を確認する
- **THEN** 以下のファイルが存在する:
  - `tokens.ts` - トークン操作（get/set/clear）
  - `migration.ts` - 旧トークンのマイグレーション
  - `index.ts` - エクスポート

### Requirement: Auth Store

認証状態は `stores/authStore.ts` で一元管理しなければならない (MUST)。

#### Scenario: Token storage
- **GIVEN** ログイン成功時
- **WHEN** トークンを保存する
- **THEN** authStore の `setTokens()` を呼び出す
- **AND** accessToken, refreshToken, role, userId が Zustand Store に保存される
- **AND** localStorage に永続化される（persist ミドルウェア）

#### Scenario: Token retrieval
- **GIVEN** API リクエスト時
- **WHEN** アクセストークンが必要
- **THEN** authStore の `accessToken` を参照する
- **AND** localStorage を直接参照しない

#### Scenario: Role determination
- **GIVEN** 認証済みユーザー
- **WHEN** ユーザーの Role を判定する
- **THEN** authStore の `role` を参照する
- **AND** pathname から Role を推論しない

#### Scenario: Logout
- **GIVEN** ログアウト時
- **WHEN** セッションをクリアする
- **THEN** authStore の `clearTokens()` を呼び出す
- **AND** すべてのトークン情報がクリアされる

### Requirement: UI Store

グローバルUI状態は `stores/uiStore.ts` で管理しなければならない (MUST)。

#### Scenario: Modal state management
- **GIVEN** 複数のモーダルダイアログ
- **WHEN** モーダルの開閉を制御する
- **THEN** uiStore の `openModal()` / `closeModal()` を使用する
- **AND** 同時に1つのモーダルのみがアクティブ

#### Scenario: Sidebar state management
- **GIVEN** サイドバーの開閉状態
- **WHEN** サイドバーを制御する
- **THEN** uiStore の `openSidebar()` / `closeSidebar()` を使用する

### Requirement: Social Store

Social ドメインのローカル状態は `stores/socialStore.ts` で管理しなければならない (MUST)。

#### Scenario: Following state
- **GIVEN** フォロー機能
- **WHEN** フォロー状態を管理する
- **THEN** socialStore の `toggleFollow()` を使用する
- **AND** following リストが localStorage に永続化される

#### Scenario: Favorites state
- **GIVEN** お気に入り機能
- **WHEN** お気に入り状態を管理する
- **THEN** socialStore の `toggleFavorite()` を使用する
- **AND** favorites リストが localStorage に永続化される

### Requirement: Token Migration

既存の localStorage トークンから新しい authStore への移行をサポートしなければならない (MUST)。

#### Scenario: Migrate existing tokens
- **GIVEN** 旧形式のトークン（nyx_cast_access_token, nyx_guest_access_token）が localStorage に存在する
- **WHEN** アプリケーションが初期化される
- **THEN** `lib/auth/migration.ts` のマイグレーションロジックが実行される
- **AND** 旧トークンを読み取り、authStore に移行する
- **AND** 移行完了後、旧キーを削除してもよい (MAY)
