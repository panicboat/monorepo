# Auth / Onboarding Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild real Login/Signup/Onboarding/Password-reset on the existing identity backend, move SMS to Amazon SNS via a `lib/sms` adapter (always-random code in every env; send-only fake in test; drop the 0000 mock), and add a `ResetPassword` RPC.

**Architecture:** Backend adds a `lib/sms` adapter (mirroring `lib/storage`: base interface + SNS impl + fake impl, env-selected), rewrites `SendCode` to always generate a random 6-digit code and send via the adapter, and adds a `ResetPassword` RPC/use_case/handler. Frontend creates the missing auth UI pages wired to the already-complete `useAuth` hook + BFF routes, fixes the dangling `/cast/*` redirects to single routes, and adds an unauthenticated→/login guard.

**Tech Stack:** Hanami 2.3 / ROM-SQL / Gruf gRPC / RSpec / BCrypt / aws-sdk-sns (monolith); buf + protoc-gen-es (proto); Next.js 16 App Router / React 19 / Zustand (frontend).

**Spec:** `docs/superpowers/specs/2026-06-20-auth-onboarding-rebuild-design.md`

**Verification conventions:**
- monolith: `env -u NODE_OPTIONS bundle exec rspec <path>`; after Gemfile change also `env -u NODE_OPTIONS bundle install && env -u NODE_OPTIONS bundle install --frozen`.
- proto: `./bin/codegen` from repo root.
- frontend: no unit-test harness — gate is `tsc --noEmit` + `pnpm lint` (0e/0w) + `pnpm build`.
- Run monolith/Ruby with `env -u NODE_OPTIONS`. Bare `find`/`grep` are shadowed — use `/usr/bin/find` / `/usr/bin/grep`.
- Commits: `-s` signoff, NO Co-Authored-By, English. No push/PR from task subagents.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `services/monolith/workspace/Gemfile` | add `aws-sdk-sns` | Modify |
| `services/monolith/workspace/lib/sms.rb` | `Sms` module: adapter selection + `send` | Create |
| `services/monolith/workspace/lib/sms/adapter.rb` | base interface | Create |
| `services/monolith/workspace/lib/sms/sns_adapter.rb` | Amazon SNS publish | Create |
| `services/monolith/workspace/lib/sms/fake_adapter.rb` | in-memory, test/CI | Create |
| `services/monolith/workspace/slices/identity/use_cases/verification/send_code.rb` | random code + Sms.send | Modify |
| `services/monolith/workspace/spec/.../send_code_spec.rb` | spec via FakeAdapter | Create/Modify |
| `proto/identity/v1/service.proto` | `ResetPassword` RPC + messages | Modify |
| `services/monolith/workspace/slices/identity/repositories/user_repository.rb` | `update_password` | Modify |
| `services/monolith/workspace/slices/identity/use_cases/auth/reset_password.rb` | reset password use_case | Create |
| `services/monolith/workspace/slices/identity/grpc/handler.rb` | bind `ResetPassword` | Modify |
| `services/monolith/workspace/spec/.../reset_password_spec.rb` | spec | Create |
| `services/frontend/workspace/src/app/login/page.tsx` | login page | Create |
| `services/frontend/workspace/src/app/signup/page.tsx` | signup multi-step | Create |
| `services/frontend/workspace/src/app/onboarding/page.tsx` | minimal onboarding | Create |
| `services/frontend/workspace/src/app/reset-password/page.tsx` | reset flow | Create |
| `services/frontend/workspace/src/app/api/identity/reset-password/route.ts` | BFF | Create |
| `services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx` | fix `/cast/*` redirects + add `resetPassword` | Modify |
| `services/frontend/workspace/src/components/shell/AppShell.tsx` | unauth → /login guard | Modify |

---

## Task B1: lib/sms adapter + aws-sdk-sns

**Files:**
- Modify: `services/monolith/workspace/Gemfile`
- Create: `lib/sms.rb`, `lib/sms/adapter.rb`, `lib/sms/sns_adapter.rb`, `lib/sms/fake_adapter.rb` (under `services/monolith/workspace/`)

