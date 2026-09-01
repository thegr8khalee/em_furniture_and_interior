#!/usr/bin/env node
/**
 * Guards the hand-maintained API documents until they are generated from route
 * schemas (see context/06-replatform-plan.md section 6).
 *
 * Checks:
 *   1. Both documents parse as JSON.
 *   2. Every path in the OpenAPI spec is unique and starts with /api.
 *   3. Every route declared in the payments routes file appears in the spec.
 *      Payments is checked specifically because it handles money and is the
 *      most costly place for the documentation to be wrong.
 *   4. Neither document mentions a gateway that has been removed.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = [];

const readJson = (relative) => {
  try {
    return JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
  } catch (error) {
    fail.push(`${relative} is not valid JSON: ${error.message}`);
    return null;
  }
};

const spec = readJson('apps/api/docs/swagger.json');
const postman = readJson('apps/api/docs/EM_Furniture_API.postman_collection.json');

if (spec) {
  const paths = Object.keys(spec.paths ?? {});
  if (paths.length === 0) fail.push('OpenAPI spec declares no paths');

  for (const p of paths) {
    if (!p.startsWith('/api')) fail.push(`OpenAPI path does not start with /api: ${p}`);
  }

  // Every payments route must be documented.
  const routesSrc = readFileSync(
    path.join(root, 'apps/api/src/routes/payments.routes.js'),
    'utf8'
  );
  const declared = [...routesSrc.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)]
    .map(([, method, route]) => ({ method, path: `/api/payments${route}` }));

  for (const { method, path: full } of declared) {
    const entry = spec.paths?.[full];
    if (!entry) {
      fail.push(`Payments route missing from OpenAPI spec: ${method.toUpperCase()} ${full}`);
    } else if (!entry[method]) {
      fail.push(`OpenAPI spec documents ${full} but not the ${method.toUpperCase()} method`);
    }
  }
}

// Gateways removed from the codebase must not linger in published docs.
const REMOVED_GATEWAYS = ['flutterwave'];
for (const [name, doc] of [['OpenAPI spec', spec], ['Postman collection', postman]]) {
  if (!doc) continue;
  const blob = JSON.stringify(doc).toLowerCase();
  for (const gateway of REMOVED_GATEWAYS) {
    if (blob.includes(gateway)) fail.push(`${name} still references removed gateway: ${gateway}`);
  }
}

if (fail.length > 0) {
  console.error('API documentation check failed:\n');
  for (const message of fail) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`API documentation OK — ${Object.keys(spec.paths).length} documented paths.`);
