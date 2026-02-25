# Review Media Attachment & Cast Reviews Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** レビューに画像/動画メディア添付（最大3件）を追加し、キャスト向けレビュー一覧ページ（`/cast/reviews`）を新設する。

**Architecture:** Post ドメインの確立された `post__post_media` パターン（中間テーブル + `media__files` へのソフト参照）を Trust ドメインに踏襲。フロントエンドは既存の `useMediaUpload` フック、`ReviewCard`、`InfiniteScroll` コンポーネントを再利用。

**Tech Stack:** Ruby/Hanami 2.x (Backend), Protocol Buffers (gRPC), Next.js App Router + React 19 (Frontend), PostgreSQL

---

## Task 1: Proto 定義の更新

**Files:**
- Modify: `proto/trust/v1/service.proto`

**Step 1: Proto にメディアメッセージを追加**

`service.proto` の Review メッセージ（L69-81）の後に `ReviewMedia` と `MediaInput` メッセージを追加し、`Review` と `CreateReviewRequest` にフィールドを追加:

```protobuf
// L69-81: Review メッセージに media フィールド追加
message Review {
  string id = 1;
  string reviewer_id = 2;
  string reviewee_id = 3;
  optional string content = 4;
  int32 score = 5;
  string status = 6;
  string created_at = 7;
  optional string reviewer_name = 8;
  optional string reviewer_avatar_url = 9;
  optional string reviewer_profile_id = 10;
  repeated ReviewMedia media = 11;
}

// 新規メッセージ（Review の直後に追加）
message ReviewMedia {
  string id = 1;
  string media_type = 2;
  string url = 3;
  string thumbnail_url = 4;
}

message MediaInput {
  string media_type = 1;
  string media_id = 2;
}
```

`CreateReviewRequest`（L90-94）に `media` フィールド追加:

```protobuf
message CreateReviewRequest {
  string reviewee_id = 1;
  optional string content = 2;
  int32 score = 3;
  repeated MediaInput media = 4;
}
```

**Step 2: Proto スタブを生成**

Run: `cd services/monolith/workspace && bin/codegen`
Expected: `stubs/trust/v1/service_pb.rb` と `service_services_pb.rb` が更新される

Run: `cd web/nyx/workspace && npx buf generate ../../../proto`
Expected: フロントエンド用の生成コードが更新される（ConnectRPC クライアント）

**Step 3: コミット**

```bash
git add proto/trust/v1/service.proto services/monolith/workspace/stubs/trust/ web/nyx/workspace/
git commit -m "feat(trust): add ReviewMedia and MediaInput proto messages"
```

---

## Task 2: DB マイグレーション — `trust__review_media` テーブル作成

**Files:**
- Create: `services/monolith/workspace/config/db/migrate/20260225000001_create_trust_review_media.rb`

**Step 1: マイグレーションファイル作成**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"trust__review_media" do
      column :id, :uuid, default: Sequel.lit("gen_random_uuid()"), null: false
      column :review_id, :uuid, null: false
      column :media_id, :uuid
      column :media_type, :varchar, size: 10, null: false
      column :position, :integer, null: false, default: 0
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]

      index :review_id
      index :media_id
      foreign_key [:review_id], :"trust__reviews", on_delete: :cascade
    end
  end

  down do
    drop_table :"trust__review_media"
  end
end
```

**Step 2: マイグレーション実行**

Run: `cd services/monolith/workspace && bundle exec hanami db migrate`
Expected: `trust__review_media` テーブルが作成される

**Step 3: コミット**

```bash
git add services/monolith/workspace/config/db/migrate/20260225000001_create_trust_review_media.rb services/monolith/workspace/config/db/structure.sql
git commit -m "feat(trust): add trust__review_media table"
```

---

## Task 3: Relation — `Trust::Relations::ReviewMedia`

**Files:**
- Create: `services/monolith/workspace/slices/trust/relations/review_media.rb`
- Modify: `services/monolith/workspace/slices/trust/relations/reviews.rb`

**Step 1: ReviewMedia relation 作成**

```ruby
# frozen_string_literal: true

module Trust
  module Relations
    class ReviewMedia < Trust::DB::Relation
      schema(:"trust__review_media", as: :review_media, infer: false) do
        attribute :id, Types::String
        attribute :review_id, Types::String
        attribute :media_id, Types::String.optional
        attribute :media_type, Types::String
        attribute :position, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :reviews, foreign_key: :review_id
        end
      end
    end
  end
