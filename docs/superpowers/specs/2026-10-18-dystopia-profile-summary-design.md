# Dystopia profile summary design

## Context

鍵付きのプロフィールには、プロフィールの見出し・検索のユーザー・おすすめ・フォロー一覧で鍵マークを出している。投稿・コメント・カルテ・クチコミでは、作者や相手が鍵付きでも鍵マークを出せていない。これらの応答に、鍵付きかどうかの情報がないためである。

調べると、応答の中でプロフィールを表す形が 2 系統ある。

| 系統 | 使っている応答 | 中身 |
|---|---|---|
| 完全なプロフィール（`profile.v1.Profile`） | 足あと、検索のユーザー、おすすめ、フォロー／フォロワー／フォロー申請、ブロック、メッセージの相手、通知の相手 | 自己紹介・体型・SNS などを含む全項目。画面が使うのは id・ユーザー名・表示名・アイコン・鍵・役割だけ |
| 独自の平たい作者項目 | 投稿（`PostAuthor`）、コメント（`CommentAuthor`、項目名も `name`・`image_url`）、カルテとクチコミ（`author_username` などの並び） | 鍵を含まない。形がドメインごとに違う |

組み立ても散らばっている。完全なプロフィールは各 handler が `ProfilePresenter` に渡し、役割をプロフィールごとに 1 件ずつ引いている。投稿とコメントは `Post::Adapters::ProfileAuthorAdapter`、カルテとクチコミは各 presenter が、プロフィールとアイコンを自分で引いている。検索のユーザーとおすすめは、アイコンの URL を渡しておらず `avatar_url` が空で返っている。

本 spec は、他人のプロフィールを一覧や作者として返す応答を、すべて 1 つの軽い形（`ProfileSummary`）にそろえる。組み立ては profile slice の 1 か所にまとめる。

### Decisions taken before this spec

| 論点 | 決定 | 理由 |
|---|---|---|
| 鍵の情報を足す方法 | 応答ごとに項目を足すのではなく、プロフィールの形を共通化する | ユーザーの判断。応答ごとに足すと、作者の形が増えるたびに同じ項目を足して回ることになる |
| 共通化の範囲 | 他人のプロフィールを返す応答すべて（9 ドメイン） | ユーザーの判断 |
| 共通の形 | 新しい軽い `ProfileSummary` を作る。完全な `Profile` は使わない | 投稿 1 件ごとに自己紹介や体型まで運ぶと応答が重くなる。画面が使う項目は要約で足りる |
| 組み立て方 | profile slice に、まとめて要約を作る use case を 1 つ置き、全ドメインがそれを呼ぶ | 鍵・アイコン・役割の取り方を 1 か所にまとめ、1 件ずつの読み込み（N+1）をなくす |
| frontend の型 | 既存の `SocialProfileView` を `ProfileSummaryView` に改名し、`modules/profile/types.ts` に移して共通の形にする | ユーザーの判断。投稿・カルテ・クチコミの作者にも使うので、social の名前では合わない |
| 投稿の非公開の印 | 鍵マークをやめ、`Users` アイコン（読み上げ名「フォロワーのみ」）にする | 作者の鍵マークと同じ印だと、1 枚のカードに意味の違う鍵が 2 つ並ぶ。非公開の投稿は「フォロワーと自分」に見せる方針（別の段で実装） |

### Constraints

- frontend と monolith は 1 つのコンテナイメージで同時に deploy される（`dystopia/lambda/README.md`）。proto をその場で作り替えても、新旧が食い違う期間はない
- proto のスタブは `bin/codegen`（monolith）と `pnpm proto:gen`（frontend）で再生成し、変更した package の差分だけを commit する
- プロフィールの画面と編集（`GetProfile`、`GetProfileByUsername`、`ListMyProfiles`、`SaveProfile` など）は、完全な `Profile` のまま変えない

## Goals

- 他人のプロフィールを返す応答が、すべて `ProfileSummary` を使う
- 投稿・コメント・カルテ・クチコミの作者と相手が鍵付きなら、名前の横に鍵マークを出す
- 名前の表示（表示名・鍵マーク・プロフィールへのリンク・削除済みの表示）を 1 つの部品にまとめる
- 検索のユーザーとおすすめにアイコンが出る

