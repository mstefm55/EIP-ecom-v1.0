import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const SOURCE_ROOTS = [
  "services/api/src",
  "apps/dashboard/src",
  "tools",
  "scripts"
];

const REQUIRED_SECURITY_TESTS = [
  "services/api/test/admin_db_explorer_security.test.mjs",
  "services/api/test/admin_audit_panel_static.test.mjs",
  "services/api/test/admin_security_ops.test.mjs",
  "services/api/test/auth_cookie_policy.test.mjs",
  "services/api/test/gateway_api_keys.test.mjs",
  "services/api/test/gateway_outbound_security.test.mjs",
  "services/api/test/gateway_verification.test.mjs",
  "services/api/test/profile_avatar_persistence.test.mjs",
  "services/api/test/passkey_config.test.mjs",
  "services/api/test/public_commerce_hardening.test.mjs",
  "services/api/test/public_gateway_runtime.test.mjs",
  "services/api/test/secret_store.test.mjs",
  "services/api/test/security_audit.test.mjs",
  "services/api/test/session_policy.test.mjs",
  "services/api/test/synthetic_validation_bot.test.mjs",
  "services/api/test/dashboard_csrf_client.test.mjs",
  "services/api/test/surface_access.test.mjs",
  "services/api/test/tenant_isolation.test.mjs"
];

const IGNORED_DIRS = new Set(["node_modules", "dist", "build", "coverage"]);
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ps1"]);

const LINE_RULES = [
  {
    id: "dynamic-eval",
    pattern: /\beval\s*\(/
  },
  {
    id: "dynamic-function-constructor",
    pattern: /\bnew\s+Function\s*\(/
  },
  {
    id: "node-tls-disabled",
    pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']0["']/
  },
  {
    id: "tls-reject-unauthorized-false",
    pattern: /rejectUnauthorized\s*:\s*false/
  }
];

const FILE_RULES = [
  {
    id: "insecure-samesite-none-cookie",
    pattern: /sameSite\s*:\s*["']none["'][\s\S]{0,250}secure\s*:\s*false|secure\s*:\s*false[\s\S]{0,250}sameSite\s*:\s*["']none["']/
  }
];

async function exists(relativePath) {
  try {
    await fs.access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) yield* walk(fullPath);
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      yield fullPath;
    }
  }
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

const findings = [];

for (const testPath of REQUIRED_SECURITY_TESTS) {
  if (!(await exists(testPath))) {
    findings.push({ file: testPath, line: 1, rule: "required-security-test-missing" });
  }
}

for (const root of SOURCE_ROOTS) {
  const absoluteRoot = path.join(repoRoot, root);
  if (!(await exists(root))) continue;
  for await (const filePath of walk(absoluteRoot)) {
    const text = await fs.readFile(filePath, "utf8");
    const rel = relative(filePath);
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (line.includes("security-static-ignore")) return;
      for (const rule of LINE_RULES) {
        if (rule.pattern.test(line)) {
          findings.push({ file: rel, line: index + 1, rule: rule.id });
        }
      }
    });

    for (const rule of FILE_RULES) {
      if (rule.pattern.test(text)) {
        findings.push({ file: rel, line: 1, rule: rule.id });
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Security static checks failed:");
  findings.forEach((finding) => {
    console.error(`${finding.file}:${finding.line} ${finding.rule}`);
  });
  process.exit(1);
}

console.log("Security static checks passed.");
