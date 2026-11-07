# Review Service Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** クチコミの `service`（利用）の出来事に画像と動画を最大 4 件添付し、閲覧条件に従って表示する。

**Architecture:** review スキーマに出来事の添付の表 `review.event_media` を足し、出来事の作成・追加・編集で置き換え保存する。
返すときは `PresentReviews` が閲覧者ごとに添付を出すかを決め、配信 URL は Media slice から取得する。
片付けは既存の `Post::UseCases::DiscardDetachedMedia` に集約し、クチコミの添付も「使用中」に数える。
画面は投稿カードの画像・動画・拡大表示を `MediaGallery` に切り出して、投稿とクチコミで共用する。

**Tech Stack:** Hanami 2 + ROM-SQL + gruf（monolith）、buf（proto）、Next.js + React + vitest（frontend）

**Spec:** `docs/superpowers/specs/2026-11-06-dystopia-review-service-media-design.md`

## Global Constraints

- 添付できるのは `stage == "service"` の出来事だけ。ほかの段階で添付を送ったら `Review::Errors::Invalid`（gRPC は `INVALID_ARGUMENT`）。
- 1 出来事の添付は画像と動画を合わせて 4 件まで（`Review::Catalog::MAX_MEDIA_COUNT = 4`、frontend `MAX_REVIEW_MEDIA = 4`）。
- 添付の種別は `image` と `video` だけ。
- 添付できるのは使っているプロフィール（`viewer_profile_id`）がアップロードしたメディアだけ。
- 対象キャストが有効でない（`summarize_profiles` に出ない）とき、添付は作者アカウントにだけ返す。
- メディアのファイルが消えている添付は返さない。
- 片付けは、投稿・コメント・アバター/カバー・クチコミの添付のどれにも使われていないメディアだけを消す。
- コードコメントは英語 1 行、タスクや修正への言及なし（AGENTS.md）。
- commit は `git commit -s`、`Co-Authored-By` は付けない。
- 仕様書（`dystopia/docs/features/reviews.md`・`media.md`・`dystopia/docs/data-model.md`）を同じ PR で更新する。

## Review Focus

- 段階を `service` から `aftercare` に編集し、添付を空で送る → 添付の行が消え、メディアが片付けられる（Task 4 で検証）。
- 投稿とクチコミの両方に同じメディアを添付して投稿を消す → クチコミの写真は残る（Task 4 で検証）。
- 書き手のメディアのファイルが消えた後にクチコミを読む → 添付は返らず、エラーにならない（Task 3 で検証）。
- 同じ media_id を 2 回送る → 拒否（Task 2 で検証）。
- 出来事の追加・編集を、同じアカウントの別プロフィールで行い、そのプロフィールが上げていないメディアを送る → 拒否（Task 2 で検証）。

## Commands

- monolith の migrate: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate`
- monolith の spec: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec <path> > /tmp/rspec.log 2>&1; echo $?; tail -30 /tmp/rspec.log`
  - 出力は file に redirect する（CI は rspec を回さないので、ローカル実行が唯一の判定）。
- frontend のテスト: `cd dystopia/frontend && pnpm vitest run <path>`
- frontend の型検査: `cd dystopia/frontend && pnpm exec tsc --noEmit --incremental false; echo $?`
  - incremental キャッシュが型エラーを隠すため `--incremental false` を付け、exit code はパイプせずに取る。
- stub の生成: `cd dystopia/monolith && bin/codegen` と `cd dystopia/frontend && pnpm proto:gen`
  - 無関係な stub にも差分が出るので、`review/v1` の stub だけ commit する。

---

