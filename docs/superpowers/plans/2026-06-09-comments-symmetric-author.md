# Comments symmetric author resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** comment の著者解決を **`Post::Adapters::ProfileAuthorAdapter` 経由（symmetric / account-based）** に切り替える。旧 `cast_adapter` / `guest_adapter` への分岐 (`comment_handler.rb:165-180` 周辺) を撤去し、ProfileService 1 本で `name` / `image_url` を解決する。`CommentAuthor.user_type` フィールドは proto に残るが値を `""` (symmetric / 役割なし) に統一する。

**Architecture:** **Additive / build-green**。`comment_handler.rb` の 1 private method (`get_comment_author`) を ProfileAuthorAdapter ベースに書き換え、ローカル private accessor (`profile_author_adapter`) を 1 行追加するだけ。`author_loader.rb` / `user_adapter.rb` / `cast_adapter.rb` / `guest_adapter.rb` / base `handler.rb` は**無改変** (旧 `CastPost` RPC 等で並走利用中、cleanup フェーズで撤去)。`load_media_files_for_comments_with_authors` は無改変 (author 用 avatar の事前ロードが不要になるが、削っても削らなくても挙動同等、surgical 優先で残す)。`user_adapter.user_exists?` の利用 (`use_cases/comments/add_comment.rb`) も無改変。proto は不変、frontend BFF / UI も無改変 (`userType` が `""` になるだけで構造変化なし)。

**Tech Stack:** Ruby / Hanami 2 / gruf (gRPC) / ROM。proto stub = `Post::V1::Comment` / `CommentAuthor` (`user_id`, `name`, `image_url`, `user_type`)。cross-slice = `Profile::Slice["use_cases.get_profile"]` (Q3 で配線済、`ProfileAuthorAdapter` が内部利用)。

**Spec:** `docs/superpowers/specs/2026-06-07-posts-slice-design.md`（§Monolith post slice の「著者解決」「`author_loader` を ProfileService 1 本に集約」）。前提: posts Q3 で `Post::Adapters::ProfileAuthorAdapter` が main にマージ済。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-comments-symmetric`。app root: `services/monolith/workspace`。branch `feat/comments-symmetric` (origin/main base、tracking 済)。**push しない・PR は親が判断**。
- 検索は **`/usr/bin/grep`** / `/usr/bin/find`。
- DB は localhost:5432 (postgres/password/monolith、シード済)、`hanami` は postgres@18 PATH (`export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"` 経由が必要なケースあり、既存スクリプト確認)。
- **build-green / additive**: 以下は無改変:
  - `slices/post/grpc/handler.rb` (base、旧 CastPost RPC が依存)
  - `slices/post/adapters/{cast,guest,user,author_loader}.rb` (旧 path が依存)
  - `slices/post/adapters/profile_author_adapter.rb` (Q3 で確定済、利用するだけ)
  - `slices/post/use_cases/comments/*.rb` (use case 層は無改変、handler の presentation 部分のみ修正)
  - frontend (`/api/guest/comments` BFF / `useComments` hook / UI components) も無改変。`CommentAuthor.user_type` が `""` になるだけで JSON shape は同形。

### 既存（確定、再利用する）

- **`Post::Adapters::ProfileAuthorAdapter`** (`slices/post/adapters/profile_author_adapter.rb`):
  ```rb
  AuthorInfo = Data.define(:account_id, :display_name, :username, :avatar_url)
  def load(account_ids) -> { account_id => AuthorInfo }
  ```
  内部で `Profile::Slice["use_cases.get_profile"]` を呼び、avatar は `MediaAdapter.find_by_ids` で URL 解決。
- **`comment_handler.rb` 現状の `get_comment_author`** (`slices/post/grpc/comment_handler.rb:160-185` 付近):
  ```rb
  def get_comment_author(user_id, media_files: {})
    user_type = user_adapter.get_user_type(user_id)
    return ::Post::V1::CommentAuthor.new(user_id: user_id, ...) unless user_type
    if user_type == "cast"
      cast = cast_adapter.find_by_user_id(user_id)
      # build CommentAuthor with cast info, image from media_files[cast.avatar_media_id]
    else
      guest = guest_adapter.find_by_user_id(user_id)
      # build CommentAuthor with guest info
    end
  end
  ```
