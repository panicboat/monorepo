# Proposal: Cast Profile Edit

- **Change ID:** `feat-app-cast-profile`
- **Author:** Antigravity
- **Status:** Proposed

## Summary
キャストが自身のプロフィール情報（写真、タグ、自己紹介など）を編集するための画面を実装する。

## Motivation
現在、マイページの「プロフィール編集」ボタンはプレースホルダーとなっている。
キャストが自身の魅力をアピールするために、プロフィール情報を随時更新できる機能が必要である。
`demo` には対応する詳細画面がないため、`Onboarding` のUI部品などを活用しながら新規に実装する。

## Proposed Changes

### Frontend (`web/heaven/apps/shell`)

#### Pages
- `src/app/cast/profile/edit/page.tsx`:
    - プロフィール編集フォーム。
    - アイコン、プロフィール写真（複数枚）、源氏名、タグ、自己紹介文の編集が可能。
    - 保存ボタンでAPIへ更新リクエストを送信。

#### Components
- `src/components/features/cast/PhotoUploader.tsx`:
    - 写真のアップロード（追加）・削除を行うUIコンポーネント。
    - プレビュー表示機能付き。

### Mock API (MSW)
- `src/mocks/handlers/cast.ts`:
    - `PUT /api/cast/profile`: プロフィール更新を受け付けるモックハンドラ。
    - `GET /api/cast/profile`: 編集用（初期表示用）の現在のプロフィールデータを取得するハンドラ（必要であれば既存の `/api/casts/:id` を流用または新規作成）。

## Verification Plan
1.  MyPage から「プロフィール編集」をクリックして遷移できることを確認。
2.  各フォーム要素（テキスト、タグ、写真）が操作できることを確認。
3.  「保存」ボタン押下時に `PUT` リクエストが送信され、成功メッセージが表示されることを確認。
