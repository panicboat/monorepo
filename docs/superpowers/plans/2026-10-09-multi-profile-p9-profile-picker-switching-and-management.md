# Multi Profile P9: Profile Picker, Switching and Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 複数の人格を持つ cast が、frontend から人格を選び、切り替え、追加し、無効化・有効化・削除できるようにする。

**Architecture:** 人格の解決(`resolveProfileSession`)、拒否時の回復、`AppShell` が操作中の人格を key に配下を作り直す仕組みは段 1 で入っている。この plan は、その上に (1) BFF の route 3 本、(2) 人格の選択画面と切替、(3) 設定画面の管理 UI を足す。切替時に前の人格のデータが残らないよう、`AppShell` は操作中の人格ごとに SWR の cache を分ける。account 単位の人格一覧は `AppShell` が持ち、配下へ React context で渡す。

**Tech Stack:** Next.js 16 (App Router) / React 19 / SWR 2.5.1 / zustand / Radix Dialog / vitest (happy-dom)。monolith と proto は変わらない。

**Spec:** `docs/superpowers/specs/2026-10-08-multiple-profiles-per-account-design.md`(Frontend flows、Frontend session recovery、Profile lifecycle、Testing strategy、Delivery の段 9、Open questions の「切替 UI の置き場所」)

**Dry run:** この plan の手順は、作業ツリー上で適用して確かめてある。plan に載せた patch をゼロから再適用して、同じ差分になることも確かめた。最終結果は `tsc --noEmit` exit 0、vitest `103 passed (103)` / `389 passed (389)`(基準は 95 ファイル / 356 件)。各 Step の Expected のうち数を示したものは、その再適用での実測である。足した test は、対象の行を壊すと落ちることを 22 箇所で確かめてある(Review Focus)。実サーバーとブラウザでの確認結果は末尾の Controller verification に書く。

この plan は stack の 9 段目(最上段)で、ブランチは `feat/dystopia-multi-profile-switcher`。

## Decisions

spec が plan に委ねた点と、spec と違う形にした点。

| 論点 | 決定 | 理由 |
|---|---|---|
| 切替時にキャッシュをどう消すか | `AppShell` が、操作中の人格を key にした `SWRConfig`(`provider: () => new Map()`)で配下を包む。人格が変わると配下ごと cache が新しくなる | SWR の key はほとんどが URL だけで、人格の id を含まない(例: `/api/messaging/threads`、`/api/notifications/unread-count`。SWR を使う file は 37)。spec の「全消去」をフィルター指定の `mutate` で行うと、SWR 2.5.1 は無限スクロール用の key(`$inf$`)を対象から外す(`node_modules/swr/dist/config-context-*.mjs` で確認)。さらに、消した直後に同じ key を読む hook は、前の人格の進行中の request に相乗りして結果を捨て、取り直さない(dry run の test で再現)。cache を分ければ、どちらも起きない |
| account 単位のデータ | 人格一覧(`/api/profile/mine`)と `/api/identity/me` は既定の cache に置いたまま。配下は `useAccountProfiles()`(context)で一覧・切替・再取得を受け取る | 配下で一覧を `useSWR` すると、`AppShell` の一覧と別の cache になり食い違う |
| 切替 UI の置き場所(spec の Open question) | 切替はナビゲーション(モバイルは `Drawer`、PC は `SideNav`)。追加・無効化・有効化・削除は設定画面の新しいタブ「プロフィール」。タブは cast にだけ出す | 切替は頻度が高いので 1〜2 タップで届く場所に置く。破壊的な操作は設定に隔離する。guest は人格を足せず、唯一の人格を無効化もできないので、管理する対象が無い |
| 人格選択画面 | 有効な人格が複数あって選択が保存されていないときに出す(`ProfileGate` の `select` を置き換える)。選んでも今のページから動かない | ログイン直後やリンクで開いたページをそのまま表示するため。「トップへ遷移」は切替のときだけ |
| ログインし直したときの人格 | 複数の人格を持つ account は、ログインのたびに選択画面が出る。選択はログイン中の再読み込み・タブ間では保たれる | spec は「前回の人格が有効な一覧にあればそれ」とするが、ログアウトは選択を消す(段 1 の `clearIdentity`)。意図しない人格で行為することを避ける側に倒した。account ごとに選択を覚える仕組みは足していない |
| 拒否された人格 | 選択画面に出さない(再試行・再読み込みまで)。切替で選んでも選択画面に戻る | spec の Frontend session recovery「拒否された profile は選び直さない」 |
| 使用中の人格の無効化 | UI からはできない。先に別の人格へ切り替える | 行為者が変わる経路を「切替」の 1 本に絞る。server は、他に有効な人格があれば使用中でも無効化できる |
| 人格の追加 | onboarding と同じ入力を `ProfileNameForm` に切り出して共有する。作成 → 一覧の再取得 → 切替の順に行う | spec「onboarding と同じ入力」「そのまま切り替える」。一覧に無い人格へ先に切り替えると、解決が選択画面に戻る |
| 人格数の上限 | frontend は上限の値を持たない。追加ボタンは常に出し、server が拒否したら「プロフィールをこれ以上追加できません」と表示する | 上限(5)は monolith が決める値で、二重に持つと食い違う |
| いいねの状態 | `postLikeStore` は、操作中の人格が変わったら中身を捨てる | `seed()` は既存の entry を上書きしないので、前の人格の「いいね済み」が次の人格に残る |
| カルテの自分の一覧 | 操作中の人格と違う人格で書いた記録に「@name として記録」を表示する | karte は account が所有し、どの人格で書いた記録も一覧に出る。どの人格の記録か分からないと、相手にどの名前で接したかを取り違える |
| 残っていた `userId` という local | 操作中の人格を指す 10 箇所を改名する。引数に `profileId` を持つ 3 つの hook では `activeProfileId`、他は `profileId` | 段 3〜7 の残り。同じ名前に写すと引数と衝突する |

## Global Constraints

- 作業ブランチは `feat/dystopia-multi-profile-switcher`、作業ディレクトリは `.worktrees/feat-dystopia-multi-profile-model`。ブランチ・worktree を作り直さない。
- frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` の形で実行する。patch の適用(`git apply`)は必ずリポジトリの root で実行する。下のディレクトリで実行すると、patch は 1 行も適用されずに成功として終わる。
- 判定基準: `env -u NODE_OPTIONS pnpm exec tsc --noEmit` が exit 0、`env -u NODE_OPTIONS pnpm exec vitest run` が全件通過。開始時点の基準は `Test Files  95 passed (95)` / `Tests  356 passed (356)`。`pnpm lint` は使えない(ESLint 10 の既知の問題)ので実行しない。
- patch は plan の code block の内容を 1 文字も変えずに file に保存して適用する。`git apply --check` が失敗したら、保存した file が plan と一致しているかを確かめる。patch を手で直して通さない。
- route の directory 名 `[id]` は角括弧を含む。shell で path を書くときは引用符で囲む。
- 人格ごとの cache の中(`AppShell` の配下)では、`swr` から直接 import した `mutate` を人格単位の key に使わない。既定の cache に作用するので、何も起きずに終わる。配下では `useSWRConfig().mutate` を使う。直接 import した `mutate` を使ってよいのは、account 単位の key(人格一覧、`/api/identity/me`)だけである。
- `pnpm install`、依存の追加、monolith と proto の変更をしない。
- コードのコメントは英語・1 行。現在のタスクや修正への言及を書かない。この plan が足すコメントは patch に含まれる 4 行だけである(test file 先頭の `// @vitest-environment happy-dom` は実行環境の指定で、コメントではない)。
- 画面の文言は日本語。変数名・test 名・commit message は英語。
- commit は `git commit -s` で行う。commit message に `Co-Authored-By` を付けない。`git push` と pull request の作成はしない(区切りの判断と push は controller が行う)。

## Review Focus

人が使って困る形で壊れやすい箇所。括弧内は、その行を壊して test が落ちることを確かめた変異。

1. **切替の直後に前の人格のデータが見えないこと。** `AppShell.switch.test.tsx` が、切替を click した直後の描画で前の人格の未読数が出ていないことと、その後の request が次の人格の id だけで送られることを見る(cache を分けない状態に戻す)。
2. **選択画面が、選べる人格だけを出すこと。** 無効な人格と、server が拒否した人格を出さない(`selectableProfiles` を外す / 無効の条件を外す / 拒否の条件を外す)。選ぶ前に、人格としての request を 1 本も送らない。
3. **選択と切替の遷移の違い。** 選択は今のページのまま、切替はトップへ(選択で遷移させる / 切替で遷移させない)。
4. **管理 UI が、状態ごとに許される操作だけを出すこと。** 使用中の人格に無効化を出さない、削除は無効な人格にだけ出し、確認の後にだけ実行する(使用中にも出す / 確認なしで削除する)。
5. **追加の順序。** 作成 → 一覧の再取得 → 切替(再取得の前に切り替える)。
6. **guest に管理タブを出さないこと**(全 role に出す)。
7. **いいねの状態を人格間で持ち越さないこと**(購読を外す)。
8. **BFF の route が path の id をそのまま渡すこと、cookie が無ければ monolith を呼ばないこと**(無効化の route で有効化を呼ぶ / path の id を無視する)。
9. **カルテの注記が、自分の一覧で、別の人格の記録にだけ出ること**(全 mode に出す / 操作中の人格の記録にも出す)。

---

### Task 1: Routes to disable, enable and delete a profile

**Files:**
- Test: `src/app/api/profile/[id]/lifecycle-routes.test.ts`、`src/app/api/profile/route.test.ts`
- Create / Modify: `src/app/api/profile/[id]/disable/route.ts`、`src/app/api/profile/[id]/enable/route.ts`、`src/app/api/profile/[id]/route.ts`、`src/app/api/profile/route.ts`

**Interfaces:**
- Produces:
  - `POST /api/profile/[id]/disable` と `POST /api/profile/[id]/enable` → `{ profile: ProfileView }`
  - `DELETE /api/profile/[id]` → `{ ok: true }`
  - `POST /api/profile` は、monolith が `FAILED_PRECONDITION` を返したとき 422 と `{ error: "プロフィールをこれ以上追加できません" }` を返す
  - monolith のエラーは `handleApiError` の対応どおり(他の account の人格は 404、拒否された変更は 422)

- [ ] **Step 1: test を足す(失敗する)**

次の内容を `/tmp/p9-t1-spec.patch` に保存し、リポジトリの root で `git apply --check /tmp/p9-t1-spec.patch && git apply /tmp/p9-t1-spec.patch` を実行する。

```diff
diff --git a/dystopia/frontend/src/app/api/profile/[id]/lifecycle-routes.test.ts b/dystopia/frontend/src/app/api/profile/[id]/lifecycle-routes.test.ts
new file mode 100644
index 00000000..f706b4da
--- /dev/null
+++ b/dystopia/frontend/src/app/api/profile/[id]/lifecycle-routes.test.ts
@@ -0,0 +1,85 @@
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import { NextRequest } from "next/server";
+import { create } from "@bufbuild/protobuf";
+import { Code, ConnectError } from "@connectrpc/connect";
+import { ACCESS_COOKIE } from "@/lib/auth/cookies";
+import { ProfileSchema } from "@/stub/profile/v1/service_pb";
+
+vi.mock("@/lib/grpc", () => ({
+  profileClient: { disableProfile: vi.fn(), enableProfile: vi.fn(), deleteProfile: vi.fn() },
+}));
+
+vi.mock("@/lib/request", () => ({
+  buildGrpcHeaders: vi.fn(async () => ({ "x-user-id": "acc-1" })),
+}));
+
+const { profileClient } = await import("@/lib/grpc");
+const { POST: disable } = await import("./disable/route");
+const { POST: enable } = await import("./enable/route");
+const { DELETE: remove } = await import("./route");
+const client = profileClient as unknown as Record<"disableProfile" | "enableProfile" | "deleteProfile", ReturnType<typeof vi.fn>>;
+
+function request(method: "POST" | "DELETE", withCookie = true) {
+  const req = new NextRequest("http://localhost/api/profile/prof-2", { method });
+  if (withCookie) req.cookies.set(ACCESS_COOKIE, "token");
+  return req;
+}
+
+const context = { params: Promise.resolve({ id: "prof-2" }) };
+
+describe("profile lifecycle routes", () => {
+  beforeEach(() => {
+    Object.values(client).forEach((fn) => fn.mockReset());
+    vi.spyOn(console, "error").mockImplementation(() => {});
+  });
+
+  it("disables the profile named by the path and returns it as disabled", async () => {
+    client.disableProfile.mockResolvedValue({ profile: create(ProfileSchema, { id: "prof-2", disabled: true }) });
+
+    const res = await disable(request("POST"), context);
+    const body = await res.json();
+
+    expect(res.status).toBe(200);
+    expect(client.disableProfile.mock.calls[0][0]).toEqual({ profileId: "prof-2" });
+    expect([body.profile.id, body.profile.disabled]).toEqual(["prof-2", true]);
+  });
+
+  it("enables the profile named by the path and returns it as enabled", async () => {
+    client.enableProfile.mockResolvedValue({ profile: create(ProfileSchema, { id: "prof-2", disabled: false }) });
+
+    const res = await enable(request("POST"), context);
+    const body = await res.json();
+
+    expect(res.status).toBe(200);
+    expect(client.enableProfile.mock.calls[0][0]).toEqual({ profileId: "prof-2" });
+    expect([body.profile.id, body.profile.disabled]).toEqual(["prof-2", false]);
+  });
+
+  it("deletes the profile named by the path", async () => {
+    client.deleteProfile.mockResolvedValue({});
+
+    const res = await remove(request("DELETE"), context);
+
+    expect(res.status).toBe(200);
+    expect(client.deleteProfile.mock.calls[0][0]).toEqual({ profileId: "prof-2" });
+  });
+
+  it("answers 401 without an access cookie and calls nothing", async () => {
+    const statuses = [
+      (await disable(request("POST", false), context)).status,
+      (await enable(request("POST", false), context)).status,
+      (await remove(request("DELETE", false), context)).status,
+    ];
+
+    expect(statuses).toEqual([401, 401, 401]);
+    Object.values(client).forEach((fn) => expect(fn).not.toHaveBeenCalled());
+  });
+
+  it("maps a refused change to 422 and a profile of another account to 404", async () => {
+    client.disableProfile.mockRejectedValue(new ConnectError("last enabled profile", Code.FailedPrecondition));
+    client.deleteProfile.mockRejectedValue(new ConnectError("not found", Code.NotFound));
+
+    expect((await disable(request("POST"), context)).status).toBe(422);
+    expect((await remove(request("DELETE"), context)).status).toBe(404);
+  });
+});
diff --git a/dystopia/frontend/src/app/api/profile/route.test.ts b/dystopia/frontend/src/app/api/profile/route.test.ts
index 49e171b1..244b3f1a 100644
--- a/dystopia/frontend/src/app/api/profile/route.test.ts
+++ b/dystopia/frontend/src/app/api/profile/route.test.ts
@@ -78,5 +78,6 @@ describe("/api/profile", () => {
     const res = await POST(request("POST", { displayName: "Coco" }));

     expect(res.status).toBe(422);
+    expect((await res.json()).error).toBe("プロフィールをこれ以上追加できません");
   });
 });
```

