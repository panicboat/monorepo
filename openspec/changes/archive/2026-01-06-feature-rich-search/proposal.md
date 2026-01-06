# Implement Rich Search UI

## Why
現在の検索画面はリスト形式（電話帳スタイル）で事務的な印象を与えており、キャストの魅力（シズル感）が伝わりにくいという問題があります。
「選ぶ楽しさ」を提供し、より直感的に好みのキャストを見つけられるようにするため、ビジュアル重視のUIへ刷新します。

## What Changes
- **Search UI Refactoring**:
    - **Grid Layout**: 2カラムのカード型グリッド表示に変更し、写真を大きく表示します。
    - **One-Liner**: 各カードに「最新のひとこと（つぶやき）」を表示し、リアルタイム感を演出します。
    - **Highlights**: 検索結果の上部に「今夜会える（Tonight/Online）」キャストの横スクロールセクションを追加し、リズムを作ります。
- **Mock Data Update**: 検索用モックデータに「ひとこと（status message）」を追加します。

## Impact
- **Web Frontend**: `app/search/page.tsx` の全面改修。
- **Spec**: Discovery仕様にリッチ検索表示の要件を追加。
