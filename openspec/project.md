# Project Definition

## Project Overview
- **Name:** PrivateHeaven(仮)
- **Vision:** "店舗"から"個"へ。流動する資産を、確固たる価値へ。
- **Mission:** キャスト個人の「信用」と「魅力」を資産化し、予約プロセスを「情緒的な儀式」へ昇華させる。

## Core Concepts (The Heart of Service)
### 1. The Premium Promise (Ritual over Transaction)
- 予約は事務処理ではなく「誓約」である。
- **Experience:** 「空き枠ポチり」ではなく、「招待状(Invitation)」を受け取り、「長押し(Long Press)」で誓う。
- **Sealed:** 確定後は「封蝋」され、安易なキャンセルを許さない心理的拘束力を持たせる。

### 2. Living Portfolio
- 静的なカタログではなく、リアルタイムな「状態」を売る。
- **No Calendar:** 事務的なカレンダーは排除。
- **Status Signal:** `🟢 Online`, `🟡 Tonight` などのリアルタイムステータスで可視化。
- **Trust Score:** 指名本数ではなく「約束履行率(Promise Rate)」を指標とする。

### 3. Sanctuary (Order)
- 無法地帯を許さない。No Show（無断キャンセル）はシステムレベルでペナルティ(Count)を付与し共有する。

## Architecture Guidelines
### One Screen Policy
- **原則:** チャット画面等のコア体験において、ページ遷移(Router Push)は極力行わない。
- **実装:**
  - 招待状作成 -> Bottom Sheet (Drawer)
  - 招待状開封 -> Full Screen Overlay
  - 設定/詳細 -> Modal / Slide-in
- ユーザーの「文脈」と「没入感」を途切れさせない。

## Technical Architecture & Principles
### 1. Infrastructure as Code & GitOps
- すべてのインフラ構成とデプロイメントパイプラインはコードで定義され、 Git で管理される。
- **Scope:** Kubernetes マニフェスト, Terraform, GitHub Actions ワークフローを含む。これらへの変更は「新しい Capability の導入（Add/Modify Requirements）」として扱う。

### 2. Verified Automation
- 手動操作を排除し、自動化されたワークフロー（Actions）を通じて検証・デプロイを行う。
- 新しい自動化の導入は、新しい「機能（Capability）」と同義とみなす。

### 3. Monorepo Structure
- `services/*`, `web/*`, `platform/*` の各領域における変更は、それぞれの領域の契約（Spec）に従う。

## Workflow Guidelines
### OpenSpec Lifecycle
- **Trigger:** 新しい機能、インフラ、ワークフローの追加時には必ず OpenSpec プロセス（Proposal -> Specs）を経由すること。
- **Review:** 実装完了後、必ずユーザーによるレビューと承認を受けること。
- **Archive:** 承認・デプロイ（マージ）完了後、**必ず** `openspec archive <change-id>` を実行し、変更提案を「仕様（Specs）」として確定させること。
    - **Note:** アーカイブを忘れると仕様と実装が乖離するため、これは完了条件の必須項目である。
