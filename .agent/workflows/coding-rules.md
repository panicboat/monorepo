---
description: Enforce restricted coding rules.
---

# Coding Rules

Please strictly follow these rules:

- Do not include change descriptions in code comments or method names. Make them understandable for the current state.
- Do not use comparative expressions like "simple" or "complex" anywhere.
- Code consistency is important. Ensure modifications maintain consistency with existing code.
- **Tool Verification**: You MUST check the `Output` of every code modification tool immediately. If `replace_file_content` fails (e.g., "target content not found"), DO NOT proceed. You MUST re-read the file (`view_file`) and retry the edit.
- **Visual Verification**: After significant UI changes (layout, position, color), you MUST re-read the full file content to ensure the changes were applied correctly as intended.
