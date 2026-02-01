# nyx-modules Spec Delta

## ADDED Requirements

### Requirement: Frontend Module Structure

フロントエンドの `modules/` ディレクトリはドメインと 1:1 で対応しなければならない (MUST)。

**対応するドメイン:**
- identity
- portfolio
- social
- concierge
- ritual
- trust

ドメイン外のコンポーネントは `components/` に配置しなければならない (MUST)。

#### Scenario: Module directory structure
- **GIVEN** フロントエンドのソースコード構造
- **WHEN** modules/ ディレクトリを確認する
- **THEN** identity, portfolio, social, concierge, ritual, trust の6ディレクトリのみが存在する
- **AND** 各モジュールは components/, hooks/, lib/, types.ts を含むことができる

#### Scenario: Shell components location
- **GIVEN** ナビゲーションバーやレイアウトコンポーネント
- **WHEN** これらのコンポーネントを配置する
- **THEN** `components/layout/` に配置される
- **AND** `modules/shell/` は存在しない

#### Scenario: Discovery components relocation
- **GIVEN** TimelineFeed, RankingWidget, EventSlider コンポーネント
- **WHEN** これらのコンポーネントを配置する
- **THEN** TimelineFeed は `modules/social/components/` に配置される
- **AND** RankingWidget, EventSlider は `modules/portfolio/components/guest/` に配置される
- **AND** `modules/discovery/` は存在しない

### Requirement: Components Directory Structure

`components/` ディレクトリはドメイン非依存のコンポーネントを管理しなければならない (MUST)。

#### Scenario: Components subdirectories
- **GIVEN** components/ ディレクトリ
- **WHEN** サブディレクトリ構造を確認する
- **THEN** 以下のサブディレクトリが存在する:
  - `ui/` - プリミティブUI（Button, Input 等）
  - `layout/` - レイアウトコンポーネント（TopNavBar, BottomNavBar 等）
  - `shared/` - クロスドメイン共有コンポーネント
  - `providers/` - グローバル Provider

#### Scenario: Shared component criteria
- **GIVEN** 複数のドメインで使用されるコンポーネント
- **WHEN** そのコンポーネントがドメイン固有のビジネスロジックを含まない
- **THEN** `components/shared/` に配置される

### Requirement: Module Internal Structure

各ドメインモジュールは一貫した内部構造を持たなければならない (MUST)。

#### Scenario: Module internal directories
- **GIVEN** ドメインモジュール（例: portfolio）
- **WHEN** 内部構造を確認する
- **THEN** 以下のサブディレクトリを含むことができる:
  - `components/` - ドメイン固有UIコンポーネント
  - `components/cast/` - Cast向けコンポーネント
  - `components/guest/` - Guest向けコンポーネント
  - `hooks/` - ドメイン固有カスタムフック
  - `lib/` - ドメイン固有ユーティリティ
- **AND** `types.ts` が存在しなければならない

#### Scenario: Types file requirement
- **GIVEN** 任意のドメインモジュール
- **WHEN** モジュールのルートを確認する
- **THEN** `types.ts` ファイルが存在する
- **AND** ドメイン固有の型定義を含む
