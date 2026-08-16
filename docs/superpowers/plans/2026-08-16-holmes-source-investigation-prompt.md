# holmes Source Investigation Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tell HolmesGPT (via holmes's existing `additional_system_prompt`) that it can read `panicboat/monorepo` and `panicboat/platform` source code, and when to use that instead of cluster-state-only investigation.

**Architecture:** `internal/clients/holmes/client.go`'s `slackFormattingInstructions` constant is already sent as `additional_system_prompt` on every `Investigate` call (added in an earlier change, PR #971). Append a new paragraph to that same constant describing the two repos and the investigation-order guidance. No new fields, no new client methods — this is a content-only change to an existing string.

**Tech Stack:** Go.

## Global Constraints

- Code elements (names, comments, commit messages) in English — this applies regardless of any other file's existing style.
- `git commit -s`, no `Co-Authored-By`.
- This task depends on a companion change in `panicboat/platform` (HolmesGPT's `bash` toolset allowlist, PR #784) to actually grant the git-clone capability this prompt addition describes — the two are independent deploys but both are needed for the described capability to work end-to-end. This plan's task does not need that PR merged to implement or test its own change (the prompt string is just text sent to HolmesGPT; whether HolmesGPT's toolset permits the described commands is orthogonal to whether holmes sends the right instructions).
- Design doc: `docs/superpowers/specs/2026-08-16-holmes-source-investigation-design.md` (panicboat/platform repo).

---

## Task 1: Add source investigation guidance to `slackFormattingInstructions`

**Files:**
- Modify: `system-components/holmes/workspace/internal/clients/holmes/client.go`
- Modify: `system-components/holmes/workspace/internal/clients/holmes/client_test.go`

**Interfaces:** none — this task only changes the content of an existing constant already wired into `Investigate`'s request body via the existing `AdditionalSystemPrompt` field.

- [ ] **Step 1: Update the failing test first**

In `system-components/holmes/workspace/internal/clients/holmes/client_test.go`, find (inside `TestClient_Investigate`):

```go
		if !strings.Contains(req.AdditionalSystemPrompt, "Japanese") {
			t.Errorf("expected additional_system_prompt to request Japanese, got: %q", req.AdditionalSystemPrompt)
		}
		if !strings.Contains(req.AdditionalSystemPrompt, "mrkdwn") {
			t.Errorf("expected additional_system_prompt to request Slack mrkdwn formatting, got: %q", req.AdditionalSystemPrompt)
		}
```

Replace with (adds two more assertions after the existing two, same `if` style):

```go
		if !strings.Contains(req.AdditionalSystemPrompt, "Japanese") {
			t.Errorf("expected additional_system_prompt to request Japanese, got: %q", req.AdditionalSystemPrompt)
		}
		if !strings.Contains(req.AdditionalSystemPrompt, "mrkdwn") {
			t.Errorf("expected additional_system_prompt to request Slack mrkdwn formatting, got: %q", req.AdditionalSystemPrompt)
		}
		if !strings.Contains(req.AdditionalSystemPrompt, "github.com/panicboat/monorepo") {
			t.Errorf("expected additional_system_prompt to mention the monorepo repo, got: %q", req.AdditionalSystemPrompt)
		}
		if !strings.Contains(req.AdditionalSystemPrompt, "github.com/panicboat/platform") {
			t.Errorf("expected additional_system_prompt to mention the platform repo, got: %q", req.AdditionalSystemPrompt)
		}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/holmes/... -v -run TestClient_Investigate$`
Expected: FAIL — the two new assertions fail because `slackFormattingInstructions` doesn't mention either repo URL yet.

- [ ] **Step 3: Update `slackFormattingInstructions`**

In `system-components/holmes/workspace/internal/clients/holmes/client.go`, find:

```go
const slackFormattingInstructions = `Respond in Japanese.

Format your response using Slack's mrkdwn syntax, not standard Markdown:
- Bold: *text* (single asterisks, not **text**)
- No markdown headings (#, ##, ###) — use *bold* text as a section label instead
- Links: <https://example.com|link text>, not [link text](https://example.com)
- Bullet lists: start each line with "• " (not "- " or "* ")`
```

Replace with:

```go
const slackFormattingInstructions = `Respond in Japanese.

Format your response using Slack's mrkdwn syntax, not standard Markdown:
- Bold: *text* (single asterisks, not **text**)
- No markdown headings (#, ##, ###) — use *bold* text as a section label instead
- Links: <https://example.com|link text>, not [link text](https://example.com)
- Bullet lists: start each line with "• " (not "- " or "* ")

For root cause investigation, you have read-only access to two source repositories via
git (both public, no authentication needed):
- https://github.com/panicboat/monorepo
- https://github.com/panicboat/platform

Investigate cluster state first (logs, metrics, resource status). Only clone and read
source code when cluster state alone doesn't explain the root cause — for example, when
a bug or misconfiguration appears to originate in application code rather than runtime
state.`
```

Also update the doc comment directly above the constant to mention this new purpose. Find:

```go
// slackFormattingInstructions is sent as HolmesGPT's additional_system_prompt
// on every request. HolmesGPT's default output is standard Markdown and
// English; holmes relays the response into Slack chat.postMessage verbatim
// with no reformatting, so it must ask HolmesGPT to produce Slack's mrkdwn
// dialect directly (Slack does not render **bold**, #-headings, or
// [text](url) links — see the mismatches this fixes) and to respond in
// Japanese, the team's operating language.
```

Replace with:

```go
// slackFormattingInstructions is sent as HolmesGPT's additional_system_prompt
// on every request. HolmesGPT's default output is standard Markdown and
// English; holmes relays the response into Slack chat.postMessage verbatim
// with no reformatting, so it must ask HolmesGPT to produce Slack's mrkdwn
// dialect directly (Slack does not render **bold**, #-headings, or
// [text](url) links — see the mismatches this fixes) and to respond in
// Japanese, the team's operating language. It also names the two source
// repositories HolmesGPT can read via its bash toolset's git allowlist
// (see panicboat/platform's kubernetes/components/holmesgpt component) —
// HolmesGPT has no other way to learn these repos exist or when to use them.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd system-components/holmes/workspace && go test ./internal/clients/holmes/... -v`
Expected: PASS — both existing tests (`TestClient_Investigate`, `TestClient_Investigate_ErrorStatus`) pass.

- [ ] **Step 5: Run the full holmes test suite**

Run: `cd system-components/holmes/workspace && go build ./... && go vet ./... && go test ./... -race`
Expected: builds clean, vet clean, all packages PASS.

- [ ] **Step 6: Commit**

```bash
git add system-components/holmes/workspace/internal/clients/holmes/client.go system-components/holmes/workspace/internal/clients/holmes/client_test.go
git commit -s -m "feat(holmes): tell HolmesGPT about source investigation repos"
```

---

## Task 2: Open Draft PR

**Files:** none (git/GitHub operations only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/holmes-source-investigation-prompt
```

- [ ] **Step 2: Open a Draft PR**

```bash
gh pr create --draft --title "feat(system-components/holmes): tell HolmesGPT about source investigation repos" --body "$(cat <<'EOF'
## Summary
- Extend `slackFormattingInstructions` (sent as HolmesGPT's `additional_system_prompt` on every `Investigate` call) with the two source repos HolmesGPT can now read (`panicboat/monorepo`, `panicboat/platform`) and guidance to investigate cluster state first, source code only when that alone doesn't explain the root cause.

## Dependencies
- Requires `panicboat/platform`#784 (HolmesGPT `bash` toolset allowlist extended with read-only git commands) for the described capability to actually work — without it, HolmesGPT would be told about repos it can't clone. Independent deploys; this PR's own tests don't depend on that one being merged first.

## Test plan
- [x] `go build ./... && go vet ./... && go test ./... -race` — all pass
- [ ] After both PRs are merged and deployed: ask holmes something that requires source-level investigation and confirm HolmesGPT clones and reads the relevant repo

Design: docs/superpowers/specs/2026-08-16-holmes-source-investigation-design.md (panicboat/platform repo)
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Self-Review Notes

- **Spec coverage**: design doc's Component 2 (repo list, investigation-order guidance, appended to the existing `additional_system_prompt` mechanism) is fully covered by Task 1.
- **Placeholder scan**: none — the full replacement string is given verbatim, no TBD markers.
- **Type/naming consistency**: no new types/functions introduced; the only change is the content of the existing `slackFormattingInstructions` constant, already wired into `Investigate` via the existing `AdditionalSystemPrompt` field (unchanged from PR #971).
- **Scope boundary**: the `panicboat/platform` HolmesGPT toolset change is explicitly out of scope for this plan (separate plan, separate repo, already implemented as PR #784) — called out in the Draft PR's Dependencies section.