end
```

**Step 2: Reviews relation に association 追加**

`reviews.rb` の schema ブロック内（L6-17）に associations を追加:

```ruby
schema(:"trust__reviews", as: :reviews, infer: false) do
  attribute :id, Types::String
  attribute :reviewer_id, Types::String
  attribute :reviewee_id, Types::String
  attribute :content, Types::String.optional
  attribute :score, Types::Integer
  attribute :status, Types::String
  attribute :created_at, Types::Time
  attribute :updated_at, Types::Time

  primary_key :id

  associations do
    has_many :review_media
  end
end
```

**Step 3: コミット**

```bash
git add services/monolith/workspace/slices/trust/relations/review_media.rb services/monolith/workspace/slices/trust/relations/reviews.rb
git commit -m "feat(trust): add ReviewMedia relation with Reviews association"
```

---

## Task 4: Repository — メディア保存・読込メソッド追加

**Files:**
- Modify: `services/monolith/workspace/slices/trust/repositories/review_repository.rb`

**Step 1: `save_media` メソッド追加**

`ReviewRepository` クラス内（`private` キーワードの直前、L179 付近）に以下を追加:

```ruby
def save_media(review_id:, media_data:)
  review_media.dataset.where(review_id: review_id).delete
  media_data.each_with_index do |media, index|
    review_media.changeset(:create, media.merge(review_id: review_id, position: index)).commit
  end
end

def delete_media(review_id:)
  review_media.dataset.where(review_id: review_id).delete
end

def find_media_by_review_ids(review_ids)
  return {} if review_ids.empty?

  records = review_media.where(review_id: review_ids).order(:review_id, :position).to_a
  records.group_by(&:review_id)
end
```

**Step 2: `find_by_id` メソッドにメディア結合を追加**

既存の `find_by_id`（L32-34）を更新:

```ruby
def find_by_id(id)
  reviews.combine(:review_media).where(id: id).one
end
```

**Step 3: `delete` メソッドを確認 — FK CASCADE のため変更不要**

`trust__review_media` に `on_delete: :cascade` があるため、review 削除時に自動削除される。変更不要。

**Step 4: コミット**

```bash
git add services/monolith/workspace/slices/trust/repositories/review_repository.rb
git commit -m "feat(trust): add media save/load methods to ReviewRepository"
```

---

## Task 5: Use Case — `CreateReview` にメディア保存を追加

**Files:**
- Modify: `services/monolith/workspace/slices/trust/use_cases/reviews/create_review.rb`

**Step 1: media パラメータ追加と保存ロジック**

`create_review.rb` 全体を更新:

```ruby
# frozen_string_literal: true

module Trust
  module UseCases
    module Reviews
      class CreateReview
        MAX_MEDIA = 3

        include Trust::Deps[
          review_repo: "repositories.review_repository"
        ]

        def call(reviewer_id:, reviewee_id:, content:, score:, is_cast_reviewer:, media: [])
          content = content&.strip
          content = nil if content&.empty?

          # Cast → Guest: always approved, content optional
          # Guest → Cast: pending, content required
          status = is_cast_reviewer ? "approved" : "pending"

          if !is_cast_reviewer && content.nil?
            return { success: false, error: :content_required }
          end

          if media.size > MAX_MEDIA
            return { success: false, error: :too_many_media }
          end

          result = review_repo.create(
            reviewer_id: reviewer_id,
            reviewee_id: reviewee_id,
            content: content,
            score: score,
            status: status
          )

          if result[:success] && media.any?
            review_repo.save_media(review_id: result[:id], media_data: media)
          end

          result
        end
      end
    end
  end
