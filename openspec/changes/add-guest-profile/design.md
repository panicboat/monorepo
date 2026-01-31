## Context

現在、ゲストユーザーは Identity ドメインで認証情報（`users` テーブル: id, phone_number, role）のみを持つ。キャストには充実したプロフィール機能（Portfolio ドメイン）があるが、ゲストには同等の機能がない。

本変更では、ゲストがキャストとコミュニケーションを取る際に必要な最低限のプロフィール情報（名前、アバター）を管理できるようにする。

**既存キャスト実装の参考ファイル:**
- Proto: `proto/portfolio/v1/service.proto`
- gRPC Handler: `slices/portfolio/grpc/handler.rb`
- UseCase: `slices/portfolio/use_cases/cast/`
- Repository: `slices/portfolio/repositories/cast_repository.rb`
- Frontend Hooks: `modules/portfolio/hooks/useCastData.ts`
- BFF: `app/api/cast/onboarding/`

## Goals / Non-Goals

### Goals

- ゲストが名前とアバターを設定できる
- オンボーディングフローで強制的に設定させる
- キャストがゲストを識別できるようにする（チャット、予約、CRM）
- キャストとゲストで共通化できる部分を共通コンポーネント/フックとして抽出

### Non-Goals

- ゲストの詳細プロフィール（年齢、性別、趣味等）の管理
- ゲストプロフィールの公開・検索機能
- ゲスト間のソーシャル機能

---

## Decisions

### Decision 1: Portfolio ドメインで管理

**What:** ゲストプロフィールは Portfolio ドメイン（`slices/portfolio`）で管理する。

**Why:**
- Cast と Guest の両方が「プロフィール」という概念を持つ
- 画像アップロード等の共通処理を再利用できる
- Identity はあくまで認証に特化させる

### Decision 2: GuestService を新規作成（CastService とは分離）

**What:** `proto/portfolio/v1/guest.proto` として新規サービスを定義する。

**Why:**
- CastService に Guest RPC を追加すると責務が混在する
- 将来的にマイクロサービス分割時に独立して切り出せる
- 命名が明確（GetGuestProfile vs GetCastProfile）

**Proto ファイル構成:**
```
proto/portfolio/v1/
├── service.proto   # CastService（既存）
└── guest.proto     # GuestService（新規）
```

### Decision 2.5: gRPC Handler の構成

**What:** Portfolio ドメインの gRPC Handler をサービス単位で分離し、大きくなったハンドラはアクションモジュールで整理する。

**Why:**
- 現在の `handler.rb` は CastService のみを扱っているが、約390行と肥大化
- GuestService 追加に伴い、責務を明確に分離する必要がある
- Gruf は1コントローラ = 1サービスの制約があるため、サービス内の分離はモジュールで行う

**Handler 構成（継承パターン）:**
```
slices/portfolio/grpc/
├── handler.rb              # 基底クラス（共通処理）
├── cast_handler.rb         # CastService（Handler を継承）
├── guest_handler.rb        # GuestService（Handler を継承）
└── cast/                   # CastHandler 用アクションモジュール（将来）
    ├── profile_actions.rb
    └── ...
```

**基底 Handler クラス:**
```ruby
# slices/portfolio/grpc/handler.rb
module Portfolio
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      include Portfolio::Deps[
        get_upload_url_uc: "use_cases.images.get_upload_url"
      ]

      protected

      # @param prefix [String] 'casts' or 'guests'
      def handle_upload_url(prefix:)
        authenticate_user!

        result = get_upload_url_uc.call(
          user_id: current_user_id,
          filename: request.message.filename,
          content_type: request.message.content_type,
          prefix: prefix
        )

        if result.success?
          data = result.value!
          ::Portfolio::V1::GetUploadUrlResponse.new(url: data[:url], key: data[:key])
        else
          fail!(:invalid_argument, "Invalid input")
        end
      end
    end
  end
end
```

**派生 Handler クラス:**
```ruby
# cast_handler.rb
class CastHandler < Handler
  self.service_name = "portfolio.v1.CastService"
  bind ::Portfolio::V1::CastService::Service
  # ...
  def get_upload_url
    handle_upload_url(prefix: "casts")
  end
end

# guest_handler.rb
class GuestHandler < Handler
  self.service_name = "portfolio.v1.GuestService"
  bind ::Portfolio::V1::GuestService::Service
  # ...
  def get_upload_url
    handle_upload_url(prefix: "guests")
  end
end
```

