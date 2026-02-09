# Portfolio Spec Delta

## MODIFIED Requirements

### Requirement: Private Cast Profile Access Control (MUST)

Private キャストのプロフィールは、フォロー状態に応じて閲覧可能な情報を制限しなければならない (MUST)。

#### Scenario: Approved Follower Views Private Profile

- **Given** visibility が "private" のキャストが存在し
- **And** ゲストがそのキャストの approved フォロワーであるとき
- **When** ゲストがプロフィールを取得すると
- **Then** 完全なプロフィール情報（bio, plans, schedules, images 等）が返される
- **And** `profile_access` は "public" である

#### Scenario: Non-Follower Views Private Profile

- **Given** visibility が "private" のキャストが存在し
- **And** ゲストがそのキャストをフォローしていないとき
- **When** ゲストがプロフィールを取得すると
- **Then** 限定されたプロフィール情報が返される
- **And** `profile_access` は "private" である
- **And** 以下のフィールドは返される: handle, name, avatar_path, image_path, tagline, visibility, bio, images, tags, areas, genres, social_links, age, height, blood_type, three_sizes
- **And** 以下のフィールドは空または省略される: plans, schedules

#### Scenario: Pending Follower Views Private Profile

- **Given** visibility が "private" のキャストが存在し
- **And** ゲストがそのキャストへのフォローリクエストを pending 状態で持っているとき
- **When** ゲストがプロフィールを取得すると
- **Then** 限定されたプロフィール情報のみが返される
- **And** `profile_access` は "private" である

#### Scenario: Public Cast Profile Access

- **Given** visibility が "public" のキャストが存在するとき
- **When** 任意のゲストがプロフィールを取得すると
- **Then** 完全なプロフィール情報が返される
- **And** `profile_access` は "public" である

#### Scenario: Unauthenticated User Views Private Profile

- **Given** visibility が "private" のキャストが存在するとき
- **When** 未認証ユーザーがプロフィールを取得すると
- **Then** 限定されたプロフィール情報のみが返される
- **And** `profile_access` は "private" である

### Requirement: Profile Access Indicator (MUST)

プロフィール API レスポンスには、閲覧者のアクセスレベルを示すフィールドを含めなければならない (MUST)。

#### Scenario: GetCast Response Includes profile_access

- **Given** ゲストがキャストプロフィール API を呼び出すとき
- **When** レスポンスが返されると
- **Then** `profile_access` フィールドが含まれる
- **And** 値は "public" または "private" のいずれかである

### Requirement: Private Profile UI (MUST)

Private キャストの限定プロフィールを閲覧する際、適切な UI が表示されなければならない (MUST)。

#### Scenario: Display Limited Profile CTA

- **Given** ゲストが `profile_access: "private"` のプロフィールを閲覧しているとき
- **When** プロフィールページが表示されると
- **Then** 基本情報（名前、アバター、tagline、bio、画像、タグ等）は表示される
- **And** 南京錠アイコンが表示される
- **And** プラン・スケジュールセクションの代わりに「フォローして詳細を見る」メッセージが表示される
- **And** フォローボタンが目立つ形で表示される

#### Scenario: Pending Follow Request UI

- **Given** ゲストが pending 状態のフォローリクエストを持つ private キャストのプロフィールを閲覧しているとき
- **When** プロフィールページが表示されると
- **Then** 「フォローリクエスト送信済み」の状態が表示される
- **And** プラン・スケジュールセクションは非表示のままである
- **And** キャンセルボタンが表示される
