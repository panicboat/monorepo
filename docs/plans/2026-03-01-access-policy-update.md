# Access Policy Document Update - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ACCESS_POLICY.md を実装コードの実態に合わせて最新化する

**Architecture:** ドキュメントのみの変更。コード変更なし。1ファイル (`services/handbooks/workspace/docs/ACCESS_POLICY.md`) を Edit ツールで段階的に更新する。

**Tech Stack:** Markdown

---

## Task 1: Terminology セクションの Block 説明を修正

**Files:**
- Modify: `services/handbooks/workspace/docs/ACCESS_POLICY.md:22`

**Step 1: Edit Block の説明**

変更前:
```
| Block | ゲストがキャストをブロックしている状態（一方向のみ） |
```

変更後:
```
| Block | ユーザー間のブロック状態（双方向：Guest → Cast / Cast → Guest） |
```

**Step 2: Commit**

```bash
git add services/handbooks/workspace/docs/ACCESS_POLICY.md
git commit -m "docs(access-policy): update block terminology to bidirectional"
```

---

## Task 2: Block Policy セクションを新規追加

**Files:**
- Modify: `services/handbooks/workspace/docs/ACCESS_POLICY.md` (Terminology と Access Rules の間に挿入)

**Step 1: Terminology セクションの `---` 直後に Block Policy セクションを挿入**

挿入するコンテンツ:

```markdown
## Block Policy

ブロックは **双方向** で機能する。

| 方向 | 説明 | Backend | Frontend UI |
|------|------|---------|-------------|
| Guest → Cast | ゲストがキャストをブロック | ✓ | 未実装（hook・API route は実装済み） |
| Cast → Guest | キャストがゲストをブロック | ✓ | ✓（ゲスト詳細画面のブロックボタン） |

### Block Effects

**Guest → Cast ブロック時（Backend で制御）：**
- 投稿の閲覧 → Deny
- 基本プロフィールの閲覧 → Deny
- フィードから除外
- Like / Comment / Follow / Favorite → Deny

**Cast → Guest ブロック時：**
- フォロー関係を自動削除（`BlockUser` use case）
- 以後そのゲストからのフォロー申請を拒否（`FollowCast` use case）
- キャストの管理画面でブロック状態を表示

---
```

**Step 2: Commit**

```bash
git add services/handbooks/workspace/docs/ACCESS_POLICY.md
git commit -m "docs(access-policy): add block policy section with bidirectional rules"
```

---

## Task 3: Access Rules セクションを更新

**Files:**
- Modify: `services/handbooks/workspace/docs/ACCESS_POLICY.md` (Access Rules セクション全体)

**Step 1: Post Access のルールにステップ追加**

変更前:
```
1. blocked → Deny
2. cast.public && post.public → Allow (誰でも閲覧可)
3. follow.approved → Allow (全投稿閲覧可)
4. Otherwise → Deny
```

変更後:
```
1. Guest → Cast ブロック → Deny
2. cast.public && post.public → Allow（誰でも閲覧可）
3. 未認証 → Deny
4. follow.approved → Allow（全投稿閲覧可）
5. Otherwise → Deny
```

**Step 2: Profile Access のテーブルを更新**

変更前:
```
| 基本プロフィール | blocked | Deny |
| 基本プロフィール | not blocked | Allow |
| 詳細プロフィール（プラン・スケジュール） | blocked | Deny |
| 詳細プロフィール | cast.public | Allow |
| 詳細プロフィール | cast.private && follow.approved | Allow |
| 詳細プロフィール | cast.private && not follow.approved | Deny |
```

変更後:
```
| 基本プロフィール | Guest → Cast ブロック | Deny |
| 基本プロフィール | not blocked（未認証含む） | Allow |
| 詳細プロフィール（プラン・スケジュール・タイムライン） | Guest → Cast ブロック | Deny |
| 詳細プロフィール | cast.public | Allow |
| 詳細プロフィール | cast.private && follow.approved | Allow |
| 詳細プロフィール | cast.private && not follow.approved | Deny |
| 詳細プロフィール | 未認証 && cast.private | Deny |
```

