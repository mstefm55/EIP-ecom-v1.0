import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

const DISPLAY_PROPERTY = /^(label|title|description|subtitle|help|helpText|placeholder|tooltip|emptyText|emptyState|message|caption|heading|subheading|ariaLabel|alt|name)$/i;
const TECHNICAL_LITERAL = /^(?:[A-Z][A-Z0-9_./-]*|\d+(?:\.\d+)?|cm|mm|in|px|%|PDF|SVG|DXF|CLO|ZIP|A4|US|UK|EU|RU)$/;
const RUNTIME_CONTAINER_NAME = /(?:product|pattern|visitor|metric|piece|fabric|material|inventory|project|order|review|post|article|testimonial|media|asset|swatch|palette|pantone|color|hotspot|avatar|buyer|collaborator|member|sales|supplier|timeline|timer|session|journal|checklist|seed|demo|sample|imported|developer|playground|gallery|bom|routing|toast|status)/i;
const UI_CONFIG_CONTAINER_NAME = /(?:tab|tabs|nav|navigation|menu|section|sections|panel|panels|action|actions|button|buttons|field|fields|filter|filters|option|options|step|steps|surface|surfaces|permission|permissions|module|modules|layout|layouts)/i;
const RUNTIME_OBJECT_MARKER = /^(?:id|sku|code|patternId|productId|variantId|orderId|userId|author|avatar|image|img|photo|imageUrl|url|href|price|pricePDF|pricePrinted|quantity|date|createdAt|updatedAt|dateAdded|rating|coords|path|grainline|labelPos|x|y|w|h|width|height|hex|color|colorHex|border|pantoneName|pantoneCode|yardage|costPerYard|stock|cost|supplier|machine|sam|rate|wasteFactor|baseQty|unit|format|status|completed|role|email|phone|location|permissions|children|values|nodeType)$/i;

const EXCLUDED = [
  /src[\\/]config[\\/]perfectFitMetadata\.js$/,
  /src[\\/]data[\\/]runtimeSeeds\.js$/,
  /src[\\/]assets[\\/]/
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text;
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
  return node.getText();
}

function literalValue(node) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function isInactiveSourceCopy(relative) {
  return /(?:^|[\\/])[^\\/]*\scopy\.(?:js|jsx|ts|tsx)$/i.test(relative);
}

function objectPropertyNames(objectNode) {
  return objectNode.properties
    .filter(ts.isPropertyAssignment)
    .map((property) => propertyName(property.name));
}

function nearestObjectLiteral(node) {
  let current = node.parent;
  while (current) {
    if (ts.isObjectLiteralExpression(current)) return current;
    current = current.parent;
  }
  return null;
}

function nearestContainerNames(node) {
  const names = [];
  let current = node.parent;
  while (current) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      names.push(current.name.text);
    } else if (ts.isPropertyAssignment(current)) {
      names.push(propertyName(current.name));
    } else if (
      ts.isBindingElement(current) &&
      current.name &&
      ts.isIdentifier(current.name)
    ) {
      names.push(current.name.text);
    }
    current = current.parent;
  }
  return names;
}

function isRuntimeRecordProperty(node) {
  const containerNames = nearestContainerNames(node);
  const hasUiContainer = containerNames.some((name) => UI_CONFIG_CONTAINER_NAME.test(name));
  const hasRuntimeContainer = containerNames.some((name) => RUNTIME_CONTAINER_NAME.test(name));

  if (hasRuntimeContainer && !hasUiContainer) return true;

  const objectNode = nearestObjectLiteral(node);
  if (!objectNode) return false;

  const names = objectPropertyNames(objectNode);
  const markerCount = names.filter((name) => RUNTIME_OBJECT_MARKER.test(name)).length;
  const hasRecordIdentity = names.some((name) => /^(?:id|sku|code|patternId|productId|variantId|orderId|userId)$/i.test(name));
  const hasBusinessDatum = names.some((name) => /^(?:price|pricePDF|pricePrinted|quantity|date|createdAt|updatedAt|rating|coords|path|grainline|stock|cost|supplier|machine|sam|rate|wasteFactor|baseQty|unit|format|status|author|avatar|image|imageUrl|url)$/i.test(name));
  const hasMediaDatum = names.some((name) => /^(?:avatar|image|img|photo|imageUrl|url|href)$/i.test(name));
  const hasColorDatum = names.some((name) => /^(?:hex|color|colorHex|border|pantoneName|pantoneCode)$/i.test(name));
  const hasGeometryDatum = names.some((name) => /^(?:coords|path|grainline|labelPos|x|y|w|h|width|height)$/i.test(name));
  const hasDisplayDatum = names.some((name) => DISPLAY_PROPERTY.test(name));
  const hasStatCardDatum = names.includes('label') && names.includes('value') && names.includes('detail');

  return (
    (hasRecordIdentity && hasBusinessDatum) ||
    ((hasMediaDatum || hasColorDatum || hasGeometryDatum) && hasDisplayDatum) ||
    hasStatCardDatum ||
    markerCount >= 4
  );
}

const findings = [];

for (const file of walk(srcRoot)) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (isInactiveSourceCopy(relative)) continue;
  if (EXCLUDED.some((pattern) => pattern.test(relative))) continue;

  const source = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.ts') ? ts.ScriptKind.TS : file.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);

  function visit(node) {
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      const value = literalValue(node.initializer);

      if (
        value &&
        DISPLAY_PROPERTY.test(name) &&
        !/Key$/i.test(name) &&
        !isRuntimeRecordProperty(node) &&
        !TECHNICAL_LITERAL.test(value.trim()) &&
        /[A-Za-z]{2,}/.test(value)
      ) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        findings.push({
          file: relative,
          line,
          property: name,
          text: value.length > 180 ? `${value.slice(0, 177)}...` : value
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
}

const result = {
  ok: findings.length === 0,
  hardcodedMetadataUiCount: findings.length,
  findings: findings.slice(0, 250),
  notes: [
    'This complements audit:i18n by detecting visible English hidden inside configuration objects.',
    'Use stable codes plus labelKey/titleKey/etc. and resolve them through the shared language system.',
    'User-authored/runtime DB content is not a translation-key target.'
  ]
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