end
```

**Step 2: コミット**

```bash
git add services/monolith/workspace/slices/trust/use_cases/reviews/create_review.rb
git commit -m "feat(trust): add media support to CreateReview use case"
```

---

## Task 6: Handler — メディアの読込・エンリッチ・作成対応

**Files:**
- Modify: `services/monolith/workspace/slices/trust/grpc/trust_handler.rb`

**Step 1: `create_review` メソッドにメディア入力追加**

`create_review`（L109-130）を更新 — media パラメータ追加:

```ruby
def create_review
  authenticate_user!

  score = request.message.score
  if score < 1 || score > 5
    raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Score must be between 1 and 5")
  end

  media_data = request.message.media.map do |m|
    { media_id: m.media_id, media_type: m.media_type }
  end

  result = create_review_uc.call(
    reviewer_id: current_user_id,
    reviewee_id: request.message.reviewee_id,
    content: request.message.content.to_s.empty? ? nil : request.message.content,
    score: score,
    is_cast_reviewer: !!find_my_cast,
    media: media_data
  )

  if result[:error] == :already_reviewed
    raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::ALREADY_EXISTS, "Review already exists")
  end

  if result[:error] == :too_many_media
    raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Maximum 3 media files allowed")
  end

  ::Trust::V1::CreateReviewResponse.new(success: result[:success], id: result[:id] || "")
end
```

**Step 2: `load_media_files_for_reviews` ヘルパーメソッド追加**

`private` セクション（L304）の中に追加:

```ruby
def load_review_media(reviews)
  review_ids = reviews.map do |r|
    r.respond_to?(:id) ? r.id : r[:id]
  end.compact.uniq

  return {} if review_ids.empty?

  review_repo.find_media_by_review_ids(review_ids)
end

def load_media_files_for_review_media(review_media_by_review_id)
  media_ids = review_media_by_review_id.values.flatten.filter_map(&:media_id).uniq
  return {} if media_ids.empty?

  media_adapter.find_by_ids(media_ids)
end

def build_review_media_proto(review_media_list, media_files)
  (review_media_list || []).sort_by(&:position).map do |rm|
    media_file = media_files[rm.media_id]
    ::Trust::V1::ReviewMedia.new(
      id: rm.id.to_s,
      media_type: rm.media_type,
      # FALLBACK: Empty string when media file is not yet uploaded or was deleted
      url: media_file&.url || "",
      thumbnail_url: media_file&.thumbnail_url || ""
    )
  end
end
```

**Step 3: `build_review_proto` にメディアパラメータ追加**

`build_review_proto`（L306-328）を更新:

```ruby
def build_review_proto(review, reviewer_name: nil, reviewer_avatar_url: nil, reviewer_profile_id: nil, media: [])
  id = review.respond_to?(:id) ? review.id : review[:id]
  reviewer_id = review.respond_to?(:reviewer_id) ? review.reviewer_id : review[:reviewer_id]
  reviewee_id = review.respond_to?(:reviewee_id) ? review.reviewee_id : review[:reviewee_id]
  content = review.respond_to?(:content) ? review.content : review[:content]
  score = review.respond_to?(:score) ? review.score : review[:score]
  status = review.respond_to?(:status) ? review.status : review[:status]
  created_at = review.respond_to?(:created_at) ? review.created_at : review[:created_at]

  ::Trust::V1::Review.new(
    id: id,
    reviewer_id: reviewer_id,
    reviewee_id: reviewee_id,
    content: content || "",
    score: score,
    status: status,
    created_at: format_time(created_at),
    reviewer_name: reviewer_name,
    reviewer_avatar_url: reviewer_avatar_url,
    reviewer_profile_id: reviewer_profile_id,
    media: media
  )
end
```

**Step 4: `list_reviews` にメディア読込追加**

`list_reviews`（L168-216）を更新 — レビュー取得後にメディアを読み込んでエンリッチ:

```ruby
def list_reviews
  reviewee_id = request.message.reviewee_id.to_s.empty? ? nil : request.message.reviewee_id
  reviewer_id = request.message.reviewer_id.to_s.empty? ? nil : request.message.reviewer_id
  status = request.message.status.to_s.empty? ? nil : request.message.status
  limit = request.message.limit.to_i
  limit = nil if limit <= 0
  cursor = request.message.cursor.to_s.empty? ? nil : request.message.cursor

  result = if reviewer_id
    review_repo.list_by_reviewer_paginated(reviewer_id: reviewer_id, status: status, limit: limit, cursor: cursor)
  elsif reviewee_id
    list_reviews_uc.call(reviewee_id: reviewee_id, status: status, limit: limit, cursor: cursor)
  else
    raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "reviewee_id or reviewer_id is required")
  end

  reviews = result[:items]

  # Collect reviewer IDs
  reviewer_ids = reviews.map do |r|
    r.respond_to?(:reviewer_id) ? r.reviewer_id : r[:reviewer_id]
  end.compact.uniq

  # Fetch guest profiles by user IDs
  guests_by_user_id = guest_adapter.find_by_user_ids(reviewer_ids)

  # Fetch avatar media for guests
  avatar_media_ids = guests_by_user_id.values.map(&:avatar_media_id).compact
  avatar_media_files = media_adapter.find_by_ids(avatar_media_ids)

  # Fetch review media
  review_media_by_review_id = load_review_media(reviews)
  review_media_files = load_media_files_for_review_media(review_media_by_review_id)

  items = reviews.map do |r|
    rid = r.respond_to?(:reviewer_id) ? r.reviewer_id : r[:reviewer_id]
    review_id = r.respond_to?(:id) ? r.id : r[:id]
    guest = guests_by_user_id[rid]
    avatar_url = guest&.avatar_media_id ? avatar_media_files[guest.avatar_media_id]&.url : nil

    media_proto = build_review_media_proto(
      review_media_by_review_id[review_id],
      review_media_files
    )

    build_review_proto(
      r,
      reviewer_name: guest&.name,
      reviewer_avatar_url: avatar_url,
      reviewer_profile_id: guest&.id,
      media: media_proto
    )
  end

  ::Trust::V1::ListReviewsResponse.new(
    reviews: items,
    next_cursor: result[:next_cursor] || "",
    has_more: result[:has_more] || false
  )
