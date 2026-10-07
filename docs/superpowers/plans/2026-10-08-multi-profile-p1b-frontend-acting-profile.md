# Multi Profile P1b: Frontend Acting Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** frontend が「ログインしている account」と「操作中の profile」を分けて持ち、すべてのリクエストに操作中の profile を付けて、monolith の新しい契約(P1a)の上で動くようにする。

**Architecture:** `authStore` が `accountId` と `activeProfileId` を別々に持つ。クライアントは BFF へのリクエストに `x-profile-id` ヘッダを付け、BFF は `buildGrpcHeaders` でそれを monolith へ転送する。ログイン後は `ListMyProfiles` の結果から操作中の profile を決め、有効な profile が無ければ onboarding へ送る。monolith が返す理由コード(`error-reason`)は BFF がレスポンスの `code` に写し、クライアントはそれを見て profile を選び直す。

**Tech Stack:** Next.js 16(App Router、BFF は `src/app/api`)/ TypeScript 7 / zustand 5 / SWR 2 / Connect(`@connectrpc/connect-node`)/ vitest 5(`environment: "node"`)/ buf。monolith 側は Ruby 3.4 / Hanami 3 / RSpec。

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`

この plan は spec の Delivery 段 1 のうち frontend を扱う。monolith と proto は P1a(`2026-10-08-multi-profile-p1a-monolith-request-context.md`)で実装済みで、同じブランチに積む。冒頭の 2 タスクは、P1a の Known gaps のうち「次の plan の最初に直す」「P1b で直す」とした monolith 側の項目である。

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-model`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- frontend のコマンドは `dystopia/frontend` で、`env -u NODE_OPTIONS pnpm exec ...` の形で実行する。monolith のコマンドは `dystopia/monolith` で、`HANAMI_ENV=test rbenv exec bundle exec ...` の形で実行する。
- frontend の判定基準は `env -u NODE_OPTIONS pnpm exec tsc --noEmit`(エラー 0)と `env -u NODE_OPTIONS pnpm exec vitest run`(失敗 0)。`pnpm lint` は使わない(ESLint 10 の問題で全滅するため)。開始時点の基準は `tsc` エラー 0、`vitest` 72 ファイル 232 件すべて通過。
- monolith の判定基準は `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec.txt 2>&1`。出力は必ずファイルへ redirect する。開始時点の基準は `568 examples, 0 failures`。
- テスト用 database に seed や手動の行を入れない。spec の truncation は slice の schema の行を消さない。
- vitest は `environment: "node"` で動く。React の hook や component を描画するテストは書かない。テストは純粋関数・store・BFF の route handler を対象にする。
- `authStore` を実体のまま使うテストは、store を import する前に `localStorage` を stub する(Task 4 に書式がある)。node には使える `localStorage` が無く、stub しないと `set` が例外を投げる。
- `x-profile-id` を付けるのは自分の BFF(`/api/...`)への fetch だけとする。ストレージへの直接アップロード(`fetch(uploadUrl, ...)`)には付けない。
- 理由コードは `profile_required`(操作中の profile が無い)と `profile_not_permitted`(指定した profile が使えない)の 2 つ。monolith は gRPC の trailing metadata `error-reason` に載せ、BFF は JSON の `code` に写す。
- account の id を「これは自分か」の比較に使わない。比較は `activeProfileId` で行う。account の id を他人に見える場所(URL、props、API レスポンス)に出さない。
- component の props 名・view の型のフィールド名のうち、この plan が挙げていないもの(`targetAccountId`、`SocialAccountView.accountId` 等)は改名しない。値は profile の id になっている。改名は後続の段で行う。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。一時的な実装には `// TODO:`、エラーを握りつぶす箇所には `// SILENT:`、フォールバックには `// FALLBACK:` を付ける。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。
- 依存を追加しない。`pnpm install` / `bundle install` を実行しない(環境は準備済み)。

## Review Focus

spec が含意するが、素直に実装すると抜けやすい入力。各行のテストは括弧内のタスクに入れてある。

1. 別の account でログインし直したとき、前の account の `activeProfileId` が引き継がれない(Task 4)。
2. 保存されていた `activeProfileId` が、取得した自分の profile 一覧に無い、または無効になっているとき、それを使い続けない(Task 6)。
3. 有効な profile が 2 つ以上あり、保存された選択が無いとき、先頭の profile を勝手に選ばない(Task 6)。
4. `x-profile-id` を、ストレージへのアップロードなど自分の BFF 以外への fetch に付けない(Task 5)。
5. 理由コードの無い 403 / 422(DM の送信条件、人格数の上限、権限エラー)を受けても、操作中の profile を消さない(Task 7)。

---

### Task 1: Tighten two monolith specs

P1a の Known gaps のうち spec の手直し。production code は変更しない。

**Files:**
- Modify: `dystopia/monolith/spec/slices/identity/use_cases/account/purge_wiring_spec.rb`
- Modify: `dystopia/monolith/spec/lib/interceptors/authentication_interceptor_spec.rb`

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: purge の spec から id の大小への依存を外す**

`spec/slices/identity/use_cases/account/purge_wiring_spec.rb` で、第三者のスレッドが残ることを確認している次の行を置き換える。

変更前:

```ruby
    expect(db[:messaging__threads].where(id: thread[:id], account_b: bystander).count).to eq(1)
```

変更後:

```ruby
    expect(
      db[:messaging__threads].where(id: thread[:id]).where(Sequel.|({ account_a: bystander }, { account_b: bystander })).count
    ).to eq(1)
```

スレッドは 2 つの id を並べ替えて `account_a` / `account_b` に入れるため、第三者がどちらの列に入るかは id の大小で決まる。

同じファイルの末尾にある次の行を削除する(2 要素の配列リテラルの長さを確かめているだけで、何も検証していない)。

```ruby
    expect([post_a.id, post_b.id].length).to eq(2)
```

- [ ] **Step 2: interceptor の spec に、拒否していない場合の検証を足す**

`spec/lib/interceptors/authentication_interceptor_spec.rb` の `context "when x-user-id is present without x-profile-id"` にある 4 つの example と、`context "and it is an empty string"` の example のそれぞれで、`interceptor.call` のブロック内に次の 1 行を足す。

```ruby
          expect(Current.profile_denied).to be false
```

ブロックが `interceptor.call { expect(...) }` の 1 行形式になっている example は、`do ... end` の複数行形式に直してから足す。

- [ ] **Step 3: spec を実行する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/identity/use_cases/account/purge_wiring_spec.rb spec/lib/interceptors/authentication_interceptor_spec.rb > /tmp/rspec-t1.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-t1.txt`
Expected: `0 failures`

Step 2 で足した検証が実際に効くことを確かめる。`lib/interceptors/authentication_interceptor.rb` の `resolve_profile_id` の先頭に一時的に `::Current.profile_denied = true` を足して同じコマンドを実行し、足した 5 つの example が失敗することを確認してから、その行を消す。

Run: `git diff --stat lib`
Expected: 出力なし(production code に差分が残っていない)。

- [ ] **Step 4: Commit**

```bash
git add spec/slices/identity/use_cases/account/purge_wiring_spec.rb spec/lib/interceptors/authentication_interceptor_spec.rb && git commit -s -m "test(dystopia/monolith): remove an id-order dependency and pin the undenied state"
```

---

### Task 2: Reject profile creation for an account that has no identity row

`identity.accounts` に行が無い account でも profile を作れてしまう。その場合、上限判定のための行ロックが何もロックせず、role が決まらない profile ができる。

**Files:**
- Modify: `dystopia/monolith/slices/profile/use_cases/create_profile.rb`
- Modify: `dystopia/monolith/slices/profile/grpc/profile_handler.rb`
- Test: `dystopia/monolith/spec/slices/profile/use_cases/create_profile_spec.rb`
- Test: `dystopia/monolith/spec/slices/profile/grpc/profile_handler_spec.rb`

**Interfaces:**
- Consumes: P1a の `Profile::UseCases::CreateProfile`、`ProfileFixtures`(`create_account(role:)` は account の id を返す)
- Produces: `Profile::UseCases::CreateProfile::AccountNotFoundError`。gRPC `CreateProfile` は account の行が無いとき `NOT_FOUND`(メッセージ `"Account not found"`)を返す。

- [ ] **Step 1: spec を書き換える(失敗する)**

`spec/slices/profile/use_cases/create_profile_spec.rb` の `context "when the account row does not exist"` を次に置き換える。

```ruby
  context "when the account row does not exist" do
    it "rejects the creation and creates nothing" do
      account_id = SecureRandom.uuid_v7

      expect {
        uc.call(account_id: account_id, display_name: "Solo")
      }.to raise_error(Profile::UseCases::CreateProfile::AccountNotFoundError)
      expect(repo.list_by_account(account_id)).to eq([])
    end
  end