Run(`dystopia/frontend`): `env -u NODE_OPTIONS pnpm exec vitest run src/app/api/profile > /tmp/vitest-p9-t1-red.txt 2>&1; /usr/bin/grep -E '^ *(Test Files|Tests) ' /tmp/vitest-p9-t1-red.txt`
Expected:
```
 Test Files  2 failed | 1 passed (3)
      Tests  1 failed | 8 passed (9)
```

- [ ] **Step 2: 実装する**

次の内容を `/tmp/p9-t1-impl.patch` に保存し、リポジトリの root で `git apply --check /tmp/p9-t1-impl.patch && git apply /tmp/p9-t1-impl.patch` を実行する。

```diff
diff --git a/dystopia/frontend/src/app/api/profile/[id]/disable/route.ts b/dystopia/frontend/src/app/api/profile/[id]/disable/route.ts
new file mode 100644
index 00000000..774349e5
--- /dev/null
+++ b/dystopia/frontend/src/app/api/profile/[id]/disable/route.ts
@@ -0,0 +1,20 @@
+import { NextRequest, NextResponse } from "next/server";
+import { profileClient } from "@/lib/grpc";
+import { buildGrpcHeaders } from "@/lib/request";
+import { handleApiError, requireAuth } from "@/lib/api-helpers";
+import { mapProfileToView } from "@/modules/profile/lib/mappers";
+
+export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
+  try {
+    const authError = requireAuth(req);
+    if (authError) return authError;
+    const { id } = await params;
+    const res = await profileClient.disableProfile({ profileId: id }, { headers: await buildGrpcHeaders(req) });
+    if (!res.profile) {
+      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
+    }
+    return NextResponse.json({ profile: mapProfileToView(res.profile) });
+  } catch (error: unknown) {
+    return handleApiError(error, "DisableProfile");
+  }
+}
diff --git a/dystopia/frontend/src/app/api/profile/[id]/enable/route.ts b/dystopia/frontend/src/app/api/profile/[id]/enable/route.ts
new file mode 100644
index 00000000..7d06fcc8
--- /dev/null
+++ b/dystopia/frontend/src/app/api/profile/[id]/enable/route.ts
@@ -0,0 +1,20 @@
+import { NextRequest, NextResponse } from "next/server";
+import { profileClient } from "@/lib/grpc";
+import { buildGrpcHeaders } from "@/lib/request";
+import { handleApiError, requireAuth } from "@/lib/api-helpers";
+import { mapProfileToView } from "@/modules/profile/lib/mappers";
+
+export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
+  try {
+    const authError = requireAuth(req);
+    if (authError) return authError;
+    const { id } = await params;
+    const res = await profileClient.enableProfile({ profileId: id }, { headers: await buildGrpcHeaders(req) });
+    if (!res.profile) {
+      return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
+    }
+    return NextResponse.json({ profile: mapProfileToView(res.profile) });
+  } catch (error: unknown) {
+    return handleApiError(error, "EnableProfile");
+  }
+}
diff --git a/dystopia/frontend/src/app/api/profile/[id]/route.ts b/dystopia/frontend/src/app/api/profile/[id]/route.ts
new file mode 100644
index 00000000..ca949901
--- /dev/null
+++ b/dystopia/frontend/src/app/api/profile/[id]/route.ts
@@ -0,0 +1,16 @@
+import { NextRequest, NextResponse } from "next/server";
+import { profileClient } from "@/lib/grpc";
+import { buildGrpcHeaders } from "@/lib/request";
+import { handleApiError, requireAuth } from "@/lib/api-helpers";
+
+export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
+  try {
+    const authError = requireAuth(req);
+    if (authError) return authError;
+    const { id } = await params;
+    await profileClient.deleteProfile({ profileId: id }, { headers: await buildGrpcHeaders(req) });
+    return NextResponse.json({ ok: true });
+  } catch (error: unknown) {
+    return handleApiError(error, "DeleteProfile");
+  }
+}
diff --git a/dystopia/frontend/src/app/api/profile/route.ts b/dystopia/frontend/src/app/api/profile/route.ts
index 33652ae5..922bfd80 100644
--- a/dystopia/frontend/src/app/api/profile/route.ts
+++ b/dystopia/frontend/src/app/api/profile/route.ts
@@ -58,6 +58,9 @@ export async function POST(req: NextRequest) {
     }
     return NextResponse.json({ profile: mapProfileToView(res.profile) });
   } catch (error: unknown) {
+    if (isConnectError(error) && error.code === GrpcCode.FAILED_PRECONDITION) {
+      return NextResponse.json({ error: "プロフィールをこれ以上追加できません" }, { status: 422 });
+    }
     return handleApiError(error, "CreateProfile");
   }
 }
```

Run(root): `git status --short | wc -l`
Expected: `6`

- [ ] **Step 3: 通ることを確認する**

Run(`dystopia/frontend`): `env -u NODE_OPTIONS pnpm exec vitest run src/app/api/profile > /tmp/vitest-p9-t1-green.txt 2>&1; /usr/bin/grep -E '^ *(Test Files|Tests) ' /tmp/vitest-p9-t1-green.txt`
Expected:
```
 Test Files  3 passed (3)
      Tests  14 passed (14)
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-p9-t1-full.txt 2>&1; /usr/bin/grep -E '^ *(Test Files|Tests) ' /tmp/vitest-p9-t1-full.txt`
Expected:
```
 Test Files  96 passed (96)
      Tests  361 passed (361)
```

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "exit $?"`
Expected: `exit 0`

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add -A dystopia/frontend && git status --short && git commit -s -m "feat(dystopia/frontend): add routes to disable, enable and delete a profile" && cd dystopia/frontend
```

---

### Task 2: Profile picker, switching and a cache per acting profile

**Files:**
- Test: `src/components/shell/AppShell.recovery.test.tsx`、`src/components/shell/AppShell.switch.test.tsx`、`src/components/shell/Drawer.test.tsx`、`src/components/shell/ProfileGate.test.tsx`、`src/components/shell/ProfilePicker.test.tsx`、`src/components/shell/SideNav.test.tsx`、`src/modules/profile/components/ProfileSwitcher.test.tsx`、`src/modules/profile/lib/session.test.ts`、`src/stores/postLikeStore.test.ts`
- Create / Modify: `src/components/shell/AppShell.tsx`、`src/components/shell/Drawer.tsx`、`src/components/shell/ProfileGate.tsx`、`src/components/shell/ProfilePicker.tsx`、`src/components/shell/SideNav.tsx`、`src/modules/profile/components/ProfileSwitcher.tsx`、`src/modules/profile/context/AccountProfilesContext.tsx`、`src/modules/profile/hooks/useProfileSession.ts`、`src/modules/profile/lib/session.ts`、`src/stores/postLikeStore.ts`

**Interfaces:**
- Consumes: Task 1 には依存しない。
- Produces:
  - `useAccountProfiles(): { profiles: ProfileView[]; switchProfile(profileId: string): void; refresh(): Promise<void> }`(`@/modules/profile/context/AccountProfilesContext`)。`AppShell` の外では、空の一覧と何もしない関数を返す
  - `selectableProfiles(profiles, deniedProfileId)`(`@/modules/profile/lib/session`)
  - `useProfileSession()` は `profiles` と `refresh` も返す
  - `ProfilePicker`(`@/components/shell/ProfilePicker`)、`ProfileSwitcher`(`@/modules/profile/components/ProfileSwitcher`)
  - `ProfileGate` の `reason` は `"error" | "unavailable"` だけになる

- [ ] **Step 1: test を足す・書き換える(失敗する)**

次の内容を `/tmp/p9-t2-spec.patch` に保存し、リポジトリの root で `git apply --check /tmp/p9-t2-spec.patch && git apply /tmp/p9-t2-spec.patch` を実行する。

