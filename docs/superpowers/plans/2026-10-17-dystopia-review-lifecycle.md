# Dystopia Review Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** クチコミ（review）をカルテと同じ「1 回の利用 = 段階ごとの出来事 + 記録中/完了 + 書き手単位の平均」の構造に作り替え、画面の名称を「クチコミ」にする。

**Architecture:** backend は `review` slice をカルテと同じ構成で作り直し、表・catalog・権限・公開の判定はクチコミ専用に持つ。frontend はカルテのドメイン部品をコピーしてクチコミ用に書き換え、意味を持たない UI（星のボタン列・チップ・状態の印）と日付の helper だけを共通化する。3 段の stack（共通 UI → 作り替え → 旧表の drop）で出す。

**Tech Stack:** Hanami 2 + ROM-SQL + gruf（monolith）、protobuf（buf）、Next.js + SWR + connect-es（frontend）、rspec、vitest。

**Spec:** `docs/superpowers/specs/2026-10-17-dystopia-review-lifecycle-design.md`

## Global Constraints

- 画面の文言は「クチコミ」。コード上の識別子・URL は `review` / `/reviews` のまま
- 段階の表示名は「予約・問い合わせ」「利用」「利用後」。対応結果・タグのコードと表示名は spec の表を正とする
- 星は 1〜5（整数）、0 は未評価。完了するときは必須
- 補足は 500 文字まで。補足必須の対応結果は `cast_no_show`・`ended_early`・`trouble_occurred`
- 一覧の件数は既定 20、上限 50
- エラーは、権限なし → `PERMISSION_DENIED`、入力不正・見つからない・状態に合わない → `INVALID_ARGUMENT`
- 見つからないときのメッセージは `Review not found`（frontend の `useReview` がこの文字列でシートを閉じる）
- コードコメントは英語で 1 行、task への言及なし。コメントを追加したら commit 前に自分で diff を読み返す
- commit は `git commit -s`。`Co-Authored-By` は付けない。メッセージの末尾に `Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5` を付ける
- proto のスタブは `review` package の差分だけを commit する（`bin/codegen` と `pnpm proto:gen` は無関係な package にも差分を出す）
- monolith の検証はローカルの rspec（`cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec ... > <scratchpad>/rspec.log 2>&1`）。出力は必ずファイルへ redirect してから `tail` で読む
- frontend の検証は `cd dystopia/frontend && pnpm exec vitest run` と `pnpm exec tsc --noEmit`（`pnpm lint` は ESLint 10 の不具合で使えない）

## Review Focus

1. 停止中のプロフィールが当事者のクチコミ: 一覧・1 件取得・書き手の操作のどれでも「存在しない」と同じに見えること（Task 8・Task 9 の spec で固定）
2. 書き手と同じアカウントの別プロフィールから操作したとき: 自分のクチコミとして操作でき、自分の一覧にも出ること（Task 7 の spec で固定）
3. 自分のアカウントのプロフィールをクチコミの対象にしようとしたとき: `INVALID_ARGUMENT` で拒否すること（Task 7 の spec で固定）
4. 平均評価が公開のルールに左右されないこと: ブロックしている閲覧者にも同じ数字を返すこと（Task 8 の spec で固定）
5. キャストの閲覧者に「このキャストのクチコミを書く」と作成メニューのクチコミが出ないこと（Task 12・Task 13 のテストで固定）

---

## Stage 1: Shared UI (branch `refactor/dystopia-shared-record-ui`)

このブランチは作成済みで、spec の commit が乗っている。作業ディレクトリは `.worktrees/fix-dystopia-reply-render`（stack 用の worktree）。

### Task 1: StarRatingInput

**Files:**
- Create: `dystopia/frontend/src/components/ui/star-rating-input.tsx`
- Create: `dystopia/frontend/src/components/ui/star-rating-input.test.tsx`
- Delete: `dystopia/frontend/src/modules/karte/components/KarteRatingInput.tsx`, `KarteRatingInput.test.tsx`
- Modify: `dystopia/frontend/src/modules/karte/components/KarteEventForm.tsx`, `KarteDetailSheet.tsx`, `dystopia/frontend/src/app/dev/ui/karte/page.tsx`

**Interfaces:**
- Produces: `StarRatingInput({ label: string; value: number | null; onChange: (next: number | null) => void; disabled?: boolean })`

- [ ] **Step 1: Write the failing test** — `src/components/ui/star-rating-input.test.tsx`

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { StarRatingInput } from "./star-rating-input";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(value: number | null, onChange: (next: number | null) => void) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(StarRatingInput, { label: "満足度", value, onChange }));
  });
  return container;
}

const star = (container: HTMLElement, n: number) => container.querySelector(`button[aria-label="${n}つ星"]`) as HTMLButtonElement;