```

`spec/slices/profile/grpc/profile_handler_spec.rb` の `describe "#create_profile"` に次の example を足す。

```ruby
    it "raises NOT_FOUND when the account has no identity row" do
      Current.account_id = SecureRandom.uuid_v7

      expect { handler.create_profile }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end
```

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/profile/use_cases/create_profile_spec.rb spec/slices/profile/grpc/profile_handler_spec.rb > /tmp/rspec-t2.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-t2.txt`
Expected: 2 件の失敗(`AccountNotFoundError` が未定義、`NOT_FOUND` が返らない)。

- [ ] **Step 2: use case を実装する**

`slices/profile/use_cases/create_profile.rb` で、`LimitExceededError` の下に error を足す。

```ruby
      class AccountNotFoundError < StandardError; end
```

`call` の中で、検証の後・`create_within_limit` の前に account の存在を確かめるようにし、`limit_for` は取得済みの account を受け取る形に変える。`call` と `limit_for` を次に置き換える。

```ruby
      def call(account_id:, display_name:, username: nil)
        validate_display_name!(display_name)
        validate_username!(username) unless username.nil?

        account = identity_account_repo.find_by_id(account_id)
        raise AccountNotFoundError, "Account not found" unless account

        attrs = { display_name: display_name }
        attrs[:username] = username unless username.nil?

        profile = profile_repository.create_within_limit(
          account_id: account_id,
          limit: limit_for(account),
          attrs: attrs
        )
        raise LimitExceededError, "作成できるプロフィールの上限に達しています" unless profile

        profile
      end
```

```ruby
      def limit_for(account)
        account.role == ROLE_CAST ? CAST_PROFILE_LIMIT : SINGLE_PROFILE_LIMIT
      end
```

- [ ] **Step 3: handler を更新する**

`slices/profile/grpc/profile_handler.rb` の `create_profile` の `rescue` 節に 1 つ足す(`LimitExceededError` の `rescue` の下)。

```ruby
      rescue Profile::UseCases::CreateProfile::AccountNotFoundError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
```

- [ ] **Step 4: spec が通ることを確認する**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/slices/profile > /tmp/rspec-t2.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-t2.txt`
Expected: `0 failures`

- [ ] **Step 5: Commit**

```bash
git add slices/profile/use_cases/create_profile.rb slices/profile/grpc/profile_handler.rb spec/slices/profile && git commit -s -m "fix(dystopia/monolith): reject profile creation for an account without an identity row"
```

---

### Task 3: Regenerate the TypeScript stub and key the profile view by profile id

proto の `Profile.account_id` は P1a で `id` に改名済みだが、frontend の stub は古いままである。stub を作り直し、frontend の `ProfileView` も `id` で持つようにする。

**Files:**
- Generate: `dystopia/frontend/src/stub/profile/v1/service_pb.ts`
- Modify: `dystopia/frontend/src/modules/profile/types.ts`
- Modify: `dystopia/frontend/src/modules/profile/lib/mappers.ts`
- Modify: `dystopia/frontend/src/modules/social/lib/mappers.ts`
- Modify: `dystopia/frontend/src/app/api/profile/route.ts`
- Modify: `ProfileView` の `accountId` を読んでいる全ファイル(Step 4 の `tsc` が列挙する)
- Test: `dystopia/frontend/src/modules/profile/lib/mappers.test.ts` ほか、`tsc` / `vitest` が指す test

**Interfaces:**
- Consumes: P1a の proto(`Profile.id`、`Profile.disabled`、`GetProfileRequest.profile_id`、`ListMyProfiles`、`CreateProfile`)
- Produces:
  - `ProfileView`: `accountId` が無くなり、`id: string` と `disabled: boolean` を持つ
  - `mapProfileToView(p: Profile): ProfileView`、`emptyProfileView(id: string): ProfileView`
  - `profileClient.listMyProfiles` / `profileClient.createProfile` が型として存在する

- [ ] **Step 1: stub を生成する**

Run: `env -u NODE_OPTIONS pnpm proto:gen`
Expected: エラー無く終わる。

`buf generate` は全 package の stub を作り直す。profile 以外に差分や新規ファイルが出たら戻す。

Run: `git status --short src/stub`
Expected: `M src/stub/profile/v1/service_pb.ts` だけ。それ以外の変更は `git checkout -- <ファイル>` で戻し、untracked のファイル(`??`)は削除する。

Run: `/usr/bin/grep -c -E 'listMyProfiles|createProfile' src/stub/profile/v1/service_pb.ts`
Expected: `2` 以上。

- [ ] **Step 2: `tsc` が壊れた箇所を確認する**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit 2>&1 | head -20`
Expected: `accountId` に関するエラーが出る(`src/modules/profile/lib/mappers.ts`、`src/modules/social/lib/mappers.ts`、`src/app/api/profile/route.ts`、`src/modules/profile/lib/mappers.test.ts` など)。

- [ ] **Step 3: view の型と mapper を更新する**

`src/modules/profile/types.ts` の `ProfileView` で、`accountId: string;` を `id: string;` に置き換え、`role: number;` の下に 1 行足す。

```ts
  disabled: boolean;
```

`src/modules/profile/lib/mappers.ts` の `emptyProfileView` を次に置き換える。

```ts
export function emptyProfileView(id: string): ProfileView {
  return {
    id,
    username: "",
    displayName: "",
    bio: "",
    avatarMediaId: "",
    avatarUrl: "",
    coverMediaId: "",
    coverUrl: "",
    website: "",
    snsLinks: { ...EMPTY_SNS },
    prefecture: "",
    isPrivate: false,
    registeredAt: "",
    age: 0,
    bodyStats: { ...EMPTY_BODY_STATS },
    industry: "",
    role: 0,
    disabled: false,
  };
}
```

同ファイルの `mapProfileToView` で、`accountId: p.accountId,` を `id: p.id,` に置き換え、`role: p.role || 0,` の下に 1 行足す。

```ts
    disabled: p.disabled,
```

`src/modules/social/lib/mappers.ts` は proto の `Profile` を social の view に写している。view のフィールド名は変えず、値の読み元だけを変える。

```ts
    accountId: p.id,
```

```ts
    requesterAccountId: p.id,
```

`src/app/api/profile/route.ts` の `GET` で、`getProfile({ accountId: "" }, { headers })` を次に置き換える。

```ts
    const res = await profileClient.getProfile({ profileId: "" }, { headers });
```

- [ ] **Step 4: `ProfileView` の読み手を `id` に直す**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit 2>&1 | /usr/bin/grep -E "accountId" | head -60`

出力された各箇所を次の規則で直す。

- `Property 'accountId' does not exist on type 'ProfileView'`(またはその配列要素・`ProfileView | null`): `.accountId` を `.id` に置き換える。component に渡している props の名前(`targetAccountId={...}`、`accountId={...}` 等)は変えない。
- test で `ProfileView` や proto の `Profile` を作っている箇所の `accountId: "..."`: `id: "..."` に置き換える。proto を `create(ProfileSchema, { accountId: "acc-1" })` で作っている箇所は `create(ProfileSchema, { id: "prof-1" })` にし、同じ test 内の期待値も合わせる。
- `ProfileView` 以外の型(`SocialAccountView`、schedule や post の view など)の `.accountId` は変えない。`tsc` がエラーにしていない `.accountId` には触らない。

`tsc` のエラーが 0 になるまで繰り返す。

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "exit=$?"`
Expected: `exit=0`

- [ ] **Step 5: mapper の test に `id` と `disabled` の検証を足す**

`src/modules/profile/lib/mappers.test.ts` の `describe("mapProfileToView", ...)` に次の 2 つを足す。

```ts
  it("carries the profile id and no account id", () => {
    const proto = create(ProfileSchema, { id: "prof-1" });

    const view = mapProfileToView(proto);

    expect(view.id).toBe("prof-1");
    expect(Object.keys(view)).not.toContain("accountId");
  });

  it("maps the disabled flag", () => {
    expect(mapProfileToView(create(ProfileSchema, { id: "prof-1", disabled: true })).disabled).toBe(true);
    expect(mapProfileToView(create(ProfileSchema, { id: "prof-1" })).disabled).toBe(false);
  });
```

