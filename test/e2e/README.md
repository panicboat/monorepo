# End-to-End Testing (Playwright)

このディレクトリには、システム全体（Monolith Backend + Nyx Frontend）の動作を検証するための End-to-End (E2E) テストが含まれています。
テストフレームワークには [Playwright](https://playwright.dev/) を使用しています。

## Prerequisites

テストを実行する前に、ローカル環境でアプリケーション全体が起動している必要があります。

1.  **Monolith Service**: `services/monolith/workspace` で `bin/grpc` を実行。
2.  **Nyx Frontend**: `web/nyx/workspace` で `pnpm dev` を実行 (Port 3000)。

または `local-apply.sh` を利用して Kubernetes 環境を起動する方法もあります。

## Getting Started

依存関係をインストールします。

```bash
cd test/e2e
pnpm install
pnpm exec playwright install --with-deps
```

## Running Tests

### Run all tests (Headless)

全てのテストをバックグラウンド（ヘッドレスモード）で実行します。CI環境と同様の動作です。

```bash
pnpm exec playwright test
```

### Run against Local Kubernetes (k8s)

`BASE_URL` 環境変数を指定することで、ポートフォワーディングされたローカル k8s 環境 (`nyx.local` など) に対してテストを実行可能です。
自己署名証明書による SSL エラーは設定で無視するようにしています。

```bash
# Example: http://nyx.local
BASE_URL=http://nyx.local pnpm exec playwright test

# Example: https://nyx.local (SSL)
BASE_URL=https://nyx.local pnpm exec playwright test
```

### Run with UI Mode (Recommended for Dev)

テストの実行状況を可視化し、タイムトラベルデバッグが可能なUIモードで起動します。
テスト作成中やデバッグ時はこちらが便利です。

```bash
pnpm exec playwright test --ui
```

### Debug Mode

```bash
pnpm exec playwright test --debug
```

## Testing Strategy & Guidelines

新規にテストケースを追加する際は、以下の指針に従ってください。

### 1. Scope: Critical User Journeys (CUJ) を対象にする
E2Eテストは実行時間が長く、メンテナンスコストも高いため、全ての機能を網羅しようとしないでください。
**「ユーザーにとって最も重要な体験（止まったらビジネスが停止するフロー）」** に絞ってテストを作成します。

Good Examples (✅):
- ゲストがログインできる。
- 新規キャストが登録フローを完了できる。
- ゲストがキャストを検索し、プロフィールを閲覧できる。

Bad Examples (❌):
- ボタンのホバー色が正しいか確認する（→ CSS/Unit Testでやるべき）。
- 特定のReactコンポーネントがProps通りにレンダリングされるか確認する（→ Frontend Unit Testでやるべき）。

### 2. Resilience: 実装詳細に依存しない
テストが「コードのリファクタリング（クラス名の変更など）」で壊れないように、ユーザーに見える要素で要素を取得してください。

- **推奨**: `page.getByRole('button', { name: 'Sign In' })` (ユーザーが見ている通り)
- **非推奨**: `page.locator('.btn-primary')` (CSSクラスが変わると壊れる)

### 3. Isolation: 独立性を保つ
各テストケースは独立して実行できるようにしてください（`test.beforeEach` など活用）。
一つのテストが失敗しても、他のテストに影響を与えないようにします。

## Directory Structure Guidelines

テストファイルが増えてきた場合、以下の指針でディレクトリを分割することを推奨します。

### Domain Driven Structure (推奨)
アプリケーションの「機能ドメイン（User Feature）」ごとにディレクトリを切る方法です。
ソースコードのモジュール構成と一致させやすく、開発者が見つけやすい構成です。

```
test/e2e/tests/
  ├── auth/           # 認証（ログイン、登録、パスワードリセットなど）
  ├── onboarding/     # オンボーディングフロー（Cast/Guest）
  ├── search/         # 検索機能
  ├── profile/        # プロフィール閲覧・編集
  ├── booking/        # 予約・決済フロー
  └── core/           # 共通機能・トップページなど
```

- **Role別** (`tests/guest/`, `tests/cast/`) に分ける方法もありますが、認証やチャットなど両者にまたがる機能も多いため、機能ドメイン別の方がスケールしやすい傾向にあります。
- `tests/` 直下には、特定のドメインに属さないシンプルなスモークテストなどを配置しても構いません。
- 共通のページオブジェクトやヘルパー関数は `test/e2e/pages` や `test/e2e/utils` に配置します。
