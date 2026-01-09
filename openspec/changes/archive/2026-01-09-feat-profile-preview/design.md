# Design: Profile Preview Architecture

## Component Reuse Strategy
「本番」のゲストページと「プレビュー」モーダルの間でコードの重複を避けるため、表示コンポーネントをデータをプロパティとして受け取る「Dumb Component (Presentational)」にリファクタリングし、データ取得はラッパーやフック（Smart Component）で行うようにします。

### Current Architecture
`CastDetailPage` -> `PhotoGallery` (IDから取得/派生)
`CastDetailPage` -> `ProfileSpecs` (IDから取得/派生)

### Proposed Architecture
1. **Presentational Components (Pure)**
   - `PhotoGallery({ images })`
   - `ProfileSpecs({ profileData })`

2. **Guest Page (`app/(guest)/cast/[id]/page.tsx`)**
   - データを取得（現在は巨大なモックを使用）。
   - 汎用コンポーネントにデータを渡す。

3. **Preview Modal (`ProfilePreviewModal`)**
   - `ProfileEditPage` から `ProfileFormData` を受け取る。
   - `ProfileFormData` を `ProfileSpecs` が期待する形式に変換（アダプト）する。
   - 変換されたデータを汎用コンポーネントに渡す。

## Data Adaptation
`ProfileFormData` を表示フォーマットにマッピングする必要があります（例：開始・終了時間をスケジュールの表示形式にする、ソーシャルリンクを整形するなど）。
