# Profile P2: monolith slice rename portfolio→profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monolith の `portfolio` スライスを `profile` にリネームする（Ruby module / dir / `Portfolio::Deps` / `Portfolio::Slice` / 内部参照 / specs）。**コードのみ**。テーブル名 `portfolio__*`・proto `portfolio/v1`（service_name/require）・データモデルは不変。

**Architecture:** 純メカニカルリネーム。`Portfolio` module → `Profile` を、**`Portfolio::V1`（proto stub、portfolio/v1 のまま）を除いて**置換。lowercase の `portfolio/v1`・`portfolio.v1.*`・`portfolio__*` は proto/テーブルなので **STAY**。挙動・スキーマ不変で build-green。テーブル統合・proto 実装・portfolio/v1 撤去は P3/P4。

**Tech Stack:** Ruby / Hanami 2（slice はディレクトリ名で auto-register）/ ROM / gruf / RSpec。

**Spec:** `docs/superpowers/specs/2026-06-02-profile-slice-design.md`、前提 P1（`profile/v1` proto 追加済）。

---

## Context for the implementer

- worktree: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice`、`services/monolith/workspace` で作業。branch `feat/profile-slice`。push しない。worktree 内のみ編集。
- **不安定な `grep` 回避**: 検索は `/usr/bin/grep` を使う。
- **絶対に変えてはいけないもの（proto/テーブル、P2 では不変）**:
  - `Portfolio::V1::*`（proto stub。slices 内 6 ファイル: grpc の cast/guest handler、presenters cast/guest 4 つ）
  - lowercase `require "portfolio/v1/..."`、`self.service_name = "portfolio.v1.CastService"`/`"portfolio.v1.GuestService"`
  - relations の `schema(:"portfolio__casts")` 等のテーブル名（8 テーブル）
- Hanami は `slices/<name>/` のディレクトリ名でスライス登録 → dir を `profile` にすれば `Profile` スライス・`Profile::Deps`・`Profile::Slice` が自動で提供される。
- cross-slice adapter（他スライスが portfolio を参照）: `slices/offer/adapters/portfolio_adapter.rb`、`slices/post/adapters/{guest,cast}_adapter.rb`、`slices/feed/adapters/{guest,cast}_adapter.rb`。これらは `Portfolio::Slice["repositories.cast_repository"]` の形で参照 → `Profile::Slice` に変える。**class 名 `PortfolioAdapter` とファイル名は P2 では変えない**（`\bPortfolio\b` は `PortfolioAdapter` にマッチしないので自然に温存される。class rename は cross-slice の caller を壊すため別途）。

## File Structure

- Rename: `slices/portfolio/` → `slices/profile/`、`spec/slices/portfolio/` → `spec/slices/profile/`
- Modify (in-place rename): 上記配下の全 `.rb`（`Portfolio`→`Profile`、`Portfolio::V1` 除く）
- Modify: 5 つの cross-slice adapter（`Portfolio::Slice`→`Profile::Slice`）

---

## Task 1: ディレクトリを git mv

**Files:** slice dir + spec dir。

- [ ] **Step 1: dir を移動**

```bash
cd services/monolith/workspace
git mv slices/portfolio slices/profile
git mv spec/slices/portfolio spec/slices/profile
```

---

## Task 2: スライス内の `Portfolio`→`Profile`（`Portfolio::V1` を除く）

**Files:** `slices/profile/**/*.rb`、`spec/slices/profile/**/*.rb`。

- [ ] **Step 1: perl で一括置換（V1 を保護）**

`Portfolio::V1` を一時 sentinel に退避 → `\bPortfolio\b`→`Profile` → sentinel 復元。これで module/`Portfolio::Deps`/`Portfolio::Slice`/`Portfolio::DB`/`Portfolio::Repositories` 等は `Profile::` になり、`Portfolio::V1` は温存、lowercase `portfolio/...` は不変。

```bash
cd services/monolith/workspace
find slices/profile spec/slices/profile -name '*.rb' -print0 \
  | xargs -0 perl -i -pe 's/Portfolio::V1/__PROTO_V1__/g; s/\bPortfolio\b/Profile/g; s/__PROTO_V1__/Portfolio::V1/g'