describe("StarRatingInput", () => {
  it("names the group with the given label and chooses the pressed star", async () => {
    const onChange = vi.fn();
    const container = await mount(null, onChange);

    expect(container.querySelector('[role="group"]')?.getAttribute("aria-label")).toBe("満足度");
    star(container, 4).click();

    expect(onChange).toHaveBeenCalledWith(4);
    expect(container.querySelectorAll("button")).toHaveLength(5);
  });

  it("clears the rating when the chosen star is pressed again and marks the chosen one", async () => {
    const onChange = vi.fn();
    const container = await mount(3, onChange);

    expect(star(container, 3).getAttribute("aria-pressed")).toBe("true");
    expect(star(container, 4).getAttribute("aria-pressed")).toBe("false");
    star(container, 3).click();

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dystopia/frontend && pnpm exec vitest run src/components/ui/star-rating-input.test.tsx`
Expected: FAIL（`./star-rating-input` が解決できない）

- [ ] **Step 3: Write the component** — `src/components/ui/star-rating-input.tsx`

```tsx
"use client";

import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

interface StarRatingInputProps {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
}

export function StarRatingInput({ label, value, onChange, disabled }: StarRatingInputProps) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${star}つ星`}
          aria-pressed={value === star}
          onClick={() => onChange(value === star ? null : star)}
          className={cn(
            "flex size-11 items-center justify-center rounded-lg text-2xl disabled:opacity-50",
            value !== null && star <= value ? "text-rating" : "text-text-muted hover:text-text-secondary"
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Replace KarteRatingInput**

```bash
cd dystopia/frontend/src
git rm -q modules/karte/components/KarteRatingInput.tsx modules/karte/components/KarteRatingInput.test.tsx
```

`modules/karte/components/KarteEventForm.tsx`:
- `import { KarteRatingInput } from "./KarteRatingInput";` を `import { StarRatingInput } from "@/components/ui/star-rating-input";` に替える
- `<KarteRatingInput value={rating.value} onChange={rating.onChange} />` を `<StarRatingInput label="予約・接客の信頼性" value={rating.value} onChange={rating.onChange} />` に替える

`modules/karte/components/KarteDetailSheet.tsx`:
- `import { KarteRatingInput } from "./KarteRatingInput";` を `import { StarRatingInput } from "@/components/ui/star-rating-input";` に替える
- `<KarteRatingInput value={karte.rating} disabled={loading} onChange={...} />` の要素名を `StarRatingInput` にし、`label="予約・接客の信頼性"` を足す

`app/dev/ui/karte/page.tsx`:
- import を `StarRatingInput` に替え、見出し `KarteRatingInput` を `StarRatingInput` に、要素を `<StarRatingInput label="予約・接客の信頼性" value={rating} onChange={setRating} />` に替える

- [ ] **Step 5: Run tests**

Run: `cd dystopia/frontend && pnpm exec vitest run src/components/ui src/modules/karte src/app/dev && pnpm exec tsc --noEmit`
Expected: PASS、tsc exit 0

- [ ] **Step 6: Commit**

```bash
git add -A dystopia/frontend/src
git commit -s -m "refactor(dystopia): move the star rating buttons into a shared ui component

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 2: ToggleChip and StatusBadge

**Files:**
- Create: `dystopia/frontend/src/components/ui/toggle-chip.tsx`, `toggle-chip.test.tsx`
- Create: `dystopia/frontend/src/components/ui/status-badge.tsx`, `status-badge.test.tsx`
- Delete: `dystopia/frontend/src/modules/karte/components/KarteStatusBadge.tsx`
- Modify: `dystopia/frontend/src/modules/karte/components/KarteEventForm.tsx`, `KarteCard.tsx`, `KarteDetailSheet.tsx`

**Interfaces:**
- Produces: `ToggleChip({ pressed: boolean; onClick: () => void; children: ReactNode })`、`StatusBadge({ tone: "warning" | "success"; children: ReactNode })`

- [ ] **Step 1: Write the failing tests**

`src/components/ui/toggle-chip.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ToggleChip } from "./toggle-chip";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ToggleChip", () => {
  it("reports whether it is pressed and marks a pressed chip with the accent", () => {
    const pressed = renderToStaticMarkup(<ToggleChip pressed onClick={() => {}}>遅刻あり</ToggleChip>);
    const released = renderToStaticMarkup(<ToggleChip pressed={false} onClick={() => {}}>遅刻あり</ToggleChip>);

    expect(pressed).toContain('aria-pressed="true"');
    expect(pressed).toContain("border-accent");
    expect(released).toContain('aria-pressed="false"');
    expect(released).not.toContain("border-accent ");
  });

  it("is a plain button that calls onClick", async () => {
    const onClick = vi.fn();
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(ToggleChip, { pressed: false, onClick }, "遅刻あり"));
    });

    const button = container.querySelector("button") as HTMLButtonElement;
    expect(button.type).toBe("button");
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

`src/components/ui/status-badge.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("shows the given text in the warning or the success tone", () => {
    const warning = renderToStaticMarkup(<StatusBadge tone="warning">記録中</StatusBadge>);
    const success = renderToStaticMarkup(<StatusBadge tone="success">完了</StatusBadge>);

    expect(warning).toContain("記録中");
    expect(warning).toContain("text-warning");
    expect(success).toContain("完了");
    expect(success).toContain("text-success-text");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dystopia/frontend && pnpm exec vitest run src/components/ui/toggle-chip.test.tsx src/components/ui/status-badge.test.tsx`
Expected: FAIL（モジュールが解決できない）

- [ ] **Step 3: Write the components**

`src/components/ui/toggle-chip.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ToggleChipProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function ToggleChip({ pressed, onClick, children }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm",
        pressed ? "border-accent bg-accent/15 text-text-primary" : "border-border text-text-secondary hover:text-text-primary"
      )}
    >
      {children}
    </button>
  );
}
```

`src/components/ui/status-badge.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  tone: "warning" | "success";
  children: ReactNode;
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-bold",
        tone === "warning" ? "border-warning/50 bg-warning/10 text-warning" : "border-success-text/50 bg-success-text/10 text-success-text"
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Use them in the karte**

```bash
cd dystopia/frontend/src
git rm -q modules/karte/components/KarteStatusBadge.tsx
```

`modules/karte/components/KarteEventForm.tsx`:
- `const CHIP = ...` と `const chipClass = ...` の 3 行を削除し、`cn` の import が他で使われていなければ削除する
- `import { ToggleChip } from "@/components/ui/toggle-chip";` を足す
- 段階のボタンを次に替える

```tsx
          {KARTE_STAGES.map((stage) => (
            <ToggleChip
              key={stage.code}
              pressed={value.stage === stage.code}
              onClick={() => onChange({ ...value, stage: stage.code, outcome: KARTE_OUTCOMES[stage.code][0].code, tags: [] })}
            >
              {stage.label}
            </ToggleChip>
          ))}
```

- タグのボタンを次に替える

```tsx
          {KARTE_TAGS[value.stage].map((tag) => (
            <ToggleChip key={tag.code} pressed={value.tags.includes(tag.code)} onClick={() => toggleTag(tag.code)}>
              {tag.label}
            </ToggleChip>
          ))}
```

`modules/karte/components/KarteCard.tsx` と `KarteDetailSheet.tsx`:
- `import { KarteStatusBadge } from "./KarteStatusBadge";` を `import { StatusBadge } from "@/components/ui/status-badge";` に替える
- `<KarteStatusBadge status={karte.status} />` を `<StatusBadge tone={karte.status === "open" ? "warning" : "success"}>{karte.status === "open" ? "記録中" : "完了"}</StatusBadge>` に替える

- [ ] **Step 5: Run tests**

Run: `cd dystopia/frontend && pnpm exec vitest run src/components/ui src/modules/karte && pnpm exec tsc --noEmit`
Expected: PASS（カルテの既存テストは振る舞いが同じなのでそのまま通る）、tsc exit 0

- [ ] **Step 6: Commit**

```bash
git add -A dystopia/frontend/src
git commit -s -m "refactor(dystopia): move the toggle chip and the status badge into shared ui components

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 3: Japan date helpers and the stage 1 PR

**Files:**
- Move: `dystopia/frontend/src/modules/karte/lib/dates.ts` → `dystopia/frontend/src/lib/utils/japan-date.ts`
- Move: `dystopia/frontend/src/modules/karte/lib/dates.test.ts` → `dystopia/frontend/src/lib/utils/japan-date.test.ts`
- Modify: `KarteEventForm.tsx`, `KarteCard.tsx`, `KarteDetailSheet.tsx` の import

**Interfaces:**
- Produces: `todayInJapan(now?: Date): string`、`formatMonthDay(date: string): string`（`@/lib/utils/japan-date`）

- [ ] **Step 1: Move the files**

```bash
cd dystopia/frontend/src
git mv modules/karte/lib/dates.ts lib/utils/japan-date.ts
git mv modules/karte/lib/dates.test.ts lib/utils/japan-date.test.ts
sed -i '' 's#from "./dates"#from "./japan-date"#' lib/utils/japan-date.test.ts
/usr/bin/grep -rl 'lib/dates"' modules/karte | xargs sed -i '' 's#"\.\./lib/dates"#"@/lib/utils/japan-date"#'
/usr/bin/grep -rn 'lib/dates' modules/karte
```

Expected: 最後の grep が何も出さない

- [ ] **Step 2: Run tests**

Run: `cd dystopia/frontend && pnpm exec vitest run && pnpm exec tsc --noEmit`
Expected: 全件 PASS、tsc exit 0

- [ ] **Step 3: Commit, push and open the PR**

```bash
git add -A dystopia/frontend/src
git commit -s -m "refactor(dystopia): move the japan date helpers out of the karte module

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
git push -u origin HEAD
gh pr create --draft --base feat/dystopia-acting-profile-label \
  --title "refactor(dystopia): share the rating, chip and status ui with the review" \
  --body-file <scratchpad>/pr-stage1.md
gh stack submit --auto
```

`<scratchpad>/pr-stage1.md` には、Why（#1520 でクチコミがカルテの構造を踏襲するが、カルテとクチコミは思想が違うためドメインの部品は分け、意味を持たない UI と日付の helper だけを共有する）、What（3 つの UI 部品と `japan-date` への移動。カルテの振る舞いは変えない）、Verification（実行したコマンドと結果）、末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と session URL を書く。`Closes` は付けない（#1520 は Stage 2 で閉じる）。

---

## Stage 2: Review lifecycle (branch `feat/dystopia-review-lifecycle`)

- [ ] **Step 0: Create the branch**

```bash
gh stack add feat/dystopia-review-lifecycle
```

### Task 4: Tables

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261019000000_create_review_lifecycle_tables.rb`
- Create: `dystopia/monolith/spec/config/db/review_schema_spec.rb`

**Interfaces:**
- Produces: 表 `review.reviews`、`review.events`（列は spec の Database 節）

- [ ] **Step 1: Write the failing spec** — `spec/config/db/review_schema_spec.rb`

```ruby
# frozen_string_literal: true

RSpec.describe "review schema", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  def insert(**attrs)
    db[:review__reviews].insert({
      id: SecureRandom.uuid_v7, author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7,
      target_profile_id: SecureRandom.uuid_v7, status: "open", last_occurred_on: Date.new(2026, 10, 1)
    }.merge(attrs))
  end

  it "holds the lifecycle tables" do
    tables = db[Sequel[:information_schema][:tables]].where(table_schema: "review").select_map(:table_name)

    expect(tables).to include("reviews", "events")
  end

  it "refuses a rating outside 1..5, an unknown status and a closed review without a rating or a closing time" do
    expect { insert(rating: 6) }.to raise_error(Sequel::CheckConstraintViolation)
    expect { insert(status: "draft") }.to raise_error(Sequel::CheckConstraintViolation)
    expect { insert(status: "closed", closed_at: Time.now) }.to raise_error(Sequel::CheckConstraintViolation)
    expect { insert(status: "closed", rating: 3) }.to raise_error(Sequel::CheckConstraintViolation)
    expect { insert(status: "open", rating: 3, closed_at: Time.now) }.to raise_error(Sequel::CheckConstraintViolation)
  end

  it "refuses an unknown stage and removes the events with their review" do
    id = insert
    event = { review_id: id, outcome: "booked", occurred_on: Date.new(2026, 10, 1) }

    expect { db[:review__events].insert(event.merge(id: SecureRandom.uuid_v7, stage: "payment")) }.to raise_error(Sequel::CheckConstraintViolation)
    db[:review__events].insert(event.merge(id: SecureRandom.uuid_v7, stage: "service"))
    db[:review__reviews].where(id: id).delete

    expect(db[:review__events].where(review_id: id).count).to eq(0)
  end
end
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/config/db/review_schema_spec.rb > <scratchpad>/rspec.log 2>&1; tail -20 <scratchpad>/rspec.log`
Expected: FAIL（`review__reviews` がない）

- [ ] **Step 3: Write the migration** — `config/db/migrate/20261019000000_create_review_lifecycle_tables.rb`

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"review__reviews" do
      column :id, :uuid, null: false
      column :author_account_id, :uuid, null: false
      column :author_profile_id, :uuid, null: false
      column :target_profile_id, :uuid, null: false
      column :rating, :smallint
      column :status, :text, null: false
      column :closed_at, :timestamptz
      column :last_activity_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :last_occurred_on, :date, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      constraint :rating_range, "rating BETWEEN 1 AND 5"
      constraint :status_value, "status IN ('open', 'closed')"
      constraint :closed_at_matches_status, "(status = 'closed') = (closed_at IS NOT NULL)"
      constraint :closed_review_rated, "status = 'open' OR rating IS NOT NULL"
    end

    run "CREATE INDEX idx_review_reviews_target_activity ON review.reviews (target_profile_id, last_activity_at DESC, id DESC)"
    run "CREATE INDEX idx_review_reviews_author_profile_activity ON review.reviews (author_profile_id, last_activity_at DESC, id DESC)"
    run "CREATE INDEX idx_review_reviews_author_account_activity ON review.reviews (author_account_id, last_activity_at DESC, id DESC)"
    run "CREATE INDEX idx_review_reviews_occurred ON review.reviews (last_occurred_on DESC, created_at DESC, id DESC)"
    run "CREATE INDEX idx_review_reviews_summary ON review.reviews (target_profile_id, author_profile_id) WHERE status = 'closed'"

    create_table :"review__events" do
      column :id, :uuid, null: false
      column :review_id, :uuid, null: false
      column :stage, :text, null: false
      column :outcome, :text, null: false
      column :tags, "text[]", null: false, default: Sequel.lit("'{}'::text[]")
      column :note, :text
      column :occurred_on, :date, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      foreign_key [:review_id], :"review__reviews", on_delete: :cascade
      constraint :stage_value, "stage IN ('reservation', 'service', 'aftercare')"
    end

    run "CREATE INDEX idx_review_events_review_occurred ON review.events (review_id, occurred_on, created_at)"
  end

  down do
    drop_table :"review__events"
    drop_table :"review__reviews"
  end
end
```

- [ ] **Step 4: Migrate the test DB and run the spec**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate > <scratchpad>/migrate.log 2>&1; HANAMI_ENV=test bundle exec rspec spec/config/db/review_schema_spec.rb > <scratchpad>/rspec.log 2>&1; tail -20 <scratchpad>/rspec.log`
Expected: 3 examples, 0 failures（migrate の後の pg_dump の version mismatch エラーは無視してよい。`structure.sql` は commit しない）

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/config/db/migrate/20261019000000_create_review_lifecycle_tables.rb dystopia/monolith/spec/config/db/review_schema_spec.rb
git commit -s -m "feat(dystopia): add the review lifecycle tables

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 5: Proto

**Files:**
- Modify (rewrite): `proto/dystopia/review/v1/service.proto`
- Regenerate: `dystopia/monolith/stubs/review/v1/*`、`dystopia/frontend/src/stub/review/v1/*`

**Interfaces:**
- Produces: `review.v1.ReviewService` の 13 RPC とメッセージ（下の proto がそのまま定義）

- [ ] **Step 1: Rewrite the proto** — `proto/dystopia/review/v1/service.proto` を次の内容にする

```proto
syntax = "proto3";

package review.v1;

import "google/protobuf/timestamp.proto";

service ReviewService {
  rpc CreateReview(CreateReviewRequest) returns (CreateReviewResponse);
  rpc GetReview(GetReviewRequest) returns (GetReviewResponse);
  rpc UpdateReviewRating(UpdateReviewRatingRequest) returns (UpdateReviewRatingResponse);
  rpc DeleteReview(DeleteReviewRequest) returns (DeleteReviewResponse);
  rpc CloseReview(CloseReviewRequest) returns (CloseReviewResponse);
  rpc ReopenReview(ReopenReviewRequest) returns (ReopenReviewResponse);
  rpc AddReviewEvent(AddReviewEventRequest) returns (AddReviewEventResponse);
  rpc UpdateReviewEvent(UpdateReviewEventRequest) returns (UpdateReviewEventResponse);
  rpc DeleteReviewEvent(DeleteReviewEventRequest) returns (DeleteReviewEventResponse);
  rpc ListReviewsByTarget(ListReviewsByTargetRequest) returns (ListReviewsByTargetResponse);
  rpc ListReviewsByAuthor(ListReviewsByAuthorRequest) returns (ListReviewsByAuthorResponse);
  rpc ListMyReviews(ListMyReviewsRequest) returns (ListMyReviewsResponse);
  rpc ListRecentReviews(ListRecentReviewsRequest) returns (ListRecentReviewsResponse);
}

enum ReviewStatus {
  REVIEW_STATUS_UNSPECIFIED = 0;
  REVIEW_STATUS_OPEN = 1;
  REVIEW_STATUS_CLOSED = 2;
}

enum ReviewStage {
  REVIEW_STAGE_UNSPECIFIED = 0;
  REVIEW_STAGE_RESERVATION = 1;
  REVIEW_STAGE_SERVICE = 2;
  REVIEW_STAGE_AFTERCARE = 3;
}

message ReviewEventInput {
  ReviewStage stage = 1;
  string outcome = 2;
  repeated string tags = 3;
  string note = 4;
  string occurred_on = 5;
}

message ReviewEvent {
  string id = 1;
  ReviewStage stage = 2;
  string outcome = 3;
  repeated string tags = 4;
  string note = 5;
  string occurred_on = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp updated_at = 8;
}

message Review {
  string id = 1;
  string author_profile_id = 2;
  string author_username = 3;
  string author_display_name = 4;
  string author_avatar_url = 5;
  string target_profile_id = 6;
  string target_username = 7;
  string target_display_name = 8;
  string target_avatar_url = 9;
  bool is_mine = 10;
  int32 rating = 11;
  ReviewStatus status = 12;
  repeated ReviewEvent events = 13;
  google.protobuf.Timestamp created_at = 14;
  google.protobuf.Timestamp updated_at = 15;
  google.protobuf.Timestamp closed_at = 16;
  google.protobuf.Timestamp last_activity_at = 17;
}

message RatingSummary {
  double average_rating = 1;
  int32 rater_count = 2;
  int32 review_count = 3;
}

message ReviewCounts {
  int32 total_count = 1;
  int32 open_count = 2;
  int32 closed_count = 3;
}

message CreateReviewRequest {
  string target_profile_id = 1;
  int32 rating = 2;
  ReviewEventInput event = 3;
}
message CreateReviewResponse { Review review = 1; }

message GetReviewRequest { string review_id = 1; }
message GetReviewResponse { Review review = 1; }

message UpdateReviewRatingRequest {
  string review_id = 1;
  int32 rating = 2;
}
message UpdateReviewRatingResponse { Review review = 1; }

message DeleteReviewRequest { string review_id = 1; }
message DeleteReviewResponse {}

message CloseReviewRequest { string review_id = 1; }
message CloseReviewResponse { Review review = 1; }

message ReopenReviewRequest { string review_id = 1; }
message ReopenReviewResponse { Review review = 1; }

message AddReviewEventRequest {
  string review_id = 1;
  ReviewEventInput event = 2;
}
message AddReviewEventResponse { Review review = 1; }

message UpdateReviewEventRequest {
  string event_id = 1;
  ReviewEventInput event = 2;
}
message UpdateReviewEventResponse { Review review = 1; }

message DeleteReviewEventRequest { string event_id = 1; }
message DeleteReviewEventResponse { Review review = 1; }

message ListReviewsByTargetRequest {
  string target_profile_id = 1;
  int32 limit = 2;
  string cursor = 3;
}
message ListReviewsByTargetResponse {
  repeated Review reviews = 1;
  string next_cursor = 2;
  bool has_more = 3;
  RatingSummary summary = 4;
}

message ListReviewsByAuthorRequest {
  string author_profile_id = 1;
  int32 limit = 2;
  string cursor = 3;
}
message ListReviewsByAuthorResponse {
  repeated Review reviews = 1;
  string next_cursor = 2;
  bool has_more = 3;
}

message ListMyReviewsRequest {
  int32 limit = 1;
  string cursor = 2;
}
message ListMyReviewsResponse {
  repeated Review reviews = 1;
  string next_cursor = 2;
  bool has_more = 3;
  ReviewCounts counts = 4;
}

message ListRecentReviewsRequest {
  int32 limit = 1;
  string cursor = 2;
}
message ListRecentReviewsResponse {
  repeated Review reviews = 1;
  string next_cursor = 2;
  bool has_more = 3;
}
```

- [ ] **Step 2: Regenerate and keep only the review stubs**

```bash
cd dystopia/monolith && bin/codegen
cd ../frontend && pnpm proto:gen
cd ../.. && git status --short
```

`git status` に `review` 以外の stub の差分（他 package の変更、`billing` の未追跡ファイル）が出たら、それらを元に戻す。

```bash
git status --short | awk '{print $2}' | /usr/bin/grep -E 'stubs?/' | /usr/bin/grep -v '/review/' | xargs -I{} sh -c 'git checkout -- "{}" 2>/dev/null || rm -rf "{}"'
git status --short
```

Expected: 残る差分は `proto/dystopia/review/v1/service.proto`、`dystopia/monolith/stubs/review/v1/*`、`dystopia/frontend/src/stub/review/v1/*` だけ

- [ ] **Step 3: Commit**

この時点では旧 handler・BFF が旧メッセージを参照しているので、monolith と frontend は壊れている。Task 9・Task 10 で直すまで、次の Task 6〜9 は monolith の spec だけで確かめる。

```bash
git add proto/dystopia/review dystopia/monolith/stubs/review dystopia/frontend/src/stub/review
git commit -s -m "feat(dystopia): reshape the review service around lifecycle reviews

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 6: Catalog, relations and repositories

**Files:**
- Create: `dystopia/monolith/slices/review/catalog.rb`, `errors.rb`, `ids.rb`
- Create: `dystopia/monolith/slices/review/relations/reviews.rb`, `relations/events.rb`
- Create: `dystopia/monolith/slices/review/repositories/review_repository.rb`, `repositories/event_repository.rb`
- Create: `dystopia/monolith/spec/slices/review/repositories/review_repository_spec.rb`

**Interfaces:**
- Produces:
  - `Review::Catalog::STAGES / OUTCOMES / TAGS / NOTE_REQUIRED_OUTCOMES / MAX_NOTE_LENGTH`
  - `Review::Errors::Forbidden`、`Review::Errors::Invalid`、`Review::Ids.valid?(value)`
  - `ReviewRepository#create(author_account_id:, author_profile_id:, target_profile_id:, rating:, occurred_on:)`、`#find(id)`、`#lock(id)`、`#update_rating(id, rating)`、`#close(id)`、`#reopen(id)`、`#record_activity(id)`、`#refresh_last_occurred_on(id)`、`#touch(id)`、`#delete(id)`、`#delete_by_profile(profile_id)`、`#list_by_target(target_profile_id:, limit:, cursor:)`、`#list_by_author_profile(author_profile_id:, limit:, cursor:)`、`#list_by_account(author_account_id:, limit:, cursor:)`、`#list_recent(limit:, cursor:)`、`#cursor_for(review, order:)`、`#counts_by_account(author_account_id:)`、`#rating_summary(target_profile_id:)` → `{ average_rating:, rater_count:, review_count: }`
  - `EventRepository#create(review_id:, stage:, outcome:, tags:, note:, occurred_on:)`、`#find(id)`、`#update(id, ...)`、`#delete(id)`、`#count_for(review_id)`、`#list_for(review_ids)` → `{ review_id => [event, ...] }`

- [ ] **Step 1: Copy the karte files with the name map**

```bash
cd dystopia/monolith/slices
rename() { sed -e 's/Kartes/Reviews/g; s/kartes/reviews/g; s/Karte/Review/g; s/karte/review/g; s/KARTE/REVIEW/g; s/reliability/rating_summary/g' "$1" > "$2"; }
rename karte/errors.rb review/errors.rb
rename karte/ids.rb review/ids.rb
rename karte/relations/kartes.rb review/relations/reviews.rb
rename karte/relations/events.rb review/relations/events.rb
rename karte/repositories/karte_repository.rb review/repositories/review_repository.rb
rename karte/repositories/event_repository.rb review/repositories/event_repository.rb
```

- [ ] **Step 2: Write the catalog** — `review/catalog.rb`

```ruby
# frozen_string_literal: true

module Review
  module Catalog
    STAGES = %w[reservation service aftercare].freeze

    OUTCOMES = {
      "reservation" => %w[inquiry_only booked cancelled_by_cast cast_no_show other],
      "service" => %w[satisfied completed_with_issues ended_early other],
      "aftercare" => %w[closed_without_issues next_booking_inquiry inquiry_handled trouble_occurred trouble_resolved other]
    }.freeze

    TAGS = {
      "reservation" => %w[quick_reply slow_reply clear_conditions condition_mismatch rescheduled polite_response],
      "service" => %w[punctual late as_pictured not_as_pictured attentive unagreed_charge],
      "aftercare" => %w[polite_contact excessive_contact condition_change_request resolved]
    }.freeze

    NOTE_REQUIRED_OUTCOMES = {
      "reservation" => %w[cast_no_show],
      "service" => %w[ended_early],
      "aftercare" => %w[trouble_occurred]
    }.freeze

    MAX_NOTE_LENGTH = 500
  end
end
```

- [ ] **Step 3: Adjust the review repository**

`review/repositories/review_repository.rb` を次のように変える（Step 1 のコピーに対する差分）。

1. `def create(..., occurred_on: nil)` を `def create(author_account_id:, author_profile_id:, target_profile_id:, rating:, occurred_on:)` にし、`attrs[:last_occurred_on] = occurred_on if occurred_on` を `last_occurred_on: occurred_on` として `attrs` のハッシュの中に入れる（新しい表は既定値を持たないため）
2. `def list_by_author(author_account_id:, ...)` を `def list_by_account(author_account_id:, limit:, cursor: nil)` に改名する
3. その下に次を足す

```ruby
      def list_by_author_profile(author_profile_id:, limit:, cursor: nil)
        page_by_activity(review_records.where(author_profile_id: author_profile_id), limit, cursor)
      end
```

4. `def counts_by_author(author_account_id:)` を `def counts_by_account(author_account_id:)` に改名する
5. `def delete(id)` の下に次を足す

```ruby
      def delete_by_profile(profile_id)
        review_records.dataset
          .where(Sequel.|({ author_profile_id: profile_id }, { target_profile_id: profile_id }))
          .delete
      end
```

6. `def rating_summary(target_profile_id:)` の中の `review_count` はコピーで改名済み。戻り値のキーが `average_rating:`・`rater_count:`・`review_count:` になっていることを確かめる

- [ ] **Step 4: Write the repository spec** — `spec/slices/review/repositories/review_repository_spec.rb`

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::Repositories::ReviewRepository, type: :database do
  subject(:repo) { Review::Slice["repositories.review_repository"] }

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:cast) { create_account_with_profile(role: 2, username: "cast_one") }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }

  def write(author_profile: guest, author_account: guest_account, target: cast, rating: nil, status: "open")
    review = repo.create(author_account_id: author_account, author_profile_id: author_profile, target_profile_id: target, rating: rating, occurred_on: Date.new(2026, 10, 1))
    repo.close(review.id) if status == "closed"
    repo.find(review.id)
  end

  it "computes the summary per author profile so one prolific profile weighs as much as another" do
    other_account = create_account(role: 1)
    other = create_account_with_profile(account_id: other_account, username: "guest_two")
    3.times { write(rating: 5, status: "closed") }
    write(author_profile: other, author_account: other_account, rating: 1, status: "closed")
    write(rating: 1)

    expect(repo.rating_summary(target_profile_id: cast)).to eq(average_rating: 3.0, rater_count: 2, review_count: 4)
  end

  it "reports no summary without closed reviews" do
    write(rating: 4)

    expect(repo.rating_summary(target_profile_id: cast)).to eq(average_rating: 0.0, rater_count: 0, review_count: 0)
  end

  it "lists by author profile and counts by account across profiles" do
    second = create_account_with_profile(account_id: guest_account, username: "guest_alt")
    mine = write
    write(author_profile: second, rating: 2, status: "closed")

    expect(repo.list_by_author_profile(author_profile_id: guest, limit: 20).map(&:id)).to eq([mine.id])
    expect(repo.list_by_account(author_account_id: guest_account, limit: 20).length).to eq(2)
    expect(repo.counts_by_account(author_account_id: guest_account)).to eq(total: 2, open: 1, closed: 1)
  end

  it "deletes the reviews a profile wrote or received" do
    written = write
    other_cast = create_account_with_profile(role: 2, username: "cast_two")
    kept = write(target: other_cast)

    repo.delete_by_profile(cast)

    expect(repo.find(written.id)).to be_nil
    expect(repo.find(kept.id)).not_to be_nil
  end
end
```

- [ ] **Step 5: Run the spec**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/repositories/review_repository_spec.rb > <scratchpad>/rspec.log 2>&1; tail -20 <scratchpad>/rspec.log`
Expected: 4 examples, 0 failures（旧 `relations/entries.rb` が同じ slice にあっても読み込みは衝突しない。衝突した場合は Task 9 の削除を先に行う）

- [ ] **Step 6: Commit**

```bash
git add dystopia/monolith/slices/review dystopia/monolith/spec/slices/review/repositories/review_repository_spec.rb
git commit -s -m "feat(dystopia): add the review catalog, relations and repositories

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 7: Lifecycle use cases

**Files:**
- Create: `dystopia/monolith/slices/review/use_cases/authorize_guest.rb`, `validate_event.rb`, `present_reviews.rb`, `page_reviews.rb`, `load_own_review.rb`, `create_review.rb`, `get_review.rb`, `update_review_rating.rb`, `close_review.rb`, `reopen_review.rb`, `delete_review.rb`, `add_review_event.rb`, `update_review_event.rb`, `delete_review_event.rb`
- Create: `dystopia/monolith/slices/review/use_cases/filter_visible_reviews.rb`（`load_own_review` と `get_review` が使う。一覧の判定は Task 8 で spec を足す）
- Create: `dystopia/monolith/spec/slices/review/use_cases/review_lifecycle_spec.rb`、`validate_event_spec.rb`

**Interfaces:**
- Consumes: Task 6 の repository と catalog
- Produces:
  - `FilterVisibleReviews#call(viewer_profile_id:, page_owner_profile_id:, reviews:)`、`#recent(viewer_profile_id:, reviews:)`、`#own(reviews:)`、`#parties_visible?(review)`、`FilterVisibleReviews::AuthorRef`
  - `PageReviews#limit_for(raw)`、`#call(rows:, limit:, viewer_account_id:, order: :activity, visible: ->(rows) { rows })` → `{ reviews:, next_cursor:, has_more: }`
  - use case の `call` の引数は下の各コードのとおり（handler が Task 9 でそのまま使う）

- [ ] **Step 1: Copy the mechanical use cases**

```bash
cd dystopia/monolith/slices
rename() { sed -e 's/Kartes/Reviews/g; s/kartes/reviews/g; s/Karte/Review/g; s/karte/review/g; s/KARTE/REVIEW/g; s/authorize_cast/authorize_guest/g; s/AuthorizeCast/AuthorizeGuest/g; s/"Cast only"/"Guest only"/g' "$1" > "$2"; }
rename karte/use_cases/validate_event.rb review/use_cases/validate_event.rb
rename karte/use_cases/present_kartes.rb review/use_cases/present_reviews.rb
rename karte/use_cases/update_karte_rating.rb review/use_cases/update_review_rating.rb
rename karte/use_cases/close_karte.rb review/use_cases/close_review.rb
rename karte/use_cases/reopen_karte.rb review/use_cases/reopen_review.rb
rename karte/use_cases/delete_karte.rb review/use_cases/delete_review.rb
rename karte/use_cases/add_karte_event.rb review/use_cases/add_review_event.rb
rename karte/use_cases/update_karte_event.rb review/use_cases/update_review_event.rb
rename karte/use_cases/delete_karte_event.rb review/use_cases/delete_review_event.rb
```

`/usr/bin/grep -rn "karte\|Karte\|cast" review/use_cases/{validate_event,present_reviews,update_review_rating,close_review,reopen_review,delete_review,add_review_event,update_review_event,delete_review_event}.rb` が何も出さないことを確かめる。

- [ ] **Step 2: Write `authorize_guest.rb`**

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class AuthorizeGuest
      ROLE_GUEST = 1

      def initialize(account_repo: nil)
        @account_repo = account_repo
      end

      def call(viewer_account_id:)
        return false unless Ids.valid?(viewer_account_id)

        account_repo.find_by_id(viewer_account_id)&.role == ROLE_GUEST
      end

      private

      def account_repo
        @account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end
    end
  end
end
```

- [ ] **Step 3: Write `filter_visible_reviews.rb`**

```ruby
# frozen_string_literal: true

require "set"

module Review
  module UseCases
    class FilterVisibleReviews
      AuthorRef = Struct.new(:author_profile_id)

      def initialize(block_adapter: nil, filter_visible_posts: nil, list_visible_profile_ids: nil)
        @block_adapter = block_adapter
        @filter_visible_posts = filter_visible_posts
        @list_visible_profile_ids = list_visible_profile_ids
      end

      def call(viewer_profile_id:, page_owner_profile_id:, reviews:)
        reviews = own(reviews: reviews)
        return reviews if reviews.empty? || viewer_profile_id == page_owner_profile_id
        return [] unless reachable_ids(viewer_profile_id, [page_owner_profile_id]).include?(page_owner_profile_id)

        blocked = blocked_ids(viewer_profile_id)
        reviews.reject { |review| blocked.include?(other_party_id(review, page_owner_profile_id)) }
      end

      def recent(viewer_profile_id:, reviews:)
        reviews = own(reviews: reviews)
        return [] if reviews.empty?

        blocked = blocked_ids(viewer_profile_id)
        reviews = reviews.reject { |review| parties(review).any? { |id| blocked.include?(id) } }
        return [] if reviews.empty?

        reachable = reachable_ids(viewer_profile_id, reviews.map(&:target_profile_id).uniq)
        reviews.select { |review| reachable.include?(review.target_profile_id) }
      end

      def own(reviews:)
        return [] if reviews.empty?

        visible = list_visible_profile_ids.call(profile_ids: reviews.flat_map { |review| parties(review) }).to_set
        reviews.select { |review| parties(review).all? { |id| visible.include?(id) } }
      end

      def parties_visible?(review)
        own(reviews: [review]).any?
      end

      private

      def parties(review)
        [review.author_profile_id, review.target_profile_id]
      end

      def other_party_id(review, page_owner_profile_id)
        review.author_profile_id == page_owner_profile_id ? review.target_profile_id : review.author_profile_id
      end

      def reachable_ids(viewer_profile_id, profile_ids)
        refs = profile_ids.map { |id| AuthorRef.new(id) }
        filter_visible_posts.call(viewer_profile_id: viewer_profile_id, posts: refs).map(&:author_profile_id).to_set
      end

      def blocked_ids(viewer_profile_id)
        block_adapter.bidirectionally_blocked_profile_ids(profile_id: viewer_profile_id).to_set
      end

      def block_adapter
        @block_adapter ||= Review::Adapters::BlockAdapter.new
      end

      def filter_visible_posts
        @filter_visible_posts ||= ::Social::Slice["use_cases.filter_visible_posts"]
      end

      def list_visible_profile_ids
        @list_visible_profile_ids ||= ::Profile::Slice["use_cases.list_visible_profile_ids"]
      end
    end
  end
end
```

- [ ] **Step 4: Write `page_reviews.rb`**

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class PageReviews
      DEFAULT_LIMIT = 20
      MAX_LIMIT = 50

      include Review::Deps[
        review_repo: "repositories.review_repository",
        present_reviews: "use_cases.present_reviews"
      ]

      def limit_for(raw)
        limit = raw.to_i
        limit <= 0 ? DEFAULT_LIMIT : [limit, MAX_LIMIT].min
      end

      def call(rows:, limit:, viewer_account_id:, order: :activity, visible: ->(page) { page })
        has_more = rows.length > limit
        page = rows.first(limit)
        {
          reviews: present_reviews.call(reviews: visible.call(page), viewer_account_id: viewer_account_id),
          next_cursor: has_more ? review_repo.cursor_for(page.last, order: order) : nil,
          has_more: has_more
        }
      end
    end
  end
end
```

`present_reviews.rb` は Step 1 のコピーで `call(reviews:, viewer_account_id:)` になっていることを確かめる。

- [ ] **Step 5: Write `load_own_review.rb`**

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class LoadOwnReview
      include Review::Deps[
        review_repo: "repositories.review_repository",
        authorize_guest: "use_cases.authorize_guest",
        filter_visible_reviews: "use_cases.filter_visible_reviews"
      ]

      def call(viewer_account_id:, review_id:, require_open: false, lock: false)
        raise Errors::Forbidden, "Guest only" unless authorize_guest.call(viewer_account_id: viewer_account_id)

        review = Ids.valid?(review_id) ? (lock ? review_repo.lock(review_id) : review_repo.find(review_id)) : nil
        raise Errors::Invalid, "Review not found" unless review && filter_visible_reviews.parties_visible?(review)
        raise Errors::Forbidden, "Not the author" unless review.author_account_id == viewer_account_id
        raise Errors::Invalid, "Review is closed" if require_open && review.status != "open"

        review
      end
    end
  end
end
```

- [ ] **Step 6: Write `create_review.rb`**

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class CreateReview
      ROLE_CAST = 2

      include Review::Deps[
        review_repo: "repositories.review_repository",
        event_repo: "repositories.event_repository",
        authorize_guest: "use_cases.authorize_guest",
        validate_event: "use_cases.validate_event",
        present_reviews: "use_cases.present_reviews"
      ]

      def initialize(get_role: nil, same_account: nil, **deps)
        super(**deps)
        @get_role = get_role
        @same_account = same_account
      end

      def call(viewer_account_id:, viewer_profile_id:, target_profile_id:, rating:, event:)
        raise Errors::Forbidden, "Guest only" unless authorize_guest.call(viewer_account_id: viewer_account_id)
        raise Errors::Invalid, "Rating must be 1..5" unless rating.nil? || (1..5).cover?(rating)
        raise Errors::Invalid, "Target must be a cast" unless cast?(target_profile_id)
        if same_account.call(profile_id: viewer_profile_id, other_profile_id: target_profile_id)
          raise Errors::Invalid, "Cannot review a profile of your own account"
        end

        attrs = validate_event.call(**event)
        review = nil
        review_repo.transaction do
          review = review_repo.create(
            author_account_id: viewer_account_id,
            author_profile_id: viewer_profile_id,
            target_profile_id: target_profile_id,
            rating: rating,
            occurred_on: attrs[:occurred_on]
          )
          event_repo.create(review_id: review.id, **attrs)
        end
        present_reviews.call(reviews: [review], viewer_account_id: viewer_account_id).first
      end

      private

      def cast?(profile_id)
        Ids.valid?(profile_id) && get_role.call(profile_id: profile_id) == ROLE_CAST
      end

      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end

      def same_account
        @same_account ||= ::Profile::Slice["use_cases.same_account"]
      end
    end
  end
end
```

- [ ] **Step 7: Write `get_review.rb`**

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class GetReview
      include Review::Deps[
        review_repo: "repositories.review_repository",
        filter_visible_reviews: "use_cases.filter_visible_reviews",
        present_reviews: "use_cases.present_reviews"
      ]

      def call(viewer_account_id:, viewer_profile_id:, review_id:)
        review = Ids.valid?(review_id) ? review_repo.find(review_id) : nil
        raise Errors::Invalid, "Review not found" unless review && visible?(review, viewer_account_id, viewer_profile_id)

        present_reviews.call(reviews: [review], viewer_account_id: viewer_account_id).first
      end

      private

      def visible?(review, viewer_account_id, viewer_profile_id)
        return filter_visible_reviews.parties_visible?(review) if review.author_account_id == viewer_account_id

        filter_visible_reviews.recent(viewer_profile_id: viewer_profile_id, reviews: [review]).any?
      end
    end
  end
end
```

- [ ] **Step 8: Write the validate_event spec** — `spec/slices/review/use_cases/validate_event_spec.rb`

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::ValidateEvent do
  subject(:validate) { described_class.new }

  let(:today) { Date.new(2026, 10, 17) }
  let(:base) { { stage: "service", outcome: "satisfied", tags: %w[punctual], note: "", occurred_on: "2026-10-17", today: today } }

  def invalid(message) = raise_error(Review::Errors::Invalid, message)

  it "accepts an event of the review catalog and drops a blank note" do
    expect(validate.call(**base)).to eq(stage: "service", outcome: "satisfied", tags: %w[punctual], note: nil, occurred_on: Date.new(2026, 10, 17))
  end

  it "refuses codes of another stage and of the karte catalog" do
    expect { validate.call(**base, outcome: "booked") }.to invalid("Unknown outcome for the stage")
    expect { validate.call(**base, outcome: "completed") }.to invalid("Unknown outcome for the stage")
    expect { validate.call(**base, tags: %w[payment_ok]) }.to invalid("Unknown tag for the stage")
    expect { validate.call(**base, tags: %w[late late]) }.to invalid("Duplicate tags")
  end

  it "requires a note for the serious outcomes" do
    expect { validate.call(**base, stage: "reservation", outcome: "cast_no_show", tags: []) }.to invalid("Note required for this outcome")
    expect { validate.call(**base, outcome: "ended_early", note: "  ") }.to invalid("Note required for this outcome")
    expect { validate.call(**base, stage: "aftercare", outcome: "trouble_occurred", tags: []) }.to invalid("Note required for this outcome")
    expect { validate.call(**base, note: "a" * 501) }.to invalid("Note too long")
  end

  it "refuses a malformed or future date" do
    expect { validate.call(**base, occurred_on: "2026/10/17") }.to invalid("Occurred date must be YYYY-MM-DD")
    expect { validate.call(**base, occurred_on: "2026-10-18") }.to invalid("Occurred date is in the future")
  end
end
```

- [ ] **Step 9: Write the lifecycle spec** — `spec/slices/review/use_cases/review_lifecycle_spec.rb`

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Review lifecycle use cases", type: :database do
  def uc(name) = Review::Slice["use_cases.#{name}"]

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:guest_account) { create_account(role: 1) }
  let(:persona_a) { create_account_with_profile(account_id: guest_account, username: "persona_a") }
  let(:persona_b) { create_account_with_profile(account_id: guest_account, username: "persona_b") }
  let(:other_guest_account) { create_account(role: 1) }
  let(:other_guest) { create_account_with_profile(account_id: other_guest_account, username: "other_guest") }
  let(:cast_account) { create_account(role: 2) }
  let(:cast) { create_account_with_profile(account_id: cast_account, username: "cast_one", display_name: "りん") }
  let(:event_input) { { stage: "reservation", outcome: "booked", tags: %w[quick_reply], note: "", occurred_on: "2026-10-01" } }

  def create(rating: nil, event: event_input, viewer: guest_account, profile: persona_a, target: cast)
    uc(:create_review).call(viewer_account_id: viewer, viewer_profile_id: profile, target_profile_id: target, rating: rating, event: event)
  end

  def forbidden = raise_error(Review::Errors::Forbidden)
  def invalid(message) = raise_error(Review::Errors::Invalid, message)

  describe "creating" do
    it "opens a review with its first event and presents the profiles" do
      review = create

      expect(review).to include(status: "open", rating: nil, is_mine: true, author_username: "persona_a", target_username: "cast_one", target_display_name: "りん")
      expect(review[:events].map { |e| e.slice(:stage, :outcome, :tags) }).to eq([{ stage: "reservation", outcome: "booked", tags: %w[quick_reply] }])
    end

    it "refuses a cast viewer and a guest target" do
      expect { create(viewer: cast_account, profile: cast) }.to forbidden
      expect { create(target: other_guest) }.to invalid("Target must be a cast")
      expect { create(target: "not-a-uuid") }.to invalid("Target must be a cast")
    end

    it "refuses a profile of the viewer's own account" do
      use_case = Review::UseCases::CreateReview.new(
        get_role: ->(profile_id:) { 2 },
        same_account: ->(profile_id:, other_profile_id:) { profile_id == persona_a && other_profile_id == cast }
      )

      expect { use_case.call(viewer_account_id: guest_account, viewer_profile_id: persona_a, target_profile_id: cast, rating: nil, event: event_input) }
        .to invalid("Cannot review a profile of your own account")
    end

    it "keeps nothing when the first event is invalid" do
      expect { create(event: event_input.merge(outcome: "satisfied")) }.to invalid("Unknown outcome for the stage")
      expect(db[:review__reviews].count).to eq(0)
    end
  end

  describe "reading" do
    it "lets any signed-in viewer read a review and marks whether it is theirs" do
      review = create

      expect(uc(:get_review).call(viewer_account_id: cast_account, viewer_profile_id: cast, review_id: review[:id])[:is_mine]).to be false
      expect(uc(:get_review).call(viewer_account_id: guest_account, viewer_profile_id: persona_b, review_id: review[:id])[:is_mine]).to be true
      expect { uc(:get_review).call(viewer_account_id: cast_account, viewer_profile_id: cast, review_id: "abc") }.to invalid("Review not found")
    end

    it "reads a review whose cast is disabled as not found" do
      review = create
      db[:profile__profiles].where(id: cast).update(disabled_at: Time.now)

      expect { uc(:get_review).call(viewer_account_id: other_guest_account, viewer_profile_id: other_guest, review_id: review[:id]) }.to invalid("Review not found")
      expect { uc(:close_review).call(viewer_account_id: guest_account, review_id: review[:id]) }.to invalid("Review not found")
    end
  end

  describe "rating, closing and reopening" do
    it "requires a rating to close, then freezes the review until it is reopened" do
      review = create
      close = -> { uc(:close_review).call(viewer_account_id: guest_account, review_id: review[:id]) }

      expect { close.call }.to invalid("Rating required to close")
      uc(:update_review_rating).call(viewer_account_id: guest_account, review_id: review[:id], rating: 4)
      expect(close.call).to include(status: "closed", rating: 4)
      expect { uc(:add_review_event).call(viewer_account_id: guest_account, review_id: review[:id], event: event_input) }.to invalid("Review is closed")

      expect(uc(:reopen_review).call(viewer_account_id: guest_account, review_id: review[:id])).to include(status: "open", rating: 4, closed_at: nil)
    end

    it "lets another profile of the author's account act and refuses another account" do
      review = create(rating: 3)

      expect(uc(:close_review).call(viewer_account_id: guest_account, review_id: review[:id])[:status]).to eq("closed")
      expect { uc(:reopen_review).call(viewer_account_id: other_guest_account, review_id: review[:id]) }.to forbidden
    end
  end

  describe "events and deleting" do
    it "adds, updates and deletes events while open, keeping at least one" do
      review = create
      added = uc(:add_review_event).call(
        viewer_account_id: guest_account, review_id: review[:id],
        event: { stage: "service", outcome: "ended_early", tags: %w[late], note: "途中で帰された", occurred_on: "2026-10-02" }
      )
      second = added[:events].last
      updated = uc(:update_review_event).call(
        viewer_account_id: guest_account, event_id: second[:id],
        event: { stage: "service", outcome: "satisfied", tags: [], note: "", occurred_on: "2026-10-02" }
      )
      expect(updated[:events].last).to include(outcome: "satisfied", note: nil)

      remaining = uc(:delete_review_event).call(viewer_account_id: guest_account, event_id: second[:id])
      only = remaining[:events].first
      expect { uc(:delete_review_event).call(viewer_account_id: guest_account, event_id: only[:id]) }.to invalid("A review keeps at least one event")
    end

    it "lets the author delete in any state and refuses another account" do
      review = create(rating: 5)
      uc(:close_review).call(viewer_account_id: guest_account, review_id: review[:id])

      expect { uc(:delete_review).call(viewer_account_id: other_guest_account, review_id: review[:id]) }.to forbidden
      expect(uc(:delete_review).call(viewer_account_id: guest_account, review_id: review[:id])).to be_nil
      expect(db[:review__events].where(review_id: review[:id]).count).to eq(0)
    end
  end
