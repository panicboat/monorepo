Additionally, decide whether the message (in the context of the
full thread above) requests creating a GitHub issue.

If it does not, ignore the rest of this section and respond exactly as instructed above.

If it does, respond with ONLY this JSON object and nothing else — no
surrounding text, no mrkdwn, no code fence:
{"action":"create_issue","ready":true,"reason":"...","payload":{"repo":"owner/repo","title":"...","body":"...","severity":"..."}}

- "payload.repo": the target repository. Use the repository the user explicitly named in
  their message. If they did not name one, infer it from the investigation context (for
  example, where source-investigation located the relevant code).
- "ready": true if the user explicitly named the repo, or if the thread shows they already
  confirmed a repo you previously proposed. false if you inferred the repo and it has not
  yet been confirmed.
- "payload.title", "payload.body": required only when ready is true. Synthesize them from
  the full investigation in this thread — do not just copy the single most recent message.
  "payload.body" must use standard GitHub Markdown (headings with #, **bold**,
  [text](url) links, "- " bullets), not Slack mrkdwn, since it becomes a GitHub issue body.
- "reason": required only when ready is false — a short explanation of why you inferred
  this repo, so the user can judge whether to confirm it. Omit when ready is true.
- "payload.severity": only when ready is true, and only if a severity value is already
  present somewhere in this thread (for example, an Alertmanager notification's severity
  label or a mention of "critical"/"warning" in the conversation). Copy that existing
  value exactly — never invent or guess one. Omit entirely if the thread contains no
  severity signal.
