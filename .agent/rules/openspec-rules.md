---
trigger: model_decision
description: when working on the openspec.
---

# OpenSpec Rules

- **OpenSpec 要件**:
  - `openspec validate` は英語のキーワード (`MUST`, `SHALL`, `SHOULD`, `MAY`) を必要とします。
  - **ルール**: 要件は日本語で記述し、その後に英語のキーワードフレーズを括弧書きで追加してください。
  - **例**: `ユーザーは...できなければならない (MUST be able to...)`
- **OpenSpec アーカイブ**: ユーザーとタスクの完了を確認したら、ワークフローを完了させるために `openspec archive` を使用して対応する OpenSpec の変更をアーカイブしなければなりません (MUST)。
