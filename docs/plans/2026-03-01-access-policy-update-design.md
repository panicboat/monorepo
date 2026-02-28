# Access Policy Document Update Design

## Background

ACCESS_POLICY.md がコードの実装と乖離していたため、実装コードを検証し最新化する。

## Scope

- マトリクスとルールの最新化（Post Visibility, Profile Access, Feed フィルタ）
- ドメイン名・実装パスの修正（Social → Post / Relationship / Feed）
- ブロック方向の修正（一方向 → 双方向）+ 実装状況の明記
- Adapter / Dependencies の最新化
- シードデータセクションは対象外

## Verified Discrepancies

| 項目 | 現ドキュメント | 実装 |
|------|--------------|------|
| ドメイン名 | Social | Post / Relationship / Feed |
| Policy パス | `slices/social/policies/` | `slices/post/policies/` |
| Block 方向 | Guest→Cast 一方向のみ | 双方向（Cast→Guest のフロントUIあり） |
| Cast→Guest Block 効果 | 記載なし | フォロー自動削除 + フォロー拒否 |
| Feed フィルタリング | 記載なし | 3種のフィルタで異なるルール |
| Post Adapter | 記載なし | `Post::Adapters::RelationshipAdapter` 存在 |
| SocialAdapter メソッド | 3つ | 5つ |
| private→public 自動承認 | 暗黙の前提 | 未実装（メソッドあるが呼ばれず） |

## Design

### Structure

```
ACCESS_POLICY.md
├── Overview（変更なし）
├── Terminology（Block の説明を双方向に修正）
├── Block Policy（新規：双方向ブロックのルールと実装状況）
├── Access Rules
│   ├── Post Access（変更なし）
│   ├── Profile Access（ブロック方向を明記）
│   ├── Feed Filtering（新規）
│   └── Action Permissions（ブロック方向を明記 + Follow の挙動を詳細化）
├── Access Matrix
│   ├── Post Visibility Matrix（Blocked カラムに方向明記）
│   ├── Profile Access Matrix（新規）
│   └── Feed Filtering Matrix（新規）
├── Implementation（ドメイン名・パス・メソッド修正）
├── Test Scenarios（据え置き）
└── Notes（Block Direction/Visibility Change/Future を更新）
```

### Key Changes

#### Block Policy (New)

双方向ブロックの仕様と実装状況を明記。

| 方向 | Backend | Frontend UI |
|------|---------|-------------|
| Guest → Cast | ✓ | 未実装（hook・API route は実装済み） |
| Cast → Guest | ✓ | ✓（ゲスト詳細画面のブロックボタン） |

Guest → Cast ブロック効果: 投稿・プロフィール・フィード全てDeny
Cast → Guest ブロック効果: フォロー自動削除 + フォロー拒否

#### Feed Filtering (New)

| Filter | 表示対象 |
|--------|---------|
| ALL | public cast の public post + followed cast の全 post |
| FOLLOWING | followed cast の全 post（public + private） |
| FAVORITES | favorited cast の **public post のみ** |

全フィルタ共通: Guest→Cast ブロック済みキャストは除外。

#### Profile Access Matrix (New)

| Cast Visibility | Follow Status | Blocked (G→C) | 基本プロフィール | 詳細プロフィール |
|-----------------|---------------|----------------|------------------|------------------|
| public | any | No | Allow | Allow |
| public | any | Yes | Deny | Deny |
| private | none/pending | No | Allow | Deny |
| private | approved | No | Allow | Allow |
| private | any | Yes | Deny | Deny |

#### Implementation Paths Fix

| Domain | Policy | Purpose |
|--------|--------|---------|
| Post | `slices/post/policies/access_policy.rb` | 投稿のアクセス制御 |
| Portfolio | `slices/portfolio/policies/profile_access_policy.rb` | プロフィールのアクセス制御 |
| Feed | `slices/feed/use_cases/list_guest_feed.rb` | フィードのフィルタリング |

#### Notes Updates

- `approve_all_pending` は未実装（メソッドは存在するが呼ばれていない）
- Future Considerations に Guest→Cast UI 実装と自動承認を追加

## Verification Sources

全て実装コードを直接読んで検証済み:

- `slices/post/policies/access_policy.rb`
- `slices/portfolio/policies/profile_access_policy.rb`
- `slices/feed/use_cases/list_guest_feed.rb`
- `slices/relationship/use_cases/blocks/block_user.rb`
- `slices/relationship/use_cases/follows/follow_cast.rb`
- `slices/relationship/repositories/block_repository.rb`
- `slices/relationship/repositories/follow_repository.rb`
- `slices/portfolio/adapters/social_adapter.rb`
- `slices/post/adapters/relationship_adapter.rb`
- `slices/portfolio/use_cases/save_cast_visibility.rb`
- `web/nyx/workspace/src/app/(cast)/cast/guests/[userId]/page.tsx`
- `web/nyx/workspace/src/app/(cast)/cast/blocks/page.tsx`
- `web/nyx/workspace/src/modules/relationship/hooks/useBlock.ts`
- `web/nyx/workspace/src/app/api/guest/blocks/route.ts`
- `web/nyx/workspace/src/app/api/cast/blocks/route.ts`
