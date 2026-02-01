# monolith-slices Specification

## Purpose
TBD - created by archiving change refactor-nyx-monolith-architecture. Update Purpose after archive.
## Requirements
### Requirement: Slice Independence

各スライスは他のスライスに直接依存してはならない (MUST NOT)。

スライス間の通信が必要な場合は、Anti-Corruption Layer パターンを使用しなければならない (MUST)。

#### Scenario: No direct slice reference
- **GIVEN** Social スライスのコード
- **WHEN** Portfolio の情報が必要
- **THEN** `Portfolio::Slice["repositories.cast_repository"]` を直接参照しない
- **AND** `Social::Adapters::CastAdapter` を経由してアクセスする

#### Scenario: Adapter pattern for cross-slice communication
- **GIVEN** スライス A がスライス B の情報を必要とする
- **WHEN** 通信パターンを設計する
- **THEN** スライス A に `adapters/` ディレクトリを作成する
- **AND** スライス B のインターフェースを抽象化した Adapter クラスを実装する

### Requirement: Slice Directory Structure

各スライスは一貫したディレクトリ構造を持たなければならない (MUST)。

**必須ディレクトリ:**
- `db/` - データベース関連（relation.rb, repo.rb, struct.rb）
- `grpc/` - gRPC ハンドラー
- `repositories/` - データアクセス
- `use_cases/` - ビジネスロジック

**オプションディレクトリ:**
- `adapters/` - 他スライスへのアダプター
- `contracts/` - バリデーション
- `presenters/` - Proto 変換

#### Scenario: Required directories exist
- **GIVEN** 任意のスライス（identity, portfolio, social）
- **WHEN** ディレクトリ構造を確認する
- **THEN** `db/`, `grpc/`, `repositories/`, `use_cases/` が存在する

#### Scenario: Struct file requirement
- **GIVEN** スライスの db/ ディレクトリ
- **WHEN** 構造を確認する
- **THEN** `struct.rb` が存在する
- **AND** ROM struct の継承に使用される

### Requirement: No Slice-Specific Base Classes

スライス固有の基底クラス（action.rb, operation.rb, view.rb）は使用してはならない (MUST NOT)。

基底クラスは `app/` のみに配置しなければならない (MUST)。

#### Scenario: Base class location
- **GIVEN** Action, Operation, View の基底クラス
- **WHEN** 配置場所を確認する
- **THEN** `app/action.rb`, `app/operation.rb`, `app/view.rb` にのみ存在する
- **AND** 各スライスのルートには存在しない

#### Scenario: Remove identity base classes
- **GIVEN** identity スライス
- **WHEN** リファクタリング後
- **THEN** `slices/identity/action.rb` は存在しない
- **AND** `slices/identity/operation.rb` は存在しない
- **AND** `slices/identity/view.rb` は存在しない

### Requirement: Feature-Based Organization

contracts/ と use_cases/ は機能別に整理しなければならない (MUST)。

#### Scenario: Contracts organization
- **GIVEN** 複数の機能に関連する Contracts
- **WHEN** ファイルを配置する
- **THEN** `contracts/{feature}/` ディレクトリに整理される
- **AND** 各機能ディレクトリに関連する Contract ファイルが含まれる

#### Scenario: Use cases organization
- **GIVEN** 複数の機能に関連する Use Cases
- **WHEN** ファイルを配置する
- **THEN** `use_cases/{feature}/` ディレクトリに整理される
- **AND** 各機能ディレクトリに関連する Use Case ファイルが含まれる

#### Scenario: Feature directory examples
- **GIVEN** identity スライス
- **WHEN** 機能別整理を確認する
- **THEN** 以下のような構造になる:
  - `contracts/auth/` - 認証関連
  - `contracts/verification/` - 検証関連
  - `use_cases/auth/` - 認証関連
  - `use_cases/token/` - トークン関連

### Requirement: Adapter Implementation

スライス間通信のアダプターは以下のパターンに従わなければならない (MUST)。

#### Scenario: Adapter class structure
- **GIVEN** CastAdapter（Social → Portfolio）
- **WHEN** アダプターを実装する
- **THEN** 以下の構造に従う:
  - `Social::Adapters::CastAdapter` クラス
  - 依存注入で `cast_client` を受け取る
  - Data.define で戻り値の型を定義する
  - 必要最小限のフィールドのみを返す

#### Scenario: Adapter returns minimal data
- **GIVEN** CastAdapter の `find_by_user_id` メソッド
- **WHEN** Cast 情報を取得する
- **THEN** Social が必要とするフィールドのみを含む CastInfo を返す
- **AND** Portfolio の内部実装詳細を漏洩しない

### Requirement: Shared Authentication Logic

認証ロジックは `lib/grpc/authenticatable.rb` に抽出しなければならない (MUST)。

#### Scenario: Authentication concern usage
- **GIVEN** gRPC ハンドラー
- **WHEN** 認証が必要なメソッドを実装する
- **THEN** `include ::Grpc::Authenticatable` を追加する
- **AND** `authenticate_user!` メソッドを使用する

#### Scenario: Authenticatable module interface
- **GIVEN** `lib/grpc/authenticatable.rb` モジュール
- **WHEN** モジュールを定義する
- **THEN** 以下のメソッドを提供する:
  - `authenticate_user!` - 認証必須、未認証時は UNAUTHENTICATED エラー
  - `current_user_id` - 現在のユーザー ID を返す

