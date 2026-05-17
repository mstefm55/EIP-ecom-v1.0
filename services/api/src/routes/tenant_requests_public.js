// services/api/src/routes/tenant_requests_public.js
import { randomToken, sha256Hex } from "../auth/crypto.js";

const REQUEST_RATE_LIMIT = { max: 5, timeWindow: "10 minute" };
const STATUS_RATE_LIMIT = { max: 30, timeWindow: "1 minute" };
const REQUEST_BODY_LIMIT = 16 * 1024; // 16 KiB
const EMAIL_WINDOW_MIN = 60;
const EMAIL_MAX_REQUESTS = 3;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function buildRefCode() {
  return randomToken(12);
}

export default async function tenantRequestsPublic(app) {
  app.post(
    "/tenant-requests",
    {
      config: {
        rateLimit: REQUEST_RATE_LIMIT,
        cors: { origin: app.PUBLIC_ORIGINS, credentials: false }
      },
      bodyLimit: REQUEST_BODY_LIMIT,
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: [
            "applicantType",
            "legalName",
            "email",
            "country",
            "timezone",
            "acceptTerms",
            "acceptPrivacy",
            "termsVersion",
            "privacyVersion"
          ],
          properties: {
            applicantType: { type: "string", enum: ["business", "sole_trader"] },
            legalName: { type: "string", minLength: 2, maxLength: 200 },
            businessRegNo: { type: "string", minLength: 2, maxLength: 64 },
            personalIdNo: { type: "string", minLength: 2, maxLength: 64 },
            email: { type: "string", minLength: 5, maxLength: 200 },
            phone: { type: "string", maxLength: 50 },
            country: { type: "string", minLength: 2, maxLength: 64 },
            timezone: { type: "string", minLength: 2, maxLength: 64 },
            acceptTerms: { type: "boolean" },
            acceptPrivacy: { type: "boolean" },
            termsVersion: { type: "string", minLength: 1, maxLength: 32 },
            privacyVersion: { type: "string", minLength: 1, maxLength: 32 }
          }
        }
      }
    },
    async (req, reply) => {
      const body = req.body || {};

      const applicantType = String(body.applicantType || "").trim();
      const legalName = normalizeText(body.legalName);
      const email = normalizeEmail(body.email);
      const phone = body.phone ? normalizeText(body.phone) : null;
      const country = normalizeText(body.country);
      const timezone = normalizeText(body.timezone);

      const businessRegNo = body.businessRegNo ? normalizeText(body.businessRegNo) : null;
      const personalIdNo = body.personalIdNo ? normalizeText(body.personalIdNo) : null;

      if (!body.acceptTerms || !body.acceptPrivacy) {
        return reply.code(400).send({ ok: false, error: "CONSENT_REQUIRED" });
      }

      if (applicantType === "business" && !businessRegNo) {
        return reply.code(400).send({ ok: false, error: "BUSINESS_REG_REQUIRED" });
      }
      if (applicantType === "sole_trader" && !personalIdNo) {
        return reply.code(400).send({ ok: false, error: "PERSONAL_ID_REQUIRED" });
      }

      const recent = await app.db.query(
        `
        SELECT count(*)::int AS recent_count
        FROM eip_core.tenant_request
        WHERE email = $1
          AND created_at > now() - ($2 * interval '1 minute')
        `,
        [email, EMAIL_WINDOW_MIN]
      );
      if (recent.rows[0].recent_count >= EMAIL_MAX_REQUESTS) {
        app.log.warn({ event: "tenant_request_rate_limited", email: email.substring(0, 3) + "...", ip: req.ip });
        return reply.code(202).send({ ok: true });
      }

      const refCode = buildRefCode();
      const uaHash = sha256Hex(String(req.headers["user-agent"] || ""));

      const attrs = {
        applicantType,
        businessRegNo,
        personalIdNo,
        email,
        phone,
        country,
        timezone,
        consent: {
          termsVersion: String(body.termsVersion || ""),
          privacyVersion: String(body.privacyVersion || ""),
          acceptedAt: new Date().toISOString()
        },
        submitted_ip: req.ip,
        user_agent_hash: uaHash
      };

      await app.db.query(
        `
        INSERT INTO eip_core.tenant_request
          (ref_code, status_code, applicant_type, legal_name,
           business_reg_no, personal_id_no, email, phone, country, timezone, attrs)
        VALUES
          ($1,'SUBMITTED',$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
        `,
        [
          refCode,
          applicantType,
          legalName,
          businessRegNo,
          personalIdNo,
          email,
          phone,
          country,
          timezone,
          JSON.stringify(attrs)
        ]
      );

      app.log.info({ event: "tenant_request_submitted", ref: refCode, ip: req.ip });

      return reply.code(202).send({ ok: true, ref: refCode });
    }
  );

  app.get(
    "/tenant-requests/status",
    {
      config: {
        rateLimit: STATUS_RATE_LIMIT,
        cors: { origin: app.PUBLIC_ORIGINS, credentials: false }
      },
      schema: {
        querystring: {
          type: "object",
          required: ["ref"],
          additionalProperties: false,
          properties: {
            ref: { type: "string", minLength: 8, maxLength: 128 }
          }
        }
      }
    },
    async (req, reply) => {
      const ref = normalizeText(req.query?.ref);
      if (!ref) {
        return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
      }

      const r = await app.db.query(
        `
        SELECT status_code
        FROM eip_core.tenant_request
        WHERE ref_code = $1
        LIMIT 1
        `,
        [ref]
      );

      if (r.rowCount === 0) {
        return reply.send({ ok: true, status: "UNKNOWN" });
      }

      return reply.send({ ok: true, status: r.rows[0].status_code });
    }
  );
}
