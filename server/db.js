import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import DEFAULT_DATA from '../src/data/portfolioData.js';

const databasePath = path.resolve(process.env.DATABASE_PATH || './server/data/portfolio.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });

export const db = new Database(databasePath);
if (process.platform !== 'win32') fs.chmodSync(databasePath, 0o600);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
`);

const current = db.prepare('SELECT data FROM portfolio WHERE id = 1').get();
if (!current) {
  db.prepare('INSERT INTO portfolio (id, data) VALUES (1, ?)').run(JSON.stringify(DEFAULT_DATA));
}

export function readPortfolio() {
  return JSON.parse(db.prepare('SELECT data FROM portfolio WHERE id = 1').get().data);
}

export function writePortfolio(data) {
  db.prepare('UPDATE portfolio SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(JSON.stringify(data));
}
