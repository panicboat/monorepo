# Implement Swipeable Profile Gallery

## Why
現在、キャストプロフィールの画像ギャラリーは単純な切り替え式ですが、ユーザー体験を向上させるために、ネイティブアプリのようなスワイプ操作（またはスムーズなカ-ousel）による画像閲覧機能が求められています。参考サイト（hime-channel）のようなリッチなビジュアル体験を提供します。

## What Changes
- `PhotoGallery` コンポーネントを改修し、スワイプ操作（タッチ/ドラッグ）に対応させます。
- 複数の画像がある場合、インジケーターを表示し、現在の位置を可視化します。
- `framer-motion` の `drag` 機能などを活用してスムーズなトランジションを実装します。

## Impact
- **Web Frontend**: `PhotoGallery.tsx` の大幅な改修。
- **Spec**: Portfolio仕様にギャラリー操作の要件を追加。
