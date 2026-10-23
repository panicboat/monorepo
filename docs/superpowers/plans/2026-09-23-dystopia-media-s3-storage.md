# Dystopia Media S3 Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix GitHub issue #1210 (file upload fails in production for profile/post images) by giving `dystopia/monolith` a real production storage backend on S3, replacing the dev-only `Storage::LocalAdapter` that was silently the only adapter ever wired up.

**Architecture:** Add a `Storage::S3Adapter` that mirrors the existing `Cognito::AwsAdapter` / `Cognito::FakeAdapter` split (`lib/storage.rb#default_adapter` picks the adapter by `HANAMI_ENV`, exactly like `lib/cognito.rb#default_adapter`). The S3 bucket stays fully private; `S3Adapter#upload_url` issues a presigned PUT (for the browser's direct upload) and `S3Adapter#download_url` issues a presigned GET, regenerated on every read and never persisted — the `url`/`thumbnail_url` database columns are dropped entirely (see Task 3) rather than left holding a value nothing trusts. Because `Media::UseCases::GetMedia`/`GetMediaBatch` are the single choke point every slice (post/profile/karte) and the gRPC handler go through, the "re-sign on read" behavior is implemented once in `Media::Repositories::MediaRepository` — no other slice needs to change.

**Tech Stack:** `aws-sdk-s3` (already in Gemfile, unused until now), Terraform/Terragrunt (`dystopia/infrastructure/aws`), Hanami 2 / ROM-SQL (`dystopia/monolith`), Next.js 16 (`dystopia/frontend`).

**Spec:** No separate spec doc — this plan is written directly from root-cause investigation done in this session (see Architecture above and Global Constraints below for the full rationale; there was no brainstorming-skill session preceding it because this started as a production bug report, not a new feature request).

## Global Constraints

- Root cause: `Storage.default_adapter` (`dystopia/monolith/lib/storage.rb`) always returns `LocalAdapter`, and `Middleware::LocalUploader` (the only thing that serves `LocalAdapter`'s upload URL) is mounted only under `Hanami.env?(:development)` (`dystopia/monolith/config/app.rb:12-15`). Production has never had a working upload path, regardless of device.
- `Media::UseCases::RegisterMedia` (`dystopia/monolith/slices/media/use_cases/register_media.rb:13`) used to persist `Storage.download_url(key:)`'s return value as a plain string in `media.files.url` at upload time. Presigned S3 GET URLs expire (max ~7 days under our EKS Pod Identity/STS credentials), so that value can never be trusted for reads. Since nothing should ever read a stored URL, **the `url`/`thumbnail_url` columns themselves are dropped** (not just stopped-being-read) — this repo's own precedent for exactly this move is `config/db/migrate/20260218220000_remove_legacy_media_columns.rb`, which already dropped equivalent legacy `url`/`thumbnail_url` columns from `post__post_media` and `post__comment_media`. `url`/`thumbnail_url` become purely computed, in-memory fields: derived from `media_key`/`thumbnail_key` via `Storage.download_url` every time a record is read, never written to disk.
- Dropping `url`/`thumbnail_url` as real columns means they are no longer part of `Media::Relations::Files`' ROM schema, so `Media::Repositories::MediaRepository` can no longer use the `existing_struct.new(url: ..., thumbnail_url: ...)` trick (confirmed by reading `dry-struct` 1.8.0 source, `lib/dry/struct.rb:202` — `Struct#new(changeset)` calls `self.class.schema.apply(changeset, ...)`, which raises `Dry::Struct::Error` for any key not declared in that struct's own schema). Instead, `MediaRepository` builds a plain `Data.define` value object (`MediaRepository::MediaRecord`) with the raw columns plus the two computed fields — same pattern this codebase already uses for `Profile::Adapters::MediaAdapter::MediaFile` (`dystopia/monolith/slices/profile/adapters/media_adapter.rb:7`). `MediaRecord` must expose every attribute any consumer currently reads: `id`, `media_type`, `url`, `thumbnail_url`, `filename`, `content_type`, `size_bytes`, `media_key`, `thumbnail_key`, `created_at`, `uploader_account_id`.
- `MediaRepository#create`'s return value is not just used in tests — `Media::UseCases::RegisterMedia#call` returns it directly, and `Media::Grpc::Handler#register_media` immediately calls `MediaPresenter.to_proto(result)` on it to hand the freshly-uploaded media (including its `url`) back to the client in the same response. So `#create` must also resolve `url`/`thumbnail_url` before returning — not only `#find_by_id`/`#find_by_ids` — or `register_media`'s gRPC response would call `.url` on a struct that no longer has that attribute at all and crash. All three read paths (`create`, `find_by_id`, `find_by_ids`) funnel through the same private `resolve_urls` method.
- Media reads only ever go through `Media::Repositories::MediaRepository#find_by_id` / `#find_by_ids` (verified: `find_by_media_key` has zero callers; no slice queries the `media__files` table directly). `slices/post/adapters/media_adapter.rb`, `slices/profile/adapters/media_adapter.rb`, `slices/karte/adapters/media_adapter.rb`, and `Media::Grpc::Handler` all call `Media::UseCases::GetMedia`/`GetMediaBatch`, which just delegate to the repository. Fixing the repository fixes every consumer.
- AWS access pattern in this repo is EKS Pod Identity, not IRSA annotations: `dystopia/infrastructure/aws/modules/pod_identity.tf` already associates the `monolith` ServiceAccount (namespace `dystopia`) with `aws_iam_role.monolith`. New S3 permissions are just another `aws_iam_policy` + `aws_iam_role_policy_attachment` onto that same role — no Kubernetes-side ServiceAccount change needed.
- Terraform naming/region conventions already established in `dystopia/infrastructure/aws/modules`: `var.environment = "production"`, `var.aws_region = "ap-northeast-1"`, resource names follow `"<service>-${var.environment}"` (e.g. `aws_iam_role.monolith` is named `"monolith-${var.environment}"`, Cognito pool is `"dystopia-production"`). Use `bucket = "dystopia-media-${var.environment}"` (→ `dystopia-media-production`) — no random/account-id suffix; this project's convention only adds an account-id suffix for genuinely generic names (the shared Terragrunt state bucket), not project-branded ones.
- Production frontend origin (for S3 CORS `allowed_origins`, since the presigned PUT is issued directly from the browser to S3) is `https://dystopia.city` (`dystopia/frontend/kubernetes/base/httproute.yaml:21`).
- **CORRECTION (post-Task-4/5-review):** the original bullet here claimed `output: "standalone"` re-evaluates `next.config.ts` (and therefore `process.env.NEXT_PUBLIC_MEDIA_URL`) at `node server.js` boot. This is false — independently verified by running `pnpm build` in this worktree and inspecting the emitted output: `next.config.js` is read once during `next build` and its resolved values (including `images.remotePatterns`) are serialized as a static JS object literal into `.next/standalone/server.js` (confirmed at `server.js:12`) and into `.next/standalone/.next/required-server-files.json`'s `config.images.remotePatterns`. Neither is re-read from the container's environment at boot. Since this repo's Dockerfile (`dystopia/frontend/Dockerfile:18`, `RUN pnpm build`) and CI workflow (`.github/workflows/reusable--container-builder.yaml`) pass no `NEXT_PUBLIC_MEDIA_URL` build-arg, the value baked into every built image is always the `http://localhost:3000` fallback — so a runtime-only ConfigMap value (as Task 4/5 originally implemented) can never reach `next/image`'s `remotePatterns` check in production, regardless of what the Deployment's `envFrom` supplies.
- Given the above, and that this app has exactly one non-dev environment (only `overlays/production` exists — no staging), the fix is not "wire the env var through correctly" but "stop depending on a per-environment value Next.js's standalone build can't deliver at runtime": Task 5 sets `images.unoptimized: true` globally in `next.config.ts` and removes the `remotePatterns`/`mediaUrl` derivation entirely. When `unoptimized` is true, `next/image` renders the original URL directly without proxying through the `/_next/image` optimization endpoint, so `remotePatterns` matching (and therefore the build-time-freeze problem) becomes structurally irrelevant. Cost: this repo's two `next/image` usages (`src/components/ui/post-card.tsx`, `src/modules/karte/components/KarteEntryCard.tsx` — confirmed via grep to be the only two; avatars render through Radix's `AvatarPrimitive.Image`, a plain `<img>`, and were never affected by `remotePatterns` in the first place) lose Next.js's automatic resize/format-conversion; acceptable for a bug fix restoring broken rendering, revisit only if a future task specifically wants image optimization back (would then require the Docker build-arg approach, deliberately not chosen here).
- Task 4's `NEXT_PUBLIC_MEDIA_URL` line in `dystopia/frontend/kubernetes/overlays/production/configmap.yaml` is removed as part of this correction — it has no reader once Task 5's `next.config.ts` stops referencing it (confirmed via repo-wide grep: the only reference was in `next.config.ts` itself). `dystopia/monolith`'s `MEDIA_BUCKET_NAME`/`MEDIA_BUCKET_REGION` ConfigMap values (Task 4) are unaffected by this correction — those are read by Ruby's `ENV` at process runtime, which has no build-time-freeze equivalent.
- Presigned PUT expiry: 300 seconds. Presigned GET expiry: 3600 seconds. These are plain constants in `Storage::S3Adapter`, not new configurable ENV vars (no requirement yet to tune them).
- IAM actions needed on the bucket for the `monolith` role: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` (presigned URLs are only honored at request time if the signing identity actually holds the permission for the signed action).
- `dystopia-media-production` in this plan is provisioned by Terraform but **applied by the existing CI pipeline** (`.github/workflows/reusable--terragrunt-executor.yaml` / `auto-label--deploy-trigger.yaml`), not by a local `terraform apply` from this session. Task 1's local verification is `terraform validate` / `terraform plan` only.

---

## File Structure

- `dystopia/infrastructure/aws/modules/s3.tf` (new) — S3 bucket, public access block, CORS, IAM policy + attachment for media storage.
- `dystopia/infrastructure/aws/modules/outputs.tf` (modify) — expose the bucket name for operator reference.
- `dystopia/monolith/lib/storage/s3_adapter.rb` (new) — `Storage::S3Adapter`, presigned PUT/GET + delete, mirrors `Cognito::AwsAdapter`.
- `dystopia/monolith/lib/storage.rb` (modify) — `default_adapter` switches on `HANAMI_ENV` like `lib/cognito.rb` does.
- `dystopia/monolith/config/db/migrate/20260925130000_drop_url_columns_from_media_files.rb` (new) — drops the now-dead `url`/`thumbnail_url` columns from `media__files`.
- `dystopia/monolith/slices/media/relations/files.rb` (modify) — remove `url`/`thumbnail_url` from the ROM schema (columns no longer exist).
- `dystopia/monolith/slices/media/repositories/media_repository.rb` (modify) — `create`/`find_by_id`/`find_by_ids` all resolve `url`/`thumbnail_url` from `Storage` via a new `MediaRecord` value object, computed fresh every call.
- `dystopia/monolith/slices/media/use_cases/register_media.rb` (modify) — stop computing/passing `url`/`thumbnail_url` at creation time (nothing left to write).
- `dystopia/monolith/spec/slices/media/relations/files_spec.rb` (modify) — assert `url`/`thumbnail_url` are gone from the schema.
- `dystopia/monolith/spec/slices/media/repositories/media_repository_spec.rb` (modify) — rewrite fixtures (no more `url:`/`thumbnail_url:` args to `create`) and add coverage for the resolve behavior.
- `dystopia/monolith/kubernetes/overlays/production/configmap.yaml` (new) — `MEDIA_BUCKET_NAME` / `MEDIA_BUCKET_REGION`.
- `dystopia/monolith/kubernetes/overlays/production/kustomization.yaml` (modify) — register the new configmap patch.
- `dystopia/frontend/next.config.ts` (modify) — replace the `remotePatterns`/`NEXT_PUBLIC_MEDIA_URL` approach (proven build-time-frozen under standalone output) with `images.unoptimized: true`.

---

### Task 1: Terraform — private S3 bucket + IAM for media storage

**Files:**
- Create: `dystopia/infrastructure/aws/modules/s3.tf`
- Modify: `dystopia/infrastructure/aws/modules/outputs.tf`

**Interfaces:**
- Produces: bucket named `dystopia-media-production` (referenced by literal name in Task 4's Kubernetes ConfigMap — not passed through any other task's code).

- [ ] **Step 1: Write `s3.tf`**

```hcl
resource "aws_s3_bucket" "media" {
  bucket = "dystopia-media-${var.environment}"

  tags = var.common_tags
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = ["https://dystopia.city"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

resource "aws_iam_policy" "monolith_media_s3" {
  name = "monolith-${var.environment}-media-s3"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
      Resource = "${aws_s3_bucket.media.arn}/*"
    }]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "monolith_media_s3" {
  role       = aws_iam_role.monolith.name
  policy_arn = aws_iam_policy.monolith_media_s3.arn
}
```

- [ ] **Step 2: Add the output**

In `dystopia/infrastructure/aws/modules/outputs.tf`, append:

```hcl
output "media_bucket_name" {
  value       = aws_s3_bucket.media.bucket
  description = "S3 bucket name for media storage (avatars / post images) — matches MEDIA_BUCKET_NAME on monolith"
}
```

- [ ] **Step 3: Validate**

Run: `cd dystopia/infrastructure/aws/modules && terraform init -backend=false && terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 4: Plan against the production stack (read-only, no apply)**

Run: `cd dystopia/infrastructure/aws/production && terragrunt plan`
Expected: plan shows only additions (`aws_s3_bucket.media`, `aws_s3_bucket_public_access_block.media`, `aws_s3_bucket_cors_configuration.media`, `aws_iam_policy.monolith_media_s3`, `aws_iam_role_policy_attachment.monolith_media_s3`) — no changes or destroys to existing resources. If this account/profile isn't configured in the current environment, note that in the task report instead of skipping silently.

- [ ] **Step 5: Commit**

```bash
git add dystopia/infrastructure/aws/modules/s3.tf dystopia/infrastructure/aws/modules/outputs.tf
git commit -s -m "feat(dystopia/infrastructure): add private S3 bucket for media storage"
```

---

### Task 2: Ruby — `Storage::S3Adapter`

**Files:**
- Create: `dystopia/monolith/lib/storage/s3_adapter.rb`
- Modify: `dystopia/monolith/lib/storage.rb`

**Interfaces:**
- Consumes: `Storage::Adapter` base class (`dystopia/monolith/lib/storage/adapter.rb`) — `upload_url(key:, content_type:)`, `download_url(key:)`, `delete(key:)`.
- Produces: `Storage::S3Adapter.new(client: nil, bucket: ENV["MEDIA_BUCKET_NAME"], region: ENV["MEDIA_BUCKET_REGION"] || "ap-northeast-1")`, used by `Storage.default_adapter` (Task 3 depends on `Storage.download_url`/`Storage.upload_url` continuing to delegate correctly, unchanged from today).

- [ ] **Step 1: Write `s3_adapter.rb`**

```ruby
# frozen_string_literal: true

require_relative "adapter"

module Storage
  class S3Adapter < Adapter
    UPLOAD_URL_EXPIRES_IN = 300
    DOWNLOAD_URL_EXPIRES_IN = 3600

    def initialize(client: nil, bucket: ENV.fetch("MEDIA_BUCKET_NAME"), region: ENV.fetch("MEDIA_BUCKET_REGION", "ap-northeast-1"))
      require "aws-sdk-s3"
      @client = client || Aws::S3::Client.new(region: region)
      @bucket = bucket
      @presigner = Aws::S3::Presigner.new(client: @client)
    end

    def upload_url(key:, content_type:)
      @presigner.presigned_url(:put_object, bucket: @bucket, key: key, content_type: content_type, expires_in: UPLOAD_URL_EXPIRES_IN)
    end

    def download_url(key:)
      return "" if key.to_s.empty?

      @presigner.presigned_url(:get_object, bucket: @bucket, key: key, expires_in: DOWNLOAD_URL_EXPIRES_IN)
    end

    def delete(key:)
      return false if key.to_s.empty?

      @client.delete_object(bucket: @bucket, key: key)
      true
    rescue Aws::S3::Errors::ServiceError => e
      warn "[Storage::S3Adapter] Failed to delete #{key}: #{e.message}"
      # FALLBACK: Returns false on delete failure
      false
    end
  end
end
```

- [ ] **Step 2: Switch `default_adapter` in `storage.rb`**

In `dystopia/monolith/lib/storage.rb`, replace:

```ruby
    def default_adapter
      LocalAdapter.new
    end
```

with:

```ruby
    def default_adapter
      env = ENV.fetch("HANAMI_ENV", "development")
      if env == "development" || env == "test"
        LocalAdapter.new
      else
        require_relative "storage/s3_adapter"
        S3Adapter.new
      end
    end
```

(Leave the unconditional `require_relative "storage/local_adapter"` at the top of the file as-is — same pattern `lib/cognito.rb` uses for `FakeAdapter`.)

- [ ] **Step 3: Run the existing storage specs**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/lib/storage_spec.rb spec/lib/storage/local_adapter_spec.rb spec/lib/storage/adapter_spec.rb`
Expected: all pass, including `"returns LocalAdapter by default"` (test env still resolves to `LocalAdapter`, unchanged).

- [ ] **Step 4: Commit**

```bash
git add dystopia/monolith/lib/storage/s3_adapter.rb dystopia/monolith/lib/storage.rb
git commit -s -m "feat(dystopia/monolith): add S3-backed storage adapter for production"
```

---

### Task 3: Ruby — drop stored media URLs, resolve from Storage on every read

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20260925130000_drop_url_columns_from_media_files.rb`
- Modify: `dystopia/monolith/slices/media/relations/files.rb`
- Modify: `dystopia/monolith/slices/media/repositories/media_repository.rb`
- Modify: `dystopia/monolith/slices/media/use_cases/register_media.rb`
- Test: `dystopia/monolith/spec/slices/media/relations/files_spec.rb`
- Test: `dystopia/monolith/spec/slices/media/repositories/media_repository_spec.rb`

**Interfaces:**
- Consumes: `Storage.download_url(key:)` (module method, delegates to whatever `Storage.adapter` currently is — see Task 2). For a blank/nil key it returns `""` (both `LocalAdapter` and `S3Adapter` already guard `return "" if key.to_s.empty?`), so `resolve_urls` never needs its own blank-key branch.
- Produces: `MediaRepository::MediaRecord` — a `Data.define(:id, :media_type, :url, :thumbnail_url, :filename, :content_type, :size_bytes, :media_key, :thumbnail_key, :created_at, :uploader_account_id)` value object. `#create`, `#find_by_id`, `#find_by_ids` all now return this type (or `nil`/`[]`) instead of the raw ROM struct. No caller-visible interface change beyond that — every field consumers read today (`slices/post/adapters/media_adapter.rb`, `slices/profile/adapters/media_adapter.rb`, `slices/karte/adapters/media_adapter.rb`, `Media::Presenters::MediaPresenter`) is still a plain attribute reader with the same name, so none of those files need to change.

- [ ] **Step 1: Write the migration**

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"media__files" do
      drop_column :url
      drop_column :thumbnail_url
    end
  end

  down do
    alter_table :"media__files" do
      add_column :url, :text, null: false, default: ""
      add_column :thumbnail_url, :text
    end
  end
end
```

Save as `dystopia/monolith/config/db/migrate/20260925130000_drop_url_columns_from_media_files.rb` (this repo's precedent for the same kind of drop is `config/db/migrate/20260218220000_remove_legacy_media_columns.rb` — same `alter_table` / `drop_column` shape).

- [ ] **Step 2: Run the migration against the test database**

Run: `cd dystopia/monolith && docker-compose up -d db && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: no errors; migration `20260925130000` applied.

- [ ] **Step 3: Update the relation schema**

Replace the full contents of `dystopia/monolith/slices/media/relations/files.rb` with:

```ruby
# frozen_string_literal: true

module Media
  module Relations
    class Files < Media::DB::Relation
      schema(:"media__files", as: :files, infer: false) do
        attribute :id, Types::String
        attribute :media_type, Types::String
        attribute :filename, Types::String.optional
        attribute :content_type, Types::String.optional
        attribute :size_bytes, Types::Integer.optional
        attribute :media_key, Types::String.optional
        attribute :thumbnail_key, Types::String.optional
        attribute :created_at, Types::Time
        attribute :uploader_account_id, Types::String.optional

        primary_key :id
      end
    end
  end
end
```

- [ ] **Step 4: Update the relation spec**

Replace the full contents of `dystopia/monolith/spec/slices/media/relations/files_spec.rb` with:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Media::Relations::Files", type: :database do
  let(:relation) { Hanami.app.slices[:media]["relations.files"] }

  it "defines the correct schema" do
    expect(relation.schema.primary_key_name).to eq(:id)
    attribute_names = relation.schema.attributes.map(&:name)
    expect(attribute_names).to include(:media_type)
    expect(attribute_names).to include(:filename)
    expect(attribute_names).to include(:content_type)
    expect(attribute_names).to include(:media_key)
    expect(attribute_names).not_to include(:url)
    expect(attribute_names).not_to include(:thumbnail_url)
  end

  it "maps to the correct table" do
    expect(relation.name.dataset).to eq(:"media__files")
  end
end
```

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/media/relations/files_spec.rb`
Expected: passes against the migrated schema.

- [ ] **Step 5: Write the failing repository tests**

Replace the full contents of `dystopia/monolith/spec/slices/media/repositories/media_repository_spec.rb` with:

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Media::Repositories::MediaRepository", type: :database do
  let(:repo) { Hanami.app.slices[:media]["repositories.media_repository"] }

  describe "#create" do
    it "creates a new media record with a url resolved from Storage" do
      media_key = "media/image/#{SecureRandom.uuid_v7}.jpg"
      media = repo.create(
        id: SecureRandom.uuid_v7,
        media_type: "image",
        media_key: media_key,
        filename: "image.jpg",
        content_type: "image/jpeg",
        size_bytes: 1024
      )

      expect(media.id).not_to be_nil
      expect(media.media_type).to eq("image")
      expect(media.url).to eq(Storage.download_url(key: media_key))
      expect(media.filename).to eq("image.jpg")
    end
  end

  describe "#find_by_id" do
    let(:media_key) { "media/video/#{SecureRandom.uuid_v7}.mp4" }
    let!(:created_media) do
      repo.create(
        id: SecureRandom.uuid_v7,
        media_type: "video",
        media_key: media_key,
        filename: "video.mp4",
        content_type: "video/mp4"
      )
    end

    it "returns the media when found" do
      media = repo.find_by_id(created_media.id)
      expect(media).not_to be_nil
      expect(media.id).to eq(created_media.id)
    end

    it "returns nil when not found" do
      media = repo.find_by_id(SecureRandom.uuid_v7)
      expect(media).to be_nil
    end

    it "resolves the url from Storage using the stored media_key" do
      media = repo.find_by_id(created_media.id)

      expect(media.url).to eq(Storage.download_url(key: media_key))
    end

    it "resolves the thumbnail_url from Storage using the stored thumbnail_key" do
      thumbnail_key = "media/video/#{SecureRandom.uuid_v7}_thumb.jpg"
      created = repo.create(
        id: SecureRandom.uuid_v7,
        media_type: "video",
        media_key: "media/video/#{SecureRandom.uuid_v7}.mp4",
        thumbnail_key: thumbnail_key
      )

      media = repo.find_by_id(created.id)

      expect(media.thumbnail_url).to eq(Storage.download_url(key: thumbnail_key))
    end

    it "returns an empty url when there is no media_key" do
      created = repo.create(id: SecureRandom.uuid_v7, media_type: "image")

      media = repo.find_by_id(created.id)

      expect(media.url).to eq("")
    end
  end

  describe "#find_by_ids" do
    let!(:media1) do
      repo.create(id: SecureRandom.uuid_v7, media_type: "image", media_key: "media/image/#{SecureRandom.uuid_v7}.jpg")
    end

    let!(:media2) do
      repo.create(id: SecureRandom.uuid_v7, media_type: "image", media_key: "media/image/#{SecureRandom.uuid_v7}.jpg")
    end

    it "returns multiple media records" do
      result = repo.find_by_ids([media1.id, media2.id])
      expect(result.size).to eq(2)
    end

    it "returns empty array for empty input" do
      expect(repo.find_by_ids([])).to eq([])
      expect(repo.find_by_ids(nil)).to eq([])
    end

    it "resolves urls for every returned media" do
      result = repo.find_by_ids([media1.id])

      expect(result.first.url).to eq(Storage.download_url(key: media1.media_key))
    end
  end

  describe "#delete" do
    let!(:media) do
      repo.create(id: SecureRandom.uuid_v7, media_type: "image", media_key: "media/image/#{SecureRandom.uuid_v7}.jpg")
    end

    it "deletes the media record" do
      repo.delete(media.id)
      expect(repo.find_by_id(media.id)).to be_nil
    end
  end
end
```

- [ ] **Step 6: Run the new tests and verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/media/repositories/media_repository_spec.rb`
Expected: FAIL — `create` still requires a `url:` keyword argument that these tests no longer pass, and `.url` is not yet resolved from `Storage`.

- [ ] **Step 7: Implement the repository**

Replace the full contents of `dystopia/monolith/slices/media/repositories/media_repository.rb` with:

```ruby
# frozen_string_literal: true

require "storage"

module Media
  module Repositories
    class MediaRepository < Media::DB::Repo
      MediaRecord = Data.define(
        :id, :media_type, :url, :thumbnail_url, :filename, :content_type,
        :size_bytes, :media_key, :thumbnail_key, :created_at, :uploader_account_id
      )

      def find_by_id(id)
        resolve_urls(files.by_pk(id).one)
      end

      def find_by_ids(ids)
        return [] if ids.nil? || ids.empty?

        files.where(id: ids).to_a.map { |file| resolve_urls(file) }
      end

      def find_by_media_key(media_key)
        files.where(media_key: media_key).one
      end

      def create(id:, media_type:, filename: nil, content_type: nil, size_bytes: nil, media_key: nil, thumbnail_key: nil, uploader_account_id: nil)
        resolve_urls(files.command(:create).call(
          id: id,
          media_type: media_type,
          filename: filename,
          content_type: content_type,
          size_bytes: size_bytes,
          media_key: media_key,
          thumbnail_key: thumbnail_key,
          uploader_account_id: uploader_account_id
        ))
      end

      def delete(id)
        files.by_pk(id).command(:delete).call
      end

      def delete_by_uploader(account_id)
        files.where(uploader_account_id: account_id).command(:delete).call
      end

      private

      # url/thumbnail_url are not columns — always derived from the key so presigned S3 URLs never go stale.
      def resolve_urls(media)
        return nil unless media

        MediaRecord.new(
          id: media.id,
          media_type: media.media_type,
          url: Storage.download_url(key: media.media_key),
          thumbnail_url: Storage.download_url(key: media.thumbnail_key),
          filename: media.filename,
          content_type: media.content_type,
          size_bytes: media.size_bytes,
          media_key: media.media_key,
          thumbnail_key: media.thumbnail_key,
          created_at: media.created_at,
          uploader_account_id: media.uploader_account_id
        )
      end
    end
  end
end
```

- [ ] **Step 8: Simplify `RegisterMedia`**

Replace the full contents of `dystopia/monolith/slices/media/use_cases/register_media.rb` with:

```ruby
# frozen_string_literal: true

module Media
  module UseCases
    class RegisterMedia
      include Media::Deps[repo: "repositories.media_repository"]

      def call(media_id:, media_key:, media_type:, filename: nil, content_type: nil, size_bytes: nil, thumbnail_key: nil, uploader_account_id: nil)
        return nil if media_id.to_s.empty? || media_key.to_s.empty?

        repo.create(
          id: media_id,
          media_type: media_type,
          filename: filename,
          content_type: content_type,
          size_bytes: size_bytes,
          media_key: media_key,
          thumbnail_key: thumbnail_key,
          uploader_account_id: uploader_account_id
        )
      end
    end
  end
end
```

(Drops the `require "storage"` and the two `Storage.download_url` calls this file used to make — `MediaRepository#create` resolves them now.)

- [ ] **Step 9: Run the tests and verify they pass**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/media/repositories/media_repository_spec.rb`
Expected: all pass.

- [ ] **Step 10: Run the full media slice + storage spec suite as a regression check**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/media spec/lib/storage_spec.rb spec/lib/storage`
Expected: all pass — this also re-runs `spec/slices/media/use_cases/purge_account_spec.rb`, which does not touch `url`/`thumbnail_url` and should be unaffected.

- [ ] **Step 11: Commit**

```bash
git add dystopia/monolith/config/db/migrate/20260925130000_drop_url_columns_from_media_files.rb dystopia/monolith/slices/media/relations/files.rb dystopia/monolith/slices/media/repositories/media_repository.rb dystopia/monolith/slices/media/use_cases/register_media.rb dystopia/monolith/spec/slices/media/relations/files_spec.rb dystopia/monolith/spec/slices/media/repositories/media_repository_spec.rb
git commit -s -m "fix(dystopia/monolith): drop stored media urls, resolve from storage on every read"
```

---

### Task 4: Kubernetes — wire production env vars

**Files:**
- Create: `dystopia/monolith/kubernetes/overlays/production/configmap.yaml`
- Modify: `dystopia/monolith/kubernetes/overlays/production/kustomization.yaml`
- Modify: `dystopia/frontend/kubernetes/overlays/production/configmap.yaml`

**Interfaces:**
- Consumes: `Storage::S3Adapter`'s `ENV.fetch("MEDIA_BUCKET_NAME")` / `ENV.fetch("MEDIA_BUCKET_REGION", ...)` (Task 2); `dystopia-media-production` bucket name (Task 1, literal — see Global Constraints on why it's not templated from a Terraform output here).
- Produces: nothing consumed by a later task — this is the last wiring step before manual/CI deploy.

