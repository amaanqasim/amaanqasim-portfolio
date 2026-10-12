import 'dotenv/config';
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { db, writePortfolio } from './db.js';
import { portfolioSchema } from './validation.js';

const filename = process.argv[2];
if (!filename) throw new Error('Usage: node server/import-portfolio.js <export.json>');
const raw = JSON.parse(fs.readFileSync(filename, 'utf8'));
const parsed = portfolioSchema.safeParse(raw);
if (!parsed.success) throw new Error(`Export did not match the portfolio format: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
const rl = readline.createInterface({ input, output });
try {
  console.log('This replaces the current SQLite portfolio data. Make a backup first.');
  if ((await rl.question('Type IMPORT to continue: ')) !== 'IMPORT') throw new Error('Import cancelled.');
  writePortfolio(parsed.data);
  console.log('Portfolio data imported.');
} finally { rl.close(); db.close(); }