- [ ] **Step 1: Add the gem**

In `services/monolith/workspace/Gemfile`, near the existing `gem "aws-sdk-s3", "~> 1.220"` line, add:

```ruby
gem "aws-sdk-sns", "~> 1.100"
```

Run: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle install`
Then verify frozen: `env -u NODE_OPTIONS bundle install --frozen`
Expected: `Bundle complete!` both times. (If the exact version errors, use the latest `1.x` bundler resolves and keep the `~> 1.x` form.)

- [ ] **Step 2: Create the base adapter**

Create `services/monolith/workspace/lib/sms/adapter.rb`:

```ruby
# frozen_string_literal: true

module Sms
  # Base adapter interface for SMS backends. Env-specific adapters
  # (SNS for real send, Fake for test) inherit from this.
  class Adapter
    # @param phone_number [String] E.164 destination
    # @param body [String] message text
    # @return [void]
    def send(phone_number:, body:)
      raise NotImplementedError, "#{self.class}#send must be implemented"
    end
  end
end
```

- [ ] **Step 3: Create the SNS adapter**

Create `services/monolith/workspace/lib/sms/sns_adapter.rb`:

```ruby
# frozen_string_literal: true

require "aws-sdk-sns"
require_relative "adapter"

module Sms
  # Sends SMS via Amazon SNS. Region/credentials resolve through the standard
  # AWS SDK chain (ENV / IAM role). Transactional SMS type for OTP delivery.
  class SnsAdapter < Adapter
    def initialize(client: nil)
      @client = client || Aws::SNS::Client.new
    end

    def send(phone_number:, body:)
      @client.publish(
        phone_number: phone_number,
        message: body,
        message_attributes: {
          "AWS.SNS.SMS.SMSType" => { data_type: "String", string_value: "Transactional" }
        }
      )
      nil
    end
  end
end
```

- [ ] **Step 4: Create the fake adapter**

Create `services/monolith/workspace/lib/sms/fake_adapter.rb`:

```ruby
# frozen_string_literal: true

require_relative "adapter"

module Sms
  # Test/CI adapter: records messages in memory, never hits the network.
  class FakeAdapter < Adapter
    attr_reader :sent

    def initialize
      @sent = []
    end

    def send(phone_number:, body:)
      @sent << { phone_number: phone_number, body: body }
      nil
    end
  end
end
```

- [ ] **Step 5: Create the Sms module (env selection)**

Create `services/monolith/workspace/lib/sms.rb`:

```ruby
# frozen_string_literal: true

require_relative "sms/adapter"
require_relative "sms/fake_adapter"

module Sms
  class << self
    # @return [Sms::Adapter]
    def adapter
      @adapter ||= default_adapter
    end

    # @param adapter [Sms::Adapter]
    def adapter=(adapter)
      @adapter = adapter
    end

    # Reset to env default.
    def reset!
      @adapter = nil
    end

    # @param phone_number [String]
    # @param body [String]
    def send(phone_number:, body:)
      adapter.send(phone_number: phone_number, body: body)
    end

    private

    def default_adapter
      if ENV.fetch("HANAMI_ENV", "development") == "test"
        FakeAdapter.new
      else
        # Required lazily so test/CI without aws creds don't load the SDK.
        require_relative "sms/sns_adapter"
        SnsAdapter.new
      end
    end
  end
end
```

- [ ] **Step 6: Commit**

```bash
git add services/monolith/workspace/Gemfile services/monolith/workspace/Gemfile.lock services/monolith/workspace/lib/sms.rb services/monolith/workspace/lib/sms/
git commit -s -m "feat(identity): add lib/sms adapter (SNS + fake) for SMS delivery"
```

---

## Task B2: Rewrite SendCode (random code + Sms.send, drop mock) (TDD)

**Files:**
- Modify: `services/monolith/workspace/slices/identity/use_cases/verification/send_code.rb`
- Create/Modify: `services/monolith/workspace/spec/slices/identity/use_cases/verification/send_code_spec.rb`

- [ ] **Step 1: Write the failing spec**

Create (or replace) `services/monolith/workspace/spec/slices/identity/use_cases/verification/send_code_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "sms"