- **proto**: `CommentAuthor { user_id, name, image_url, user_type }`。`user_type` フィールドは残すが新 path では空文字を入れる (symmetric を表明)。

## File Structure

- Modify: `slices/post/grpc/comment_handler.rb` (private `get_comment_author` の書き換え + private accessor `profile_author_adapter` 追加)
- Tests: `spec/slices/post/grpc/comment_handler_spec.rb` (存在すれば回帰確認、user_type を期待する assertion は新 spec で `""` を期待するよう更新)

---

## Task 1: ProfileAuthorAdapter ベースに `get_comment_author` を書き換え

**Files:** Modify `services/monolith/workspace/slices/post/grpc/comment_handler.rb`。

- [ ] **Step 1: 該当行を Read で確認**

Run: `cd services/monolith/workspace && /usr/bin/sed -n '155,195p' slices/post/grpc/comment_handler.rb`
内容: 既存の `get_comment_author(user_id, media_files: {})` private method 全体 + その下にある `load_media_files_for_comments_with_authors` の冒頭まで。

- [ ] **Step 2: private accessor `profile_author_adapter` を追加**

ファイル下部、既存 private accessor 群 (どこにあるか grep で特定。`def cast_adapter`、`def guest_adapter` の近辺) と同じスタイルで以下を追加。base `handler.rb` を継承しているため base にある同名アクセサと衝突しないよう **comment_handler.rb 固有** に置く:

```ruby
      def profile_author_adapter
        @profile_author_adapter ||= Post::Adapters::ProfileAuthorAdapter.new
      end
```

ファイル冒頭近くに `require_relative "../adapters/profile_author_adapter"` を追加 (base が requires しているなら不要、なければ追加)。**先に grep で確認**: `/usr/bin/grep -n "profile_author_adapter" slices/post/grpc/comment_handler.rb slices/post/grpc/handler.rb`。

- [ ] **Step 3: `get_comment_author` を書き換える**

旧実装を以下で置換 (signature は維持して既存呼び出し側は不変):

```ruby
      def get_comment_author(user_id, media_files: {})
        # Symmetric author resolution via Profile slice (account-based).
        # media_files parameter retained for caller signature compatibility but unused here —
        # avatar URL is resolved by ProfileAuthorAdapter internally.
        infos = profile_author_adapter.load([user_id])
        info = infos[user_id.to_s]
        return ::Post::V1::CommentAuthor.new(user_id: user_id.to_s, name: "", image_url: "", user_type: "") unless info

        ::Post::V1::CommentAuthor.new(
          user_id: user_id.to_s,
          name: info.display_name || "",
          image_url: info.avatar_url || "",
          user_type: ""
        )
      end
```

key 探索 (`infos[user_id.to_s]`) は `ProfileAuthorAdapter#load` の戻り key 型に合わせている (Q3 plan で `account_id.to_s` で key 化されている)。確証: `/usr/bin/grep -n "to_s" slices/post/adapters/profile_author_adapter.rb` で key 型を確認し、もし `account_id` (UUID オブジェクト) のまま map されているなら `infos[user_id]` または `infos[user_id.to_s]` を実装に合わせる。**実装側に合わせること、ProfileAuthorAdapter を改変してはいけない**。

- [ ] **Step 4: 構文チェック**

Run: `cd services/monolith/workspace && ruby -c slices/post/grpc/comment_handler.rb`
Expected: `Syntax OK`。

- [ ] **Step 5: gRPC サーバ boot smoke**

Run: `cd services/monolith/workspace && timeout 5 bin/grpc 2>&1 | /usr/bin/head -20` (起動できれば OK、port 衝突なら別の確認手段)
Expected: handler のロード成功。`NameError` 等が出ないこと。**timeout 5s で十分**、bind 後すぐ kill して構わない。

---

## Task 2: rspec 回帰確認

**Files:** Tests under `spec/` if any, run + adjust assertions。

- [ ] **Step 1: comment 関連の spec を grep で発見**

Run: `cd services/monolith/workspace && /usr/bin/find spec -type f -name "*comment*" 2>/dev/null`
Expected: 該当 spec ファイル一覧 (handler_spec があれば最有力)。

