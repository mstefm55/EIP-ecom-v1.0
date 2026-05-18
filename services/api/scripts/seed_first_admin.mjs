import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import { Client } from "pg";
import { evaluatePasswordStrength } from "../src/auth/password.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");
const OWNER_ADMIN_AGENT_CODE = "OWNER-ADMIN";

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

function pickInput(args, envName, ...argNames) {
  const envValue = String(process.env[envName] || "").trim();
  if (envValue) return envValue;
  for (const argName of argNames) {
    const argValue = String(args[argName] || "").trim();
    if (argValue) return argValue;
  }
  return "";
}

function parseBool(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function validateTenantCode(value) {
  return /^[a-z0-9][a-z0-9_-]{1,63}$/i.test(value);
}

async function passwordMatches(hash, password) {
  if (!hash) return false;
  try {
    return await argon2.verify(String(hash), password);
  } catch {
    return false;
  }
}

async function ensureOwnerTenant(client, { tenantCode, tenantName }) {
  const existingRes = await client.query(
    `
    SELECT id, code, name
    FROM eip_core.tenant
    WHERE code = $1
    LIMIT 1
    `,
    [tenantCode]
  );
  const existing = existingRes.rows[0];

  if (!existing?.id) {
    const createdRes = await client.query(
      `
      INSERT INTO eip_core.tenant (code, name, attrs, is_active)
      VALUES (
        $1,
        $2,
        jsonb_build_object('tenant_kind', 'owner_admin', 'seeded_by', 'seed_first_admin'),
        true
      )
      RETURNING id, code, name
      `,
      [tenantCode, tenantName]
    );
    return { tenant: createdRes.rows[0], created: true };
  }

  const updatedRes = await client.query(
    `
    UPDATE eip_core.tenant
    SET name = $2,
        is_active = true,
        attrs = COALESCE(attrs, '{}'::jsonb) ||
                jsonb_build_object('tenant_kind', 'owner_admin', 'seeded_by', 'seed_first_admin'),
        updated_at = now()
    WHERE id = $1
    RETURNING id, code, name
    `,
    [existing.id, tenantName]
  );
  return { tenant: updatedRes.rows[0], created: false };
}

async function ensureAdminSurfacesAndMenu(client) {
  await client.query(
    `
    INSERT INTO eip_authz.surface(code, label, sort_order) VALUES
      ('ADMIN','Admin',10),
      ('ERP','ERP',20),
      ('PARTNER','Partner Portal',30),
      ('ECOM','E-Commerce',40)
    ON CONFLICT (code) DO NOTHING
    `
  );

  await client.query(
    `
    INSERT INTO eip_authz.menu_item(surface_code, code, label, route, icon, sort_order)
    VALUES ('ADMIN','ADMIN_HOME','Admin Home','/admin','Shield',10)
    ON CONFLICT (surface_code, code)
    DO UPDATE SET
      label = EXCLUDED.label,
      route = EXCLUDED.route,
      icon = EXCLUDED.icon,
      sort_order = EXCLUDED.sort_order,
      is_active = true,
      updated_at = now()
    `
  );
}

async function ensureAdminSuperRole(client, tenantId) {
  await ensureAdminSurfacesAndMenu(client);

  const roleRes = await client.query(
    `
    INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system, is_active)
    VALUES ($1, 'ADMIN_SUPER', 'Super Admin', 'ADMIN', true, true)
    ON CONFLICT (tenant_id, code)
    DO UPDATE SET
      label = EXCLUDED.label,
      surface_code = EXCLUDED.surface_code,
      is_system = true,
      is_active = true,
      updated_at = now()
    RETURNING id
    `,
    [tenantId]
  );
  const roleId = roleRes.rows[0]?.id;
  if (!roleId) {
    throw new Error("ADMIN_SUPER role could not be created");
  }

  const permissionRes = await client.query(
    `
    INSERT INTO eip_authz.role_permission(role_id, permission_code)
    SELECT $1, p.code
    FROM eip_authz.permission p
    ON CONFLICT DO NOTHING
    RETURNING permission_code
    `,
    [roleId]
  );

  const menuRes = await client.query(
    `
    INSERT INTO eip_authz.role_menu(role_id, menu_item_id)
    SELECT $1, mi.id
    FROM eip_authz.menu_item mi
    WHERE mi.surface_code = 'ADMIN'
      AND mi.is_active = true
    ON CONFLICT DO NOTHING
    RETURNING menu_item_id
    `,
    [roleId]
  );

  return {
    id: roleId,
    permissionsAdded: permissionRes.rowCount || 0,
    menuItemsAdded: menuRes.rowCount || 0
  };
}

async function run() {
  await loadEnvFallback();
  const args = parseArgs(process.argv.slice(2));

  const tenantCode = pickInput(args, "OWNER_TENANT_CODE", "tenant-code");
  const tenantName = pickInput(args, "OWNER_TENANT_NAME", "tenant-name");
  const email = pickInput(args, "OWNER_ADMIN_EMAIL", "email", "admin-email").toLowerCase();
  const password = process.env.OWNER_ADMIN_PASSWORD || args.password || args["admin-password"] || "";
  const adminName = pickInput(args, "OWNER_ADMIN_NAME", "name", "admin-name") || email;
  const resetPassword = parseBool(
    process.env.OWNER_ADMIN_RESET_PASSWORD || args["reset-password"]
  );

  if (!tenantCode || !validateTenantCode(tenantCode)) {
    throw new Error(
      "OWNER_TENANT_CODE or --tenant-code must be a URL-safe tenant code (2-64 chars)"
    );
  }
  if (!tenantName) {
    throw new Error("OWNER_TENANT_NAME or --tenant-name is required");
  }
  if (!email || !email.includes("@")) {
    throw new Error("OWNER_ADMIN_EMAIL or --email must be a valid email address");
  }
  if (!password) {
    throw new Error("OWNER_ADMIN_PASSWORD or --password is required");
  }

  const strength = evaluatePasswordStrength(password);
  if (!strength.ok) {
    throw new Error(`OWNER_ADMIN_PASSWORD is too weak: ${strength.feedback.join("; ")}`);
  }

  const client = new Client(buildDbConfig());
  await client.connect();

  const summary = {
    tenant_code: tenantCode,
    tenant_name: tenantName,
    tenant_created: false,
    admin_email: email,
    admin_agent_created: false,
    identity_created: false,
    password: "unchanged",
    admin_role_permissions_added: 0,
    admin_role_menu_items_added: 0,
    identity_agent_linked: false,
    admin_role_assigned: false
  };

  try {
    await client.query("BEGIN");

    const tenantResult = await ensureOwnerTenant(client, { tenantCode, tenantName });
    const tenant = tenantResult.tenant;
    summary.tenant_created = tenantResult.created;
    summary.tenant_name = tenant.name;

    const adminRole = await ensureAdminSuperRole(client, tenant.id);
    summary.admin_role_permissions_added = adminRole.permissionsAdded;
    summary.admin_role_menu_items_added = adminRole.menuItemsAdded;

    let agentRes = await client.query(
      `
      SELECT id
      FROM eip_core.agent
      WHERE tenant_id = $1
        AND code = $2
      LIMIT 1
      `,
      [tenant.id, OWNER_ADMIN_AGENT_CODE]
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
        [tenant.id, OWNER_ADMIN_AGENT_CODE, adminName]
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
        [tenant.id, OWNER_ADMIN_AGENT_CODE, adminName]
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
          "An active password already exists for this admin and does not match OWNER_ADMIN_PASSWORD. Set OWNER_ADMIN_RESET_PASSWORD=true to rotate it."
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
        ($1, $2, $3, 'Owner admin', jsonb_build_object('seeded_by', 'seed_first_admin'))
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
  console.error(`Owner admin seed failed: ${error?.message || error}`);
  process.exit(1);
});
