# Implement Draggable Scroll UI

## Why
PCブラウザにおいて、横スクロール要素（検索画面のハイライト、トップページのイベントスライダー）の操作性が低い（ドラッグできない、スクロールバー操作が必要）という課題がある。
また、スクロール可能であることが視覚的に伝わりにくい。

## What Changes
- **Draggable Container**: `framer-motion` を使用し、マウスドラッグによる横スクロール操作を可能にする。
- **Visual Cues**: カードサイズや余白を調整し、次の要素が「チラ見え（Peek）」するようにして、続きがあることを直感的に伝える。
- **Scope**:
    - `app/search/page.tsx` (Highlights section)
    - `modules/discovery/components/EventSlider.tsx`

## Impact
- **UX**: PC/SP問わず、ネイティブアプリのような直感的なスクロール体験を提供。