RSpec.describe Identity::UseCases::Verification::SendCode do
  subject(:use_case) { Identity::Slice["use_cases.verification.send_code"] }

  let(:phone) { "+819012345678" }
  let(:fake) { Sms::FakeAdapter.new }

  before { Sms.adapter = fake }
  after { Sms.reset! }

  it "generates a 6-digit numeric code and persists it" do
    verification = use_case.call(phone_number: phone)
    expect(verification.code).to match(/\A\d{6}\z/)
    expect(verification.phone_number).to eq(phone)
  end

  it "sends the generated code via the SMS adapter (no mock 0000)" do
    verification = use_case.call(phone_number: phone)
    expect(fake.sent.size).to eq(1)
    expect(fake.sent.first[:phone_number]).to eq(phone)
    expect(fake.sent.first[:body]).to include(verification.code)
    expect(verification.code).not_to eq("0000")
  end
end
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity/use_cases/verification/send_code_spec.rb`
Expected: FAIL — current `SendCode` returns "0000" and does not call `Sms.send` (the adapter assertion fails).

- [ ] **Step 3: Rewrite SendCode**

Replace `services/monolith/workspace/slices/identity/use_cases/verification/send_code.rb` with:

```ruby
# frozen_string_literal: true

require "securerandom"
require "sms"

module Identity
  module UseCases
    module Verification
      class SendCode
        include Identity::Deps[repo: "repositories.sms_verification_repository"]

        CODE_TTL_SECONDS = 60 * 10

        def call(phone_number:)
          code = format("%06d", SecureRandom.random_number(1_000_000))
          expires_at = Time.now + CODE_TTL_SECONDS

          verification = repo.create(
            phone_number: phone_number,
            code: code,
            expires_at: expires_at
          )

          Sms.send(phone_number: phone_number, body: "認証コード: #{code}")

          verification
        end
      end
    end
  end
end
```

This removes the `MOCK_SMS_CODE` fallback, the fixed "0000", and the `puts "[SMS MOCK]"`.

- [ ] **Step 4: Run the spec to verify it passes**

Run: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity/use_cases/verification/send_code_spec.rb`
Expected: PASS (2 examples).

- [ ] **Step 5: Confirm no mock references remain**

Run: `/usr/bin/grep -rn "MOCK_SMS_CODE\|SMS MOCK\|\"0000\"" services/monolith/workspace/slices services/monolith/workspace/lib`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add services/monolith/workspace/slices/identity/use_cases/verification/send_code.rb services/monolith/workspace/spec/slices/identity/use_cases/verification/send_code_spec.rb
git commit -s -m "feat(identity): SendCode generates random code and sends via SMS adapter"
```

---

## Task B3: ResetPassword RPC + use_case + handler (TDD)

**Files:**
- Modify: `proto/identity/v1/service.proto`
- Modify: `services/monolith/workspace/slices/identity/repositories/user_repository.rb`
- Create: `services/monolith/workspace/slices/identity/use_cases/auth/reset_password.rb`
- Modify: `services/monolith/workspace/slices/identity/grpc/handler.rb`
- Create: `services/monolith/workspace/spec/slices/identity/use_cases/auth/reset_password_spec.rb`

- [ ] **Step 1: Add the proto RPC + messages**

In `proto/identity/v1/service.proto`, add to the `IdentityService` service block (after `Logout`):

```proto
  rpc ResetPassword (ResetPasswordRequest) returns (ResetPasswordResponse);
```

And add the messages (after `LogoutResponse`):

```proto
message ResetPasswordRequest {
  string phone_number = 1;
  string new_password = 2;
  string verification_token = 3; // Must match the one from VerifySms
}