- [ ] **Step 6: 全体を確認する**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-t3.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t3.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、vitest は失敗 0。

Run: `/usr/bin/grep -rn -E 'accountId' src/modules/profile | /usr/bin/grep -v '\.test\.'`
Expected: `src/modules/profile/hooks/useProfile.ts` の 2 行だけ(`fetchProfileOrEmpty` の引数名と、それを `emptyProfileView` に渡している行)。この関数は Task 6 で削除する。

- [ ] **Step 7: Commit**

```bash
git add src && git commit -s -m "refactor(dystopia/frontend): key the profile view by profile id"
```

---

### Task 4: Split the auth store into account and acting profile

**Files:**
- Modify: `dystopia/frontend/src/stores/authStore.ts`(全体を置き換える)
- Create: `dystopia/frontend/src/stores/authStore.test.ts`
- Modify: store の `userId` / `selectUserId` を読んでいる全ファイル(Step 4 の `tsc` が列挙する)

**Interfaces:**
- Consumes: なし
- Produces(`@/stores/authStore`):
  - state: `role: Role | null` / `accountId: string | null` / `activeProfileId: string | null` / `isHydrated: boolean`
  - actions: `setIdentity({ accountId, role })` / `setActiveProfile(profileId: string | null)` / `clearIdentity()` / `setHydrated()` / `isAuthenticated()`
  - selectors: `selectRole` / `selectAccountId` / `selectActiveProfileId` / `selectIsAuthenticated` / `selectIsHydrated`
  - `migrateAuthState(persisted: unknown): { role, accountId, activeProfileId }`
  - `userId` と `selectUserId` は無くなる

- [ ] **Step 1: store の test を書く(失敗する)**

`src/stores/authStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore, migrateAuthState, selectAccountId, selectActiveProfileId, selectIsAuthenticated } =
  await import("./authStore");

describe("authStore", () => {
  beforeEach(() => {
    memory.clear();
    useAuthStore.getState().clearIdentity();
  });

  it("keeps the account and the acting profile as separate values", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    const state = useAuthStore.getState();
    expect(selectAccountId(state)).toBe("acc-1");
    expect(selectActiveProfileId(state)).toBe("prof-1");
  });

  it("is authenticated with an account even before a profile is active", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "guest" });

    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(selectActiveProfileId(useAuthStore.getState())).toBeNull();
  });

  it("keeps the acting profile when the same account signs in again", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });

    expect(selectActiveProfileId(useAuthStore.getState())).toBe("prof-1");
  });

  it("drops the acting profile when a different account signs in", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    useAuthStore.getState().setIdentity({ accountId: "acc-2", role: "guest" });

    expect(selectAccountId(useAuthStore.getState())).toBe("acc-2");
    expect(selectActiveProfileId(useAuthStore.getState())).toBeNull();
  });

  it("clears the account, the role and the acting profile together", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    useAuthStore.getState().clearIdentity();

    const state = useAuthStore.getState();
    expect(state.accountId).toBeNull();
    expect(state.role).toBeNull();
    expect(state.activeProfileId).toBeNull();
    expect(selectIsAuthenticated(state)).toBe(false);
  });

  it("persists only the identity fields", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    const stored = JSON.parse(memory.get("frontend-auth") as string);
    expect(stored.state).toEqual({ role: "cast", accountId: "acc-1", activeProfileId: "prof-1" });
  });
});

describe("migrateAuthState", () => {
  it("carries a stored userId over as the account id with no acting profile", () => {
    expect(migrateAuthState({ role: "cast", userId: "acc-1" })).toEqual({
      role: "cast",
      accountId: "acc-1",
      activeProfileId: null,
    });
  });

  it("returns an empty identity for missing state", () => {
    expect(migrateAuthState(undefined)).toEqual({ role: null, accountId: null, activeProfileId: null });
  });
});
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/stores/authStore.test.ts > /tmp/vitest-t4.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t4.txt | /usr/bin/grep -E 'Tests |FAIL' | head -5`
Expected: FAIL(`migrateAuthState` などが存在しない)。

- [ ] **Step 2: store を実装する**

`src/stores/authStore.ts` を次の内容に置き換える。

```ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Role } from "@/lib/auth";

interface PersistedAuth {
  role: Role | null;
  accountId: string | null;
  activeProfileId: string | null;
}

// Keep only identity state because tokens remain in httpOnly cookies.
interface AuthState extends PersistedAuth {
  isHydrated: boolean;

  setIdentity: (identity: { accountId: string; role: Role }) => void;
  setActiveProfile: (profileId: string | null) => void;
  clearIdentity: () => void;
  setHydrated: () => void;

  isAuthenticated: () => boolean;
}

export function migrateAuthState(persisted: unknown): PersistedAuth {
  const state = (persisted ?? {}) as Partial<PersistedAuth> & { userId?: string | null };
  return {
    role: state.role ?? null,
    accountId: state.accountId ?? state.userId ?? null,
    activeProfileId: state.activeProfileId ?? null,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      role: null,
      accountId: null,
      activeProfileId: null,
      isHydrated: false,

      // Drop the acting profile on an account change so one login never acts as another login's profile.
      setIdentity: ({ accountId, role }) =>
        set((state) => ({
          accountId,
          role,
          activeProfileId: state.accountId === accountId ? state.activeProfileId : null,
        })),
      setActiveProfile: (profileId) => set({ activeProfileId: profileId }),
      clearIdentity: () => set({ accountId: null, role: null, activeProfileId: null }),
      setHydrated: () => set({ isHydrated: true }),

      isAuthenticated: () => !!get().accountId,
    }),
    {
      name: "frontend-auth",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedAuth => ({
        role: state.role,
        accountId: state.accountId,
        activeProfileId: state.activeProfileId,
      }),
      migrate: (persisted) => migrateAuthState(persisted),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

export const selectRole = (state: AuthState) => state.role;
export const selectAccountId = (state: AuthState) => state.accountId;
export const selectActiveProfileId = (state: AuthState) => state.activeProfileId;
export const selectIsAuthenticated = (state: AuthState) => !!state.accountId;
export const selectIsHydrated = (state: AuthState) => state.isHydrated;
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/stores/authStore.test.ts > /tmp/vitest-t4.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t4.txt | /usr/bin/grep -E 'Tests '`
Expected: 8 件すべて通過。

- [ ] **Step 3: account を使う箇所を先に直す**

次のファイルは「ログインしているか」を見ている。`userId` を `accountId` に、`selectUserId` を `selectAccountId` に、`setIdentity({ userId: ... })` を `setIdentity({ accountId: ... })` に置き換える。

| ファイル | 置き換える箇所 |
|---|---|
| `src/lib/auth/fetch.ts` | `useAuthStore.getState().userId` → `useAuthStore.getState().accountId` |
| `src/lib/hooks/useApiMutation.ts` | 同上 |
| `src/lib/media.ts` | 同上 |
| `src/stores/postLikeStore.ts` | 同上(2 箇所) |
| `src/modules/identity/hooks/useAuth.tsx` | `selectUserId` → `selectAccountId`、ローカル変数 `userId` → `accountId`、`setIdentity({ userId: data.account.id, ... })` → `setIdentity({ accountId: data.account.id, ... })`(2 箇所) |
| `src/components/shell/AppShell.tsx` | `selectUserId` → `selectAccountId`。ローカル変数名 `viewerId` と `resolveShellMode` への渡し方は、この Task では変えない(Task 6 で作り直す) |

- [ ] **Step 4: 残りの読み手を acting profile に直す**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit 2>&1 | /usr/bin/grep -E "userId|selectUserId" | head -80`

出力された各箇所は「行為者として誰か」または「これは自分か」を見ている。次の規則で直す。

- `selectUserId` → `selectActiveProfileId`
- `useAuthStore((s) => s.userId)` → `useAuthStore((s) => s.activeProfileId)`
- `useAuthStore.getState().userId` → `useAuthStore.getState().activeProfileId`
- 受け取るローカル変数名(`userId`、`viewerId`)は変えなくてよい。
- store 以外の `userId`(コメントの view のフィールド `c.userId`、API の payload のキーなど)は変えない。`tsc` がエラーにしていない `userId` には触らない。

test で `vi.mock("@/stores/authStore", ...)` を使って `selectUserId` や `userId` を返している箇所は、production 側が読むようになった名前(`selectActiveProfileId` / `activeProfileId`、Step 3 のファイルに対する test なら `selectAccountId` / `accountId`)に合わせる。

`tsc` のエラーが 0 になるまで繰り返す。

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "exit=$?"`
Expected: `exit=0`

