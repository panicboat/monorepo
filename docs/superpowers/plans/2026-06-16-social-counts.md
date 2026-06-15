# Social follower/following count display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/u/[username]` page にフォロワー数 / フォロー中数を表示する。spec の S5 で deferred されていた count display を回収するため、新 RPC `GetSocialCounts` を `social.v1.FollowService` に additive 追加し、proto → monolith → frontend のフル縦スライスを 1 PR で実装する。

**Architecture:** 既存 `FollowService` に **1 新 RPC** (`GetSocialCounts(account_id)` → `{following_count, followers_count}`) を additive 追加。pure additive で backward compatible。`Social::Repositories::FollowRepository` に 2 count method、use_case 1 個、handler 1 method、proto 1 RPC + 2 message、両 stub regen、frontend BFF + hook + page 表示の縦切り。

**Tech Stack:** Protobuf / Ruby (Hanami / ROM) / Next.js 16 / SWR / connect-es。

**Spec:** `docs/superpowers/specs/2026-06-15-social-slice-design.md` Frontend > UI 節 (count display が S5 で deferred、本 PR で回収)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-counts`、branch `feat/social-counts` (origin/main = `14f610f3`、F3 #688 マージ後)。**push しない**。
- 触らない: 既存 social.v1 RPCs、Post / Feed / Profile slice、他 hook / BFF、proto/social/v1/block_service.proto。

### 設計判断: 「Profile に count 埋め込み」vs「新 RPC」

新 RPC を採用。理由:
- profile.v1.Profile は list 系 RPC (`ListFollowing`、`ListFollowers`、`ListPendingFollowRequests`、`ListBlocked`) の `repeated` payload に乗っている。count を埋めると毎リスト行で count 計算が走り heavy。
- /u/[username] は 1 profile + 1 count 取得の 2 round trip で済む、許容可能。
- proto 拡張は social.v1 だけで閉じる、Profile coupling 不要。

## File Structure

**Modify (1 file、proto):**
- `proto/social/v1/follow_service.proto`

**Regenerate (4 file、両 stub):**
- `services/monolith/workspace/stubs/social/v1/follow_service_pb.rb`
- `services/monolith/workspace/stubs/social/v1/follow_service_services_pb.rb`
- `services/frontend/workspace/src/stub/social/v1/follow_service_pb.ts`
- (frontend は services_pb 無し、connect-es は `_pb` だけ)

**Modify (monolith、3 file):**
- `services/monolith/workspace/slices/social/repositories/follow_repository.rb` (2 count method 追加)
- `services/monolith/workspace/slices/social/grpc/follow_handler.rb` (rpc binding + handler method 追加)
- (新規) `services/monolith/workspace/slices/social/use_cases/follows/get_social_counts.rb`

**New (frontend、2 file):**
- `services/frontend/workspace/src/app/api/social/counts/route.ts` (BFF)
- `services/frontend/workspace/src/modules/social/hooks/useSocialCounts.ts` (hook)

**Modify (frontend、3 file):**
- `services/frontend/workspace/src/modules/social/hooks/index.ts` (re-export 追加)
- `services/frontend/workspace/src/modules/social/types.ts` (`SocialCounts` view 型)
- `services/frontend/workspace/src/app/u/[username]/page.tsx` (count display)

---

## Task 1: proto に `GetSocialCounts` 追加

**Files:** Modify `proto/social/v1/follow_service.proto`。

- [ ] **Step 1: service に RPC 追加**

旧 (service block 末尾):
```proto
  rpc GetPendingFollowCount(GetPendingFollowCountRequest) returns (GetPendingFollowCountResponse);
}
```

新:
```proto
  rpc GetPendingFollowCount(GetPendingFollowCountRequest) returns (GetPendingFollowCountResponse);
  rpc GetSocialCounts(GetSocialCountsRequest) returns (GetSocialCountsResponse);
}
```

- [ ] **Step 2: message 定義 (file 末尾に追加)**

```proto
message GetSocialCountsRequest {
  string account_id = 1;  // empty = viewer (current account)
}

message GetSocialCountsResponse {
  int32 following_count = 1;
  int32 followers_count = 2;
}
```

- [ ] **Step 3: buf lint**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/proto
buf lint 2>&1 | /usr/bin/tail -10
```

期待: 致命傷 error 無し (既存 warning は据置)。

