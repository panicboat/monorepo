nyx と monolith について API 接続を行いプロダクションレディになるよう進めています。
（API と Frontend を接続する必要があります）
現在は以下の機能が完了しています。

- identity サービス
  - ユーザ登録機能、認証、JWT によるセッション管理
    - ゲスト・キャスト共に
  - SMS 認証は未対応（今後対応予定）
- portfolio サービス
  - キャストのオンボーディング機能
- social サービス
  - キャストの timeline 投稿機能

UI の下記については今後の課題で別途対応予定です。
- ワードやエラーメッセージの言語が統一されていない
- バリデーションが不十分

デプロイに関しても中途半端になっていますがこれも今後対応予定です。
- ローカルの k3d で動作はするがデプロイ手順が面倒
- 単純に pnpm dev と bin/grpc で直接起動している

これにあたり存在する markdown ファイルは全て目を通してください。
特に以下は重要です。
- openspec/project.md
- services/handbooks/workspace/docs/*.md
- web/nyx/README.md
- services/monolith/README.md
- .claude/rules/*.md

まずは以下について OpenSpec を作成してください。

-

実装にあたり過去の実装パターンを踏襲することが前提です。
『実装を含め完全理解』してから作業してください。

何か質問があれば遠慮なく聞いてください。
