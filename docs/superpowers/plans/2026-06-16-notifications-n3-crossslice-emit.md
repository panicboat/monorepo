# Notifications N3: cross-slice emit hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** N2 (#693) で動いた `Notifications::UseCases::Emit` を、Post / Social 4 use_case/handler の正常完了パスから fire-and-forget で呼び出し、実 DB に notification row が積まれる状態にする。

**Architecture:** 各 caller (`Post::Grpc::LikeHandler#like_post`、`Post::UseCases::Comments::AddComment#call`、`Social::UseCases::Follows::Follow#call`、`Social::UseCases::Follows::ApproveFollowRequest#call`) の return 直前で `Notifications::Slice["use_cases.emit"].call(...)` を呼ぶ。Emit は内部 rescue 済 (suppression + error swallow)、caller は extra rescue 不要 = 1〜3 行追加で完結。

**Tech Stack:** Ruby / Hanami 2 cross-slice resolution。

**Spec:** `docs/superpowers/specs/2026-06-16-notifications-slice-design.md` (Event 発火元 表)。

---

## Context

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-notifications-n3-crossslice-emit`、branch `feat/notifications-n3-crossslice-emit` (origin/main = `a3c60a33`、N2 #693 マージ後)。**push しない**。
- 触らない: 他 use_case / handler、cross-slice contract 以外の挙動、frontend、proto、DB schema。

### 発火元と payload (確認済 / spec 通り)

| caller | type | recipient | target_resource_id | actor |
|---|---|---|---|---|
| `Post::Grpc::LikeHandler#like_post` (handler 直接実装、use_case 無し) | `like` | `post.author_id` | `post.id` | `current_user_id` |
| `Post::UseCases::Comments::AddComment#call` (parent_id 無し) | `comment` | `post.author_id` | `post.id` | `user_id` |
| `Post::UseCases::Comments::AddComment#call` (parent_id 有り = reply) | `reply` | `parent_comment.user_id` | `parent_id` | `user_id` |
| `Social::UseCases::Follows::Follow#call` (status='pending') | `follow_request` | `target_account_id` | `follower_id` | `follower_id` |
| `Social::UseCases::Follows::Follow#call` (status='approved') | `follow_approved` | `target_account_id` | `follower_id` | `follower_id` |
| `Social::UseCases::Follows::ApproveFollowRequest#call` | `follow_approved` | `requester_account_id` | `target_account_id` (approver) | `target_account_id` |

### 既存パターン (踏襲)

- cross-slice 呼出: `@notifications_emit ||= Notifications::Slice["use_cases.emit"]` の memoized private helper (社会 `Social::Follow#get_profile` と同形)
- Emit は内部 rescue 完備、caller は `notifications_emit.call(...)` のみ、戻り値は無視

## File Structure

**Modify (4 file):**
- `services/monolith/workspace/slices/post/grpc/like_handler.rb`
- `services/monolith/workspace/slices/post/use_cases/comments/add_comment.rb`
- `services/monolith/workspace/slices/social/use_cases/follows/follow.rb`
- `services/monolith/workspace/slices/social/use_cases/follows/approve_follow_request.rb`

**Plan (1 file):**
- `docs/superpowers/plans/2026-06-16-notifications-n3-crossslice-emit.md`

合計 5 file。

---

## Task 1: `Post::Grpc::LikeHandler` に emit 追加

**Files:** Modify `services/monolith/workspace/slices/post/grpc/like_handler.rb`。

`like_post` メソッドの response 直前で emit。post は既に line 24 で取得済、`post.author_id` を recipient に。

- [ ] **Step 1: `like_post` 修正**

旧:
```ruby
def like_post
  authenticate_user!

  post = post_repo.find_by_id(request.message.post_id)
  raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

  like_repo.account_like(post_id: request.message.post_id, account_id: current_user_id)
  ::Post::V1::LikePostResponse.new(likes_count: like_repo.likes_count(post_id: request.message.post_id))
end
```

新:
```ruby
def like_post
  authenticate_user!

  post = post_repo.find_by_id(request.message.post_id)
  raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

  like_repo.account_like(post_id: request.message.post_id, account_id: current_user_id)

  notifications_emit.call(
    recipient_id: post.author_id,
    type: "like",
    target_resource_id: post.id,
    actor_id: current_user_id
  )

  ::Post::V1::LikePostResponse.new(likes_count: like_repo.likes_count(post_id: request.message.post_id))
end
```

- [ ] **Step 2: handler クラス末尾の `private` block (無ければ追加) に helper 追加**

```ruby
private

def notifications_emit
  @notifications_emit ||= Notifications::Slice["use_cases.emit"]
end
```

(既存 `private` が無ければ class 末尾に `private` 行 + helper を追加。`like_handler.rb` は現状 `private` block 無し、追加が必要。)

- [ ] **Step 3: Syntax check**

```bash
cd services/monolith/workspace && ruby -c slices/post/grpc/like_handler.rb
```

