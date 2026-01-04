# Nyx Workspace (`web/nyx/workspace`)

This is the monorepo workspace for the Nyx frontend application, built with [Next.js](https://nextjs.org/) and [Turborepo](https://turbo.build/).

## Architecture

The project follows a modular architecture using internal packages to separate features and UI components from the main application shell.

### Directory Structure

```
web/nyx/workspace/
├── apps/
│   └── shell/              # Main Next.js application (Routes, Pages, Layouts)
└── packages/
    ├── features/           # Feature-specific logic and components
    │   ├── cast/           # Cast onboarding, profile management
    │   ├── chat/           # Chat interface, messaging logic
    │   └── invitation/     # Invitation system, ritual modals
    └── ui/                 # Shared UI components (Design System)
```

### Key Concepts

- **Apps (`apps/shell`)**: The "container" for the application. It handles routing (`app/`), global layouts, and integrates features. usage of `packages/*` is highly encouraged to keep the shell thin.
- **Feature Packages (`packages/features/*`)**: Independent modules containing the business logic and UI for specific domains.
- **UI Package (`packages/ui`)**: Low-level, reusable UI components (Buttons, Inputs, etc.) that define the design system.

## Getting Started

### Prerequisites

- Node.js (via `.nodenv`)
- pnpm

### Installation

```bash
pnpm install
```

### Development

Start the development server for the shell:

```bash
pnpm dev
# or
pnpm dev --filter shell...
```

The application will be available at `http://localhost:3000`.

## Commands

- `pnpm build`: Build all apps and packages.
- `pnpm lint`: Lint all code.
- `pnpm format`: Format code with Prettier.