### Task 1: 添付の表と repository

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261107000001_create_review_event_media.rb`
- Create: `dystopia/monolith/slices/review/relations/event_media.rb`
- Modify: `dystopia/monolith/slices/review/repositories/event_repository.rb`
- Test: `dystopia/monolith/spec/slices/review/repositories/event_repository_spec.rb`（新規）

**Interfaces:**
- Produces（`Review::Repositories::EventRepository`）:
  - `replace_media(event_id, media)`: `media` は `[{ media_id:, media_type: }]`。既存の行を消し、配列順に `position` 0.. で作り直す。
  - `media_for(event_ids) -> Hash{String => Array<row>}`: 行は `media_id`・`media_type`・`position` を持ち、`position` 昇順。
  - `media_ids_for_event(event_id) -> Array<String>`
  - `media_ids_for_review(review_id) -> Array<String>`
  - `attached_media_ids(ids) -> Array<String>`: `ids` のうち添付に使われているもの。

- [ ] **Step 1: migration と relation を書く**

表 `review__event_media`: `id uuid PK`、`event_id uuid NOT NULL`（`review__events` への FK、`on_delete: :cascade`）、`media_id uuid NOT NULL`（FK なし）、`media_type text NOT NULL`、`position integer NOT NULL DEFAULT 0`、`created_at timestamptz NOT NULL DEFAULT now()`。
制約 `media_type_value`: `media_type IN ('image', 'video')`。
index: `event_id`、`media_id`。
`down` は `drop_table`。
relation は `schema(:"review__event_media", as: :event_media_records, infer: false)`、`Events` と同じ書き方。

- [ ] **Step 2: migrate する**

Run: migrate のコマンド
Expected: エラーなしで終わる。

- [ ] **Step 3: 失敗するテストを書く**

```ruby
RSpec.describe Review::Repositories::EventRepository, type: :database do
  # review と event は Review::Slice["use_cases.create_review"] で作る（review_lifecycle_spec.rb の let を参照）
  it "replaces the attachments of an event in the given order" do
    repo.replace_media(event_id, [{ media_id: a, media_type: "image" }, { media_id: b, media_type: "video" }])
    repo.replace_media(event_id, [{ media_id: b, media_type: "video" }])
    expect(repo.media_for([event_id])[event_id].map(&:media_id)).to eq([b])
  end

  it "lists attachment ids by event, by review, and among given ids" do
    repo.replace_media(event_id, [{ media_id: a, media_type: "image" }])
    expect(repo.media_ids_for_event(event_id)).to eq([a])
    expect(repo.media_ids_for_review(review_id)).to eq([a])
    expect(repo.attached_media_ids([a, b])).to eq([a])
  end

  it "drops the attachments with the event" do
    repo.replace_media(event_id, [{ media_id: a, media_type: "image" }])
    repo.delete(event_id)
    expect(repo.attached_media_ids([a])).to eq([])
  end
end
```

- [ ] **Step 4: 失敗を確認する**

Run: `spec/slices/review/repositories/event_repository_spec.rb` を spec のコマンドで実行
Expected: `NoMethodError: undefined method 'replace_media'` で FAIL。

- [ ] **Step 5: repository のメソッドを実装する**

`media_ids_*` と `attached_media_ids` は文字列の配列で返す（`map(&:to_s)`）。

- [ ] **Step 6: 通ることを確認する**

Expected: 3 examples, 0 failures。

- [ ] **Step 7: commit**

`feat(dystopia/monolith): add review event media table`

### Task 2: 添付の保存（作成・追加・編集）

**Files:**
- Modify: `dystopia/monolith/slices/review/catalog.rb`（`MAX_MEDIA_COUNT = 4`、`MEDIA_TYPES = %w[image video].freeze`）
- Modify: `dystopia/monolith/slices/review/use_cases/validate_event.rb`
- Create: `dystopia/monolith/slices/review/adapters/media_adapter.rb`
- Modify: `dystopia/monolith/slices/review/use_cases/create_review.rb`・`add_review_event.rb`・`update_review_event.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/validate_event_spec.rb`、`dystopia/monolith/spec/slices/review/use_cases/review_media_spec.rb`（新規）

**Interfaces:**
- Consumes: Task 1 の `replace_media`。
- Produces:
  - `ValidateEvent#call(stage:, outcome:, tags:, note:, occurred_on:, media: [], today: ...)` の戻り値に `media: [{ media_id:, media_type: }]` が加わる。
  - `Review::Adapters::MediaAdapter#owned_all?(profile_id:, ids:) -> Boolean`（`Post::Adapters::MediaAdapter#owned_all?` と同じ実装）
  - `Review::Adapters::MediaAdapter#find_by_ids(ids) -> Hash{String => file}`（file は `url`・`thumbnail_url` を持つ。`Media::Slice["use_cases.get_media_batch"]`）
  - `Review::Adapters::MediaAdapter#discard_detached(ids)`（Task 4 で使う。`Post::Slice["use_cases.discard_detached_media"].call(ids: ids)`）
  - `AddReviewEvent#call(viewer_account_id:, viewer_profile_id:, review_id:, event:)`
  - `UpdateReviewEvent#call(viewer_account_id:, viewer_profile_id:, event_id:, event:)`
  - 3 つのユースケースはメディアが使っているプロフィールのものでないとき `Errors::Invalid, "Only media the acting profile uploaded can be attached"`。