message ResetPasswordResponse {
  bool success = 1;
}
```

- [ ] **Step 2: Regenerate stubs**

Run from repo root: `./bin/codegen`
Expected: `[codegen] done.` Verify: `/usr/bin/grep -rn "ResetPassword" services/monolith/workspace/stubs/identity services/frontend/workspace/src/stub/identity` returns matches in both.

- [ ] **Step 3: Add `update_password` to UserRepository**

In `services/monolith/workspace/slices/identity/repositories/user_repository.rb`, add `commands update: :by_pk` under the class and a method:

```ruby
    class UserRepository < Identity::DB::Repo
      commands update: :by_pk

      # ... existing methods ...

      def update_password(user_id:, password_digest:)
        update(user_id, password_digest: password_digest, updated_at: Time.now)
      end
    end
```

(Keep all existing methods. `commands update: :by_pk` mirrors `ProfileRepository`/`CastRepository`.)

- [ ] **Step 4: Write the failing spec**

Create `services/monolith/workspace/spec/slices/identity/use_cases/auth/reset_password_spec.rb`:

```ruby
# frozen_string_literal: true

require "spec_helper"
require "bcrypt"

RSpec.describe Identity::UseCases::Auth::ResetPassword do
  subject(:use_case) { Identity::Slice["use_cases.auth.reset_password"] }

  let(:user_repo) { Identity::Slice["repositories.user_repository"] }
  let(:verification_repo) { Identity::Slice["repositories.sms_verification_repository"] }
  let(:phone) { "+819011112222" }

  def create_user(password:)
    user_repo.create(
      phone_number: phone,
      password_digest: BCrypt::Password.create(password),
      role: 2
    )
  end

  def verified_token
    v = verification_repo.create(phone_number: phone, code: "123456", expires_at: Time.now + 600)
    verification_repo.mark_as_verified(v.id)
    v.id
  end

  it "updates the password when the verification token is valid" do
    user = create_user(password: "oldpass1")
    token = verified_token

    result = use_case.call(phone_number: phone, new_password: "newpass2", verification_token: token)

    expect(result[:success]).to be true
    reloaded = user_repo.find_by_id(user.id)
    expect(BCrypt::Password.new(reloaded.password_digest)).to eq("newpass2")
  end

  it "rejects an unverified / mismatched token" do
    create_user(password: "oldpass1")
    unverified = verification_repo.create(phone_number: phone, code: "123456", expires_at: Time.now + 600)

    expect {
      use_case.call(phone_number: phone, new_password: "newpass2", verification_token: unverified.id)
    }.to raise_error(Identity::UseCases::Auth::ResetPassword::ResetError)
  end
end
```

- [ ] **Step 5: Run the spec to verify it fails**

Run: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity/use_cases/auth/reset_password_spec.rb`
Expected: FAIL — `ResetPassword` use_case does not exist.

- [ ] **Step 6: Create the use_case**

Create `services/monolith/workspace/slices/identity/use_cases/auth/reset_password.rb`:

```ruby
# frozen_string_literal: true

require "bcrypt"

module Identity
  module UseCases
    module Auth
      class ResetPassword
        class ResetError < StandardError; end

        include Identity::Deps[
          repo: "repositories.user_repository",
          verification_repo: "repositories.sms_verification_repository"
        ]

        def call(phone_number:, new_password:, verification_token:)
          verification = verification_repo.find_by_id(verification_token)
          raise ResetError, "Invalid verification token" unless verification
          raise ResetError, "Phone number mismatch" if verification.phone_number != phone_number
          raise ResetError, "Phone number not verified" unless verification.verified_at

          user = repo.find_by_phone_number(phone_number)
          raise ResetError, "User not found" unless user

          repo.update_password(
            user_id: user.id,
            password_digest: BCrypt::Password.create(new_password)
          )

          { success: true }
        end
      end
    end
  end
end
```

- [ ] **Step 7: Run the spec to verify it passes**

Run: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity/use_cases/auth/reset_password_spec.rb`
Expected: PASS (2 examples). If `verified_at` is not the column name, check the `sms_verifications` relation and match it (the Register use_case reads `verification.verified_at`).

- [ ] **Step 8: Bind the RPC in the handler**

In `services/monolith/workspace/slices/identity/grpc/handler.rb`: add the rpc declaration after the existing identity RPCs:

```ruby
      rpc :ResetPassword, ::Identity::V1::ResetPasswordRequest, ::Identity::V1::ResetPasswordResponse
