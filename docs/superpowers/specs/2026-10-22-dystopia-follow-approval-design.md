# Dystopia follow approval design

## Context

今の鍵（`profile.profiles.is_private`）は、次の 2 つを兼ねている。

- 投稿を見られる人を、本人と承認済みのフォロワーに限る（`Social::UseCases::FilterVisiblePosts`）
- フォローを申請制にする（`Social::UseCases::Follows::Follow` が `is_private` なら `pending` で作る）

#1581 は、この 2 つを分けて選べるようにすることを求めている。公開のままフォロワーだけ承認制にしたい人と、鍵付きでも誰でもフォローできるようにしたい人がいる。

調べると、申請にするかの判定は `follow.rb` の 1 行だけで、分けても複雑にはならない。また、今は鍵を外しても残っていた申請は申請のまま残り、まとめて承認する手段もない（`FollowRepository#approve_all_pending` はあるが、どこからも呼ばれていない）。

### Decisions taken before this spec

| 論点 | 決定 | 理由 |
|---|---|---|
| 設定の形 | 「フォローを承認制にする」を鍵とは別の設定にし、4 通りすべてを選べる | ユーザーの判断 |
| 今のプロフィール | 鍵付きは承認制あり、それ以外は承認制なしで始める | 今の動きを変えない |
| 承認制を外したとき | 申請はそのまま残す。申請タブに「すべて承認」を置き、本人がまとめて承認できるようにする | ユーザーの判断。設定の切り替えで勝手に承認しない |
| すべて承認の対象 | 申請タブに出ている人（停止中・無効化されたプロフィールを除く） | 画面に出ていない人まで承認しないため。ブロックするとフォローと申請は両方向とも消えるので、ブロック相手は対象に入らない |
| 承認制の相手のボタン | 押す前から「フォローを申請」と出す | ユーザーの判断。押す前に承認が要ると分かる |

## Goals

- 鍵と承認制を、プロフィールごとに別々に選べる
- 承認制のプロフィールへのフォローは申請になり、承認制でなければすぐフォローになる（鍵の有無に関係なく）
- 申請タブの「すべて承認」で、残っている申請をまとめて承認できる
- 承認制の相手へのボタンは「フォローを申請」

## Non-goals

- 鍵の意味（投稿を見られる人）の変更
- 承認の通知の文言（承認した側からの `follow_approved` が「あなたをフォローしました」と出るのは今のまま）

## Rules

| 鍵 | 承認制 | 投稿を見られる人 | フォロー |
|---|---|---|---|
| なし | なし | 誰でも | すぐフォロー |
| なし | あり | 誰でも（フォロワーのみの投稿は承認済みのフォロワー） | 申請 → 承認待ち |
| あり | なし | 本人と承認済みのフォロワー | すぐフォロー（フォローすれば見られる） |
| あり | あり | 本人と承認済みのフォロワー | 申請 → 承認待ち |

承認制を変えても、残っている申請は変わらない。申請タブの「すべて承認」（確認「N 件の申請をすべて承認しますか？」）で、申請タブに出ている人の申請をまとめて承認する。1 件ずつの承認と同じく、申請した人へ通知する。

## Architecture

### Database

`profile.profiles` に `follow_approval_required boolean NOT NULL DEFAULT false` を足す。migration で `is_private = true` の行を `true` にする。

### Proto

- `profile.v1.Profile` に `bool follow_approval_required = 22;`
- `profile.v1.SaveProfileRequest` に `bool follow_approval_required = 12;`
- `social.v1.GetFollowStatusResponse` に `map<string, bool> approval_required = 2;`（対象ごとに、そのプロフィールが承認制か）
- `social.v1.FollowService` に `rpc ApproveAllFollowRequests(ApproveAllFollowRequestsRequest) returns (ApproveAllFollowRequestsResponse)`（応答は `int32 approved_count = 1;`）

### Monolith

- profile: relation・repository・`save_profile`・presenter に `follow_approval_required` を通す。保存では申請に触れない
- social:
  - `Follows::Follow`: `status = profile.follow_approval_required ? "pending" : "approved"`
  - `Follows::ApproveAllFollowRequests`（新規）: `pending_requester_ids` を `list_visible_profile_ids` で申請タブと同じ人に絞り、`ApproveFollowRequest` で 1 件ずつ承認する（通知も今の承認と同じ）。承認した件数を返す
  - `Follows::GetFollowStatus`: 対象ごとの `approval_required` も返す

### Frontend

- プロフィールの型・mapper・保存の payload に `followApprovalRequired`
- 編集画面: 鍵の下に「フォローを承認制にする」（説明「フォローされる前に、あなたが承認します」）
- `useFollow` が `approvalRequired` を返す。`FollowButton` と `ProfileActions` は、未フォローで承認制の相手には「フォローを申請」と出す
- 申請タブ（`FollowRequestsList`）: 申請があるときだけ「すべて承認」を出す。BFF は `POST /api/social/follow/requests/approve-all`
- `PUT /api/profile` は `followApprovalRequired` が boolean でない保存を 400 で断る（proto3 の bool は値の有無を区別できず、送り忘れが承認制の解除になるため）

## Testing

monolith（rspec）:

- 4 通りの組み合わせで、フォローが申請になるか・すぐフォローになるか
- 承認制を外して保存しても申請は残る
- すべて承認で申請タブに出ている人の申請が承認され、申請者に通知が届く。停止中・無効化された人の申請は残る
- migration のあと、鍵付きは承認制あり
- `GetFollowStatus` が `approval_required` を返す

frontend（vitest、`tsc --noEmit`）:

- 編集画面の承認制の切り替えが保存される
- ボタンの文言（未フォロー・承認制 → 「フォローを申請」、承認制でない → 「フォロー」、申請中 → 「申請中」）

ローカルの実機:

- 鍵なし・承認制ありのプロフィールに別の人がフォローすると申請になり、投稿は見られる
- 申請タブの「すべて承認」で申請が承認され、フォロワーに入る
