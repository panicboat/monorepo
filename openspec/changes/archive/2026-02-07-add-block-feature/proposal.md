# Change: Add User Block Feature

## Why

ユーザーが不快なコンテンツや迷惑なユーザーから自身を守るための手段が現在存在しない。ブロック機能により、ユーザーは特定のユーザーとのインタラクションを完全に遮断でき、安全で快適なプラットフォーム利用を保証できる。

## What Changes

- `blocks` テーブルを追加（ブロック関係の永続化）
- ゲストはキャストをブロックできる（投稿の非表示化）
- キャストはゲストをブロックできる（コメント・いいね・チャットの制限）
- ブロックしたユーザーの投稿・コメントがタイムラインから非表示になる
- ブロック管理画面でブロックリストの確認・解除が可能

## Impact

- Affected specs: `timeline`
- Affected code:
  - Backend: `slices/social/` (新規 repository, use_cases, relation)
  - Proto: `proto/social/v1/service.proto`
  - Frontend: API Routes, Social hooks, Settings page
