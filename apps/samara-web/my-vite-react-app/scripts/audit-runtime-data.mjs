import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const srcRoot = path.join(root, 'src');

const BUSINESS_TOKEN = /(cart|wishlist|favorite|review|order|product|catalog|pattern|project|workspace|material|supplier|inventory|message|newsletter|subscription|profile|fabric|sales|community|blog|post|consultation|booking|sewing|tech.?pack|media|notification)/i;
const RUNTIME_ARRAY_NAME = /(products?|reviews?|orders?|posts?|articles?|messages?|projects?|materials?|suppliers?|bookings?|testimonials?|subscriptions?|favorites?|wishlist|cartItems|guestOrders|inventory|salesHistory)/i;

const ALLOWED_STORAGE_KEYS = new Set([
  'perfectfit_locale',
  'perfectfit_view_mode',
  'perfectfit_app_layout_metadata',
  'perfectfit_app_layout_metadata_version',
  'sartorial_ui_metadata',
  'sartorial_layout_rules',
  'sartorial_ui_login_dependent',
  'sartorial_ui_render_mode',
  'atelier_hover_info_enabled',
  'perfectfit_enable_track_shipment'
]);

const ALLOWED_INFRA_FILES = [
  /src[\/]config[\/]perfectFitMetadata\.js$/,
  /src[\/]lib[\/]runtimeDataGateway\.js$/,
  /src[\/]lib[\/]runtimeRepositoryBootstrap\.js$/,
  /src[\/]lib[\/]materialsRepository\.js$/,
  /src[\/]lib[\/]i18n\.js$/,
  /src[\/]lib[\/]floatingToolLayout\.js$/,
  /src[\/]lib[\/]clientBinaryCache\.js$/,
  /src[\/]lib[\/]clientPreferences\.js$/,
  /src[\/]config[\/]surfaceVisibilityMetadata\.js$/,
  /src[\/]data[\/]runtimeSeeds\.js$/
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

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function textOf(node) {
  return node?.getText?.() || '';
}

function literalValue(node) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function propertyName(node) {
  if (!node) return '';
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text;
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
  return textOf(node);
}

const findings = [];

for (const file of walk(srcRoot)) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');
  if (
    !/src[\/]lib[\/]runtimeRepositoryBootstrap\.js$/.test(relative) &&
    /(?:from\s+|import\s*\()['"][^'"]*data\/runtimeSeeds(?:\.js)?['"]/.test(source)
  ) {
    findings.push({
      file: relative,
      line: source.slice(0, source.search(/data\/runtimeSeeds/)).split(/\r?\n/).length,
      type: 'direct-demo-seed-import',
      detail: 'Demo seed data may only enter runtime through the explicit opt-in repository bootstrap.'
    });
  }
  if (ALLOWED_INFRA_FILES.some((pattern) => pattern.test(relative))) continue;

  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.ts') ? ts.ScriptKind.TS : file.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);

  function add(node, type, detail) {
    findings.push({ file: relative, line: lineOf(sf, node), type, detail });
  }

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = textOf(node.expression.expression);
      const method = node.expression.name.text;

      if ((owner === 'localStorage' || owner === 'sessionStorage' || owner.endsWith('.localStorage') || owner.endsWith('.sessionStorage')) && ['getItem', 'setItem', 'removeItem'].includes(method)) {
        const key = literalValue(node.arguments[0]);
        if (!key || (!ALLOWED_STORAGE_KEYS.has(key) && BUSINESS_TOKEN.test(key))) {
          add(node, 'direct-business-storage', `${owner}.${method}(${key ? JSON.stringify(key) : 'dynamic key'})`);
        }
      }
    }

    if (ts.isIdentifier(node) && node.text === 'indexedDB') {
      add(node, 'direct-indexeddb', 'indexedDB used outside a repository/cache adapter');
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      if (RUNTIME_ARRAY_NAME.test(node.name.text) && node.initializer.elements.length > 0) {
        const looksLikeRecords = node.initializer.elements.some((item) => ts.isObjectLiteralExpression(item));
        if (looksLikeRecords) {
          add(node, 'hardcoded-runtime-records', `${node.name.text} contains inline runtime records`);
        }
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      if (/^(mockData|demoData|sampleData|seedData|defaultReviews|defaultProducts)$/i.test(name)) {
        add(node, 'embedded-runtime-seed', `${name} is embedded in an active source module`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
}

const result = {
  ok: findings.length === 0,
  findingCount: findings.length,
  findings: findings.slice(0, 250),
  notes: [
    'This audit targets business/runtime authority, not harmless UI preference persistence.',
    'Runtime records should be consumed through repositories; localStorage/IndexedDB may remain underneath adapters/caches.',
    'Static UI/governance metadata belongs in perfectFitMetadata.js, not in runtime repositories.'
  ]
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
