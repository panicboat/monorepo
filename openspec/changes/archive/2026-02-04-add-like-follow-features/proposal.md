# Proposal: Like and Follow Features

## Summary

ゲストがタイムライン投稿に「いいね」できる機能と、キャストを「フォロー」できる機能を実装する。現在はいいね数が常に 0、フォローは localStorage のみで管理されているが、これをバックエンド連携に移行する。

## Why

- **Like**: ゲストが投稿に反応でき、キャストは自分の投稿の人気度を把握できる
- **Follow**: フォロー中のキャストの投稿だけを見るフィルタリングがバックエンド連携になり、デバイス間で同期される

## What Changes

- `social__post_likes` テーブルを追加し、いいね機能を実装
- `social__cast_follows` テーブルを追加し、フォロー機能を実装
- タイムライン API に `liked` フラグと `likes_count` を追加
- フォローボタン（UserPlus/UserCheck）をキャスト詳細ページに追加
- Following タブのフィルタリングをサーバーサイドで実行

## Scope

### In Scope

1. **Like Feature (Phase 1.2)**
   - `social__post_likes` テーブル作成
   - `LikeCastPost` / `UnlikeCastPost` RPC 追加
   - いいね数のリアルタイム表示
   - フロントエンドのいいねボタン連携

2. **Follow Feature (Phase 1.3)**
   - `social__cast_follows` テーブル作成
   - `FollowCast` / `UnfollowCast` / `ListFollowing` RPC 追加
   - localStorage から API 連携への移行
   - Following タブのフィルタリングをサーバーサイドで実行

### Out of Scope

- コメント機能（別提案で実装）
- お気に入り機能（フォローとは別概念として今後検討）
- ブロック機能（フォローとは独立、今後検討）
- いいね通知（通知システム全体で別途検討）

## Related

- [timeline spec](../../specs/timeline/spec.md) - タイムライン関連の既存要件
- [IMPLEMENTATION_ROADMAP.md](../../../IMPLEMENTATION_ROADMAP.md) - Phase 1.2, 1.3

## Risks

- **重複処理**: 同一ユーザーによる重複いいね/フォローを防ぐ必要がある

## Decision

最小限の実装から開始し、以下の方針で進める：

1. Like は guest_id と post_id のユニーク制約で重複を防ぐ
2. Follow は guest_id と cast_id のユニーク制約で重複を防ぐ
3. API を唯一の正とし、localStorage は使用しない
