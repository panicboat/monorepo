# Release Please

## 構成

`release-please-config.json` で `separate-pull-requests: true` を設定しており、`dystopia/monolith` / `dystopia/frontend` / `tools/meeting-translation` / `system-components/pennyworth` の4コンポーネントがそれぞれ独立した release PR を持つ。一方でバージョン管理用の `release-please-manifest.json` は全コンポーネント共有の単一ファイル。

## 既知の問題: release PR がコンフリクトする

複数コンポーネントの release PR が同時に open している状態で、いずれか一方がマージされると、他方の release PR が GitHub 上でコンフリクト表示になることがある。

release-please は自身が生成する PR content を現在の branch 内容と比較し、対象コンポーネント自身のバージョン情報に変化がなければ push（rebase）をスキップする（Actions ログには `PR #N remained the same` と出力される）。このとき main 側は共有ファイル `release-please-manifest.json` の他コンポーネントの行が更新されているため、GitHub の3-way merge がコンフリクトと判定する。

### 対処法

コンフリクトした release PR を **close する**。release-please は次回実行時に「open な release PR が無い」と判断し、現在の main から正しい内容で新しい PR を作り直す。手動でコンフリクト解消をコミットしない — bot の管理下ブランチを直接編集しても次回実行時に上書きされる。

次の push を待たずに即座に復旧したい場合は、`.github/workflows/release.yml` を手動実行する（`workflow_dispatch` 対応済み）:

```sh
gh workflow run release.yml
```

## 根本的な解消について

この問題自体を構造的に無くすには `separate-pull-requests: false`（全コンポーネントを単一 release PR に統合）への変更が考えられるが、コンポーネントごとの独立したリリースケイデンスが失われるため、現時点では採用していない。
