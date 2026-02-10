# Design: Pivot to Cast-Centric SNS

## Context

Nyx.PLACE は当初、予約プラットフォームとして6つのドメイン（Identity, Portfolio, Social, Concierge, Ritual, Trust）で設計された。しかし、市場投入を早めるため、まずはキャスト主体のSNSとして3ドメイン（Identity, Portfolio, Social）でスタートする方針に転換する。

### Constraints
- 既存の Identity, Portfolio, Social ドメインは維持
- データベースマイグレーションは最小限に（未使用テーブルは残しても可）
- フロントエンドのUI/UX は大幅に簡略化

## Goals / Non-Goals

### Goals
- SNSとしてのコア機能（タイムライン、フォロー、いいね）に集中
- 不要なUIを削除してユーザー体験をシンプルに
- コードベースの保守性向上

### Non-Goals
- データベーススキーマの大規模変更
- バックエンドアーキテクチャの根本的な変更
- パフォーマンス最適化（この変更では対象外）

## Decisions

### Decision 1: ドメイン構成
**採用**: Identity, Portfolio, Social の3ドメイン体制

**理由**:
- 認証（Identity）は必須
- プロフィール（Portfolio）はSNSの基本
- タイムライン（Social）がコア機能

**代替案**:
- 全6ドメインを維持 → 保守コストが高い、使われない機能が多い
- Identity + Social のみ → プロフィール管理が困難

### Decision 2: UI 簡略化アプローチ
**採用**: ホーム画面をタイムラインのみに変更

**理由**:
- タブ切り替えの認知負荷を削減
- SNSとしてのコア体験（タイムライン閲覧）に集中
- モバイルでの操作性向上

### Decision 3: コード削除の範囲
**採用**: Concierge/Ritual/Trustのフロントエンド・バックエンドコードを削除

**理由**:
- 未実装またはモック状態のコードは保守負債
- 必要になったら新規実装の方がクリーン

**代替案**:
- コードを残して無効化 → 保守負債、混乱の原因
- フロントエンドのみ削除 → バックエンドの保守コスト残存

## Architecture After Change

```
monorepo/
├── services/monolith/workspace/
│   └── slices/
│       ├── identity/       # 認証・認可
│       ├── portfolio/      # プロフィール管理
│       └── social/         # タイムライン・投稿
├── web/nyx/workspace/
│   └── src/
│       ├── modules/
│       │   ├── identity/   # 認証UI
│       │   ├── portfolio/  # プロフィールUI
│       │   └── social/     # タイムラインUI
│       └── app/
│           ├── (guest)/    # ゲスト向けページ（簡略化）
│           └── (cast)/     # キャスト向けページ
└── proto/
    ├── identity/v1/        # 認証Proto
    ├── portfolio/v1/       # プロフィールProto
    └── social/v1/          # タイムラインProto
```

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| 将来Concierge機能が必要になる | 中 | 新規実装時に最新設計で構築可能 |
| ユーザーがチャット機能を期待する | 低 | SNSとしての価値提案を明確化 |
| 削除したコードの復元が困難 | 低 | Gitで履歴は保持される |

## Migration Plan

1. **フロントエンド変更** - UIの簡略化を先行
2. **バックエンド削除** - 未使用スライスの削除
3. **Proto整理** - 不要なProto定義の削除
4. **ドキュメント更新** - CLAUDE.md等の更新
5. **動作確認** - ビルド・起動確認

ロールバック: Gitの履歴から復元可能

## Open Questions

1. キャスト側のUI変更は別提案で対応するか？ → 別途対応予定
2. 既存のConcierge関連テーブル（存在する場合）のマイグレーションは？ → 調査が必要
