<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

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

詳細は `openspec/project.md` を参照。

## Key References

| Document | Purpose |
|----------|---------|
| `openspec/project.md` | プロジェクト定義、ビジョン（What） |
| `openspec/specs/` | 機能仕様（Requirements） |
| `openspec/AGENTS.md` | OpenSpec ワークフロー |
| `services/handbooks/workspace/docs/domains/` | **ドメイン定義（How）** |
| `services/handbooks/workspace/docs/ARCHITECTURE.md` | 技術スタック、全体構成 |
| `.claude/rules/*.md` | ルール（自動読み込み） |

### Document Roles

| 場所 | 役割 | 内容 |
|------|------|------|
| `openspec/` | 仕様（What） | ビジョン、機能要件、シナリオ |
| `handbooks/docs/` | 設計（How） | ドメイン定義、アーキテクチャ、実装ガイド |

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