**Phase 1（本変更のスコープ）:**
1. 既存 `handler.rb` の共通処理を基底クラスとして抽出
2. CastService 固有のロジックを `cast_handler.rb` に移動
3. `guest_handler.rb` を新規作成（`Handler` を継承）

**Phase 2（将来、cast_handler が500行超になったら）:**
- アクションをモジュールに切り出し、`include Cast::ProfileActions` 等で取り込む

### Decision 3: フィールド名をキャストと統一

**What:** ゲストの表示名フィールドは `name` とする（`nickname` ではない）。

**Why:**
- キャストが `name` を使用しているため一貫性を保つ
- API 設計の統一性
- フロント側のマッピング処理を簡素化

### Decision 4: 画像アップロードは既存フローを再利用

**What:** キャストと同じアップロードフローを使用する。

**Upload Flow:**
```
1. POST /api/guest/upload-url
   → gRPC GetUploadUrl → Storage.upload_url()
   → { url, key } を返却

2. PUT {url}
   → ローカル: /storage/upload?key=xxx → public/uploads/
   → 本番: S3 presigned URL
```

**Reference:**
- `slices/portfolio/use_cases/cast/images/get_upload_url.rb`
- `lib/storage/local_adapter.rb`

### Decision 5: 汎用メディアアップローダーコンポーネント

**What:** キャストとゲストで共通の `SingleMediaUploader` コンポーネントを作成する。

**Why:**
- キャストはアバター、カバー画像/動画など複数の単一メディアアップロードが必要
- ゲストはアバターのみだが、同じ UX を提供
- 既存の `PhotoUploader` は実際に画像と動画の両方を扱うため、名前を実態に合わせる

**Component Hierarchy:**
```
components/shared/
├── MediaUploader.tsx     # 共通基盤（ドラッグ&ドロップ、プレビュー等）
├── AvatarUploader.tsx    # 単一メディア用（MediaUploader をラップ）
└── GalleryUploader.tsx   # 複数メディア用（既存 PhotoUploader を移動・リネーム）
```

`BottomNavBar` / `CastBottomNavBar` / `GuestBottomNavBar` と同様の構成パターン。

**Interface:**
```tsx
// 共通基盤
interface MediaUploaderProps {
  onUpload: (file: File) => Promise<{ key: string }>;
  accept?: string;              // 'image/*' | 'image/*,video/*'
  isDragging: boolean;
  onDragChange: (dragging: boolean) => void;
}

// 単一メディア用
interface AvatarUploaderProps {
  mediaUrl?: string;
  onUpload: (file: File) => Promise<{ key: string }>;
  onClear?: () => void;
  accept?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

// 複数メディア用（既存 PhotoUploader の置き換え）
interface GalleryUploaderProps {
  images: MediaItem[];
  onChange: (images: MediaItem[]) => void;
  onUpload: (file: File) => Promise<MediaItem | null>;
  minImages?: number;
}
```

**Current Implementation Reference:**
- `app/(cast)/cast/profile/page.tsx:172-213` - キャストアバター部分
- `modules/portfolio/components/cast/PhotoUploader.tsx` - 既存ギャラリー実装

### Decision 6: 汎用メディアアップロードフック

**What:** `lib/hooks/useMediaUpload.ts` として汎用アップロードフックを作成。

**Why:**
- `useCastImages` のアップロードロジックを共通化
- ゲストでも同じフローを使用
- 役割ごとに異なる API パスを渡すだけで動作

**Interface:**
```typescript
function useMediaUpload({
  uploadUrlPath: string,  // '/api/cast/onboarding/upload-url' or '/api/guest/upload-url'
  getToken: () => string | null,
}) {
  return {
    uploading: boolean,
    error: Error | null,
    uploadMedia: (file: File) => Promise<{ key: string, url: string }>,
  };
}
```

### Decision 7: ゲストプロフィールフック

**What:** `modules/portfolio/hooks/useGuestData.ts` を作成。`useCastData` のパターンを踏襲。

**Interface:**
```typescript
function useGuestData({
  apiPath?: string,  // default: '/api/guest/profile'
}) {
  return {
    profile: GuestProfile,
    avatarUrl: string,
    loading: boolean,
    error: Error | null,

    updateProfile: (updates: Partial<GuestProfile>) => void,
    saveProfile: () => Promise<void>,
    uploadAvatar: (file: File) => Promise<{ key: string }>,
  };
}

interface GuestProfile {
  name: string;
  avatarPath: string;
}
```

**SWR Pattern (Reference: useCastData):**
```typescript
const { data, error, isLoading, mutate } = useSWR<GuestProfileResponse>(
  token ? apiPath : null,
  fetcher,
  {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    shouldRetryOnError: (err) => (err as any).status !== 404,
  }
);
```

