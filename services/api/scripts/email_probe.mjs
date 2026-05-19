import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sendEmail } from "../src/lib/email.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");

function parseDotEnv(content) {
  const out = {};
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function loadEnvFallback() {
  const envPath = path.join(repoRoot, ".env");
  try {
    const parsed = parseDotEnv(await fs.readFile(envPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function run() {
  await loadEnvFallback();

  const to = String(process.env.EMAIL_PROBE_TO || process.env.SMTP_USER || "").trim();
  if (!to) {
    throw new Error("Missing recipient. Set EMAIL_PROBE_TO or SMTP_USER.");
  }

  const app = {
    config: {
      NODE_ENV: required("NODE_ENV"),
      EMAIL_PROVIDER: String(process.env.EMAIL_PROVIDER || "").trim(),
      EMAIL_API_KEY: String(process.env.EMAIL_API_KEY || "").trim(),
      EMAIL_API_BASE_URL: String(process.env.EMAIL_API_BASE_URL || "").trim(),
      EMAIL_FROM: String(process.env.EMAIL_FROM || "").trim(),
      EMAIL_FROM_NAME: String(process.env.EMAIL_FROM_NAME || "").trim(),
      BREVO_API_KEY: String(process.env.BREVO_API_KEY || "").trim(),
      SMTP_HOST: String(process.env.SMTP_HOST || "").trim(),
      SMTP_PORT: Number(process.env.SMTP_PORT || 587),
      SMTP_SECURE: /^(1|true|yes|on)$/i.test(String(process.env.SMTP_SECURE || "").trim()),
      SMTP_USER: String(process.env.SMTP_USER || "").trim(),
      SMTP_PASS: String(process.env.SMTP_PASS || "").trim(),
      SMTP_FROM: String(process.env.SMTP_FROM || "").trim()
    },
    log: {
      info: (...args) => console.log(...args),
      warn: (...args) => console.warn(...args),
      error: (...args) => console.error(...args)
    }
  };

  const provider = app.config.EMAIL_PROVIDER || (app.config.BREVO_API_KEY || app.config.EMAIL_API_KEY ? "brevo" : (app.config.SMTP_HOST ? "smtp" : "mock"));
  console.log(`Email probe using provider: ${provider}`);
  console.log(`Email probe recipient: ${to}`);

  const result = await sendEmail(
    app,
    to,
    "EIP email probe",
    "This is a provider probe from EIP.",
    "<p>This is a provider probe from <strong>EIP</strong>.</p>"
  );

  console.log(JSON.stringify({ ok: true, provider, result }, null, 2));
}

run().catch((error) => {
  console.error(`EMAIL_PROBE_FAILED: ${error?.message || error}`);
  process.exit(1);
});
