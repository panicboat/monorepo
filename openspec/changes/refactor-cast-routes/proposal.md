# Proposal: Refactor Cast Routes to `/cast`

**Goal**: Cast 向け画面の URL ルートを `/manage` から `/cast` に変更し、直感的で統一されたルーティング構造を実現する。

## Why
現在、Cast 用の画面は `/manage` 配下で提供されているが、これはコンテキスト（"Management"）を限定しすぎており、将来的な拡張（Cast 向けの非管理機能など）や、URL の分かりやすさの観点で課題がある。
ユーザーからの要望により、Cast 向け機能は全て `/cast` 配下に集約し、シンプルかつ明確な構造にリファクタリングする。

## Scope
- **Nyx (Frontend)**:
    - `/manage` ディレクトリを `/cast` 直下に移動・再構成する。
    - 既存の `/manage` への参照（リンク、リダイレクト、定数）を全て `/cast` ベースに置換する。
    - 関連するコンポーネント（NavBarなど）のリンク先を修正する。
    - `next.config.ts` 等のリダイレクト設定があれば修正する。
- **OpenSpec**:
    - URL 設計に関連するドキュメントを更新する。
