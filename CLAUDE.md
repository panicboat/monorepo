# Project Context for Claude

## Overview

**Nyx.PLACE** - キャスト個人が「時間」「信頼」「顧客」を資産として管理・運用できる CtoCプラットフォーム。

詳細は `openspec/project.md` を参照。

## Key References

| Document | Purpose |
|----------|---------|
| `openspec/project.md` | プロジェクト定義、ビジョン、ドメインコンテキスト |
| `openspec/AGENTS.md` | OpenSpec ワークフロー |
| `.claude/rules/*.md` | ルール（自動読み込み） |
| `services/handbooks/workspace/docs/**/*.md` | アーキテクチャ設計書 |

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
├── openspec/                       # Spec-driven development
└── .claude/                        # Claude Code rules & commands
```

### Domain Architecture

5つのドメインに分離（現在 Identity と Portfolio が実装済み）:

1. **Identity** - 認証・認可（Cast/Guest分岐）
2. **Portfolio** - カタログ、検索、プロフィール管理
3. **Concierge** - チャット、リアルタイム通信（未実装）
4. **Ritual** - スケジュール、予約トランザクション（未実装）
5. **Trust** - 評価、CRM、分析（未実装）

### Frontend-Backend Communication

```
Browser → Next.js API Routes (BFF) → gRPC → Monolith
```

### Proto Definitions

- `proto/identity/v1/service.proto` - IdentityService (認証)
- `proto/portfolio/v1/service.proto` - CastService (プロフィール)
