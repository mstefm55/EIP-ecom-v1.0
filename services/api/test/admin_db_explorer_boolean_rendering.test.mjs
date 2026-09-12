import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const explorer = fs.readFileSync(
  path.join(repoRoot, "apps/dashboard/src/components/admin/AdminDbExplorer.jsx"),
  "utf8"
);

test("Admin DB Explorer renders boolean database values explicitly", () => {
  assert.match(explorer, /typeof value === ["']boolean["']/);
  assert.match(explorer, /\? String\(value\)/);
  assert.match(explorer, /value && typeof value === ["']object["']/);
});
