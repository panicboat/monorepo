## ADDED Requirements

### Requirement: Portfolio Domain Integration (MUST)
Portfolio ドメインは、従来のトップレベル `cast` スライスに代わり、キャストのプロフィール管理ロジックを統合しなければならない (MUST)。

#### Scenario: Manage Cast Profiles
- **Given** ユーザーがキャストであるとき
- **When** プロフィールを更新すると
- **Then** `Portfolio` サービスが永続化を処理する
- **And** データは `Portfolio::Repositories::CastRepo` を介して保存される

### Requirement: Architectural Alignment (MUST)
システムは、ドメインロジックを適切なスライスに配置することで、Modular Monolith アーキテクチャを順守しなければならない (MUST)。

#### Scenario: Eliminate Top-Level Cast Slice
- **Given** モノリス構造において
- **Then** `Cast` 関連のロジックは `Portfolio` スライスに存在する
- **And** トップレベルの `Cast` スライスは存在しない
