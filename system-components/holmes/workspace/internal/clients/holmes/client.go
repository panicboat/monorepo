package holmes

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

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

// issueIntentInstructions is appended to Chat's additional_system_prompt only
// (never Investigate's — Alertmanager's fixed alert-investigation ask never
// carries human issue-creation intent, so keeping this off that path means it
// can never receive or need to parse a create_issue envelope).
const issueIntentInstructions = `Additionally, decide whether the message (in the context of the
full thread above) requests creating a GitHub issue.

If it does not, ignore the rest of this section and respond exactly as instructed above.

If it does, respond with ONLY this JSON object and nothing else — no surrounding text, no
mrkdwn, no code fence:
{"action":"create_issue","repo":"owner/repo","title":"...","body":"...","ready":true,"reason":"..."}

- "repo": the target repository. Use the repository the user explicitly named in their
  message. If they did not name one, infer it from the investigation context (for example,
  where source-investigation located the relevant code).
- "ready": true if the user explicitly named the repo, or if the thread shows they already
  confirmed a repo you previously proposed. false if you inferred the repo and it has not
  yet been confirmed.
- "title", "body": required only when ready is true. Synthesize them from the full
  investigation in this thread — do not just copy the single most recent message. "body"
  must use standard GitHub Markdown (headings with #, **bold**, [text](url) links, "- "
  bullets), not Slack mrkdwn, since it becomes a GitHub issue body.
- "reason": required only when ready is false — a short explanation of why you inferred
  this repo, so the user can judge whether to confirm it. Omit when ready is true.`

type Client struct {
	BaseURL    string
	Model      string
	HTTPClient *http.Client
}

func New(baseURL, model string) *Client {
	return &Client{
		BaseURL: baseURL,
		Model:   model,
		HTTPClient: &http.Client{
			Timeout: 90 * time.Second,
		},
	}
}

type holmesChatRequest struct {
	Ask                    string `json:"ask"`
	Model                  string `json:"model"`
	AdditionalSystemPrompt string `json:"additional_system_prompt"`
}

type holmesChatResponse struct {
	Analysis string `json:"analysis"`
}

func (c *Client) Investigate(ask string) (string, error) {
	return c.chat(ask, slackFormattingInstructions)
}

// Chat is used by the Slack mention flow — same request/response shape as
// Investigate, but its additional_system_prompt also asks HolmesGPT to
// detect GitHub issue-creation intent (see issueIntentInstructions).
func (c *Client) Chat(ask string) (string, error) {
	return c.chat(ask, slackFormattingInstructions+"\n\n"+issueIntentInstructions)
}

func (c *Client) chat(ask, additionalSystemPrompt string) (string, error) {
	reqBody, err := json.Marshal(holmesChatRequest{
		Ask:                    ask,
		Model:                  c.Model,
		AdditionalSystemPrompt: additionalSystemPrompt,
	})
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/chat", bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call holmes api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("holmes api returned status %d", resp.StatusCode)
	}

	var chatResp holmesChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	return chatResp.Analysis, nil
}
