export const envSchema = {
  type: "object",
  required: ["NODE_ENV", "PORT", "HOST", "CORS_ORIGIN"],
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    PORT: { type: "integer", default: 4000 },
    HOST: { type: "string", default: "0.0.0.0" },
    CORS_ORIGIN: { type: "string", default: "http://localhost:5173" }
  }
};
