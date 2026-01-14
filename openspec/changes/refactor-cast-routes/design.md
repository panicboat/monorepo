# Design: Cast URL Refactoring

## Routing Strategy

### 1. Root Directory Change
- **Current**: `src/app/(cast)/manage/*`
- **New**: `src/app/(cast)/cast/*` (実質的に `src/app/(cast)/[...slug]` ではなく明示的なディレクトリ構造とする)

Next.js の App Router はフォルダ名がそのまま URL パスになるため、`manage` フォルダの中身を `cast` フォルダ（あるいはルート直下の構成変更）に移動する必要がある。
ただし、`src/app/(cast)` は Route Group であり URL には影響しない。
現状: `src/app/(cast)/manage/page.tsx` -> `/manage`

変更後: `src/app/(cast)/cast/page.tsx` -> `/cast`

### 2. Path Mapping

| Page Name | Old Path | New Path | Note |
| :--- | :--- | :--- | :--- |
| **Portal / Root** | `/manage` (redirect) | `/cast` | Login/LP entry point |
| **Services** | N/A | `/cast` | ゲストの `/` に相当 |
| **Onboarding** | `/manage/onboarding` | `/cast/onboarding` | |
| **Home/Dashboard**| `/manage/home` | `/cast/home` | |
| **Timeline** | `/manage/timeline` | `/cast/timeline` | |
| **Reviews** | `/manage/reviews` | `/cast/reviews` | |
| **History** | `/manage/history` | `/cast/history` | |
| **MyPage** | `/manage/mypage` | `/cast/mypage` | |
| **Profile Edit** | `/manage/profile/*`| `/cast/profile/*`| |
| **Concierge** | `/manage/concierge`| `/cast/concierge`| |

### 3. Component Updates
以下のコンポーネント内でハードコードされているパスを置換する：
- `BottomNavBar`
- `CastTopNavBar`
- `useCastAuth` (もしリダイレクトロジックが含まれていれば)
- `middleware` (もしロールベースのリダイレクトがあれば)

## Migration Strategy
1.  `src/app/(cast)/manage` を `src/app/(cast)/cast` にリネームする（git mv）。
2.  `layout.tsx` や `page.tsx` 内の import パス修正は VSCode/IDE の自動補完に頼るが、動的な文字列指定などは grep 置換する。
3.  `router.push('/manage/...')` のようなコードを全検索して置換する。
