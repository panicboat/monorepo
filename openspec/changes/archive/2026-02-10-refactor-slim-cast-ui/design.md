## Context

プロジェクトは現在、6ドメイン構成（Identity、Portfolio、Social、Concierge、Ritual、Trust）を想定しているが、開発リソースを集中させるため、まずは3ドメイン（Identity、Portfolio、Social）に絞ってUIを完成させる方針に変更する。

**Stakeholders:**
- キャスト（プライマリユーザー）
- ゲスト（フォロワーとして関係）

## Goals / Non-Goals

### Goals

- キャストのホーム画面を Social ドメイン中心の構成に変更する
- マイページのメニューを3ドメインに必要な機能のみに絞る
- フォロワー管理機能を強化する（フォローリクエスト、フォロワーリスト）

### Non-Goals

- バックエンド API の変更（UI のみの変更）
- Ritual/Trust/Concierge ドメインの完全削除（将来実装のため保持）
- データベーススキーマの変更

## Decisions

### Decision 1: ホーム画面のコンテンツ

**What:** EarningsSummary と UpcomingReservations を削除し、フォローリクエスト一覧と新着フォロワー一覧に置き換える。

**Why:**
- 売上と予約は Ritual/Trust ドメインに属するため、現状では不要
- Social ドメインの中核機能であるフォロー関係をホームで管理できるようにする

**Alternatives considered:**
- 空のホーム画面にする → ユーザー体験が悪い
- タイムラインをホームに配置する → すでに専用タブがある

### Decision 2: プロフィール編集のデフォルト状態

**What:** Collapsible セクションをデフォルトで開いた状態にする。

**Why:**
- 頻繁に編集する機能であるため、ワンクリック減らす
- 初見ユーザーにも編集可能な項目が見えやすい

### Decision 3: 削除する機能の扱い

**What:** レビュー管理（/cast/reviews）と履歴・売上（/cast/history）のページとルートを削除する。

**Why:**
- これらは Trust/Ritual ドメインに属する
- 3ドメイン構成では不要

**Migration:**
- ページファイルを削除
- マイページのメニューから該当リンクを削除
- ナビゲーションルートを削除

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 既存ユーザーが機能を見失う | リリースノートで告知、将来の復活を明記 |
| 削除したコードの復元が困難 | Git 履歴で復元可能 |

**Note:** Ritual/Trust ドメインのバックエンド実装（Proto、gRPC ハンドラー、Repository）は元々存在しなかったため、今回の変更はフロントエンド（UI、モック、スペック）のみに影響する。

## Open Questions

- フォロワーリストのページネーション/無限スクロールの実装方式は？（既存の UserListCard パターンに従う予定）
