import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { RecognitionOptions, RecognitionSession, SpeechRecognizer, Translator } from "./adapters/contracts.js";
import { createApp } from "./app.js";
import type { ServiceConfig } from "./config.js";
import { RoomRegistry } from "./room/room-registry.js";

class FakeTranslator implements Translator {
  async translate(): Promise<string> {
    return "translated";
  }
}

class FakeRecognizer implements SpeechRecognizer {
  async start(_options: RecognitionOptions): Promise<RecognitionSession> {
    return { write: () => undefined, stop: async () => undefined };
  }
}

const config: ServiceConfig = {
  awsRegion: "ap-northeast-1",
  bedrockModelId: "test-model",
  basePath: "/translate",
  glossary: [],
};

const createPublicDir = async (): Promise<string> => {
  const publicDir = await mkdtemp(join(tmpdir(), "meeting-translation-public-"));
  await writeFile(join(publicDir, "index.html"), "<main>meeting translation</main>");
  await writeFile(join(publicDir, "app-Z9xY8wV7.js"), "console.log('meeting')");
  return publicDir;
};

const apps: ReturnType<typeof createApp>[] = [];

const createTestApp = async () => {
  const app = createApp({
    config,
    registry: new RoomRegistry({ translator: new FakeTranslator(), recognizer: new FakeRecognizer() }),
    publicDir: await createPublicDir(),
  });
  await app.ready();
  apps.push(app);
  return app;
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("createApp", () => {
  it("creates no more than five rooms for one IP in a rate window", async () => {
    const app = await createTestApp();

    const created = await Promise.all(
      Array.from({ length: 5 }, () => app.inject({
        method: "POST",
        url: "/translate/api/rooms",
        headers: { "x-forwarded-for": "203.0.113.4" },
      })),
    );
    const limited = await app.inject({
      method: "POST",
      url: "/translate/api/rooms",
      headers: { "x-forwarded-for": "203.0.113.4" },
    });

    expect(created.map((response) => response.statusCode)).toEqual([201, 201, 201, 201, 201]);
    for (const response of created) {
      expect(response.json()).toEqual({ roomId: expect.any(String), joinToken: expect.any(String) });
    }
    expect(limited.statusCode).toBe(429);
  });

  it("serves health and entry HTML without caching participant state", async () => {
    const app = await createTestApp();

    const [health, index, room, asset] = await Promise.all([
      app.inject({ method: "GET", url: "/translate/healthz" }),
      app.inject({ method: "GET", url: "/translate/" }),
      app.inject({ method: "GET", url: "/translate/rooms/room_123" }),
      app.inject({ method: "GET", url: "/translate/assets/app-Z9xY8wV7.js" }),
    ]);

    expect(health.json()).toEqual({ status: "ok" });
    expect(health.headers["cache-control"]).toBe("no-store");
    expect(index.headers["cache-control"]).toBe("no-store");
    expect(room.headers["cache-control"]).toBe("no-store");
    expect(index.body).toContain("meeting translation");
    expect(room.body).toContain("meeting translation");
    expect(asset.headers["cache-control"]).toContain("immutable");
  });
});