---

## Task 2: `Post::UseCases::Comments::AddComment` に emit 追加

**Files:** Modify `services/monolith/workspace/slices/post/use_cases/comments/add_comment.rb`。

`comment = comment_repo.create_comment(...)` 成功直後 (line 56 の `raise CreateFailedError unless comment` 後)、return 直前で emit。

reply (parent_id 有り) → recipient = parent.user_id、type=reply、target_resource=parent_id
top-level (parent_id 無し) → recipient = post.author_id、type=comment、target_resource=post_id

注意: 既存 line 35 で `parent = comment_repo.find_by_id(parent_id)` で取得済だが scope 内で破棄される。reply 経路で再利用するため変数を残す。

- [ ] **Step 1: parent を scope に残す**

旧 (line 33-38):
```ruby
# Validate parent is a top-level comment (not a reply)
if parent_id
  parent = comment_repo.find_by_id(parent_id)
  raise ParentNotFoundError unless parent
  raise CannotReplyToReplyError if parent.parent_id
end
```

新:
```ruby
# Validate parent is a top-level comment (not a reply)
parent = nil
if parent_id
  parent = comment_repo.find_by_id(parent_id)
  raise ParentNotFoundError unless parent
  raise CannotReplyToReplyError if parent.parent_id
end
```

- [ ] **Step 2: return 直前で emit**

旧 (line 56-58):
```ruby
raise CreateFailedError unless comment

{ comment: comment, post_id: post_id }
```

新:
```ruby
raise CreateFailedError unless comment

if parent
  notifications_emit.call(
    recipient_id: parent.user_id,
    type: "reply",
    target_resource_id: parent.id,
    actor_id: user_id
  )
else
  notifications_emit.call(
    recipient_id: post.author_id,
    type: "comment",
    target_resource_id: post.id,
    actor_id: user_id
  )
end

{ comment: comment, post_id: post_id }
```

- [ ] **Step 3: クラス内 private helper 追加**

class 末尾の error class 定義群の **前** (call メソッドの後) に追加:

```ruby
private

def notifications_emit
  @notifications_emit ||= Notifications::Slice["use_cases.emit"]
end
```

(error class 群は `private` 配下に来てしまうと public class でなくなるので、helper を error class 群より上に配置する。または error class 群を public のまま残すため `private` を helper 直前のみ局所適用してもよい。最も単純なのは helper を call メソッド直下の private、error class 群を class 末尾に維持。)

- [ ] **Step 4: Syntax check**

```bash
ruby -c slices/post/use_cases/comments/add_comment.rb
```

---

## Task 3: `Social::UseCases::Follows::Follow` に emit 追加

**Files:** Modify `services/monolith/workspace/slices/social/use_cases/follows/follow.rb`。

`follow_repo.follow(...)` 成功直後 (line 22)、return 直前で emit。type は status で振り分け。

- [ ] **Step 1: emit 追加**

旧 (line 22-23):
```ruby
result = follow_repo.follow(follower_id: follower_id, followee_id: target_account_id, status: status)
{ status: result[:status] }
```

新:
```ruby
result = follow_repo.follow(follower_id: follower_id, followee_id: target_account_id, status: status)

notification_type = result[:status] == "approved" ? "follow_approved" : "follow_request"
notifications_emit.call(
  recipient_id: target_account_id,
  type: notification_type,
  target_resource_id: follower_id,
  actor_id: follower_id
)

{ status: result[:status] }
```

- [ ] **Step 2: private helper 追加**

`get_profile` 直下に追記:

```ruby
def notifications_emit
  @notifications_emit ||= Notifications::Slice["use_cases.emit"]
end
```

- [ ] **Step 3: Syntax check**

```bash
ruby -c slices/social/use_cases/follows/follow.rb
```

---

## Task 4: `Social::UseCases::Follows::ApproveFollowRequest` に emit 追加

**Files:** Modify `services/monolith/workspace/slices/social/use_cases/follows/approve_follow_request.rb`。

`follow_repo.update_status(...)` 成功直後で emit。recipient は requester、actor は target (approver)。

- [ ] **Step 1: emit 追加**

旧 (line 11-18):
```ruby
def call(target_account_id:, requester_account_id:)
  follow_repo.update_status(
    follower_id: requester_account_id,
    followee_id: target_account_id,
    status: "approved"
  )
  {}
end
```

新:
```ruby
def call(target_account_id:, requester_account_id:)
  follow_repo.update_status(
    follower_id: requester_account_id,
    followee_id: target_account_id,
    status: "approved"
  )

  notifications_emit.call(
    recipient_id: requester_account_id,
    type: "follow_approved",
    target_resource_id: target_account_id,
    actor_id: target_account_id
  )

  {}
end
```

- [ ] **Step 2: private helper 追加**

class 末尾 (def call ... end の後) に:

```ruby
private

def notifications_emit
  @notifications_emit ||= Notifications::Slice["use_cases.emit"]
end
```

