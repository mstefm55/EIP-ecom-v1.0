import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const adminModuleUrl = pathToFileURL(
  path.join(repoRoot, "apps/dashboard/src/engine/surfaces/admin.js")
).href;

const { adminSurface } = await import(adminModuleUrl);

const treeJson = JSON.stringify(adminSurface.tree, null, 2);
const attrsJson = JSON.stringify(
  { source: "seed", generated_at: new Date().toISOString() },
  null,
  2
);

const sql = `BEGIN;

INSERT INTO eip_core.ui_surface
  (tenant_id, code, title, version, is_active, is_published, is_public, tree, attrs)
SELECT
  NULL,
  'admin',
  'EIP Admin',
  COALESCE(MAX(version), 0) + 1,
  true,
  true,
  false,
  $$${treeJson}$$::jsonb,
  $$${attrsJson}$$::jsonb
FROM eip_core.ui_surface
WHERE tenant_id IS NULL AND code = 'admin';

COMMIT;
`;

const outputPath = path.join(
  repoRoot,
  "services/api/db/seed/ui_surface_admin.sql"
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sql, "utf8");

console.log(`Wrote ${outputPath}`);
