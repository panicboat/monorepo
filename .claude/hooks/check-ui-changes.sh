#!/bin/bash

# PostToolUse hook: PR 作成コマンドを検知して UI 変更があれば通知する
# CLAUDE_TOOL_USE_INPUT には実行されたコマンドの内容が含まれる

TOOL_INPUT="$CLAUDE_TOOL_USE_INPUT"

# gh pr create コマンドかどうかを判定
if ! echo "$TOOL_INPUT" | grep -q "gh pr create"; then
  exit 0
fi

# main ブランチとの差分で UI 影響があるか判定
UI_CHANGES=$(git diff main...HEAD --name-only 2>/dev/null | grep -E '^(services/nyx/workspace/src/|proto/|services/monolith/workspace/slices/.*/actions/)' | head -20)

if [ -z "$UI_CHANGES" ]; then
  exit 0
fi

# UI 変更がある場合、Claude にスキル呼び出しを促す
cat << EOF
UI に影響する変更を検出しました:

$(echo "$UI_CHANGES" | sed 's/^/  - /')

record-demo スキルを使ってデモ動画を生成することを検討してください。
EOF