- [ ] **Step 1: ValidateEvent の失敗するテストを書く**

```ruby
let(:service) { { stage: "service", outcome: "satisfied", tags: [], note: "", occurred_on: "2026-10-01" } }
def media(n) = Array.new(n) { { media_id: SecureRandom.uuid_v7, media_type: "image" } }

it "keeps up to four attachments on a service event" do
  expect(validate.call(**service, media: media(4))[:media].length).to eq(4)
end
it "refuses attachments on other stages" do
  expect { validate.call(stage: "aftercare", outcome: "closed_without_issues", tags: [], note: "", occurred_on: "2026-10-01", media: media(1)) }
    .to raise_error(Review::Errors::Invalid, "Media only on the service stage")
end
it "refuses a fifth attachment, a repeated media, and an unknown type" do
  expect { validate.call(**service, media: media(5)) }.to raise_error(Review::Errors::Invalid, "Too many media")
  one = media(1)
  expect { validate.call(**service, media: one + one) }.to raise_error(Review::Errors::Invalid, "Duplicate media")
  expect { validate.call(**service, media: [{ media_id: SecureRandom.uuid_v7, media_type: "audio" }]) }
    .to raise_error(Review::Errors::Invalid, "Unknown media type")
end
it "returns no attachments when none are given" do
  expect(validate.call(**service)[:media]).to eq([])
end
```

- [ ] **Step 2: 失敗を確認し、ValidateEvent を実装して通す**

Expected（実装前）: `unknown keyword: :media` で FAIL。
Expected（実装後）: validate_event_spec 全件 PASS。

- [ ] **Step 3: 保存の失敗するテストを書く（`review_media_spec.rb`）**

メディアの行は `add_comment_spec.rb:100` と同じく `db[:media__files].insert(id:, media_type:, media_key: "media/#{profile}/#{id}.jpg", uploader_profile_id: profile)` で作る。
アカウント・プロフィールの let は `review_lifecycle_spec.rb:7-16` と同じ。

```ruby
it "saves the attachments of the first event" do
  review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
  expect(db[:review__event_media].select_map(:media_id)).to eq([mine])
end
it "replaces the attachments when the event is edited" do
  review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
  uc(:update_review_event).call(viewer_account_id: guest_account, viewer_profile_id: persona_a,
    event_id: review[:events].first[:id], event: service_input.merge(media: [{ media_id: mine2, media_type: "video" }]))
  expect(db[:review__event_media].select_map(:media_id)).to eq([mine2])
end
it "saves the attachments of an added event" do
  review = create
  uc(:add_review_event).call(viewer_account_id: guest_account, viewer_profile_id: persona_a, review_id: review[:id],
    event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
  expect(db[:review__event_media].select_map(:media_id)).to eq([mine])
end
it "refuses media another profile uploaded, even one of the same account" do
  review = create
  expect {
    uc(:add_review_event).call(viewer_account_id: guest_account, viewer_profile_id: persona_b, review_id: review[:id],
      event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
  }.to raise_error(Review::Errors::Invalid, "Only media the acting profile uploaded can be attached")
end
```

（`mine`・`mine2` は persona_a が上げたメディア。）

- [ ] **Step 4: 失敗を確認する**

Expected: `unknown keyword: :viewer_profile_id` などで FAIL。

- [ ] **Step 5: adapter とユースケースを実装する**

所有の検査は `validate_event` の後、transaction の前に行う。
作成・追加は `event_repo.create` の戻り値の id で `replace_media`、編集は `event_repo.update` の後に `replace_media`。
`review_handler.rb` の `add_review_event`・`update_review_event` に `viewer_profile_id: current_profile_id` を渡す。

