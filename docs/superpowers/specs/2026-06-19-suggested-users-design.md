# Suggested Users Design — おすすめユーザー pane (Phase 1b-B PR2)

Date: 2026-06-19
Status: Design spec (implementation-ready)
Scope: Phase 1b-B PR1 (#752) で予約した desktop 右カラムに「おすすめユーザー」pane を実装する。新規 `discovery.v1` RPC `SuggestUsers` を追加し、viewer の反対ロールの新着ユーザーを推薦する。frontend は AppShell 右カラム (xl: 以上) に pane を表示する。

Related:
- `2026-06-16-notifications-slice-design.md` (cross-slice emit / hydration パターンの先例)
- Phase 1b-B PR1 = #752 (`SideNav` + AppShell 3-col 化、右カラムスペース予約済)
- discovery slice の既存 `SearchUsers` (本 spec の RPC / use_case はこれと同形)

## Goal

desktop 3-col レイアウトの右カラムに、フォロー候補となるユーザーを並べる「おすすめユーザー」pane を出す。cold start 局面 (新規 Cast が発見されず churn するのが最大リスク) を踏まえ、**新着順**で候補を選び、新規ユーザーに露出を再分配する。viewer のロールに応じて**反対ロール**を推薦する (Cast には Guest を、Guest には Cast を)。

## Grounding

- discovery slice はテーブルを持たない cross-slice orchestrator。`SearchUsers` use_case は `Profile::Slice["repositories.profile_repository"]` の生 row を取り、`Profile::Slice["use_cases.get_profile"]` で hydration する。本 RPC も同じ構成。
- `ProfileRepository#search_by_query` は**空クエリで `[]` を返す**ため新着リストには流用できない。新規メソッド `list_recent` が要る。
- `profiles` は `created_at` を持ち、cursor は既存実装と同じ `(created_at, account_id)` で encode する (profiles の PK は account_id、別 id 列なし)。
- role は `identity.users.role` に格納 (**1 = guest, 2 = cast**)。`search_by_query` の role_filter は `identity__users` への subquery で実装済。`identity.user_repository#find_by_id(id)` が role を持つ row を返す。
- block / follow の除外材料は `Social::Slice` の `block_repository.bidirectionally_blocked_ids(account_id:)` と `follow_repository.following_account_ids(account_id:)` で取得可。
- discovery handler は `authenticate_user!` + `current_user_id` で viewer を持つ。

## Decisions

| 項目 | 決定 | Why |
|---|---|---|
| 推薦シグナル | 新着順 (`created_at DESC, account_id DESC`) | cold start で新規ユーザーに露出を再分配 = 新規 Cast 定着を後押し。人気順は初期 follower 数が横並びで機能せず rich-get-richer になる。最も実装が軽い |
| role filter | viewer の**反対ロール**を推薦 | Cast は客 (Guest) を、Guest は従事者 (Cast) を探す。viewer role 不明時は filter なし (fallback) |
| 除外 | 自分 / フォロー中 (approved) / 双方向 block | 自分や既フォローを候補に出さない。block は双方向で除外。`following_account_ids` は approved のみ返すため pending follow 相手の除外は MVP スコープ外 |
| エリア | 非依存 | cold start の疎データで同一エリア pane は空になりやすく fallback 分岐が要る。エリア relevance はデータが濃くなってからの別機能 |
| pagination | contract に cursor/has_more を持たせるが pane は先頭 N 件のみ描画 | slice の pagination 規約に合わせつつ、pane の「もっと見る」は後続 |
| breakpoint | `xl:` 以上で右 pane 表示 | nav 240 + center max-w-2xl(672) + pane 320 ≒ 1232 < `max-w-screen-xl`(1280) に収まる。`xl:` 未満は PR1 のまま (左+中央) |

## API contract — `discovery.v1`

既存 `DiscoveryService` に RPC を追加:

```proto
service DiscoveryService {
  // ... (既存: SearchUsers / SearchPosts / RankPosts)
  rpc SuggestUsers(SuggestUsersRequest) returns (SuggestUsersResponse);
}

message SuggestUsersRequest {
  int32 limit = 1;     // default 10, max 50
  string cursor = 2;   // base64 (created_at, account_id)
}

message SuggestUsersResponse {
  repeated profile.v1.Profile profiles = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

role_filter は request に**含めない** — viewer のロールから server 側で導出する。

## Monolith discovery slice

### `ProfileRepository#list_recent`

```ruby
# Lists profiles newest-first for the suggested-users feature.
# role_filter: nil = no filter, 1 = guest only, 2 = cast only (subquery against identity.users).
# exclude_account_ids: viewer self + already-following + bidirectionally-blocked.
def list_recent(limit:, cursor: nil, exclude_account_ids: [], role_filter: nil)
  scope = profiles
  scope = scope.exclude(account_id: exclude_account_ids) unless exclude_account_ids.empty?

  if role_filter && [1, 2].include?(role_filter)
    scope = scope.where(
      account_id: profiles.dataset.db[:identity__users].where(role: role_filter).select(:id)
    )
  end

  if cursor
    decoded = decode_cursor(cursor)
    scope = scope.where {
      (created_at < decoded[:created_at]) |
        ((created_at =~ decoded[:created_at]) & (account_id < decoded[:id]))
    } if decoded
  end

  scope.order { [created_at.desc, account_id.desc] }.limit(limit + 1).to_a
end
```

(cursor encode/decode は `search_by_query` と同じ `Concerns::CursorPagination` を使う。)

### `Discovery::UseCases::SuggestUsers`

```ruby
class SuggestUsers
  include ::Concerns::CursorPagination
  MAX_LIMIT = 50

  # 1 = guest, 2 = cast。viewer の反対ロールを返す。role 不明なら nil (filter なし)。
  OPPOSITE_ROLE = { 1 => 2, 2 => 1 }.freeze

  def call(viewer_account_id:, limit: DEFAULT_LIMIT, cursor: nil)
    limit = normalize_limit(limit)
    role_filter = OPPOSITE_ROLE[viewer_role(viewer_account_id)]

    exclude_ids = exclusion_ids(viewer_account_id)
    rows = profile_repo.list_recent(
      limit: limit, cursor: cursor, exclude_account_ids: exclude_ids, role_filter: role_filter
    )

    result = build_pagination_result(items: rows, limit: limit) do |last|
      encode_cursor(created_at: last.created_at.iso8601, id: last.account_id)
    end
    profiles = result[:items].filter_map { |row| get_profile.call(account_id: row.account_id) }
    { profiles: profiles, next_cursor: result[:next_cursor], has_more: result[:has_more] }
  end

  private

  def exclusion_ids(viewer_account_id)
    following = follow_repo.following_account_ids(account_id: viewer_account_id)
    blocked = block_repo.bidirectionally_blocked_ids(account_id: viewer_account_id)
    ([viewer_account_id] + following + blocked).uniq
  end

  def viewer_role(viewer_account_id)
    user_repo.find_by_id(viewer_account_id)&.role
  end

  # cross-slice deps: Profile / Social / Identity
end
```

- **cross-slice 依存**: 既存の `Profile::Slice` (profile_repo + get_profile) + `Social::Slice` (follow_repo + block_repo) に加え、`Identity::Slice["repositories.user_repository"]` を新規追加。
- 除外は over-fetch しない (`limit + 1` の標準 has_more 判定)。除外で 1 ページが薄くなる可能性は許容 (cold start の MVP)。

### Handler

`DiscoveryHandler` に追加:

```ruby
rpc :SuggestUsers, ::Discovery::V1::SuggestUsersRequest, ::Discovery::V1::SuggestUsersResponse

def suggest_users
  authenticate_user!
  limit = request.message.limit.zero? ? 10 : request.message.limit
  cursor = request.message.cursor.empty? ? nil : request.message.cursor
  result = suggest_users_uc.call(viewer_account_id: current_user_id, limit: limit, cursor: cursor)
  ::Discovery::V1::SuggestUsersResponse.new(
    profiles: result[:profiles],
    next_cursor: result[:next_cursor] || "",
    has_more: result[:has_more]
  )
end
```

`bin/grpc` の handler 登録は既存 `DiscoveryHandler` なので追加不要 (proto require のみ codegen 後に確認)。

## Frontend

- **hook** `useSuggestedUsers` — SWR で `/api/discovery/suggested-users` を単一ページ取得 (`revalidateOnFocus: false`)。`{ profiles, hasMore, loading, error, refresh }` を返す。`useSearchUsers` の構造を参考にするが infinite scroll は持たない。
- **BFF** `/api/discovery/suggested-users` (GET) → `discoveryClient.suggestUsers({ limit })`。`q=` の検索 BFF (`/api/discovery/users`) と同じ client 経由。
- **component** `SuggestedUsersPane` — ヘッダ「おすすめユーザー」+ user row リスト。各 row は検索ページの user-row パターン (Avatar + displayName/username + `<FollowButton targetAccountId={p.accountId} />`) を流用。loading / empty 状態を持つ (empty 時は pane ごと非表示)。
- **AppShell** — PR1 で予約した中央カラム右の領域に `SuggestedUsersPane` を `hidden xl:block` で配置。中央カラムの `md:max-w-2xl` は維持。pane 幅は `xl:w-80` 相当。

## Cross-slice contracts (memo)

- `Identity::Slice["repositories.user_repository"]#find_by_id(account_id)` → role を持つ user row (1=guest, 2=cast)
- `Social::Slice["repositories.follow_repository"]#following_account_ids(account_id:)` → approved の followee id 配列 (pending は含まない)
- `Social::Slice["repositories.block_repository"]#bidirectionally_blocked_ids(account_id:)` → 双方向 block id 配列
- `Profile::Slice["use_cases.get_profile"]#call(account_id:)` → `Profile::V1::Profile` 形

## Decomposition (S1〜S3、計 3 PR 想定 / 1 PR にまとめても可)

| 段 | スコープ |
|---|---|
| S1 | proto (`SuggestUsers` + req/res) → `./bin/codegen` → monolith (`list_recent` + `SuggestUsers` use_case + handler) + rspec |
| S2 | frontend data (`useSuggestedUsers` hook + BFF route) |
| S3 | frontend UI (`SuggestedUsersPane` + AppShell 右カラム配置) |

## Deferred / out of scope

- pane の「もっと見る」/ infinite scroll (contract には cursor/has_more あり)
- エリア relevance、人気順 / hybrid シグナル
- search ページ右上の検索ボックス (page 固有)
- follow 後の list からの自動除去 (FollowButton が自前で状態管理、row は「フォロー中」表示のまま残る)

## Verification

```bash
# monolith
cd services/monolith/workspace
env -u NODE_OPTIONS bundle exec rspec spec/slices/discovery

# proto regen
cd <repo-root> && ./bin/codegen

# frontend
cd services/frontend/workspace
env -u NODE_OPTIONS ./node_modules/.bin/tsc --noEmit
env -u NODE_OPTIONS pnpm build
env -u NODE_OPTIONS pnpm lint   # 期待 0e/0w
```

成功基準:
- viewer=cast は guest のみ、viewer=guest は cast のみが候補に出る
- 自分 / フォロー中 / 双方向 block 相手が候補に出ない
- 新着順 (created_at desc) で並ぶ
- desktop `xl:` 以上で右 pane が描画され、`xl:` 未満では従来どおり (左+中央)
