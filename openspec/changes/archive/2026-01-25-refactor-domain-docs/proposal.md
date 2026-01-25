# Change: Refactor Domain Documentation Structure

## Why
ドメインに関するドキュメントが `openspec/project.md`、`handbooks/docs/ARCHITECTURE.md`、`handbooks/docs/分散システム設計/MICROSERVICE.md` に分散しており、新ドメイン追加時にどこを更新すべきか不明確。

## What Changes
- **handbooks** を設計ドキュメントのメイン置き場として整理
- `handbooks/docs/domains/` ディレクトリを作成し、各ドメイン定義を独立ファイルで管理
- `openspec/project.md` はビジョン・コンセプトに専念し、ドメイン詳細は handbooks を参照
- CLAUDE.md で役割分担を明確化

## Impact
- Affected specs: なし（ドキュメント整理のみ）
- Affected code: なし
- Affected docs:
  - `services/handbooks/workspace/docs/domains/` (新規)
  - `services/handbooks/workspace/docs/ARCHITECTURE.md` (更新)
  - `openspec/project.md` (簡素化)
  - `CLAUDE.md` (更新)

## New Structure
```
openspec/
├── project.md              # ビジョン、コンセプト（What）
├── specs/                  # 機能仕様
└── changes/                # 変更提案

services/handbooks/workspace/docs/
├── ARCHITECTURE.md         # 技術スタック、全体構成
├── domains/                # ドメイン定義（新規）
│   ├── README.md           # ドメイン一覧・概要
│   ├── identity.md
│   ├── portfolio.md
│   ├── concierge.md
│   ├── ritual.md
│   ├── trust.md
│   └── social.md           # 新規追加
└── 分散システム設計/        # 詳細設計
```