---

## Data Model

**`portfolio__guests` テーブル:**

```ruby
create_table :portfolio__guests do
  column :id, :uuid, default: Sequel.function(:gen_random_uuid), primary_key: true
  column :user_id, :uuid, null: false
  column :name, String, null: false        # キャストと同じフィールド名
  column :avatar_path, String              # S3/Local key
  column :created_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP
  column :updated_at, DateTime, null: false, default: Sequel::CURRENT_TIMESTAMP

  index :user_id, unique: true
end
```

**ER Diagram:**
```
┌─────────────────┐      ┌───────────────────────┐
│     users       │      │  portfolio__guests    │
│ (Identity)      │      │    (Portfolio)        │
├─────────────────┤      ├───────────────────────┤
│ id (PK)         │◄────►│ id (PK, UUID)         │
│ phone_number    │  1:1 │ user_id (FK, unique)  │
│ role            │      │ name                  │
└─────────────────┘      │ avatar_path           │
                         │ created_at            │
                         │ updated_at            │
                         └───────────────────────┘
```

---

## Proto Design

**`proto/portfolio/v1/guest.proto`:**

```protobuf
syntax = "proto3";

package portfolio.v1;

service GuestService {
  rpc GetGuestProfile(GetGuestProfileRequest) returns (GetGuestProfileResponse);
  rpc SaveGuestProfile(SaveGuestProfileRequest) returns (SaveGuestProfileResponse);
  rpc GetUploadUrl(GetUploadUrlRequest) returns (GetUploadUrlResponse);
}

message GuestProfile {
  string user_id = 1;
  string name = 2;              // キャストと同じフィールド名
  string avatar_path = 3;
  string avatar_url = 4;        // Read-only, download URL
}

message GetGuestProfileRequest {}  // user_id は認証情報から取得

message GetGuestProfileResponse {
  GuestProfile profile = 1;
}

message SaveGuestProfileRequest {
  string name = 1;
  string avatar_path = 2;
}

message SaveGuestProfileResponse {
  GuestProfile profile = 1;
}

// GetUploadUrl は CastService と同じメッセージを再利用可能
message GetUploadUrlRequest {
  string filename = 1;
  string content_type = 2;
}

message GetUploadUrlResponse {
  string url = 1;
  string key = 2;
}
```

---

## BFF Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/guest/profile` | GET | ゲストプロフィール取得 |
| `/api/guest/profile` | PUT | ゲストプロフィール保存（upsert） |
| `/api/guest/upload-url` | POST | アップロード URL 取得 |

**Implementation Pattern (Reference: /api/cast/onboarding/):**

```typescript
// /api/guest/profile/route.ts
export async function GET(req: NextRequest) {
  const headers = buildGrpcHeaders(req.headers);
  const response = await guestClient.getGuestProfile({}, { headers });
  return NextResponse.json({ profile: response.profile });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const headers = buildGrpcHeaders(req.headers);
  const response = await guestClient.saveGuestProfile(
    { name: body.name, avatarPath: body.avatarPath },
    { headers }
  );
  return NextResponse.json({ profile: response.profile });
}
```

---

## Backend Implementation

### gRPC Handler

**`slices/portfolio/grpc/guest_handler.rb`:**

```ruby
# frozen_string_literal: true

require "portfolio/v1/guest_services_pb"

module Portfolio
  module Grpc
    class GuestHandler < Handler  # 基底クラスを継承
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "portfolio.v1.GuestService"

      bind ::Portfolio::V1::GuestService::Service

      self.rpc_descs.clear

      rpc :GetGuestProfile, ::Portfolio::V1::GetGuestProfileRequest, ::Portfolio::V1::GetGuestProfileResponse
      rpc :SaveGuestProfile, ::Portfolio::V1::SaveGuestProfileRequest, ::Portfolio::V1::SaveGuestProfileResponse
      rpc :GetUploadUrl, ::Portfolio::V1::GetUploadUrlRequest, ::Portfolio::V1::GetUploadUrlResponse

      include Portfolio::Deps[
        get_profile_uc: "use_cases.guest.get_profile",
        save_profile_uc: "use_cases.guest.save_profile"
      ]

      def get_guest_profile
        authenticate_user!

        result = get_profile_uc.call(user_id: current_user_id)
        ::Portfolio::V1::GetGuestProfileResponse.new(
          profile: GuestPresenter.to_proto(result)
        )
      end

      def save_guest_profile
        authenticate_user!

        result = save_profile_uc.call(
          user_id: current_user_id,
          name: request.message.name,
          avatar_path: request.message.avatar_path
        )
        ::Portfolio::V1::SaveGuestProfileResponse.new(
          profile: GuestPresenter.to_proto(result)
        )
      end

      def get_upload_url
        handle_upload_url(prefix: "guests")
      end

      private

      GuestPresenter = Portfolio::Presenters::Guest::ProfilePresenter
    end
  end
end
```

