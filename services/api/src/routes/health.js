export default async function healthRoutes(app) {
  app.get("/health", async () => {
    return {
      ok: true,
      service: "core-api",
      time: new Date().toISOString()
    };
  });
}
