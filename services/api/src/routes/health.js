export default async function healthRoutes(app) {
  app.get("/health", async () => {
    return {
      ok: true,
      service: "core-api",
      time: new Date().toISOString()
    };
  });
    // DB connectivity check
  app.get("/health/db", async () => {
    // Uses the pool created in plugins/db.js
    const r = await app.db.query("select 1 as ok");
    return { ok: true, db: true, result: r.rows[0] };
  });
}
