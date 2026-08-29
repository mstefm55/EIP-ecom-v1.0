import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const findings = [];

const walk = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
};

const exactPathExists = (candidate) => {
  const absolute = path.resolve(candidate);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    if (!fs.existsSync(current)) return false;
    const names = fs.readdirSync(current);
    if (!names.includes(segment)) return false;
    current = path.join(current, segment);
  }
  return fs.existsSync(current);
};

const resolveRelativeImport = (file, specifier) => {
  const base = path.resolve(path.dirname(file), specifier);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.json`,
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

for (const file of walk(srcRoot)) {
  const source = fs.readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.ts') ? ts.ScriptKind.TS : file.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);

  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      if (specifier.startsWith('.')) {
        const resolved = resolveRelativeImport(file, specifier);
        if (!resolved) {
          findings.push({
            type: 'missing-relative-import',
            file: path.relative(root, file).replaceAll('\\', '/'),
            import: specifier
          });
        } else if (!exactPathExists(resolved)) {
          findings.push({
            type: 'case-sensitive-import-mismatch',
            file: path.relative(root, file).replaceAll('\\', '/'),
            import: specifier,
            resolved: path.relative(root, resolved).replaceAll('\\', '/')
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const dataFacade = fs.readFileSync(path.join(srcRoot, 'data.js'), 'utf8');
if (/\b(?:const|let|var)\s+SEWING_PATTERNS\s*=\s*\[/.test(dataFacade)) {
  findings.push({ type: 'catalogue-authority', file: 'src/data.js', message: 'Catalogue product rows must come from the runtime repository/EIP boundary.' });
}

for (const file of walk(srcRoot)) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');
  if (/\b(?:localhost|127\.0\.0\.1)\b/.test(source)) {
    findings.push({ type: 'hardcoded-local-host', file: rel });
  }
}

const result = {
  ok: findings.length === 0,
  findingCount: findings.length,
  findings,
  notes: [
    'Relative imports are checked with exact filesystem casing so Windows-only paths do not break Linux/cloud builds.',
    'Catalogue rows must remain runtime records behind the repository boundary; src/data.js is only a compatibility facade.',
    'No localhost/127.0.0.1 dependency may be required by the production frontend.'
  ]
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