```

Add `reset_password_uc` to the `Identity::Deps[...]` include, and add the handler method (mirror `register`'s shape — read the existing `register`/`login` methods for the exact request/response wiring and error-to-gRPC mapping):

```ruby
      def reset_password
        result = reset_password_uc.call(
          phone_number: request.message.phone_number,
          new_password: request.message.new_password,
          verification_token: request.message.verification_token
        )
        ::Identity::V1::ResetPasswordResponse.new(success: result[:success])
      rescue Identity::UseCases::Auth::ResetPassword::ResetError => e
        raise GRPC::InvalidArgument, e.message
      end
```

(Match the actual deps-injection key style used for the other use_cases in this handler — e.g. `reset_password_uc: "use_cases.auth.reset_password"`. Read the file's existing `Identity::Deps[...]` block and error handling before editing.)

- [ ] **Step 9: Verify the slice boots + identity specs pass**

Run: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity`
Expected: PASS (no boot errors from the handler change; the two new specs pass). Pre-existing unrelated failures, if any, are documented in prior PRs.

- [ ] **Step 10: Commit**

```bash
git add proto/identity/v1/service.proto services/monolith/workspace/stubs/identity services/frontend/workspace/src/stub/identity \
        services/monolith/workspace/slices/identity/repositories/user_repository.rb \
        services/monolith/workspace/slices/identity/use_cases/auth/reset_password.rb \
        services/monolith/workspace/slices/identity/grpc/handler.rb \
        services/monolith/workspace/spec/slices/identity/use_cases/auth/reset_password_spec.rb
git commit -s -m "feat(identity): ResetPassword RPC + use_case (SMS-verified password reset)"
```

---

## Task F1: Login + Signup pages

**Files:**
- Create: `services/frontend/workspace/src/app/login/page.tsx`
- Create: `services/frontend/workspace/src/app/signup/page.tsx`

Context: `useAuth()` (from `@/modules/identity/hooks/useAuth`) already exposes `requestSMS(phone)`, `verifySMS(phone, code) → verificationToken`, `register(phone, password, verificationToken, role)`, `login(phone, password, role?)`. `register`/`login` already set tokens and redirect. Use `@/components/ui/button` and `@/components/ui/input`. These are auth pages — they render outside the authed shell (AppShell bypasses unauth), so they are full-screen forms.

- [ ] **Step 1: Create the login page**

Create `services/frontend/workspace/src/app/login/page.tsx`: a `"use client"` page with phone + password inputs and a submit calling `useAuth().login(phone, password)`. Show an error message on throw. Include links to `/signup` and `/reset-password`. Use `Input`/`Button`. Center the form (`min-h-screen flex items-center`), wrap fields in `max-w-sm`.

- [ ] **Step 2: Create the signup page**

Create `services/frontend/workspace/src/app/signup/page.tsx`: a `"use client"` multi-step form with local `step` state:
- step "phone": phone input → `requestSMS(phone)` → step "code".
- step "code": 6-digit code input → `verifySMS(phone, code)` → store returned `verificationToken` → step "details".
- step "details": password input + role selector (Guest / Cast, mapped to 1 / 2) → `register(phone, password, verificationToken, role)`. `register` redirects on success.
Show per-step errors. Link back to `/login`.

- [ ] **Step 3: Verify the gate**

