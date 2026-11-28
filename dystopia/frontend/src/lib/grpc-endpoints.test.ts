import { describe, expect, it } from "vitest";
import { mediaServiceUrl, monolithUrl } from "./grpc-endpoints";

describe("mediaServiceUrl", () => {
  it("sends media to the monolith when no media service is set", () => {
    const env = {
      NODE_ENV: "test",
      MONOLITH_URL: "http://127.0.0.1:50051",
    } as const;

    expect(mediaServiceUrl(env)).toBe("http://127.0.0.1:50051");
  });

  it("sends media to the media service when it is set", () => {
    const env = {
      NODE_ENV: "test",
      MONOLITH_URL: "http://127.0.0.1:50051",
      MEDIA_SERVICE_URL: "http://127.0.0.1:50052",
    } as const;

    expect(mediaServiceUrl(env)).toBe("http://127.0.0.1:50052");
    expect(monolithUrl(env)).toBe("http://127.0.0.1:50051");
  });

  it("falls back to the local monolith", () => {
    const env = { NODE_ENV: "test" } as const;

    expect(mediaServiceUrl(env)).toBe("http://localhost:9001");
    expect(monolithUrl(env)).toBe("http://localhost:9001");
  });
});