- [ ] **Step 1: Create the monolith production ConfigMap patch**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: monolith
data:
  MEDIA_BUCKET_NAME: dystopia-media-production
  MEDIA_BUCKET_REGION: ap-northeast-1
```

Save as `dystopia/monolith/kubernetes/overlays/production/configmap.yaml`.

- [ ] **Step 2: Register the patch in the overlay's kustomization**

In `dystopia/monolith/kubernetes/overlays/production/kustomization.yaml`, change:

```yaml
patches:
  - path: deployment.yaml
```

to:

```yaml
patches:
  - path: configmap.yaml
  - path: deployment.yaml
```

- [ ] **Step 3: Validate the kustomize build**

Run: `cd dystopia/monolith/kubernetes/overlays/production && kustomize build .`
Expected: renders without error; output's `ConfigMap/monolith` includes `MEDIA_BUCKET_NAME: dystopia-media-production` and `MEDIA_BUCKET_REGION: ap-northeast-1`.

(No frontend ConfigMap change in this task — see the Global Constraints correction: `next.config.ts`'s `output: "standalone"` freezes config at `pnpm build` time, so a runtime-only ConfigMap value can never reach it. Task 5 fixes the frontend side without a per-environment env var at all.)

- [ ] **Step 4: Commit**

```bash
git add dystopia/monolith/kubernetes/overlays/production/configmap.yaml dystopia/monolith/kubernetes/overlays/production/kustomization.yaml
git commit -s -m "feat(dystopia/monolith): wire production media bucket env vars"
```

---

### Task 5: Frontend — bypass next/image optimization instead of chasing a runtime env var

**Files:**
- Modify: `dystopia/frontend/next.config.ts`
- Modify: `dystopia/frontend/kubernetes/overlays/production/configmap.yaml`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by a later task.

**Why not `remotePatterns` at all:** confirmed by running `pnpm build` in this worktree — with `output: "standalone"`, Next.js reads `next.config.ts` once during `next build` and serializes the resolved `images` config as a static object literal into `.next/standalone/server.js` and `.next/standalone/.next/required-server-files.json`; neither is re-read from the container's environment at `node server.js` boot. Since this repo's `Dockerfile`/CI workflow pass no `NEXT_PUBLIC_MEDIA_URL` build-arg, any `remotePatterns` value derived from that env var is permanently frozen to its `pnpm build`-time value (the `http://localhost:3000` fallback) in every built image — a Kubernetes ConfigMap can never fix this at runtime. Setting `images.unoptimized: true` sidesteps the problem structurally: `next/image` then renders the original URL directly without proxying through the `/_next/image` optimization endpoint, so `remotePatterns` matching (and therefore this build-time-freeze issue) becomes irrelevant. The only two `next/image` usages in this repo are `src/components/ui/post-card.tsx` and `src/modules/karte/components/KarteEntryCard.tsx` (confirmed via repo-wide grep); avatars render through Radix's `AvatarPrimitive.Image` (a plain `<img>`, never subject to `remotePatterns` in the first place).