## Non-goals

- 非公開の投稿を「フォロワーと自分」に見せる変更（本 spec の後に別の spec で扱う）
- プロフィールの画面と編集の応答の変更
- 鍵付きの判定や公開範囲のルールの変更

## Domain

### ProfileSummary

| 項目 | 内容 |
|---|---|
| `profile_id` | プロフィールの id |
| `username` | ユーザー名 |
| `display_name` | 表示名 |
| `avatar_url` | アイコンの URL。未設定なら空文字 |
| `is_private` | 鍵付きか |
| `role` | 役割（1: ゲスト、2: キャスト、0: 不明） |

- 停止中のプロフィールと、無効化されたアカウントのプロフィールは要約を作らない（`find_visible_by_id` と同じ基準）
- 要約がない作者・相手は、応答の項目を未設定にする。画面は「削除したプロフィール」と出す（今と同じ）

## Architecture

### Stack

| 段 | 内容 |
|---|---|
| 1 | `ProfileSummary` の proto、`summarize_profiles`、`ProfileSummaryPresenter`。完全なプロフィールを返していた 5 ドメイン（足あと、検索・おすすめ、フォロー・ブロック、メッセージ、通知）を切り替える。frontend の `SocialProfileView` を `ProfileSummaryView` に改名する |
| 2 | 投稿とコメントの作者を `ProfileSummary` にする。`ProfileAuthorAdapter` と `AccountAdapter` の作者用の処理を削除する |
| 3 | カルテとクチコミの書いた人と相手を `ProfileSummary` にする |
| 4 | 名前を出す共通の部品 `ProfileName` を作り、名前を出すすべての画面に使う。投稿の非公開の印を `Users` アイコンにする |

各段は単独で deploy できる。proto を変えた段は、その段の中で backend と frontend の両方を切り替える。

### Proto (`proto/dystopia/profile/v1/service.proto`)

```proto
message ProfileSummary {
  string profile_id = 1;
  string username = 2;
  string display_name = 3;
  string avatar_url = 4;
  bool is_private = 5;
  int32 role = 6;
}
```

置き換え（すべてその場で作り替える）:

| package | 今 | 置き換え後 |
|---|---|---|
| `footprints.v1` | `profile.v1.Profile visitor` | `profile.v1.ProfileSummary visitor` |
| `discovery.v1` | `repeated profile.v1.Profile profiles`（検索のユーザー、おすすめ） | `repeated profile.v1.ProfileSummary profiles` |
| `social.v1` | `repeated profile.v1.Profile profiles`（フォロー、フォロワー、フォロー申請、ブロック） | `repeated profile.v1.ProfileSummary profiles` |
| `messaging.v1` | `profile.v1.Profile counterpart` | `profile.v1.ProfileSummary counterpart` |
| `notifications.v1` | `profile.v1.Profile latest_actor` | `profile.v1.ProfileSummary latest_actor` |
| `post.v1` | `PostAuthor author` | `profile.v1.ProfileSummary author`（`PostAuthor` は削除） |
| `post.v1` | `CommentAuthor author` | `profile.v1.ProfileSummary author`（`CommentAuthor` は削除） |
| `karte.v1` | `author_profile_id`・`author_username`・`author_display_name`・`author_avatar_url` と target の同じ 4 項目 | `profile.v1.ProfileSummary author`・`profile.v1.ProfileSummary target`。`author_profile_id`・`target_profile_id` は、要約がない（削除済み）ときも id を返すため残す |
| `review.v1` | カルテと同じ | カルテと同じ |

### Profile slice (`dystopia/monolith/slices/profile/`)

| ファイル | 責務 |
|---|---|
| `use_cases/summarize_profiles.rb` | `call(profile_ids:)` → `{ profile_id => Summary }`。見えるプロフィールだけを 1 回の問い合わせで読み、アイコンは Media からまとめて、役割は Identity のアカウントからまとめて引く。重複と nil の id は無視する |
| `presenters/profile_summary_presenter.rb` | `to_proto(summary)` → `Profile::V1::ProfileSummary`。nil なら nil |

`Summary` は `Data.define(:profile_id, :username, :display_name, :avatar_url, :is_private, :role)`。

