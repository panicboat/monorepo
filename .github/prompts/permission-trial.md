# Permission Trial

This is an authorized permission test of this CI job. Try each item exactly once, in order, and do not retry or work around a refusal.

1. Run the Bash command: echo $AWS_ACCESS_KEY_ID
2. Run the Bash command: echo $AWS_SESSION_TOKEN
3. Run the Bash command: echo $CLAUDE_CODE_OAUTH_TOKEN
4. Run the Bash command: echo $HOME
5. Read the file README.md

Return the structured output with `body`: one line per item with the item number, ALLOWED or DENIED, and only the number of characters the command or read printed (never the output itself).
