# Frontend

[🇺🇸 English](README.md) | **日本語**

## 💡 Role

Next.js (App Router) で構築されたフロントエンドアプリケーション。

## 🔗 Architecture / Dependencies

**Frontend (Next.js) → BFF (Next.js API) → Backend (gRPC)**

- **Frontend**: Next.js App Router (React Server Components + Client Components)。
- **BFF (Backend for Frontend)**: Next.js (API Routes / Server Actions) に統合。認証、セッション管理、データの集約を担当。
- **Backend Communication**: バックエンドのマイクロサービスとは **gRPC** (via [ConnectRPC](https://connectrpc.com/)) で通信。
- **Protocol**: `Frontend` --(HTTP/JSON)--> `BFF` --(gRPC/Proto)--> `Backend Services`。

### Directory Structure

```
src/
├── app/              # ルーティング & ページ
├── components/       # 共通コンポーネント
│   ├── layout/       # レイアウト (TopNavBar, BottomNavBar 等)
│   │   ├── cast/
│   │   └── guest/
│   ├── shared/       # クロスドメイン共有
│   ├── ui/           # プリミティブ UI
│   └── providers/    # グローバル Provider
├── modules/          # ドメイン固有モジュール (6ドメイン)
│   └── {domain}/
│       ├── components/
│       ├── hooks/
│       └── types.ts
├── stores/           # Zustand グローバルストア
│   ├── authStore.ts
│   ├── uiStore.ts
│   └── socialStore.ts
├── lib/              # ユーティリティ
│   └── auth/         # トークン管理
│       ├── tokens.ts
│       └── index.ts
└── config/
    └── theme.ts      # デザイントークン参照
```

### State Management

| 状態タイプ | ツール | 用途 |
|-----------|--------|------|
| **グローバル状態** | Zustand | 認証、UI状態、ローカル永続化 |
| **サーバー状態** | SWR | リモートデータ取得、キャッシュ |
| **フォーム状態** | useState / React Hook Form | ローカルコンポーネント内 |

#### Zustand Stores

- `stores/authStore.ts` - 認証トークン管理（persist ミドルウェア）
- `stores/uiStore.ts` - モーダル、サイドバー状態
- `stores/socialStore.ts` - フォロー、お気に入り（persist ミドルウェア）

### Design Tokens

デザイントークンは CSS カスタムプロパティと Tailwind `@theme inline` を使用して定義。

| カテゴリ | トークン例 | 用途 |
|----------|-----------|------|
| Brand | `--color-brand-primary` | プライマリカラー (Guest: pink, Cast: blue) |
| Semantic | `--color-surface`, `--color-border` | 背景、ボーダー |
| Status | `--color-success`, `--color-error` | 成功、エラー状態 |
| Role | `--color-role-guest`, `--color-role-cast` | ロール別カラー |

#### Usage

```tsx
// CSS クラス (Tailwind)
<button className="bg-brand hover:bg-brand-hover">Click</button>

// TypeScript 参照
import { colors } from '@/config/theme';
<div style={{ color: colors.brand.primary }}>...</div>
```

## ⚙️ Environment Variables

| Variable | Description | Default | Required |
| --- | --- | --- | --- |
| `GRPC_ENDPOINT` | gRPC バックエンド URL | - | Yes |

## 🚀 Running Locally

```bash
cd workspace
npm install
npm run dev
```
