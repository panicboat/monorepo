# Coding Rules

## Code Quality

- **一貫性を保つ** - 既存コードのスタイル・パターンに従う
- **TODO コメント** - 一時的な実装には必ず `// TODO:` を追加
- **FALLBACK コメント** - フォールバック処理を追加する場合は必ず `// FALLBACK:` コメントを追加

## Development (Seed Data)

- **シードデータ必須** - 新しいテーブルを作成する際は、必ずシードデータも作成する
- **テストパスワード** - 開発環境の Identity パスワードは `0000` で統一する
- シードファイルは `services/monolith/workspace/config/db/seeds/` に配置

# Project Context for Claude

## Overview

**Nyx.PLACE** - キャスト個人が「時間」「信頼」「顧客」を資産として管理・運用できる CtoCプラットフォーム。

## Key References

| Document | Purpose |
|----------|---------|
| `docs/ドメイン/` | **ドメイン定義（How）** |
| `docs/ARCHITECTURE.md` | 技術スタック、全体構成 |

## Quick Reference

### Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Hanami 2.x (Ruby) + gRPC/Gruf |
| Frontend | Next.js (App Router) + React 19 + Zustand |
| Communication | ConnectRPC (gRPC over HTTP/2) |
| Database | PostgreSQL |

### Architecture

```
monorepo/
├── services/monolith/workspace/    # Backend (Ruby/Hanami)
├── web/nyx/workspace/              # Frontend (Next.js)
├── proto/                          # Protocol Buffers
└── .claude/                        # Claude Code rules & commands
```

### Domain Architecture

3つのドメインに分離。詳細は `handbooks/docs/domains/` を参照。

| Domain | Role | Status |
|--------|------|--------|
| Identity | 認証・認可 | ✓ 実装済み |
| Portfolio | プロフィール管理 | ✓ 実装済み |
| Social | タイムライン | 実装中 |

### Frontend-Backend Communication

```
Browser → Next.js API Routes (BFF) → gRPC → Monolith
```

### Proto Definitions

- `proto/identity/v1/service.proto` - IdentityService (認証)
- `proto/portfolio/v1/service.proto` - CastService (プロフィール)

## Working in Services

サービス内で作業する際は、**作業開始前にそのサービスの `workspace/README.md` を読むこと**。

README には開発コマンド（proto 生成、ビルド、テストなど）が記載されている。