---

## Task 2: 両 stub 再生成

実装 agent が proto 生成コマンドを runtime で確認 (`pnpm proto:gen` / `make proto` / `buf generate` のいずれか) し、social/v1 のみ再生成。

- [ ] **Step 1: 生成コマンド調査**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
/usr/bin/find . -maxdepth 4 -name "buf.gen.*" 2>&1 | /usr/bin/head -5
/usr/bin/grep -l "proto:gen\|proto-gen\|protobuf:gen" services/*/workspace/package.json 2>&1 | /usr/bin/head -5
```

- [ ] **Step 2: 生成実行**

判明したコマンドを実行 (例: `pnpm proto:gen`)。

- [ ] **Step 3: diff 確認**

```bash
/usr/bin/git status proto services/monolith/workspace/stubs services/frontend/workspace/src/stub
```

期待: social/v1/follow_service 関連の stub のみ regen で diff、他 stub に変化なし (proto は社会のみ変更)。

> **Note:** memory にあるとおり `pnpm proto:gen` は es plugin がバージョン非固定で、走らせると stub が churn する。本 PR では social 関連の必須差分のみ取り込み、他 stub の churn は revert (`git checkout -- path/to/other/stub`) 推奨。

---

## Task 3: `Social::Repositories::FollowRepository` に count method 追加

**Files:** Modify `slices/social/repositories/follow_repository.rb`。

`following_account_ids` の隣に追加 (line ~94)。

```ruby
def count_following(account_id:)
  follows.where(follower_id: account_id, status: "approved").count
end

def count_followers(account_id:)
  follows.where(followee_id: account_id, status: "approved").count
end
```

- [ ] **Step 1: 実装**

- [ ] **Step 2: Syntax check**

```bash
cd services/monolith/workspace && ruby -c slices/social/repositories/follow_repository.rb
```

---

## Task 4: `GetSocialCounts` use_case 新規

**Files:** Create `slices/social/use_cases/follows/get_social_counts.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class GetSocialCounts
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(account_id:)
          {
            following_count: follow_repo.count_following(account_id: account_id),
            followers_count: follow_repo.count_followers(account_id: account_id)
          }
        end
      end
    end
  end
end
```

- [ ] **Step 2: Syntax check**

```bash
ruby -c slices/social/use_cases/follows/get_social_counts.rb
```

---

## Task 5: `FollowHandler` に RPC + handler method 追加

**Files:** Modify `slices/social/grpc/follow_handler.rb`。

- [ ] **Step 1: rpc binding 追加**

`rpc :GetPendingFollowCount, ...` の直後に追加:

```ruby
rpc :GetSocialCounts, ::Social::V1::GetSocialCountsRequest, ::Social::V1::GetSocialCountsResponse
```

- [ ] **Step 2: Deps に use_case 追加**

`include Social::Deps[...]` ブロックの末尾に追記:

```ruby
get_social_counts_uc: "use_cases.follows.get_social_counts"
```

(直前の entry にカンマ付与を忘れずに。例: `get_pending_follow_count_uc: "use_cases.follows.get_pending_follow_count",`)

- [ ] **Step 3: handler method 追加**

`def get_pending_follow_count` の下に追記:

```ruby
def get_social_counts
  authenticate_user!
  account_id = request.message.account_id.empty? ? current_user_id : request.message.account_id
  result = get_social_counts_uc.call(account_id: account_id)
  ::Social::V1::GetSocialCountsResponse.new(
    following_count: result[:following_count],
    followers_count: result[:followers_count]
  )
end
```

- [ ] **Step 4: Syntax check**

```bash
ruby -c slices/social/grpc/follow_handler.rb
```

---

## Task 6: monolith 検証

- [ ] **Step 1: rspec baseline**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0 + profile 153/14 維持。

- [ ] **Step 2: container smoke**

```bash
bundle exec ruby -e '
  require "hanami/prepare"
  uc = Social::Slice["use_cases.follows.get_social_counts"]
  zero = "00000000-0000-0000-0000-000000000000"
  result = uc.call(account_id: zero)
  puts "GetSocialCounts(empty): #{result.inspect}"
' 2>&1 | /usr/bin/tail -5
```

期待: `GetSocialCounts(empty): {:following_count=>0, :followers_count=>0}`。

---

## Task 7: frontend types

**Files:** Modify `src/modules/social/types.ts`。

- [ ] **Step 1: 末尾に追記**

```typescript
export interface SocialCounts {
  followingCount: number;
  followersCount: number;
}
```

---

## Task 8: frontend BFF `/api/social/counts`

**Files:** Create `src/app/api/social/counts/route.ts`。

- [ ] **Step 1: 実装**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { socialFollowClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = buildGrpcHeaders(req.headers);
    const accountId = req.nextUrl.searchParams.get("account_id") || "";

    const res = await socialFollowClient.getSocialCounts({ accountId }, { headers });
    return NextResponse.json({
      followingCount: res.followingCount || 0,
      followersCount: res.followersCount || 0,
    });
  } catch (error: unknown) {
    return handleApiError(error, "GetSocialCounts");
  }
}
```

---

## Task 9: frontend hook `useSocialCounts`

**Files:** Create `src/modules/social/hooks/useSocialCounts.ts`。

- [ ] **Step 1: 実装**

```typescript
"use client";

import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import type { SocialCounts } from "../types";

export function useSocialCounts(accountId?: string) {
  const token = getAuthToken();
  const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
  const { data, error, isLoading, mutate } = useSWR<SocialCounts>(
    token ? `/api/social/counts${qs}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  return {
    followingCount: data?.followingCount ?? 0,
    followersCount: data?.followersCount ?? 0,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
```

- [ ] **Step 2: hooks/index.ts に re-export 追加**

```typescript
export * from "./useSocialCounts";
```

---

## Task 10: `/u/[username]/page.tsx` で count 表示

**Files:** Modify `src/app/u/[username]/page.tsx`。

- [ ] **Step 1: import 追加**

```tsx
import { FollowButton, BlockButton, useSocialCounts } from "@/modules/social";
```

- [ ] **Step 2: count fetch + 表示**

`PublicProfilePage` 内、`return` の前に追加:

```tsx
const counts = useSocialCounts(profile.accountId);
```

ProfileHeader の下、ボタン block の下に追加:

```tsx
<div className="flex gap-4 px-4 pt-3 text-sm text-text-secondary">
  <span>
    <strong className="text-text-primary">{counts.followingCount}</strong> フォロー中
  </span>
  <span>
    <strong className="text-text-primary">{counts.followersCount}</strong> フォロワー
  </span>
</div>
```

---

## Task 11: 検証 + commit

- [ ] **Step 1: frontend tsc / build / lint**

```bash
cd services/frontend/workspace
pnpm exec tsc --noEmit 2>&1 | /usr/bin/tail -10
pnpm build 2>&1 | /usr/bin/tail -20
pnpm lint 2>&1 | /usr/bin/tail -10
```

期待: tsc 緑、build 緑 + `/api/social/counts` route 出力に登場、lint baseline 同等。

- [ ] **Step 2: diff stat**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 1 proto + 4 stub regen (social のみ、他 stub は revert 済) + 3 monolith new/modify + 2 frontend new + 3 frontend modify + plan = **14 files 前後**。

- [ ] **Step 3: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-social-counts
/usr/bin/git add -A proto services/monolith/workspace services/frontend/workspace docs/superpowers/plans/2026-06-16-social-counts.md
/usr/bin/git commit -s -m "feat(social): follower/following count display on /u/[username]"
```

push しない。

---

## Deferred

- **post count display** on /u/[username] — Post slice 拡張、別 PR
- **counts SWR mutation on follow/unfollow** — `useFollow` から `useSocialCounts.refresh()` を trigger する設計、別 PR
- **profile に counts 埋め込み (proto coupling)** — 採用せず、現状の cross-slice fetch で進める

## Self-Review

- **Spec coverage**: S5 deferred の followers/following count を回収
- **Placeholder 無し**: 全 file 完全 code 提示
- **Additive**: 既存 RPC / message 無改変、stub regen 影響は社会のみ (他 stub の churn は revert)
- **型整合**:
  - proto `GetSocialCountsRequest{account_id}` → handler 経由 use_case `call(account_id:)`
  - frontend BFF query string `?account_id=X` → hook `useSocialCounts(accountId)`
  - response `following_count` / `followers_count` (snake) → connect-es 自動 camelCase (`followingCount` / `followersCount`)
- **検証**: monolith rspec + container smoke + frontend tsc/build/lint baseline 維持
