import { buildOpenApiDocument } from './registry.js';

const doc = buildOpenApiDocument();
process.stdout.write(JSON.stringify(doc, null, 2));
