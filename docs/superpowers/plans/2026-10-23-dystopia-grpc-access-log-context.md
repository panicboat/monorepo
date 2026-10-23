# gRPC Access Log Request Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** gRPC のアクセスログに、そのリクエストの `request_id`・`account_id`・`profile_id` を記録する（issue #1677）。

**Architecture:** gruf 2.22.0 は先に登録した interceptor を外側にして実行する（`Gruf::Interceptors::Context#intercept!` が配列の先頭から `call` する）。`bin/grpc` は `AccessLogInterceptor` → `AuthenticationInterceptor` の順に登録しているため、内側の `AuthenticationInterceptor` が `ensure` で `::Current.clear` した後に、外側の `AccessLogInterceptor` が `::Current` を読んで null を記録している。登録順は変えず、`AuthenticationInterceptor` が解決した値を `request.context` にも置き、`AccessLogInterceptor` はそこから読む。登録順を入れ替える案は、`AuthenticationInterceptor` の中で起きた例外（profile 解決時の DB エラーなど）がアクセスログに残らなくなるので採らない。

**Tech Stack:** Ruby 3.4 / Hanami 2 / gruf 2.22.0 / RSpec

**Spec:** issue #1677（https://github.com/panicboat/monorepo/issues/1677）

## Global Constraints

- 作業ディレクトリは `dystopia/monolith`。rspec は `HANAMI_ENV=test rbenv exec bundle exec rspec <path> > <scratchpad>/rspec.log 2>&1` で実行し、ログファイルを読む
- `request.context` は gruf の `ActiveSupport::HashWithIndifferentAccess`。キーは symbol で書く（既存の `request.context[:request_id]` に合わせる）
- `bin/grpc` の interceptor の登録順は変えない
- コードコメントは英語で 1 行。タスクや issue への言及を書かない
- commit は `git commit -s`。`Co-Authored-By` を付けない

## Review Focus

- `AuthenticationInterceptor` の中で例外が起きたとき（profile 解決の DB エラー）: `AccessLogInterceptor` は ERROR のログを書き、その時点で分かっている `request_id`・`account_id` を記録する → Task 1 のテスト「logs the error raised while resolving the profile」
- `x-user-id` がないリクエスト: `account_id`・`profile_id` は null、`request_id` は記録される → Task 1 のテスト
- `x-profile-id` が他人のプロフィールで拒否されたとき: `profile_id` は null（`Current.profile_id` と同じ値）→ 既存の `resolve_profile_id` が nil を返す挙動をそのまま `request.context` に置くので追加テストなし

---

### Task 1: Record the request context in the access log

**Files:**
- Modify: `dystopia/monolith/lib/interceptors/authentication_interceptor.rb`
- Modify: `dystopia/monolith/lib/interceptors/access_log_interceptor.rb`
- Modify: `dystopia/monolith/spec/lib/interceptors/access_log_interceptor_spec.rb`
- Create: `dystopia/monolith/spec/lib/interceptors/interceptor_chain_spec.rb`

**Interfaces:**
- Produces: `AuthenticationInterceptor#call` が `request.context[:request_id]`・`request.context[:account_id]`・`request.context[:profile_id]` を設定する（`x-user-id` がなければ後 2 つは設定しない）。`AccessLogInterceptor` はこの 3 キーだけを読み、`::Current` は読まない

- [ ] **Step 1: Write the failing chain spec**

`spec/lib/interceptors/interceptor_chain_spec.rb` を `type: :database` で作る。`bin/grpc` と同じ順で `Gruf::Interceptors::Context.new([Interceptors::AccessLogInterceptor.new(request, error), Interceptors::AuthenticationInterceptor.new(request, error)]).intercept! { ... }` を実行する。`request` は `double(:request, metadata: metadata, context: ActiveSupport::HashWithIndifferentAccess.new, method_key: :get_profile, service_key: :profile)`。`Hanami.logger` は `info`・`error` を受ける double にする。テストデータは `authentication_interceptor_spec.rb` と同じく `create_account(role: 2)` と `create_account_with_profile(account_id:)` を使う。

テスト:
- `logs the request id, the account and the profile of a successful request`: metadata `{"x-request-id" => "req-1", "x-user-id" => account_id}`（プロフィール 1 つ）→ info のログの `request_id == "req-1"`・`account_id == account_id`・`profile_id == profile_id`・`status == "OK"`
- `logs the request context when the handler raises`: 同じ metadata、block で `raise GRPC::NotFound` → error のログの 3 項目が同じ値、`error_class == "GRPC::NotFound"`、例外は呼び出し元に再送出される
- `logs the request id without an account for an anonymous request`: metadata `{"x-request-id" => "req-2"}` → `request_id == "req-2"`、`account_id`・`profile_id` は nil
- `logs the error raised while resolving the profile`: metadata `{"x-request-id" => "req-3", "x-user-id" => account_id, "x-profile-id" => "p"}`、`Profile::Slice["repositories.profile_repository"]` の `find_visible_by_id` を `raise "db down"` に stub → error のログの `request_id == "req-3"`・`account_id == account_id`・`error == "db down"`

- [ ] **Step 2: Run the chain spec to verify it fails**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/lib/interceptors/interceptor_chain_spec.rb`
Expected: 1〜3 番目が FAIL（`request_id`・`account_id`・`profile_id` が nil）

- [ ] **Step 3: Set the context in `AuthenticationInterceptor#call` and read it in `AccessLogInterceptor#call`**

`AuthenticationInterceptor` は `::Current.account_id` を設定する箇所で `request.context[:account_id]` を、`::Current.profile_id` を設定する箇所で同じ値を `request.context[:profile_id]` に置く。`AccessLogInterceptor` の成功時・失敗時の 2 つの log_entry は `request.context[:request_id]`・`[:account_id]`・`[:profile_id]` を使う。`AccessLogInterceptor` に「`::Current` は内側の interceptor が ensure で消すので読まない」旨の 1 行コメントを置く。

- [ ] **Step 4: Update `access_log_interceptor_spec.rb`**

`request` の double に `context:` を持たせ、`::Current` を設定している `before` を `request.context` への設定に置き換える。`after { ::Current.clear }` は削除する。アサーションの値は変えない。

- [ ] **Step 5: Run the interceptor specs to verify they pass**

Run: `HANAMI_ENV=test rbenv exec bundle exec rspec spec/lib/interceptors`
Expected: 全件 PASS

- [ ] **Step 6: Commit**

```bash
git add dystopia/monolith/lib/interceptors dystopia/monolith/spec/lib/interceptors
git commit -s -m "fix(dystopia/monolith): record the request context in the gRPC access log"
```
