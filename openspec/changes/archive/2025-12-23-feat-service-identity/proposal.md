# Proposal: Identity Service (Backend)

## Metadata
- **Change ID:** `feat-service-identity`
- **Created:** 2025-12-23
- **Status:** Draft

## Objective
モジュラーモノリスの最初のモジュールとして「Identity Service (認証・認可)」を実装するための仕様を定義し、スキャフォールドを作成する。

## Context
Step 1 で作成された `services/monolith/src` ディレクトリに、実際の業務ロジックを配置していく。
Identity Service は全てのユーザー (Cast/Guest) の入口であり、最も依存度が高いコアサービスであるため、最初に着手する。

## Scope
1. **Module Creation:** `services/monolith/src/internal/identity` ディレクトリを作成する。
2. **API Definition:** 認証に関連する基本的なインターフェース (Sign-up, Sign-in equivalent) を定義する。
3. **Database Schema:** ユーザー管理に必要なテーブル設計 (`users`, `auth_logs`) を定義する。

## Out of Scope
- 本格的な SMS 認証プロバイダとの連携実装（モックまたは簡易実装とする）。
- フロントエンドの実装 (Step 3 で実施)。
- 他サービス (Portfolio, Ritual) との連携。
