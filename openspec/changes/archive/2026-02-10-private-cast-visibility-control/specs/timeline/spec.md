# Timeline Spec Delta

## MODIFIED Requirements

### Requirement: Post Visibility Schema Change (MUST)

投稿の可視性は `visibility` カラム（enum: public/private）で管理されなければならない (MUST)。これは `casts.visibility` と統一された命名・型である。

#### Scenario: Post with Public Visibility

- **Given** キャストが投稿を作成する
- **When** visibility を "public" に設定すると
- **Then** 投稿の visibility が "public" として保存される

#### Scenario: Post with Private Visibility

- **Given** キャストが投稿を作成する
- **When** visibility を "private" に設定すると
- **Then** 投稿の visibility が "private" として保存される

#### Scenario: Default Post Visibility

- **Given** キャストが新規投稿を作成する
- **When** visibility を明示的に指定しない場合
- **Then** デフォルト値 "public" が設定される

### Requirement: Combined Visibility Rule (MUST)

投稿の閲覧可否は、キャストの visibility と投稿の visibility の両方を評価して決定しなければならない (MUST)。

#### Scenario: Public Cast with Public Post

- **Given** visibility が "public" のキャストが存在する
- **And** そのキャストが visibility が "public" の投稿を持っている
- **When** 任意のゲストがタイムラインを取得すると
- **Then** その投稿がタイムラインに含まれる

#### Scenario: Public Cast with Private Post - Approved Follower

- **Given** visibility が "public" のキャストが存在する
- **And** そのキャストが visibility が "private" の投稿を持っている
- **And** ゲストがそのキャストの approved フォロワーであるとき
- **When** ゲストがタイムラインを取得すると
- **Then** その投稿がタイムラインに含まれる

#### Scenario: Public Cast with Private Post - Non-Follower

- **Given** visibility が "public" のキャストが存在する
- **And** そのキャストが visibility が "private" の投稿を持っている
- **And** ゲストがそのキャストをフォローしていないとき
- **When** ゲストがタイムラインを取得すると
- **Then** その投稿はタイムラインに含まれない

#### Scenario: Private Cast with Public Post - Approved Follower

- **Given** visibility が "private" のキャストが存在する
- **And** そのキャストが visibility が "public" の投稿を持っている
- **And** ゲストがそのキャストの approved フォロワーであるとき
- **When** ゲストがタイムラインを取得すると
- **Then** その投稿がタイムラインに含まれる

#### Scenario: Private Cast with Public Post - Non-Follower

- **Given** visibility が "private" のキャストが存在する
- **And** そのキャストが visibility が "public" の投稿を持っている
- **And** ゲストがそのキャストをフォローしていないとき
- **When** ゲストがタイムラインを取得すると
- **Then** その投稿はタイムラインに含まれない

#### Scenario: Private Cast with Private Post - Approved Follower

- **Given** visibility が "private" のキャストが存在する
- **And** そのキャストが visibility が "private" の投稿を持っている
- **And** ゲストがそのキャストの approved フォロワーであるとき
- **When** ゲストがタイムラインを取得すると
- **Then** その投稿がタイムラインに含まれる

#### Scenario: Private Cast with Private Post - Non-Follower

- **Given** visibility が "private" のキャストが存在する
- **And** そのキャストが visibility が "private" の投稿を持っている
- **And** ゲストがそのキャストをフォローしていないとき
- **When** ゲストがタイムラインを取得すると
- **Then** その投稿はタイムラインに含まれない

#### Scenario: Pending Follower Cannot See Non-Public Posts

- **Given** キャストの visibility または 投稿の visibility が "private" である
- **And** ゲストがそのキャストへのフォローリクエストを pending 状態で持っているとき
- **When** ゲストがタイムラインを取得すると
- **Then** その投稿はタイムラインに含まれない

#### Scenario: Unauthenticated User Sees Only Fully Public Posts

- **Given** 複数の投稿が存在する
- **When** 未認証ユーザーがタイムラインを取得すると
- **Then** cast.visibility == "public" かつ post.visibility == "public" の投稿のみが返される

### Requirement: Post Detail Access (MUST)

投稿詳細ページは、Combined Visibility Rule に従ってアクセス制御されなければならない (MUST)。

#### Scenario: Access Fully Public Post Detail

- **Given** visibility が "public" のキャストの、visibility が "public" の投稿が存在する
- **When** 任意のゲストが投稿詳細 API を呼び出すと
- **Then** 投稿の詳細が返される

#### Scenario: Approved Follower Views Non-Public Post Detail

- **Given** キャストまたは投稿の visibility が "private" である投稿が存在し
- **And** ゲストがそのキャストの approved フォロワーであるとき
- **When** ゲストが投稿詳細 API を呼び出すと
- **Then** 投稿の詳細が返される

#### Scenario: Non-Follower Cannot View Non-Public Post Detail

- **Given** キャストまたは投稿の visibility が "private" である投稿が存在し
- **And** ゲストがそのキャストをフォローしていないとき
- **When** ゲストが投稿詳細 API を呼び出すと
- **Then** 403 Forbidden が返される

#### Scenario: Post Detail Page Shows Access Denied

- **Given** キャストまたは投稿の visibility が "private" である投稿詳細ページにアクセスしようとして
- **And** ゲストがそのキャストをフォローしていないとき
- **When** ページが表示されると
- **Then** 「この投稿を見るにはフォローが必要です」メッセージが表示される
- **And** キャストのプロフィールへのリンクが表示される

### Requirement: Cast Detail Page Timeline Tab (MUST)

キャスト詳細ページのタイムラインタブは、Combined Visibility Rule に従って投稿を表示しなければならない (MUST)。

#### Scenario: Approved Follower Views All Posts

- **Given** ゲストがキャストの詳細ページを閲覧している
- **And** ゲストがそのキャストの approved フォロワーであるとき
- **When** タイムラインタブを選択すると
- **Then** public および private の投稿一覧が全て表示される

#### Scenario: Non-Follower Views Public Cast Public Posts Only

- **Given** ゲストが visibility "public" のキャストの詳細ページを閲覧している
- **And** ゲストがそのキャストをフォローしていないとき
- **When** タイムラインタブを選択すると
- **Then** visibility が "public" の投稿のみが表示される

#### Scenario: Non-Follower Cannot See Private Cast Posts

- **Given** ゲストが visibility "private" のキャストの詳細ページを閲覧している
- **And** ゲストがそのキャストをフォローしていないとき
- **When** タイムラインタブを選択すると
- **Then** 投稿は表示されない
- **And** 「フォローして投稿を見る」メッセージが表示される

### Requirement: Guest Timeline API Enhancement (MUST)

ゲスト向けタイムライン API は、Combined Visibility Rule に基づいて投稿をフィルタリングしなければならない (MUST)。

#### Scenario: Authenticated Guest Timeline Request

- **Given** 認証済みのゲストユーザー
- **When** GET `/api/guest/timeline` を呼び出す
- **Then** cast.visibility == "public" かつ post.visibility == "public" の投稿が返される
- **And** ゲストが approved フォロワーであるキャストの全ての投稿が返される
- **And** それ以外の投稿は返されない

#### Scenario: Unauthenticated Timeline Request

- **Given** 未認証のユーザー
- **When** タイムライン API を呼び出す
- **Then** cast.visibility == "public" かつ post.visibility == "public" の投稿のみが返される