**Step 3: Feed Filtering サブセクションを Action Permissions の前に追加**

```markdown
### Feed Filtering

ゲストのフィードは 3 種のフィルタで表示内容が異なる。
全フィルタ共通で、Guest → Cast ブロック済みキャストは除外される。

| Filter | 表示対象 |
|--------|---------|
| ALL | public cast の public post + followed cast の全 post |
| FOLLOWING | followed cast の全 post（public + private） |
| FAVORITES | favorited cast の **public post のみ** |
```

**Step 4: Action Permissions のテーブルを更新**

変更前:
```
| Follow | blocked | Deny |
| Follow | not blocked | Allow |
```

変更後:
```
| Follow | Cast → Guest ブロック | Deny |
| Follow | not blocked | Allow（public cast: approved / private cast: pending） |
```

Like / Comment / Favorite の「blocked」を「Guest → Cast ブロック」に置換。

**Step 5: Commit**

```bash
git add services/handbooks/workspace/docs/ACCESS_POLICY.md
git commit -m "docs(access-policy): update access rules with feed filtering and block direction"
```

---

## Task 4: Access Matrix セクションを更新

**Files:**
- Modify: `services/handbooks/workspace/docs/ACCESS_POLICY.md` (Access Matrix セクション)

**Step 1: Post Visibility Matrix の Blocked カラムに方向を明記**

`Blocked` → `Blocked (G→C)` に変更。

**Step 2: Simplified View のブロック注釈を更新**

変更前: `ブロックしている場合は常に Deny。`
変更後: `Guest → Cast ブロックしている場合は常に Deny。`

**Step 3: Profile Access Matrix を Simplified View の後に追加**

```markdown
### Profile Access Matrix

| Cast Visibility | Follow Status | Blocked (G→C) | 基本プロフィール | 詳細プロフィール |
|-----------------|---------------|----------------|------------------|------------------|
| public | any | No | **Allow** | **Allow** |
| public | any | Yes | Deny | Deny |
| private | none | No | **Allow** | Deny |
| private | pending | No | **Allow** | Deny |
| private | approved | No | **Allow** | **Allow** |
| private | any | Yes | Deny | Deny |
| any | - | 未認証 | **Allow** | cast.public のみ Allow |
```

**Step 4: Feed Filtering Matrix を追加**

```markdown
### Feed Filtering Matrix

| Filter | Cast Visibility | Follow Status | Post Visibility | Blocked (G→C) | Result |
|--------|-----------------|---------------|-----------------|----------------|--------|
| ALL | public | any | public | No | **Allow** |
| ALL | public | approved | private | No | **Allow** |
| ALL | public | not approved | private | No | Deny |
| ALL | private | approved | any | No | **Allow** |
| ALL | private | not approved | any | No | Deny |
| ALL | any | any | any | Yes | Deny |
| FOLLOWING | any | approved | any | No | **Allow** |
| FOLLOWING | any | approved | any | Yes | Deny |
| FAVORITES | any (favorited) | any | public | No | **Allow** |
| FAVORITES | any (favorited) | any | private | No | Deny |
| FAVORITES | any (favorited) | any | any | Yes | Deny |
```

**Step 5: Commit**

```bash
git add services/handbooks/workspace/docs/ACCESS_POLICY.md
git commit -m "docs(access-policy): add profile access and feed filtering matrices"
```

---

## Task 5: Implementation セクションを更新

**Files:**
- Modify: `services/handbooks/workspace/docs/ACCESS_POLICY.md` (Implementation セクション全体を差し替え)

**Step 1: Location テーブルを更新**

変更前:
```
| Social | `slices/social/policies/access_policy.rb` | 投稿のアクセス制御 |
| Portfolio | `slices/portfolio/policies/profile_access_policy.rb` | プロフィールのアクセス制御 |
```

変更後:
```
| Post | `slices/post/policies/access_policy.rb` | 投稿のアクセス制御 |
| Portfolio | `slices/portfolio/policies/profile_access_policy.rb` | プロフィールのアクセス制御 |
| Feed | `slices/feed/use_cases/list_guest_feed.rb` | フィードのフィルタリング |
```

