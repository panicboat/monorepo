# Domain Architecture

本プロジェクトは **Modular Monolith** として構築されており、以下のドメインに分離して実装します。

## Domain Overview

| Domain | Role | Backend | Frontend |
|--------|------|---------|----------|
| [Feed](./_feed.md) | フィード集約 | `slices/feed` | `modules/feed` |
| [Identity](./_identity.md) | 認証・認可 (Cast/Guest分岐) | `slices/identity` | `modules/identity` |
| [Media](./_media.md) | メディアファイル統一管理 | `slices/media` | `modules/media` |
| [Offer](./_offer.md) | スケジュール・料金プラン管理 | `slices/offer` | `modules/offer` |
| [Portfolio](./_portfolio.md) | カタログ、検索、プロフィール管理 | `slices/portfolio` | `modules/portfolio` |
| [Post](./_post.md) | 投稿、いいね、コメント | `slices/post` | `modules/post` |
| [Relationship](./_relationship.md) | フォロー、ブロック、お気に入り | `slices/relationship` | `modules/relationship` |

## Domain Dependencies

```
Identity
    ↓
Portfolio ← Relationship
    ↓           ↓
  Offer      Post ← Media
               ↓
             Feed (aggregator)
```

## Adding a New Domain

1. `ドメイン/_{domain-name}.md` にドメイン定義を作成
2. この README の一覧を更新
3. Backend: `services/monolith/workspace/slices/{domain}/` を作成
4. Frontend: `web/nyx/workspace/src/modules/{domain}/` を作成
5. Proto: `proto/{domain}/v1/service.proto` を作成