end
```

**Step 5: `list_pending_reviews` にも同様のメディア読込追加**

`list_pending_reviews`（L270-302）を同様に更新:

```ruby
def list_pending_reviews
  authenticate_user!
  my_cast = authenticate_cast!

  reviews = list_pending_reviews_uc.call(reviewee_id: my_cast.id)

  # Collect reviewer IDs
  reviewer_ids = reviews.map do |r|
    r.respond_to?(:reviewer_id) ? r.reviewer_id : r[:reviewer_id]
  end.compact.uniq

  # Fetch guest profiles by user IDs
  guests_by_user_id = guest_adapter.find_by_user_ids(reviewer_ids)

  # Fetch avatar media for guests
  avatar_media_ids = guests_by_user_id.values.map(&:avatar_media_id).compact
  avatar_media_files = media_adapter.find_by_ids(avatar_media_ids)

  # Fetch review media
  review_media_by_review_id = load_review_media(reviews)
  review_media_files = load_media_files_for_review_media(review_media_by_review_id)

  items = reviews.map do |r|
    rid = r.respond_to?(:reviewer_id) ? r.reviewer_id : r[:reviewer_id]
    review_id = r.respond_to?(:id) ? r.id : r[:id]
    guest = guests_by_user_id[rid]
    avatar_url = guest&.avatar_media_id ? avatar_media_files[guest.avatar_media_id]&.url : nil

    media_proto = build_review_media_proto(
      review_media_by_review_id[review_id],
      review_media_files
    )

    build_review_proto(
      r,
      reviewer_name: guest&.name,
      reviewer_avatar_url: avatar_url,
      reviewer_profile_id: guest&.id,
      media: media_proto
    )
  end

  ::Trust::V1::ListPendingReviewsResponse.new(reviews: items)
end
```

**Step 6: コミット**

```bash
git add services/monolith/workspace/slices/trust/grpc/trust_handler.rb
git commit -m "feat(trust): add media loading and enrichment to review handler"
```

---

## Task 7: シードデータにレビューメディア追加

**Files:**
- Modify: `services/monolith/workspace/config/db/seeds/trust_reviews.rb`

**Step 1: レビューメディアのシードを追加**

`trust_reviews.rb` の `db[:trust__reviews].multi_insert(reviews_data)` の後にメディアシードを追加:

```ruby
# Seed review media for some reviews (first 3 reviews get media)
review_media_data = []
reviews_data.first(3).each_with_index do |review, i|
  (0..[0, 1, 2].sample).each do |pos|
    review_media_data << {
      id: SecureRandom.uuid,
      review_id: review[:id],
      media_id: nil,
      media_type: pos.zero? ? "image" : %w[image video].sample,
      position: pos,
      created_at: review[:created_at]
    }
  end
end

db[:trust__review_media].multi_insert(review_media_data) if review_media_data.any?
puts "  Created #{review_media_data.size} trust review media entries"
```

**Step 2: コミット**

```bash
git add services/monolith/workspace/config/db/seeds/trust_reviews.rb
git commit -m "feat(trust): add review media seed data"
```

---

## Task 8: フロントエンド型定義の更新

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/types.ts`
- Modify: `web/nyx/workspace/src/modules/trust/lib/api-mappers.ts`

