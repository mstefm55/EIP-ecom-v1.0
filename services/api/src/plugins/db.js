import fp from "fastify-plugin";
import pg from "pg";

const { Pool } = pg;

async function dbPlugin(app) {
     app.log.info(
    {
      DB_HOST: app.config.DB_HOST,
      DB_PORT: app.config.DB_PORT,
      DB_USER_type: typeof app.config.DB_USER,
      DB_PASSWORD_type: typeof app.config.DB_PASSWORD,
      DB_PASSWORD_defined: app.config.DB_PASSWORD !== undefined,
      DB_NAME: app.config.DB_NAME,
      PG_POOL_MAX: app.config.PG_POOL_MAX
    },
    "DB CONFIG CHECK"
  );
  const pool = new Pool({
  host: app.config.DB_HOST,
  port: app.config.DB_PORT,
  user: app.config.DB_USER,
  password: app.config.DB_PASSWORD,
  database: app.config.DB_DATABASE,
  max: app.config.PG_POOL_MAX
});
  // Expose the pool as app.db
  app.decorate("db", pool);

  // Test connection on startup (fail fast)
  try {
    const result = await pool.query("select 1 as ok");
    app.log.info({ db: result.rows[0] }, "PostgreSQL connected");
  } catch (err) {
    app.log.error(err, "PostgreSQL connection failed");
    throw err;
  }

  // Close pool on shutdown
  app.addHook("onClose", async () => {
    await pool.end();
    app.log.info("PostgreSQL pool closed");
  });
}

export default fp(dbPlugin, {
  name: "db",
  fastify: "5.x"
});