- [ ] **Step 6: 通ることを確認する**

Run: `spec/slices/review` 全体
Expected: 0 failures（既存の spec で `add_review_event`・`update_review_event` を呼ぶ箇所は `viewer_profile_id:` を足して直す）。

- [ ] **Step 7: commit**

`feat(dystopia/monolith): save media on review service events`

### Task 3: 添付を返す

**Files:**
- Modify: `dystopia/monolith/slices/review/use_cases/present_reviews.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/review_media_spec.rb`

**Interfaces:**
- Consumes: Task 1 の `media_for`、Task 2 の `MediaAdapter#find_by_ids`。
- Produces: 出来事のハッシュに `media: [{ media_id:, media_type:, url:, thumbnail_url: }]`（`position` 順）。

- [ ] **Step 1: 失敗するテストを書く**

```ruby
it "shows the attachments with delivery urls to any viewer who can read the review" do
  review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
  read = read_as(cast_account, cast, review)
  expect(read[:events].first[:media].map { |m| m.slice(:media_id, :media_type) }).to eq([{ media_id: mine, media_type: "image" }])
  expect(read[:events].first[:media].first[:url]).not_to be_empty
end
it "shows the attachments of a review on a disabled cast only to the author account" do
  review = create(event: service_input.merge(media: [{ media_id: mine, media_type: "image" }]))
  db[:profile__profiles].where(id: cast).update(disabled_at: Time.now)
  expect(read_as(guest_account, persona_b, review)[:events].first[:media].length).to eq(1)
  others = uc(:list_reviews_by_author).call(viewer_account_id: other_guest_account, viewer_profile_id: other_guest,
    author_profile_id: persona_a, limit: 20, cursor: nil)[:reviews]
  expect(others.map { |r| r[:events].first[:media] }).to eq([[]])
end
it "skips an attachment whose media file is gone" do
  db[:media__files].where(id: mine).delete
  expect(read_as(cast_account, cast, review)[:events].first[:media]).to eq([])
end
```

無効な対象のクチコミは他人が個別表示では読めない（`reviews.md` の個別表示の表）ので、他人側は「書いたクチコミ」一覧で確かめる。

- [ ] **Step 2: 失敗を確認する**

Expected: `key not found: :media` 相当で FAIL。

- [ ] **Step 3: 実装する**

`call` で全出来事の添付をまとめて引き、`find_by_ids` を 1 回だけ呼ぶ。
添付を出す条件: `review.author_account_id == viewer_account_id || summaries.key?(review.target_profile_id.to_s)`。
ファイルが見つからない添付は除く。

- [ ] **Step 4: 通ることを確認する**

Run: `spec/slices/review` 全体
Expected: 0 failures。

- [ ] **Step 5: commit**

`feat(dystopia/monolith): present media on review events`

### Task 4: 片付け

**Files:**
- Create: `dystopia/monolith/slices/review/use_cases/list_media_ids_in_use.rb`
- Create: `dystopia/monolith/slices/post/adapters/review_adapter.rb`
- Modify: `dystopia/monolith/slices/post/use_cases/discard_detached_media.rb`
- Modify: `dystopia/monolith/slices/review/use_cases/update_review_event.rb`・`delete_review_event.rb`・`delete_review.rb`
- Test: `dystopia/monolith/spec/slices/review/use_cases/review_media_spec.rb`、`dystopia/monolith/spec/slices/post/use_cases/discard_detached_media_spec.rb`（新規）

**Interfaces:**
- Consumes: Task 1 の `media_ids_for_event`・`media_ids_for_review`・`attached_media_ids`、Task 2 の `MediaAdapter#discard_detached`。
- Produces:
  - `Review::UseCases::ListMediaIdsInUse#call(ids:) -> Array<String>`（`Profile::UseCases::ListMediaIdsInUse` と同じ形）
  - `Post::Adapters::ReviewAdapter#media_ids_in_use(ids)`（`Review::Slice["use_cases.list_media_ids_in_use"]`）

- [ ] **Step 1: 失敗するテストを書く**

