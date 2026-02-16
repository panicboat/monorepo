# Proposal: split-social-domain

## Summary

Social ドメインを **Media**、**Post**、**Relationship**、**Feed** の 4 ドメインに分割し、責務を明確化して修正難易度を下げる。

## Motivation

現在の Social ドメインは 6 つの Service（23 エンドポイント）を持ち、以下の問題が発生している：

1. **責務の混在**: コンテンツ管理（Post/Like/Comment）と関係性管理（Follow/Block/Favorite）が同一ドメインに存在
2. **修正の波及範囲が広い**: 1 つの機能修正が他の機能に影響しやすい
3. **テストの複雑化**: ドメイン内の依存関係が多く、テストが肥大化

## Proposed Solution

### Domain Structure

```
Social (現在)
├─→ Media ドメイン（メディア管理・共通）
│   └── メディアファイル（アップロード・削除・取得）
│
├─→ Post ドメイン（投稿中心）
│   ├── 投稿 CRUD
│   ├── Like（投稿へのいいね）
│   └── Comment（投稿へのコメント・リプライ）
│
├─→ Relationship ドメイン（関係性中心）
│   ├── Follow（フォロー・承認管理）
│   ├── Block（ブロック）
│   └── Favorite（お気に入り）
│
└─→ Feed ドメイン（読み取り専用・集約）
    └── FeedQuery（複数ドメインからの集約）
```

### Key Design Decisions

1. **Media は共通ドメインとして独立** - Post と Portfolio（将来）から利用可能
2. **Post と Relationship は互いを直接参照しない** - 疎結合を維持
3. **Feed ドメインは読み取り専用** - CQRS パターンの Query 側
4. **Feed は将来的に BFF へ移行可能** - 正しい BFF 導入時に削除できる設計

### Dependency Direction

```
Post → Media（メディアファイル管理）
Portfolio → Media（プロフィール画像、将来）
Feed → Post（投稿データ取得）
Feed → Relationship（フォロー/ブロック状態取得）
Post ←× Relationship（直接参照しない）
```

## Scope

### In Scope

- Social ドメインの 4 ドメイン分割（Media / Post / Relationship / Feed）
- Media ドメインの新規作成（共通メディア管理）
- proto ファイルの再編成
- バックエンド（Hanami slices）の分割
- フロントエンド modules の分割
- 既存 spec の各ドメインへの振り分け
- データベーススキーマの分離（PostgreSQL スキーマ）

### Out of Scope

- BFF の導入（将来対応）
- 新機能の追加
- パフォーマンス最適化

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| 分割による一時的な複雑化 | 段階的に移行し、各フェーズで動作確認 |
| Feed ドメインの肥大化 | 読み取り専用に制限し、責務を明確化 |
| proto の破壊的変更 | 新しい proto パッケージを作成し、段階的に移行 |

## Success Criteria

- [ ] 4 ドメインが独立して動作する
- [ ] 既存のテストが全てパスする
- [ ] Media ドメイン経由でメディアが正常にアップロード・表示される
- [ ] Feed 経由でフィードが正常に表示される
- [ ] 各ドメインの修正が他ドメインに波及しない