**Step 1: `Review` と `CreateReviewRequest` にメディアフィールド追加**

`types.ts` を更新:

```typescript
import type { Media, SaveMediaInput } from "@/lib/types";

export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  content?: string;
  score: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewerName?: string;
  reviewerAvatarUrl?: string;
  reviewerProfileId?: string;
  media?: Media[];
}

export interface CreateReviewRequest {
  revieweeId: string;
  content?: string;
  score: number;
  media?: SaveMediaInput[];
}
```

他のインターフェースはそのまま。

**Step 2: `api-mappers.ts` のマッパー更新**

`ProtoReview` インターフェースと `mapProtoReviewToJson` を更新:

```typescript
interface ProtoReviewMedia {
  id: string;
  mediaType: string;
  url: string;
  thumbnailUrl?: string;
}

interface ProtoReview {
  id: string;
  reviewerId: string;
  revieweeId: string;
  content?: string;
  score: number;
  status: string;
  createdAt: string;
  reviewerName?: string;
  reviewerAvatarUrl?: string;
  reviewerProfileId?: string;
  media?: ProtoReviewMedia[];
}

export function mapProtoReviewToJson(review: ProtoReview) {
  return {
    id: review.id,
    reviewerId: review.reviewerId,
    revieweeId: review.revieweeId,
    content: review.content,
    score: review.score,
    status: review.status,
    createdAt: review.createdAt,
    reviewerName: review.reviewerName,
    reviewerAvatarUrl: review.reviewerAvatarUrl,
    reviewerProfileId: review.reviewerProfileId,
    media: (review.media || []).map((m) => ({
      id: m.id,
      mediaType: m.mediaType as "image" | "video",
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
    })),
  };
}
```

**Step 3: コミット**

```bash
git add web/nyx/workspace/src/modules/trust/types.ts web/nyx/workspace/src/modules/trust/lib/api-mappers.ts
git commit -m "feat(trust): add media fields to frontend Review types and mappers"
```

---

## Task 9: API Route — レビュー作成時のメディアデータ送信

**Files:**
- Modify: `web/nyx/workspace/src/app/api/me/trust/reviews/route.ts`

**Step 1: POST ハンドラにメディアデータを追加**

```typescript
export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const { revieweeId, content, score, media } = await req.json();
    if (!revieweeId || score === undefined) {
      return NextResponse.json(
        { error: "revieweeId and score are required" },
        { status: 400 }
      );
    }

    const response = await trustClient.createReview(
      {
        revieweeId,
        content,
        score,
        media: (media || []).map((m: { mediaType: string; mediaId: string }) => ({
          mediaType: m.mediaType,
          mediaId: m.mediaId,
        })),
      },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json({ success: response.success, id: response.id });
  } catch (error: unknown) {
    if (isConnectError(error) && error.code === GrpcCode.INVALID_ARGUMENT) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return handleApiError(error, "CreateReview");
  }
}
```

**Step 2: コミット**

```bash
git add web/nyx/workspace/src/app/api/me/trust/reviews/route.ts
git commit -m "feat(trust): pass media data in CreateReview API route"
```

---

## Task 10: フロントエンド — `useReviews` フックにメディア送信対応

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/hooks/useReviews.ts`

**Step 1: `createReview` にメディアパラメータを追加**

`useReviews.ts` は既に `CreateReviewRequest` 型を使用しているため、型定義の更新（Task 8）で自動的にメディアが送信可能になる。フック自体は変更不要（`request` オブジェクトをそのまま POST するため）。

確認のみ。変更不要。

---

## Task 11: フロントエンド — `WriteReviewModal` にメディアアップロード追加

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/components/WriteReviewModal.tsx`

**Step 1: メディアアップロード機能を追加**