```ruby
# review_media_spec.rb
def file_exists?(id) = db[:media__files].where(id: id).count == 1

it "discards the media an edit detaches and keeps the one it keeps" do
  # first event carries mine and mine2; the edit keeps only mine2
  expect([file_exists?(mine), file_exists?(mine2)]).to eq([false, true])
end
it "drops the attachments when a service event is edited to another stage with no media" do
  # update_review_event with stage: "aftercare", outcome: "closed_without_issues", media: []
  expect(db[:review__event_media].count).to eq(0)
  expect(file_exists?(mine)).to be false
end
it "discards the media of a deleted event while the review stays" do
  # two events, the second carries mine; delete_review_event on the second
  expect(file_exists?(mine)).to be false
end
it "discards the media of a review deleted with its last event or as a whole" do
  # delete_review_event on the only event (mine), and delete_review on another review (mine2)
  expect([file_exists?(mine), file_exists?(mine2)]).to eq([false, false])
end

# discard_detached_media_spec.rb
it "keeps media still attached to a review event" do
  # attach m to a review service event, then call Post::Slice["use_cases.discard_detached_media"].call(ids: [m])
  expect(file_exists?(m)).to be true
end
it "discards media nothing uses" do
  # m is in media__files only
  expect(file_exists?(m)).to be false
end
```

- [ ] **Step 2: 失敗を確認する**

Expected: 外したメディアの行が残っていて FAIL。

- [ ] **Step 3: 実装する**

外れる id は transaction の中で行を消す前に集め、`discard_detached` は transaction の commit 後に呼ぶ。
最後の出来事の削除でクチコミごと消える経路（`DeleteReviewEvent` の `count_for <= 1`）も、クチコミ全体の添付を集める。
`DiscardDetachedMedia` の `in_use` に `review_adapter.media_ids_in_use(ids)` を足す。

- [ ] **Step 4: 通ることを確認する**

Run: `spec/slices/review` と `spec/slices/post` 全体
Expected: 0 failures。

- [ ] **Step 5: commit**

`feat(dystopia/monolith): discard media detached from review events`

### Task 5: proto と gRPC handler

**Files:**
- Modify: `proto/dystopia/review/v1/service.proto`
- Modify: `dystopia/monolith/stubs/review/v1/service_pb.rb`（生成）、`dystopia/frontend/src/stub/review/v1/service_pb.ts`（生成）
- Modify: `dystopia/monolith/slices/review/grpc/review_handler.rb`
- Test: `dystopia/monolith/spec/slices/review/grpc/review_handler_spec.rb`

**Interfaces:**
- Produces:

```proto
message ReviewEventMedia {
  string media_id = 1;
  string media_type = 2;
  string url = 3;
  string thumbnail_url = 4;
}
// ReviewEventInput に: repeated ReviewEventMedia media = 6;（url と thumbnail_url は無視する）
// ReviewEvent に:      repeated ReviewEventMedia media = 9;
```

- [ ] **Step 1: proto を変えて stub を生成する**

`review/v1` 以外の stub の差分は `git checkout` で戻す。

- [ ] **Step 2: 失敗するテストを書く**

`review_handler_spec.rb` の既存の作成の例に倣い、`ReviewEventInput` に `media: [ReviewEventMedia.new(media_id: mine, media_type: "image")]` を入れて `CreateReview` を呼び、応答の `review.events.first.media.map(&:media_id)` が `[mine]` で `url` が空でないことを確かめる。
`stage: :REVIEW_STAGE_RESERVATION` で添付を送ると `INVALID_ARGUMENT` になる例も足す。

- [ ] **Step 3: 失敗を確認し、`event_from` と `event_to_proto` を実装して通す**

Expected（実装後）: `spec/slices/review` 全体が 0 failures。

- [ ] **Step 4: commit**

`feat(dystopia): carry media on review event messages`

### Task 6: frontend のデータの通り道

**Files:**
- Modify: `dystopia/frontend/src/modules/review/types.ts`
- Modify: `dystopia/frontend/src/modules/review/lib/mappers.ts`・`lib/input.ts`・`lib/catalog.ts`
- Create: `dystopia/frontend/src/modules/review/lib/media.ts`
- Modify: `dystopia/frontend/src/modules/review/components/ReviewEventForm.tsx`（`emptyReviewEvent` に `media: []`）
- Test: `lib/mappers.test.ts`・`lib/input.test.ts`・`lib/media.test.ts`（新規）

