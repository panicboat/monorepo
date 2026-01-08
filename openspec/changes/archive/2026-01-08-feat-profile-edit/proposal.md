# Change: Cast Profile Edit Implementation

## Why
キャストが自身の魅力をゲストに伝え、予約獲得率を高めるためには、プロフィール（写真、自己紹介、タグ、料金プランなど）を随時更新できる必要があります。
現在はオンボーディングで入力した情報が静的に表示される（またはモック）だけで、編集機能が存在しません。
Phase 2として、キャストが自身のプロフィール情報を管理・更新できる編集画面を実装します。

## What Changes

### 1. Page Implementation
`src/app/(cast)/manage/profile/page.tsx` を実装します。
このページは以下のセクションで構成されます：

#### A. Basic Info & Photos
- **プロフィール写真**: メイン写真とサブ写真（ポートフォリオ）のアップロード・並び替え
- **基本情報**: 名前（変更不可または審査制）、年齢、身長、スリーサイズなど
- **自己紹介**: 自由記述のメッセージ
- **タグ**: 特徴を表すタグ（#写真より可愛い, #Sっ気 など）の管理

#### B. Plan & Schedule Settings
- **料金プラン**: 提供するプラン（時間、料金）の管理
- **基本シフト設定 (Weekly Default)**:
  - **目的**: 将来のスケジュール自動生成（Phase 3）のための「雛形（テンプレート）」を管理します。
  - **表示**: キャスト本人にのみ表示され、**ゲストには公開されません**（Phase 3でカレンダー機能が実装されるまで）。
  - **Data**: `WeeklyShiftInput` コンポーネントを使用し、曜日×時間帯のデータを管理します。


### 2. Component Architecture
オンボーディング (`src/app/(cast)/manage/onboarding`) で使用されたコンポーネントを再利用・共通化し、編集モードとして活用します。

#### Refactoring Target (Reuse)
以下のコンポーネントを `manage/onboarding` から適切なモジュール (`src/modules/*`) に移動し、共通化します：

- **Portfolio Domain**:
  - `ProfileInputs`: 基本情報入力 -> `src/modules/portfolio/components/edit/ProfileInputs.tsx`
  - `PhotoUpload`: 写真アップロード -> `src/modules/portfolio/components/edit/PhotoUpload.tsx`
  - `TagSelector`: タグ選択 -> `src/modules/portfolio/components/edit/TagSelector.tsx`
  - `PriceInputs` / `PlanSettings`: 料金プラン設定 -> `src/modules/portfolio/components/cast/PlanSettings.tsx`

### 3. API & Mocking
MSW ハンドラに以下のエンドポイントを追加・拡張します:

#### `/api/cast/profile` (GET)
現在のプロフィール情報を取得します。
```json
{
  "id": "mirei",
  "name": "美玲",
  "images": { ... },
  "message": "...",
  "tags": [...],
  "plans": [...]
}
```

#### `/api/cast/profile` (PUT)
プロフィール情報を更新します。
```json
{
  "message": "更新されたメッセージ",
  "tags": ["#newtag"],
  "images": { ... }
}
```

## Impact
- **Affected Specs**: `profile` (New Requirements), `portfolio` (Reflected data)
- **Affected Code**:
  - `web/nyx/workspace/src/app/(cast)/manage/profile/page.tsx` (New)
  - `web/nyx/workspace/src/app/(cast)/manage/onboarding/*` (Refactor for reuse)
  - `web/nyx/workspace/src/mocks/handlers/cast.ts` (Update)
