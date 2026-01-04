# Proposal: Cast Service Implementation (Living Portfolio)

## Goal
「Living Portfolio」のコアコンセプトを実装する。
キャストが自身のプロフィールとリアルタイムステータス (Online/Tonight) を管理でき、ゲストがそれらを検索・閲覧できるようにする。

## Proposed Changes

### 1. Protocol Buffers (`proto/cast/v1`)
- **Service**: `CastService`
- **Models**:
  - `CastProfile`: `name`, `bio`, `image_url`, `status`
  - `CastPlan`: `id`, `name`, `price`, `duration_minutes`
  - `CastStatus` (Enum: OFFLINE, ASKING, ONLINE, TONIGHT)
- **RPCs**:
  - `CreateProfile(CreateProfileRequest) returns (CastProfile)`
     - `CreateProfileRequest`: `user_id` (optional/context), `name`, `bio`, `image_url`
  - `GetProfile(...) returns (GetProfileResponse)` (Profile + Plans)
  - `UpdateStatus(...) returns (CastStatus)`
  - `ListCasts(...) returns (ListCastsResponse)`

### 2. Monolith Implementation
- **Slice**: `slices/cast`
- **DB Schema**:
  - `cast.casts` テーブル: `user_id`, `name`, `bio`, `image_url`, `status`, `promise_rate`
    - **Note**: `user_id` は `identity.users` への外部キー。
  - `cast.cast_plans` テーブル: `cast_id`, `name`, `price` (Integer), `duration_minutes`
- **Services**:
  - `CreateProfile`: `CastRepository` を通じて `casts` レコードを作成。
    - 入力: `user_id`, `name`, `bio`, `plans` (Initial Plans)
  - `UpdateStatus`: ステータス更新。

### 3. Frontend Integration (`apps/shell`)
- **Cast Onboarding (`/cast/onboarding`)**:
  - `OnboardingWizard`: ウィザード完了時に `createProfileAction` を呼び出し、バックエンドにデータを送信する。
  - **Image Upload**: 今回はスコープ外とし、ランダムまたは固定のプレースホルダー画像を送信する。
  - **Redirect**: 作成成功後に `/cast/dashboard` へ遷移。
- **Cast Dashboard**:
  - **Redirect Logic**: プロフィール未作成（`GetProfile` が 404）の場合、`/cast/onboarding` へリダイレクトする。
  - **Initial Fetch**: ページロード時に `GetProfile` を呼び出し、現在のステータスとプランを初期表示に反映する。
  - **Status Toggle**: ステータス切替トグルを `UpdateStatus` RPC に接続する。
  - **Edit Profile**: プロフィール編集画面で「プラン（コース）」を追加・編集できるようにする。
- **Guest Home & Invitation**:
  - キャスト詳細取得時にプラン一覧も取得し、招待状ドロワー (`SmartInvitationDrawer`) に反映させる。

## Verification
- **Cast**: 登録 -> ダッシュボード -> ステータス切替 -> 永続化の確認。
- **Guest**: 登録 -> ホーム -> キャストの表示とステータスの確認。

## Limitations & Future TODOs
以下の機能はフロントエンドのモックに存在しますが、本実装（`feat-backend-cast`）のスコープ外とし、TODOとして残します。

- **[TODO] Image Upload**: オンボーディングでのアイコン画像アップロード（現在はプレースホルダー固定）。
- **[TODO] Tags/Appeal Points**: アピールタグの保存スキームとUI連携（現在は選択しても保存されない）。
- **[TODO] Real-time Dashboard Widgets**:
  - `Today's Promise`: 予約機能（Booking Service）未実装のためモック表示のまま。
  - `Recent Chats`: チャット機能（Chat Service）との連携未実装のためモック表示のまま。
  - `Notifications`: 通知機能未実装のためモック表示のまま。
