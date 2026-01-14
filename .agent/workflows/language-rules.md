---
description: Enforce restricted language rules.
---

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
