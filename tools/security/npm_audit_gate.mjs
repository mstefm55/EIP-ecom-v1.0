import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const baselinePath = path.join(repoRoot, "tools", "security", "npm_audit_baseline.json");
const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const severityRank = new Map([
  ["info", 0],
  ["low", 1],
  ["moderate", 2],
  ["high", 3],
  ["critical", 4]
]);
const gateSeverities = new Set(baseline.severity_gate || ["high", "critical"]);
const gateLevel = Math.min(...[...gateSeverities].map((severity) => severityRank.get(severity) ?? 3));

function advisoryIdFrom(value) {
  const text = String(value || "");
  return text.match(/GHSA-[a-z0-9-]+/i)?.[0] || "";
}

function severityIsBlocking(severity) {
  return (severityRank.get(String(severity || "").toLowerCase()) ?? -1) >= gateLevel;
}

function allowKey(projectName, packageName, advisory) {
  return `${projectName}:${packageName}:${advisory}`;
}

function runAudit(project) {
  const cwd = path.join(repoRoot, project.path);
  const command = process.platform === "win32"
    ? `${npmCommand} audit --omit=dev --json`
    : npmCommand;
  const args = process.platform === "win32" ? [] : ["audit", "--omit=dev", "--json"];
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (!result.stdout) {
    throw new Error(`npm audit returned no JSON for ${project.name}: ${result.stderr || "no stderr"}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Unable to parse npm audit JSON for ${project.name}: ${error.message}`);
  }
}

const allowed = new Set();
for (const project of baseline.projects || []) {
  for (const item of project.allow || []) {
    allowed.add(allowKey(project.name, item.package, item.advisory));
  }
}

const seenAllowed = new Set();
const newFindings = [];
const summary = [];

for (const project of baseline.projects || []) {
  const report = runAudit(project);
  const metadata = report.metadata?.vulnerabilities || {};
  let blockingCount = 0;
  let knownBlockingCount = 0;

  for (const vuln of Object.values(report.vulnerabilities || {})) {
    for (const via of vuln.via || []) {
      if (!via || typeof via !== "object") continue;
      if (!severityIsBlocking(via.severity)) continue;

      const advisory = advisoryIdFrom(via.url) || String(via.source || "");
      const key = allowKey(project.name, vuln.name, advisory);
      blockingCount += 1;

      if (allowed.has(key)) {
        seenAllowed.add(key);
        knownBlockingCount += 1;
        continue;
      }

      newFindings.push({
        project: project.name,
        package: vuln.name,
        severity: via.severity,
        advisory,
        title: via.title || "npm audit advisory"
      });
    }
  }

  summary.push({
    project: project.name,
    total: metadata.total || 0,
    high: metadata.high || 0,
    critical: metadata.critical || 0,
    blocking: blockingCount,
    known_blocking: knownBlockingCount
  });
}

const staleBaseline = [...allowed].filter((key) => !seenAllowed.has(key));

console.log("npm audit gate summary:");
summary.forEach((item) => {
  console.log(
    `${item.project}: total=${item.total} high=${item.high} critical=${item.critical} blocking=${item.blocking} known=${item.known_blocking}`
  );
});

if (newFindings.length > 0) {
  console.error("New high/critical production dependency audit findings:");
  newFindings.forEach((finding) => {
    console.error(`${finding.project} ${finding.package} ${finding.severity} ${finding.advisory} ${finding.title}`);
  });
}

if (staleBaseline.length > 0) {
  console.error("Stale npm audit baseline entries were found. Remove fixed advisories from tools/security/npm_audit_baseline.json:");
  staleBaseline.forEach((key) => console.error(key));
}

if (newFindings.length > 0 || staleBaseline.length > 0) {
  process.exit(1);
}

console.log("npm audit gate passed: no new high/critical production advisories outside the baseline.");