- [ ] **Step 2: 関連 spec のみ実行**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post/grpc/comment_handler_spec.rb 2>&1 | /usr/bin/tail -40` (path は Step 1 で見つけたもの)
Expected: 全 pass。fail があれば内容を確認。

- [ ] **Step 3: fail があった場合の対応**

fail パターン別:
- **`user_type` を `"cast"` / `"guest"` で expect している spec**: → `""` を expect するよう更新 (symmetric 化により役割表明を撤去した、と明示)。
- **`name` が cast.display_name に依存している spec**: → ProfileService が同じ display_name を返すならパスする。spec が直接 cast adapter mock を使っている場合は `Profile::Slice["use_cases.get_profile"]` の mock に差し替える、または ProfileAuthorAdapter 自体を mock する。
- **avatar 画像解決** で fail する場合: ProfileAuthorAdapter 内部の MediaAdapter mock を追加。spec 側修正のみ、本体は変えない。

mock 差し替えで spec が pass しないケース (例: profile スライスがそもそも DB レベルで seed されていない) は spec を `pending` or `skip` にせず、controller (親) に escalate (`Status: BLOCKED`)。**勝手に skip しないこと**。

- [ ] **Step 4: 関連の posts スライス全 spec を回帰**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -30`
Expected: 全 pass。失敗があれば内容を確認、posts symmetric backend (Q3/Q3b で main 済) が依存する spec が ProfileAuthorAdapter 関連で巻き込まれていないかチェック。

---

## Task 3: Commit

**Files:** なし (検証 + commit)。

- [ ] **Step 1: diff 確認**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-comments-symmetric && /usr/bin/git diff --stat && /usr/bin/git diff`
Expected: 変更は `comment_handler.rb` と (必要なら) `spec/` 配下のみ。author_loader / cast/guest adapter / user_adapter / use_cases に変更がないこと。

- [ ] **Step 2: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-comments-symmetric
/usr/bin/git add services/monolith/workspace/slices/post/grpc/comment_handler.rb services/monolith/workspace/spec docs/superpowers/plans/2026-06-09-comments-symmetric-author.md
/usr/bin/git commit -s -m "feat(post): symmetric comment author resolution via ProfileService"
```
（push しない。）

---

## Deferred（本 plan では実施しない）

- **`load_media_files_for_comments_with_authors` の簡略化** (author 用 avatar の事前ロードを削除) → 動作影響なし (現状は無駄なロードが発生するだけ)、cleanup フェーズで一括整理。
- **`comment.user_type` proto field の撤去** → breaking change。frontend が consume している間は維持、cleanup フェーズで新 message 体系 (PostAuthor 流儀) に乗せ替えてから drop。
- **`user_adapter.user_exists?` の置換** (`add_comment.rb` 内) → 「ユーザ存在確認」用途で著者解決とは別軸、ProfileService の存在確認 RPC が無いため別 task。
- **`comment_handler.rb:292` 周辺の `cast_adapter.public_cast_ids` 利用** (旧 list_cast_posts 系) → post_handler.rb 側で、本 plan の comment 範囲外。
- **frontend UI で `userType` を switch している箇所** の削除 → 別 PR で frontend cleanup として扱う (UI が role-aware に出し分けている箇所がある可能性)。

## Self-Review（作成者チェック済）

- **Spec coverage**: spec §「著者解決を ProfileService 1 本に集約」を comment 範囲で実装。`author_loader` の完全置換は plan の defer (cleanup) と整合。
- **Additive / build-green**: 旧 cast/guest adapter・user_adapter・author_loader・base handler 無改変。proto / use_case / 他 handler 無改変。frontend 0 行変更。
- **Placeholder 無し**: `get_comment_author` の新実装は完全コード。
- **型 / 命名整合**: `CommentAuthor.user_id` = string なので `user_id.to_s` 明示。`info.display_name || ""` / `info.avatar_url || ""` で nil-safe (proto string は nil 不可、空文字 default)。`user_type: ""` で symmetric 表明。`ProfileAuthorAdapter#load` の戻り key は実装 (Q3 plan) で `account_id.to_s` と確定 → `infos[user_id.to_s]` で取れる。
- **テスト方針**: 既存 rspec を回帰チェック、user_type / cast / guest 前提の assertion があれば symmetric に更新。新 spec 追加は YAGNI で行わない (handler の 1 私 method 修正、ProfileAuthorAdapter 単体テストは Q3 plan で既に確認済)。