- [ ] **Step 3: Syntax check**

```bash
ruby -c slices/social/use_cases/follows/approve_follow_request.rb
```

---

## Task 5: 検証 + commit

- [ ] **Step 1: rspec baseline 維持**

```bash
cd services/monolith/workspace
bundle exec rspec spec/slices/post spec/slices/profile 2>&1 | /usr/bin/tail -5
```

期待: post 62/0 + profile 153/14 baseline 維持 (cross-slice emit 追加で fail しないこと、emit が internal rescue で error swallow 済)。

- [ ] **Step 2: container resolve smoke (4 caller が emit を解決できることを確認)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"

  # 1. Notifications emit 解決
  emit = Notifications::Slice["use_cases.emit"]
  puts "Emit resolved: #{emit.class}"

  # 2. 4 caller の resolution
  social_follow = Social::Slice["use_cases.follows.follow"]
  social_approve = Social::Slice["use_cases.follows.approve_follow_request"]
  post_add_comment = Post::Slice["use_cases.comments.add_comment"]
  puts "Social::Follow: #{social_follow.class}"
  puts "Social::ApproveFollowRequest: #{social_approve.class}"
  puts "Post::AddComment: #{post_add_comment.class}"
  # LikeHandler は handler なので Gruf 側
  puts "Post::Grpc::LikeHandler: #{Post::Grpc::LikeHandler}"
' 2>&1 | /usr/bin/tail -10
```

期待: 全 class 解決成功。

- [ ] **Step 3: end-to-end smoke (Follow → notification row insert を実 DB で確認)**

```bash
bundle exec ruby -e '
  require "hanami/prepare"

  # Use deterministic UUIDs to make smoke output reproducible.
  follower = "11111111-1111-1111-1111-111111111111"
  followee = "22222222-2222-2222-2222-222222222222"

  # Pre: count notifications for followee
  notif_repo = Notifications::Slice["repositories.notification_repository"]
  pre_count = notif_repo.count_unread(recipient_id: followee)
  puts "Pre count_unread(#{followee[0,8]}...): #{pre_count}"

  begin
    Social::Slice["use_cases.follows.follow"].call(follower_id: follower, target_account_id: followee)
    puts "Follow.call OK"
  rescue StandardError => e
    puts "Follow.call ERROR (likely missing profile): #{e.class}: #{e.message}"
  end

  post_count = notif_repo.count_unread(recipient_id: followee)
  puts "Post count_unread(#{followee[0,8]}...): #{post_count} (delta=#{post_count - pre_count})"

  # Cleanup: leave the row (or could DELETE WHERE recipient_id=followee), keep simple.
  puts "(Note: leaves smoke row in DB; OK for dev DB)"
' 2>&1 | /usr/bin/tail -10
```

期待:
- profile が無くて Follow 内部で例外が出る場合は ERROR がログに出るが、その場合 emit は呼ばれていない (例外で early return)。
- profile 取得が成功した場合: `delta=1` で notification row が insert される。

> **Note**: dev DB に profile が無ければ Follow が例外で abort、emit に到達しない。これが起きたら別 smoke (LikePost や ApproveFollowRequest 経由) で再確認するか、profile fixture を挿入して再実行。最重要は **rspec baseline 維持** と Step 2 の resolution smoke。

- [ ] **Step 4: diff stat**

```bash
/usr/bin/git status
/usr/bin/git diff --stat
```

期待: 4 modified + plan = **5 files**。

- [ ] **Step 5: commit (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-notifications-n3-crossslice-emit
/usr/bin/git add services/monolith/workspace docs/superpowers/plans/2026-06-16-notifications-n3-crossslice-emit.md
/usr/bin/git commit -s -m "feat(notifications): cross-slice emit hooks (like/comment/reply/follow_request/follow_approved)"
```

push しない。

---

## Deferred

- **N4** (frontend data layer): types + mappers + 2 hook (useNotifications / useUnreadCount) + 3 BFF route + grpc.ts に notificationClient 追加
- **N5** (frontend UI): NotificationBell + /notifications page + /dev/ui mock

## Self-Review

- **Spec coverage (N3 範囲)**: 4 caller の正常パスに emit hook、type / recipient / target_resource_id / actor は spec 表と一致
- **Placeholder 無し**: 全 modify を完全 code で列挙
- **Fire-and-forget**: Emit は内部 rescue 完備、caller は戻り値無視、source action は emit 失敗で disrupt されない
- **Self-action suppression**: Emit 内で `recipient_id == actor_id` を skip するため、Follow で自分自身を follow するような edge case は emit が no-op
- **Block suppression**: Emit 内で recipient が actor を block 済なら skip
- **AddComment 修正の scope 注意**: parent 変数を scope に残す軽微 refactor + private helper 追加、error class 群との配置順序に注意 (helper を call の直下、error class 群は class 末尾)
- **検証**: rspec baseline + container resolution smoke + 任意で end-to-end follow smoke