```diff
diff --git a/dystopia/frontend/src/components/shell/AppShell.recovery.test.tsx b/dystopia/frontend/src/components/shell/AppShell.recovery.test.tsx
index ffdb1d04..8faad781 100644
--- a/dystopia/frontend/src/components/shell/AppShell.recovery.test.tsx
+++ b/dystopia/frontend/src/components/shell/AppShell.recovery.test.tsx
@@ -2,12 +2,15 @@
 import { createElement } from "react";
 import { act } from "react";
 import { createRoot } from "react-dom/client";
-import { mutate as globalMutate } from "swr";
+import { mutate as globalMutate, useSWRConfig, type ScopedMutator } from "swr";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import { emptyProfileView } from "@/modules/profile/lib/mappers";

 (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

+// The shell keeps a cache per acting profile, so its requests are revalidated through the mutator of that cache.
+const shell: { mutate: ScopedMutator | null } = { mutate: null };
+
 const LIST_MS = 40;
 const REQUEST_MS = 30;

@@ -33,6 +36,7 @@ vi.mock("@/components/shell/Drawer", async () => {
   const { useFollow } = await import("@/modules/social/hooks/useFollow");
   return {
     Drawer: () => {
+      shell.mutate = useSWRConfig().mutate;
       useUnreadCount();
       useTotalUnread();
       useFootprintsUnreadCount();
@@ -208,7 +212,7 @@ describe("AppShell profile recovery", () => {
       expect(useAuthStore.getState()).toMatchObject({ accountId: "account-A", activeProfileId: "pA" });

       server.cookieAccount = "account-B";
-      void globalMutate("/api/notifications/unread-count");
+      void shell.mutate?.("/api/notifications/unread-count");
       await act(async () => {
         await sleep(500);
       });
@@ -237,7 +241,7 @@ describe("AppShell profile recovery", () => {
         await sleep(100);
       });
       server.rejectedProfiles.add("pA");
-      void globalMutate("/api/notifications/unread-count");
+      void shell.mutate?.("/api/notifications/unread-count");
       await act(async () => {
         await sleep(500);
       });
diff --git a/dystopia/frontend/src/components/shell/AppShell.switch.test.tsx b/dystopia/frontend/src/components/shell/AppShell.switch.test.tsx
new file mode 100644
index 00000000..1eec2f42
--- /dev/null
+++ b/dystopia/frontend/src/components/shell/AppShell.switch.test.tsx
@@ -0,0 +1,201 @@
+// @vitest-environment happy-dom
+import { createElement } from "react";
+import { act } from "react";
+import { createRoot } from "react-dom/client";
+import { mutate as globalMutate } from "swr";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+import { emptyProfileView } from "@/modules/profile/lib/mappers";
+
+(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
+
+const REQUEST_MS = 30;
+const push = vi.fn();
+
+vi.mock("next/navigation", () => ({
+  usePathname: () => "/messages",
+  useRouter: () => ({ replace: vi.fn(), push }),
+}));
+vi.mock("@/components/shell/TopBar", () => ({ TopBar: () => null }));
+vi.mock("@/components/shell/BottomTab", () => ({ BottomTab: () => null }));
+vi.mock("@/components/shell/ComposerFAB", () => ({ ComposerFAB: () => null }));
+vi.mock("@/components/shell/SideNav", () => ({ SideNav: () => null }));
+vi.mock("@/components/shell/SuggestedUsersPane", () => ({ SuggestedUsersPane: () => null }));
+vi.mock("@/modules/onboarding/components/FeatureTourModal", () => ({ FeatureTourModal: () => null }));
+vi.mock("@/modules/landing/components/LandingPage", () => ({ LandingPage: () => null }));
+vi.mock("@/components/shell/Drawer", async () => {
+  const { useUnreadCount } = await import("@/modules/notifications/hooks/useUnreadCount");
+  const { ProfileSwitcher } = await import("@/modules/profile/components/ProfileSwitcher");
+  return {
+    Drawer: () => {
+      const { count } = useUnreadCount();
+      return createElement(
+        "div",
+        { "data-testid": "shell-mounted" },
+        createElement("span", { "data-testid": "unread" }, String(count)),
+        createElement(ProfileSwitcher)
+      );
+    },
+  };
+});
+
+const unreadByProfile: Record<string, number> = { pA: 1, pB: 2 };
+const calls: { url: string; profileId: string | null }[] = [];
+
+const memory = new Map<string, string>();
+vi.stubGlobal("localStorage", {
+  getItem: (key: string) => memory.get(key) ?? null,
+  setItem: (key: string, value: string) => void memory.set(key, value),
+  removeItem: (key: string) => void memory.delete(key),
+});
+
+const { useAuthStore } = await import("@/stores/authStore");
+
+const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
+
+function json(body: unknown) {
+  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
+}
+
+const profile = (id: string, username: string) => ({ ...emptyProfileView(id), username, displayName: username });
+
+vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
+  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
+  const profileId = new Headers(init?.headers).get("x-profile-id");
+  calls.push({ url, profileId });
+  await sleep(REQUEST_MS);
+  if (url === "/api/identity/me") return json({ account: { id: "account-A", role: 2 } });
+  if (url === "/api/profile/mine") {
+    return json({ profiles: [profile("pA", "persona_a"), profile("pB", "persona_b"), { ...profile("pC", "persona_c"), disabled: true }] });
+  }
+  return json({ count: profileId ? unreadByProfile[profileId] : 0 });
+});
+
+async function mountApp() {
+  const [{ AppShell }, { AuthProvider }, { SWRProvider }] = await Promise.all([
+    import("./AppShell"),
+    import("@/modules/identity/hooks/useAuth"),
+    import("@/components/providers/SWRProvider"),
+  ]);
+  const container = document.createElement("div");
+  document.body.appendChild(container);
+  const root = createRoot(container);
+  await act(async () => {
+    root.render(
+      createElement(SWRProvider, null, createElement(AuthProvider, null, createElement(AppShell, null, createElement("div", null, "page"))))
+    );
+  });
+  return {
+    container,
+    unread: () => container.querySelector('[data-testid="unread"]')?.textContent ?? null,
+    click: async (text: string) => {
+      const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(text));
+      if (!button) throw new Error(`no button containing ${text}`);
+      await act(async () => {
+        button.click();
+      });
+    },
+    settle: async () => {
+      await act(async () => {
+        await sleep(REQUEST_MS * 4);
+      });
+    },
+    unmount: async () => {
+      await act(async () => {
+        root.unmount();
+      });
+      container.remove();
+    },
+  };
+}
+
+beforeEach(async () => {
+  calls.length = 0;
+  push.mockClear();
+  memory.clear();
+  useAuthStore.getState().clearIdentity();
+  useAuthStore.getState().setIdentity({ accountId: "account-A", role: "cast" });
+  useAuthStore.getState().setHydrated();
+  await globalMutate(() => true);
+  await globalMutate(() => true, undefined, { revalidate: false });
+});
+
+afterEach(() => {
+  useAuthStore.getState().clearIdentity();
+});
+
+describe("AppShell with several enabled profiles", () => {
+  it("asks which profile to use and sends no request as a profile before the choice", async () => {
+    const app = await mountApp();
+    await app.settle();
+
+    expect(app.container.textContent).toContain("プロフィールを選択");
+    expect(app.container.textContent).toContain("@persona_a");
+    expect(app.container.textContent).toContain("@persona_b");
+    expect(app.container.textContent).not.toContain("@persona_c");
+    expect(app.container.querySelector('[data-testid="shell-mounted"]')).toBeNull();
+    expect(calls.filter((call) => call.profileId !== null)).toEqual([]);
+    await app.unmount();
+  });
+
+  it("opens the shell as the chosen profile without leaving the current page", async () => {
+    const app = await mountApp();
+    await app.settle();
+
+    await app.click("@persona_a");
+    await app.settle();
+
+    expect(useAuthStore.getState().activeProfileId).toBe("pA");
+    expect(app.unread()).toBe("1");
+    expect(push).not.toHaveBeenCalled();
+    await app.unmount();
+  });
+
+  it("shows nothing of the previous profile after a switch, loads as the next one and goes to the top", async () => {
+    const app = await mountApp();
+    await app.settle();
+    await app.click("@persona_a");
+    await app.settle();
+    expect(app.unread()).toBe("1");
+    calls.length = 0;
+
+    await app.click("@persona_b");
+
+    expect(useAuthStore.getState().activeProfileId).toBe("pB");
+    expect(app.unread()).toBe("0");
+    expect(push.mock.calls).toEqual([["/"]]);
+
+    await app.settle();
+
+    expect(app.unread()).toBe("2");
+    expect(calls.filter((call) => call.url === "/api/notifications/unread-count").map((call) => call.profileId)).toEqual(["pB"]);
+    expect(app.container.textContent).toContain("@persona_a");
+    expect(app.container.textContent).not.toContain("@persona_b");
+    await app.unmount();
+  });
+
+  it("does not offer a profile the server denied until the list is retried", async () => {
+    useAuthStore.getState().setActiveProfile("pA");
+    const app = await mountApp();
+    await app.settle();
+
+    await act(async () => {
+      useAuthStore.getState().denyActiveProfile("pA");
+    });
+    await app.settle();
+
+    expect(app.container.textContent).toContain("プロフィールを選択");
+    expect(app.container.textContent).toContain("@persona_b");
+    expect(app.container.textContent).not.toContain("@persona_a");
+    await app.unmount();
+  });
+
+  it("keeps the stored profile across a reload", async () => {
+    useAuthStore.getState().setActiveProfile("pB");
+    const app = await mountApp();
+    await app.settle();
+
+    expect(app.container.textContent).not.toContain("プロフィールを選択");
+    expect(app.unread()).toBe("2");
+    await app.unmount();
+  });
+});
diff --git a/dystopia/frontend/src/components/shell/Drawer.test.tsx b/dystopia/frontend/src/components/shell/Drawer.test.tsx
index 659fce28..b6c47744 100644
--- a/dystopia/frontend/src/components/shell/Drawer.test.tsx
+++ b/dystopia/frontend/src/components/shell/Drawer.test.tsx
@@ -74,8 +74,25 @@ vi.mock("@/modules/karte/hooks/useMyKarteAccess", () => ({
 }));

 const { Drawer } = await import("./Drawer");
+const { AccountProfilesProvider } = await import("@/modules/profile/context/AccountProfilesContext");
+const { emptyProfileView } = await import("@/modules/profile/lib/mappers");

 describe("Drawer", () => {
+  it("offers the account's other profiles to switch to", () => {
+    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
+    profileMocks.useProfile.mockReturnValue({ profile: null });
+    const profiles = [{ ...emptyProfileView("p2"), username: "second_persona" }];
+
+    const html = renderToStaticMarkup(
+      <AccountProfilesProvider value={{ profiles, switchProfile: () => {}, refresh: async () => {} }}>
+        <Drawer open onClose={() => {}} onOpen={() => {}} />
+      </AccountProfilesProvider>
+    );
+
+    expect(html).toContain("プロフィールを切り替え");
+    expect(html).toContain("@second_persona");
+  });
+
   it("has no standalone oshi menu entry", () => {
     karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
     profileMocks.useProfile.mockReturnValue({ profile: null });
diff --git a/dystopia/frontend/src/components/shell/ProfileGate.test.tsx b/dystopia/frontend/src/components/shell/ProfileGate.test.tsx
index 4da4b775..cca4e165 100644
--- a/dystopia/frontend/src/components/shell/ProfileGate.test.tsx
+++ b/dystopia/frontend/src/components/shell/ProfileGate.test.tsx
@@ -14,7 +14,6 @@ describe("ProfileGate", () => {
     const headings = [
       ["error", "プロフィールを読み込めませんでした"],
       ["unavailable", "このプロフィールは利用できません"],
-      ["select", "プロフィールを選択できません"],
     ] as const;

     for (const [reason, heading] of headings) {
@@ -25,7 +24,7 @@ describe("ProfileGate", () => {
     }
   });

-  it("shows retry for errors and unavailable profiles only", () => {
+  it("offers retry and sign-out for every blocked reason", () => {
     for (const reason of ["error", "unavailable"] as const) {
       const html = renderToStaticMarkup(
         <ProfileGate reason={reason} onRetry={() => {}} onSignOut={() => {}} />
@@ -33,12 +32,6 @@ describe("ProfileGate", () => {
       expect(html).toContain("再試行");
       expect(html).toContain("ログアウト");
     }
-
-    const selectHtml = renderToStaticMarkup(
-      <ProfileGate reason="select" onRetry={() => {}} onSignOut={() => {}} />
-    );
-    expect(selectHtml).not.toContain("再試行");
-    expect(selectHtml).toContain("ログアウト");
   });

   it("calls retry and sign-out handlers from their buttons", async () => {
diff --git a/dystopia/frontend/src/components/shell/ProfilePicker.test.tsx b/dystopia/frontend/src/components/shell/ProfilePicker.test.tsx
new file mode 100644
index 00000000..4117a227
--- /dev/null
+++ b/dystopia/frontend/src/components/shell/ProfilePicker.test.tsx
@@ -0,0 +1,47 @@
+// @vitest-environment happy-dom
+import { createElement } from "react";
+import { act } from "react";
+import { createRoot } from "react-dom/client";
+import { describe, expect, it, vi } from "vitest";
+
+(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
+
+const { ProfilePicker } = await import("./ProfilePicker");
+
+const profiles = [
+  { id: "p1", displayName: "Yuna", username: "yuna", avatarUrl: "" },
+  { id: "p2", displayName: "Yuna Two", username: "yuna_two", avatarUrl: "" },
+];
+
+describe("ProfilePicker", () => {
+  it("lists every profile it is given and reports the chosen one", async () => {
+    const onSelect = vi.fn();
+    const onSignOut = vi.fn();
+    const container = document.createElement("div");
+    document.body.appendChild(container);
+    const root = createRoot(container);
+
+    await act(async () => {
+      root.render(createElement(ProfilePicker, { profiles, onSelect, onSignOut }));
+    });
+    const buttons = Array.from(container.querySelectorAll("button"));
+
+    expect(container.textContent).toContain("@yuna");
+    expect(container.textContent).toContain("@yuna_two");
+
+    await act(async () => {
+      buttons.find((button) => button.textContent?.includes("@yuna_two"))?.click();
+    });
+    expect(onSelect.mock.calls).toEqual([["p2"]]);
+
+    await act(async () => {
+      buttons.find((button) => button.textContent === "ログアウト")?.click();
+    });
+    expect(onSignOut).toHaveBeenCalledTimes(1);
+
+    await act(async () => {
+      root.unmount();
+    });
+    container.remove();
+  });
+});
diff --git a/dystopia/frontend/src/components/shell/SideNav.test.tsx b/dystopia/frontend/src/components/shell/SideNav.test.tsx
index 5374774c..a723ad76 100644
--- a/dystopia/frontend/src/components/shell/SideNav.test.tsx
+++ b/dystopia/frontend/src/components/shell/SideNav.test.tsx
@@ -35,8 +35,24 @@ vi.mock("@/modules/karte/hooks/useMyKarteAccess", () => ({
 }));

 const { SideNav } = await import("./SideNav");
+const { AccountProfilesProvider } = await import("@/modules/profile/context/AccountProfilesContext");
+const { emptyProfileView } = await import("@/modules/profile/lib/mappers");

 describe("SideNav", () => {
+  it("offers the account's other profiles to switch to", () => {
+    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
+    const profiles = [{ ...emptyProfileView("p2"), username: "second_persona" }];
+
+    const html = renderToStaticMarkup(
+      <AccountProfilesProvider value={{ profiles, switchProfile: () => {}, refresh: async () => {} }}>
+        <SideNav />
+      </AccountProfilesProvider>
+    );
+
+    expect(html).toContain("プロフィールを切り替え");
+    expect(html).toContain("@second_persona");
+  });
+
   it("links to my karte when the viewer has karte access", () => {
     karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });

diff --git a/dystopia/frontend/src/modules/profile/components/ProfileSwitcher.test.tsx b/dystopia/frontend/src/modules/profile/components/ProfileSwitcher.test.tsx
new file mode 100644
index 00000000..cbbefa20
--- /dev/null
+++ b/dystopia/frontend/src/modules/profile/components/ProfileSwitcher.test.tsx
@@ -0,0 +1,77 @@
+// @vitest-environment happy-dom
+import { createElement } from "react";
+import { act } from "react";
+import { createRoot } from "react-dom/client";
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import { emptyProfileView } from "@/modules/profile/lib/mappers";
+import { AccountProfilesProvider } from "@/modules/profile/context/AccountProfilesContext";
+import { useAuthStore } from "@/stores/authStore";
+
+(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
+
+const { ProfileSwitcher } = await import("./ProfileSwitcher");
+
+const profile = (id: string, username: string, disabled = false) => ({ ...emptyProfileView(id), username, displayName: username, disabled });
+
+function tree(profiles: ReturnType<typeof profile>[], switchProfile = vi.fn()) {
+  return createElement(
+    AccountProfilesProvider,
+    { value: { profiles, switchProfile, refresh: async () => {} } },
+    createElement(ProfileSwitcher)
+  );
+}
+
+async function render(profiles: ReturnType<typeof profile>[] | null, switchProfile = vi.fn()) {
+  const container = document.createElement("div");
+  document.body.appendChild(container);
+  const root = createRoot(container);
+  await act(async () => {
+    root.render(profiles ? tree(profiles, switchProfile) : createElement(ProfileSwitcher));
+  });
+  return {
+    container,
+    unmount: async () => {
+      await act(async () => {
+        root.unmount();
+      });
+      container.remove();
+    },
+  };
+}
+
+describe("ProfileSwitcher", () => {
+  beforeEach(() => {
+    useAuthStore.setState({ activeProfileId: "p1" });
+  });
+
+  it("offers the other enabled profiles and not the acting or a disabled one", async () => {
+    const view = await render([profile("p1", "first"), profile("p2", "second"), profile("p3", "third", true)]);
+
+    expect(view.container.textContent).toContain("@second");
+    expect(view.container.textContent).not.toContain("@first");
+    expect(view.container.textContent).not.toContain("@third");
+    await view.unmount();
+  });
+
+  it("renders nothing when there is no other enabled profile", async () => {
+    const onlyDisabledOthers = await render([profile("p1", "first"), profile("p3", "third", true)]);
+    const outsideTheShell = await render(null);
+
+    expect(onlyDisabledOthers.container.innerHTML).toBe("");
+    expect(outsideTheShell.container.innerHTML).toBe("");
+    await onlyDisabledOthers.unmount();
+    await outsideTheShell.unmount();
+  });
+
+  it("switches to the profile that was clicked", async () => {
+    const switchProfile = vi.fn();
+    const view = await render([profile("p1", "first"), profile("p2", "second")], switchProfile);
+
+    await act(async () => {
+      view.container.querySelector("button")?.click();
+    });
+
+    expect(switchProfile.mock.calls).toEqual([["p2"]]);
+    await view.unmount();
+  });
+});
diff --git a/dystopia/frontend/src/modules/profile/lib/session.test.ts b/dystopia/frontend/src/modules/profile/lib/session.test.ts
index 4493646b..275329df 100644
--- a/dystopia/frontend/src/modules/profile/lib/session.test.ts
+++ b/dystopia/frontend/src/modules/profile/lib/session.test.ts
@@ -1,7 +1,7 @@
 import { describe, expect, it, vi } from "vitest";
 import type { ScopedMutator } from "swr";
 import { emptyProfileView } from "@/modules/profile/lib/mappers";
-import { addToMyProfiles, isMyProfilesKey, myProfilesKey, resolveProfileSession } from "./session";
+import { addToMyProfiles, isMyProfilesKey, myProfilesKey, resolveProfileSession, selectableProfiles } from "./session";

 const enabled = (id: string) => ({ id, disabled: false });
 const disabled = (id: string) => ({ id, disabled: true });
@@ -57,6 +57,16 @@ describe("resolveProfileSession", () => {
   });
 });

+describe("selectableProfiles", () => {
+  it("offers enabled profiles only", () => {
+    expect(selectableProfiles([enabled("p1"), disabled("p2"), enabled("p3")], null).map((p) => p.id)).toEqual(["p1", "p3"]);
+  });
+
+  it("leaves out the profile the server denied", () => {
+    expect(selectableProfiles([enabled("p1"), enabled("p2"), enabled("p3")], "p2").map((p) => p.id)).toEqual(["p1", "p3"]);
+  });
+});
+
 describe("myProfilesKey", () => {
   it("separates the cache per account", () => {
     expect(myProfilesKey("acc-1")).toEqual(["/api/profile/mine", "acc-1"]);
diff --git a/dystopia/frontend/src/stores/postLikeStore.test.ts b/dystopia/frontend/src/stores/postLikeStore.test.ts
new file mode 100644
index 00000000..46d0faaa
--- /dev/null
+++ b/dystopia/frontend/src/stores/postLikeStore.test.ts
@@ -0,0 +1,35 @@
+import { beforeEach, describe, expect, it, vi } from "vitest";
+
+const memory = new Map<string, string>();
+vi.stubGlobal("localStorage", {
+  getItem: (key: string) => memory.get(key) ?? null,
+  setItem: (key: string, value: string) => void memory.set(key, value),
+  removeItem: (key: string) => void memory.delete(key),
+});
+
+const { useAuthStore } = await import("./authStore");
+const { usePostLikeStore } = await import("./postLikeStore");
+
+describe("postLikeStore", () => {
+  beforeEach(() => {
+    useAuthStore.setState({ accountId: "account-1", activeProfileId: "profile-a" });
+    usePostLikeStore.setState({ entries: {} });
+  });
+
+  it("drops the like state of the previous profile when the acting profile changes", () => {
+    usePostLikeStore.getState().seed("post-1", true, 3);
+
+    useAuthStore.getState().setActiveProfile("profile-b");
+    usePostLikeStore.getState().seed("post-1", false, 3);
+
+    expect(usePostLikeStore.getState().isLiked("post-1")).toBe(false);
+  });
+
+  it("keeps the like state while the acting profile stays the same", () => {
+    usePostLikeStore.getState().seed("post-1", true, 3);
+
+    useAuthStore.getState().setHydrated();
+
+    expect(usePostLikeStore.getState().isLiked("post-1")).toBe(true);
+  });
+});
```