- [ ] **Step 5: 取りこぼしが無いことを確認する**

Run: `/usr/bin/grep -rn -E 'selectUserId|getState\(\)\.userId|\(s\) => s\.userId|\(state\) => state\.userId' src`
Expected: 出力なし。

Run: `env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-t4.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t4.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: 失敗 0。

- [ ] **Step 6: Commit**

```bash
git add src && git commit -s -m "refactor(dystopia/frontend): hold the account and the acting profile separately"
```

---

### Task 5: Send the acting profile with every BFF request

**Files:**
- Create: `dystopia/frontend/src/lib/auth/profile-headers.ts`
- Create: `dystopia/frontend/src/lib/auth/profile-headers.test.ts`
- Modify: `dystopia/frontend/src/lib/auth/fetch.ts`
- Modify: `dystopia/frontend/src/lib/hooks/useApiMutation.ts`
- Modify: `dystopia/frontend/src/lib/hooks/usePaginatedFetch.ts`
- Modify: `dystopia/frontend/src/lib/media.ts`
- Modify: `dystopia/frontend/src/modules/social/hooks/useFollowRequests.ts`
- Modify: `dystopia/frontend/src/modules/notifications/hooks/useNotifications.ts`
- Modify: `dystopia/frontend/src/modules/media/hooks/useMedia.ts`
- Modify: `dystopia/frontend/src/modules/media/hooks/useMediaUpload.ts`
- Modify: `dystopia/frontend/src/lib/request.ts`
- Test: `dystopia/frontend/src/lib/request.test.ts`

**Interfaces:**
- Consumes: Task 4 の `useAuthStore`(`activeProfileId`)
- Produces:
  - `@/lib/auth/profile-headers`: `PROFILE_ID_HEADER = "x-profile-id"`、`profileRequestHeaders(): Record<string, string>`(操作中の profile があれば `{ "x-profile-id": id }`、無ければ `{}`)
  - `@/lib/request`: `HEADER_NAMES.PROFILE_ID = "x-profile-id"`。`buildGrpcHeaders` は、access token を検証できたときに限り、リクエストの `x-profile-id` を転送する

- [ ] **Step 1: test を書く(失敗する)**

`src/lib/auth/profile-headers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore } = await import("@/stores/authStore");
const { profileRequestHeaders, PROFILE_ID_HEADER } = await import("./profile-headers");

describe("profileRequestHeaders", () => {
  beforeEach(() => {
    memory.clear();
    useAuthStore.getState().clearIdentity();
  });

  it("returns the acting profile as x-profile-id", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    expect(PROFILE_ID_HEADER).toBe("x-profile-id");
    expect(profileRequestHeaders()).toEqual({ "x-profile-id": "prof-1" });
  });

  it("returns no header when no profile is active", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });

    expect(profileRequestHeaders()).toEqual({});
  });

  it("never sends the account id", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    expect(Object.values(profileRequestHeaders())).not.toContain("acc-1");
  });
});
```

`src/lib/request.test.ts` の `describe("buildGrpcHeaders", ...)` に次の 3 つを足す。token の作り方は同ファイルの既存の example("forwards the verified token subject as x-user-id")と同じである。

```ts
  it("forwards x-profile-id alongside a verified x-user-id", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!");
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: { "x-profile-id": "0199c0de-0000-7000-8000-0000000000aa" },
    });
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);

    const headers = await buildGrpcHeaders(req);

    expect(headers["x-profile-id"]).toBe("0199c0de-0000-7000-8000-0000000000aa");
  });

  it("omits x-profile-id when the request has none", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!");
    const req = new NextRequest("http://localhost/api/test", { method: "POST" });
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);

    const headers = await buildGrpcHeaders(req);

    expect(headers["x-profile-id"]).toBeUndefined();
  });

  it("does not forward x-profile-id without a verified access token", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: { "x-profile-id": "0199c0de-0000-7000-8000-0000000000aa" },
    });

    const headers = await buildGrpcHeaders(req);

    expect(headers["x-profile-id"]).toBeUndefined();
    expect(headers["x-user-id"]).toBeUndefined();
  });
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/lib/auth/profile-headers.test.ts src/lib/request.test.ts > /tmp/vitest-t5.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t5.txt | /usr/bin/grep -E 'Tests |FAIL' | head -6`
Expected: FAIL(`profile-headers` が存在しない、`x-profile-id` が転送されない)。

- [ ] **Step 2: client の helper を実装する**

`src/lib/auth/profile-headers.ts`:

```ts
import { useAuthStore } from "@/stores/authStore";

export const PROFILE_ID_HEADER = "x-profile-id";

export function profileRequestHeaders(): Record<string, string> {
  const profileId = useAuthStore.getState().activeProfileId;
  return profileId ? { [PROFILE_ID_HEADER]: profileId } : {};
}
```

- [ ] **Step 3: BFF の転送を実装する**

`src/lib/request.ts` の `HEADER_NAMES` に 1 行足す。

```ts
  PROFILE_ID: "x-profile-id",
```

`buildGrpcHeaders` の `try` の中で、`headers[HEADER_NAMES.USER_ID] = sub;` の下に足す。

```ts
      const profileId = req.headers.get(HEADER_NAMES.PROFILE_ID);
      if (profileId) headers[HEADER_NAMES.PROFILE_ID] = profileId;
```

access token を検証できたときだけ転送するのは、account が分からない状態で profile だけを monolith に渡しても意味が無いためである。値の妥当性(形式、所有者、有効か)は monolith が検証する。

- [ ] **Step 4: BFF への fetch にヘッダを付ける**

`src/lib/auth/fetch.ts` で、import を足し、`headers` の初期値を変える。

```ts
import { profileRequestHeaders } from "@/lib/auth/profile-headers";
```

```ts
  const headers: Record<string, string> = { ...profileRequestHeaders() };
```

次のファイルは `authFetch` を通さずに自分の BFF を呼んでいる。同じ import を足し、該当する `fetch` の `headers` に `...profileRequestHeaders()` を展開する。`headers` を渡していない `fetch` には `headers: profileRequestHeaders()` を足す。

| ファイル | 対象の `fetch` |
|---|---|
| `src/lib/hooks/useApiMutation.ts` | `fetch(apiUrl, ...)` |
| `src/lib/hooks/usePaginatedFetch.ts` | `fetch(url, { cache: "no-store" })` |
| `src/lib/media.ts` | `/api/media/upload-url` と `/api/media/register` の 2 つ |
| `src/modules/social/hooks/useFollowRequests.ts` | `/api/social/follow/requests/.../approve` と `.../reject` の 2 つ |
| `src/modules/notifications/hooks/useNotifications.ts` | `/api/notifications/mark-all-read` と `/api/notifications/${id}/read` の 2 つ |
| `src/modules/media/hooks/useMedia.ts` | `/api/media/${id}`(GET)、`/api/media/batch`、`/api/media/${id}`(DELETE 等)の 3 つ |
| `src/modules/media/hooks/useMediaUpload.ts` | `/api/media/register` と `/api/media/upload-url` の 2 つ |

`headers` が既にある例:

```ts
    headers: {
      "Content-Type": "application/json",
      ...profileRequestHeaders(),
    },
```

**付けてはいけない `fetch`**: `fetch(uploadUrl, ...)`(`src/lib/media.ts`、`src/modules/media/hooks/useMediaUpload.ts`、`src/modules/profile/hooks/useMediaUpload.ts`)。これはストレージへの直接アップロードで、自分の BFF ではない。`src/modules/identity/hooks/useAuth.tsx` の fetch(`/api/identity/...`)も account を主体とするので付けない。

- [ ] **Step 5: 確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/lib/auth/profile-headers.test.ts src/lib/request.test.ts > /tmp/vitest-t5.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t5.txt | /usr/bin/grep -E 'Tests '`
Expected: 失敗 0。

自分の BFF を呼ぶ `fetch` のうち、ヘッダを付けていないものが identity 以外に残っていないことを確認する。

Run: `/usr/bin/grep -rn -E '\bfetch\(' src --include=*.ts --include=*.tsx | /usr/bin/grep -v -E '\.test\.|^src/app/api/|^src/stub/'`

出力の各行について、次のどれかに当たることを確認する。

- `src/lib/auth/fetch.ts` の `fetch(url, ...)`: `headers` に `profileRequestHeaders()` が入っている
- Step 4 の表の `fetch`: 同上
- `fetch(uploadUrl, ...)`: 付けていない
- `src/modules/identity/hooks/useAuth.tsx` の `fetch`: 付けていない

