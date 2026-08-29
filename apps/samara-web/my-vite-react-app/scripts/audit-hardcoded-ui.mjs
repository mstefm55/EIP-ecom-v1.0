import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const srcDir = path.join(root, 'src');
const metadataFiles = new Set([
  path.normalize('src/config/perfectFitMetadata.js'),
  path.normalize('src/components/workspace/workspaceMetadata.js'),
  path.normalize('src/components/workspace/techPackMetadata.js'),
  path.normalize('src/components/findMySizeMetadata.js'),
  path.normalize('src/components/messages/messageMetadata.js'),
  path.normalize('src/components/materials/materialsMetadata.js'),
  path.normalize('src/components/measurement/measurementAvatarMetadata.js'),
  path.normalize('src/components/measurement/avatarProfiles.js'),
  path.normalize('src/components/measurement/avatarAreaMetadata.js'),
  path.normalize('src/components/measurement/russianFemaleMeasurementGuide.js'),
  path.normalize('src/config/surfaceVisibilityMetadata.js'),
  path.normalize('src/data/catalogTaxonomy.js')
]);

const literalAllowlist = [
  /^Perfect Fit(?: Bureau)?$/i,
  /^BUREAU$/,
  /^PDF$/,
  /^SVG$/,
  /^DXF$/,
  /^CLO$/,
  /^ZIP$/,
  /^A4$/,
  /^cm$/i,
  /^in$/i,
  /^%$/,
  /^[A-Z0-9_ -]{1,18}$/,
  /^[0-9.,:$€£+\-/%\s]+$/,
  /^https?:\/\//,
  /^#[a-f0-9]{3,8}$/i
];

let allowlistedLiteralCount = 0;

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['dist', 'node_modules', '.git'].includes(entry.name)) return [];
      return walk(fullPath);
    }
    return /\.(jsx?|tsx?)$/.test(entry.name) ? [fullPath] : [];
  });
};

const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const isAllowedLiteral = (value) => {
  const text = String(value || '').trim();
  if (!text) return true;
  if (text.length < 2) return true;
  if (/^[{}()[\].,;:!?'"`+\-*/|&<>=\s]+$/.test(text)) return true;
  if (/[{}();=]/.test(text) || /&&|\|\||=>|\bcase\b/.test(text)) return true;
  const allowed = literalAllowlist.some((pattern) => pattern.test(text));
  if (allowed) allowlistedLiteralCount += 1;
  return allowed;
};

const getLine = (source, index) => source.slice(0, index).split(/\r?\n/).length;

const findings = [];

for (const file of walk(srcDir)) {
  const relative = path.relative(root, file);
  const normalized = path.normalize(relative);

  if (metadataFiles.has(normalized)) continue;

  const raw = fs.readFileSync(file, 'utf8');
  const source = stripComments(raw);

  const jsxTextRegex = />\s*([^<>{}\n][^<>{}]*?)\s*</g;
  let match;

  while ((match = jsxTextRegex.exec(source))) {
    // Ignore JavaScript arrow expressions accidentally matched as JSX:
    // item => item.stock < threshold
    if (match.index > 0 && source[match.index - 1] === '=') {
      continue;
    }

    const text = match[1].replace(/\s+/g, ' ').trim();

    if (!isAllowedLiteral(text)) {
      findings.push({
        file: relative,
        line: getLine(source, match.index),
        type: 'jsx-text',
        text
      });
    }
  }

  const attributeRegex =
    /\b(placeholder|title|aria-label|alt)=["']([^"']+)["']/g;

  while ((match = attributeRegex.exec(source))) {
    const text = match[2].replace(/\s+/g, ' ').trim();

    if (!isAllowedLiteral(text)) {
      findings.push({
        file: relative,
        line: getLine(source, match.index),
        type: match[1],
        text
      });
    }
  }
}
const metadataSourceFiles = [
  'src/config/perfectFitMetadata.js',
  'src/components/workspace/workspaceMetadata.js',
  'src/components/findMySizeMetadata.js'
];
const englishKeyMatches = metadataSourceFiles.flatMap((file) => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  return [...source.matchAll(/['"]([a-z][a-z0-9]*(?:\.[a-zA-Z0-9_-]+)+)['"]\s*:/g)].map(
    (item) => item[1]
  );
});
const englishKeys = [...new Set(englishKeyMatches)];

const coverage = [
  {
    locale: 'en',
    keys: englishKeys.length,
    englishKeys: englishKeys.length,
    missingKeys: []
  }
];

const unresolvedHardcodedUi = findings.length;
const result = {
  ok: unresolvedHardcodedUi === 0,
  unresolvedHardcodedUi,
  hardcodedFindingCount: findings.length,
  allowlistedLiteralCount,
  sampleFindings: findings.slice(0, 50),
  localeCoverage: coverage,
  notes: [
    'Audit is read-only and intentionally does not auto-edit code.',
    'Metadata/config/data files are excluded so fallback labels can live in canonical metadata.',
    'Audit exits non-zero while unresolved user-visible hardcoded strings remain.'
  ]
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