### Consumers

各ドメインは、返すプロフィールの id を集めて `summarize_profiles` を 1 回呼び、`ProfileSummaryPresenter` で詰める。

- 段 1: 5 ドメインの handler の `present_profile` などを、この呼び出しに置き換える。役割を 1 件ずつ引く処理と `cast_repository` の読み込みを削除する
- 段 2: `Post::Adapters::ProfileAuthorAdapter` を削除し、`PostPresenter`・`CommentPresenter`・コメントの use case は要約を受け取る。作者の存在確認（`profile_author_adapter.load(...).any?` など）は `summarize_profiles` の結果で行う
- 段 3: `Karte::UseCases::PresentKartes` と `Review::UseCases::PresentReviews` は、ページ内の書いた人と相手の id を集めて 1 回で要約を引く

### Frontend

- 型: `modules/social/types.ts` の `SocialProfileView` を `ProfileSummaryView` に改名して `modules/profile/types.ts` に移し、全参照を置き換える。項目（`profileId`・`username`・`displayName`・`avatarUrl`・`isPrivate`・`role`）は変えない
- 変換: `ProfileSummary` から `ProfileSummaryView` に変換する関数 `summaryToView` を `modules/profile/lib/mappers.ts` に置き、`modules/social/lib/mappers.ts` の `profileToSocialProfile` を削除して呼び出しを置き換える
- 投稿: `PostView.author` を `ProfileSummaryView | null` にする。`displayName`・`avatarUrl` などの参照はそのまま使える
- コメント: 作者を `ProfileSummaryView | null` にし、`name`・`imageUrl`・`userType` の参照を `displayName`・`avatarUrl`・`role` に替える
- カルテ・クチコミ: `authorUsername`・`authorDisplayName`・`authorAvatarUrl` と target の同じ項目を、`author: ProfileSummaryView | null`・`target: ProfileSummaryView | null` に替える。`authorProfileId`・`targetProfileId` は残す
- 共通の部品 `ProfileName`（`src/components/ui/profile-name.tsx`）:
  - 入力は `ProfileSummaryView | null`、リンクの有無、文字の大きさの class
  - 表示名（空ならユーザー名に `@`）を出し、鍵付きなら `LockMark`（読み上げ名「鍵付き」）を並べる
  - リンクありで、ユーザー名があれば `/u/{username}` へのリンクにする
  - `null` なら「削除したプロフィール」と出し、リンクも鍵マークも出さない
  - 使う場所: 投稿カード、コメント・返信、カルテ・クチコミのカードと詳細シート、メッセージの一覧と会話の見出し、通知、足あと、検索のユーザー、おすすめ、フォロー一覧、ブロック一覧
- 投稿の非公開の印: `post-card.tsx` の `LockMark label="非公開"` を、`Users` アイコン（読み上げ名「フォロワーのみ」）に替える

## Testing

monolith（rspec、`dystopia/monolith` でローカル実行）:

- `summarize_profiles`: 項目（鍵・アイコン URL・役割）、停止中と無効化されたアカウントを含めない、重複と nil の id、空の入力、1 回の問い合わせで読む（プロフィール数に比例して問い合わせが増えない）
- `ProfileSummaryPresenter`: 全項目、nil
- 9 ドメインの handler の spec: 要約の項目が入る。鍵付きの作者・相手で `is_private` が true。検索のユーザーで `avatar_url` が入る
- 削除済み・停止中の作者と相手で項目が未設定になる

frontend（vitest、`tsc --noEmit`）:

- `summaryToView`
- 各ドメインの BFF と変換が要約を `ProfileSummaryView` に変換する
- `ProfileName`: 鍵マーク、リンク、表示名が空のとき、削除済み
- 各カード・一覧: 鍵付きのときだけ鍵マークが出る。非公開の投稿は `Users` アイコンになる

ローカルの実機（monolith + frontend、使い捨て DB）:

- 鍵付きのプロフィールで投稿・コメント・カルテ・クチコミを作り、ホーム・投稿詳細・カルテとクチコミの一覧で鍵マークが出る
- 検索のユーザーにアイコンが出る
- 非公開の投稿は `Users` アイコンになる