どれにも当たらない `fetch` があれば、呼び先が自分の BFF(`/api/...`)で identity 以外なら付ける。

Run: `/usr/bin/grep -rn -A4 'fetch(uploadUrl' src --include=*.ts | /usr/bin/grep -c 'profileRequestHeaders'`
Expected: `0`

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-t5.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t5.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、vitest は失敗 0。

- [ ] **Step 6: Commit**

```bash
git add src && git commit -s -m "feat(dystopia/frontend): send the acting profile with every BFF request"
```

---

### Task 6: Resolve the acting profile after sign-in and create the first profile in onboarding

**Files:**
- Create: `dystopia/frontend/src/modules/profile/lib/session.ts`
- Create: `dystopia/frontend/src/modules/profile/lib/session.test.ts`
- Create: `dystopia/frontend/src/modules/profile/hooks/useProfileSession.ts`
- Create: `dystopia/frontend/src/app/api/profile/mine/route.ts`
- Create: `dystopia/frontend/src/app/api/profile/mine/route.test.ts`
- Create: `dystopia/frontend/src/app/api/profile/route.test.ts`
- Modify: `dystopia/frontend/src/app/api/profile/route.ts`
- Modify: `dystopia/frontend/src/modules/profile/hooks/useProfile.ts`
- Delete: `dystopia/frontend/src/modules/profile/hooks/useProfile.test.ts`
- Modify: `dystopia/frontend/src/modules/profile/hooks/index.ts`
- Modify: `dystopia/frontend/src/modules/profile/types.ts`
- Modify: `dystopia/frontend/src/components/shell/resolveShellMode.ts`
- Modify: `dystopia/frontend/src/components/shell/AppShell.tsx`
- Modify: `dystopia/frontend/src/app/onboarding/page.tsx`
- Test: `dystopia/frontend/src/components/shell/resolveShellMode.test.ts`(全体を置き換える)

**Interfaces:**
- Consumes: Task 3 の `ProfileView`(`id` / `disabled`)と `mapProfileToView`、Task 4 の store、Task 5 のヘッダ
- Produces:
  - `@/modules/profile/lib/session`: `MY_PROFILES_URL = "/api/profile/mine"`、`type ProfileSession = { kind: "onboarding" } | { kind: "active"; profileId: string } | { kind: "select" }`、`resolveProfileSession(profiles: Pick<ProfileView, "id" | "disabled">[], storedProfileId: string | null): ProfileSession`、`myProfilesKey(accountId: string): readonly [string, string]`、`isMyProfilesKey(key: unknown): boolean`
  - `@/modules/profile/hooks`: `useProfileSession(): ProfileSession | null`、`useProfile()` は `createProfile(payload: CreateProfilePayload)` も返す
  - `@/modules/profile/types`: `CreateProfilePayload { displayName: string; username?: string }`、`MyProfilesResponse { profiles: ProfileView[] }`
  - BFF: `GET /api/profile/mine` → `{ profiles: ProfileView[] }`、`POST /api/profile` → `{ profile: ProfileView }`
  - `resolveShellMode({ isHydrated, isAuthenticated, hasActiveProfile, isAuthRoute, isLandingRoute })`

- [ ] **Step 1: 純粋関数の test を書く(失敗する)**

`src/modules/profile/lib/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isMyProfilesKey, myProfilesKey, resolveProfileSession } from "./session";

const enabled = (id: string) => ({ id, disabled: false });
const disabled = (id: string) => ({ id, disabled: true });

describe("resolveProfileSession", () => {
  it("sends an account with no profile to onboarding", () => {
    expect(resolveProfileSession([], null)).toEqual({ kind: "onboarding" });
  });

  it("sends an account whose profiles are all disabled to onboarding", () => {
    expect(resolveProfileSession([disabled("p1")], "p1")).toEqual({ kind: "onboarding" });
  });

  it("activates the only enabled profile", () => {
    expect(resolveProfileSession([enabled("p1")], null)).toEqual({ kind: "active", profileId: "p1" });
  });

  it("activates the only enabled profile even when another id was stored", () => {
    expect(resolveProfileSession([enabled("p1")], "gone")).toEqual({ kind: "active", profileId: "p1" });
  });

  it("keeps the stored profile when it is still enabled among several", () => {
    expect(resolveProfileSession([enabled("p1"), enabled("p2")], "p2")).toEqual({ kind: "active", profileId: "p2" });
  });

  it("asks for a selection instead of picking one when several are enabled and none is stored", () => {
    expect(resolveProfileSession([enabled("p1"), enabled("p2")], null)).toEqual({ kind: "select" });
  });

  it("asks for a selection when the stored profile is not in the list", () => {
    expect(resolveProfileSession([enabled("p1"), enabled("p2")], "gone")).toEqual({ kind: "select" });
  });

  it("does not keep a stored profile that has been disabled", () => {
    expect(resolveProfileSession([enabled("p1"), enabled("p2"), disabled("p3")], "p3")).toEqual({ kind: "select" });
    expect(resolveProfileSession([enabled("p1"), disabled("p3")], "p3")).toEqual({ kind: "active", profileId: "p1" });
  });
});

describe("myProfilesKey", () => {
  it("separates the cache per account", () => {
    expect(myProfilesKey("acc-1")).toEqual(["/api/profile/mine", "acc-1"]);
    expect(myProfilesKey("acc-1")).not.toEqual(myProfilesKey("acc-2"));
  });

  it("is recognised by isMyProfilesKey and nothing else is", () => {
    expect(isMyProfilesKey(myProfilesKey("acc-1"))).toBe(true);
    expect(isMyProfilesKey("/api/profile/mine")).toBe(false);
    expect(isMyProfilesKey(["/api/profile", "acc-1"])).toBe(false);
    expect(isMyProfilesKey(null)).toBe(false);
  });
});
```

`src/components/shell/resolveShellMode.test.ts` を次の内容に置き換える。

```ts
import { describe, expect, it } from "vitest";
import { resolveShellMode } from "./resolveShellMode";

const base = { isHydrated: true, isAuthenticated: true, hasActiveProfile: true, isAuthRoute: false, isLandingRoute: false };

describe("resolveShellMode", () => {
  it("stays bare for an auth route in every identity state", () => {
    expect(resolveShellMode({ ...base, isAuthRoute: true })).toBe("bare");
    expect(resolveShellMode({ ...base, isAuthRoute: true, isHydrated: false })).toBe("bare");
    expect(resolveShellMode({ ...base, isAuthRoute: true, isAuthenticated: false, hasActiveProfile: false })).toBe("bare");
    expect(resolveShellMode({ ...base, isAuthRoute: true, hasActiveProfile: false })).toBe("bare");
  });

  it("renders nothing before hydration on a non-auth route", () => {
    expect(resolveShellMode({ ...base, isHydrated: false })).toBe("loading");
  });

  it("renders the landing page once hydrated with no account on the landing route", () => {
    expect(resolveShellMode({ ...base, isAuthenticated: false, hasActiveProfile: false, isLandingRoute: true })).toBe("landing");
  });

  it("renders nothing once hydrated with no account on a non-landing route", () => {
    expect(resolveShellMode({ ...base, isAuthenticated: false, hasActiveProfile: false })).toBe("loading");
  });

  it("renders nothing for an account whose acting profile is not resolved yet", () => {
    expect(resolveShellMode({ ...base, hasActiveProfile: false })).toBe("loading");
    expect(resolveShellMode({ ...base, hasActiveProfile: false, isLandingRoute: true })).toBe("loading");
  });

  it("renders the full shell with an account and an acting profile", () => {
    expect(resolveShellMode(base)).toBe("shell");
    expect(resolveShellMode({ ...base, isLandingRoute: true })).toBe("shell");
  });
});
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/modules/profile/lib/session.test.ts src/components/shell/resolveShellMode.test.ts > /tmp/vitest-t6.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t6.txt | /usr/bin/grep -E 'Tests |FAIL' | head -6`
Expected: FAIL。

- [ ] **Step 2: 純粋関数を実装する**

`src/modules/profile/lib/session.ts`:

