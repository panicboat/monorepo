import { afterEach, describe, expect, it, vi } from "vitest";

// Replace NodeSDK because the real one registers a global tracer provider that outlives the test.
const sdk = vi.hoisted(() => {
  const configs: { instrumentations: unknown[] }[] = [];
  class NodeSDK {
    constructor(config: { instrumentations: unknown[] }) {
      configs.push(config);
    }
    start() {}
  }
  return { configs, NodeSDK };
});
vi.mock("@opentelemetry/sdk-node", () => ({ NodeSDK: sdk.NodeSDK }));

import { register } from "./instrumentation";

describe("register", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sdk.configs.length = 0;
  });

  it("instruments only the libraries the server calls in the Node.js runtime", () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    register();

    const names = sdk.configs
      .flatMap((config) => config.instrumentations.flat())
      .map((instrumentation) => (instrumentation as { instrumentationName: string }).instrumentationName);
    expect(names.sort()).toEqual([
      "@opentelemetry/instrumentation-aws-sdk",
      "@opentelemetry/instrumentation-http",
      "@opentelemetry/instrumentation-undici",
    ]);
  });
});