Run(`dystopia/frontend`): `env -u NODE_OPTIONS pnpm exec vitest run src/components/shell src/modules/profile src/stores > /tmp/vitest-p9-t2-red.txt 2>&1; /usr/bin/grep -E '^ *(Test Files|Tests) ' /tmp/vitest-p9-t2-red.txt`
Expected:
```
 Test Files  7 failed | 14 passed (21)
      Tests  3 failed | 90 passed (93)
```

- [ ] **Step 2: 実装する**

次の内容を `/tmp/p9-t2-impl.patch` に保存し、リポジトリの root で `git apply --check /tmp/p9-t2-impl.patch && git apply /tmp/p9-t2-impl.patch` を実行する。

```diff
diff --git a/dystopia/frontend/src/components/shell/AppShell.tsx b/dystopia/frontend/src/components/shell/AppShell.tsx
index 6aed2f16..6d93938a 100644
--- a/dystopia/frontend/src/components/shell/AppShell.tsx
+++ b/dystopia/frontend/src/components/shell/AppShell.tsx
@@ -1,11 +1,21 @@
 "use client";

-import { useEffect, useState } from "react";
+import { useCallback, useEffect, useMemo, useState } from "react";
 import { usePathname, useRouter } from "next/navigation";
-import { useAuthStore, selectAccountId, selectActiveProfileId, selectIsHydrated } from "@/stores/authStore";
+import { SWRConfig } from "swr";
+import {
+  useAuthStore,
+  selectAccountId,
+  selectActiveProfileId,
+  selectDeniedProfileId,
+  selectIsHydrated,
+} from "@/stores/authStore";
 import { useProfileSession } from "@/modules/profile/hooks";
+import { selectableProfiles } from "@/modules/profile/lib/session";
+import { AccountProfilesProvider } from "@/modules/profile/context/AccountProfilesContext";
 import { useAuth } from "@/modules/identity/hooks/useAuth";
 import { ProfileGate } from "./ProfileGate";
+import { ProfilePicker } from "./ProfilePicker";
 import { TopBar } from "./TopBar";
 import { BottomTab } from "./BottomTab";
 import { ComposerFAB } from "./ComposerFAB";
@@ -27,7 +37,9 @@ export function AppShell({ children }: AppShellProps) {
   const isHydrated = useAuthStore(selectIsHydrated);
   const accountId = useAuthStore(selectAccountId);
   const activeProfileId = useAuthStore(selectActiveProfileId);
-  const { session, hasListError, retry } = useProfileSession();
+  const deniedProfileId = useAuthStore(selectDeniedProfileId);
+  const setActiveProfile = useAuthStore((s) => s.setActiveProfile);
+  const { session, profiles, hasListError, retry, refresh } = useProfileSession();
   const { signOut } = useAuth();
   const [drawerOpen, setDrawerOpen] = useState(false);
   const pathname = usePathname();
@@ -49,6 +61,16 @@ export function AppShell({ children }: AppShellProps) {
     if (redirectTo) router.replace(redirectTo);
   }, [redirectTo, router]);

+  const switchProfile = useCallback(
+    (profileId: string) => {
+      setActiveProfile(profileId);
+      setDrawerOpen(false);
+      router.push("/");
+    },
+    [setActiveProfile, router]
+  );
+  const accountProfiles = useMemo(() => ({ profiles, switchProfile, refresh }), [profiles, switchProfile, refresh]);
+
   const mode = resolveShellMode({
     isHydrated,
     isAuthenticated: !!accountId,
@@ -79,26 +101,36 @@ export function AppShell({ children }: AppShellProps) {
     if (session?.kind === "unavailable") {
       return <ProfileGate reason="unavailable" onRetry={retry} onSignOut={signOut} />;
     }
-    // TODO: Add a profile picker because several enabled profiles need an explicit choice.
-    return <ProfileGate reason="select" onRetry={retry} onSignOut={signOut} />;
+    return (
+      <ProfilePicker
+        profiles={selectableProfiles(profiles, deniedProfileId)}
+        onSelect={setActiveProfile}
+        onSignOut={signOut}
+      />
+    );
   }

+  // Give each acting profile its own cache: keys carry no profile id, so a shared cache would show one profile's data to the next.
   return (
-    <div key={activeProfileId} className="flex min-h-dvh flex-col bg-bg [touch-action:pan-y_pinch-zoom]">
-      <div className="md:hidden">
-        <TopBar onAvatarClick={() => setDrawerOpen(true)} />
-      </div>
-      <div className="mx-auto flex w-full max-w-screen-xl flex-1">
-        <SideNav />
-        <main className="min-w-0 flex-1 pb-24 md:max-w-2xl md:border-x md:border-border md:pb-0">
-          {children}
-        </main>
-        <SuggestedUsersPane />
-      </div>
-      <BottomTab />
-      <ComposerFAB />
-      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onOpen={() => setDrawerOpen(true)} />
-      <FeatureTourModal />
-    </div>
+    <SWRConfig key={activeProfileId} value={{ provider: () => new Map() }}>
+      <AccountProfilesProvider value={accountProfiles}>
+        <div className="flex min-h-dvh flex-col bg-bg [touch-action:pan-y_pinch-zoom]">
+          <div className="md:hidden">
+            <TopBar onAvatarClick={() => setDrawerOpen(true)} />
+          </div>
+          <div className="mx-auto flex w-full max-w-screen-xl flex-1">
+            <SideNav />
+            <main className="min-w-0 flex-1 pb-24 md:max-w-2xl md:border-x md:border-border md:pb-0">
+              {children}
+            </main>
+            <SuggestedUsersPane />
+          </div>
+          <BottomTab />
+          <ComposerFAB />
+          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onOpen={() => setDrawerOpen(true)} />
+          <FeatureTourModal />
+        </div>
+      </AccountProfilesProvider>
+    </SWRConfig>
   );
 }
diff --git a/dystopia/frontend/src/components/shell/Drawer.tsx b/dystopia/frontend/src/components/shell/Drawer.tsx
index bf4b6f13..2e44a340 100644
--- a/dystopia/frontend/src/components/shell/Drawer.tsx
+++ b/dystopia/frontend/src/components/shell/Drawer.tsx
@@ -14,6 +14,7 @@ import { useFootprintsUnreadCount } from "@/modules/footprints";
 import { useNotificationPreferences } from "@/modules/notifications/hooks";
 import { useAuth } from "@/modules/identity/hooks/useAuth";
 import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
+import { ProfileSwitcher } from "@/modules/profile/components/ProfileSwitcher";
 import { classifySwipeDirection, clampDrawerOffset, shouldToggleDrawer, type SwipeDirection } from "./drawerSwipe";

 const NAV_ITEMS = [
@@ -245,6 +246,8 @@ export function Drawer({ open, onClose, onOpen }: DrawerProps) {
           )}
         </nav>

+        <ProfileSwitcher />
+
         <div className="border-t border-border px-4 py-3">
           <button
             type="button"
diff --git a/dystopia/frontend/src/components/shell/ProfileGate.tsx b/dystopia/frontend/src/components/shell/ProfileGate.tsx
index 15b42ec4..7c9f0a28 100644
--- a/dystopia/frontend/src/components/shell/ProfileGate.tsx
+++ b/dystopia/frontend/src/components/shell/ProfileGate.tsx
@@ -3,7 +3,7 @@
 import { Button } from "@/components/ui/button";

 export interface ProfileGateProps {
-  reason: "error" | "unavailable" | "select";
+  reason: "error" | "unavailable";
   onRetry: () => void;
   onSignOut: () => void;
 }
@@ -17,10 +17,6 @@ const messages = {
     heading: "このプロフィールは利用できません",
     body: "もう一度読み込むか、ログインし直してください。",
   },
-  select: {
-    heading: "プロフィールを選択できません",
-    body: "複数のプロフィールがあります。ログインし直してください。",
-  },
 } as const;

 export function ProfileGate({ reason, onRetry, onSignOut }: ProfileGateProps) {
@@ -32,11 +28,9 @@ export function ProfileGate({ reason, onRetry, onSignOut }: ProfileGateProps) {
         <h1 className="mb-2 text-center text-2xl font-bold text-text-primary">{heading}</h1>
         <p className="mb-8 text-center text-sm text-text-secondary">{body}</p>
         <div className="space-y-3">
-          {reason !== "select" && (
-            <Button type="button" className="w-full" onClick={onRetry}>
-              再試行
-            </Button>
-          )}
+          <Button type="button" className="w-full" onClick={onRetry}>
+            再試行
+          </Button>
           <Button type="button" variant="secondary" className="w-full" onClick={onSignOut}>
             ログアウト
           </Button>
diff --git a/dystopia/frontend/src/components/shell/ProfilePicker.tsx b/dystopia/frontend/src/components/shell/ProfilePicker.tsx
new file mode 100644
index 00000000..c8486a15
--- /dev/null
+++ b/dystopia/frontend/src/components/shell/ProfilePicker.tsx
@@ -0,0 +1,42 @@
+"use client";
+
+import { Avatar } from "@/components/ui/avatar";
+import { Button } from "@/components/ui/button";
+import type { ProfileView } from "@/modules/profile/types";
+
+export interface ProfilePickerProps {
+  profiles: Pick<ProfileView, "id" | "displayName" | "username" | "avatarUrl">[];
+  onSelect: (profileId: string) => void;
+  onSignOut: () => void;
+}
+
+export function ProfilePicker({ profiles, onSelect, onSignOut }: ProfilePickerProps) {
+  return (
+    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
+      <div className="w-full max-w-sm">
+        <h1 className="mb-2 text-center text-2xl font-bold text-text-primary">プロフィールを選択</h1>
+        <p className="mb-8 text-center text-sm text-text-secondary">使用するプロフィールを選んでください。</p>
+        <ul className="mb-8 space-y-2">
+          {profiles.map((profile) => (
+            <li key={profile.id}>
+              <button
+                type="button"
+                onClick={() => onSelect(profile.id)}
+                className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left hover:bg-bg-secondary"
+              >
+                <Avatar src={profile.avatarUrl || undefined} fallback={(profile.displayName || "?").slice(0, 1)} size="md" />
+                <span className="min-w-0 flex-1">
+                  <span className="block truncate text-sm font-bold text-text-primary">{profile.displayName || "—"}</span>
+                  <span className="block truncate text-xs text-text-secondary">@{profile.username || "—"}</span>
+                </span>
+              </button>
+            </li>
+          ))}
+        </ul>
+        <Button type="button" variant="secondary" className="w-full" onClick={onSignOut}>
+          ログアウト
+        </Button>
+      </div>
+    </main>
+  );
+}
diff --git a/dystopia/frontend/src/components/shell/SideNav.tsx b/dystopia/frontend/src/components/shell/SideNav.tsx
index 0d0cb2c0..de31e03b 100644
--- a/dystopia/frontend/src/components/shell/SideNav.tsx
+++ b/dystopia/frontend/src/components/shell/SideNav.tsx
@@ -11,6 +11,7 @@ import { useUnreadCount, useNotificationPreferences } from "@/modules/notificati
 import { useTotalUnread } from "@/modules/messaging";
 import { useFootprintsUnreadCount } from "@/modules/footprints";
 import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
+import { ProfileSwitcher } from "@/modules/profile/components/ProfileSwitcher";

 type BadgeKey = "unread" | "messaging_unread" | "footprints_unread";

@@ -115,6 +116,8 @@ export function SideNav() {
         </div>
       </Link>

+      <ProfileSwitcher />
+
       <PostComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} />
     </aside>
   );
diff --git a/dystopia/frontend/src/modules/profile/components/ProfileSwitcher.tsx b/dystopia/frontend/src/modules/profile/components/ProfileSwitcher.tsx
new file mode 100644
index 00000000..e9e8b90f
--- /dev/null
+++ b/dystopia/frontend/src/modules/profile/components/ProfileSwitcher.tsx
@@ -0,0 +1,36 @@
+"use client";
+
+import { Avatar } from "@/components/ui/avatar";
+import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
+import { useAccountProfiles } from "@/modules/profile/context/AccountProfilesContext";
+
+export function ProfileSwitcher() {
+  const activeProfileId = useAuthStore(selectActiveProfileId);
+  const { profiles, switchProfile } = useAccountProfiles();
+  const others = profiles.filter((profile) => !profile.disabled && profile.id !== activeProfileId);
+
+  if (others.length === 0) return null;
+
+  return (
+    <section aria-label="プロフィールを切り替え" className="border-t border-border px-2 py-2">
+      <p className="px-2 pb-1 text-xs text-text-secondary">プロフィールを切り替え</p>
+      <ul>
+        {others.map((profile) => (
+          <li key={profile.id}>
+            <button
+              type="button"
+              onClick={() => switchProfile(profile.id)}
+              className="flex w-full items-center gap-3 rounded-full px-2 py-2 text-left hover:bg-bg-secondary"
+            >
+              <Avatar src={profile.avatarUrl || undefined} fallback={(profile.displayName || "?").slice(0, 1)} size="sm" />
+              <span className="min-w-0 flex-1">
+                <span className="block truncate text-sm font-bold text-text-primary">{profile.displayName || "—"}</span>
+                <span className="block truncate text-xs text-text-secondary">@{profile.username || "—"}</span>
+              </span>
+            </button>
+          </li>
+        ))}
+      </ul>
+    </section>
+  );
+}
diff --git a/dystopia/frontend/src/modules/profile/context/AccountProfilesContext.tsx b/dystopia/frontend/src/modules/profile/context/AccountProfilesContext.tsx
new file mode 100644
index 00000000..9052e3b5
--- /dev/null
+++ b/dystopia/frontend/src/modules/profile/context/AccountProfilesContext.tsx
@@ -0,0 +1,22 @@
+"use client";
+
+import { createContext, useContext } from "react";
+import type { ProfileView } from "@/modules/profile/types";
+
+export interface AccountProfiles {
+  profiles: ProfileView[];
+  switchProfile: (profileId: string) => void;
+  refresh: () => Promise<void>;
+}
+
+const AccountProfilesContext = createContext<AccountProfiles>({
+  profiles: [],
+  switchProfile: () => {},
+  refresh: async () => {},
+});
+
+export const AccountProfilesProvider = AccountProfilesContext.Provider;
+
+export function useAccountProfiles(): AccountProfiles {
+  return useContext(AccountProfilesContext);
+}
diff --git a/dystopia/frontend/src/modules/profile/hooks/useProfileSession.ts b/dystopia/frontend/src/modules/profile/hooks/useProfileSession.ts
index 6cd7fc44..701f9ccf 100644
--- a/dystopia/frontend/src/modules/profile/hooks/useProfileSession.ts
+++ b/dystopia/frontend/src/modules/profile/hooks/useProfileSession.ts
@@ -10,12 +10,16 @@ import {
   selectDeniedProfileId,
 } from "@/stores/authStore";
 import { myProfilesKey, resolveProfileSession, type ProfileSession } from "@/modules/profile/lib/session";
-import type { MyProfilesResponse } from "@/modules/profile/types";
+import type { MyProfilesResponse, ProfileView } from "@/modules/profile/types";
+
+const NO_PROFILES: ProfileView[] = [];

 export interface ProfileSessionState {
   session: ProfileSession | null;
+  profiles: ProfileView[];
   hasListError: boolean;
   retry: () => void;
+  refresh: () => Promise<void>;
 }

 export function useProfileSession(): ProfileSessionState {
@@ -40,11 +44,15 @@ export function useProfileSession(): ProfileSessionState {
     void mutate();
   }, [clearDeniedProfile, mutate]);

+  const refresh = useCallback(async () => {
+    await mutate();
+  }, [mutate]);
+
   useEffect(() => {
     if (isResolved && resolvedProfileId !== activeProfileId) {
       setActiveProfile(resolvedProfileId);
     }
   }, [isResolved, resolvedProfileId, activeProfileId, setActiveProfile]);

-  return { session, hasListError: !data && !!error, retry };
+  return { session, profiles: data?.profiles ?? NO_PROFILES, hasListError: !data && !!error, retry, refresh };
 }
diff --git a/dystopia/frontend/src/modules/profile/lib/session.ts b/dystopia/frontend/src/modules/profile/lib/session.ts
index 20945023..00f1ad66 100644
--- a/dystopia/frontend/src/modules/profile/lib/session.ts
+++ b/dystopia/frontend/src/modules/profile/lib/session.ts
@@ -31,6 +31,13 @@ export function resolveProfileSession(
   return { kind: "select" };
 }

+export function selectableProfiles<T extends Pick<ProfileView, "id" | "disabled">>(
+  profiles: T[],
+  deniedProfileId: string | null
+): T[] {
+  return profiles.filter((profile) => !profile.disabled && profile.id !== deniedProfileId);
+}
+
 export function myProfilesKey(accountId: string): readonly [string, string] {
   return [MY_PROFILES_URL, accountId];
 }
diff --git a/dystopia/frontend/src/stores/postLikeStore.ts b/dystopia/frontend/src/stores/postLikeStore.ts
index b316cfd9..d090968e 100644
--- a/dystopia/frontend/src/stores/postLikeStore.ts
+++ b/dystopia/frontend/src/stores/postLikeStore.ts
@@ -104,3 +104,8 @@ export const usePostLikeStore = create<PostLikeState>()((set, get) => ({
   isLiked: (postId, fallback = false) => get().entries[postId]?.liked ?? fallback,
   getLikesCount: (postId, fallback = 0) => get().entries[postId]?.likesCount ?? fallback,
 }));
+
+// Like state belongs to the acting profile; seed() keeps existing entries, so they must not survive a change of profile.
+useAuthStore.subscribe((state, previous) => {
+  if (state.activeProfileId !== previous.activeProfileId) usePostLikeStore.setState({ entries: {} });
+});
```

