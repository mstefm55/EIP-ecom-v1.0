// services/api/src/lib/email.js
import nodemailer from "nodemailer";

export function createEmailTransporter(config) {
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE, // true for 465, false for other ports
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

// Mock implementation for development
export async function sendEmailMock(options, log) {
  log.info({
    event: "email_mock_sent",
    to: options.to,
    subject: options.subject,
    // In real impl, don't log sensitive content
  });
  // Simulate async delay
  await new Promise(resolve => setTimeout(resolve, 100));
  return { ok: true, messageId: "mock-" + Date.now() };
}

export async function sendEmail(app, to, subject, text, html) {
  const isDev = app.config.NODE_ENV !== "production";
  const from = app.config.SMTP_FROM || "noreply@eip.local";

  if (isDev) {
    return await sendEmailMock({ to, subject, text, html }, app.log);
  }

  const transporter = createEmailTransporter(app.config);
  const result = await sendEmailWithTransporter(transporter, { from, to, subject, text, html });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result;
}