end
```

`Profile::UseCases::GetRole` はアカウントの役割を返すため、実データでは同じアカウントのプロフィールは常に「キャストでない」で先に拒否される。`same_account` の確認は防御として残し、spec では `get_role` と `same_account` を差し替えて確かめる（旧 `create_entry_spec.rb` と同じ方法）。

- [ ] **Step 10: Run the specs**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/validate_event_spec.rb spec/slices/review/use_cases/review_lifecycle_spec.rb > <scratchpad>/rspec.log 2>&1; tail -30 <scratchpad>/rspec.log`
Expected: 0 failures

- [ ] **Step 11: Commit**

```bash
git add dystopia/monolith/slices/review dystopia/monolith/spec/slices/review/use_cases
git commit -s -m "feat(dystopia): add the review lifecycle use cases

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 8: List use cases and visibility

**Files:**
- Create: `dystopia/monolith/slices/review/use_cases/list_reviews_by_target.rb`, `list_reviews_by_author.rb`, `list_my_reviews.rb`, `list_recent_reviews.rb`
- Create: `dystopia/monolith/spec/slices/review/use_cases/list_reviews_spec.rb`

**Interfaces:**
- Consumes: `PageReviews`、`FilterVisibleReviews`、`ReviewRepository`
- Produces:
  - `ListReviewsByTarget#call(viewer_account_id:, viewer_profile_id:, target_profile_id:, limit:, cursor:)` → `{ reviews:, next_cursor:, has_more:, summary: }`
  - `ListReviewsByAuthor#call(viewer_account_id:, viewer_profile_id:, author_profile_id:, limit:, cursor:)` → `{ reviews:, next_cursor:, has_more: }`
  - `ListMyReviews#call(viewer_account_id:, limit:, cursor:)` → `{ reviews:, next_cursor:, has_more:, counts: }`
  - `ListRecentReviews#call(viewer_account_id:, viewer_profile_id:, limit:, cursor:)` → `{ reviews:, next_cursor:, has_more: }`

