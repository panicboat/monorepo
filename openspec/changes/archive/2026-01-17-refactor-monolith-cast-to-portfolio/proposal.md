# Refactor Monolith Cast Slice to Portfolio

## Why
現在、monolith サービスには `cast` スライス (`services/monolith/workspace/slices/cast`) が存在しますが、これは `services/handbooks/workspace/docs/ARCHITECTURE.md` で定義された Modular Monolith アーキテクチャに違反しています。アーキテクチャでは、キャストのプロフィール関連機能は `Portfolio` サービス/ドメインに属すると規定されています。

この提案は、アーキテクチャガイドラインに従い、`cast` スライスの内容を新しい `portfolio` スライスに移動することで、コードベースを正すことを目的としています。

## What Changes
- `slices/cast` を `slices/portfolio` にリネームします。
- ネームスペースを `Cast::` から `Portfolio::` に更新します。
- すべての参照（リポジトリ、リレーションなど）が更新されたことを確認します。