Run(root): `git status --short | wc -l`
Expected: `19`

- [ ] **Step 3: 通ることを確認する**

Run(`dystopia/frontend`): `env -u NODE_OPTIONS pnpm exec vitest run src/components/shell src/modules/profile src/stores > /tmp/vitest-p9-t2-green.txt 2>&1; /usr/bin/grep -E '^ *(Test Files|Tests) ' /tmp/vitest-p9-t2-green.txt`
Expected:
```
 Test Files  21 passed (21)
      Tests  115 passed (115)
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-p9-t2-full.txt 2>&1; /usr/bin/grep -E '^ *(Test Files|Tests) ' /tmp/vitest-p9-t2-full.txt`
Expected:
```
 Test Files  100 passed (100)
      Tests  376 passed (376)
```

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "exit $?"`
Expected: `exit 0`

Run: `for i in 1 2 3; do env -u NODE_OPTIONS pnpm exec vitest run src/components/shell/AppShell.switch.test.tsx src/components/shell/AppShell.recovery.test.tsx 2>&1 | /usr/bin/grep -E '^ *Tests '; done | sort | uniq -c`
Expected: 3 回とも同じ行で、`failed` を含まない

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add -A dystopia/frontend && git status --short && git commit -s -m "feat(dystopia/frontend): choose and switch the acting profile with a cache per profile" && cd dystopia/frontend
```

---

### Task 3: Manage profiles from settings

**Files:**
- Test: `src/app/settings/page.profiles.test.tsx`、`src/modules/karte/components/KarteEntryCard.profile.test.tsx`、`src/modules/profile/components/ProfileManager.test.tsx`
- Create / Modify: `src/app/onboarding/page.tsx`、`src/app/settings/page.tsx`、`src/modules/karte/components/KarteEntryCard.tsx`、`src/modules/karte/hooks/useGuestKarte.ts`、`src/modules/karte/hooks/useMyKarte.ts`、`src/modules/karte/hooks/useMyKarteAccess.ts`、`src/modules/karte/hooks/useRecentKarte.ts`、`src/modules/profile/components/ProfileManager.tsx`、`src/modules/profile/components/ProfileNameForm.tsx`、`src/modules/profile/hooks/usePublicProfile.ts`、`src/modules/social/hooks/useBlockedList.ts`、`src/modules/social/hooks/useFollowList.ts`、`src/modules/social/hooks/useFollowRequests.ts`、`src/modules/social/hooks/useFollowerList.ts`、`src/modules/social/hooks/useSocialCounts.ts`

**Interfaces:**
- Consumes: Task 1 の route(`/api/profile/[id]/disable`、`/enable`、`DELETE /api/profile/[id]`、`POST /api/profile`)、Task 2 の `useAccountProfiles()`。
- Produces:
  - `ProfileNameForm({ submitLabel, onSubmit })`(`@/modules/profile/components/ProfileNameForm`)。onboarding と人格の追加で共有する
  - `ProfileManager`(`@/modules/profile/components/ProfileManager`)。設定画面のタブ `profiles` に出す

- [ ] **Step 1: test を足す(失敗する)**

次の内容を `/tmp/p9-t3-spec.patch` に保存し、リポジトリの root で `git apply --check /tmp/p9-t3-spec.patch && git apply /tmp/p9-t3-spec.patch` を実行する。

