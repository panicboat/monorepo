# Domain Architecture

本プロジェクトは **Modular Monolith** として構築されていますが、将来的な分割を見据えて以下のドメインに明確に分離して実装します。

## Domain Overview

| Domain | Role | Backend | Frontend |
|--------|------|---------|----------|
| [Identity](./identity.md) | 認証・認可 (Cast/Guest分岐) | `slices/identity` | `modules/identity` |
| [Portfolio](./portfolio.md) | カタログ、検索、プロフィール管理 | `slices/portfolio` | `modules/portfolio` |
| [Concierge](./concierge.md) | チャット、リアルタイム通信 | `slices/concierge` | `modules/concierge` |
| [Ritual](./ritual.md) | スケジュール、予約トランザクション | `slices/ritual` | `modules/ritual` |
| [Trust](./trust.md) | 評価、CRM、分析 | `slices/trust` | `modules/trust` |
| [Social](./social.md) | タイムライン、いいね、コメント | `slices/social` | `modules/social` |

## Implementation Status

| Domain | Backend | Frontend | Proto |
|--------|:-------:|:--------:|:-----:|
| Identity | ✓ | ✓ | ✓ |
| Portfolio | ✓ | ✓ | ✓ |
| Concierge | - | △ | - |
| Ritual | - | △ | - |
| Trust | - | △ | - |
| Social | - | △ | - |

- ✓: 実装済み
- △: UI のみ（モックデータ）
- -: 未実装

## Adding a New Domain

1. `domains/{domain-name}.md` にドメイン定義を作成
2. この README の一覧を更新
3. Backend: `services/monolith/workspace/slices/{domain}/` を作成
4. Frontend: `web/nyx/workspace/src/modules/{domain}/` を作成
5. Proto: `proto/{domain}/v1/service.proto` を作成
