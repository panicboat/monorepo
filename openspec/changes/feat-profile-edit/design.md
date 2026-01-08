# Design: Profile Edit Architecture

## Component Reuse Strategy (Smart/Dumb Pattern)
「オンボーディング」と「プロフィール編集」で UI を共有しつつ、**データ保存のタイミング（ステップ毎 vs 一括/任意）** が異なります。

### Shared "Dumb" Components (`src/modules/cast/components/profile/`)
これらは**純粋な UI 部品**として実装し、API 通信ロジックを持ちません。
- `Props`: `value`, `onChange`, `error` などをのみ受け取る。
- **役割**: データの表示と入力のハンドリングのみ。

### Logic Containers ("Smart")
それぞれのユースケースに合わせて、API 通信とナビゲーションを制御します。

1.  **Onboarding Wizard (Step-by-Step)**
    - 各ステップのページ (`/onboarding/step/[id]`) がコンテナとなる。
    - **Action**: 「次へ」ボタン押下時に `POST /api/cast/onboarding/[step]` を呼び出し、成功したら次のステップへ遷移する。
    - **State**: 前のステップのデータを保持する必要はなく、完了したステップはサーバー側に保存される。

2.  **Profile Edit Page (Dashboard)**
    - `/manage/profile/page.tsx` がコンテナとなる。
    - **Action**: ページ初期化時に `GET /api/cast/profile` で全データを取得。
    - **Action**: 「保存」ボタン押下時に `PUT /api/cast/profile` で変更データを送信する。

## Directory Structure
- `src/modules/cast/components/profile/`: 共有プロフィールコンポーネント (PhotoUpload, PlanCard 等)
- `src/app/(cast)/manage/onboarding`: ウィザードレイアウト内で共有コンポーネントを使用。
- `src/app/(cast)/manage/profile`: シングルページレイアウト内で共有コンポーネントを使用。

## State Management
- **Profile Edit**: `GET /api/cast/profile` から取得したデータで初期化されるローカルステート（`useState` または `useReducer`）を使用します。
- **Save Action**: ページ下部（または各セクション）に配置した単一の「変更を保存」ボタンで、`PUT /api/cast/profile` をトリガーします。
