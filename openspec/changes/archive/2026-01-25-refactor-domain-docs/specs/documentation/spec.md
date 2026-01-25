## ADDED Requirements
### Requirement: Domain Documentation Structure
各ドメインの定義は `handbooks/docs/domains/` に独立したファイルとして管理されなければならない (MUST be managed as independent files)。

#### Scenario: 新しいドメインを追加する
- **GIVEN** 新しいドメイン（例: Social）を追加する必要がある
- **WHEN** 開発者がドメインドキュメントを作成する
- **THEN** `handbooks/docs/domains/{domain-name}.md` にファイルを作成する
- **AND** `domains/README.md` のドメイン一覧を更新する

#### Scenario: ドメイン定義を参照する
- **GIVEN** 開発者がドメインの責務や設計を確認したい
- **WHEN** ドキュメントを探す
- **THEN** `handbooks/docs/domains/` で該当ドメインのファイルを見つけられる

### Requirement: Documentation Role Separation
ドキュメントは役割に応じて適切な場所に配置されなければならない (MUST be placed according to role)。

#### Scenario: 仕様と設計の分離
- **GIVEN** プロジェクトのドキュメント体系
- **WHEN** 新しいドキュメントを作成する
- **THEN** 仕様（What）は `openspec/` に配置する
- **AND** 設計（How）は `handbooks/docs/` に配置する
