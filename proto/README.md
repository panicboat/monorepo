# Protocol Buffers Definitions

**English** | [🇯🇵 日本語](README-ja.md)

## Overview

This directory holds Protocol Buffers (`.proto`) definitions, namespaced per product (`dystopia/`, ...). Each product directory is its own buf module and is the single source of truth for the APIs shared between that product's services.

## Development Workflow

1.  **Edit**: Modify or add `.proto` files under the product's directory (e.g. `dystopia/`).
2.  **Lint**: Ensure your definitions follow the rules.
    ```bash
    buf lint
    ```
3.  **Breaking Check**: Verify backward compatibility against the main branch.
    ```bash
    buf breaking --against "../.git#branch=main,subdir=proto"
    ```
4.  **Generate**: Run the generation command for the specific service you are working on.

## Code Generation

Code generation is **decentralized**. Each service maintains its own `buf.gen.yaml` configuration and generation implementation.

## Tools

*   **Buf**: Required for linting and used internally by generation scripts.
    *   Install: `brew install buf`
