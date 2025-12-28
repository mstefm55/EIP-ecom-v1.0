import dbPlugin from "./plugins/db.js";

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import env from "@fastify/env";
import { envSchema } from "./config.js";

import healthRoutes from "./routes/health.js";

async function buildServer() {
  const app = Fastify({
    logger: true
  });

  // Load env into app.config with validation
  await app.register(env, {
    schema: envSchema,
    dotenv: true
  });
  await app.register(dbPlugin);

  // Basic hardening
  await app.register(helmet);

  // CORS for Vite dev server
  await app.register(cors, {
    origin: app.config.CORS_ORIGIN,
    credentials: true
  });

  // Routes
  await app.register(healthRoutes, { prefix: "/api" });

  return app;
}

const app = await buildServer();



try {
  await app.listen({ port: app.config.PORT, host: app.config.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
