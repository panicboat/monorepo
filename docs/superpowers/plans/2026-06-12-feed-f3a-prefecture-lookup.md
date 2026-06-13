# Feed F3a: profile cross-slice prefecture lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** profile スライスに **`Profile::UseCases::ListAccountIdsByPrefecture`** を新規追加。引数 prefecture (String) を受け取り、`profile.prefecture` が一致する account_id のリストを返す cross-slice 用 use_case。feed slice (F3) の AREA タブで `Profile::Slice["use_cases.list_account_ids_by_prefecture"]` 経由で呼ばれる。

**Architecture:** **Additive / build-green**。profile_repo に `account_ids_by_prefecture(prefecture)` batch fetch method を新規追加 (実体 = `portfolio.profiles` テーブル直接 query)、use_case で repo メソッドを薄くラップ。is_private (account 鍵) フィルタは feed の defer (social スライスの仕事) なので適用しない。handler / 他 use_case / proto / frontend / 他 slice 無改変。

**Tech Stack:** Ruby / Hanami 2 / ROM。プロファイル既存パターン: `slices/profile/use_cases/get_profile.rb` (top-level use_cases、`Deps["repositories.profile_repository"]` で DI)。

**Spec:** `docs/superpowers/specs/2026-06-12-feed-slice-design.md` (§Monolith feed slice の「author profile (prefecture)」+ §Decomposition の F3a)。前提: F1 (#660) + F2 (#661) main マージ済、本 PR は profile スライス内のみ touch。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f3a-prefecture-lookup`。app root: `services/monolith/workspace`。branch `feat/feed-f3a-prefecture-lookup` (origin/main = `c8ea518c` base、tracking 済)。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。
- DB は localhost:5432 (postgres/password/monolith)、`portfolio.profiles` テーブルに `prefecture` 列が実在 (column 確認済)。relation は `slices/profile/relations/profiles.rb:4` で `schema(:"portfolio__profiles", as: :profiles, infer: false)`、`prefecture` 列を `attribute :prefecture, Types::String.optional` で宣言済 (L13)。
- **build-green / additive**: 以下は無改変:
  - `slices/profile/grpc/{profile_handler,cast_handler,guest_handler}.rb`
  - `slices/profile/use_cases/{get_profile,save_profile,*}.rb` (既存)
  - `slices/profile/relations/profiles.rb`
  - `slices/profile/db/repo.rb` / `relation.rb`
  - proto / frontend / 他 slice (post / feed / etc.)
- 変更は: `profile_repository.rb` に `account_ids_by_prefecture(prefecture)` 追加 + 新規 use_case 1 file の 2 ファイル。

### 既存 (確定、再利用する)

- **`Profile::Repositories::ProfileRepository`** (`slices/profile/repositories/profile_repository.rb`):
  - `commands :create, update: :by_pk` で create/update DI
  - 既存 methods: `find_by_account_id` / `find_by_username` / `username_available?` / `upsert` / `save_areas` / `find_area_ids` / `save_media`
  - root relation = `profiles` (relation alias)
- **`Profile::UseCases::GetProfile`** (`slices/profile/use_cases/get_profile.rb`、reference pattern):
  ```ruby
  class GetProfile
    include Deps["repositories.profile_repository"]
    def call(account_id:)
      return nil if account_id.nil? || account_id.to_s.empty?
      profile_repository.find_by_account_id(account_id)
    end
  end
  ```
  - top-level (`use_cases/` 直下)、`profile` ネスト無し
  - container key = `use_cases.get_profile` (#658/comments-symmetric で `Profile::Slice["use_cases.get_profile"]` で呼ばれている実例)
- **`portfolio.profiles.prefecture`**: nullable String 列。NULL の account は今回の戻り配列から除外される (`where(prefecture: X)` で NULL は match しない、Sequel デフォルト挙動)。

### Hanami 名前空間 / container key

- ファイル配置: `slices/profile/use_cases/list_account_ids_by_prefecture.rb` → key = **`"use_cases.list_account_ids_by_prefecture"`**
- spec illustrative の `Profile::Slice["use_cases.list_account_ids_by_prefecture"]` と一致

## File Structure

- Modify: `services/monolith/workspace/slices/profile/repositories/profile_repository.rb` (`account_ids_by_prefecture(prefecture)` method 追加、既存 `find_area_ids` の近辺)
- Create: `services/monolith/workspace/slices/profile/use_cases/list_account_ids_by_prefecture.rb`

---

## Task 1: `profile_repo.account_ids_by_prefecture` を追加

**Files:** Modify `services/monolith/workspace/slices/profile/repositories/profile_repository.rb`。

- [ ] **Step 1: 既存 repository を Read で確認**

Run: `cd services/monolith/workspace && /usr/bin/cat slices/profile/repositories/profile_repository.rb`
Expected: 57 行、`find_by_account_id` / `find_area_ids` 等の既存メソッドが見える。root relation 名は `profiles`。

- [ ] **Step 2: `account_ids_by_prefecture` を追加 (末尾の `end` 直前)**

`find_area_ids` の直下、`save_media` の前 (または末尾) に追加:

```ruby
      # Cross-slice query for feed AREA tab. Returns account_ids whose
      # profile.prefecture matches the input. NULL prefecture rows are
      # naturally excluded (Sequel where uses = which doesn't match NULL).
      # is_private (account 鍵) follow-gate is NOT applied here — that is
      # the social slice's responsibility, deferred per feed spec.
      def account_ids_by_prefecture(prefecture)
        return [] if prefecture.nil? || prefecture.to_s.empty?

        profiles.where(prefecture: prefecture).pluck(:account_id)
      end
```

**実装上の注意**:
- `profiles` は root relation alias (relations/profiles.rb の `as: :profiles`)、既存メソッドと同じ呼び出し方
- `.pluck(:account_id)` で String 配列が返る (UUID 文字列)
- `prefecture` の空/nil チェックは defensive、空文字や nil で意図しない全件 fetch を避ける
- WHERE は単一列の等価で index 想定 (本 PR では index 追加しない、後続最適化で)

- [ ] **Step 3: 構文チェック**

Run: `cd services/monolith/workspace && ruby -c slices/profile/repositories/profile_repository.rb`
Expected: `Syntax OK`。

---

## Task 2: `ListAccountIdsByPrefecture` use_case を新規作成

**Files:** Create `services/monolith/workspace/slices/profile/use_cases/list_account_ids_by_prefecture.rb`。

- [ ] **Step 1: 実装**

```ruby
# frozen_string_literal: true

module Profile
  module UseCases
    # Cross-slice query: feed slice (and any future consumer) needs the set of
    # account ids whose profile.prefecture matches a given value to power
    # location-based tabs/filters. Stays thin — the heavy lifting (and any
    # future caching / index tuning) lives in the repository.
    #
    # Does NOT apply account-level visibility (profile.is_private) filtering;
    # that follow-gate is the social slice's responsibility and is deferred
    # per the feed slice design spec.
    class ListAccountIdsByPrefecture
      include Deps["repositories.profile_repository"]

      # @param prefecture [String, nil] prefecture name to filter by
      # @return [Array<String>] account ids (UUID strings); empty when prefecture is blank
      def call(prefecture:)
        profile_repository.account_ids_by_prefecture(prefecture)
      end
    end
  end
end
```

**実装上の注意**:
- 既存 `GetProfile` (`use_cases/get_profile.rb`) と同じ `include Deps["repositories.profile_repository"]` パターン
- prefecture の空 guard は repo 側に委譲 (Step 1 で実装済)、use_case は薄く保つ
- top-level `use_cases/` 直下に置く (既存 `get_profile` / `list_areas` などと同じ配置)
- Hanami の container は規約上 `slices/profile/use_cases/list_account_ids_by_prefecture.rb` → `Profile::Slice["use_cases.list_account_ids_by_prefecture"]` で resolve

- [ ] **Step 2: 構文チェック**

Run: `cd services/monolith/workspace && ruby -c slices/profile/use_cases/list_account_ids_by_prefecture.rb`
Expected: `Syntax OK`。

---

## Task 3: 回帰確認 + container resolve smoke

**Files:** なし (rspec で間接確認)。

- [ ] **Step 1: profile rspec**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/profile 2>&1 | /usr/bin/tail -10`
Expected: 既存 spec 数 / 0 failures (baseline 維持)。autoload グラフ健全性も含意。

- [ ] **Step 2: post rspec も回帰確認 (cross-slice 影響無いことの確証)**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/post 2>&1 | /usr/bin/tail -5`
Expected: 67 examples / 0 failures (baseline 維持)。F2 で追加した posts 側に regression がないこと。

- [ ] **Step 3: container resolve smoke**

Run:

```bash
cd services/monolith/workspace
bundle exec ruby -e '
  require "hanami/prepare"
  uc = Profile::Slice["use_cases.list_account_ids_by_prefecture"]
  puts "Resolved: #{uc.class}"
  result = uc.call(prefecture: nil)
  puts "Nil prefecture result: #{result.inspect}"
  result2 = uc.call(prefecture: "")
  puts "Empty prefecture result: #{result2.inspect}"
' 2>&1 | /usr/bin/tail -10
```

Expected:
- `Resolved: Profile::UseCases::ListAccountIdsByPrefecture`
- `Nil prefecture result: []`
- `Empty prefecture result: []`

ruby boot が失敗する場合 (環境問題) は rspec 緑を主担保にして skip 報告で OK。

---

## Task 4: diff 確認 + commit

- [ ] **Step 1: diff stat**

Run: `cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f3a-prefecture-lookup && /usr/bin/git diff --stat origin/main HEAD`
Expected: `profile_repository.rb` (+12 行程度) + `list_account_ids_by_prefecture.rb` (新規 +25 行程度) + plan 1 ファイル。**他のファイル変更ゼロ** (handler / 他 use_case / relation / 他 slice / proto / frontend に diff 無いこと)。

- [ ] **Step 2: コミット (signoff、Co-Authored-By 無し)**

```bash
cd /Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-feed-f3a-prefecture-lookup
/usr/bin/git add services/monolith/workspace/slices/profile docs/superpowers/plans/2026-06-12-feed-f3a-prefecture-lookup.md
/usr/bin/git commit -s -m "feat(profile): add ListAccountIdsByPrefecture use_case for cross-slice feed query"
```
(push しない。)

---

## Deferred (本 F3a では実施しない)

- **`profile.prefecture` 列の DB index** → 本番投入時の最適化、本 PR では skip
- **`is_private` (account 鍵) フィルタの適用** → social スライスの follow-gate と一緒に対応 (spec の defer 通り)
- **複数 prefecture 同時フィルタ** (将来「複数都道府県横断」UI が出たら) → 現状は 1 prefecture、必要になったら repo の引数を `Array<String>` 化
- **legacy `GetPublicCastIdsInPrefecture`** (`use_cases/cast/queries/get_public_cast_ids_in_prefecture.rb`、cast×area の旧クエリ) との統合・整理 → 旧 cast/guest split クリーンアップ PR で扱う
- **キャッシュ / pagination** → AREA タブのトラフィック量に応じて後で

## Self-Review (作成者チェック済)

- **Spec coverage (F3a 範囲)**: spec §「author profile (prefecture)」「`Profile::UseCases::ListAccountIdsByPrefecture` 等の cross-slice 新規 use_case を profile slice に追加」を完全実装。signature `call(prefecture:) → Array<String>` で feed slice F3 の AREA タブから直接呼べる形。
- **Additive / build-green**: handler / 既存 use_case / relation / 他 slice / proto / frontend 全て無改変。`profile_repository.rb` に additive 1 method 追加、新 use_case 1 file 追加のみ。
- **Placeholder 無し**: 全 task に完全コード提示。
- **型 / 命名整合**:
  - 戻り型 `Array<String>` (account_id UUID 文字列) → feed slice F3 で `WHERE author_id IN (?)` に直接使える
  - container key `use_cases.list_account_ids_by_prefecture` (top-level、spec illustrative と一致)
  - prefecture の空/nil 入力は repo で `[]` 返し、use_case は薄く委譲
  - is_private (鍵アカ) フィルタは未適用、コメントで意図明示 (defer は social スライス)
- **テスト方針**: profile / post rspec baseline 維持確認、container smoke で resolve 動作確認、unit spec は YAGNI (F3 integration で実証)