```ts
import type { ProfileView } from "@/modules/profile/types";

export const MY_PROFILES_URL = "/api/profile/mine";

export type ProfileSession =
  | { kind: "onboarding" }
  | { kind: "active"; profileId: string }
  | { kind: "select" };

// Never pick one of several enabled profiles implicitly; acting as an unintended profile is the failure to avoid.
export function resolveProfileSession(
  profiles: Pick<ProfileView, "id" | "disabled">[],
  storedProfileId: string | null
): ProfileSession {
  const enabled = profiles.filter((profile) => !profile.disabled);
  if (enabled.length === 0) return { kind: "onboarding" };
  if (enabled.length === 1) return { kind: "active", profileId: enabled[0].id };
  if (storedProfileId && enabled.some((profile) => profile.id === storedProfileId)) {
    return { kind: "active", profileId: storedProfileId };
  }
  return { kind: "select" };
}

export function myProfilesKey(accountId: string): readonly [string, string] {
  return [MY_PROFILES_URL, accountId];
}

export function isMyProfilesKey(key: unknown): boolean {
  return Array.isArray(key) && key[0] === MY_PROFILES_URL;
}
```

`src/components/shell/resolveShellMode.ts` を次の内容に置き換える。

```ts
export type ShellMode = "bare" | "loading" | "landing" | "shell";

interface ResolveShellModeArgs {
  isHydrated: boolean;
  isAuthenticated: boolean;
  hasActiveProfile: boolean;
  isAuthRoute: boolean;
  isLandingRoute: boolean;
}

// Keep auth routes bare to avoid remounting authenticated onboarding forms.
export function resolveShellMode({
  isHydrated,
  isAuthenticated,
  hasActiveProfile,
  isAuthRoute,
  isLandingRoute,
}: ResolveShellModeArgs): ShellMode {
  if (isAuthRoute) return "bare";
  if (!isHydrated) return "loading";
  if (!isAuthenticated) return isLandingRoute ? "landing" : "loading";
  if (!hasActiveProfile) return "loading";
  return "shell";
}
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/modules/profile/lib/session.test.ts src/components/shell/resolveShellMode.test.ts > /tmp/vitest-t6.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t6.txt | /usr/bin/grep -E 'Tests '`
Expected: 失敗 0。(`AppShell.tsx` はまだ古い引数で呼んでいるので `tsc` は通らない。Step 6 で直す。)

- [ ] **Step 3: BFF の route の test を書く(失敗する)**

`src/app/api/profile/mine/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ProfileSchema } from "@/stub/profile/v1/service_pb";

vi.mock("@/lib/grpc", () => ({
  profileClient: { listMyProfiles: vi.fn() },
}));

vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-user-id": "acc-1" })),
}));

const { profileClient } = await import("@/lib/grpc");
const { GET } = await import("./route");
const listMyProfiles = (profileClient as unknown as { listMyProfiles: ReturnType<typeof vi.fn> }).listMyProfiles;

function request(withCookie = true) {
  const req = new NextRequest("http://localhost/api/profile/mine");
  if (withCookie) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("GET /api/profile/mine", () => {
  beforeEach(() => {
    listMyProfiles.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns every profile of the account as views keyed by profile id", async () => {
    listMyProfiles.mockResolvedValue({
      profiles: [
        create(ProfileSchema, { id: "prof-1", displayName: "A" }),
        create(ProfileSchema, { id: "prof-2", displayName: "B", disabled: true }),
      ],
    });

    const res = await GET(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profiles.map((p: { id: string }) => p.id)).toEqual(["prof-1", "prof-2"]);
    expect(body.profiles[1].disabled).toBe(true);
    expect(JSON.stringify(body)).not.toContain("acc-1");
  });

  it("returns an empty list for an account with no profile", async () => {
    listMyProfiles.mockResolvedValue({ profiles: [] });

    const body = await (await GET(request())).json();

    expect(body.profiles).toEqual([]);
  });

  it("returns 401 without an access cookie and does not call the monolith", async () => {
    const res = await GET(request(false));

    expect(res.status).toBe(401);
    expect(listMyProfiles).not.toHaveBeenCalled();
  });

  it("maps a monolith error to its HTTP status", async () => {
    listMyProfiles.mockRejectedValue(new ConnectError("unauthenticated", Code.Unauthenticated));

    const res = await GET(request());

    expect(res.status).toBe(401);
  });
});
```

`src/app/api/profile/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ProfileSchema } from "@/stub/profile/v1/service_pb";

vi.mock("@/lib/grpc", () => ({
  profileClient: { getProfile: vi.fn(), saveProfile: vi.fn(), createProfile: vi.fn() },
}));

vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-user-id": "acc-1" })),
}));

const { profileClient } = await import("@/lib/grpc");
const { GET, POST } = await import("./route");
const client = profileClient as unknown as Record<"getProfile" | "createProfile", ReturnType<typeof vi.fn>>;

function request(method: string, body?: unknown) {
  const req = new NextRequest("http://localhost/api/profile", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("/api/profile", () => {
  beforeEach(() => {
    client.getProfile.mockReset();
    client.createProfile.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("GET asks for the acting profile by passing an empty profile id", async () => {
    client.getProfile.mockResolvedValue({ profile: create(ProfileSchema, { id: "prof-1" }) });

    const res = await GET(request("GET"));

    expect(client.getProfile).toHaveBeenCalledWith({ profileId: "" }, expect.objectContaining({ headers: expect.any(Object) }));
    expect((await res.json()).profile.id).toBe("prof-1");
  });

  it("POST creates a profile from the display name and the username", async () => {
    client.createProfile.mockResolvedValue({ profile: create(ProfileSchema, { id: "prof-1", username: "coco_01" }) });

    const res = await POST(request("POST", { displayName: "Coco", username: "coco_01" }));

    expect(client.createProfile).toHaveBeenCalledWith(
      { displayName: "Coco", username: "coco_01" },
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).profile.id).toBe("prof-1");
  });

  it("POST sends an empty username when none is given", async () => {
    client.createProfile.mockResolvedValue({ profile: create(ProfileSchema, { id: "prof-1" }) });

    await POST(request("POST", { displayName: "Coco" }));

    expect(client.createProfile).toHaveBeenCalledWith({ displayName: "Coco", username: "" }, expect.any(Object));
  });

  it("POST returns 400 with the monolith's message for an invalid or taken username", async () => {
    client.createProfile.mockRejectedValue(new ConnectError("このユーザー名は使用できません", Code.InvalidArgument));

    const res = await POST(request("POST", { displayName: "Coco", username: "taken" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("このユーザー名は使用できません");
  });

  it("POST returns 422 when the account is at its profile limit", async () => {
    client.createProfile.mockRejectedValue(new ConnectError("limit", Code.FailedPrecondition));

    const res = await POST(request("POST", { displayName: "Coco" }));

    expect(res.status).toBe(422);
  });
});
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/app/api/profile > /tmp/vitest-t6.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t6.txt | /usr/bin/grep -E 'Tests |FAIL' | head -6`
Expected: FAIL(`mine/route` が存在しない、`POST` が export されていない)。

- [ ] **Step 4: BFF の route を実装する**

`src/app/api/profile/mine/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { profileClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { mapProfileToView } from "@/modules/profile/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const headers = await buildGrpcHeaders(req);
    const res = await profileClient.listMyProfiles({}, { headers });
    return NextResponse.json({ profiles: res.profiles.map(mapProfileToView) });
  } catch (error: unknown) {
    return handleApiError(error, "ListMyProfiles");
  }
}
```

`src/modules/profile/types.ts` に足す。

```ts
export interface CreateProfilePayload {
  displayName: string;
  username?: string;
}

export interface MyProfilesResponse {
  profiles: ProfileView[];
}
```

`src/app/api/profile/route.ts` に `POST` を足す。import に `CreateProfilePayload` を加える。

```ts
import type { CreateProfilePayload, SaveProfilePayload } from "@/modules/profile/types";
```

```ts
export async function POST(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;

    const body = (await req.json()) as CreateProfilePayload;
    const headers = await buildGrpcHeaders(req);
    const res = await profileClient.createProfile(
      { displayName: body.displayName, username: body.username || "" },
      { headers }
    );
    if (!res.profile) {
      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
    }
    return NextResponse.json({ profile: mapProfileToView(res.profile) });
  } catch (error: unknown) {
    return handleApiError(error, "CreateProfile");
  }
}
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/app/api/profile > /tmp/vitest-t6.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t6.txt | /usr/bin/grep -E 'Tests '`
Expected: 失敗 0。

- [ ] **Step 5: session の hook と `useProfile` を実装する**

`src/modules/profile/hooks/useProfileSession.ts`:

