# Nyx Web Workspace

## Overview
This is the workspace for the **Nyx** web application, built with **Next.js**.

## Architecture

**Frontend (Next.js) → BFF (Next.js API) → Backend (gRPC)**

This application follows a BFF (Backend for Frontend) pattern:
1.  **Frontend**: The client-side (and server-rendered) React application.
2.  **BFF (Next.js API)**: API Routes or Server Actions that act as an interface between the frontend and the backend services.
3.  **Backend**: Microservices communicable via gRPC.

### Communication Flow
- **Client** requests data via **HTTP/JSON** (or Server Actions) to the **Next.js Server (BFF)**.
- **BFF** communicates with the **Backend Services** using **gRPC** (via `@connectrpc/connect`).

## Current Implementation Status

### 🚧 API & Data Fetching
- **BFF Implementation**: Currently, the BFF layer (API Routes) is **NOT yet fully implemented**.
- **Mocking**: We use **MSW (Mock Service Worker)** to simulate the BFF layer during development.
- **Frontend**: The frontend fetches data from `/api/*` endpoints, which are intercepted by MSW handlers in `src/mocks/handlers`.
- **gRPC Clients**: Defined in `src/lib/rpc.ts` but currently unused until the real BFF routes are implemented.

### 🛠 Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **RPC**: ConnectRPC (gRPC-Web / gRPC-Node)
- **Mocking**: MSW (Mock Service Worker)

## Getting Started

```bash
pnpm dev
```
Start the development server. MSW will automatically activate in the browser/server to mock API responses.
