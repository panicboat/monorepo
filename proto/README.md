# Protocol Buffers Definitions

**English** | [🇯🇵 日本語](README-ja.md)

## Overview

This directory contains the shared Protocol Buffers (`.proto`) definitions for the entire repository. Use this single source of truth to define APIs and data structures shared across services.

## Development Workflow

1.  **Edit**: Modify or add `.proto` files in this directory.
2.  **Lint**: Ensure your definitions follow the rules.
    ```bash
    buf lint
    ```
3.  **Generate**: Run the generation command for the specific service you are working on.

## Code Generation

Code generation is **decentralized**. Each service workspace maintains its own `buf.gen.yaml` configuration and generation implementation.

## Tools

*   **Buf**: Required for linting and used internally by generation scripts.
    *   Install: `brew install buf`
