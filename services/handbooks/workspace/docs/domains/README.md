# Domain Architecture

本プロジェクトは **Modular Monolith** として構築されており、以下の3つのドメインに分離して実装します。

## Domain Overview

| Domain | Role | Backend | Frontend |
|--------|------|---------|----------|
| [Identity](./identity.md) | 認証・認可 (Cast/Guest分岐) | `slices/identity` | `modules/identity` |
| [Portfolio](./portfolio.md) | カタログ、検索、プロフィール管理 | `slices/portfolio` | `modules/portfolio` |
| [Social](./social.md) | タイムライン、いいね、コメント | `slices/social` | `modules/social` |

## Implementation Status

| Domain | Backend | Frontend | Proto |
|--------|:-------:|:--------:|:-----:|
| Identity | ✓ | ✓ | ✓ |
| Portfolio | ✓ | ✓ | ✓ |
| Social | ✓ | ✓ | ✓ |

- ✓: 実装済み

## Adding a New Domain

1. `domains/{domain-name}.md` にドメイン定義を作成
2. この README の一覧を更新
3. Backend: `services/monolith/workspace/slices/{domain}/` を作成
4. Frontend: `web/nyx/workspace/src/modules/{domain}/` を作成
5. Proto: `proto/{domain}/v1/service.proto` を作成