```typescript
"use client";

import { useState } from "react";
import { Star, Loader2, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useMediaUpload } from "@/modules/media/hooks/useMediaUpload";
import type { UploadedMedia } from "@/modules/media/types";
import type { SaveMediaInput } from "@/lib/types";

const MAX_MEDIA = 3;

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (score: number, content: string, media: SaveMediaInput[]) => Promise<void>;
  castName?: string;
}

export function WriteReviewModal({
  isOpen,
  onClose,
  onSubmit,
  castName = "キャスト",
}: WriteReviewModalProps) {
  const { toast } = useToast();
  const { uploadMedia, registerMedia, uploading } = useMediaUpload();
  const [score, setScore] = useState(5);
  const [content, setContent] = useState("");
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_MEDIA - uploadedMedia.length;
    const filesToUpload = Array.from(files).slice(0, remaining);

    for (const file of filesToUpload) {
      try {
        const uploaded = await uploadMedia(file);
        await registerMedia(uploaded);
        setUploadedMedia((prev) => [...prev, uploaded]);
      } catch {
        toast({
          title: "アップロードに失敗しました",
          variant: "destructive",
        });
      }
    }
    // Reset input
    e.target.value = "";
  };

  const handleRemoveMedia = (index: number) => {
    setUploadedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: "レビュー内容を入力してください",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const mediaInput: SaveMediaInput[] = uploadedMedia.map((m) => ({
        mediaType: m.mediaType,
        mediaId: m.mediaId,
      }));
      await onSubmit(score, content.trim(), mediaInput);
      toast({
        title: "レビューを送信しました",
        description: "承認後に公開されます",
        variant: "success",
      });
      setContent("");
      setScore(5);
      setUploadedMedia([]);
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "送信に失敗しました";
      toast({
        title: "エラー",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const displayScore = hoveredStar ?? score;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md mx-4 bg-bg-primary rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border-primary bg-bg-primary">
          <h2 className="text-lg font-semibold text-text-primary">
            {castName}にレビューを書く
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-bg-secondary transition-colors"
          >
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              評価
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setScore(i)}
                  onMouseEnter={() => setHoveredStar(i)}
                  onMouseLeave={() => setHoveredStar(null)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      i <= displayScore
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-bg-tertiary"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-text-muted">{score}/5</span>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              レビュー内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="サービスについてのご感想をお聞かせください"
              className="w-full h-32 px-3 py-2 text-sm border border-border-primary rounded-lg bg-bg-secondary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
            />
            <p className="text-xs text-text-muted">
              レビューは承認後に公開されます
            </p>
          </div>

          {/* Media Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              写真・動画（{uploadedMedia.length}/{MAX_MEDIA}）
            </label>

            {/* Preview Grid */}
            {uploadedMedia.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {uploadedMedia.map((media, index) => (
                  <div key={media.mediaId} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border-primary">
                    {media.mediaType === "image" ? (
                      <img src={media.localUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={media.localUrl} className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(index)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadedMedia.length < MAX_MEDIA && (
              <label className="inline-flex items-center gap-2 px-3 py-2 text-sm text-text-secondary border border-border-primary rounded-lg cursor-pointer hover:bg-bg-secondary transition-colors">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                <span>{uploading ? "アップロード中..." : "添付する"}</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 p-4 border-t border-border-primary bg-bg-primary">
          <Button variant="ghost" onClick={onClose} disabled={submitting || uploading}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || uploading || !content.trim()}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            送信
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: `WriteReviewModal` の呼び出し側を確認**

呼び出し側で `onSubmit` のシグネチャが `(score, content, media)` に変わるため、呼び出し元の更新が必要。`WriteTrustModal` も同様に更新する（Task 12 で対応）。

**Step 3: コミット**

```bash
git add web/nyx/workspace/src/modules/trust/components/WriteReviewModal.tsx
git commit -m "feat(trust): add media upload to WriteReviewModal"
```

---

## Task 12: フロントエンド — `WriteTrustModal` にもメディアアップロード追加

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/components/WriteTrustModal.tsx`

**Step 1: `onSubmitReview` のシグネチャにメディアを追加**

`WriteTrustModal` のインターフェースと実装を更新。WriteReviewModal と同じメディアアップロードパターンを追加:

- `onSubmitReview` を `(score: number, content: string, media: SaveMediaInput[]) => Promise<void>` に変更
- `useMediaUpload` フックを追加
- メディアプレビュー & 添付 UI をレビューセクションに追加
- `handleSubmitReview` でメディアデータを渡す

（WriteReviewModal の Task 11 と同じ UI パターンを適用。コード量が多いため、Task 11 のメディア関連のステート・ハンドラ・UI を `WriteTrustModal` のレビューセクション内にも追加。）

**Step 2: コミット**

```bash
git add web/nyx/workspace/src/modules/trust/components/WriteTrustModal.tsx
git commit -m "feat(trust): add media upload to WriteTrustModal"
```

