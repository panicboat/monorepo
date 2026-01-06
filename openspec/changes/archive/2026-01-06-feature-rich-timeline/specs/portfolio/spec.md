# Rich Timeline Implementation Spec

## 1. Data Models

### PostItem (Update)
既存の投稿データ構造を拡張し、メディアタイプを識別可能にします。

```typescript
type MediaType = 'image' | 'video' | 'gif';

interface PostMedia {
  type: MediaType;
  url: string;       // Original Source URL (MP4, GIF, JPG)
  thumbnail?: string; // Poster image for video
  aspectRatio?: number; // Optional: for layout calculation
}

interface PostItem {
  id: string;
  content: string;
  time: string;
  media: PostMedia[]; // Renamed from 'images' to support mixed types
  likes: number;
  comments: number;
}
```

## 2. UI/UX Specifications

### A. Timeline Item (List View)
- **Image/GIF**: `<img>` タグで表示。`object-cover` で枠を埋める。
- **Video**: サムネイル画像を表示し、中心に半透明の `PlayIcon` を配置する。
- **Grid Layout**: 複数メディアがある場合は、既存のグリッドレイアウト（1枚、2枚、3枚+）を維持・適応する。

### B. Media Modal (Interaction)
- メディアをタップすると `AnimatePresence` を用いたモーダルがフェードインする。
- モーダル背景は黒（半透明）。
- **Video Playback**: `<video controls autoPlay playsInline>` をレンダリング。
- **Close**: 背景タップまたは「×」ボタンで閉じる。

### C. Full Timeline Page (`/timeline/[id]`)
- **Header**:
  - Left: `<ChevronLeft>` (Back to Profile)
  - Center: Cast Name
  - Right: **Layout Toggle** (Icon Switch: List/Grid)
- **Sub-Header (Sticky)**:
  - **Filter Tabs**: `All` | `Photos` | `Videos`
- **Body**:
  - **List Mode**: `CastPosts` compatible text + media card stack.
  - **Grid Mode**: 3-column square grid. Shows only media thumbnails. Video items have a corner indicator or play icon.
  - **Infinite Scroll**: Load more as user scrolls down.

## 3. Implementation Steps

1. **Refactor `CastPosts`**:
   - 内部の `PostItem` 定義とモックデータを分離・拡張する。
   - レンダリング部分をサブコンポーネント `PostCard` として切り出し、再利用可能にする。
2. **Implement `MediaModal`**:
   - `common` モジュールに作成。動画・画像の表示切り替えロジックを実装。
3. **Create Page (`/timeline/[id]`)**:
   - State: `filter` ('all'|'image'|'video'), `layout` ('list'|'grid').
   - Implement Filter Logic manually (frontend mock).
   - Implement Grid Layout using CSS Grid (`grid-cols-3`).