```diff
diff --git a/dystopia/frontend/src/app/settings/page.profiles.test.tsx b/dystopia/frontend/src/app/settings/page.profiles.test.tsx
new file mode 100644
index 00000000..591d7ea8
--- /dev/null
+++ b/dystopia/frontend/src/app/settings/page.profiles.test.tsx
@@ -0,0 +1,72 @@
+// @vitest-environment happy-dom
+import { createElement } from "react";
+import { act } from "react";
+import { createRoot } from "react-dom/client";
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import { emptyProfileView } from "@/modules/profile/lib/mappers";
+
+(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
+
+vi.mock("@/modules/profile/hooks", () => ({
+  useProfile: () => ({ profile: emptyProfileView("p1"), loading: false, error: null, saveProfile: vi.fn() }),
+}));
+vi.mock("@/modules/identity/hooks/useDeactivateAccount", () => ({
+  useDeactivateAccount: () => ({ deactivate: vi.fn(), loading: false, error: null }),
+}));
+vi.mock("@/modules/notifications/components/NotificationSettings", () => ({ NotificationSettings: () => null }));
+vi.mock("@/modules/profile/components/PrivacySettings", () => ({ PrivacySettings: () => null }));
+vi.mock("@/modules/profile/components/AccountSettings", () => ({ AccountSettings: () => null }));
+vi.mock("@/modules/profile/components/AppearanceSettings", () => ({ AppearanceSettings: () => null }));
+vi.mock("@/modules/profile/components/ProfileManager", () => ({
+  ProfileManager: () => createElement("div", { "data-testid": "profile-manager" }),
+}));
+
+const { useAuthStore } = await import("@/stores/authStore");
+const { default: SettingsPage } = await import("./page");
+
+async function mount() {
+  const container = document.createElement("div");
+  document.body.appendChild(container);
+  const root = createRoot(container);
+  await act(async () => {
+    root.render(createElement(SettingsPage));
+  });
+  return {
+    container,
+    tab: (label: string) => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === label),
+    unmount: async () => {
+      await act(async () => {
+        root.unmount();
+      });
+      container.remove();
+    },
+  };
+}
+
+describe("SettingsPage profile management", () => {
+  beforeEach(() => {
+    useAuthStore.getState().setHydrated();
+  });
+
+  it("gives a cast the profile tab and opens the manager from it", async () => {
+    useAuthStore.setState({ accountId: "account-1", role: "cast", activeProfileId: "p1" });
+    const view = await mount();
+
+    await act(async () => {
+      view.tab("プロフィール")?.click();
+    });
+
+    expect(view.container.querySelector('[data-testid="profile-manager"]')).not.toBeNull();
+    await view.unmount();
+  });
+
+  it("gives a guest no profile tab", async () => {
+    useAuthStore.setState({ accountId: "account-1", role: "guest", activeProfileId: "p1" });
+    const view = await mount();
+
+    expect(view.tab("通知設定")).toBeDefined();
+    expect(view.tab("プロフィール")).toBeUndefined();
+    expect(view.container.querySelector('[data-testid="profile-manager"]')).toBeNull();
+    await view.unmount();
+  });
+});
diff --git a/dystopia/frontend/src/modules/karte/components/KarteEntryCard.profile.test.tsx b/dystopia/frontend/src/modules/karte/components/KarteEntryCard.profile.test.tsx
new file mode 100644
index 00000000..0889864c
--- /dev/null
+++ b/dystopia/frontend/src/modules/karte/components/KarteEntryCard.profile.test.tsx
@@ -0,0 +1,73 @@
+// @vitest-environment happy-dom
+import { createElement } from "react";
+import { act } from "react";
+import { createRoot } from "react-dom/client";
+import { beforeEach, describe, expect, it, vi } from "vitest";
+
+(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
+
+vi.mock("../hooks/useDeleteKarte", () => ({
+  useDeleteKarte: () => ({ remove: vi.fn(), loading: false }),
+}));
+vi.mock("../hooks/useReportKarte", () => ({
+  useReportKarte: () => ({ report: vi.fn(), loading: false }),
+}));
+
+const { KarteEntryCard } = await import("./KarteEntryCard");
+const { useAuthStore } = await import("@/stores/authStore");
+
+const entry = {
+  id: "e-1",
+  authorProfileId: "persona-a",
+  targetProfileId: "target-1",
+  isMine: true,
+  authorUsername: "persona_a",
+  authorAvatarUrl: "",
+  targetUsername: "guest_hanako",
+  targetAvatarUrl: "",
+  rating: 4,
+  body: "memo",
+  flagged: false,
+  createdAt: new Date().toISOString(),
+  updatedAt: new Date().toISOString(),
+};
+
+async function textOf(props: Parameters<typeof KarteEntryCard>[0]) {
+  const container = document.createElement("div");
+  document.body.appendChild(container);
+  const root = createRoot(container);
+  await act(async () => {
+    root.render(createElement(KarteEntryCard, props));
+  });
+  const text = container.textContent ?? "";
+  await act(async () => {
+    root.unmount();
+  });
+  container.remove();
+  return text;
+}
+
+describe("KarteEntryCard written by another profile of the account", () => {
+  beforeEach(() => {
+    useAuthStore.setState({ activeProfileId: "persona-b" });
+  });
+
+  it("names the profile that wrote the entry in the own list", async () => {
+    expect(await textOf({ entry, mode: "my" })).toContain("@persona_a として記録");
+  });
+
+  it("says so when that profile no longer exists", async () => {
+    expect(await textOf({ entry: { ...entry, authorUsername: "" }, mode: "my" })).toContain("削除したプロフィールで記録");
+  });
+
+  it("adds nothing for an entry written by the acting profile", async () => {
+    useAuthStore.setState({ activeProfileId: "persona-a" });
+
+    expect(await textOf({ entry, mode: "my" })).not.toContain("として記録");
+  });
+
+  it("adds nothing outside the own list", async () => {
+    expect(await textOf({ entry, mode: "recent" })).not.toContain("として記録");
+    expect(await textOf({ entry, mode: "target" })).not.toContain("として記録");
+  });
+});
diff --git a/dystopia/frontend/src/modules/profile/components/ProfileManager.test.tsx b/dystopia/frontend/src/modules/profile/components/ProfileManager.test.tsx
new file mode 100644
index 00000000..2aec1de7
--- /dev/null
+++ b/dystopia/frontend/src/modules/profile/components/ProfileManager.test.tsx
@@ -0,0 +1,164 @@
+// @vitest-environment happy-dom
+import { createElement } from "react";
+import { act } from "react";
+import { createRoot } from "react-dom/client";
+import { beforeEach, describe, expect, it, vi } from "vitest";
+import { emptyProfileView } from "@/modules/profile/lib/mappers";
+import { AccountProfilesProvider } from "@/modules/profile/context/AccountProfilesContext";
+
+(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
+
+const log: string[] = [];
+const authFetch = vi.fn();
+vi.mock("@/lib/auth/fetch", () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));
+
+const { useAuthStore } = await import("@/stores/authStore");
+const { ProfileManager } = await import("./ProfileManager");
+
+const profile = (id: string, username: string, disabled = false) => ({ ...emptyProfileView(id), username, displayName: username, disabled });
+const profiles = [profile("p1", "first"), profile("p2", "second"), profile("p3", "third", true)];
+const switchProfile = vi.fn((profileId: string) => void log.push(`switch ${profileId}`));
+const refresh = vi.fn(async () => void log.push("refresh"));
+
+async function mount() {
+  const container = document.createElement("div");
+  document.body.appendChild(container);
+  const root = createRoot(container);
+  await act(async () => {
+    root.render(createElement(AccountProfilesProvider, { value: { profiles, switchProfile, refresh } }, createElement(ProfileManager)));
+  });
+  return {
+    container,
+    unmount: async () => {
+      await act(async () => {
+        root.unmount();
+      });
+      container.remove();
+    },
+  };
+}
+
+function row(container: HTMLElement, username: string) {
+  const item = Array.from(container.querySelectorAll("li")).find((li) => li.textContent?.includes(`@${username}`));
+  if (!item) throw new Error(`no row for @${username}`);
+  return item;
+}
+
+function labels(element: Element) {
+  return Array.from(element.querySelectorAll("button")).map((button) => button.textContent);
+}
+
+async function click(scope: ParentNode, label: string) {
+  const button = Array.from(scope.querySelectorAll("button")).find((candidate) => candidate.textContent === label);
+  if (!button) throw new Error(`no button labelled ${label}`);
+  await act(async () => {
+    button.click();
+  });
+}
+
+async function type(input: HTMLInputElement, value: string) {
+  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
+  await act(async () => {
+    setValue?.call(input, value);
+    input.dispatchEvent(new Event("input", { bubbles: true }));
+  });
+}
+
+describe("ProfileManager", () => {
+  beforeEach(() => {
+    log.length = 0;
+    authFetch.mockReset();
+    authFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
+      log.push(`${options?.method ?? "GET"} ${url}`);
+      return { profile: profile("p4", "fourth") };
+    });
+    switchProfile.mockClear();
+    refresh.mockClear();
+    useAuthStore.setState({ accountId: "account-1", role: "cast", activeProfileId: "p1" });
+  });
+
+  it("offers each profile only the changes its state allows", async () => {
+    const view = await mount();
+
+    expect(row(view.container, "first").textContent).toContain("使用中");
+    expect(labels(row(view.container, "first"))).toEqual([]);
+    expect(labels(row(view.container, "second"))).toEqual(["切り替える", "無効にする"]);
+    expect(row(view.container, "third").textContent).toContain("無効");
+    expect(labels(row(view.container, "third"))).toEqual(["有効にする", "削除する"]);
+    await view.unmount();
+  });
+
+  it("switches to an enabled profile", async () => {
+    const view = await mount();
+
+    await click(row(view.container, "second"), "切り替える");
+
+    expect(log).toEqual(["switch p2"]);
+    await view.unmount();
+  });
+
+  it("disables and enables through the routes and then refreshes the list", async () => {
+    const view = await mount();
+
+    await click(row(view.container, "second"), "無効にする");
+    await click(row(view.container, "third"), "有効にする");
+
+    expect(log).toEqual(["POST /api/profile/p2/disable", "refresh", "POST /api/profile/p3/enable", "refresh"]);
+    await view.unmount();
+  });
+
+  it("deletes a disabled profile only after the confirmation", async () => {
+    const view = await mount();
+
+    await click(row(view.container, "third"), "削除する");
+    expect(log).toEqual([]);
+    expect(document.body.textContent).toContain("@third を削除しますか？");
+    expect(document.body.textContent).toContain("カルテの記録は残ります");
+
+    const dialog = document.body.querySelector('[role="dialog"]');
+    if (!dialog) throw new Error("the confirmation did not open");
+    await click(dialog, "削除する");
+
+    expect(log).toEqual(["DELETE /api/profile/p3", "refresh"]);
+    await view.unmount();
+  });
+
+  it("leaves the profile alone when the confirmation is cancelled", async () => {
+    const view = await mount();
+
+    await click(row(view.container, "third"), "削除する");
+    const dialog = document.body.querySelector('[role="dialog"]');
+    if (!dialog) throw new Error("the confirmation did not open");
+    await click(dialog, "キャンセル");
+
+    expect(log).toEqual([]);
+    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
+    await view.unmount();
+  });
+
+  it("adds a profile, refreshes the list and only then switches to it", async () => {
+    const view = await mount();
+
+    await click(view.container, "プロフィールを追加");
+    await type(view.container.querySelector("#displayName") as HTMLInputElement, "Fourth");
+    await type(view.container.querySelector("#username") as HTMLInputElement, "fourth");
+    await act(async () => {
+      view.container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
+    });
+
+    expect(authFetch.mock.calls[0]).toEqual(["/api/profile", { method: "POST", body: { displayName: "Fourth", username: "fourth" } }]);
+    expect(log).toEqual(["POST /api/profile", "refresh", "switch p4"]);
+    await view.unmount();
+  });
+
+  it("shows the reason and keeps the list when a change is refused", async () => {
+    authFetch.mockRejectedValue(new Error("入力内容を確認してください"));
+    const view = await mount();
+
+    await click(row(view.container, "second"), "無効にする");
+
+    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("入力内容を確認してください");
+    expect(refresh).not.toHaveBeenCalled();
+    await view.unmount();
+  });
+});
```

Run(`dystopia/frontend`): `env -u NODE_OPTIONS pnpm exec vitest run src/app/settings src/modules/profile src/modules/karte > /tmp/vitest-p9-t3-red.txt 2>&1; /usr/bin/grep -E '^ *(Test Files|Tests) ' /tmp/vitest-p9-t3-red.txt`
Expected:
```
 Test Files  3 failed | 11 passed (14)
      Tests  3 failed | 53 passed (56)
```

- [ ] **Step 2: 実装する**

次の内容を `/tmp/p9-t3-impl.patch` に保存し、リポジトリの root で `git apply --check /tmp/p9-t3-impl.patch && git apply /tmp/p9-t3-impl.patch` を実行する。