- [ ] **Step 1: Write the failing spec** — `spec/slices/review/use_cases/list_reviews_spec.rb`

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Review list use cases", type: :database do
  def uc(name) = Review::Slice["use_cases.#{name}"]

  let(:db) { Hanami.app["db.gateway"].connection }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }
  let(:other_guest_account) { create_account(role: 1) }
  let(:other_guest) { create_account_with_profile(account_id: other_guest_account, username: "guest_two") }
  let(:cast_account) { create_account(role: 2) }
  let(:cast) { create_account_with_profile(account_id: cast_account, username: "cast_one") }
  let(:event_input) { { stage: "service", outcome: "satisfied", tags: [], note: "", occurred_on: "2026-10-01" } }

  def write(account: guest_account, profile: guest, target: cast, rating: nil, close: false, at: Time.now)
    review = uc(:create_review).call(viewer_account_id: account, viewer_profile_id: profile, target_profile_id: target, rating: rating, event: event_input)
    uc(:close_review).call(viewer_account_id: account, review_id: review[:id]) if close
    db[:review__reviews].where(id: review[:id]).update(created_at: at, last_activity_at: at)
    review
  end

  def by_target(viewer_account: cast_account, viewer: cast, limit: 20, cursor: nil)
    uc(:list_reviews_by_target).call(viewer_account_id: viewer_account, viewer_profile_id: viewer, target_profile_id: cast, limit: limit, cursor: cursor)
  end

  it "lists a cast's reviews, open ones included, with the summary of the closed ones" do
    now = Time.now
    first = write(rating: 5, close: true, at: now - 30)
    second = write(account: other_guest_account, profile: other_guest, rating: 3, close: true, at: now - 20)
    open_one = write(at: now - 10)

    result = by_target

    expect(result[:reviews].map { |r| r[:id] }).to eq([open_one[:id], second[:id], first[:id]])
    expect(result[:summary]).to eq(average_rating: 4.0, rater_count: 2, review_count: 2)
  end

  it "pages with a cursor" do
    older = write(at: Time.now - 20)
    newer = write(at: Time.now - 10)

    page = by_target(limit: 1)
    rest = by_target(limit: 1, cursor: page[:next_cursor])

    expect([page[:reviews].map { |r| r[:id] }, page[:has_more]]).to eq([[newer[:id]], true])
    expect([rest[:reviews].map { |r| r[:id] }, rest[:has_more]]).to eq([[older[:id]], false])
  end

  it "hides the reviews of a blocked author from the viewer but keeps the summary the same" do
    write(rating: 4, close: true)
    viewer_account = create_account(role: 1)
    viewer = create_account_with_profile(account_id: viewer_account, username: "viewer")
    Social::Slice["repositories.block_repository"].block(blocker_profile_id: viewer, blocked_profile_id: guest)

    result = by_target(viewer_account: viewer_account, viewer: viewer)

    expect(result[:reviews]).to eq([])
    expect(result[:summary]).to eq(average_rating: 4.0, rater_count: 1, review_count: 1)
  end

  it "answers for a disabled cast as for a profile that does not exist" do
    write
    db[:profile__profiles].where(id: cast).update(disabled_at: Time.now)

    result = by_target(viewer_account: other_guest_account, viewer: other_guest)

    expect(result[:reviews]).to eq([])
    expect(result[:summary]).to eq(average_rating: 0.0, rater_count: 0, review_count: 0)
  end

  it "lists the reviews a guest profile wrote" do
    mine = write
    write(account: other_guest_account, profile: other_guest)

    result = uc(:list_reviews_by_author).call(viewer_account_id: cast_account, viewer_profile_id: cast, author_profile_id: guest, limit: 20, cursor: nil)

    expect(result[:reviews].map { |r| r[:id] }).to eq([mine[:id]])
  end

  it "lists and counts the viewer's own reviews across the account's profiles" do
    second = create_account_with_profile(account_id: guest_account, username: "guest_alt")
    write(at: Time.now - 20)
    write(profile: second, rating: 3, close: true, at: Time.now - 10)
    write(account: other_guest_account, profile: other_guest)

    first = uc(:list_my_reviews).call(viewer_account_id: guest_account, limit: 1, cursor: nil)
    rest = uc(:list_my_reviews).call(viewer_account_id: guest_account, limit: 1, cursor: first[:next_cursor])

    expect(first[:counts]).to eq(total: 2, open: 1, closed: 1)
    expect(rest[:counts]).to eq(total: 0, open: 0, closed: 0)
    expect { uc(:list_my_reviews).call(viewer_account_id: cast_account, limit: 20, cursor: nil) }.to raise_error(Review::Errors::Forbidden)
  end

  it "lists recent reviews by the latest event's date and leaves out a cast the viewer cannot reach" do
    older = write(at: Time.now - 20)
    newer = write(account: other_guest_account, profile: other_guest, at: Time.now - 10)
    db[:review__reviews].where(id: older[:id]).update(last_occurred_on: Date.new(2026, 10, 9))
    db[:review__reviews].where(id: newer[:id]).update(last_occurred_on: Date.new(2026, 10, 8))
    private_cast = create_account_with_profile(account_id: create_account(role: 2), username: "private_cast", is_private: true)
    write(target: private_cast)

    result = uc(:list_recent_reviews).call(viewer_account_id: cast_account, viewer_profile_id: cast, limit: 20, cursor: nil)

    expect(result[:reviews].map { |r| r[:id] }).to eq([older[:id], newer[:id]])
  end
end
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases/list_reviews_spec.rb > <scratchpad>/rspec.log 2>&1; tail -20 <scratchpad>/rspec.log`
Expected: FAIL（`use_cases.list_reviews_by_target` が登録されていない）

- [ ] **Step 3: Write the list use cases**

`list_reviews_by_target.rb`:

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class ListReviewsByTarget
      NO_SUMMARY = { average_rating: 0.0, rater_count: 0, review_count: 0 }.freeze

      include Review::Deps[
        review_repo: "repositories.review_repository",
        page_reviews: "use_cases.page_reviews",
        filter_visible_reviews: "use_cases.filter_visible_reviews"
      ]

      def initialize(list_visible_profile_ids: nil, **deps)
        super(**deps)
        @list_visible_profile_ids = list_visible_profile_ids
      end

      def call(viewer_account_id:, viewer_profile_id:, target_profile_id:, limit:, cursor:)
        raise Errors::Invalid, "Unknown profile" unless Ids.valid?(target_profile_id)

        limit = page_reviews.limit_for(limit)
        return { reviews: [], next_cursor: nil, has_more: false, summary: NO_SUMMARY } unless visible?(target_profile_id)

        rows = review_repo.list_by_target(target_profile_id: target_profile_id, limit: limit, cursor: cursor)
        page_reviews.call(
          rows: rows, limit: limit, viewer_account_id: viewer_account_id,
          visible: ->(page) { filter_visible_reviews.call(viewer_profile_id: viewer_profile_id, page_owner_profile_id: target_profile_id, reviews: page) }
        ).merge(summary: review_repo.rating_summary(target_profile_id: target_profile_id))
      end

      private

      def visible?(profile_id)
        list_visible_profile_ids.call(profile_ids: [profile_id]).any?
      end

      def list_visible_profile_ids
        @list_visible_profile_ids ||= ::Profile::Slice["use_cases.list_visible_profile_ids"]
      end
    end
  end
end
```

`list_reviews_by_author.rb`:

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class ListReviewsByAuthor
      include Review::Deps[
        review_repo: "repositories.review_repository",
        page_reviews: "use_cases.page_reviews",
        filter_visible_reviews: "use_cases.filter_visible_reviews"
      ]

      def initialize(list_visible_profile_ids: nil, **deps)
        super(**deps)
        @list_visible_profile_ids = list_visible_profile_ids
      end

      def call(viewer_account_id:, viewer_profile_id:, author_profile_id:, limit:, cursor:)
        raise Errors::Invalid, "Unknown profile" unless Ids.valid?(author_profile_id)

        limit = page_reviews.limit_for(limit)
        return { reviews: [], next_cursor: nil, has_more: false } unless list_visible_profile_ids.call(profile_ids: [author_profile_id]).any?

        rows = review_repo.list_by_author_profile(author_profile_id: author_profile_id, limit: limit, cursor: cursor)
        page_reviews.call(
          rows: rows, limit: limit, viewer_account_id: viewer_account_id,
          visible: ->(page) { filter_visible_reviews.call(viewer_profile_id: viewer_profile_id, page_owner_profile_id: author_profile_id, reviews: page) }
        )
      end

      private

      def list_visible_profile_ids
        @list_visible_profile_ids ||= ::Profile::Slice["use_cases.list_visible_profile_ids"]
      end
    end
  end
end
```

`list_my_reviews.rb`:

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class ListMyReviews
      NO_COUNTS = { total: 0, open: 0, closed: 0 }.freeze

      include Review::Deps[
        review_repo: "repositories.review_repository",
        authorize_guest: "use_cases.authorize_guest",
        page_reviews: "use_cases.page_reviews",
        filter_visible_reviews: "use_cases.filter_visible_reviews"
      ]

      def call(viewer_account_id:, limit:, cursor:)
        raise Errors::Forbidden, "Guest only" unless authorize_guest.call(viewer_account_id: viewer_account_id)

        limit = page_reviews.limit_for(limit)
        rows = review_repo.list_by_account(author_account_id: viewer_account_id, limit: limit, cursor: cursor)
        counts = cursor.nil? ? review_repo.counts_by_account(author_account_id: viewer_account_id) : NO_COUNTS
        page_reviews.call(
          rows: rows, limit: limit, viewer_account_id: viewer_account_id,
          visible: ->(page) { filter_visible_reviews.own(reviews: page) }
        ).merge(counts: counts)
      end
    end
  end
end
```