```ts
"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore, selectAccountId, selectActiveProfileId } from "@/stores/authStore";
import { myProfilesKey, resolveProfileSession, type ProfileSession } from "@/modules/profile/lib/session";
import type { MyProfilesResponse } from "@/modules/profile/types";

export function useProfileSession(): ProfileSession | null {
  const accountId = useAuthStore(selectAccountId);
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const setActiveProfile = useAuthStore((s) => s.setActiveProfile);

  const { data } = useSWR<MyProfilesResponse>(
    accountId ? myProfilesKey(accountId) : null,
    ([url]: readonly [string, string]) => fetcher<MyProfilesResponse>(url),
    { revalidateOnFocus: false }
  );

  const session = data ? resolveProfileSession(data.profiles, activeProfileId) : null;
  const resolvedProfileId = session?.kind === "active" ? session.profileId : null;
  const isResolved = session !== null;

  useEffect(() => {
    if (isResolved && resolvedProfileId !== activeProfileId) {
      setActiveProfile(resolvedProfileId);
    }
  }, [isResolved, resolvedProfileId, activeProfileId, setActiveProfile]);

  return session;
}
```

`src/modules/profile/hooks/useProfile.ts` を次の内容に置き換える。プロフィールが無いときに空の view を返す `fetchProfileOrEmpty` は削除する。`SaveProfile` は profile を作らなくなり、操作中の profile がある account には必ず行があるためである。

```ts
"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import { fetcher } from "@/lib/swr";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { authFetch } from "@/lib/auth/fetch";
import { isMyProfilesKey } from "@/modules/profile/lib/session";
import type {
  CreateProfilePayload,
  MyProfilesResponse,
  ProfileView,
  SaveProfilePayload,
  SaveProfileMediaPayload,
} from "@/modules/profile/types";

interface ProfileResponse {
  profile: ProfileView;
}

export function useProfile() {
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const setActiveProfile = useAuthStore((s) => s.setActiveProfile);
  const { mutate: mutateCache } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<ProfileResponse>(
    activeProfileId ? (["/api/profile", activeProfileId] as const) : null,
    ([url]: readonly [string, string]) => fetcher<ProfileResponse>(url),
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  const createProfile = useCallback(
    async (payload: CreateProfilePayload) => {
      const res = await authFetch<ProfileResponse>("/api/profile", {
        method: "POST",
        body: payload,
      });
      // Put the new profile into the cached list first; a stale empty list would resolve back to onboarding.
      await mutateCache<MyProfilesResponse>(
        isMyProfilesKey,
        (current) => ({ profiles: [...(current?.profiles ?? []), res.profile] }),
        { revalidate: false }
      );
      setActiveProfile(res.profile.id);
      return res.profile;
    },
    [setActiveProfile, mutateCache]
  );

  const saveProfile = useCallback(
    async (payload: SaveProfilePayload) => {
      const res = await authFetch<ProfileResponse>("/api/profile", {
        method: "PUT",
        body: payload,
      });
      await mutate(res, { revalidate: false });
      return res.profile;
    },
    [mutate]
  );

  const saveMedia = useCallback(
    async (payload: SaveProfileMediaPayload) => {
      const res = await authFetch<ProfileResponse>("/api/profile/media", {
        method: "POST",
        body: payload,
      });
      await mutate(res, { revalidate: false });
      return res.profile;
    },
    [mutate]
  );

  return {
    profile: data?.profile ?? null,
    loading: isLoading,
    error,
    createProfile,
    saveProfile,
    saveMedia,
    mutate,
  };
}
```

SWR の key に `activeProfileId` を入れているのは、別の profile の内容が同じ key のキャッシュから表示されないようにするためである。

`fetchProfileOrEmpty` だけを対象にしていた test を削除する。

```bash
git rm -q src/modules/profile/hooks/useProfile.test.ts
```

`src/modules/profile/hooks/index.ts` に 1 行足す。

```ts
export { useProfileSession } from "./useProfileSession";
```

Run: `/usr/bin/grep -rn 'fetchProfileOrEmpty' src`
Expected: 出力なし。

- [ ] **Step 6: `AppShell` を session に繋ぐ**

`src/components/shell/AppShell.tsx` の import と、component の冒頭から `mode` の算出までを次に置き換える。`return` 以降の JSX は変えない。

```tsx
import { useAuthStore, selectAccountId, selectActiveProfileId, selectIsHydrated } from "@/stores/authStore";
import { useProfileSession } from "@/modules/profile/hooks";
```

```tsx
export function AppShell({ children }: AppShellProps) {
  const isHydrated = useAuthStore(selectIsHydrated);
  const accountId = useAuthStore(selectAccountId);
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const session = useProfileSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isLandingRoute = pathname === "/";
  const needsOnboarding = session?.kind === "onboarding";

  useEffect(() => {
    if (!isHydrated || isAuthRoute) return;
    if (!accountId) {
      if (!isLandingRoute) router.replace("/login");
      return;
    }
    if (needsOnboarding) router.replace("/onboarding");
  }, [isHydrated, accountId, needsOnboarding, isAuthRoute, isLandingRoute, router]);

  // TODO: Render a profile picker when the session kind is "select"; the shell stays blank until then.
  const mode = resolveShellMode({
    isHydrated,
    isAuthenticated: !!accountId,
    hasActiveProfile: !!activeProfileId,
    isAuthRoute,
    isLandingRoute,
  });
```

`selectUserId` と `viewerId` はこのファイルから無くなる。

- [ ] **Step 7: onboarding を `createProfile` に切り替える**

`src/app/onboarding/page.tsx` で、`const { saveProfile } = useProfile();` を次に置き換える。

```tsx
  const { createProfile } = useProfile();
```

`handleSubmit` の中の `await saveProfile({ displayName, username });` を次に置き換える。

```tsx
      await createProfile({ displayName, username });
```

`createProfile` は、作成した profile をキャッシュ済みの自分の profile 一覧に加えてから操作中の profile に設定して戻るので、続く `router.push("/")` はそのままでよい。一覧への追加を先に行わないと、`useProfileSession` が古い空の一覧から「profile なし」と解決し、設定したばかりの操作中の profile を消して onboarding へ戻してしまう。

- [ ] **Step 8: 確認する**

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-t6.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t6.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、vitest は失敗 0。

`AppShell` や `useProfile` を mock している既存の test が、変わった export(`selectAccountId` / `selectActiveProfileId`、`useProfileSession`、`createProfile`)に合わずに落ちた場合は、mock が返す名前を production 側に合わせる。

- [ ] **Step 9: Commit**

```bash
git add src && git commit -s -m "feat(dystopia/frontend): resolve the acting profile after sign-in and create it in onboarding"
```

---

### Task 7: Carry the monolith's reason code to the client and react to it

**Files:**
- Modify: `dystopia/frontend/src/lib/api-helpers.ts`
- Create: `dystopia/frontend/src/lib/api-helpers.test.ts`
- Create: `dystopia/frontend/src/lib/auth/profile-errors.ts`
- Create: `dystopia/frontend/src/lib/auth/profile-errors.test.ts`
- Modify: `dystopia/frontend/src/lib/auth/fetch.ts`

**Interfaces:**
- Consumes: Task 4 の store(`setActiveProfile`)、Task 6 の `isMyProfilesKey`
- Produces:
  - BFF のエラー JSON: monolith のエラーに `error-reason` があるとき `{ error: string, code: string }`、無いとき `{ error: string }`
  - `@/lib/auth/profile-errors`: `PROFILE_REQUIRED = "profile_required"`、`PROFILE_NOT_PERMITTED = "profile_not_permitted"`、`isProfileSelectionError(body: unknown): boolean`、`resetProfileSelection(): void`

- [ ] **Step 1: test を書く(失敗する)**

`src/lib/api-helpers.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Code, ConnectError } from "@connectrpc/connect";
import { handleApiError } from "./api-helpers";

describe("handleApiError", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("copies the monolith's error-reason into the code field", async () => {
    const error = new ConnectError("Active profile required", Code.FailedPrecondition, new Headers({ "error-reason": "profile_required" }));

    const res = handleApiError(error);

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("profile_required");
  });

  it("copies profile_not_permitted on a 403", async () => {
    const error = new ConnectError("Profile is not available", Code.PermissionDenied, new Headers({ "error-reason": "profile_not_permitted" }));

    const res = handleApiError(error);

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("profile_not_permitted");
  });

  it("omits the code field when the monolith gives no reason", async () => {
    const res = handleApiError(new ConnectError("follow required", Code.FailedPrecondition));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body).not.toHaveProperty("code");
    expect(typeof body.error).toBe("string");
  });

  it("keeps the raw message for an invalid argument", async () => {
    const res = handleApiError(new ConnectError("このユーザー名は使用できません", Code.InvalidArgument));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("このユーザー名は使用できません");
  });

  it("returns 500 without a code for a non-Connect error", async () => {
    const res = handleApiError(new Error("boom"));

    expect(res.status).toBe(500);
    expect(await res.json()).not.toHaveProperty("code");
  });
});
```