**Interfaces:**
- Produces:
  - `interface ReviewMedia { mediaId: string; mediaType: "image" | "video"; url: string; thumbnailUrl: string }`
  - `ReviewEvent.media: ReviewMedia[]`、`ReviewEventInput.media: ReviewMedia[]`
  - `MAX_REVIEW_MEDIA = 4`（catalog.ts）
  - `latestEventMedia(review: Review): ReviewMedia[]`: 出来事の並びで最後にある、添付が 1 件以上の出来事の添付。なければ `[]`。
  - `galleryOf(media: ReviewMedia[]): { images: { url: string; thumbnailUrl: string }[]; videos: { url: string }[] }`: 画像は `thumbnailUrl || url` をサムネイルにする（`PostCardBinding.tsx:75-80` と同じ規則）。

- [ ] **Step 1: 失敗するテストを書く**

- `mapReviewEventToView` が `media` を写す（`mediaType` が `"image"`/`"video"` 以外の添付は落とす）。
- `eventInputToMessage` が `media` を `{ mediaId, mediaType }` だけにして渡す。
- `parseReviewEventInput` は `media` がなければ `[]`、要素が `{ mediaId: string, mediaType: "image" | "video" }` でなければ `null`。
- `latestEventMedia` は最後の出来事に添付がなくても、その前の添付付きの出来事の添付を返す。
- `galleryOf` は画像と動画を分け、サムネイルのない画像は `url` をサムネイルにする。

- [ ] **Step 2: 失敗を確認し、実装して通す**

Run: `pnpm vitest run src/modules/review/lib` と型検査
Expected: PASS、型検査 exit 0（型エラーが出る既存の `ReviewEventInput` リテラルには `media: []` を足す）。

- [ ] **Step 3: commit**

`feat(dystopia/frontend): carry media on review events`

### Task 7: MediaGallery の切り出し

**Files:**
- Create: `dystopia/frontend/src/components/ui/media-gallery.tsx`
- Modify: `dystopia/frontend/src/components/ui/post-card.tsx`
- Test: `dystopia/frontend/src/components/ui/media-gallery.test.tsx`（新規）、`post-card.test.tsx`（既存が通ること）

**Interfaces:**
- Produces: `MediaGallery({ images, videos }: { images?: PostCardImage[]; videos?: PostCardVideo[] })`
  - 今の `PostCard` の動画（`preload="metadata"`）、画像グリッド（最大 4 枚）、拡大表示の Dialog をそのまま移す。
  - `PostCardImage`・`PostCardVideo` は `media-gallery.tsx` に移し、`post-card.tsx` から re-export する。

- [ ] **Step 1: 失敗するテストを書く**

`media-gallery.test.tsx`: 画像 2 枚で「画像を拡大」のボタンが 2 つ出る、動画は `controls` と `preload="metadata"` 付きで出る、どちらもなければ何も描かない。

- [ ] **Step 2: 失敗を確認し、切り出して通す**

Run: `pnpm vitest run src/components/ui`
Expected: `media-gallery.test.tsx` と `post-card.test.tsx` が PASS。

- [ ] **Step 3: commit**

`refactor(dystopia/frontend): extract the media gallery from the post card`

### Task 8: 出来事のフォームの添付

**Files:**
- Create: `dystopia/frontend/src/modules/review/components/ReviewEventAttachments.tsx`
- Modify: `dystopia/frontend/src/modules/review/components/ReviewEventForm.tsx`
- Modify: `dystopia/frontend/src/modules/review/components/ReviewDetailSheet.tsx`（編集の下書きに `media: target.media`）
- Test: `ReviewEventAttachments.test.tsx`（新規）、`ReviewEventForm.test.tsx`、`ReviewDetailSheet.test.tsx`