Run:
```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint
env -u NODE_OPTIONS pnpm build
```
Expected: tsc clean; lint 0e/0w; build compiled. (Note: `useAuth().register` redirects to `/onboarding` after F2 fixes it; until then it points at `/cast/onboarding` for cast — that's fixed in F2.)

- [ ] **Step 4: Commit**

```bash
git add services/frontend/workspace/src/app/login/page.tsx services/frontend/workspace/src/app/signup/page.tsx
git commit -s -m "feat(frontend): login + signup pages"
```

---

## Task F2: Onboarding page + fix useAuth redirects (single route)

**Files:**
- Create: `services/frontend/workspace/src/app/onboarding/page.tsx`
- Modify: `services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx`

- [ ] **Step 1: Fix the dangling redirects in useAuth**

In `services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx`:
- In `register`: replace the `if (isGuest) { router.push("/onboarding") } else { router.push("/cast/onboarding") }` block with a single `router.push("/onboarding")` (both roles).
- In `login`: replace the `if (isGuest) { router.push("/") } else { router.push("/cast/home") }` block with a single `router.push("/")` (both roles).

Read the exact surrounding code first; remove the now-unused `isGuest` branch logic only where it was solely for routing (keep `isGuest` if still used elsewhere in the same function).

- [ ] **Step 2: Create the onboarding page**

Create `services/frontend/workspace/src/app/onboarding/page.tsx`: a `"use client"` minimal page collecting 表示名 (display name) + handle (username). On submit, save via the existing profile-save path (`useProfile().saveProfile` or the profile BFF — read `src/modules/profile/hooks/useProfile.ts` for the exact API) then `router.push("/")`. Single route for both roles; if a role-specific hint is desired, branch on `useAuthStore(selectRole)` for copy only (no separate route). Provide a skip-less minimal required form (both fields required, since "minimal" still needs a usable profile handle).

- [ ] **Step 3: Verify no `/cast/` route references remain in app code**

Run: `/usr/bin/grep -rn '/cast/' services/frontend/workspace/src --include=*.tsx --include=*.ts | /usr/bin/grep -v '/api/cast/'`
Expected: no output (the only `cast` paths left are the unrelated `/api/cast/trust` BFF, which is excluded).

- [ ] **Step 4: Verify the gate**

Run:
```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint
env -u NODE_OPTIONS pnpm build
```
Expected: tsc clean; lint 0e/0w; build compiled.

- [ ] **Step 5: Commit**

```bash
git add services/frontend/workspace/src/app/onboarding/page.tsx services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx
git commit -s -m "feat(frontend): minimal onboarding page + single-route redirects"
```

---

## Task F3: Password reset page + BFF + useAuth.resetPassword

**Files:**
- Create: `services/frontend/workspace/src/app/api/identity/reset-password/route.ts`
- Modify: `services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx`
- Create: `services/frontend/workspace/src/app/reset-password/page.tsx`

- [ ] **Step 1: Create the BFF route**

Create `services/frontend/workspace/src/app/api/identity/reset-password/route.ts` (mirror `src/app/api/identity/register/route.ts`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { identityClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, newPassword, verificationToken } = body;

    const response = await identityClient.resetPassword(
      { phoneNumber, newPassword, verificationToken },
      { headers: buildGrpcHeaders(req.headers) }
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    return handleApiError(error, "ResetPassword");
  }
}
```

- [ ] **Step 2: Add `resetPassword` to useAuth**

In `services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx`, add a `resetPassword` function and expose it in the context value + type (mirror `register`'s fetch shape, but no token storage — just return on success):

```tsx
  const resetPassword = async (
    phoneNumber: string,
    newPassword: string,
    verificationToken: string
  ) => {
    const res = await fetch("/api/identity/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, newPassword, verificationToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "パスワードの再設定に失敗しました");
    return true;
  };
```

Add `resetPassword` to the context `value` object and to the context type (find the `type` / interface that lists `verifySMS`, `register`, `login` and add `resetPassword: (phoneNumber: string, newPassword: string, verificationToken: string) => Promise<boolean>;`).

- [ ] **Step 3: Create the reset-password page**

Create `services/frontend/workspace/src/app/reset-password/page.tsx`: a `"use client"` multi-step form reusing the SMS flow: phone → `requestSMS` → code → `verifySMS` (→ verificationToken) → new password → `resetPassword(phone, newPassword, verificationToken)` → `router.push("/login")`. Mirror the signup page's step structure. Link back to `/login`.

- [ ] **Step 4: Verify the gate**

Run:
```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint
env -u NODE_OPTIONS pnpm build
```
Expected: tsc clean; lint 0e/0w; build compiled.

- [ ] **Step 5: Commit**

```bash
git add services/frontend/workspace/src/app/api/identity/reset-password/route.ts \
        services/frontend/workspace/src/modules/identity/hooks/useAuth.tsx \
        services/frontend/workspace/src/app/reset-password/page.tsx
git commit -s -m "feat(frontend): password reset flow (page + BFF + useAuth.resetPassword)"
```

---

## Task F4: Unauthenticated → /login guard

**Files:**
- Modify: `services/frontend/workspace/src/components/shell/AppShell.tsx`

- [ ] **Step 1: Add the guard**

In `services/frontend/workspace/src/components/shell/AppShell.tsx`, the current behavior is: `if (!isHydrated || !viewerId) return <>{children}</>;` (unauth passes through). Change so that, once hydrated, an unauthenticated user on a non-auth route is redirected to `/login`. Auth routes are an allow-list that must render without auth:

```tsx
const AUTH_ROUTES = ["/login", "/signup", "/reset-password", "/onboarding"];
```

Logic:
- While not hydrated: render nothing/children as today (avoid flash).
- Hydrated + no `viewerId`:
  - if `usePathname()` starts with one of `AUTH_ROUTES` → render `<>{children}</>` (the auth page itself, no shell).
  - else → `useEffect(() => router.replace("/login"), [])` and render null (or a minimal loader).
- Hydrated + `viewerId` → render the full shell as today.

Use `usePathname` from `next/navigation`. Do the redirect in an effect (not during render). Keep the existing authed-shell branch unchanged.

- [ ] **Step 2: Verify the gate**

Run:
```bash
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm lint
env -u NODE_OPTIONS pnpm build
```
Expected: tsc clean; lint 0e/0w; build compiled.

- [ ] **Step 3: Commit**

```bash
git add services/frontend/workspace/src/components/shell/AppShell.tsx
git commit -s -m "feat(frontend): redirect unauthenticated users to /login"
```

---

## Task F5: Update session handoff doc

**Files:**
- Modify: `docs/superpowers/2026-06-18-session-handoff.md`

- [ ] **Step 1: Reflect the rebuild**

In `docs/superpowers/2026-06-18-session-handoff.md`, update the product-readiness notes (Section 11.3) that say "Login/Signup UI ❌ 解体済" and "SMS provider モック 0000 のまま": mark Login/Signup/Onboarding/Password-reset rebuilt, SMS moved to Amazon SNS (`lib/sms`, always-random, send-only fake in test), and `ResetPassword` RPC added. Match the surrounding table style. Reference `2026-06-20-auth-onboarding-rebuild-design.md`.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/2026-06-18-session-handoff.md
git commit -s -m "docs: mark auth/onboarding rebuild in session handoff"
```

---

## Final verification (before PR)

- [ ] monolith: `cd services/monolith/workspace && env -u NODE_OPTIONS bundle exec rspec spec/slices/identity` (green; pre-existing unrelated failures noted)
- [ ] Gemfile frozen: `env -u NODE_OPTIONS bundle install --frozen` → `Bundle complete!`
- [ ] proto in sync: `./bin/codegen` produces no diff on re-run; stubs contain `ResetPassword`
- [ ] no mock SMS: `/usr/bin/grep -rn "MOCK_SMS_CODE\|SMS MOCK\|\"0000\"" services/monolith/workspace/slices services/monolith/workspace/lib` → empty
- [ ] no `/cast/` page routes: `/usr/bin/grep -rn '/cast/' services/frontend/workspace/src --include=*.tsx --include=*.ts | /usr/bin/grep -v '/api/cast/'` → empty
- [ ] frontend gate: `cd services/frontend/workspace && env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit && env -u NODE_OPTIONS pnpm lint && env -u NODE_OPTIONS pnpm build`
- [ ] Manual (local e2e, real SNS in staging): signup (phone→SMS→password→role→onboarding) → land in app; logout → login; unauth visit of `/` redirects to `/login`; reset-password flow sets a new password and logs in with it.

**Success criteria (from spec):**
- All envs generate a random code; no `0000`/`MOCK_SMS_CODE` anywhere; test uses FakeAdapter (no real AWS).
- signup → login → unauth redirect → password reset all work.
- single route only; no `/cast/*` page route or redirect remains.
