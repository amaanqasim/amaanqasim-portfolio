import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';

const destination = path.resolve(process.argv[2] || `./server/data/backups/portfolio-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
await db.backup(destination);
console.log(`Database backup written to ${destination}`);
db.close();