```diff
diff --git a/dystopia/frontend/src/app/onboarding/page.tsx b/dystopia/frontend/src/app/onboarding/page.tsx
index 6766a2fb..d30b2489 100644
--- a/dystopia/frontend/src/app/onboarding/page.tsx
+++ b/dystopia/frontend/src/app/onboarding/page.tsx
@@ -1,38 +1,17 @@
 "use client";

-import { useState } from "react";
 import { useRouter } from "next/navigation";
 import { useAuthStore, selectRole } from "@/stores/authStore";
 import { useProfile } from "@/modules/profile/hooks/useProfile";
-import { Input } from "@/components/ui/input";
-import { Button } from "@/components/ui/button";
+import { ProfileNameForm } from "@/modules/profile/components/ProfileNameForm";

 export default function OnboardingPage() {
   const router = useRouter();
   const role = useAuthStore(selectRole);
   const { createProfile } = useProfile();

-  const [displayName, setDisplayName] = useState("");
-  const [username, setUsername] = useState("");
-  const [error, setError] = useState<string | null>(null);
-  const [submitting, setSubmitting] = useState(false);
-
   const isCast = role === "cast";

-  const handleSubmit = async (e: React.FormEvent) => {
-    e.preventDefault();
-    setError(null);
-    setSubmitting(true);
-    try {
-      await createProfile({ displayName, username });
-      router.replace("/");
-    } catch (err) {
-      setError(err instanceof Error ? err.message : "プロフィールの保存に失敗しました");
-    } finally {
-      setSubmitting(false);
-    }
-  };
-
   return (
     <main className="flex min-h-screen items-center justify-center bg-bg px-4">
       <div className="w-full max-w-sm">
@@ -45,67 +24,13 @@ export default function OnboardingPage() {
             : "表示名とユーザー名を設定してください。"}
         </p>

-        <form onSubmit={handleSubmit} className="space-y-4">
-          <div className="space-y-1">
-            <label
-              htmlFor="displayName"
-              className="text-sm font-medium text-text-primary"
-            >
-              表示名
-              <span className="ml-0.5 text-error">*</span>
-            </label>
-            <Input
-              id="displayName"
-              type="text"
-              placeholder={isCast ? "例：さくら" : "例：さくら"}
-              value={displayName}
-              onChange={(e) => setDisplayName(e.target.value)}
-              required
-              autoComplete="name"
-              maxLength={50}
-            />
-          </div>
-
-          <div className="space-y-1">
-            <label
-              htmlFor="username"
-              className="text-sm font-medium text-text-primary"
-            >
-              ユーザー名
-              <span className="ml-0.5 text-error">*</span>
-            </label>
-            <div className="relative">
-              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted select-none">
-                @
-              </span>
-              <Input
-                id="username"
-                type="text"
-                placeholder="username"
-                value={username}
-                onChange={(e) => setUsername(e.target.value)}
-                required
-                autoComplete="username"
-                maxLength={30}
-                pattern="[a-zA-Z0-9_]+"
-                className="pl-8"
-              />
-            </div>
-            <p className="text-xs text-text-muted">
-              英数字とアンダースコアのみ使用できます。
-            </p>
-          </div>
-
-          {error && (
-            <p role="alert" className="text-sm text-error">
-              {error}
-            </p>
-          )}
-
-          <Button type="submit" className="w-full" disabled={submitting}>
-            {submitting ? "保存中…" : "完了"}
-          </Button>
-        </form>
+        <ProfileNameForm
+          submitLabel="完了"
+          onSubmit={async (payload) => {
+            await createProfile(payload);
+            router.replace("/");
+          }}
+        />
       </div>
     </main>
   );
diff --git a/dystopia/frontend/src/app/settings/page.tsx b/dystopia/frontend/src/app/settings/page.tsx
index 723bec2a..2dc24a72 100644
--- a/dystopia/frontend/src/app/settings/page.tsx
+++ b/dystopia/frontend/src/app/settings/page.tsx
@@ -2,11 +2,12 @@

 import { useState } from "react";
 import { useProfile } from "@/modules/profile/hooks";
-import { useAuthStore, selectIsHydrated } from "@/stores/authStore";
+import { useAuthStore, selectIsHydrated, selectRole } from "@/stores/authStore";
 import { PageHeader } from "@/components/ui/page-header";
 import { Tabs } from "@/components/ui/tab";
 import { PrivacySettings } from "@/modules/profile/components/PrivacySettings";
 import { AccountSettings } from "@/modules/profile/components/AccountSettings";
+import { ProfileManager } from "@/modules/profile/components/ProfileManager";
 import { NotificationSettings } from "@/modules/notifications/components/NotificationSettings";
 import { AppearanceSettings } from "@/modules/profile/components/AppearanceSettings";
 import { useDeactivateAccount } from "@/modules/identity/hooks/useDeactivateAccount";
@@ -18,6 +19,7 @@ export function SettingsHeader() {

 export default function SettingsPage() {
   const isHydrated = useAuthStore(selectIsHydrated);
+  const role = useAuthStore(selectRole);
   const { profile, loading, error, saveProfile } = useProfile();
   const { deactivate, loading: deactivating, error: deactivateError } = useDeactivateAccount();
   const [confirmOpen, setConfirmOpen] = useState(false);
@@ -26,6 +28,7 @@ export default function SettingsPage() {
     { id: "notifications", label: "通知設定" },
     { id: "privacy", label: "プライバシー" },
     { id: "appearance", label: "外観" },
+    ...(role === "cast" ? [{ id: "profiles", label: "プロフィール" }] : []),
     { id: "account", label: "アカウント" },
   ];
   const [tab, setTab] = useState("notifications");
@@ -51,6 +54,7 @@ export default function SettingsPage() {
         {tab === "notifications" && <NotificationSettings />}
         {tab === "privacy" && <PrivacySettings profile={profile} save={saveProfile} />}
         {tab === "appearance" && <AppearanceSettings />}
+        {tab === "profiles" && role === "cast" && <ProfileManager />}
         {tab === "account" && (
           <>
             <AccountSettings profile={profile} save={saveProfile} />
diff --git a/dystopia/frontend/src/modules/karte/components/KarteEntryCard.tsx b/dystopia/frontend/src/modules/karte/components/KarteEntryCard.tsx
index f6b83cf8..6b57fd34 100644
--- a/dystopia/frontend/src/modules/karte/components/KarteEntryCard.tsx
+++ b/dystopia/frontend/src/modules/karte/components/KarteEntryCard.tsx
@@ -5,6 +5,7 @@ import { useState } from "react";
 import { useDeleteKarte } from "../hooks/useDeleteKarte";
 import { useReportKarte } from "../hooks/useReportKarte";
 import { formatTimeAgo } from "@/lib/utils/date";
+import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
 import type { KarteEntry } from "../types";

 interface Props {
@@ -15,6 +16,8 @@ interface Props {

 export function KarteEntryCard({ entry, mode, onChanged }: Props) {
   const isOwn = entry.isMine;
+  const activeProfileId = useAuthStore(selectActiveProfileId);
+  const writtenAsOtherProfile = mode === "my" && entry.authorProfileId !== activeProfileId;
   const { remove, loading: deleting } = useDeleteKarte();
   const { report, loading: reporting } = useReportKarte();
   const [reportOpen, setReportOpen] = useState(false);
@@ -48,6 +51,11 @@ export function KarteEntryCard({ entry, mode, onChanged }: Props) {
           </span>
         )}
       </div>
+      {writtenAsOtherProfile && (
+        <p className="mt-1 text-xs text-muted-foreground">
+          {entry.authorUsername ? `@${entry.authorUsername} として記録` : "削除したプロフィールで記録"}
+        </p>
+      )}
       <div className="mt-1 text-base">{"★".repeat(entry.rating)}{"☆".repeat(5 - entry.rating)}</div>
       {entry.body && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>}
       <div className="mt-2 flex gap-3 text-sm text-muted-foreground">
diff --git a/dystopia/frontend/src/modules/karte/hooks/useGuestKarte.ts b/dystopia/frontend/src/modules/karte/hooks/useGuestKarte.ts
index ae2c0160..18c12468 100644
--- a/dystopia/frontend/src/modules/karte/hooks/useGuestKarte.ts
+++ b/dystopia/frontend/src/modules/karte/hooks/useGuestKarte.ts
@@ -6,10 +6,10 @@ import { useAuthStore } from "@/stores/authStore";
 import type { PaginatedKarteByTargetResponse } from "../types";

 export function useGuestKarte(targetProfileId: string | null | undefined) {
-  const userId = useAuthStore((s) => s.activeProfileId);
+  const profileId = useAuthStore((s) => s.activeProfileId);

   const getKey = (pageIndex: number, prev: PaginatedKarteByTargetResponse | null): string | null => {
-    if (!userId || !targetProfileId) return null;
+    if (!profileId || !targetProfileId) return null;
     if (prev && !prev.hasMore) return null;
     const base = `/api/karte/by-target?profile_id=${encodeURIComponent(targetProfileId)}`;
     const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
diff --git a/dystopia/frontend/src/modules/karte/hooks/useMyKarte.ts b/dystopia/frontend/src/modules/karte/hooks/useMyKarte.ts
index 773f37b1..a73db021 100644
--- a/dystopia/frontend/src/modules/karte/hooks/useMyKarte.ts
+++ b/dystopia/frontend/src/modules/karte/hooks/useMyKarte.ts
@@ -6,10 +6,10 @@ import { useAuthStore } from "@/stores/authStore";
 import type { PaginatedKarteMyResponse } from "../types";

 export function useMyKarte() {
-  const userId = useAuthStore((s) => s.activeProfileId);
+  const profileId = useAuthStore((s) => s.activeProfileId);

   const getKey = (pageIndex: number, prev: PaginatedKarteMyResponse | null): string | null => {
-    if (!userId) return null;
+    if (!profileId) return null;
     if (prev && !prev.hasMore) return null;
     const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
     return `/api/karte/my${cursorQs}`;
diff --git a/dystopia/frontend/src/modules/karte/hooks/useMyKarteAccess.ts b/dystopia/frontend/src/modules/karte/hooks/useMyKarteAccess.ts
index f4858193..e4ba5172 100644
--- a/dystopia/frontend/src/modules/karte/hooks/useMyKarteAccess.ts
+++ b/dystopia/frontend/src/modules/karte/hooks/useMyKarteAccess.ts
@@ -11,10 +11,10 @@ export function hasKarteAccess(role: string | null, data: KarteAccess | undefine
 }

 export function useMyKarteAccess() {
-  const userId = useAuthStore((s) => s.activeProfileId);
+  const profileId = useAuthStore((s) => s.activeProfileId);
   const role = useAuthStore(selectRole);
   const { data, error, isLoading } = useSWR<KarteAccess>(
-    userId ? "/api/karte/access" : null,
+    profileId ? "/api/karte/access" : null,
     fetcher,
     { revalidateOnFocus: false, dedupingInterval: 60_000 }
   );
diff --git a/dystopia/frontend/src/modules/karte/hooks/useRecentKarte.ts b/dystopia/frontend/src/modules/karte/hooks/useRecentKarte.ts
index 15b49f8c..85974175 100644
--- a/dystopia/frontend/src/modules/karte/hooks/useRecentKarte.ts
+++ b/dystopia/frontend/src/modules/karte/hooks/useRecentKarte.ts
@@ -6,10 +6,10 @@ import { useAuthStore } from "@/stores/authStore";
 import type { PaginatedKarteRecentResponse } from "../types";

 export function useRecentKarte(enabled: boolean) {
-  const userId = useAuthStore((s) => s.activeProfileId);
+  const profileId = useAuthStore((s) => s.activeProfileId);

   const getKey = (pageIndex: number, prev: PaginatedKarteRecentResponse | null): string | null => {
-    if (!enabled || !userId) return null;
+    if (!enabled || !profileId) return null;
     if (prev && !prev.hasMore) return null;
     const cursorQs = pageIndex === 0 ? "" : `?cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
     return `/api/karte/recent${cursorQs}`;