**`slices/portfolio/presenters/guest/profile_presenter.rb`:**

```ruby
# frozen_string_literal: true

module Portfolio
  module Presenters
    module Guest
      class ProfilePresenter
        class << self
          def to_proto(guest)
            return empty_profile unless guest

            ::Portfolio::V1::GuestProfile.new(
              user_id: guest.user_id,
              name: guest.name || "",
              avatar_path: guest.avatar_path || "",
              avatar_url: avatar_url(guest.avatar_path)
            )
          end

          private

          def empty_profile
            ::Portfolio::V1::GuestProfile.new(
              user_id: "",
              name: "",
              avatar_path: "",
              avatar_url: ""
            )
          end

          def avatar_url(path)
            return "" if path.nil? || path.empty?
            Storage.download_url(path)
          end
        end
      end
    end
  end
end
```

### UseCase

**`slices/portfolio/use_cases/guest/save_profile.rb`:**

```ruby
module Portfolio
  module UseCases
    module Guest
      class SaveProfile
        include Deps['repositories.guest_repository']

        def call(user_id:, name:, avatar_path: nil)
          guest = guest_repository.find_by_user_id(user_id)

          attrs = {
            user_id: user_id,
            name: name,
            avatar_path: avatar_path,
            updated_at: Time.now
          }

          if guest
            guest_repository.update(guest.id, attrs)
          else
            guest_repository.create(attrs.merge(created_at: Time.now))
          end
        end
      end
    end
  end
end
```

### Repository

**`slices/portfolio/repositories/guest_repository.rb`:**

```ruby
module Portfolio
  module Repositories
    class GuestRepository < Portfolio::DB::Repository
      def find_by_user_id(user_id)
        guests.where(user_id: user_id).first
      end

      def create(attrs)
        guests.insert(attrs)
        find_by_user_id(attrs[:user_id])
      end

      def update(id, attrs)
        guests.where(id: id).update(attrs)
        guests.where(id: id).first
      end
    end
  end
end
```

---

## Frontend Flow

```
[ゲスト登録完了]
       ↓
[ログイン時にプロフィール存在チェック]
       ↓
  プロフィールなし?
       ↓ Yes
[/onboarding にリダイレクト]
       ↓
┌─────────────────────────┐
│     /onboarding         │
│                         │
│  ┌─────────────────┐    │
│  │ [Avatar]        │    │  ← SingleMediaUploader (shape="circle")
│  │                 │    │
│  │   Click to      │    │
│  │   Upload        │    │
│  └─────────────────┘    │
│                         │
│  Name: [____________]   │
│                         │
│     [Save & Continue]   │
└────────────┬────────────┘
             ↓
       [ホーム /]
```

**Onboarding Redirect Logic:**

```typescript
// middleware.ts または layout.tsx
const profile = await fetchGuestProfile();
if (!profile || !profile.name) {
  redirect('/onboarding');
}
```

---

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| オンボーディング離脱 | 入力項目を最小限に抑える（2項目のみ） |
| 画像未設定で進もうとする | バリデーションで必須チェック（ただしアバターはオプション可） |
| 既存ユーザーへの影響 | 既存ゲストは次回ログイン時にオンボーディングへ誘導 |
| Proto ファイル増加 | guest.proto は小規模なので許容範囲 |

---

## Migration Plan

1. Proto 定義追加 + ビルド
2. DB マイグレーション実行（`portfolio__guests` テーブル作成）
3. Backend 実装（UseCase, Repository, gRPC Handler）
4. 共通コンポーネント作成（`SingleMediaUploader`, `useMediaUpload`）
5. BFF エンドポイント作成
6. フロント実装（オンボーディングページ、hooks）
7. キャストのアバター部分を共通コンポーネントに置き換え

**Rollback:** フロントエンドのリダイレクトを無効化すれば、既存フローに戻せる。

---

## Open Questions

- [x] ゲストのニックネームは一意である必要があるか？ → 不要
- [x] アバター画像のデフォルト（未設定時）はどうするか？ → システムデフォルト画像を使用
- [x] フィールド名は `nickname` か `name` か？ → `name`（キャストと統一）
