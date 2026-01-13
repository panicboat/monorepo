---
description: Enforce restricted coding, language, and workflow rules.
---

# Coding Rules

Please strictly follow these rules:

- Do not include change descriptions in code comments or method names. Make them understandable for the current state.
- Do not use comparative expressions like "simple" or "complex" anywhere.
- Code consistency is important. Ensure modifications maintain consistency with existing code.
- **Tool Verification**: You MUST check the `Output` of every code modification tool immediately. If `replace_file_content` fails (e.g., "target content not found"), DO NOT proceed. You MUST re-read the file (`view_file`) and retry the edit.
- **Visual Verification**: After significant UI changes (layout, position, color), you MUST re-read the full file content to ensure the changes were applied correctly as intended.

# Language Rules

- **OUTPUT MUST BE IN JAPANESE.**
- **Documents (Proposals, Plans, etc.)**:
  - **Headers**: MUST be in **English**.
  - **Content**: MUST be in **Japanese**.
- Only code (variable names, comments usually) should be English.
- **OpenSpec Requirements**:
  - `openspec validate` requires English keywords (`MUST`, `SHALL`, `SHOULD`, `MAY`).
  - **Rule**: Write the requirement in Japanese, then append the English keyword phrase in parentheses.
  - **Example**: `ユーザーは...できなければならない (MUST be able to...)`

# Workflow Rules

- **Architectural Changes**: Any changes that affect the system architecture, including database schema strategies, library replacements, or major pattern changes, MUST be explicitly approved by the user before implementation. Propose these changes in an implementation plan or OpenSpec proposal first.
