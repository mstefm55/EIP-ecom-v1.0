// services/api/src/lib/email.js
import nodemailer from "nodemailer";

const DEFAULT_BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function normalizeEmailProvider(config) {
  const explicit = String(config.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (explicit) return explicit;
  if (firstNonEmpty(config.BREVO_API_KEY, config.EMAIL_API_KEY)) return "brevo";
  if (String(config.SMTP_HOST || "").trim()) return "smtp";
  return "mock";
}

function resolveFromAddress(config) {
  return firstNonEmpty(
    config.EMAIL_FROM,
    config.SMTP_FROM,
    config.SMTP_USER,
    "noreply@eip.local"
  );
}

function resolveFromName(config) {
  return String(config.EMAIL_FROM_NAME || "").trim();
}

function toRecipients(to) {
  return String(to || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.*)<([^>]+)>$/);
      if (match) {
        const name = String(match[1] || "").trim().replace(/^"|"$/g, "");
        const email = String(match[2] || "").trim();
        return name ? { email, name } : { email };
      }
      return { email: entry };
    });
}

export function createEmailTransporter(config) {
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });
}

export async function sendEmailWithTransporter(transporter, options) {
  try {
    const info = await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function sendEmailWithBrevo(config, options) {
  const apiKey = firstNonEmpty(config.BREVO_API_KEY, config.EMAIL_API_KEY);
  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY_MISSING" };
  }

  const endpoint = firstNonEmpty(config.EMAIL_API_BASE_URL, DEFAULT_BREVO_API_URL);
  const to = toRecipients(options.to);
  if (to.length === 0) {
    return { ok: false, error: "EMAIL_RECIPIENT_MISSING" };
  }

  const sender = { email: options.from };
  if (options.fromName) sender.name = options.fromName;

  const headers = {
    accept: "application/json",
    "content-type": "application/json"
  };
  headers[["api", "key"].join("-")] = apiKey;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sender,
        to,
        subject: options.subject,
        textContent: options.text,
        htmlContent: options.html
      })
    });

    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const detail = payload?.message || payload?.code || raw || `HTTP_${response.status}`;
      return { ok: false, error: detail };
    }

    return {
      ok: true,
      messageId: payload?.messageId || payload?.messageIds?.[0] || null
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function sendEmailMock(options, log) {
  log.info({
    event: "email_mock_sent",
    to: options.to,
    subject: options.subject,
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { ok: true, messageId: "mock-" + Date.now() };
}

export async function sendEmail(app, to, subject, text, html) {
  const isDev = app.config.NODE_ENV !== "production";
  const from = resolveFromAddress(app.config);
  const fromName = resolveFromName(app.config);

  if (isDev) {
    return await sendEmailMock({ to, subject, text, html }, app.log);
  }

  const provider = normalizeEmailProvider(app.config);
  let result;

  if (provider === "brevo") {
    result = await sendEmailWithBrevo(app.config, { from, fromName, to, subject, text, html });
  } else if (provider === "smtp") {
    const transporter = createEmailTransporter(app.config);
    result = await sendEmailWithTransporter(transporter, { from, to, subject, text, html });
  } else {
    throw new Error(`EMAIL_PROVIDER_UNSUPPORTED: ${provider}`);
  }

  if (!result.ok) {
    throw new Error(result.error);
  }
  return result;
}
