export const envSchema = {
  type: "object",
  // 1. Add them to 'required' so the app won't start if they are missing from .env
  required: [
    "NODE_ENV", 
    "PORT", 
    "HOST", 
    "CORS_ORIGIN", 
    "DB_HOST", 
    "DB_USER", 
    "DB_PASSWORD", 
    "DB_DATABASE"
  ],
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    PORT: { type: "integer", default: 4000 },
    HOST: { type: "string", default: "0.0.0.0" },
    CORS_ORIGIN: { type: "string", default: "http://localhost:5173" },
    
    // 2. Define the types for your DB variables
    DB_HOST: { type: "string", default: "localhost" },
    DB_PORT: { type: "integer", default: 5432 },
    DB_USER: { type: "string" },
    DB_PASSWORD: { type: "string" },
    DB_DATABASE: { type: "string" },
    
    // 3. Add PG_POOL_MAX as an integer
    PG_POOL_MAX: { type: "integer", default: 10 }
  }
};