**Interfaces:**
- Consumes: Task 6 の `ReviewMedia`・`MAX_REVIEW_MEDIA`、`useMediaUpload`（`uploadMedia(file, { registerAfterUpload: true })`）。
- Produces: `ReviewEventAttachments({ items, onChange, onUploadingChange, disabled }: { items: ReviewMedia[]; onChange: (next: ReviewMedia[]) => void; onUploadingChange: (uploading: boolean) => void; disabled: boolean })`
  - アップロード結果は `{ mediaId, mediaType, url: localUrl, thumbnailUrl: localUrl }` にして足す。
  - 文言は投稿と同じ: ボタン「画像/動画を追加」（アップロード中は「アップロード中…」）、file input の `aria-label`「画像や動画を選択」、削除ボタン `aria-label`「<ファイル名 or 画像>を削除」。
  - 4 件に達したら追加ボタンを無効にし、選んだファイルは残り枠の数だけ使う。

- [ ] **Step 1: 失敗するテストを書く**

- `ReviewEventForm`: 段階が「利用」のときだけ「画像/動画を追加」が出る。
- `ReviewEventForm`: 添付のある「利用」から「利用後」に切り替えると、`onChange` の値の `media` が `[]` になる。
- `ReviewEventForm`: アップロード中は送信ボタンが無効。
- `ReviewEventAttachments`: 4 件あると追加ボタンが無効、削除ボタンで 1 件外れる（`useMediaUpload` は `vi.mock`）。
- `ReviewDetailSheet`: 添付付きの出来事の「編集」を押すと、フォームに既存の添付が並ぶ。

- [ ] **Step 2: 失敗を確認し、実装して通す**

Run: `pnpm vitest run src/modules/review` と型検査
Expected: PASS、型検査 exit 0。

- [ ] **Step 3: commit**

`feat(dystopia/frontend): attach media to review service events`

### Task 9: 添付の表示

**Files:**
- Modify: `dystopia/frontend/src/modules/review/components/ReviewDetailSheet.tsx`
- Modify: `dystopia/frontend/src/modules/review/components/ReviewCard.tsx`
- Test: `ReviewDetailSheet.test.tsx`、`ReviewCard.test.tsx`

**Interfaces:**
- Consumes: Task 6 の `latestEventMedia`・`galleryOf`、Task 7 の `MediaGallery`。

- [ ] **Step 1: 失敗するテストを書く**

- 詳細: 添付付きの出来事は、補足の下に画像（「画像を拡大」）と動画が出る。
- カード: 最後の出来事が「利用後」でも、その前の「利用」の添付がカードに出る。
- カード: 添付が 1 件もないクチコミには何も出ない。
- カードの添付は、詳細を開くボタンの外に置く（`button` の中に `button` を入れない。拡大のボタンが詳細ボタンの子孫でないことを確かめる）。

- [ ] **Step 2: 失敗を確認し、実装して通す**

Run: `pnpm vitest run src/modules/review` と型検査
Expected: PASS、型検査 exit 0。

- [ ] **Step 3: commit**

`feat(dystopia/frontend): show media on review events`

### Task 10: 仕様書

**Files:**
- Modify: `dystopia/docs/features/reviews.md`・`dystopia/docs/features/media.md`・`dystopia/docs/data-model.md`

- [ ] **Step 1: 仕様書を更新する**

- `reviews.md`: Rules に「添付」の節（`service` だけ、4 件、所有、種別、編集での置き換え、段階の変更）、閲覧に「無効な対象キャストの添付は作者アカウントにだけ」と「ファイルがない添付は返さない」、画面に詳細とカードの表示、Data に `review.event_media`。
- `media.md`: 用途にクチコミの出来事の添付、所有の規則・配信 URL の条件・削除時の片付けにクチコミの添付を加える。
- `data-model.md`: Review の図に `review_event_media` と `review_events ||--o{ review_event_media : "event_id"`、説明の箇条書きを 1 行。
- 1 文 1 行、箇条書きは要点 1 文で補足は下の階層、表のセルの改行は `<br>`。

- [ ] **Step 2: 書いた内容と実装を突き合わせる**

Run: `grep -n "添付" dystopia/docs/features/reviews.md dystopia/docs/features/media.md`
Expected: 上の項目がすべて出る。

- [ ] **Step 3: commit**

`docs(dystopia): describe media on review service events`
