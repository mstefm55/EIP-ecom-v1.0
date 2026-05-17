import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import { Client } from "pg";
import { evaluatePasswordStrength } from "../src/auth/password.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");
const TENANT_CODE = "eip_demo";
const ADMIN_AGENT_CODE = "ADMIN-FIRST";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq > 2) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

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

function requiredEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required database environment variable: ${name}`);
  }
  return value;
}

function buildDbConfig() {
  return {
    host: requiredEnv("DB_HOST"),
    port: Number(process.env.DB_PORT || 5432),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    database: requiredEnv("DB_DATABASE")
  };
}

function pickInput(args, envName, argName) {
  return String(process.env[envName] || args[argName] || "").trim();
}

function parseBool(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

async function passwordMatches(hash, password) {
  if (!hash) return false;
  try {
    return await argon2.verify(String(hash), password);
  } catch {
    return false;
  }
}

async function run() {
  await loadEnvFallback();
  const args = parseArgs(process.argv.slice(2));

  const email = pickInput(args, "ADMIN_EMAIL", "email").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || args.password || "";
  const adminName = pickInput(args, "ADMIN_NAME", "name") || email;
  const resetPassword = parseBool(process.env.ADMIN_RESET_PASSWORD || args["reset-password"]);

  if (!email || !email.includes("@")) {
    throw new Error("ADMIN_EMAIL or --email must be a valid email address");
  }
  if (!password) {
    throw new Error("ADMIN_PASSWORD or --password is required");
  }

  const strength = evaluatePasswordStrength(password);
  if (!strength.ok) {
    throw new Error(`ADMIN_PASSWORD is too weak: ${strength.feedback.join("; ")}`);
  }

  const client = new Client(buildDbConfig());
  await client.connect();

  const summary = {
    tenant_code: TENANT_CODE,
    admin_email: email,
    admin_agent_created: false,
    identity_created: false,
    password: "unchanged",
    identity_agent_linked: false,
    admin_role_assigned: false
  };

  try {
    await client.query("BEGIN");

    const tenantRes = await client.query(
      `
      SELECT id, code
      FROM eip_core.tenant
      WHERE code = $1
      LIMIT 1
      `,
      [TENANT_CODE]
    );
    const tenant = tenantRes.rows[0];
    if (!tenant?.id) {
      throw new Error(`Tenant not found: code=${TENANT_CODE}`);
    }

    const roleRes = await client.query(
      `
      SELECT id
      FROM eip_authz.role
      WHERE tenant_id = $1
        AND code = 'ADMIN_SUPER'
        AND is_active = true
      LIMIT 1
      `,
      [tenant.id]
    );
    const adminRole = roleRes.rows[0];
    if (!adminRole?.id) {
      throw new Error(`ADMIN_SUPER role not found for tenant ${TENANT_CODE}`);
    }

    let agentRes = await client.query(
      `
      SELECT id
      FROM eip_core.agent
      WHERE tenant_id = $1
        AND code = $2
      LIMIT 1
      `,
      [tenant.id, ADMIN_AGENT_CODE]
    );
    let adminAgent = agentRes.rows[0];
    if (!adminAgent?.id) {
      agentRes = await client.query(
        `
        INSERT INTO eip_core.agent (tenant_id, agent_type, code, name, attrs)
        VALUES (
          $1,
          'person',
          $2,
          $3,
          jsonb_build_object('roles', jsonb_build_array('admin', 'first_admin'), 'seeded_by', 'seed_first_admin')
        )
        RETURNING id
        `,
        [tenant.id, ADMIN_AGENT_CODE, adminName]
      );
      adminAgent = agentRes.rows[0];
      summary.admin_agent_created = true;
    } else {
      await client.query(
        `
        UPDATE eip_core.agent
        SET is_active = true,
            name = COALESCE(name, $3),
            attrs = COALESCE(attrs, '{}'::jsonb) ||
                    jsonb_build_object('seeded_by', 'seed_first_admin'),
            updated_at = now()
        WHERE tenant_id = $1
          AND code = $2
        `,
        [tenant.id, ADMIN_AGENT_CODE, adminName]
      );
    }

    let identityRes = await client.query(
      `
      SELECT id
      FROM eip_auth.auth_identity
      WHERE tenant_id = $1
        AND login = $2
      LIMIT 1
      `,
      [tenant.id, email]
    );
    let identity = identityRes.rows[0];
    if (!identity?.id) {
      identityRes = await client.query(
        `
        INSERT INTO eip_auth.auth_identity (tenant_id, login, login_type, attrs)
        VALUES (
          $1,
          $2,
          'email',
          jsonb_build_object('seeded_by', 'seed_first_admin', 'display_name', $3::text)
        )
        RETURNING id
        `,
        [tenant.id, email, adminName]
      );
      identity = identityRes.rows[0];
      summary.identity_created = true;
    } else {
      await client.query(
        `
        UPDATE eip_auth.auth_identity
        SET is_active = true,
            is_locked = false,
            attrs = COALESCE(attrs, '{}'::jsonb) ||
                    jsonb_build_object('seeded_by', 'seed_first_admin', 'display_name', $3::text),
            updated_at = now()
        WHERE tenant_id = $1
          AND id = $2
        `,
        [tenant.id, identity.id, adminName]
      );
    }

    const credentialRes = await client.query(
      `
      SELECT id, secret_hash, algorithm
      FROM eip_auth.auth_credential
      WHERE tenant_id = $1
        AND identity_id = $2
        AND credential_type = 'password'
        AND is_revoked = false
        AND (valid_to IS NULL OR valid_to > now())
      ORDER BY valid_from DESC NULLS LAST, created_at DESC
      LIMIT 1
      `,
      [tenant.id, identity.id]
    );
    const credential = credentialRes.rows[0];
    const existingPasswordMatches = credential
      ? await passwordMatches(credential.secret_hash, password)
      : false;

    if (!credential || !existingPasswordMatches) {
      if (credential && !resetPassword) {
        throw new Error(
          "An active password already exists for this admin and does not match ADMIN_PASSWORD. Set ADMIN_RESET_PASSWORD=true to rotate it."
        );
      }

      if (credential) {
        await client.query(
          `
          UPDATE eip_auth.auth_credential
          SET is_revoked = true,
              valid_to = now()
          WHERE tenant_id = $1
            AND identity_id = $2
            AND credential_type = 'password'
            AND is_revoked = false
          `,
          [tenant.id, identity.id]
        );
      }

      const secretHash = await argon2.hash(password, { type: argon2.argon2id });
      await client.query(
        `
        INSERT INTO eip_auth.auth_credential
          (tenant_id, identity_id, credential_type, secret_hash, algorithm, meta, valid_from, is_revoked)
        VALUES
          ($1, $2, 'password', $3, 'argon2id',
           jsonb_build_object('seeded_by', 'seed_first_admin'), now(), false)
        `,
        [tenant.id, identity.id, secretHash]
      );
      summary.password = credential ? "reset" : "created";
    }

    const primaryAgentRes = await client.query(
      `
      SELECT agent_id
      FROM eip_auth.auth_identity_agent
      WHERE tenant_id = $1
        AND identity_id = $2
        AND is_primary = true
        AND is_active = true
      LIMIT 1
      `,
      [tenant.id, identity.id]
    );
    const hasPrimary = primaryAgentRes.rowCount > 0;
    const shouldBePrimary =
      !hasPrimary || primaryAgentRes.rows[0]?.agent_id === adminAgent.id;

    await client.query(
      `
      INSERT INTO eip_auth.auth_identity_agent
        (tenant_id, identity_id, agent_id, is_primary, is_active)
      VALUES
        ($1, $2, $3, $4, true)
      ON CONFLICT (identity_id, agent_id)
      DO UPDATE SET
        is_active = true,
        is_primary = eip_auth.auth_identity_agent.is_primary OR EXCLUDED.is_primary
      `,
      [tenant.id, identity.id, adminAgent.id, shouldBePrimary]
    );
    summary.identity_agent_linked = true;

    await client.query(
      `
      INSERT INTO eip_authz.identity_role
        (tenant_id, identity_id, role_id, granted_by_identity_id)
      VALUES
        ($1, $2, $3, NULL)
      ON CONFLICT (tenant_id, identity_id, role_id) DO NOTHING
      `,
      [tenant.id, identity.id, adminRole.id]
    );
    summary.admin_role_assigned = true;

    await client.query(
      `
      INSERT INTO eip_core.user_profile
        (tenant_id, identity_id, display_name, title, attrs)
      VALUES
        ($1, $2, $3, 'First admin', jsonb_build_object('seeded_by', 'seed_first_admin'))
      ON CONFLICT (tenant_id, identity_id)
      DO UPDATE SET
        display_name = COALESCE(eip_core.user_profile.display_name, EXCLUDED.display_name),
        title = COALESCE(eip_core.user_profile.title, EXCLUDED.title),
        attrs = COALESCE(eip_core.user_profile.attrs, '{}'::jsonb) || EXCLUDED.attrs,
        updated_at = now()
      `,
      [tenant.id, identity.id, adminName]
    );

    await client.query("COMMIT");
    console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(`First admin seed failed: ${error?.message || error}`);
  process.exit(1);
});
