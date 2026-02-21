# Tasks: allow-media-only-comments

## Overview

コメント機能でメディアのみ投稿を許可するための実装タスク。

## Tasks

### 1. Backend: AddComment UseCase の修正

- [x] `add_comment.rb` のバリデーション変更
  - `EmptyContentError` の条件を「テキストとメディアの両方が空」に変更
- [x] エラーメッセージの更新（"Content or media is required"）

### 2. Backend: テストの更新

- [x] 既存テストの修正（メディアのみコメントを許可）
- [x] 新規テストケース追加:
  - メディアのみのコメント投稿成功
  - メディアのみの返信投稿成功
  - テキストとメディア両方なしの場合はエラー

### 3. Spec の適用

- [x] `openspec/specs/post-comments/spec.md` に変更を反映

### 4. 検証

- [x] ローカルで動作確認
- [x] 既存のコメント機能に影響がないことを確認

## Dependencies

- なし（独立したタスク）

## Parallelization

- Task 1 と Task 2 は同時に着手可能
- Task 3 は Task 1 完了後に実施
- Task 4 は全タスク完了後に実施

## Validation Criteria

- [x] メディアのみのコメントが投稿できる
- [x] メディアのみの返信が投稿できる
- [x] テキストもメディアもないコメントはエラーになる
- [x] 既存のテキスト+メディアコメントは正常に動作する
- [x] 既存テストがパスする