---

## Task 13: フロントエンド — `ReviewCard` にメディア表示追加

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/components/ReviewCard.tsx`

**Step 1: レビュー本文の下にメディアグリッドを追加**

`ReviewCard` の content 表示（L110-112）の直後にメディア表示を追加:

```typescript
{/* Media */}
{review.media && review.media.length > 0 && (
  <div className="flex gap-2 mb-3 flex-wrap">
    {review.media.map((m) => (
      <div key={m.id} className="w-20 h-20 rounded-lg overflow-hidden border border-border-primary">
        {m.mediaType === "image" ? (
          <img src={m.url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="relative w-full h-full">
            <img
              src={m.thumbnailUrl || m.url}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center">
                <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-black border-b-[5px] border-b-transparent ml-0.5" />
              </div>
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
)}
```

この部分を `{/* Content */}` セクションの直後、`{/* Status badge */}` セクションの直前に挿入。

**Step 2: コミット**

```bash
git add web/nyx/workspace/src/modules/trust/components/ReviewCard.tsx
git commit -m "feat(trust): add media display to ReviewCard"
```

---

## Task 14: フロントエンド — キャスト向けレビュー一覧ページ作成

**Files:**
- Create: `web/nyx/workspace/src/app/(cast)/cast/reviews/page.tsx`
- Create: `web/nyx/workspace/src/modules/trust/components/CastReviewsPage.tsx`

**Step 1: `CastReviewsPage` コンポーネント作成**

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, ArrowLeft, Star, Shield } from "lucide-react";
import Link from "next/link";
import { InfiniteScroll } from "@/components/ui/InfiniteScroll";
import { useInfiniteReviews } from "../hooks/useInfiniteReviews";
import { useReviewStats } from "../hooks/useReviewStats";
import { usePendingReviews } from "../hooks/usePendingReviews";
import { ReviewCard } from "./ReviewCard";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/modules/identity/hooks/useAuth";

type TabKey = "all" | "pending" | "approved" | "rejected";

const TABS: { key: TabKey; label: string; status?: string }[] = [
  { key: "all", label: "すべて" },
  { key: "pending", label: "承認待ち", status: "pending" },
  { key: "approved", label: "承認済み", status: "approved" },
  { key: "rejected", label: "却下", status: "rejected" },
];

export function CastReviewsPage({ castId }: { castId: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const activeStatus = TABS.find((t) => t.key === activeTab)?.status;

  const { stats, loading: statsLoading } = useReviewStats(castId);
  const {
    reviews,
    loading,
    loadingMore,
    hasMore,
    fetchInitial,
    fetchMore,
    reset,
  } = useInfiniteReviews({
    revieweeId: castId,
    status: activeStatus,
  });
  const { approveReview, rejectReview, mutate: mutatePending } = usePendingReviews();

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Reset and refetch when tab changes
  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  // When activeTab changes, reset needs to happen after state update
  useEffect(() => {
    reset();
  }, [activeTab, reset]);

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      await approveReview(id);
      toast({ title: "レビューを承認しました", variant: "success" });
      await mutatePending();
      reset();
    } catch {
      toast({ title: "承認に失敗しました", variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      await rejectReview(id);
      toast({ title: "レビューを却下しました", variant: "success" });
      await mutatePending();
      reset();
    } catch {
      toast({ title: "却下に失敗しました", variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href="/cast/mypage"
            className="p-2 -ml-2 rounded-full hover:bg-surface-secondary transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-text-primary" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-text-primary">レビュー管理</h1>
            {stats && (
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  {stats.averageScore.toFixed(1)}
                </span>
                <span className="text-text-muted">({stats.totalReviews}件)</span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-success" />
                  {stats.approvalRate}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-role-cast border-b-2 border-role-cast"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <p className="text-sm">
              {activeTab === "pending"
                ? "承認待ちのレビューはありません"
                : activeTab === "rejected"
                  ? "却下されたレビューはありません"
                  : "レビューはまだありません"}
            </p>
          </div>
        ) : (
          <InfiniteScroll
            hasMore={hasMore}
            loading={loadingMore}
            onLoadMore={fetchMore}
            endMessage="すべてのレビューを表示しました"
          >
            <div className="space-y-3">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  showActions={review.status === "pending"}
                  showReviewerLink
                  onApprove={handleApprove}
                  onReject={handleReject}
                  actionLoading={actionLoadingId === review.id}
                />
              ))}
            </div>
          </InfiniteScroll>
        )}
      </div>
    </div>
  );
}
```

**Step 2: ページコンポーネント作成**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CastGuard } from "@/modules/identity/guards/CastGuard";
import { CastReviewsPage } from "@/modules/trust/components/CastReviewsPage";
import { authFetch } from "@/lib/auth";

export default function CastReviewsRoute() {
  const [castId, setCastId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCast = async () => {
      try {
        const data = await authFetch<{ cast: { id: string } }>("/api/cast/me");
        setCastId(data.cast.id);
      } catch {
        // FALLBACK: CastGuard handles redirect
      } finally {
        setLoading(false);
      }
    };
    fetchCast();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!castId) return null;

  return (
    <CastGuard>
      <CastReviewsPage castId={castId} />
    </CastGuard>
  );
}
```

注意: ページコンポーネントの実装は既存のキャストページパターン（`/cast/followers` など）に合わせて調整すること。`castId` の取得方法は既存パターンを確認して合わせる。

**Step 3: コミット**

```bash
git add web/nyx/workspace/src/modules/trust/components/CastReviewsPage.tsx web/nyx/workspace/src/app/\(cast\)/cast/reviews/page.tsx
git commit -m "feat(trust): add cast reviews management page"
```

---

## Task 15: フロントエンド — MyPage にレビュー管理リンク追加

**Files:**
- Modify: `web/nyx/workspace/src/app/(cast)/cast/mypage/page.tsx`

**Step 1: フォロワーリストの後にレビュー管理リンクを追加**

`page.tsx` の import に `MessageSquare` を追加（L2）:

```typescript
import {
  ImagePlus,
  Users,
  Ticket,
  Calendar,
  ShieldAlert,
  LogOut,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
```

フォロワーリスト Link（L79-95）の直後に以下を追加:

```tsx
<Link
  href="/cast/reviews"
  className="w-full bg-surface hover:bg-surface-secondary border border-border rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
>
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center text-info">
      <MessageSquare className="w-5 h-5" />
    </div>
    <div className="text-left">
      <p className="text-sm font-bold text-text-primary">
        レビュー管理
      </p>
      <p className="text-xs text-text-secondary">レビューの確認・承認</p>
    </div>
  </div>
  <ChevronRight className="text-text-muted group-hover:text-text-secondary transition" />
</Link>
```

**Step 2: コミット**

```bash
git add web/nyx/workspace/src/app/\(cast\)/cast/mypage/page.tsx
git commit -m "feat(trust): add review management link to cast MyPage"
```

---

## Task 16: 呼び出し側の `onSubmit` シグネチャ修正

**Files:**
- 検索: `WriteReviewModal` および `WriteTrustModal` の使用箇所

**Step 1: 呼び出し側を検索して更新**

`WriteReviewModal` の `onSubmit` が `(score, content, media)` に変わったため、呼び出し側の `onSubmit` ハンドラに `media` パラメータを追加し、`createReview` に渡すようにする。

検索コマンド: `grep -r "WriteReviewModal\|WriteTrustModal\|onSubmitReview" --include="*.tsx" --include="*.ts" web/nyx/workspace/src/`

各呼び出し箇所で:
- `onSubmit` / `onSubmitReview` のコールバックに `media` パラメータを追加
- `createReview({ revieweeId, content, score, media })` のように渡す

**Step 2: コミット**

```bash
git add -A web/nyx/workspace/src/
git commit -m "feat(trust): update review modal consumers to pass media data"
```

---

## Task 17: テスト実行 & 動作確認

**Step 1: バックエンドテスト実行**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/trust/`
Expected: 全テスト PASS

**Step 2: フロントエンドビルド確認**

Run: `cd web/nyx/workspace && npx next build`
Expected: ビルド成功

**Step 3: 問題があれば修正してコミット**

---

## Task 18: trust module の exports 更新

**Files:**
- Modify: `web/nyx/workspace/src/modules/trust/index.ts`

**Step 1: 新コンポーネントの export 追加**

`CastReviewsPage` を export に追加（必要であれば）。既存の export パターンを確認して合わせる。

**Step 2: コミット**

```bash
git add web/nyx/workspace/src/modules/trust/index.ts
git commit -m "feat(trust): export CastReviewsPage component"
```
