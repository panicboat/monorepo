# Nyx Web Workspace

## Overview

This is the workspace for the **Nyx** web application, built with **Next.js**.

## Getting Started

### Running Locally

```bash
pnpm dev
```

## Proto Generation

When `.proto` files are updated in the root `proto` directory, run this command to regenerate TypeScript types:

```bash
pnpm proto:gen
# This runs 'buf generate' internally
```

Start the development server. MSW will automatically activate in the browser/server to mock API responses.
