# Change: Reservation Detail & Guest Info & Schedule

## Why
Phase 2のロードマップにおいて、キャストが次回の予約やゲストについてより深いコンテキストを把握できるようにする必要があります。
また、キャストが自身のスケジュール（シフト）を管理するために、オンボーディングで使用した機能をダッシュボードからもアクセス可能にする必要があります。"Shift" という用語は "Schedule" に統一し、Ritual（儀式）のための時間管理であることを強調します。

## What Changes
- **New Feature**: 予約詳細ページ (`/manage/reservations/[id]`)
  - スケジュール、支払いステータス、場所、プラン詳細の完全な表示。
- **New Feature**: ゲストプロフィール表示
  - 予約詳細からアクセス可能。
  - ゲストの統計（来店回数）、基本情報、CRMメモ（Trustドメイン）を表示。
- **New Feature**: スケジュール管理ページ (`/manage/schedule`)
  - ナビゲーションの "Shift" を "Schedule" に変更。
  - オンボーディングで使用した `WeeklyShiftInput` コンポーネントを配置し、編集可能にする。
- **Domain Updates**:
  - `Ritual`: 予約リードモデル拡張、スケジュール管理の統合。
  - `Trust`: ゲストの透明性とCRM基本機能。

## Impact
- **Affected Specs**: `ritual` (予約詳細), `trust` (CRM), `schedule` (管理機能).
- **Affected Code**: `web/nyx` (`CastBottomNavBar`, `manage` routes).
