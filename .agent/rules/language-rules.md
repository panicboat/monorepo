---
trigger: always_on
description: Enforce restricted language rules.
---

# Language Rules

- **出力は日本語でなければなりません (MUST BE IN JAPANESE)。**
- **ドキュメント (提案書、計画書など)**:
  - **見出し**: 英語でなければなりません (MUST be in **English**)。
  - **本文**: 日本語でなければなりません (MUST be in **Japanese**)。
- コード（変数名、コメントなど）のみ英語にすべきです。

# Action Protocol

Markdownファイルを作成・編集する際は、ツール実行前の `<thought>` ブロック内で必ず以下のチェックを行わなければならない：
1. **Target Check**: これはドキュメントやアーティファクトか？ (YES/NO)
2. **Header Check**: 見出しは英語か？ (YES/NO)
3. **Content Check**: 本文は日本語か？ (YES/NO)
