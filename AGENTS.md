# Coding Rules

Please strictly follow these rules:

- Do not include change descriptions in code comments or method names. Make them understandable for the current state.
- Do not use comparative expressions like "simple" or "complex" anywhere.
- Code consistency is important. Ensure modifications maintain consistency with existing code.
- Always verify that `replace_file_content` or code modification tools succeeded. If a tool reports "target content not found", you must re-read the file and apply the fix again.

# Language Rules

- **OUTPUT MUST BE IN JAPANESE.**
- **Documents (Proposals, Plans, etc.)**:
  - **Headers**: MUST be in **English**.
  - **Content**: MUST be in **Japanese**.
- Only code (variable names, comments usually) should be English.

# Workflow Rules

- **Architectural Changes**: Any changes that affect the system architecture, including database schema strategies, library replacements, or major pattern changes, MUST be explicitly approved by the user before implementation. Propose these changes in an implementation plan or OpenSpec proposal first.

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->