- [ ] **Step 1: Replace the remotePatterns approach with unoptimized: true**

Replace the full contents of `dystopia/frontend/next.config.ts` with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@frontend/rpc"],
  images: {
    // Media host (dev: local disk, prod: S3) isn't knowable at `next build` time in standalone
    // output, so skip the optimizer entirely instead of a remotePatterns value that would freeze
    // to whatever NEXT_PUBLIC_MEDIA_URL happened to be at build time.
    unoptimized: true,
  },
};

export default nextConfig;
```

- [ ] **Step 2: Remove the now-unused NEXT_PUBLIC_MEDIA_URL wiring from the frontend production ConfigMap**

In `dystopia/frontend/kubernetes/overlays/production/configmap.yaml`, confirm it has no `NEXT_PUBLIC_MEDIA_URL` line (Task 4 no longer adds one — see Task 4's Step 3 correction). If this repo state still has one from an earlier attempt, remove it; the file should have exactly its original five `data:` entries (`MONOLITH_URL`, `COGNITO_ADAPTER`, `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`).

- [ ] **Step 3: Type-check the frontend**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit`
Expected: no new errors (per project memory, `pnpm lint` itself is broken on this repo's ESLint pin — use `tsc` for verification, not lint).

- [ ] **Step 4: Validate the kustomize build**

Run: `cd dystopia/frontend/kubernetes/overlays/production && kustomize build .`
Expected: renders without error; `ConfigMap/frontend` has exactly its original five `data:` entries, no `NEXT_PUBLIC_MEDIA_URL`.

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/next.config.ts dystopia/frontend/kubernetes/overlays/production/configmap.yaml
git commit -s -m "fix(dystopia/frontend): bypass next/image optimization for S3-hosted media"
```

---

## Final Verification (manual, after CI applies Task 1's Terraform and redeploys monolith/frontend)

1. Confirm the CI-applied bucket name matches the literal used in Task 4 (`dystopia-media-production`) — if Terraform's actual applied name ever diverges (e.g. someone edits `s3.tf` bucket naming later), update Task 4's ConfigMap to match.
2. From a real device (the original bug report was from a smartphone), sign in to production, upload a profile photo, and attach an image to a post. Confirm both succeed and the image renders afterward (exercises `S3Adapter#upload_url`/`#download_url` end-to-end, and `next/image`'s `unoptimized: true` path for the post-card/karte-entry-card image usages).
3. Check monolith logs for the deploy for any `Aws::Errors::MissingCredentialsError` or `Aws::S3::Errors::AccessDenied` — would indicate the Pod Identity association or IAM policy from Task 1 didn't propagate.
4. **Deploy ordering note (final-review finding):** Task 3's migration (`20260925130000_drop_url_columns_from_media_files.rb`) is a hard breaking schema change — this repo's `monolith` deployment has no automated coordination between "run migrations" and "roll out the new image" (no migration step found in `.github/workflows/*.yaml` or the Kubernetes manifests), and the default `RollingUpdate` strategy means old and new pods can briefly overlap. If the migration runs before the new image is live, the still-running old pod's code (which still reads `url` as a real column) will error on every media read; if it runs after, the DB's `url` column is still `NOT NULL` until the migration completes and every new upload will raise a not-null constraint violation. Apply the migration immediately before or after the image rollout, not on a separate/delayed schedule — the same risk shape already applies to this repo's precedent migration (`20260218220000_remove_legacy_media_columns.rb`), so this isn't a new operational requirement, just one worth calling out explicitly for this deploy.
