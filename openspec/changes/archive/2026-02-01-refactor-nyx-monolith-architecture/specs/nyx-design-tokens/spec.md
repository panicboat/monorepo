# nyx-design-tokens Spec Delta

## ADDED Requirements

### Requirement: Design Token System

フロントエンドは CSS カスタムプロパティと Tailwind `@theme inline` を使用したデザイントークンシステムを採用しなければならない (MUST)。

#### Scenario: Token definition location
- **GIVEN** デザイントークン
- **WHEN** トークンを定義する
- **THEN** `app/globals.css` の `:root` セレクタ内に CSS カスタムプロパティとして定義される
- **AND** Tailwind で使用する場合は `@theme inline` ブロックでマッピングする

#### Scenario: Token naming convention
- **GIVEN** デザイントークン
- **WHEN** トークン名を決定する
- **THEN** `--color-*`, `--spacing-*`, `--text-*` などのプレフィックスを使用する
- **AND** kebab-case で命名する

### Requirement: Brand Color Tokens

ブランドカラーはトークンとして定義しなければならない (MUST)。

**定義するカラー:**
- `--color-brand-primary`: Guest 向けプライマリカラー（pink-500）
- `--color-brand-primary-hover`: ホバー状態
- `--color-brand-secondary`: Cast 向けセカンダリカラー（blue-400）
- `--color-brand-secondary-hover`: ホバー状態

#### Scenario: Brand color usage in components
- **GIVEN** Button コンポーネントの brand variant
- **WHEN** スタイルを定義する
- **THEN** `bg-pink-500` の代わりに `bg-brand` を使用する
- **AND** `bg-blue-400` の代わりに `bg-brand-cast` を使用する

#### Scenario: No hardcoded brand colors
- **GIVEN** コンポーネントのスタイル定義
- **WHEN** ブランドカラーを使用する
- **THEN** `pink-500`, `pink-600`, `blue-400`, `blue-500` を直接使用しない
- **AND** トークン参照（`bg-brand`, `text-brand` など）を使用する

### Requirement: Semantic Color Tokens

セマンティックカラーはトークンとして定義しなければならない (MUST)。

**定義するカラー:**
- `--color-surface`: 背景色（white）
- `--color-border`: ボーダー色（slate-200）
- `--color-text-primary`: プライマリテキスト色（slate-800）
- `--color-text-secondary`: セカンダリテキスト色（slate-500）
- `--color-text-muted`: ミュートテキスト色（slate-400）

#### Scenario: Surface color usage
- **GIVEN** カード、モーダルなどのサーフェス要素
- **WHEN** 背景色を設定する
- **THEN** `bg-surface` トークンを使用する

### Requirement: Status Color Tokens

ステータスカラーはトークンとして定義しなければならない (MUST)。

**定義するカラー:**
- `--color-success`: 成功状態（green-500）
- `--color-warning`: 警告状態（amber-500）
- `--color-error`: エラー状態（red-500）
- `--color-info`: 情報状態（blue-400）

#### Scenario: Status color usage in Toast
- **GIVEN** Toast コンポーネント
- **WHEN** バリアント別の色を設定する
- **THEN** `text-red-500` の代わりに `text-error` を使用する
- **AND** `text-green-500` の代わりに `text-success` を使用する

### Requirement: Role-Specific Color Tokens

Role 固有のカラーはトークンとして定義しなければならない (MUST)。

**定義するカラー:**
- `--color-role-guest`: Guest のアクセントカラー（brand-primary）
- `--color-role-cast`: Cast のアクセントカラー（brand-secondary）

#### Scenario: Role-based styling
- **GIVEN** Role によって色が変わるコンポーネント
- **WHEN** スタイルを適用する
- **THEN** `--color-role-guest` または `--color-role-cast` を参照する

### Requirement: Tailwind Theme Integration

デザイントークンは Tailwind の `@theme inline` で統合しなければならない (MUST)。

#### Scenario: Tailwind utility classes
- **GIVEN** `--color-brand-primary` CSS カスタムプロパティ
- **WHEN** Tailwind で使用する
- **THEN** `@theme inline` で `--color-brand: var(--color-brand-primary)` をマッピングする
- **AND** `bg-brand`, `text-brand` などのユーティリティクラスが使用可能になる

#### Scenario: Theme inline block structure
- **GIVEN** globals.css
- **WHEN** `@theme inline` ブロックを定義する
- **THEN** 以下のトークンを含む:
  - `--color-brand`
  - `--color-brand-hover`
  - `--color-brand-cast`
  - `--color-brand-cast-hover`
  - `--color-surface`
  - `--color-border`

### Requirement: TypeScript Theme Reference

TypeScript からデザイントークンを参照するため、`config/theme.ts` を提供しなければならない (MUST)。

#### Scenario: Theme config file location
- **GIVEN** デザイントークンを TypeScript から参照する必要がある
- **WHEN** 参照用ファイルを配置する
- **THEN** `config/theme.ts` に配置される

#### Scenario: Theme config exports
- **GIVEN** config/theme.ts
- **WHEN** エクスポートを確認する
- **THEN** `colors` オブジェクトがエクスポートされる
- **AND** CSS カスタムプロパティへの参照（`var(--color-*)` 形式）を含む
- **AND** `as const` で型安全性を確保する

#### Scenario: Theme config usage
- **GIVEN** TypeScript コンポーネント
- **WHEN** デザイントークンをプログラムで参照する
- **THEN** `import { colors } from '@/config/theme'` で参照する
- **AND** IDE補完が利用可能になる
