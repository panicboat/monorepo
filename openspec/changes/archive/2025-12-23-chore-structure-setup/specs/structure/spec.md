# Directory Structure Constraints

## ADDED Requirements

### Requirement: Frontend Isolation
- **Description:** フロントエンド関連のコードと設定は `web/` ディレクトリに隔離されなければならない (MUST be isolated in `web/` directory)。
- **Why:** ルートディレクトリを特定の言語エコシステム (Node.js) で汚染しないため。
#### Scenario: Check Structure
    - Given モノレポのルートディレクトリ
    - When `ls -a` を実行した時
    - Then `node_modules` が存在せず、`web/` ディレクトリが存在する

### Requirement: Service Container
- **Description:** バックエンドアプリケーションコードは `services/monolith/src/` ディレクトリの下に配置されなければならない (MUST be placed under `services/monolith/src/` directory)。
- **Why:** `workflow-config.yaml` で定義されたリポジトリ規約 (`root: services/{service}`, `docker directory: src`) に準拠するため。
#### Scenario: Check Backend Path
    - Given 新しいバックエンド機能を作成する場合
    - When コードを配置する時
    - Then `services/monolith/src/internal/<name>` のように、src ディレクトリ配下を選択しなければならない
