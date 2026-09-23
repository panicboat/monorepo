# Dystopia Media S3 Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix GitHub issue #1210 (file upload fails in production for profile/post images) by giving `dystopia/monolith` a real production storage backend on S3, replacing the dev-only `Storage::LocalAdapter` that was silently the only adapter ever wired up.

**Architecture:** Add a `Storage::S3Adapter` that mirrors the existing `Cognito::AwsAdapter` / `Cognito::FakeAdapter` split (`lib/storage.rb#default_adapter` picks the adapter by `HANAMI_ENV`, exactly like `lib/cognito.rb#default_adapter`). The S3 bucket stays fully private; `S3Adapter#upload_url` issues a presigned PUT (for the browser's direct upload) and `S3Adapter#download_url` issues a presigned GET (regenerated on every read, never persisted long-term). Because `Media::UseCases::GetMedia`/`GetMediaBatch` are the single choke point every slice (post/profile/karte) and the gRPC handler go through, the "re-sign on read" behavior is implemented once in `Media::Repositories::MediaRepository` — no other slice needs to change.

**Tech Stack:** `aws-sdk-s3` (already in Gemfile, unused until now), Terraform/Terragrunt (`dystopia/infrastructure/aws`), Hanami 2 / ROM-SQL (`dystopia/monolith`), Next.js 16 (`dystopia/frontend`).

**Spec:** No separate spec doc — this plan is written directly from root-cause investigation done in this session (see Architecture above and Global Constraints below for the full rationale; there was no brainstorming-skill session preceding it because this started as a production bug report, not a new feature request).

## Global Constraints

- Root cause: `Storage.default_adapter` (`dystopia/monolith/lib/storage.rb`) always returns `LocalAdapter`, and `Middleware::LocalUploader` (the only thing that serves `LocalAdapter`'s upload URL) is mounted only under `Hanami.env?(:development)` (`dystopia/monolith/config/app.rb:12-15`). Production has never had a working upload path, regardless of device.
- `Media::UseCases::RegisterMedia` (`dystopia/monolith/slices/media/use_cases/register_media.rb:13`) persists `Storage.download_url(key:)`'s return value as a plain string in `media.files.url` at upload time. Presigned S3 GET URLs expire (max ~7 days under our EKS Pod Identity/STS credentials), so that value must never be trusted for reads — it must be recomputed fresh every time media is read. Do not change `register_media.rb` (the DB schema's `url` column is `NOT NULL`, per `dystopia/monolith/slices/media/relations/files.rb:9`, so it must keep writing something at create time; that write is simply never read back in production after this plan).
- Media reads only ever go through `Media::Repositories::MediaRepository#find_by_id` / `#find_by_ids` (verified: `find_by_media_key` has zero callers; no slice queries the `media__files` table directly). `slices/post/adapters/media_adapter.rb`, `slices/profile/adapters/media_adapter.rb`, `slices/karte/adapters/media_adapter.rb`, and `Media::Grpc::Handler` all call `Media::UseCases::GetMedia`/`GetMediaBatch`, which just delegate to the repository. Fixing the repository fixes every consumer.
- AWS access pattern in this repo is EKS Pod Identity, not IRSA annotations: `dystopia/infrastructure/aws/modules/pod_identity.tf` already associates the `monolith` ServiceAccount (namespace `dystopia`) with `aws_iam_role.monolith`. New S3 permissions are just another `aws_iam_policy` + `aws_iam_role_policy_attachment` onto that same role — no Kubernetes-side ServiceAccount change needed.
- Terraform naming/region conventions already established in `dystopia/infrastructure/aws/modules`: `var.environment = "production"`, `var.aws_region = "ap-northeast-1"`, resource names follow `"<service>-${var.environment}"` (e.g. `aws_iam_role.monolith` is named `"monolith-${var.environment}"`, Cognito pool is `"dystopia-production"`). Use `bucket = "dystopia-media-${var.environment}"` (→ `dystopia-media-production`) — no random/account-id suffix; this project's convention only adds an account-id suffix for genuinely generic names (the shared Terragrunt state bucket), not project-branded ones.
- Production frontend origin (for S3 CORS `allowed_origins`, since the presigned PUT is issued directly from the browser to S3) is `https://dystopia.city` (`dystopia/frontend/kubernetes/base/httproute.yaml:21`).
- `NEXT_PUBLIC_MEDIA_URL` is read only inside `dystopia/frontend/next.config.ts` (module-level `process.env` read, not inside any React component — confirmed via repo-wide grep), so it only needs to be correct in the **runtime** container env (`envFrom: configMapRef` in the Deployment). Next.js's `output: "standalone"` server re-evaluates `next.config.ts` at `node server.js` boot, and the Deployment already carries `reloader.stakater.com/auto: "true"`, so a ConfigMap change alone (no Docker/CI build-arg change) is sufficient. Do not touch `dystopia/frontend/Dockerfile` or `.github/workflows/reusable--container-builder.yaml` for this plan — confirmed unnecessary.
- Presigned PUT expiry: 300 seconds. Presigned GET expiry: 3600 seconds. These are plain constants in `Storage::S3Adapter`, not new configurable ENV vars (no requirement yet to tune them).
- IAM actions needed on the bucket for the `monolith` role: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` (presigned URLs are only honored at request time if the signing identity actually holds the permission for the signed action).
- `dystopia-media-production` in this plan is provisioned by Terraform but **applied by the existing CI pipeline** (`.github/workflows/reusable--terragrunt-executor.yaml` / `auto-label--deploy-trigger.yaml`), not by a local `terraform apply` from this session. Task 1's local verification is `terraform validate` / `terraform plan` only.

---

## File Structure

- `dystopia/infrastructure/aws/modules/s3.tf` (new) — S3 bucket, public access block, CORS, IAM policy + attachment for media storage.
- `dystopia/infrastructure/aws/modules/outputs.tf` (modify) — expose the bucket name for operator reference.
- `dystopia/monolith/lib/storage/s3_adapter.rb` (new) — `Storage::S3Adapter`, presigned PUT/GET + delete, mirrors `Cognito::AwsAdapter`.
- `dystopia/monolith/lib/storage.rb` (modify) — `default_adapter` switches on `HANAMI_ENV` like `lib/cognito.rb` does.
- `dystopia/monolith/slices/media/repositories/media_repository.rb` (modify) — re-resolve `url`/`thumbnail_url` from `Storage` on every read.
- `dystopia/monolith/spec/slices/media/repositories/media_repository_spec.rb` (modify) — tests for the re-resolve behavior and its fallback.
- `dystopia/monolith/kubernetes/overlays/production/configmap.yaml` (new) — `MEDIA_BUCKET_NAME` / `MEDIA_BUCKET_REGION`.
- `dystopia/monolith/kubernetes/overlays/production/kustomization.yaml` (modify) — register the new configmap patch.
- `dystopia/frontend/kubernetes/overlays/production/configmap.yaml` (modify) — `NEXT_PUBLIC_MEDIA_URL`.
- `dystopia/frontend/next.config.ts` (modify) — drop the `/uploads/**`-specific `pathname`, which no longer matches S3 keys.

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

### Task 3: Ruby — re-resolve media URLs from Storage on every read

**Files:**
- Modify: `dystopia/monolith/slices/media/repositories/media_repository.rb`
- Test: `dystopia/monolith/spec/slices/media/repositories/media_repository_spec.rb`

**Interfaces:**
- Consumes: `Storage.download_url(key:)` (module method, delegates to whatever `Storage.adapter` currently is — see Task 2).
- Produces: `MediaRepository#find_by_id(id)` / `#find_by_ids(ids)` continue to return the same struct type as before (`Media::DB::Struct` instances with `.id`, `.url`, `.thumbnail_url`, `.media_key`, `.thumbnail_key`, etc.) — only the `.url`/`.thumbnail_url` values change to be freshly resolved. No caller-visible interface change; `slices/post/adapters/media_adapter.rb`, `slices/profile/adapters/media_adapter.rb`, `slices/karte/adapters/media_adapter.rb`, and `Media::Grpc::Handler` need no changes.

- [ ] **Step 1: Write the failing tests**

Add to `dystopia/monolith/spec/slices/media/repositories/media_repository_spec.rb`, inside the existing `describe "#find_by_id"` block (after the existing two `it` blocks):

```ruby
    it "resolves the url from Storage using the stored media_key" do
      media_key = "media/image/#{SecureRandom.uuid_v7}.jpg"
      created = repo.create(
        id: SecureRandom.uuid_v7,
        media_type: "image",
        url: "https://stale.example.com/old.jpg",
        media_key: media_key
      )

      media = repo.find_by_id(created.id)

      expect(media.url).to eq(Storage.download_url(key: media_key))
      expect(media.url).not_to eq("https://stale.example.com/old.jpg")
    end

    it "resolves the thumbnail_url from Storage using the stored thumbnail_key" do
      thumbnail_key = "media/image/#{SecureRandom.uuid_v7}_thumb.jpg"
      created = repo.create(
        id: SecureRandom.uuid_v7,
        media_type: "image",
        url: "https://example.com/full.jpg",
        thumbnail_url: "https://stale.example.com/old_thumb.jpg",
        media_key: "media/image/#{SecureRandom.uuid_v7}.jpg",
        thumbnail_key: thumbnail_key
      )

      media = repo.find_by_id(created.id)

      expect(media.thumbnail_url).to eq(Storage.download_url(key: thumbnail_key))
    end

    it "keeps the stored url when media_key is blank" do
      created = repo.create(
        id: SecureRandom.uuid_v7,
        media_type: "image",
        url: "https://example.com/no-key.jpg"
      )

      media = repo.find_by_id(created.id)

      expect(media.url).to eq("https://example.com/no-key.jpg")
    end
```

And inside the existing `describe "#find_by_ids"` block:

```ruby
    it "resolves urls for every returned media" do
      key1 = "media/image/#{SecureRandom.uuid_v7}.jpg"
      m1 = repo.create(id: SecureRandom.uuid_v7, media_type: "image", url: "https://stale.example.com/1.jpg", media_key: key1)

      result = repo.find_by_ids([m1.id])

      expect(result.first.url).to eq(Storage.download_url(key: key1))
    end
```

- [ ] **Step 2: Confirm the environment can run database specs**

Run: `cd dystopia/monolith && docker-compose up -d db && HANAMI_ENV=test bundle exec hanami db create && HANAMI_ENV=test bundle exec hanami db migrate`
Expected: no errors (if the test DB already exists/migrated from a previous session, this is a no-op).

- [ ] **Step 3: Run the new tests and verify they fail**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/media/repositories/media_repository_spec.rb`
Expected: FAIL on the three new assertions — `media.url` still equals the stale stored value because `find_by_id`/`find_by_ids` don't resolve anything yet.

- [ ] **Step 4: Implement `resolve_urls` in the repository**

Replace the full contents of `dystopia/monolith/slices/media/repositories/media_repository.rb` with:

```ruby
# frozen_string_literal: true

require "storage"

module Media
  module Repositories
    class MediaRepository < Media::DB::Repo
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

      def create(id:, media_type:, url:, thumbnail_url: nil, filename: nil, content_type: nil, size_bytes: nil, media_key: nil, thumbnail_key: nil, uploader_account_id: nil)
        files.command(:create).call(
          id: id,
          media_type: media_type,
          url: url,
          thumbnail_url: thumbnail_url,
          filename: filename,
          content_type: content_type,
          size_bytes: size_bytes,
          media_key: media_key,
          thumbnail_key: thumbnail_key,
          uploader_account_id: uploader_account_id
        )
      end

      def delete(id)
        files.by_pk(id).command(:delete).call
      end

      def delete_by_uploader(account_id)
        files.where(uploader_account_id: account_id).command(:delete).call
      end

      private

      # Recomputed on every read so presigned S3 URLs never go stale in stored data.
      def resolve_urls(media)
        return nil unless media

        media.new(
          url: media.media_key.to_s.empty? ? media.url : Storage.download_url(key: media.media_key),
          thumbnail_url: media.thumbnail_key.to_s.empty? ? media.thumbnail_url : Storage.download_url(key: media.thumbnail_key)
        )
      end
    end
  end
end
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/media/repositories/media_repository_spec.rb`
Expected: all pass (including the pre-existing tests — `media.new(...)` from `dry-struct` returns a same-shape struct, so `.id`/`.media_type`/`.filename` assertions in the untouched tests are unaffected).

- [ ] **Step 6: Run the full media slice + storage spec suite as a regression check**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/media spec/lib/storage_spec.rb spec/lib/storage`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add dystopia/monolith/slices/media/repositories/media_repository.rb dystopia/monolith/spec/slices/media/repositories/media_repository_spec.rb
git commit -s -m "fix(dystopia/monolith): re-resolve media urls from storage on every read"
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

- [ ] **Step 3: Add the media URL to the frontend production ConfigMap**

In `dystopia/frontend/kubernetes/overlays/production/configmap.yaml`, add one line to `data:`:

```yaml
  NEXT_PUBLIC_MEDIA_URL: https://dystopia-media-production.s3.ap-northeast-1.amazonaws.com
```

(Full file after this change has five `data:` entries: `MONOLITH_URL`, `COGNITO_ADAPTER`, `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, plus this new one.)

- [ ] **Step 4: Validate the kustomize build**

Run: `cd dystopia/monolith/kubernetes/overlays/production && kustomize build .` and `cd dystopia/frontend/kubernetes/overlays/production && kustomize build .`
Expected: both render without error; the monolith output's `ConfigMap/monolith` includes `MEDIA_BUCKET_NAME: dystopia-media-production` and `MEDIA_BUCKET_REGION: ap-northeast-1`; the frontend output's `ConfigMap/frontend` includes the new `NEXT_PUBLIC_MEDIA_URL` line.

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/kubernetes/overlays/production/configmap.yaml dystopia/monolith/kubernetes/overlays/production/kustomization.yaml dystopia/frontend/kubernetes/overlays/production/configmap.yaml
git commit -s -m "feat(dystopia): wire production media bucket env vars"
```

---

### Task 5: Frontend — allow the S3 host in Next.js image config

**Files:**
- Modify: `dystopia/frontend/next.config.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_MEDIA_URL` (Task 4) at container runtime.
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Drop the dev-only `/uploads/**` pathname assumption**

Replace the full contents of `dystopia/frontend/next.config.ts` with:

```ts
import type { NextConfig } from "next";

// Media URL host differs per environment (dev: local disk, prod: S3) — derive remotePattern from NEXT_PUBLIC_MEDIA_URL instead of hardcoding it.
const mediaUrl = new URL(
  process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:3000"
);

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@frontend/rpc"],
  images: {
    remotePatterns: [
      {
        protocol: mediaUrl.protocol.replace(":", "") as "http" | "https",
        hostname: mediaUrl.hostname,
        port: mediaUrl.port || undefined,
      },
    ],
  },
};

export default nextConfig;
```

(This removes the `pathname: "/uploads/**"` restriction — S3 keys look like `media/image/<uuid>.jpg`, not `/uploads/...`, and dropping `pathname` still matches the dev `LocalAdapter` case since omitting it matches any path.)

- [ ] **Step 2: Type-check the frontend**

Run: `cd dystopia/frontend && pnpm exec tsc --noEmit`
Expected: no new errors (per project memory, `pnpm lint` itself is broken on this repo's ESLint pin — use `tsc` for verification, not lint).

- [ ] **Step 3: Commit**

```bash
git add dystopia/frontend/next.config.ts
git commit -s -m "fix(dystopia/frontend): allow S3-hosted media urls in next/image config"
```

---

## Final Verification (manual, after CI applies Task 1's Terraform and redeploys monolith/frontend)

1. Confirm the CI-applied bucket name matches the literal used in Task 4 (`dystopia-media-production`) — if Terraform's actual applied name ever diverges (e.g. someone edits `s3.tf` bucket naming later), update Task 4's ConfigMap to match.
2. From a real device (the original bug report was from a smartphone), sign in to production, upload a profile photo, and attach an image to a post. Confirm both succeed and the image renders afterward (exercises `S3Adapter#upload_url`, `#download_url`, and the Next.js `remotePatterns` change together).
3. Check monolith logs for the deploy for any `Aws::Errors::MissingCredentialsError` or `Aws::S3::Errors::AccessDenied` — would indicate the Pod Identity association or IAM policy from Task 1 didn't propagate.