`list_recent_reviews.rb`:

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class ListRecentReviews
      include Review::Deps[
        review_repo: "repositories.review_repository",
        page_reviews: "use_cases.page_reviews",
        filter_visible_reviews: "use_cases.filter_visible_reviews"
      ]

      def call(viewer_account_id:, viewer_profile_id:, limit:, cursor:)
        limit = page_reviews.limit_for(limit)
        rows = review_repo.list_recent(limit: limit, cursor: cursor)
        page_reviews.call(
          rows: rows, limit: limit, viewer_account_id: viewer_account_id, order: :occurred,
          visible: ->(page) { filter_visible_reviews.recent(viewer_profile_id: viewer_profile_id, reviews: page) }
        )
      end
    end
  end
end
```

- [ ] **Step 4: Run the spec**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/slices/review/use_cases > <scratchpad>/rspec.log 2>&1; tail -30 <scratchpad>/rspec.log`
Expected: 新しい spec は 0 failures（旧 use case の spec の失敗は Task 9 で消える）

- [ ] **Step 5: Commit**

```bash
git add dystopia/monolith/slices/review/use_cases dystopia/monolith/spec/slices/review/use_cases/list_reviews_spec.rb
git commit -s -m "feat(dystopia): list reviews by cast, author, account and recency

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 9: Handler, purge and removal of the old slice code

**Files:**
- Modify (rewrite): `dystopia/monolith/slices/review/grpc/review_handler.rb`、`slices/review/use_cases/purge_profile.rb`
- Delete: `slices/review/relations/entries.rb`、`relations/cast_settings.rb`、`repositories/entry_repository.rb`、`repositories/cast_settings_repository.rb`、`use_cases/{create_entry,update_entry,delete_entry,hide_entry,unhide_entry,list_entries_by_author,list_entries_by_target,list_recent_entries,filter_visible_entries,entry_parties_visible,get_my_settings,update_my_settings}.rb` と、それぞれの spec（`spec/slices/review/` の旧ファイルすべて、`relations_spec.rb` を含む）
- Create: `dystopia/monolith/spec/slices/review/grpc/review_handler_spec.rb`（旧ファイルを置き換える）、`spec/slices/review/use_cases/purge_profile_spec.rb`（置き換える）
- Modify: `spec/slices/post/cross_slice_wiring_spec.rb`、`spec/slices/identity/use_cases/account/purge_wiring_spec.rb`、`spec/slices/social/rpc_and_cross_slice_wiring_spec.rb`、`spec/slices/profile/visibility_wiring_spec.rb`

**Interfaces:**
- Consumes: Task 7・Task 8 の use case
- Produces: gRPC `review.v1.ReviewService`（`bin/grpc` は `slices/review/grpc/review_handler` を require 済み。ファイル名を変えないので登録は変わらない）

- [ ] **Step 1: Delete the old code and specs**

```bash
cd dystopia/monolith
git rm -q slices/review/relations/entries.rb slices/review/relations/cast_settings.rb \
  slices/review/repositories/entry_repository.rb slices/review/repositories/cast_settings_repository.rb \
  slices/review/use_cases/{create_entry,update_entry,delete_entry,hide_entry,unhide_entry,list_entries_by_author,list_entries_by_target,list_recent_entries,filter_visible_entries,entry_parties_visible,get_my_settings,update_my_settings}.rb
git rm -q spec/slices/review/relations_spec.rb spec/slices/review/repositories/entry_repository_spec.rb spec/slices/review/repositories/cast_settings_repository_spec.rb \
  spec/slices/review/use_cases/{create_entry,delete_entry,filter_visible_entries,get_my_settings,hide_entry,list_entries_by_author,list_entries_by_target,list_recent_entries,unhide_entry,update_entry,update_my_settings}_spec.rb
/usr/bin/grep -rn "entry_repository\|cast_settings\|filter_visible_entries\|ListRecentEntries\|FilterVisibleEntries\|review__entries" slices config lib bin
```

Expected: 最後の grep が何も出さない（`config/db/migrate` の旧 migration は除く）

- [ ] **Step 2: Rewrite `purge_profile.rb`**

```ruby
# frozen_string_literal: true

module Review
  module UseCases
    class PurgeProfile
      include Review::Deps[review_repo: "repositories.review_repository"]

      def call(profile_id:)
        review_repo.delete_by_profile(profile_id)
        nil
      end
    end
  end
end
```

`spec/slices/review/use_cases/purge_profile_spec.rb` を次にする。

```ruby
# frozen_string_literal: true

require "spec_helper"

RSpec.describe Review::UseCases::PurgeProfile, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:repo) { Review::Slice["repositories.review_repository"] }
  let(:cast) { create_account_with_profile(role: 2, username: "cast_one") }
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }
  let(:other_cast) { create_account_with_profile(role: 2, username: "cast_two") }

  it "deletes the reviews the profile wrote or received with their events and keeps the others" do
    gone = repo.create(author_account_id: guest_account, author_profile_id: guest, target_profile_id: cast, rating: nil, occurred_on: Date.new(2026, 10, 1))
    Review::Slice["repositories.event_repository"].create(review_id: gone.id, stage: "service", outcome: "satisfied", tags: [], note: nil, occurred_on: Date.new(2026, 10, 1))
    kept = repo.create(author_account_id: create_account(role: 1), author_profile_id: create_account_with_profile(username: "guest_two"), target_profile_id: other_cast, rating: nil, occurred_on: Date.new(2026, 10, 1))

    described_class.new.call(profile_id: cast)

    expect(db[:review__reviews].select_map(:id)).to eq([kept.id])
    expect(db[:review__events].count).to eq(0)
  end
end
```

- [ ] **Step 3: Rewrite the handler** — `slices/review/grpc/review_handler.rb`

```ruby
# frozen_string_literal: true

require "review/v1/service_services_pb"
require "google/protobuf/well_known_types"
require_relative "handler"

module Review
  module Grpc
    class ReviewHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "review.v1.ReviewService"

      bind ::Review::V1::ReviewService::Service

      self.rpc_descs.clear

      rpc :CreateReview,        ::Review::V1::CreateReviewRequest,        ::Review::V1::CreateReviewResponse
      rpc :GetReview,           ::Review::V1::GetReviewRequest,           ::Review::V1::GetReviewResponse
      rpc :UpdateReviewRating,  ::Review::V1::UpdateReviewRatingRequest,  ::Review::V1::UpdateReviewRatingResponse
      rpc :DeleteReview,        ::Review::V1::DeleteReviewRequest,        ::Review::V1::DeleteReviewResponse
      rpc :CloseReview,         ::Review::V1::CloseReviewRequest,         ::Review::V1::CloseReviewResponse
      rpc :ReopenReview,        ::Review::V1::ReopenReviewRequest,        ::Review::V1::ReopenReviewResponse
      rpc :AddReviewEvent,      ::Review::V1::AddReviewEventRequest,      ::Review::V1::AddReviewEventResponse
      rpc :UpdateReviewEvent,   ::Review::V1::UpdateReviewEventRequest,   ::Review::V1::UpdateReviewEventResponse
      rpc :DeleteReviewEvent,   ::Review::V1::DeleteReviewEventRequest,   ::Review::V1::DeleteReviewEventResponse
      rpc :ListReviewsByTarget, ::Review::V1::ListReviewsByTargetRequest, ::Review::V1::ListReviewsByTargetResponse
      rpc :ListReviewsByAuthor, ::Review::V1::ListReviewsByAuthorRequest, ::Review::V1::ListReviewsByAuthorResponse
      rpc :ListMyReviews,       ::Review::V1::ListMyReviewsRequest,       ::Review::V1::ListMyReviewsResponse
      rpc :ListRecentReviews,   ::Review::V1::ListRecentReviewsRequest,   ::Review::V1::ListRecentReviewsResponse

      STAGE_TO_PROTO = {
        "reservation" => :REVIEW_STAGE_RESERVATION,
        "service" => :REVIEW_STAGE_SERVICE,
        "aftercare" => :REVIEW_STAGE_AFTERCARE
      }.freeze
      STAGE_FROM_PROTO = STAGE_TO_PROTO.invert.freeze
      STATUS_TO_PROTO = { "open" => :REVIEW_STATUS_OPEN, "closed" => :REVIEW_STATUS_CLOSED }.freeze

      include Review::Deps[
        create_review_uc: "use_cases.create_review",
        get_review_uc: "use_cases.get_review",
        update_review_rating_uc: "use_cases.update_review_rating",
        delete_review_uc: "use_cases.delete_review",
        close_review_uc: "use_cases.close_review",
        reopen_review_uc: "use_cases.reopen_review",
        add_review_event_uc: "use_cases.add_review_event",
        update_review_event_uc: "use_cases.update_review_event",
        delete_review_event_uc: "use_cases.delete_review_event",
        list_reviews_by_target_uc: "use_cases.list_reviews_by_target",
        list_reviews_by_author_uc: "use_cases.list_reviews_by_author",
        list_my_reviews_uc: "use_cases.list_my_reviews",
        list_recent_reviews_uc: "use_cases.list_recent_reviews"
      ]

      def create_review
        authenticate_user!
        message = request.message
        review = wrap_errors do
          create_review_uc.call(
            viewer_account_id: current_account_id,
            viewer_profile_id: current_profile_id,
            target_profile_id: message.target_profile_id,
            rating: rating_from(message.rating),
            event: event_from(message.event)
          )
        end
        ::Review::V1::CreateReviewResponse.new(review: review_to_proto(review))
      end

      def get_review
        authenticate_user!
        review = wrap_errors do
          get_review_uc.call(viewer_account_id: current_account_id, viewer_profile_id: current_profile_id, review_id: request.message.review_id)
        end
        ::Review::V1::GetReviewResponse.new(review: review_to_proto(review))
      end

      def update_review_rating
        authenticate_user!
        message = request.message
        review = wrap_errors do
          update_review_rating_uc.call(viewer_account_id: current_account_id, review_id: message.review_id, rating: rating_from(message.rating))
        end
        ::Review::V1::UpdateReviewRatingResponse.new(review: review_to_proto(review))
      end

      def delete_review
        authenticate_user!
        wrap_errors { delete_review_uc.call(viewer_account_id: current_account_id, review_id: request.message.review_id) }
        ::Review::V1::DeleteReviewResponse.new
      end

      def close_review
        authenticate_user!
        review = wrap_errors { close_review_uc.call(viewer_account_id: current_account_id, review_id: request.message.review_id) }
        ::Review::V1::CloseReviewResponse.new(review: review_to_proto(review))
      end

      def reopen_review
        authenticate_user!
        review = wrap_errors { reopen_review_uc.call(viewer_account_id: current_account_id, review_id: request.message.review_id) }
        ::Review::V1::ReopenReviewResponse.new(review: review_to_proto(review))
      end

      def add_review_event
        authenticate_user!
        message = request.message
        review = wrap_errors do
          add_review_event_uc.call(viewer_account_id: current_account_id, review_id: message.review_id, event: event_from(message.event))
        end
        ::Review::V1::AddReviewEventResponse.new(review: review_to_proto(review))
      end

      def update_review_event
        authenticate_user!
        message = request.message
        review = wrap_errors do
          update_review_event_uc.call(viewer_account_id: current_account_id, event_id: message.event_id, event: event_from(message.event))
        end
        ::Review::V1::UpdateReviewEventResponse.new(review: review_to_proto(review))
      end

      def delete_review_event
        authenticate_user!
        review = wrap_errors { delete_review_event_uc.call(viewer_account_id: current_account_id, event_id: request.message.event_id) }
        ::Review::V1::DeleteReviewEventResponse.new(review: review_to_proto(review))
      end

      def list_reviews_by_target
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_reviews_by_target_uc.call(
            viewer_account_id: current_account_id, viewer_profile_id: current_profile_id,
            target_profile_id: message.target_profile_id, limit: message.limit, cursor: cursor_from(message.cursor)
          )
        end
        summary = result[:summary]
        ::Review::V1::ListReviewsByTargetResponse.new(
          **page_to_proto(result),
          summary: ::Review::V1::RatingSummary.new(
            average_rating: summary[:average_rating], rater_count: summary[:rater_count], review_count: summary[:review_count]
          )
        )
      end

      def list_reviews_by_author
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_reviews_by_author_uc.call(
            viewer_account_id: current_account_id, viewer_profile_id: current_profile_id,
            author_profile_id: message.author_profile_id, limit: message.limit, cursor: cursor_from(message.cursor)
          )
        end
        ::Review::V1::ListReviewsByAuthorResponse.new(**page_to_proto(result))
      end

      def list_my_reviews
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_my_reviews_uc.call(viewer_account_id: current_account_id, limit: message.limit, cursor: cursor_from(message.cursor))
        end
        counts = result[:counts]
        ::Review::V1::ListMyReviewsResponse.new(
          **page_to_proto(result),
          counts: ::Review::V1::ReviewCounts.new(total_count: counts[:total], open_count: counts[:open], closed_count: counts[:closed])
        )
      end

      def list_recent_reviews
        authenticate_user!
        message = request.message
        result = wrap_errors do
          list_recent_reviews_uc.call(
            viewer_account_id: current_account_id, viewer_profile_id: current_profile_id,
            limit: message.limit, cursor: cursor_from(message.cursor)
          )
        end
        ::Review::V1::ListRecentReviewsResponse.new(**page_to_proto(result))
      end

      private

      def wrap_errors
        yield
      rescue Review::Errors::Forbidden => e
        fail!(:permission_denied, :permission_denied, e.message)
      rescue Review::Errors::Invalid => e
        fail!(:invalid_argument, :invalid_argument, e.message)
      rescue ROM::SQL::CheckConstraintError
        fail!(:invalid_argument, :invalid_argument, "Review state changed")
      end

      def rating_from(value)
        value.zero? ? nil : value
      end

      def cursor_from(value)
        value.empty? ? nil : value
      end

      def event_from(input)
        input ||= ::Review::V1::ReviewEventInput.new
        {
          stage: STAGE_FROM_PROTO[input.stage],
          outcome: input.outcome,
          tags: input.tags.to_a,
          note: input.note,
          occurred_on: input.occurred_on
        }
      end

      def page_to_proto(result)
        {
          reviews: result[:reviews].map { |review| review_to_proto(review) },
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        }
      end

      def review_to_proto(review)
        ::Review::V1::Review.new(
          id: review[:id],
          author_profile_id: review[:author_profile_id],
          author_username: review[:author_username],
          author_display_name: review[:author_display_name],
          author_avatar_url: review[:author_avatar_url],
          target_profile_id: review[:target_profile_id],
          target_username: review[:target_username],
          target_display_name: review[:target_display_name],
          target_avatar_url: review[:target_avatar_url],
          is_mine: review[:is_mine],
          rating: review[:rating] || 0,
          status: STATUS_TO_PROTO.fetch(review[:status]),
          events: review[:events].map { |event| event_to_proto(event) },
          created_at: timestamp(review[:created_at]),
          updated_at: timestamp(review[:updated_at]),
          closed_at: timestamp(review[:closed_at]),
          last_activity_at: timestamp(review[:last_activity_at])
        )
      end

      def event_to_proto(event)
        ::Review::V1::ReviewEvent.new(
          id: event[:id],
          stage: STAGE_TO_PROTO.fetch(event[:stage]),
          outcome: event[:outcome],
          tags: event[:tags],
          note: event[:note] || "",
          occurred_on: event[:occurred_on].iso8601,
          created_at: timestamp(event[:created_at]),
          updated_at: timestamp(event[:updated_at])
        )
      end

      def timestamp(time)
        return nil unless time

        ::Google::Protobuf::Timestamp.new(seconds: time.to_i, nanos: time.nsec)
      end
    end
  end
end
```

- [ ] **Step 4: Write the handler spec** — `spec/slices/review/grpc/review_handler_spec.rb`（旧ファイルを置き換える）

```ruby
# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/review/grpc/review_handler"

