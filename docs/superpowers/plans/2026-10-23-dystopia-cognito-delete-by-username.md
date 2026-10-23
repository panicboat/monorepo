# Cognito Delete By Username Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 退会したアカウントの purge で、Cognito のユーザーを確実に消す。見つからないことを成功として扱うのは、その `sub` のユーザーが本当にいないときだけにする（issue #1674）。

**Architecture:** user pool は Username に電話番号の SHA-256 を使い、電話番号を alias にしている（`alias_attributes = ["phone_number"]`）。`AdminDeleteUser` の `Username` に `sub` が通るかは、alias を使う pool では保証されない。`Cognito::AwsAdapter#admin_delete_user(sub:)` は、まず `ListUsers` を `filter: "sub = \"<sub>\""`・`limit: 1` で呼んで Username を引き、その Username で `AdminDeleteUser` を呼ぶ。`ListUsers` が 0 件ならユーザーはいないので `true` を返す。この形なら `sub` が `Username` として通るかどうかに依存しないので、AWS 上の挙動を確かめる必要がない。Lambda の IAM に `cognito-idp:ListUsers` を足す。EKS 向けの `dystopia/infrastructure` は変更しない（EKS 向けの資産はそのまま残す方針）。EKS に戻すときに同じ権限が要ることは PR description に書く。

**Tech Stack:** Ruby 3.4 / aws-sdk-cognitoidentityprovider 1.157.0 / RSpec / OpenTofu 1.12.6

**Spec:** issue #1674（https://github.com/panicboat/monorepo/issues/1674）

## Global Constraints

- rspec は `dystopia/monolith` で `HANAMI_ENV=test rbenv exec bundle exec rspec <path> > <scratchpad>/rspec.log 2>&1` を実行し、ログファイルを読む
- `ListUsers` の filter は `sub = "<sub>"`（ダブルクォートで囲む）、`limit: 1`
- `sub` が UUID 形式でない値なら、`ListUsers` を呼ばずに `ArgumentError` を raise する（filter 文字列への値の埋め込みを UUID に限る）
- `Cognito.admin_delete_user(sub:)` の呼び出し側の signature は変えない
- コードコメントは英語で 1 行。タスクや issue への言及を書かない
- commit は `git commit -s`。`Co-Authored-By` を付けない

## Review Focus

- `ListUsers` が 0 件: `AdminDeleteUser` を呼ばずに `true` → Task 1 のテスト
- `ListUsers` で見つかった直後に別の実行が消した（`AdminDeleteUser` が `UserNotFoundException`）: ユーザーはいないので `true` → Task 1 のテスト
- `ListUsers` 自体が失敗した（権限不足 `AccessDeniedException` など）: 例外がそのまま上がり、`PurgeIdentity` は `account_repo.delete` まで進まない → Task 1 のテスト
- `sub` に `"` を含む値: `ArgumentError`、`ListUsers` は呼ばない → Task 1 のテスト

---

### Task 1: Delete the Cognito user by the username looked up from sub

**Files:**
- Modify: `dystopia/monolith/lib/cognito/aws_adapter.rb`
- Create: `dystopia/monolith/spec/lib/cognito/aws_adapter_spec.rb`
- Modify: `dystopia/lambda/aws/modules/lambda.tf`（`aws_iam_role_policy.lambda_app` の Cognito の Action に `"cognito-idp:ListUsers"` を足す）

**Interfaces:**
- Consumes: なし
- Produces: `Cognito::AwsAdapter#admin_delete_user(sub:) -> true`。`AwsAdapter.new(client:, user_pool_id:)` の signature は変えない

- [ ] **Step 1: Write the failing spec**

`spec/lib/cognito/aws_adapter_spec.rb`。`require "cognito/aws_adapter"`。client は `Aws::CognitoIdentityProvider::Client.new(stub_responses: true, region: "ap-northeast-1")`、adapter は `described_class.new(client: client, user_pool_id: "pool-1")`。`sub` は `"0199f0a0-0000-7000-8000-000000000001"`。呼ばれた API は `client.api_requests` で確かめる（`operation_name` と `params`）。

- `looks up the username by sub and deletes that user`: `client.stub_responses(:list_users, users: [{ username: "hashed-phone" }])` → 戻り値 `true`、`list_users` の params が `{ user_pool_id: "pool-1", filter: "sub = \"0199f0a0-0000-7000-8000-000000000001\"", limit: 1 }`、`admin_delete_user` の params が `{ user_pool_id: "pool-1", username: "hashed-phone" }`
- `returns true without deleting when no user has the sub`: `list_users` が `users: []` → `true`、`admin_delete_user` は呼ばれない
- `returns true when the user disappears before the delete`: `list_users` が 1 件、`admin_delete_user` が `"UserNotFoundException"` → `true`
- `raises when the lookup fails`: `list_users` が `"AccessDeniedException"` → `Aws::CognitoIdentityProvider::Errors::AccessDeniedException` が上がる
- `rejects a sub that is not a UUID`: `sub: "x\" or sub = \"y"` → `ArgumentError`、`client.api_requests` は空

- [ ] **Step 2: Run the spec to verify it fails**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/lib/cognito/aws_adapter_spec.rb`
Expected: 1・2・5 番目が FAIL（`admin_delete_user` が `sub` を Username にして呼ばれる、`list_users` が呼ばれない）

- [ ] **Step 3: Implement the lookup in `AwsAdapter#admin_delete_user(sub:)`**

UUID の判定は adapter に `SUB_PATTERN = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/` を置いて行う（`Ids.valid?` は `Review`・`Karte` の slice ごとの module で、`lib` からは使えない）。`ListUsers` の結果の `users.first&.username` が nil なら `true` を返す。`UserNotFoundException` の rescue と `# FALLBACK:` コメントは残す。

- [ ] **Step 4: Add `cognito-idp:ListUsers` to the Lambda IAM policy and validate**

Run（`dystopia/lambda/aws/modules` で）: `tofu fmt -check && tofu init -backend=false -input=false > /dev/null && tofu test`
Expected: fmt の差分なし、`tofu test` が全件 pass

- [ ] **Step 5: Run the Cognito and purge specs**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/lib/cognito spec/slices/identity`
Expected: 全件 PASS

- [ ] **Step 6: Commit**

```bash
git add dystopia/monolith/lib/cognito/aws_adapter.rb dystopia/monolith/spec/lib/cognito/aws_adapter_spec.rb dystopia/lambda/aws/modules/lambda.tf
git commit -s -m "fix(dystopia): delete the Cognito user by the username that has the sub"
```
