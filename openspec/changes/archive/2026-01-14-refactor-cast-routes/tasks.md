# Tasks: Refactor Cast Routes

- [x] **Specs Update**
    - [x] `portfolio` ドメインの仕様（URL要件）を更新する。

- [x] **Refactor: Directory Structure**
    - [x] `web/nyx/src/app/(cast)/manage` ディレクトリを `web/nyx/src/app/(cast)/cast` にリネーム・移動する。
    - [x] `web/nyx/src/app/(cast)/manage/page.tsx` (リダイレクト用) を削除または `/cast` 用に修正する。

- [x] **Refactor: Code References**
    - [x] `src/modules/shell/components/BottomNavBar.tsx` のリンクを更新する。
    - [x] `src/modules/shell/components/cast/` 配下のコンポーネント（NavBar等）のリンクを更新する。
    - [x] `src/app/(cast)/**/*` 内の `redirect()` や `router.push()` のパスを更新する。
    - [x] 全文検索で `/manage` を探し、Cast 関連のものを `/cast` に置換する。

- [x] **Verification**
    - [x] ビルドが通ることを確認する (`pnpm build`)。
    - [x] `/cast` にアクセスし、ダッシュボード等が表示されることを確認する。
