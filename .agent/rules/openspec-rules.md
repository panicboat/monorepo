---
trigger: model_decision
description: when working on the openspec.
---

# OpenSpec Rules

- **OpenSpec Requirements**:
  - `openspec validate` requires English keywords (`MUST`, `SHALL`, `SHOULD`, `MAY`).
  - **Rule**: Write the requirement in Japanese, then append the English keyword phrase in parentheses.
  - **Example**: `ユーザーは...できなければならない (MUST be able to...)`
- **OpenSpec Archival**: Upon confirming with the user that a task is complete, you MUST archive the corresponding OpenSpec change using `openspec archive` to finalize the workflow.