```

- [ ] **Step 2: 取りこぼし確認（V1 以外の `Portfolio` が残っていないこと）**

Run: `cd services/monolith/workspace && /usr/bin/grep -rn "\bPortfolio\b" slices/profile spec/slices/profile | /usr/bin/grep -v "Portfolio::V1"`
Expected: 出力なし（`Portfolio::V1` 以外の `Portfolio` 参照が残っていない）。残っていれば手動で `Profile` に直す（ただし `Portfolio::V1` は残す）。

- [ ] **Step 3: proto/テーブルが温存されていること**

Run: `cd services/monolith/workspace && /usr/bin/grep -rn "portfolio.v1\|portfolio/v1\|portfolio__" slices/profile | head`
Expected: `require "portfolio/v1/..."`・`service_name = "portfolio.v1.*"`・`schema(:"portfolio__*")` が**そのまま**残っている（P2 では不変）。

---

## Task 3: cross-slice adapter の `Portfolio::Slice`→`Profile::Slice`

**Files:** `slices/offer/adapters/portfolio_adapter.rb`、`slices/post/adapters/{guest,cast}_adapter.rb`、`slices/feed/adapters/{guest,cast}_adapter.rb`。

- [ ] **Step 1: 同じ保護付き置換を 5 ファイルに**

```bash
cd services/monolith/workspace
perl -i -pe 's/Portfolio::V1/__PROTO_V1__/g; s/\bPortfolio\b/Profile/g; s/__PROTO_V1__/Portfolio::V1/g' \
  slices/offer/adapters/portfolio_adapter.rb \
  slices/post/adapters/guest_adapter.rb slices/post/adapters/cast_adapter.rb \
  slices/feed/adapters/guest_adapter.rb slices/feed/adapters/cast_adapter.rb
```

これで `Portfolio::Slice[...]` → `Profile::Slice[...]`。class 名 `PortfolioAdapter`（`\bPortfolio\b` 非マッチ）と lowercase method 名は温存。

- [ ] **Step 2: 他に slices/profile を参照する箇所が無いか全体確認**

Run: `cd services/monolith/workspace && /usr/bin/grep -rln "Portfolio::Slice\|Portfolio::Repositories\|Portfolio::UseCases\|Portfolio::Grpc\|Portfolio::Presenters" slices lib config app 2>/dev/null | /usr/bin/grep -v "slices/profile/"`
Expected: 出力なし（cross-slice の Portfolio スライス参照が残っていない）。残れば同じ置換で対応。

---

## Task 4: boot + spec で検証してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: 構文チェック**

Run: `cd services/monolith/workspace && find slices/profile -name '*.rb' -print0 | xargs -0 -n1 ruby -c 2>&1 | /usr/bin/grep -v "Syntax OK" | head`
Expected: 出力なし（全ファイル Syntax OK）。

- [ ] **Step 2: app boot（autoload/定数解決の確認）**

Run: `cd services/monolith/workspace && bundle exec ruby -e "require './config/app'; Hanami.app.prepare; puts 'boot ok'" 2>&1 | tail -8`
Expected: `boot ok`（`Profile::Slice` / `Profile::Deps` / `Profile::Grpc::*Handler` が解決。`uninitialized constant Portfolio::...` が出ないこと）。DB 接続エラーが出る場合は DB を起動（`docker compose up -d` 等）してから再実行。gRPC サーバのハンドラ登録は自動発見のため別途不要だが、`uninitialized constant` が出たら登録箇所を探して修正。

- [ ] **Step 3: profile スライスの spec**

Run: `cd services/monolith/workspace && bundle exec rspec spec/slices/profile 2>&1 | tail -6`
Expected: リネーム前の `spec/slices/portfolio` と**同じ結果**（挙動不変。P1 報告どおり pre-existing で 14 失敗があるならそのまま。新規失敗＝リネーム漏れなので直す）。

- [ ] **Step 4: コミット**

```bash
cd services/monolith/workspace
git add -A
git commit -s -m "refactor(profile): rename monolith portfolio slice to profile (code only)"
```

---

## Deferred（P2 では実施しない）

- テーブル/スキーマ `portfolio__*`→`profile__*` リネーム + casts/guests 統合 → **P3**。
- `Portfolio::V1`（portfolio/v1 proto）の `Profile::V1`（profile/v1）への載せ替え + ProfileService 実装 + portfolio/v1 撤去 → **P4**。
- cross-slice adapter の class 名 `PortfolioAdapter`→`ProfileAdapter` は P2 では据え置き（caller を壊すため、各スライス再構築時に）。

## Self-Review（作成者チェック済）

- **rename surface**: slices/portfolio(44 ファイル) + spec + 5 cross-slice adapter。`Portfolio::V1`（6 ファイル）保護、lowercase `portfolio/v1`・`portfolio.v1`・`portfolio__`（proto/テーブル）温存。
- **build-green**: 挙動・スキーマ・proto 不変。Hanami が dir 名で `Profile` スライスを auto-register。
- **Placeholder**: なし。perl コマンドは完全。
- **gotcha 明記**: `\bPortfolio\b` は `PortfolioAdapter` に非マッチ（class 名温存は意図的）。`Portfolio::V1` 保護。lowercase proto/テーブル温存の確認ステップあり。