**Step 2: クラス名を修正**

`Social::Policies::AccessPolicy` → `Post::Policies::AccessPolicy`

**Step 3: Cross-Domain Adapters を更新**

SocialAdapter のメソッド一覧を 5 つに更新し、`Post::Adapters::RelationshipAdapter` を追加:

```markdown
### Cross-Domain Adapters

Portfolio → Relationship:

```
Portfolio::Adapters::SocialAdapter
├── blocked?(guest_user_id:, cast_user_id:)
├── approved_follower?(guest_user_id:, cast_user_id:)
├── follow_status(guest_user_id:, cast_user_id:)
├── get_follow_detail(guest_user_id:, cast_user_id:)
└── cast_blocked_guest?(cast_user_id:, guest_user_id:)
```

Post → Relationship:

```
Post::Adapters::RelationshipAdapter
├── following?(cast_user_id:, guest_user_id:)
├── following_status_batch(cast_user_ids:, guest_user_id:)
├── following_cast_user_ids(guest_user_id:)
├── blocked?(blocker_id:, blocked_id:)
├── blocked_cast_ids(blocker_id:)
├── blocked_guest_ids(blocker_id:)
└── favorite_cast_user_ids(guest_user_id:)
```
```

**Step 4: Dependencies テーブルを更新**

変更前:
```
| `follow_repository` | Social | フォロー状態の取得 |
| `block_repository` | Social | ブロック状態の取得 |
```

変更後:
```
| `follow_repository` | Relationship | フォロー状態の取得 |
| `block_repository` | Relationship | ブロック状態の取得 |
| `favorite_repository` | Relationship | お気に入り状態の取得 |
```

**Step 5: Commit**

```bash
git add services/handbooks/workspace/docs/ACCESS_POLICY.md
git commit -m "docs(access-policy): fix implementation paths and add adapters"
```

---

## Task 6: Notes セクションを更新

**Files:**
- Modify: `services/handbooks/workspace/docs/ACCESS_POLICY.md` (Notes セクション全体を差し替え)

**Step 1: Block Direction を更新**

変更前:
```
ブロックは **一方向のみ**（ゲスト → キャスト）。キャストがゲストをブロックする機能は存在しない。
```

変更後:
```markdown
### Block Direction

ブロックは **双方向**。

- Guest → Cast: ゲストがキャストをブロック。コンテンツアクセスを制御。
- Cast → Guest: キャストがゲストをブロック。フォロー削除 + フォロー拒否。
```

**Step 2: Follow on Visibility Change サブセクションを追加**

```markdown
### Follow on Visibility Change

キャストが visibility を変更した場合：
- `public` → `private`: 既存の approved フォロワーはそのまま。新規フォローは pending になる。
- `private` → `public`: `approve_all_pending` メソッドは存在するが **現在は呼ばれていない**。pending リクエストは自動承認されない。
```

**Step 3: Future Considerations を更新**

変更前:
```
- ロールベースアクセス制御（RBAC）の導入時は別途検討
- キャスト間のアクセス制御は現時点では対象外
```

変更後:
```
- Guest → Cast ブロックのフロントエンド UI 実装
- `private` → `public` 切り替え時の pending リクエスト自動承認
- ロールベースアクセス制御（RBAC）の導入時は別途検討
- キャスト間のアクセス制御は現時点では対象外
```

**Step 4: Commit**

```bash
git add services/handbooks/workspace/docs/ACCESS_POLICY.md
git commit -m "docs(access-policy): update notes with bidirectional block and visibility change"
```

---

## Task 7: 最終確認

**Step 1: ドキュメント全体を読み通して整合性を確認**

Run: 目視で ACCESS_POLICY.md を通読し、以下を確認：
- セクション間の参照が整合しているか
- マトリクスの値が Access Rules と矛盾していないか
- Markdown の構文が正しいか

**Step 2: 問題があれば修正して Commit**

```bash
git add services/handbooks/workspace/docs/ACCESS_POLICY.md
git commit -m "docs(access-policy): final review and formatting fixes"
```
