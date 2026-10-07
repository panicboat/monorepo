# Release Please

## Layout

release 対象のサービスは、自身のディレクトリに `release-please-config.json` と `release-please-manifest.json` を持つ。`.github/workflows/release.yml` は `*/release-please-config.json` を検出し、見つかったディレクトリごとに release-please を 1 job ずつ実行する。

各 config の `packages` には自サービスの 1 件だけを定義する。キーは config の置き場所に関係なく、リポジトリルートからの path（例: `dystopia/monolith`）で書く。

## Why Per-Service Files

release-please は release PR の body が変わらない限り branch を push し直さない（Actions ログには `PR #N remained the same` と出力される）。複数サービスが 1 つの manifest を共有すると、ある release PR のマージ後も他の release PR は古い manifest を基点にしたまま残り、隣り合う行の変更としてコンフリクトする。

manifest をサービスごとに分けると、release PR が編集するのは自サービス配下の `CHANGELOG.md` と `release-please-manifest.json` だけになり、release PR 同士が同じファイルを編集しない。

## Config Requirements

- `separate-pull-requests: true` を指定する。指定しないと release PR の branch 名が全サービス共通の `release-please--branches--main` になり、job 同士が同じ branch を取り合う。
- `label` にサービス固有の label を含める（例: `autorelease: pending,release: monolith`）。release-please は「マージ済みで未 tag の release PR」を label だけで探し、1 件でもあると release PR の作成と更新を中断する。label が共通だと、あるサービスの tag 付けが終わる前に走った他サービスの job がその回の更新を skip する。

## Adding a Service

1. サービスのディレクトリに `release-please-config.json` を作る。既存サービスのものを複製し、`label` と `packages` を書き換える。
2. 同じディレクトリに `release-please-manifest.json` を作る。リリース済みなら `{"<path>": "<現在のバージョン>"}`、未リリースなら `{}` を書く。
3. サービスの `.dockerignore` に両ファイルを追加する。追加しないと release のたびに build context が変わる。

`release.yml` の変更は不要。
