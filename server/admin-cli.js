import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import argon2 from 'argon2';
import { db } from './db.js';

const command = process.argv[2];
let rl;
let pipedAnswers = [];

async function prepareInput() {
  if (!input.isTTY) {
    input.setEncoding('utf8');
    let raw = '';
    for await (const chunk of input) raw += chunk;
    pipedAnswers = raw.split(/\r?\n/);
    return;
  }
  rl = readline.createInterface({ input, output });
}

async function askUsername(prompt) {
  if (!input.isTTY) { output.write(prompt); return pipedAnswers.shift() || ''; }
  return rl.question(prompt);
}

async function askPassword(prompt) {
  if (!input.isTTY) { output.write(prompt); return pipedAnswers.shift() || ''; }
  rl.close();
  output.write(prompt);
  input.setRawMode(true);
  input.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') {
          input.off('data', onData); input.setRawMode(false); output.write('\n'); reject(new Error('Cancelled.')); return;
        }
        if (char === '\r' || char === '\n') {
          input.off('data', onData); input.setRawMode(false); output.write('\n'); resolve(value); return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    input.on('data', onData);
  });
}

try {
  await prepareInput();
  if (command === 'create') {
    if (db.prepare('SELECT id FROM admin WHERE id = 1').get()) throw new Error('An admin already exists. Use reset-password to change its password.');
    const username = (await askUsername('Admin username: ')).trim();
    const password = await askPassword('Admin password (12+ characters): ');
    if (!/^[a-zA-Z0-9._-]{3,100}$/.test(username) || password.length < 12) throw new Error('Use a 3–100 character username and a password with at least 12 characters.');
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    db.prepare('INSERT INTO admin (id, username, password_hash) VALUES (1, ?, ?)').run(username, hash);
    console.log('Admin account created.');
  } else if (command === 'reset-password') {
    const current = db.prepare('SELECT id FROM admin WHERE id = 1').get();
    if (!current) throw new Error('No admin exists yet. Run npm run admin:create first.');
    const password = await askPassword('New admin password (12+ characters): ');
    if (password.length < 12) throw new Error('Password must have at least 12 characters.');
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    db.prepare('UPDATE admin SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(hash);
    db.prepare('DELETE FROM sessions').run();
    console.log('Admin password updated.');
  } else {
    throw new Error('Use: node server/admin-cli.js create | reset-password');
  }
} finally {
  rl?.close();
  db.close();
}
