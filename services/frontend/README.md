# Frontend

**English** | [🇯🇵 日本語](README-ja.md)

## 💡 Role

Frontend application built with Next.js (App Router).

## 🔗 Architecture / Dependencies

**Frontend (Next.js) → BFF (Next.js API) → Backend (gRPC)**

- **Frontend**: Next.js App Router (React Server Components + Client Components).
- **BFF (Backend for Frontend)**: integrated into Next.js (API Routes / Server Actions). Handles authentication, session management, and data aggregation.
- **Backend Communication**: Communicates with backend microservices via **gRPC** (using [ConnectRPC](https://connectrpc.com/)).
- **Protocol**: `Frontend` --(HTTP/JSON)--> `BFF` --(gRPC/Proto)--> `Backend Services`.

### Directory Structure

```
src/
├── app/              # Routing & Pages
├── components/       # Shared Components
│   ├── layout/       # Layout (TopNavBar, BottomNavBar, etc.)
│   │   ├── cast/
│   │   └── guest/
│   ├── shared/       # Cross-domain shared
│   ├── ui/           # Primitive UI
│   └── providers/    # Global Providers
├── modules/          # Domain-specific modules (6 domains)
│   └── {domain}/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── types.ts
├── stores/           # Zustand global stores
│   ├── authStore.ts
│   ├── uiStore.ts
│   └── socialStore.ts
├── lib/              # Utilities
│   └── auth/         # Token management
│       ├── tokens.ts
│       └── index.ts
└── config/
    └── theme.ts      # Design token references
```

### State Management

| State Type | Tool | Use Case |
|------------|------|----------|
| **Global State** | Zustand | Auth, UI state, local persistence |
| **Server State** | SWR | Remote data fetching, caching |
| **Form State** | useState / React Hook Form | Local component state |

#### Zustand Stores

- `stores/authStore.ts` - Auth token management (persist middleware)
- `stores/uiStore.ts` - Modal, sidebar state
- `stores/socialStore.ts` - Following, favorites (persist middleware)

### Design Tokens

Design tokens are defined using CSS custom properties and Tailwind `@theme inline`.

| Category | Example Token | Use Case |
|----------|---------------|----------|
| Brand | `--color-brand-primary` | Primary color (Guest: pink, Cast: blue) |
| Semantic | `--color-surface`, `--color-border` | Background, border |
| Status | `--color-success`, `--color-error` | Success, error states |
| Role | `--color-role-guest`, `--color-role-cast` | Role-specific colors |

#### Usage

```tsx
// CSS class (Tailwind)
<button className="bg-brand hover:bg-brand-hover">Click</button>

// TypeScript reference
import { colors } from '@/config/theme';
<div style={{ color: colors.brand.primary }}>...</div>
```

## ⚙️ Environment Variables

| Variable | Description | Default | Required |
| --- | --- | --- | --- |
| `GRPC_ENDPOINT` | gRPC backend URL | - | Yes |

## 🚀 Running Locally

```bash
cd workspace
npm install
npm run dev
```
