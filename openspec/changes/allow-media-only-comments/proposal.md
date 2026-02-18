# Proposal: allow-media-only-comments

## Summary

コメント機能において、メディアのみの投稿を許可する。現在はテキスト必須だが、投稿（Post）と同様に「テキストまたはメディアのいずれか必須」に変更する。

## Motivation

### Problem

現在のコメント機能はテキスト入力が必須となっている。しかし、画像や動画のみでリアクションしたいケースがある（例：絵文字リアクションの代わりに画像を投稿、スクリーンショットでの回答など）。

投稿（Post）は既に「テキストまたはメディアのいずれか必須」というバリデーションになっており、コメントと一貫性がない。

### Current Behavior

| 機能 | テキスト | メディアのみ投稿 |
|------|----------|------------------|
| 投稿（Post） | オプション | ✅ 可能 |
| コメント（Comment） | **必須** | ❌ 不可 |

### Proposed Behavior

| 機能 | テキスト | メディアのみ投稿 |
|------|----------|------------------|
| 投稿（Post） | オプション | ✅ 可能 |
| コメント（Comment） | オプション | ✅ 可能 |

## Scope

### In Scope

- コメント・返信でメディアのみ投稿を許可するバリデーション変更
- バックエンド（UseCase）の修正
- 仕様書（spec.md）の更新

### Out of Scope

- メディア上限の変更（3枚のまま）
- コメントの表示UIの変更
- 新しいメディアタイプの追加

## Impact Analysis

### Affected Components

| Component | Change |
|-----------|--------|
| `post-comments` spec | バリデーション要件の変更 |
| `AddComment` UseCase | `EmptyContentError` 条件の変更 |
| フロントエンド | 変更不要（既に対応済み） |

### Risks

- **Low**: 既存のコメントに影響なし
- **Low**: フロントエンドは既に対応済みなので追加実装不要

## Related Capabilities

- `post-comments` - コメント機能仕様
- `timeline` - 投稿機能（メディアのみ投稿が既に可能）

## Decision

承認済み - 実装完了