diff --git a/dystopia/frontend/src/modules/profile/components/ProfileManager.tsx b/dystopia/frontend/src/modules/profile/components/ProfileManager.tsx
new file mode 100644
index 00000000..92dae72e
--- /dev/null
+++ b/dystopia/frontend/src/modules/profile/components/ProfileManager.tsx
@@ -0,0 +1,152 @@
+"use client";
+
+import { useState } from "react";
+import * as Dialog from "@radix-ui/react-dialog";
+import { Avatar } from "@/components/ui/avatar";
+import { Button } from "@/components/ui/button";
+import { authFetch } from "@/lib/auth/fetch";
+import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
+import { useAccountProfiles } from "@/modules/profile/context/AccountProfilesContext";
+import { ProfileNameForm } from "@/modules/profile/components/ProfileNameForm";
+import type { ProfileView } from "@/modules/profile/types";
+
+interface ProfileResponse {
+  profile: ProfileView;
+}
+
+export function ProfileManager() {
+  const activeProfileId = useAuthStore(selectActiveProfileId);
+  const { profiles, switchProfile, refresh } = useAccountProfiles();
+  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
+  const [deleteTarget, setDeleteTarget] = useState<ProfileView | null>(null);
+  const [adding, setAdding] = useState(false);
+  const [error, setError] = useState<string | null>(null);
+
+  const change = async (profileId: string, request: () => Promise<unknown>) => {
+    setError(null);
+    setPendingProfileId(profileId);
+    try {
+      await request();
+      await refresh();
+    } catch (err) {
+      setError(err instanceof Error ? err.message : "変更に失敗しました");
+    } finally {
+      setPendingProfileId(null);
+    }
+  };
+
+  const disable = (profile: ProfileView) =>
+    change(profile.id, () => authFetch(`/api/profile/${encodeURIComponent(profile.id)}/disable`, { method: "POST" }));
+  const enable = (profile: ProfileView) =>
+    change(profile.id, () => authFetch(`/api/profile/${encodeURIComponent(profile.id)}/enable`, { method: "POST" }));
+  const remove = async (profile: ProfileView) => {
+    await change(profile.id, () => authFetch(`/api/profile/${encodeURIComponent(profile.id)}`, { method: "DELETE" }));
+    setDeleteTarget(null);
+  };
+
+  return (
+    <section className="py-4">
+      <h2 className="text-base font-medium text-text-primary">プロフィール</h2>
+      <p className="mt-1 text-sm text-text-secondary">
+        プロフィールは互いに別人として表示されます。無効にしたプロフィールは他の人から見えなくなり、いつでも有効に戻せます。
+      </p>
+
+      <ul className="mt-4 divide-y divide-border border-y border-border">
+        {profiles.map((profile) => {
+          const isActive = profile.id === activeProfileId;
+          const isPending = pendingProfileId === profile.id;
+          return (
+            <li key={profile.id} className="flex flex-wrap items-center gap-3 py-3">
+              <Avatar src={profile.avatarUrl || undefined} fallback={(profile.displayName || "?").slice(0, 1)} size="md" />
+              <div className="min-w-0 flex-1">
+                <p className="truncate text-sm font-bold text-text-primary">{profile.displayName || "—"}</p>
+                <p className="truncate text-xs text-text-secondary">
+                  @{profile.username || "—"}
+                  {isActive && <span className="ml-2 text-accent">使用中</span>}
+                  {profile.disabled && <span className="ml-2">無効</span>}
+                </p>
+              </div>
+              {!profile.disabled && !isActive && (
+                <>
+                  <Button type="button" size="sm" disabled={isPending} onClick={() => switchProfile(profile.id)}>
+                    切り替える
+                  </Button>
+                  <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={() => disable(profile)}>
+                    無効にする
+                  </Button>
+                </>
+              )}
+              {profile.disabled && (
+                <>
+                  <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={() => enable(profile)}>
+                    有効にする
+                  </Button>
+                  <button
+                    type="button"
+                    disabled={isPending}
+                    onClick={() => setDeleteTarget(profile)}
+                    className="h-9 rounded-full border border-red-600 px-4 text-sm font-bold text-red-600 disabled:opacity-50"
+                  >
+                    削除する
+                  </button>
+                </>
+              )}
+            </li>
+          );
+        })}
+      </ul>
+      <p className="mt-2 text-xs text-text-secondary">使用中のプロフィールを無効にするには、先に別のプロフィールへ切り替えてください。</p>
+
+      {error && (
+        <p role="alert" className="mt-3 text-sm text-error">
+          {error}
+        </p>
+      )}
+
+      <div className="mt-6">
+        {adding ? (
+          <ProfileNameForm
+            submitLabel="追加して切り替える"
+            onSubmit={async (payload) => {
+              const res = await authFetch<ProfileResponse>("/api/profile", { method: "POST", body: payload });
+              // Refresh the list first; switching to a profile the cached list lacks resolves back to the picker.
+              await refresh();
+              switchProfile(res.profile.id);
+            }}
+          />
+        ) : (
+          <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
+            プロフィールを追加
+          </Button>
+        )}
+      </div>
+
+      <Dialog.Root open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
+        <Dialog.Portal>
+          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
+          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-4">
+            <Dialog.Title className="text-base font-bold text-text-primary">
+              @{deleteTarget?.username} を削除しますか？
+            </Dialog.Title>
+            <Dialog.Description className="mt-2 text-sm text-text-secondary">
+              このプロフィールの投稿・コメント・フォロー・メッセージ・レビューが削除され、元に戻せません。カルテの記録は残ります。
+            </Dialog.Description>
+            <div className="mt-4 flex justify-end gap-2">
+              <Dialog.Close asChild>
+                <Button variant="secondary" size="sm">キャンセル</Button>
+              </Dialog.Close>
+              <button
+                type="button"
+                disabled={pendingProfileId !== null}
+                onClick={() => deleteTarget && remove(deleteTarget)}
+                className="h-9 rounded-full bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50"
+              >
+                削除する
+              </button>
+            </div>
+          </Dialog.Content>
+        </Dialog.Portal>
+      </Dialog.Root>
+    </section>
+  );
+}
diff --git a/dystopia/frontend/src/modules/profile/components/ProfileNameForm.tsx b/dystopia/frontend/src/modules/profile/components/ProfileNameForm.tsx
new file mode 100644
index 00000000..4136b92f
--- /dev/null
+++ b/dystopia/frontend/src/modules/profile/components/ProfileNameForm.tsx
@@ -0,0 +1,95 @@
+"use client";
+
+import { useState } from "react";
+import { Input } from "@/components/ui/input";
+import { Button } from "@/components/ui/button";
+import type { CreateProfilePayload } from "@/modules/profile/types";
+
+export interface ProfileNameFormProps {
+  submitLabel: string;
+  onSubmit: (payload: Required<CreateProfilePayload>) => Promise<void>;
+}
+
+export function ProfileNameForm({ submitLabel, onSubmit }: ProfileNameFormProps) {
+  const [displayName, setDisplayName] = useState("");
+  const [username, setUsername] = useState("");
+  const [error, setError] = useState<string | null>(null);
+  const [submitting, setSubmitting] = useState(false);
+
+  const handleSubmit = async (e: React.FormEvent) => {
+    e.preventDefault();
+    setError(null);
+    setSubmitting(true);
+    try {
+      await onSubmit({ displayName, username });
+    } catch (err) {
+      setError(err instanceof Error ? err.message : "プロフィールの保存に失敗しました");
+    } finally {
+      setSubmitting(false);
+    }
+  };
+
+  return (
+    <form onSubmit={handleSubmit} className="space-y-4">
+      <div className="space-y-1">
+        <label
+          htmlFor="displayName"
+          className="text-sm font-medium text-text-primary"
+        >
+          表示名
+          <span className="ml-0.5 text-error">*</span>
+        </label>
+        <Input
+          id="displayName"
+          type="text"
+          placeholder="例：さくら"
+          value={displayName}
+          onChange={(e) => setDisplayName(e.target.value)}
+          required
+          autoComplete="name"
+          maxLength={50}
+        />
+      </div>
+
+      <div className="space-y-1">
+        <label
+          htmlFor="username"
+          className="text-sm font-medium text-text-primary"
+        >
+          ユーザー名
+          <span className="ml-0.5 text-error">*</span>
+        </label>
+        <div className="relative">
+          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted select-none">
+            @
+          </span>
+          <Input
+            id="username"
+            type="text"
+            placeholder="username"
+            value={username}
+            onChange={(e) => setUsername(e.target.value)}
+            required
+            autoComplete="username"
+            maxLength={30}
+            pattern="[a-zA-Z0-9_]+"
+            className="pl-8"
+          />
+        </div>
+        <p className="text-xs text-text-muted">
+          英数字とアンダースコアのみ使用できます。
+        </p>
+      </div>
+
+      {error && (
+        <p role="alert" className="text-sm text-error">
+          {error}
+        </p>
+      )}
+
+      <Button type="submit" className="w-full" disabled={submitting}>
+        {submitting ? "保存中…" : submitLabel}
+      </Button>
+    </form>
+  );
+}
diff --git a/dystopia/frontend/src/modules/profile/hooks/usePublicProfile.ts b/dystopia/frontend/src/modules/profile/hooks/usePublicProfile.ts
index 1588cdd9..d9d485fd 100644
--- a/dystopia/frontend/src/modules/profile/hooks/usePublicProfile.ts
+++ b/dystopia/frontend/src/modules/profile/hooks/usePublicProfile.ts
@@ -10,9 +10,9 @@ interface ProfileResponse {
 }

 export function usePublicProfile(username: string | null) {
-  const userId = useAuthStore((s) => s.activeProfileId);
+  const profileId = useAuthStore((s) => s.activeProfileId);
   const { data, error, isLoading, mutate } = useSWR<ProfileResponse>(
-    userId && username ? `/api/profile/by-username/${encodeURIComponent(username)}` : null,
+    profileId && username ? `/api/profile/by-username/${encodeURIComponent(username)}` : null,
     fetcher,
     { revalidateOnFocus: false }
   );
diff --git a/dystopia/frontend/src/modules/social/hooks/useBlockedList.ts b/dystopia/frontend/src/modules/social/hooks/useBlockedList.ts
index fa4d1e78..f4b410bc 100644
--- a/dystopia/frontend/src/modules/social/hooks/useBlockedList.ts
+++ b/dystopia/frontend/src/modules/social/hooks/useBlockedList.ts
@@ -6,9 +6,9 @@ import { useAuthStore } from "@/stores/authStore";
 import type { PaginatedProfilesResponse } from "../types";

 export function useBlockedList() {
-  const userId = useAuthStore((s) => s.activeProfileId);
+  const profileId = useAuthStore((s) => s.activeProfileId);
   const { data, error, isLoading, mutate } = useSWR<PaginatedProfilesResponse>(
-    userId ? "/api/social/blocks" : null,
+    profileId ? "/api/social/blocks" : null,
     fetcher,
     { revalidateOnFocus: false }
   );
diff --git a/dystopia/frontend/src/modules/social/hooks/useFollowList.ts b/dystopia/frontend/src/modules/social/hooks/useFollowList.ts
index f23bece8..3e35ca8a 100644
--- a/dystopia/frontend/src/modules/social/hooks/useFollowList.ts
+++ b/dystopia/frontend/src/modules/social/hooks/useFollowList.ts
@@ -6,10 +6,10 @@ import { useAuthStore } from "@/stores/authStore";
 import type { PaginatedProfilesResponse } from "../types";

 export function useFollowList(profileId?: string) {
-  const userId = useAuthStore((s) => s.activeProfileId);
+  const activeProfileId = useAuthStore((s) => s.activeProfileId);

   const getKey = (pageIndex: number, prev: PaginatedProfilesResponse | null): string | null => {
-    if (!userId) return null;
+    if (!activeProfileId) return null;
     if (prev && !prev.hasMore) return null;
     const profileQs = profileId ? `profile_id=${encodeURIComponent(profileId)}` : "";
     const cursorQs = pageIndex === 0 ? "" : `cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
diff --git a/dystopia/frontend/src/modules/social/hooks/useFollowRequests.ts b/dystopia/frontend/src/modules/social/hooks/useFollowRequests.ts
index 3c4452be..59cec054 100644
--- a/dystopia/frontend/src/modules/social/hooks/useFollowRequests.ts
+++ b/dystopia/frontend/src/modules/social/hooks/useFollowRequests.ts
@@ -16,16 +16,16 @@ interface ListResponse {
 interface CountResponse { count: number }

 export function useFollowRequests() {
-  const userId = useAuthStore((s) => s.activeProfileId);
+  const profileId = useAuthStore((s) => s.activeProfileId);

   const { data: list, error: listError, isLoading, mutate: mutateList } = useSWR<ListResponse>(
-    userId ? "/api/social/follow/requests" : null,
+    profileId ? "/api/social/follow/requests" : null,
     fetcher,
     { revalidateOnFocus: false, dedupingInterval: 5000 }
   );

   const { data: countData, mutate: mutateCount } = useSWR<CountResponse>(
-    userId ? "/api/social/follow/requests/count" : null,
+    profileId ? "/api/social/follow/requests/count" : null,
     fetcher,
     { revalidateOnFocus: false, dedupingInterval: 10000 }
   );
diff --git a/dystopia/frontend/src/modules/social/hooks/useFollowerList.ts b/dystopia/frontend/src/modules/social/hooks/useFollowerList.ts
index 056e6180..5d000877 100644
--- a/dystopia/frontend/src/modules/social/hooks/useFollowerList.ts
+++ b/dystopia/frontend/src/modules/social/hooks/useFollowerList.ts
@@ -6,10 +6,10 @@ import { useAuthStore } from "@/stores/authStore";
 import type { PaginatedProfilesResponse } from "../types";

 export function useFollowerList(profileId?: string) {
-  const userId = useAuthStore((s) => s.activeProfileId);
+  const activeProfileId = useAuthStore((s) => s.activeProfileId);

   const getKey = (pageIndex: number, prev: PaginatedProfilesResponse | null): string | null => {
-    if (!userId) return null;
+    if (!activeProfileId) return null;
     if (prev && !prev.hasMore) return null;
     const profileQs = profileId ? `profile_id=${encodeURIComponent(profileId)}` : "";
     const cursorQs = pageIndex === 0 ? "" : `cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
diff --git a/dystopia/frontend/src/modules/social/hooks/useSocialCounts.ts b/dystopia/frontend/src/modules/social/hooks/useSocialCounts.ts
index cfa32440..477c9538 100644
--- a/dystopia/frontend/src/modules/social/hooks/useSocialCounts.ts
+++ b/dystopia/frontend/src/modules/social/hooks/useSocialCounts.ts
@@ -6,10 +6,10 @@ import { useAuthStore } from "@/stores/authStore";
 import type { SocialCounts } from "../types";

 export function useSocialCounts(profileId?: string) {
-  const userId = useAuthStore((s) => s.activeProfileId);
+  const activeProfileId = useAuthStore((s) => s.activeProfileId);
   const qs = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
   const { data, error, isLoading, mutate } = useSWR<SocialCounts>(
-    userId ? `/api/social/counts${qs}` : null,
+    activeProfileId ? `/api/social/counts${qs}` : null,
     fetcher,
     { revalidateOnFocus: false }
   );
```

Run(root): `git status --short | wc -l`
Expected: `18`

Run(`dystopia/frontend`): `/usr/bin/grep -rn 'const userId = useAuthStore' src | wc -l`
Expected: `0`

- [ ] **Step 3: 通ることを確認する**

Run(`dystopia/frontend`): `env -u NODE_OPTIONS pnpm exec vitest run src/app/settings src/modules/profile src/modules/karte > /tmp/vitest-p9-t3-green.txt 2>&1; /usr/bin/grep -E '^ *(Test Files|Tests) ' /tmp/vitest-p9-t3-green.txt`
Expected:
```
 Test Files  14 passed (14)
      Tests  63 passed (63)
```

Run: `env -u NODE_OPTIONS pnpm exec vitest run > /tmp/vitest-p9-t3-full.txt 2>&1; /usr/bin/grep -E '^ *(Test Files|Tests) ' /tmp/vitest-p9-t3-full.txt`
Expected:
```
 Test Files  103 passed (103)
      Tests  389 passed (389)
```

Run: `env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "exit $?"`
Expected: `exit 0`

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add -A dystopia/frontend && git status --short && git commit -s -m "feat(dystopia/frontend): manage profiles from settings" && cd dystopia/frontend
```

---

## Controller verification (not dispatched)

Task 3 の後、controller が実サーバーを起動して、spec の Testing strategy の最後の項目(人格 2 つでの実機確認: 投稿・DM・切替・無効化・削除)を行う。使い捨ての database に migrate と seed、`bin/grpc` と `next dev`、ブラウザは puppeteer(幅 1280 と 390)。dry run では次の 28 項目がすべて通った。Codex の commit でも同じ手順をやり直す。

- cast でログインすると唯一の人格で始まり、切替の表示は出ない。設定画面に「プロフィール」タブがある。
- 人格を追加すると、その人格に切り替わってトップへ移る。ナビゲーションは新しい人格を現在の人格として表示し、元の人格を切替先に出す。
- 追加した人格で投稿すると、投稿の著者はその人格になる。別の account からその人格のページと投稿が見え、フォローと DM ができる。
- 追加した人格の DM 一覧には届いた message が出る。元の人格に切り替えると、トップへ移り、DM 一覧にその会話は出ず、通知の一覧も別になる。
- 設定から無効化すると、行に「無効」が付き、切替先から消え、別の account からはページが「見つかりません」になる。有効に戻すと見えるようになる。
- 削除は確認を挟む。確認には消えるものと残るもの(カルテ)が書かれている。確認の後、人格と投稿が消え、元の人格はそのまま使用中である。
- 有効な人格が 2 つで選択が保存されていない状態で開くと選択画面が出る。選ぶと、開こうとしたページのままその人格で表示される。再読み込みしても選択は保たれる。
- guest の設定画面には「プロフィール」タブが無い。
- BFF が返した 4xx は、無効な人格のページを別の account が開いたときの 404 だけだった。

## Known gaps left for later plans

- 複数の人格を持つ account は、ログインのたびに選択画面が出る(Decisions 参照)。
- 使用中の人格は UI から無効化できない(Decisions 参照)。
- 中間キャッシュ(CDN 等)が `x-profile-id` を無視して応答を使い回す構成だと、ある人格の応答が別の人格に返る。BFF の route は `cache: "no-store"` で呼ばれているが、配信経路の設定は確認していない。
- 人格ごとの cache の中で、`swr` から直接 import した `mutate` を人格単位の key に使うと、何も起きずに終わる(Global Constraints 参照)。静的な検査は足していない。
- `KarteEntryCard` の注記は、store の値を使うので server 側の描画では常に出る。カルテの一覧は client で取得してから描画するので、表示がずれることは無い。
- `src/modules/identity/types.ts` の `AuthState.userId` は使われていない型で、そのまま残っている。
- P1a〜P8b の Known gaps はそのまま残る。
