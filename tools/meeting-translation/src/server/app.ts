import { basename, join } from "node:path";

import fastify, { LogController, type FastifyInstance, type FastifyReply, type FastifyRequest, type RawServerDefault } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";

import type { ServiceConfig } from "./config.js";
import { RoomCreationLimiter } from "./room/room-creation-limiter.js";
import { RoomRegistry } from "./room/room-registry.js";
import { registerWebsocketRoute } from "./transport/websocket-route.js";

export interface AppDependencies {
  config: ServiceConfig;
  registry: RoomRegistry;
  publicDir: string;
}

export const shutdownApp = async (
  app: { close(): Promise<unknown> },
  registry: Pick<RoomRegistry, "destroyAll">,
): Promise<void> => {
  await app.close();
  await registry.destroyAll();
};

const isHashedAsset = (filePath: string): boolean => /-[A-Za-z0-9_-]{6,}\./.test(basename(filePath));

const logFields = (value: unknown): { eventCode: string; participantId?: string } => {
  const fields = typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
  return {
    eventCode: typeof fields?.eventCode === "string" ? fields.eventCode : "internal_error",
    ...(typeof fields?.participantId === "string" ? { participantId: fields.participantId } : {}),
  };
};

export const createApp = (dependencies: AppDependencies): FastifyInstance => {
  const basePath = dependencies.config.basePath.replace(/\/$/, "");
  const app = fastify<RawServerDefault>({
    logger: {
      level: "error",
      base: undefined,
      hooks: {
        logMethod(args, method) {
          method.apply(this, [logFields(args[0])]);
        },
      },
    },
    logController: new LogController({ disableRequestLogging: true }),
  });
  const limiter = new RoomCreationLimiter();

  app.register(fastifyWebsocket, {
    options: { maxPayload: 64 * 1_024 },
    errorHandler: function (_error, socket) {
      this.log.error({ eventCode: "websocket_route_error" });
      socket.terminate();
    },
  });
  app.after((error) => {
    if (error) throw error;
    registerWebsocketRoute(app, dependencies.registry, `${basePath}/ws`);
  });

  app.register(fastifyStatic, {
    root: join(dependencies.publicDir, "assets"),
    prefix: `${basePath}/assets/`,
    cacheControl: false,
    setHeaders: (reply, filePath) => {
      reply.header(
        "Cache-Control",
        isHashedAsset(filePath) ? "public, max-age=31536000, immutable" : "no-store",
      );
    },
  });

  app.post(`${basePath}/api/rooms`, (request, reply) => {
    if (!limiter.allow(request.ip)) return reply.code(429).send();
    const { roomId, joinToken } = dependencies.registry.create();
    return reply.code(201).send({ roomId, joinToken });
  });

  app.get(`${basePath}/healthz`, (_request, reply) =>
    reply.header("Cache-Control", "no-store").send({ status: "ok" }),
  );

  const sendEntryHtml = (_request: FastifyRequest, reply: FastifyReply) =>
    reply.header("Cache-Control", "no-store").sendFile("index.html", dependencies.publicDir);
  app.get(`${basePath}/`, sendEntryHtml);
  app.get(`${basePath}/rooms/:roomId`, sendEntryHtml);

  return app;
};
