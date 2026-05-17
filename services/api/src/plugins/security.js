import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";

export async function securityPlugin(fastify) {
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // enable later after you finalize frontend asset policy
  });

  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET, // set strong random
    hook: "onRequest",
  });

  await fastify.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
  });

  // Extra hardening headers you can keep even without CSP
  fastify.addHook("onSend", async (req, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    return payload;
  });
}
