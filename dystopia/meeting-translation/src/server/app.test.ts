import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { RecognitionOptions, RecognitionSession, SpeechRecognizer, Translator } from "./adapters/contracts.js";
import { createApp, shutdownApp } from "./app.js";
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
  await mkdir(join(publicDir, "assets"));
  await writeFile(join(publicDir, "assets", "app-Z9xY8wV7.js"), "console.log('meeting')");
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
  it("waits for Fastify close before destroying all rooms", async () => {
    const events: string[] = [];
    let resolveClose: (() => void) | undefined;
    const completion = shutdownApp(
      {
        close: () => new Promise<void>((resolve) => {
          events.push("close");
          resolveClose = resolve;
        }),
      },
      {
        destroyAll: async () => {
          events.push("destroyAll");
        },
      },
    );

    expect(events).toEqual(["close"]);
    resolveClose?.();
    await completion;
    expect(events).toEqual(["close", "destroyAll"]);
  });

  it("creates no more than five rooms for one IP in a rate window", async () => {
    const app = await createTestApp();
    const createRoom = (remoteAddress: string) => app.inject({
      method: "POST",
      url: "/translate/api/rooms",
      remoteAddress,
    });

    const created = await Promise.all(
      Array.from({ length: 5 }, () => createRoom("203.0.113.4")),
    );
    const limited = await createRoom("203.0.113.4");
    const anotherIp = await createRoom("203.0.113.5");

    expect(created.map((response) => response.statusCode)).toEqual([201, 201, 201, 201, 201]);
    for (const response of created) {
      expect(response.json()).toEqual({ roomId: expect.any(String), joinToken: expect.any(String) });
    }
    expect(limited.statusCode).toBe(429);
    expect(anotherIp.statusCode).toBe(201);
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
