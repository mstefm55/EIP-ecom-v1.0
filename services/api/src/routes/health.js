export default async function healthRoutes(app) {
  app.get(
    "/health",
    {
      config: {
        rateLimit: { max: 60, timeWindow: "1 minute" },
        cors: { origin: app.PUBLIC_ORIGINS, credentials: false }
      }
    },
    async () => {
    return {
      ok: true,
      service: "core-api",
      time: new Date().toISOString()
    };
    }
  );
  if (app.config.ENABLE_PUBLIC_DB_HEALTH === true) {
    // DB connectivity check
    app.get(
      "/health/db",
      {
        config: {
          rateLimit: { max: 30, timeWindow: "1 minute" },
          cors: { origin: app.PUBLIC_ORIGINS, credentials: false }
        }
      },
      async () => {
        // Uses the pool created in plugins/db.js
        const r = await app.db.query("select 1 as ok");
        return { ok: true, db: true, result: r.rows[0] };
      }
    );
  } else {
    app.log.info({ event: "public_db_health_disabled" });
  }
}