RSpec.describe Review::Grpc::ReviewHandler, type: :database do
  let(:guest_account) { create_account(role: 1) }
  let(:guest) { create_account_with_profile(account_id: guest_account, username: "guest_one") }
  let(:cast_account) { create_account(role: 2) }
  let(:cast) { create_account_with_profile(account_id: cast_account, username: "cast_one") }

  let(:booked) do
    ::Review::V1::ReviewEventInput.new(stage: :REVIEW_STAGE_RESERVATION, outcome: "booked", tags: ["quick_reply"], note: "", occurred_on: "2026-10-01")
  end

  def handler_for(message)
    described_class.new(method_key: :test, service: double, rpc_desc: double, active_call: double, message: message)
  end

  def act_as(account_id, profile_id)
    Current.account_id = account_id
    Current.profile_id = profile_id
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def create_review(rating: 0, target: cast)
    handler_for(::Review::V1::CreateReviewRequest.new(target_profile_id: target, rating: rating, event: booked)).create_review.review
  end

  after { Current.clear }

  it "creates an open review by the acting profile" do
    act_as(guest_account, guest)

    review = create_review

    expect([review.status, review.rating, review.author_profile_id, review.target_username, review.is_mine]).to eq([:REVIEW_STATUS_OPEN, 0, guest, "cast_one", true])
    expect(review.events.first.stage).to eq(:REVIEW_STAGE_RESERVATION)
  end

  it "refuses a cast with PERMISSION_DENIED and a guest target with INVALID_ARGUMENT" do
    act_as(cast_account, cast)
    expect { create_review }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)

    act_as(guest_account, guest)
    expect { create_review(target: create_account_with_profile(username: "guest_two")) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
  end

  it "rates, closes and reopens, then lists the review with the summary for the cast" do
    act_as(guest_account, guest)
    id = create_review(rating: 4).id
    closed = handler_for(::Review::V1::CloseReviewRequest.new(review_id: id)).close_review.review
    expect(closed.status).to eq(:REVIEW_STATUS_CLOSED)

    act_as(cast_account, cast)
    listed = handler_for(::Review::V1::ListReviewsByTargetRequest.new(target_profile_id: cast)).list_reviews_by_target
    expect(listed.reviews.map(&:id)).to eq([id])
    expect([listed.summary.average_rating, listed.summary.rater_count, listed.summary.review_count]).to eq([4.0, 1, 1])
    expect { handler_for(::Review::V1::ReopenReviewRequest.new(review_id: id)).reopen_review }.to status(GRPC::Core::StatusCodes::PERMISSION_DENIED)
  end

  it "lists the author's, the viewer's own and the recent reviews" do
    act_as(guest_account, guest)
    id = create_review.id

    by_author = handler_for(::Review::V1::ListReviewsByAuthorRequest.new(author_profile_id: guest)).list_reviews_by_author
    mine = handler_for(::Review::V1::ListMyReviewsRequest.new).list_my_reviews
    recent = handler_for(::Review::V1::ListRecentReviewsRequest.new).list_recent_reviews

    expect([by_author.reviews.map(&:id), mine.reviews.map(&:id), recent.reviews.map(&:id)]).to eq([[id], [id], [id]])
    expect([mine.counts.total_count, mine.counts.open_count, mine.counts.closed_count]).to eq([1, 1, 0])
  end

  it "adds, updates and deletes events" do
    act_as(guest_account, guest)
    id = create_review.id
    service = ::Review::V1::ReviewEventInput.new(stage: :REVIEW_STAGE_SERVICE, outcome: "satisfied", occurred_on: "2026-10-02")

    added = handler_for(::Review::V1::AddReviewEventRequest.new(review_id: id, event: service)).add_review_event.review
    event_id = added.events.last.id
    updated = handler_for(::Review::V1::UpdateReviewEventRequest.new(event_id: event_id, event: service.dup.tap { |e| e.outcome = "completed_with_issues" })).update_review_event.review
    remaining = handler_for(::Review::V1::DeleteReviewEventRequest.new(event_id: event_id)).delete_review_event.review

    expect([added.events.length, updated.events.last.outcome, remaining.events.length]).to eq([2, "completed_with_issues", 1])
  end
end
```

- [ ] **Step 5: Update the cross-slice specs**

`spec/slices/post/cross_slice_wiring_spec.rb`: 2 つの例（`filters review author references ...` と `filters review entry author references ...`）を次の 1 つに置き換える。

```ruby
  it "filters review author references through the post visibility filter" do
    refs = [public_author, private_author].map { |id| Review::UseCases::FilterVisibleReviews::AuthorRef.new(id) }

    visible = Social::Slice["use_cases.filter_visible_posts"].call(viewer_profile_id: viewer, posts: refs)

    expect(visible.map(&:author_profile_id)).to eq([public_author])
  end
```

`spec/slices/identity/use_cases/account/purge_wiring_spec.rb`:
- `let(:review_repo) { Review::Slice["repositories.entry_repository"] }` を `Review::Slice["repositories.review_repository"]` にする
- `review_repo.create(author_profile_id: X, target_profile_id: Y, rating: 4.0, body: "...")` の 3 行を、それぞれ `review_repo.create(author_account_id: <X のアカウント>, author_profile_id: X, target_profile_id: Y, rating: nil, occurred_on: Date.new(2026, 10, 1))` にする。`<X のアカウント>` は、`bystander` なら `bystander_account_id`、`persona_b` なら `account_id`
- `db[:review__entries]` の 2 箇所を `db[:review__reviews]` にする

`spec/slices/social/rpc_and_cross_slice_wiring_spec.rb`: 例 `lets the review use cases ask the post visibility filter whether a page owner is reachable` を次に置き換える。

```ruby
    it "lets the review use cases ask the post visibility filter whether a page owner is reachable" do
      review = Struct.new(:author_profile_id, :target_profile_id)
      filter = Review::Slice["use_cases.filter_visible_reviews"]

      on_public_page = filter.call(viewer_profile_id: viewer, page_owner_profile_id: public_cast, reviews: [review.new(other_guest, public_cast)])
      on_private_page = filter.call(viewer_profile_id: viewer, page_owner_profile_id: private_cast, reviews: [review.new(other_guest, private_cast)])
      recent = filter.recent(viewer_profile_id: viewer, reviews: [review.new(other_guest, public_cast), review.new(other_guest, private_cast)])

      expect(on_public_page.length).to eq(1)
      expect(on_private_page).to eq([])
      expect(recent.map(&:target_profile_id)).to eq([public_cast])
    end
```

`spec/slices/profile/visibility_wiring_spec.rb`:
- `let(:review_repo)` を `Review::Slice["repositories.review_repository"]` にし、`write_review = ->(author, target) { review_repo.create(author_account_id: db[:profile__profiles].where(id: author).get(:account_id), author_profile_id: author, target_profile_id: target, rating: nil, occurred_on: Date.new(2026, 10, 1)) }` を `let` で足す
- `review_repo.create(author_profile_id: A, target_profile_id: B, rating: ..., body: ...)` をすべて `write_review.call(A, B)` に替える
- `list_entries_by_target` / `ListEntriesByTargetRequest` → `list_reviews_by_target` / `ListReviewsByTargetRequest`、`list_entries_by_author` / `ListEntriesByAuthorRequest` → `list_reviews_by_author` / `ListReviewsByAuthorRequest`、`list_recent_entries` / `ListRecentEntriesRequest` → `list_recent_reviews` / `ListRecentReviewsRequest`、応答の `.entries` → `.reviews`
- `create_entry` の例は `rpc(Review::Grpc::ReviewHandler, :create_review, Review::V1::CreateReviewRequest.new(target_profile_id: ghost, event: Review::V1::ReviewEventInput.new(stage: :REVIEW_STAGE_SERVICE, outcome: "satisfied", occurred_on: "2026-10-01")))` にし、`INVALID_ARGUMENT` を期待する（閲覧者 `viewer` はゲスト）
- 例 `leaves a review with it out of reach for the other party` を次に置き換える

```ruby
    it "leaves a review with it out of reach for the other party" do
      about_ghost = db[:review__reviews].where(author_profile_id: viewer, target_profile_id: ghost).get(:id)
      invalid = GRPC::Core::StatusCodes::INVALID_ARGUMENT

      act_as(viewer)
      expect { rpc(Review::Grpc::ReviewHandler, :get_review, Review::V1::GetReviewRequest.new(review_id: about_ghost)) }.to status(invalid)
      expect { rpc(Review::Grpc::ReviewHandler, :update_review_rating, Review::V1::UpdateReviewRatingRequest.new(review_id: about_ghost, rating: 1)) }.to status(invalid)
      expect { rpc(Review::Grpc::ReviewHandler, :delete_review, Review::V1::DeleteReviewRequest.new(review_id: about_ghost)) }.to status(invalid)
      expect(db[:review__reviews].where(id: about_ghost).count).to eq(1)
    end
```

- [ ] **Step 6: Run the whole monolith suite**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec > <scratchpad>/rspec.log 2>&1; tail -40 <scratchpad>/rspec.log`
Expected: 0 failures。並び順に依存する既存 spec が 1 回だけ落ちた場合は、その spec を単独で 3 回実行して再現しないことを確かめる

- [ ] **Step 7: Commit**

```bash
git add -A dystopia/monolith
git commit -s -m "feat(dystopia): serve the review lifecycle over grpc and drop the entry use cases

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 10: Frontend data layer (types, catalog, mappers, BFF)

**Files:**
- Delete: `dystopia/frontend/src/modules/review/` 配下のすべて、`src/app/api/review/` 配下のすべて、`src/app/settings/reviews/`
- Create（カルテからコピー）: `src/modules/review/types.ts`、`lib/mappers.ts`、`lib/input.ts`、`lib/uniqueReviews.ts`、`lib/revalidate.ts` とそれぞれのテスト、`src/app/api/review/` の route 一式（`review-response.ts`、`route.ts`、`[id]/route.ts`、`[id]/rating`、`[id]/close`、`[id]/reopen`、`[id]/events`、`events/[eventId]`、`by-target`、`my`、`recent`）と `routes.test.ts`
- Create: `src/modules/review/lib/catalog.ts`、`catalog.test.ts`、`src/app/api/review/by-author/route.ts`

**Interfaces:**
- Produces（`@/modules/review/types`）: `ReviewStage`、`ReviewStatus`、`ReviewEvent`、`Review`、`ReviewEventInput`、`RatingSummary { averageRating: number | null; raterCount: number; reviewCount: number }`、`ReviewPage { reviews; nextCursor; hasMore }`、`ReviewsByTargetPage extends ReviewPage { summary }`、`ReviewCounts`、`MyReviewPage extends ReviewPage { counts }`
- Produces（catalog）: `REVIEW_STAGES`、`REVIEW_OUTCOMES`、`REVIEW_TAGS`、`MAX_NOTE_LENGTH`、`isNoteRequired`、`stageLabel`、`outcomeLabel`、`tagLabel`
- Produces（BFF）: `GET/POST /api/review`、`GET/DELETE /api/review/[id]`、`PATCH /api/review/[id]/rating`、`POST /api/review/[id]/close`、`POST /api/review/[id]/reopen`、`POST /api/review/[id]/events`、`PATCH/DELETE /api/review/events/[eventId]`、`GET /api/review/by-target?profile_id=`、`GET /api/review/by-author?profile_id=`、`GET /api/review/my`、`GET /api/review/recent`。応答の JSON は `{ review }`、一覧は `{ reviews, nextCursor, hasMore }` に `summary` か `counts` を足したもの

- [ ] **Step 1: Remove the old review frontend and copy the karte data layer**

```bash
cd dystopia/frontend/src
git rm -rq modules/review app/api/review app/settings/reviews
cat > <scratchpad>/review-map.sed <<'EOF'
s/このゲストのカルテを書く/このキャストのクチコミを書く/g
s/ゲストのプロフィールを見る/キャストのプロフィールを見る/g
s#KARTE / キャストからゲストへ#クチコミ / ゲストからキャストへ#g
s#KARTE / #クチコミ / #g
s/すべてのキャストに共有/全員に公開/g
s/予約から接客後までの記録/予約から利用後までの記録/g
s/予約・接客の信頼性（参考評価）/利用の満足度（参考評価）/g
s/予約・接客の信頼性/利用の満足度/g
s/記録者 /書いた人 /g
s/カルテ/クチコミ/g
s/接客後/利用後/g
s/接客/利用/g
s/連絡が円滑/返信が早い/g
s/返信・連絡に問題あり/返信が遅い・途絶えた/g
s/事前連絡あり/料金・条件の説明が明確/g
s/合意していない要求あり/対応が丁寧/g
s/無断キャンセル・来店なし/キャストの無断キャンセル・不在/g
s/キャンセル（連絡あり）/キャストからキャンセル（連絡あり）/g
s/問題なく完了/満足して終了/g
s/問題はあったが完了/不満はあったが終了/g
s/途中終了/途中で終了/g
s/時間遵守/時間どおり/g
s/支払いに問題なし/写真・プロフィールどおり/g
s/支払いトラブルあり/写真・プロフィールと違う/g
s/コミュニケーションが円滑/接客が丁寧/g
s/合意条件を超える要求あり/合意していない料金・要求あり/g
s/問題なく対応終了/問題なく終了/g
s/約束した条件と異なる要求/約束と異なる要求/g
s/smooth_contact/quick_reply/g
s/contact_problem/slow_reply/g
s/advance_notice/clear_conditions/g
s/unagreed_request/polite_response/g
s/cancelled_with_notice/cancelled_by_cast/g
s/"no_show"/"cast_no_show"/g
s/"completed"/"satisfied"/g
s/payment_ok/as_pictured/g
s/payment_trouble/not_as_pictured/g
s/smooth_communication/attentive/g
s/excessive_request/unagreed_charge/g
s/useGuestKarte/useCastReviews/g
s/useRecentKarte/useRecentReviews/g
s/useMyKarte/useMyReviews/g
s/GuestKarteTab/CastReviewsTab/g
s/KartesByTargetPage/ReviewsByTargetPage/g
s/ReliabilitySummary/RatingSummary/g
s/KarteReliabilityHeader/ReviewSummaryHeader/g
s/mapReliabilityToView/mapSummaryToView/g
s/reliability/summary/g
s/Reliability/Summary/g
s/KarteGuest/ReviewCast/g
s/Kartes/Reviews/g
s/kartes/reviews/g
s/Karte/Review/g
s/karte/review/g
s/KARTE/REVIEW/g
EOF
copy() { mkdir -p "$(dirname "$2")"; sed -f <scratchpad>/review-map.sed "$1" > "$2"; }
for f in types.ts lib/mappers.ts lib/mappers.test.ts lib/input.ts lib/input.test.ts lib/revalidate.ts lib/revalidate.test.tsx; do copy modules/karte/$f modules/review/$f; done
copy modules/karte/lib/uniqueKartes.ts modules/review/lib/uniqueReviews.ts
copy modules/karte/lib/uniqueKartes.test.ts modules/review/lib/uniqueReviews.test.ts
for f in $(cd app/api/karte && /usr/bin/find . -type f | sed 's#^\./##'); do copy "app/api/karte/$f" "app/api/review/$(echo "$f" | sed -f <scratchpad>/review-map.sed)"; done
ls app/api/review app/api/review/*
```

Expected: `app/api/review` に `review-response.ts`・`route.ts`・`routes.test.ts`・`[id]`・`by-target`・`events`・`my`・`recent` がある

- [ ] **Step 2: Write the catalog and its test**

`modules/review/lib/catalog.ts`:

```ts
import type { ReviewStage } from "../types";

export interface ReviewChoice {
  code: string;
  label: string;
}

export const REVIEW_STAGES: { code: ReviewStage; label: string }[] = [
  { code: "reservation", label: "予約・問い合わせ" },
  { code: "service", label: "利用" },
  { code: "aftercare", label: "利用後" },
];

export const REVIEW_OUTCOMES: Record<ReviewStage, ReviewChoice[]> = {
  reservation: [
    { code: "inquiry_only", label: "問い合わせのみ" },
    { code: "booked", label: "予約成立" },
    { code: "cancelled_by_cast", label: "キャストからキャンセル（連絡あり）" },
    { code: "cast_no_show", label: "キャストの無断キャンセル・不在" },
    { code: "other", label: "その他" },
  ],
  service: [
    { code: "satisfied", label: "満足して終了" },
    { code: "completed_with_issues", label: "不満はあったが終了" },
    { code: "ended_early", label: "途中で終了" },
    { code: "other", label: "その他" },
  ],
  aftercare: [
    { code: "closed_without_issues", label: "問題なく終了" },
    { code: "next_booking_inquiry", label: "次回予約の相談" },
    { code: "inquiry_handled", label: "問い合わせ対応" },
    { code: "trouble_occurred", label: "トラブル発生" },
    { code: "trouble_resolved", label: "トラブル解決" },
    { code: "other", label: "その他" },
  ],
};

export const REVIEW_TAGS: Record<ReviewStage, ReviewChoice[]> = {
  reservation: [
    { code: "quick_reply", label: "返信が早い" },
    { code: "slow_reply", label: "返信が遅い・途絶えた" },
    { code: "clear_conditions", label: "料金・条件の説明が明確" },
    { code: "condition_mismatch", label: "予約条件の認識違い" },
    { code: "rescheduled", label: "日程変更あり" },
    { code: "polite_response", label: "対応が丁寧" },
  ],
  service: [
    { code: "punctual", label: "時間どおり" },
    { code: "late", label: "遅刻あり" },
    { code: "as_pictured", label: "写真・プロフィールどおり" },
    { code: "not_as_pictured", label: "写真・プロフィールと違う" },
    { code: "attentive", label: "接客が丁寧" },
    { code: "unagreed_charge", label: "合意していない料金・要求あり" },
  ],
  aftercare: [
    { code: "polite_contact", label: "丁寧な連絡あり" },
    { code: "excessive_contact", label: "連絡が頻繁・執拗" },
    { code: "condition_change_request", label: "約束と異なる要求" },
    { code: "resolved", label: "問題が解決した" },
  ],
};

const NOTE_REQUIRED_OUTCOMES: Record<ReviewStage, string[]> = {
  reservation: ["cast_no_show"],
  service: ["ended_early"],
  aftercare: ["trouble_occurred"],
};

export const MAX_NOTE_LENGTH = 500;

export function isNoteRequired(stage: ReviewStage, outcome: string): boolean {
  return NOTE_REQUIRED_OUTCOMES[stage].includes(outcome);
}

export function stageLabel(stage: ReviewStage): string {
  return REVIEW_STAGES.find((choice) => choice.code === stage)?.label ?? stage;
}

// A code dropped from the catalog may still sit in older events, so show the code instead of failing.
export function outcomeLabel(stage: ReviewStage, code: string): string {
  return REVIEW_OUTCOMES[stage].find((choice) => choice.code === code)?.label ?? code;
}

export function tagLabel(stage: ReviewStage, code: string): string {
  return REVIEW_TAGS[stage].find((choice) => choice.code === code)?.label ?? code;
}
```

`modules/review/lib/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { REVIEW_OUTCOMES, REVIEW_STAGES, REVIEW_TAGS, isNoteRequired, outcomeLabel, stageLabel, tagLabel } from "./catalog";

describe("review catalog", () => {
  it("names the stages from the guest's side", () => {
    expect(REVIEW_STAGES.map((stage) => stage.label)).toEqual(["予約・問い合わせ", "利用", "利用後"]);
  });

  it("holds the codes of the spec for each stage", () => {
    expect(REVIEW_OUTCOMES.reservation.map((c) => c.code)).toEqual(["inquiry_only", "booked", "cancelled_by_cast", "cast_no_show", "other"]);
    expect(REVIEW_OUTCOMES.service.map((c) => c.code)).toEqual(["satisfied", "completed_with_issues", "ended_early", "other"]);
    expect(REVIEW_OUTCOMES.aftercare.map((c) => c.code)).toEqual(["closed_without_issues", "next_booking_inquiry", "inquiry_handled", "trouble_occurred", "trouble_resolved", "other"]);
    expect(REVIEW_TAGS.reservation.map((c) => c.code)).toEqual(["quick_reply", "slow_reply", "clear_conditions", "condition_mismatch", "rescheduled", "polite_response"]);
    expect(REVIEW_TAGS.service.map((c) => c.code)).toEqual(["punctual", "late", "as_pictured", "not_as_pictured", "attentive", "unagreed_charge"]);
    expect(REVIEW_TAGS.aftercare.map((c) => c.code)).toEqual(["polite_contact", "excessive_contact", "condition_change_request", "resolved"]);
  });

  it("requires a note only for the serious outcomes", () => {
    expect(isNoteRequired("reservation", "cast_no_show")).toBe(true);
    expect(isNoteRequired("service", "ended_early")).toBe(true);
    expect(isNoteRequired("aftercare", "trouble_occurred")).toBe(true);
    expect(isNoteRequired("service", "satisfied")).toBe(false);
  });

  it("labels codes and falls back to the code for an unknown one", () => {
    expect(stageLabel("service")).toBe("利用");
    expect(outcomeLabel("service", "satisfied")).toBe("満足して終了");
    expect(tagLabel("service", "late")).toBe("遅刻あり");
    expect(outcomeLabel("service", "gone")).toBe("gone");
  });
});
```

- [ ] **Step 3: Add the by-author route**

`app/api/review/by-author/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { reviewClient } from "@/lib/grpc";
import { buildGrpcHeaders } from "@/lib/request";
import { handleApiError, requireAuth } from "@/lib/api-helpers";
import { mapReviewToView } from "@/modules/review/lib/mappers";

export async function GET(req: NextRequest) {
  try {
    const authError = requireAuth(req);
    if (authError) return authError;
    const authorProfileId = req.nextUrl.searchParams.get("profile_id") || "";
    if (!authorProfileId) {
      return NextResponse.json({ error: "profile_id required" }, { status: 400 });
    }
    const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
    const cursor = req.nextUrl.searchParams.get("cursor") || "";
    const res = await reviewClient.listReviewsByAuthor({ authorProfileId, limit, cursor }, { headers: await buildGrpcHeaders(req) });
    return NextResponse.json({
      reviews: (res.reviews || []).map(mapReviewToView),
      nextCursor: res.nextCursor || "",
      hasMore: !!res.hasMore,
    });
  } catch (error: unknown) {
    return handleApiError(error, "ListReviewsByAuthor");
  }
}
```

`app/api/review/routes.test.ts` を開き、`by-target` の例を複製して `by-author` の例を足す（`listReviewsByAuthor` が `{ authorProfileId: "author-1", limit: 20, cursor: "" }` で呼ばれ、応答に `summary` を含まないこと）。

- [ ] **Step 4: Run the data layer tests**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/review src/app/api/review`
Expected: PASS。失敗したら、まず失敗の原因が sed の変換漏れ（`karte` / `カルテ` の残り、catalog にないコード）かを `/usr/bin/grep -rn "karte\|Karte\|カルテ" src/modules/review src/app/api/review` で確かめ、テストの期待値を本 plan の catalog に合わせて直す。部品やテストの振る舞いの意図は変えない

- [ ] **Step 5: Commit**

frontend の他の部分（画面）はまだ旧 module を参照していて `tsc` は通らない。Task 13 で直す。

```bash
git add -A dystopia/frontend/src/modules/review dystopia/frontend/src/app/api/review dystopia/frontend/src/app/settings
git commit -s -m "feat(dystopia): rebuild the review data layer around lifecycle reviews

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 11: Hooks

**Files:**
- Create（カルテからコピー）: `src/modules/review/hooks/index.ts`、`useReview.ts`、`useCastReviews.ts`、`useMyReviews.ts`、`useRecentReviews.ts`、`useReviewMutations.ts` と、`useKarte.test.tsx`・`useMyKarte.test.ts`・`useKarteMutations.test.ts` のコピー
- Create: `src/modules/review/hooks/useAuthorReviews.ts`、`useAuthorReviews.test.ts`

**Interfaces:**
- Produces:
  - `useReview(reviewId: string | null, initial?: Review)` → `{ review, gone, error, refresh, apply }`
  - `useCastReviews(targetProfileId)` → `{ reviews, summary, hasMore, loading, error, loadMore, refresh }`
  - `useAuthorReviews(authorProfileId)` → `{ reviews, hasMore, loading, error, loadMore, refresh }`
  - `useMyReviews()` → `{ reviews, counts, hasMore, loading, error, loadMore, refresh }`（ゲストのときだけ取得する）
  - `useRecentReviews(enabled: boolean)` → `{ reviews, hasMore, loading, error, loadMore, refresh }`
  - `useReviewMutations()` → `{ create, updateRating, close, reopen, addEvent, updateEvent, removeEvent, remove, loading, error }`

- [ ] **Step 1: Copy the hooks**

```bash
cd dystopia/frontend/src
copy() { mkdir -p "$(dirname "$2")"; sed -f <scratchpad>/review-map.sed "$1" > "$2"; }
copy modules/karte/hooks/index.ts modules/review/hooks/index.ts
copy modules/karte/hooks/useKarte.ts modules/review/hooks/useReview.ts
copy modules/karte/hooks/useKarte.test.tsx modules/review/hooks/useReview.test.tsx
copy modules/karte/hooks/useGuestKarte.ts modules/review/hooks/useCastReviews.ts
copy modules/karte/hooks/useMyKarte.ts modules/review/hooks/useMyReviews.ts
copy modules/karte/hooks/useMyKarte.test.ts modules/review/hooks/useMyReviews.test.ts
copy modules/karte/hooks/useRecentKarte.ts modules/review/hooks/useRecentReviews.ts
copy modules/karte/hooks/useKarteMutations.ts modules/review/hooks/useReviewMutations.ts
copy modules/karte/hooks/useKarteMutations.test.ts modules/review/hooks/useReviewMutations.test.ts
```

- [ ] **Step 2: Fix the role gate and the names**

1. `modules/review/hooks/index.ts` を次にする

```ts
export { useCastReviews } from "./useCastReviews";
export { useAuthorReviews } from "./useAuthorReviews";
export { useMyReviews } from "./useMyReviews";
export { useRecentReviews } from "./useRecentReviews";
export { useReviewMutations } from "./useReviewMutations";
export { useReview } from "./useReview";
```

2. `useMyReviews.ts` の `role !== "cast"` を `role !== "guest"` にする（自分のクチコミはゲストだけが持つ）。`useMyReviews.test.ts` の役割の期待値（`"cast"` で取得し、`"guest"` で取得しない）を逆にする
3. `useCastReviews.ts` の `/api/review/by-target` の URL はそのまま。戻り値のキー `summary` と `NO_SUMMARY`（`{ averageRating: null, raterCount: 0, reviewCount: 0 }`）になっていることを確かめる

- [ ] **Step 3: Write `useAuthorReviews` and its test**

`modules/review/hooks/useAuthorReviews.ts`:

```ts
"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/swr";
import { useAuthStore } from "@/stores/authStore";
import { useReviewRevalidation } from "../lib/revalidate";
import { uniqueReviews } from "../lib/uniqueReviews";
import type { ReviewPage } from "../types";

export function useAuthorReviews(authorProfileId: string | null | undefined) {
  const profileId = useAuthStore((s) => s.activeProfileId);

  const getKey = (pageIndex: number, prev: ReviewPage | null): string | null => {
    if (!profileId || !authorProfileId) return null;
    if (prev && !prev.hasMore) return null;
    const base = `/api/review/by-author?profile_id=${encodeURIComponent(authorProfileId)}`;
    const cursorQs = pageIndex === 0 ? "" : `&cursor=${encodeURIComponent(prev?.nextCursor || "")}`;
    return `${base}${cursorQs}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<ReviewPage>(getKey, fetcher, { revalidateOnFocus: false });
  useReviewRevalidation(mutate);

  const pages = data || [];
  return {
    reviews: uniqueReviews(pages.flatMap((p) => p.reviews || [])),
    hasMore: pages.length > 0 ? !!pages[pages.length - 1].hasMore : false,
    loading: isLoading || isValidating,
    error,
    loadMore: () => setSize(size + 1),
    refresh: () => mutate(),
  };
}
```

`modules/review/hooks/useAuthorReviews.test.ts`: `useMyReviews.test.ts` と同じ setup（`fetcher` と `useAuthStore` のモック）で、次の 2 例を書く。
- 書き手のプロフィール id を渡すと `/api/review/by-author?profile_id=author-1` を取得し、`reviews` に応答の `reviews` を返す
- 書き手のプロフィール id が `null` なら取得しない（`fetcher` が呼ばれない）

`useReviewRevalidation` は `lib/revalidate.ts` のコピーで改名されている名前。違う名前になっていたら `lib/revalidate.ts` の export 名に合わせる。

- [ ] **Step 4: Run the hook tests**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/review/hooks`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A dystopia/frontend/src/modules/review/hooks
git commit -s -m "feat(dystopia): add the review hooks for cast, author, own and recent lists

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 12: Components

**Files:**
- Create（カルテからコピー）: `src/modules/review/components/ReviewCard.tsx`、`ReviewList.tsx`、`ReviewDetailSheet.tsx`、`ReviewEventForm.tsx`、`ReviewCreateForm.tsx`、`ReviewSummaryHeader.tsx` と、それぞれのテスト（`KarteCard.test.tsx`・`KarteList.test.tsx`・`KarteDetailSheet.test.tsx`・`KarteDetailSheet.delete.test.tsx`・`KarteEventForm.test.tsx`・`KarteCreateForm.test.tsx`・`KarteReliabilityHeader.test.tsx` のコピー）
- Create: `src/modules/review/components/CastReviewsTab.tsx`、`CastReviewsTab.test.tsx`、`AuthorReviewsTab.tsx`、`AuthorReviewsTab.test.tsx`

**Interfaces:**
- Consumes: Task 11 の hook
- Produces:
  - `ReviewList({ reviews, variant: "feed" | "cast" | "mine", hasMore, loading, onLoadMore, empty })`
  - `ReviewCreateForm({ target, event, onEventChange, rating, onRatingChange, onCreated })`、`emptyReviewEvent(today?)`（`ReviewEventForm.tsx` から export）
  - `CastReviewsTab({ cast: SocialProfileView })`、`AuthorReviewsTab({ authorProfileId: string })`

- [ ] **Step 1: Copy the components**

```bash
cd dystopia/frontend/src
cat >> <scratchpad>/review-component-map.sed <<'EOF'
s/variant="guest"/variant="cast"/g
s/"feed" | "guest" | "mine"/"feed" | "cast" | "mine"/g
s/variant !== "guest"/variant !== "cast"/g
s/\bguest\b/cast/g
s/\bGuest\b/Cast/g
EOF
copy() { mkdir -p "$(dirname "$2")"; sed -f <scratchpad>/review-map.sed "$1" | sed -E -f <scratchpad>/review-component-map.sed > "$2"; }
for name in KarteCard KarteList KarteDetailSheet KarteEventForm KarteCreateForm; do
  new=$(echo $name | sed 's/Karte/Review/')
  copy modules/karte/components/$name.tsx modules/review/components/$new.tsx
done
copy modules/karte/components/KarteReliabilityHeader.tsx modules/review/components/ReviewSummaryHeader.tsx
for t in KarteCard KarteList KarteDetailSheet KarteDetailSheet.delete KarteEventForm KarteCreateForm; do
  new=$(echo $t | sed 's/Karte/Review/')
  copy modules/karte/components/$t.test.tsx modules/review/components/$new.test.tsx
done
copy modules/karte/components/KarteReliabilityHeader.test.tsx modules/review/components/ReviewSummaryHeader.test.tsx
/usr/bin/grep -rn "karte\|Karte\|カルテ\|ゲストからキャスト" modules/review/components | /usr/bin/grep -v "ゲストからキャストへ"
```

Expected: 最後の grep が何も出さない。`ReviewEventForm.tsx` の `KarteGuest` は `ReviewCast` に、prop `guest` は `cast` に、`emptyKarteEvent`・`isKarteEventReady` は `emptyReviewEvent`・`isReviewEventReady` になっている

- [ ] **Step 2: Adjust the summary header copy**

`ReviewSummaryHeader.tsx` の `reliability.karteCount` が `summary.reviewCount` に、文言が「利用の満足度（参考評価）」と「{N}人が評価 · {M}件の完了済みクチコミ」になっていることを確かめる。

`ReviewCreateForm.tsx` の `submitLabel` が「記録中のクチコミを作成」になっていることを確かめる。

- [ ] **Step 3: Write `CastReviewsTab` and `AuthorReviewsTab` with tests**

`modules/review/components/CastReviewsTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import type { SocialProfileView } from "@/modules/social/types";
import { useAuthStore, selectActiveProfileId, selectRole } from "@/stores/authStore";
import { useCastReviews } from "../hooks/useCastReviews";
import { ReviewList } from "./ReviewList";
import { ReviewSummaryHeader } from "./ReviewSummaryHeader";

interface Composing {
  session: number;
  open: boolean;
}

export function CastReviewsTab({ cast }: { cast: SocialProfileView }) {
  const viewerRole = useAuthStore(selectRole);
  const viewerId = useAuthStore(selectActiveProfileId);
  const { reviews, summary, hasMore, loading, loadMore } = useCastReviews(cast.profileId);
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<Composing | null>(null);
  const canWrite = viewerRole === "guest" && viewerId !== cast.profileId;

  return (
    <div>
      <ReviewSummaryHeader summary={summary} />
      <ReviewList reviews={reviews} variant="cast" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="クチコミはまだありません" />
      {canWrite && (
        <div className="px-4 py-4">
          <Button
            type="button"
            className="w-full"
            onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
          >
            このキャストのクチコミを書く
          </Button>
        </div>
      )}
      {composing && (
        <ComposeToSheet
          key={composing.session}
          kind="review"
          open={composing.open}
          initialTarget={cast}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </div>
  );
}
```

`modules/review/components/AuthorReviewsTab.tsx`:

```tsx
"use client";

import { useAuthorReviews } from "../hooks/useAuthorReviews";
import { ReviewList } from "./ReviewList";

export function AuthorReviewsTab({ authorProfileId }: { authorProfileId: string }) {
  const { reviews, hasMore, loading, loadMore } = useAuthorReviews(authorProfileId);

  return <ReviewList reviews={reviews} variant="feed" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="クチコミはまだありません" />;
}
```

`CastReviewsTab.test.tsx`: `modules/karte/components/GuestKarteTab.test.tsx` を読み、同じモックの形（hook と `ComposeToSheet` のモック）で次を確かめる。
- 要約の見出しとカードの一覧を出す
- ゲストの閲覧者には「このキャストのクチコミを書く」を出し、押すと `ComposeToSheet` が `kind="review"` と `initialTarget` で開く
- キャストの閲覧者と、キャスト本人には「このキャストのクチコミを書く」を出さない

`AuthorReviewsTab.test.tsx`: `useAuthorReviews` をモックし、渡したプロフィール id で呼ばれることと、0 件のとき「クチコミはまだありません」を出すことを確かめる。

- [ ] **Step 4: Run the component tests**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/review/components`
Expected: PASS。失敗したら Task 10 Step 4 と同じ手順で、変換漏れとテストの期待値を本 plan の文言に合わせて直す

- [ ] **Step 5: Commit**

```bash
git add -A dystopia/frontend/src/modules/review/components
git commit -s -m "feat(dystopia): add the review cards, detail sheet, form and tabs

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 13: Screens, compose and labels

**Files:**
- Modify: `src/app/page.tsx`、`src/app/page.test.tsx`、`src/app/page.tabs.test.tsx`、`src/app/page.feed-fetch.test.tsx`
- Modify: `src/app/u/[username]/page.tsx`、`page.test.tsx`
- Modify (rewrite): `src/app/reviews/my/page.tsx`、`page.test.tsx`
- Modify: `src/components/compose/ComposeToSheet.tsx`、`ComposeToSheet.test.tsx`、`compose-icons.tsx`、`resolveRecipientSource.ts`、`ComposeLauncher.test.tsx`
- Modify: `src/components/shell/BottomTab.tsx`、`BottomTab.test.tsx`、`resolveNavItems.ts`
- Modify: `src/modules/landing/components/LandingGuestSections.tsx`、`src/modules/profile/components/ProfileManager.tsx`、`src/modules/onboarding/components/FeatureTourModal.tsx`、`FeatureTourModal.test.tsx`、`src/modules/post/components/ProfileContentTabs.order.test.tsx`
- Delete（使われなくなったら）: `src/components/ui/entry-edit-form.tsx`、`entry-edit-form.test.tsx`

**Interfaces:**
- Consumes: Task 11・Task 12 の hook と部品

- [ ] **Step 1: Rename the labels**

```bash
cd dystopia/frontend/src
sed -i '' 's/レビュー/クチコミ/g' components/shell/BottomTab.tsx components/shell/BottomTab.test.tsx components/shell/resolveNavItems.ts \
  components/compose/compose-icons.tsx components/compose/ComposeLauncher.test.tsx components/compose/resolveRecipientSource.ts \
  modules/landing/components/LandingGuestSections.tsx modules/profile/components/ProfileManager.tsx \
  modules/post/components/ProfileContentTabs.order.test.tsx
sed -i '' 's/ゲストについて書いたレビューの管理・共有/ゲストについての記録の管理・共有/' modules/onboarding/components/FeatureTourModal.tsx modules/onboarding/components/FeatureTourModal.test.tsx
```

`resolveRecipientSource.ts` のレビューの title は「クチコミを書くキャストを選ぶ」にする（`sed` の結果は「クチコミするキャストを選ぶ」になるので直す）。

- [ ] **Step 2: Compose sheet**

`components/compose/ComposeToSheet.tsx`:
- import の `ReviewComposer` を削除し、次を足す

```tsx
import { emptyReviewEvent } from "@/modules/review/components/ReviewEventForm";
import { ReviewCreateForm } from "@/modules/review/components/ReviewCreateForm";
import type { ReviewEventInput } from "@/modules/review/types";
```

- `COMPOSE_TITLE` と `SAVED_MESSAGE` を次にする

```tsx
const COMPOSE_TITLE = { karte: "カルテを書く", review: "クチコミを書く" } as const;
const SAVED_MESSAGE = { karte: "記録中のカルテを作成しました", review: "記録中のクチコミを作成しました" } as const;
```

- `karteRating` の state の下に次を足す

```tsx
  const [reviewEvent, setReviewEvent] = useState<ReviewEventInput>(() => emptyReviewEvent());
  const [reviewRating, setReviewRating] = useState<number | null>(null);
```

- `composeKind === "review"` のブロック（`Avatar` の行と `ReviewComposer`）を次に替え、使われなくなった `Avatar` の import を削除する

```tsx
      {target && composeKind === "review" && (
        <ReviewCreateForm
          target={target}
          event={reviewEvent}
          onEventChange={setReviewEvent}
          rating={reviewRating}
          onRatingChange={setReviewRating}
          onCreated={saved}
        />
      )}
```

`ComposeToSheet.test.tsx` の `ReviewComposer` のモックを `ReviewCreateForm` のモックに替え、「クチコミを書く」の見出しを期待する。

- [ ] **Step 3: Home**

`app/page.tsx`:
- import の `ReviewList`（旧）と `useRecentReviews`（旧）を `import { useRecentReviews } from "@/modules/review/hooks/useRecentReviews";` と `import { ReviewList } from "@/modules/review/components/ReviewList";` に替える（パスは同じ。中身が新しくなる）
- `items.push({ id: "reviews", label: "レビュー" });` を `label: "クチコミ"` にする
- `reviewsContent` を次にする

```tsx
  const reviewsContent = useMemo(
    () => (
      <div>
        <p className="px-4 py-3 text-sm text-text-secondary">ゲストがキャストについて残した新着のクチコミです。</p>
        {reviews.error ? (
          <p className="px-4 py-3 text-sm text-error">読み込みに失敗しました</p>
        ) : (
          <ReviewList
            reviews={reviews.reviews}
            variant="feed"
            hasMore={reviews.hasMore}
            loading={reviews.loading}
            onLoadMore={reviews.loadMore}
            empty="まだクチコミがありません"
          />
        )}
      </div>
    ),
    [reviews.error, reviews.reviews, reviews.hasMore, reviews.loading, reviews.loadMore]
  );
```

`karteContent` の error 表示の文言・class が上と違う場合は、`karteContent` と同じものにそろえる。

`app/page.test.tsx`・`page.tabs.test.tsx`・`page.feed-fetch.test.tsx` の「レビュー」を「クチコミ」に、「ゲストがキャストに残した新着レビューです。」を「ゲストがキャストについて残した新着のクチコミです。」に、`useRecentReviews` のモックの戻り値の `entries` を `reviews` に替える。

- [ ] **Step 4: Profile tabs**

`app/u/[username]/page.tsx`:
- import の `ReviewsTab` を `import { CastReviewsTab } from "@/modules/review/components/CastReviewsTab";` と `import { AuthorReviewsTab } from "@/modules/review/components/AuthorReviewsTab";` に替える
- キャストのプロフィールの reviews タブを `{ id: "reviews", label: "クチコミ", content: <CastReviewsTab cast={{ ...guestView, role: "cast" }} /> }` にする
- ゲストのプロフィールの extraTabs を `[{ id: "reviews", label: "クチコミ", content: <AuthorReviewsTab authorProfileId={profile.id} /> }]` にする

`app/u/[username]/page.test.tsx` の `ReviewsTab` のモックを 2 つの部品のモックに替え、「レビュー」を「クチコミ」に替える（「受信レビュー」「書いたレビュー」を出さない確認は「受信クチコミ」「書いたクチコミ」にする）。

- [ ] **Step 5: My reviews page**

`app/reviews/my/page.tsx` を次にする（`app/karte/my/page.tsx` と同じ構成）。

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import { useMyReviews } from "@/modules/review/hooks/useMyReviews";
import { ReviewList } from "@/modules/review/components/ReviewList";
import { useAuthStore, selectIsHydrated, selectRole } from "@/stores/authStore";

export function MyReviewsHeader() {
  return <PageHeader title="自分のクチコミ" description="自分が書いたクチコミの一覧。ホームの「クチコミ」は全員の新着です。" />;
}

interface Composing {
  session: number;
  open: boolean;
}

export default function MyReviewsPage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { reviews, counts, hasMore, loading, loadMore } = useMyReviews();
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<Composing | null>(null);

  if (!isHydrated) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }

  if (role !== "guest") {
    return (
      <div className="p-4 text-sm">
        <p>クチコミはゲストだけが書けます。</p>
        <Link href="/" className="mt-3 inline-block text-accent">ホームに戻る</Link>
      </div>
    );
  }

  const summary = [
    { label: "自分のクチコミ", value: counts.total },
    { label: "記録中", value: counts.open },
    { label: "完了", value: counts.closed },
  ];

  return (
    <div>
      <header className="border-b border-border px-4 py-3">
        <MyReviewsHeader />
      </header>
      <div className="px-4 py-3">
        <Button type="button" onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}>
          ＋ クチコミを作成
        </Button>
      </div>
      <div className="grid grid-cols-3 border-y border-border text-center">
        {summary.map((item) => (
          <div key={item.label} className="py-3">
            <p className="text-xl font-bold text-text-primary">{item.value}</p>
            <p className="text-xs text-text-secondary">{item.label}</p>
          </div>
        ))}
      </div>
      <ReviewList reviews={reviews} variant="mine" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="自分のクチコミはまだありません" />
      {composing && (
        <ComposeToSheet
          key={composing.session}
          kind="review"
          open={composing.open}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </div>
  );
}
```

`app/reviews/my/page.test.tsx` を `app/karte/my/page.test.tsx` のコピー（`sed -f <scratchpad>/review-map.sed`）にし、役割の期待値を逆にする（ゲストで一覧と件数、キャストで「クチコミはゲストだけが書けます。」）。

- [ ] **Step 6: Remove what nothing uses any more**

```bash
cd dystopia/frontend/src
/usr/bin/grep -rln "entry-edit-form\|EntryEditForm" . | /usr/bin/grep -v "components/ui/entry-edit-form"
/usr/bin/grep -rn "レビュー\|settings/reviews\|useReviewSettings\|ReviewComposer\|ReviewsTab\b" . --include=*.ts --include=*.tsx
```

1 つ目の grep が何も出さなければ `git rm components/ui/entry-edit-form.tsx components/ui/entry-edit-form.test.tsx` する。2 つ目の grep が出したものは、本 Task の Step 1〜5 の方針で直す（設定画面への導線なら削除する）。

- [ ] **Step 7: Run all frontend checks**

Run: `cd dystopia/frontend && pnpm exec vitest run > <scratchpad>/vitest.log 2>&1; /usr/bin/grep -E "×|FAIL|Tests |Test Files" <scratchpad>/vitest.log | head -30; pnpm exec tsc --noEmit; echo "tsc exit=$?"`
Expected: 全件 PASS、tsc exit 0

- [ ] **Step 8: Commit**

```bash
git add -A dystopia/frontend/src
git commit -s -m "feat(dystopia): show reviews as kuchikomi with the lifecycle screens

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
```

### Task 14: End-to-end check and the stage 2 PR

- [ ] **Step 1: Run the monolith and the frontend suites once more**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec > <scratchpad>/rspec.log 2>&1; tail -5 <scratchpad>/rspec.log` と `cd dystopia/frontend && pnpm exec vitest run > <scratchpad>/vitest.log 2>&1; tail -5 <scratchpad>/vitest.log; pnpm exec tsc --noEmit`
Expected: 0 failures、全件 PASS、tsc exit 0

- [ ] **Step 2: Check it in the running app**

memory の `reference_local_e2e_run.md`（使い捨て DB、`bin/grpc` は `.env` と `.env.test` を export、ブラウザは `localhost` で開く、fake Cognito の seed account、puppeteer-core）に従って monolith と frontend を起動し、次を確かめる。各項目のスクリーンショットを `<scratchpad>` に保存する。
1. ゲストでキャストのプロフィールの「クチコミ」タブから「このキャストのクチコミを書く」→ 作成 → 記録中のカードが出る
2. 詳細シートで「＋ 段階を追記する」→ 利用 · 満足して終了 を追加 → 星を 4 にして「完了する」→ 要約の見出しが 4.0 · 1人が評価 · 1件になる
3. 「再オープン」で要約が「—」に戻り、再び完了すると 4.0 に戻る
4. ホームの「クチコミ」タブに記録中のクチコミも出る
5. キャストでログインすると、キャストのプロフィールに「このキャストのクチコミを書く」が出ず、作成メニューにクチコミがない
6. `/settings/reviews` が 404 になる

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --draft --base refactor/dystopia-shared-record-ui \
  --title "feat(dystopia): rebuild reviews as kuchikomi on the karte lifecycle" \
  --body-file <scratchpad>/pr-stage2.md
gh stack submit --auto
```

`<scratchpad>/pr-stage2.md`: 先頭に `Closes #1520`。Why（#1520 の要求と、spec の Decisions の要点）、What（表・RPC・slice・画面・名称・廃止したもの）、Verification（Step 1 と Step 2 の結果）、末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と session URL。

---

## Stage 3: Drop the legacy tables (branch `chore/dystopia-drop-legacy-review-tables`)

### Task 15: Drop `review.entries` and `review.cast_settings`

**Files:**
- Create: `dystopia/monolith/config/db/migrate/20261020000000_drop_legacy_review_tables.rb`
- Modify: `dystopia/monolith/spec/config/db/review_schema_spec.rb`

- [ ] **Step 0: Create the branch**

```bash
gh stack add chore/dystopia-drop-legacy-review-tables
```

- [ ] **Step 1: Write the failing spec**

`spec/config/db/review_schema_spec.rb` の `holds the lifecycle tables` を次に替える。

```ruby
  it "holds only the lifecycle tables" do
    tables = db[Sequel[:information_schema][:tables]].where(table_schema: "review").select_map(:table_name).sort

    expect(tables).to eq(%w[events reviews])
  end
```

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec rspec spec/config/db/review_schema_spec.rb > <scratchpad>/rspec.log 2>&1; tail -10 <scratchpad>/rspec.log`
Expected: FAIL（`cast_settings`・`entries` が残っている。旧 migration の `trust_review_media` 系の表が `review` スキーマに残っていれば、それも出る）

- [ ] **Step 2: Write the migration**

失敗の出力に出た旧表をすべて drop する。`entries` と `cast_settings` だけなら次のとおり。他の旧表（`review` スキーマの表）が出たら `drop_table` を足す。

```ruby
# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table :"review__cast_settings"
    drop_table :"review__entries"
  end

  down do
    raise Sequel::Error, "irreversible: legacy review entries and cast settings are not restored"
  end
end
```

- [ ] **Step 3: Migrate and run the suite**

Run: `cd dystopia/monolith && HANAMI_ENV=test bundle exec hanami db migrate > <scratchpad>/migrate.log 2>&1; HANAMI_ENV=test bundle exec rspec > <scratchpad>/rspec.log 2>&1; tail -5 <scratchpad>/rspec.log`
Expected: 0 failures

- [ ] **Step 4: Commit, push and open the PR**

```bash
git add dystopia/monolith/config/db/migrate/20261020000000_drop_legacy_review_tables.rb dystopia/monolith/spec/config/db/review_schema_spec.rb
git commit -s -m "chore(dystopia): drop the legacy review tables

Claude-Session: https://claude.ai/code/session_01DA9qTtJtm2tPquKk7hyPR5"
git push -u origin HEAD
gh pr create --draft --base feat/dystopia-review-lifecycle \
  --title "chore(dystopia): drop the legacy review tables" \
  --body-file <scratchpad>/pr-stage3.md
gh stack submit --auto
```

`<scratchpad>/pr-stage3.md`: Why（Stage 2 で参照を外した旧表を、lambda README の 2 回デプロイの規則に従って別の deploy で消す。Stage 2 の deploy の後に merge する）、What、Verification、末尾の 2 行。