`src/lib/auth/profile-errors.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const swrMocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("swr", () => ({ mutate: swrMocks.mutate }));

const { useAuthStore } = await import("@/stores/authStore");
const { isMyProfilesKey } = await import("@/modules/profile/lib/session");
const { isProfileSelectionError, resetProfileSelection, PROFILE_REQUIRED, PROFILE_NOT_PERMITTED } = await import("./profile-errors");

describe("isProfileSelectionError", () => {
  it("is true only for the two profile reason codes", () => {
    expect(isProfileSelectionError({ error: "x", code: PROFILE_REQUIRED })).toBe(true);
    expect(isProfileSelectionError({ error: "x", code: PROFILE_NOT_PERMITTED })).toBe(true);
  });

  it("is false for an error without a reason code", () => {
    expect(isProfileSelectionError({ error: "フォローが必要です" })).toBe(false);
    expect(isProfileSelectionError({})).toBe(false);
    expect(isProfileSelectionError(null)).toBe(false);
    expect(isProfileSelectionError("profile_required")).toBe(false);
  });

  it("is false for an unrelated code", () => {
    expect(isProfileSelectionError({ error: "x", code: "limit_exceeded" })).toBe(false);
  });
});

describe("resetProfileSelection", () => {
  beforeEach(() => {
    memory.clear();
    swrMocks.mutate.mockReset();
    useAuthStore.getState().clearIdentity();
  });

  it("drops the acting profile, keeps the account, and revalidates the profile list", () => {
    useAuthStore.getState().setIdentity({ accountId: "acc-1", role: "cast" });
    useAuthStore.getState().setActiveProfile("prof-1");

    resetProfileSelection();

    expect(useAuthStore.getState().activeProfileId).toBeNull();
    expect(useAuthStore.getState().accountId).toBe("acc-1");
    expect(swrMocks.mutate).toHaveBeenCalledWith(isMyProfilesKey);
  });
});
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/lib/api-helpers.test.ts src/lib/auth/profile-errors.test.ts > /tmp/vitest-t7.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t7.txt | /usr/bin/grep -E 'Tests |FAIL' | head -6`
Expected: FAIL。

- [ ] **Step 2: BFF で理由コードを写す**

`src/lib/api-helpers.ts` の `handleApiError` で、`ConnectError` の分岐の末尾にある `return NextResponse.json({ error: message }, { status });` を次に置き換える。

```ts
    const reason = error.metadata.get("error-reason");
    return NextResponse.json(reason ? { error: message, code: reason } : { error: message }, { status });
```

- [ ] **Step 3: client の判定と反応を実装する**

`src/lib/auth/profile-errors.ts`:

```ts
import { mutate } from "swr";
import { useAuthStore } from "@/stores/authStore";
import { isMyProfilesKey } from "@/modules/profile/lib/session";

export const PROFILE_REQUIRED = "profile_required";
export const PROFILE_NOT_PERMITTED = "profile_not_permitted";

const PROFILE_SELECTION_REASONS: readonly string[] = [PROFILE_REQUIRED, PROFILE_NOT_PERMITTED];

// Match on the reason code, not the HTTP status: 403 and 422 are also returned for messaging, karte and limit errors.
export function isProfileSelectionError(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" && PROFILE_SELECTION_REASONS.includes(code);
}

export function resetProfileSelection(): void {
  useAuthStore.getState().setActiveProfile(null);
  void mutate(isMyProfilesKey);
}
```

`src/lib/auth/fetch.ts` に import を足す。

```ts
import { isProfileSelectionError, resetProfileSelection } from "@/lib/auth/profile-errors";
```

`if (!res.ok) {` の中で、`const errBody = await res.json().catch(() => ({}));` の直後に 1 行足す。

```ts
    if (isProfileSelectionError(errBody)) resetProfileSelection();
```

`AppError` を投げる既存の処理はそのまま残す。操作中の profile が消えると `useProfileSession` が profile の一覧を取り直し、解決し直す。

- [ ] **Step 4: 確認する**

Run: `env -u NODE_OPTIONS pnpm exec vitest run src/lib/api-helpers.test.ts src/lib/auth/profile-errors.test.ts > /tmp/vitest-t7.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t7.txt | /usr/bin/grep -E 'Tests '`
Expected: 失敗 0。

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-t7.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-t7.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、vitest は失敗 0。

- [ ] **Step 5: Commit**

```bash
git add src && git commit -s -m "feat(dystopia/frontend): reselect the acting profile when the monolith rejects it"
```

---

### Task 8: Full gates

**Files:** なし(検証のみ。失敗があれば原因の箇所を直す)

**Interfaces:**
- Consumes: Task 1〜7 の全成果
- Produces: この plan の完了判定

- [ ] **Step 1: frontend の全体を確認する**

Run(`dystopia/frontend`): `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit=$?"; env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-full.txt 2>&1; sed 's/\x1b\[[0-9;]*m//g' /tmp/vitest-full.txt | /usr/bin/grep -E 'Test Files|Tests '`
Expected: `tsc exit=0`、vitest は失敗 0。件数は開始時点の 232 より増えている。

- [ ] **Step 2: monolith の全体を確認する**

Run(`dystopia/monolith`): `HANAMI_ENV=test rbenv exec bundle exec rspec > /tmp/rspec-full.txt 2>&1; /usr/bin/grep -E '^[0-9]+ examples' /tmp/rspec-full.txt`
Expected: `0 failures`

- [ ] **Step 3: 残骸が無いことを確認する**

Run(`dystopia/frontend`):
```bash
/usr/bin/grep -rn -E 'selectUserId|getState\(\)\.userId|fetchProfileOrEmpty|getProfile\(\{ accountId' src
```
Expected: 出力なし。

Run(`dystopia/frontend`): `git status --short src/stub`
Expected: 出力なし(profile 以外の stub に差分が残っていない)。

- [ ] **Step 4: 失敗があった場合**

失敗の原因を「X が Y を引き起こす。なぜなら Z」の形で特定してから直し、Step 1〜3 をやり直す。直した内容は 1 つの commit にまとめる(`git commit -s`)。失敗が無ければ、この Task は commit を作らない。

---

## Controller verification (not dispatched)

Task 8 の後、controller が実際のサーバーを起動して確認する。implementer には渡さない。

目的は、vitest が届かない経路(本物の gRPC、本物の cookie、ヘッダの転送)を 1 回通すことである。確認する内容:

- 新規登録 → onboarding で profile を作成 → `GET /api/profile/mine` がその profile を 1 件返す。
- `x-profile-id` にその profile の id を付けて投稿を作成でき、返ってきた投稿の著者の id が profile の id と一致し、account の id と一致しない。
- `x-profile-id` に存在しない id を付けて投稿を作成すると、403 と `code: "profile_not_permitted"` が返る。同じヘッダで `GET /api/profile/mine` は 200 を返す。
- `x-profile-id` を付けずに、profile が 1 つの account で投稿を作成できる(monolith が唯一の有効な profile を解決する)。

起動方法と具体的なコマンドは、実装後に controller が実物を見て決める。monolith は `bin/grpc` が `HANAMI_ENV=production` を強制するため、`.env` と `.env.test` を export し、`DATABASE_URL` を使い捨ての database に向けて起動する。確認に使った database は終了後に削除する。

## Known gaps left for later plans

- 有効な profile が 2 つ以上あり、保存された選択が無い account は、画面が空のままになる(`AppShell` の TODO)。人格を選ぶ画面は段 9 で作る。段 9 までは 2 つ目の profile を作る UI が無いため、この状態には UI からは到達しない。
- 人格を切り替えたときに他のキャッシュ(投稿、DM、通知など)を消す処理は無い。段 9 で切替の UI と一緒に作る。
- component の props 名と view の型のフィールド名(`targetAccountId`、`SocialAccountView.accountId`、`authorAccountId` 等)は account を指す名前のままで、値は profile の id である。段 3〜7 で改名する。
- `src/modules/identity/types.ts` の `AuthState` は `userId` を持つが、store とは別の型でどこからも参照されていない。この plan では触らない。
- P1a の Known gaps のうち、この plan で解消しないもの(karte の所有権、アクセスログ、検索の cursor の秒精度、media の認証など)はそのまま残る。
