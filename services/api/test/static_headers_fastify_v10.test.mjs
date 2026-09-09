import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import staticPlugin from '@fastify/static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverSourcePath = path.resolve(__dirname, '../src/server.js');

test('server static header callbacks use FastifyReply.header for @fastify/static v10', () => {
  const source = fs.readFileSync(serverSourcePath, 'utf8');

  assert.equal(
    (source.match(/setHeaders:\s*\(reply(?:,\s*filePath)?\)\s*=>/g) || []).length,
    2,
    'both static registrations must receive FastifyReply'
  );
  assert.equal(
    (source.match(/reply\.header\("Cross-Origin-Resource-Policy",\s*"cross-origin"\)/g) || []).length,
    2,
    'both static registrations must set CORP through FastifyReply.header'
  );
  assert.equal(
    (source.match(/reply\.header\("Cache-Control",\s*"public, max-age=3600"\)/g) || []).length,
    2,
    'both static registrations must set cache headers through FastifyReply.header'
  );
  assert.doesNotMatch(source, /setHeaders:\s*\(res/);
  assert.doesNotMatch(source, /res\.setHeader\(/);
});

test('@fastify/static v10 serves a file with reply.header without crashing', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eip-static-v10-'));
  fs.writeFileSync(path.join(root, 'probe.txt'), 'eip-static-ok', 'utf8');

  const app = Fastify({ logger: false });
  t.after(async () => {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  await app.register(staticPlugin, {
    root,
    prefix: '/assets/',
    decorateReply: false,
    setHeaders: (reply) => {
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
      reply.header('Cache-Control', 'public, max-age=3600');
    },
  });

  const response = await app.inject({ method: 'GET', url: '/assets/probe.txt' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, 'eip-static-ok');
  assert.equal(response.headers['cross-origin-resource-policy'], 'cross-origin');
  assert.match(String(response.headers['cache-control'] || ''), /max-age=3600/);
});
