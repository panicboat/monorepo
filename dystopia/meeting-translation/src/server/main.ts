import { resolve } from "node:path";

import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

import { BedrockTranslator } from "./adapters/bedrock-translator.js";
import { TranscribeRecognizer } from "./adapters/transcribe-recognizer.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { RoomRegistry } from "./room/room-registry.js";

export const startServer = async (): Promise<void> => {
  const config = loadConfig(process.env);
  const registry = new RoomRegistry({
    translator: new BedrockTranslator(new BedrockRuntimeClient({ region: config.awsRegion }), config),
    recognizer: new TranscribeRecognizer(config),
    glossary: config.glossary,
  });
  const app = createApp({ config, registry, publicDir: resolve(process.cwd(), "dist/public") });
  const port = Number(process.env.PORT ?? "3001");
  let shutdownCompletion: Promise<void> | undefined;

  const shutdown = (): Promise<void> => {
    shutdownCompletion ??= (async () => {
      await app.close();
      await registry.destroyAll();
    })();
    return shutdownCompletion;
  };

  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
  await app.listen({ port, host: "0.0.0.0" });
};

void startServer();
