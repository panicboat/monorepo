# Proposal: Refactor Cast Routes to `/cast`

## Why
To align with the domain model and improve user experience, we are standardizing the Cast Managament URL to `/cast` and the Guest-facing Cast Profile to `/casts`.

## What Changes
1.  **Management Routes**: Rename `/manage` to `/cast` (e.g., `/cast/home`).
2.  **Guest Routes**: Rename `/cast` to `/casts` (e.g., `/casts/[id]`).
3.  **Codebase**: Update all redirects, links, and navigation components.

## Scope
- **Nyx (Frontend)**:
    - `/manage` ディレクトリを `/cast` 直下に移動・再構成する。
    - 既存の `/manage` への参照（リンク、リダイレクト、定数）を全て `/cast` ベースに置換する。
    - 関連するコンポーネント（NavBarなど）のリンク先を修正する。
    - `next.config.ts` 等のリダイレクト設定があれば修正する。
- **OpenSpec**:
    - URL 設計に関連するドキュメントを更新する。
