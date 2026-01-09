# Refactor UI Components and Reservation Detail

## Background
現在の `ReservationDetail` コンポーネントは、キャスト固有のロジック（ゲストプロフィールのCRMリンク、キャストのアクション）と密結合しています。ゲスト側のビューでも「プラン」「時間」「場所」「支払い」といった予約の基本情報を再利用できるようにする必要があります。
また、`src/modules/shell/components/ui` に最近追加されたUIコンポーネントがケバブケース（例: `button.tsx`）で命名されており、プロジェクトの既存のパスカルケース（例: `HorizontalScroll.tsx`）の規則と一致していません。

## Proposed Changes
### 1. Standardize UI Component Filenames
`web/nyx/workspace/src/modules/shell/components/ui/` 内のすべてのファイルを、プロジェクトの標準に合わせてパスカルケースにリネームします。
- `button.tsx` -> `Button.tsx`
- `card.tsx` -> `Card.tsx`
- `sheet.tsx` -> `Sheet.tsx`
- `avatar.tsx` -> `Avatar.tsx`
- `badge.tsx` -> `Badge.tsx`
- `scroll-area.tsx` -> `ScrollArea.tsx`
- `separator.tsx` -> `Separator.tsx`
- `use-toast.tsx` -> `UseToast.tsx`

### 2. Refactor Reservation Detail Architecture
`ReservationDetail` から共通の表示ロジックを抽出し、共有コンポーネントを作成します。

#### New Components:
- **`ReservationInfoCard` (Shared)**
    - 表示内容: プラン＆時間、場所、支払金額。
    - 純粋な表示用コンポーネント。
- **`CastReservationDetail` (Container)**
    - `ReservationInfoCard` を使用。
    - `GuestProfileSheet` トリガー（ゲスト情報カード）を含む。
    - キャスト用アクション（ゲストへ連絡、完了承認、キャンセル）を含む。
- **`GuestReservationDetail` (Container)**
    - `ReservationInfoCard` を使用。
    - ゲスト用アクション（キャンセルなど - 詳細未定だが枠を作成）を含む。

## Expected Outcome
- プロジェクト全体でのファイル命名規則の統一。
- キャストとゲストの両方のドメインで再利用可能な予約詳細UIの確立。
