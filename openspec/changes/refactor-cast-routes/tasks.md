# Tasks: Refactor Cast Routes

- [ ] **Specs Update**
    - [ ] `portfolio` ドメインの仕様（URL要件）を更新する。

- [ ] **Refactor: Directory Structure**
    - [x] `web/nyx/src/app/(cast)/manage` ディレクトリを `web/nyx/src/app/(cast)/cast` にリネーム・移動する。
    - [/] `web/nyx/src/app/(cast)/manage/page.tsx` (リダイレクト用) を削除または `/cast` 用に修正する。

- [ ] **Refactor: Code References**
    - [x] `src/modules/shell/components/BottomNavBar.tsx` のリンクを更新する。
    - [x] `src/modules/shell/components/cast/` 配下のコンポーネント（NavBar等）のリンクを更新する。
    - [ ] `src/app/(cast)/**/*` 内の `redirect()` や `router.push()` のパスを更新する。
    - [ ] 全文検索で `/manage` を探し、Cast 関連のものを `/cast` に置換する。

- [ ] **Verification**
    - [ ] ビルドが通ることを確認する (`pnpm build`)。
    - [ ] `/cast` にアクセスし、ダッシュボード等が表示されることを確認する。
