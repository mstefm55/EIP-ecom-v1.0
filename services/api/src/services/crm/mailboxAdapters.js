import { sha256Hex } from "../../auth/crypto.js";

const PROVIDER_CODES = new Set(["gmail", "microsoft_graph", "imap", "manual_test"]);
const DIRECTION_CODES = new Set(["inbound", "outbound"]);
const MAX_BODY_LENGTH = 50000;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value, maxLength = 500) {
  const text = normalizeText(value);
  return text ? text.slice(0, maxLength) : null;
}

function stripControlCharacters(value) {
  return normalizeText(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

function sanitizeReadableMessageText(value, maxLength = MAX_BODY_LENGTH) {
  return stripControlCharacters(value).slice(0, maxLength);
}

function buildRedactedSnippet(value, maxLength = 240) {
  return sanitizeReadableMessageText(value, maxLength * 3)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, "[REDACTED_PHONE]")
    .slice(0, maxLength);
}

function maskEmail(value) {
  const email = normalizeOptionalText(value, 254)?.toLowerCase();
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1) || "*"}***@${domain}`;
}

function hashOptional(value) {
  const text = normalizeOptionalText(value, 1000);
  return text ? sha256Hex(text.toLowerCase()) : null;
}

function normalizeMailboxMessage(input = {}) {
  const provider = normalizeOptionalText(input.provider, 80)?.toLowerCase() || "manual_test";
  if (!PROVIDER_CODES.has(provider)) return { ok: false, error: "CRM_MAILBOX_PROVIDER_INVALID" };
  const direction = normalizeOptionalText(input.direction, 20)?.toLowerCase() || "inbound";
  if (!DIRECTION_CODES.has(direction)) return { ok: false, error: "CRM_MAILBOX_DIRECTION_INVALID" };
  const subject = sanitizeReadableMessageText(input.subject || "Mailbox message", 300);
  const bodyText = sanitizeReadableMessageText(input.body_text || input.body || input.message, MAX_BODY_LENGTH);
  if (!subject && !bodyText) return { ok: false, error: "CRM_MAILBOX_MESSAGE_CONTENT_REQUIRED" };
  const fromEmail = normalizeOptionalText(input.from_email, 254);
  const providerMessageId = normalizeOptionalText(input.provider_message_id, 300);
  const providerThreadId = normalizeOptionalText(input.provider_thread_id, 300);
  const receivedAt = normalizeOptionalText(input.received_at, 50) || new Date().toISOString();
  const fingerprint = sha256Hex(JSON.stringify({
    provider,
    provider_message_id: providerMessageId,
    provider_thread_id: providerThreadId,
    direction,
    subject,
    body_text: bodyText,
    from_email_hash: hashOptional(fromEmail),
    received_at: receivedAt
  }));
  return {
    ok: true,
    item: {
      provider,
      connection_code: normalizeOptionalText(input.connection_code, 120),
      provider_message_id: providerMessageId,
      provider_thread_id: providerThreadId,
      thread_fingerprint: sha256Hex(`${provider}:${providerThreadId || fingerprint}`),
      direction,
      subject,
      body_text: bodyText,
      redacted_snippet: buildRedactedSnippet(bodyText || subject),
      from_name: normalizeOptionalText(input.from_name, 160),
      from_email_masked: maskEmail(fromEmail),
      from_email_hash: hashOptional(fromEmail),
      received_at: receivedAt,
      message_status: "imported",
      fingerprint,
      attachments: Array.isArray(input.attachments)
        ? input.attachments.slice(0, 20).map((attachment) => ({
            filename: normalizeOptionalText(attachment?.filename, 240),
            mime: normalizeOptionalText(attachment?.mime, 160),
            size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : null,
            file_hash: normalizeOptionalText(attachment?.file_hash, 128)
          }))
        : []
    }
  };
}

function summarizeMailboxMessage(row = {}) {
  const payload = row.payload || {};
  return {
    id: row.id,
    record_type: row.record_type,
    title: row.title,
    description: payload.redacted_snippet || row.description,
    provider: payload.provider,
    connection_code: payload.connection_code,
    direction: payload.direction,
    from_name: payload.from_name,
    from_email_masked: payload.from_email_masked,
    received_at: payload.received_at,
    thread_fingerprint: payload.thread_fingerprint,
    fingerprint: payload.fingerprint,
    status: payload.message_status,
    proposal_id: payload.proposal_id || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

const MANUAL_TEST_PROVIDER = Object.freeze({
  code: "manual_test",
  label: "Manual test provider",
  supports: Object.freeze({
    list_messages: false,
    fetch_message: false,
    create_draft: true,
    send_reply: false,
    mark_processed: false
  }),
  async listMessages() {
    return { ok: true, items: [] };
  },
  async fetchMessage() {
    return { ok: false, error: "CRM_MAILBOX_PROVIDER_FETCH_DISABLED" };
  },
  async createDraft() {
    return { ok: true, provider_draft_created: false };
  },
  async sendReply() {
    return { ok: false, pending: true, error: "CRM_MAILBOX_PROVIDER_SEND_DISABLED" };
  },
  async markProcessed() {
    return { ok: false, error: "CRM_MAILBOX_PROVIDER_MARK_PROCESSED_DISABLED" };
  }
});

const MAILBOX_ADAPTERS = new Map([[MANUAL_TEST_PROVIDER.code, MANUAL_TEST_PROVIDER]]);

function registerMailboxAdapter(code, adapter) {
  const provider = normalizeOptionalText(code, 80)?.toLowerCase();
  if (!provider || !PROVIDER_CODES.has(provider) || !adapter || typeof adapter !== "object") {
    throw new Error("CRM_MAILBOX_ADAPTER_INVALID");
  }
  MAILBOX_ADAPTERS.set(provider, Object.freeze({ ...adapter, code: provider }));
}

function getMailboxAdapter(code) {
  return MAILBOX_ADAPTERS.get(normalizeOptionalText(code, 80)?.toLowerCase() || "manual_test") || null;
}

function listMailboxAdapters() {
  return [...MAILBOX_ADAPTERS.values()].map((adapter) => ({
    provider: adapter.code,
    label: adapter.label || adapter.code,
    available: true,
    supports: { ...(adapter.supports || {}) }
  }));
}

export {
  buildRedactedSnippet,
  getMailboxAdapter,
  listMailboxAdapters,
  normalizeMailboxMessage,
  registerMailboxAdapter,
  sanitizeReadableMessageText,
  summarizeMailboxMessage
};
