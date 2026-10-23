# Settings Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロフィール削除・退会・鍵・通知設定の説明文を実際の動きに合わせ、利用規約・プライバシーポリシーの記載とそろえる（issue #1678）。

**Architecture:** frontend の文言だけを変える。サーバーの動きは変えない。文面は利用規約（`src/modules/legal/content/terms.ts`）の定めに合わせる。退会は「削除が済むまで」取り消せると書き、日数は書かない（規約・ポリシーも日数を書いていない）。鍵の説明は、規約（`terms.ts` の「プロフィールに鍵をかけても、他の利用者には、次のものなどが表示されます」）と同じく「投稿はフォロワーだけ、他は表示される」と書く。クチコミは、書いたクチコミは表示され、書かれたクチコミは条件によって隠れる（規約第 11 条第 3 項）ので、短い説明文では挙げない。

**Tech Stack:** Next.js / React / TypeScript / Vitest

**Spec:** issue #1678（https://github.com/panicboat/monorepo/issues/1678）

## Global Constraints

- 作業ディレクトリは `dystopia/frontend`
- 変える文言は下の 4 か所だけ。文言は各 Step の「」内をそのまま使う
- 「login」は使わず「ログイン」と書く
- 検証は `pnpm exec tsc --noEmit --incremental false`（exit code はパイプせずに取る）と `pnpm exec vitest run <files>`。`pnpm lint` は ESLint の既知の不具合で全滅するので使わない
- commit は `git commit -s`。`Co-Authored-By` を付けない

## Review Focus

- 退会の説明は 2 か所（設定画面の本文と確認ダイアログ）にある。両方を同じ文にする → Task 1 の Step 2
- 文言を確かめている既存のテスト（`NotificationSettings.test.tsx` など）が、古い文言のまま落ちないこと → Task 1 の Step 5

---

### Task 1: Align the settings copy with the actual behavior

**Files:**
- Modify: `dystopia/frontend/src/modules/profile/components/ProfileManager.tsx`（削除の確認ダイアログの説明）
- Modify: `dystopia/frontend/src/app/settings/page.tsx`（退会の説明と確認ダイアログ、2 か所）
- Modify: `dystopia/frontend/src/modules/profile/components/EditProfileSheet.tsx`（鍵の説明）
- Modify: `dystopia/frontend/src/modules/notifications/components/NotificationSettings.tsx`（「端末に送る通知」の注記）
- Test: 上のコンポーネントのテスト（`grep -rln "<古い文言の一部>" src` で見つかるもの）

- [ ] **Step 1: Profile deletion dialog**

「このプロフィールの投稿・コメント・フォロー・メッセージ・クチコミが削除され、元に戻せません。カルテの記録は残ります。」を次の文にする:
「このプロフィールの投稿・コメント・フォロー・クチコミが削除され、元に戻せません。相手に届いたメッセージは、送り主が表示されない状態で相手の側に残ります。カルテの記録も残ります。」

- [ ] **Step 2: Deactivation text (2 places)**

「30 日以内に同じ電話番号で login すれば自動的に復活します。」「30 日経過後はデータが消えます。」の 2 行を、2 か所とも次の文にする:
「退会すると、すべてのプロフィールが他の利用者に表示されなくなり、アカウントの情報は後日削除されます。削除が済むまでの間に同じ電話番号でログインすると、退会は取り消されます。」

- [ ] **Step 3: Private profile description**

「フォロワーだけが閲覧できます」を次の文にする:
「投稿はフォロワーだけが見られます。プロフィールの項目、フォロー・フォロワーの一覧、コメント、予定などは、フォロワー以外にも表示されます」

- [ ] **Step 4: Notification list note**

「アプリ内の通知一覧には、設定に関係なくすべて表示されます」を次の文にする:
「アプリ内の通知一覧には、設定に関係なくすべて表示されます。メッセージは通知一覧には載らず、「メッセージ」の未読件数でお知らせします」

- [ ] **Step 5: Update the tests that assert the old copy, and add one where none exists**

古い文言を確かめているテストは新しい文言に直す。4 か所のうちテストのないものは、そのコンポーネントの既存のテストファイルに、新しい文言が表示されることを確かめるテストを 1 件ずつ足す（テストファイル自体がないコンポーネントは足さず、報告する）。

- [ ] **Step 6: Verify**

Run: `pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"` と、変更したテストファイルを `pnpm exec vitest run <files>`
Expected: `tsc exit 0`、vitest 全件 pass

- [ ] **Step 7: Commit**

```bash
git add dystopia/frontend/src
git commit -s -m "fix(dystopia/frontend): align the settings copy with how deletion, privacy and notifications work"
```
