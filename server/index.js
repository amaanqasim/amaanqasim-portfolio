import 'dotenv/config';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import argon2 from 'argon2';
import { db, readPortfolio, writePortfolio } from './db.js';
import SQLiteSessionStore from './sqlite-session-store.js';
import { loginSchema, passwordSchema, portfolioSchema } from './validation.js';

const app = express();
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3001);
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be set to at least 32 characters.');
}
if (production && process.env.SESSION_SECURE_COOKIE !== 'true') {
  throw new Error('Set SESSION_SECURE_COOKIE=true after HTTPS is configured.');
}
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, strictTransportSecurity: false }));
app.use((req, res, next) => {
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
app.use(express.json({ limit: '256kb', strict: true }));
app.use(session({
  name: 'portfolio.sid',
  secret: process.env.SESSION_SECRET,
  store: new SQLiteSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.SESSION_SECURE_COOKIE === 'true', sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000, path: '/' },
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Try again later.' } });

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function csrfToken(req, res) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.json({ csrfToken: req.session.csrfToken });
}

function requireCsrf(req, res, next) {
  if (!safeEqual(req.get('x-csrf-token'), req.session.csrfToken)) return res.status(403).json({ error: 'Request could not be verified. Refresh and try again.' });
  next();
}

function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Request could not be verified.' });
    } catch { return res.status(403).json({ error: 'Request could not be verified.' }); }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/auth/csrf', csrfToken);
app.get('/api/auth/session', (req, res) => res.json({ authenticated: Boolean(req.session.admin), username: req.session.admin?.username || null }));
app.post('/api/auth/login', sameOrigin, loginLimiter, requireCsrf, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid username and password.' });
    const admin = db.prepare('SELECT username, password_hash FROM admin WHERE id = 1').get();
    if (!admin || parsed.data.username !== admin.username || !await argon2.verify(admin.password_hash, parsed.data.password)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.admin = { username: admin.username };
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    req.session.save((error) => error ? next(error) : res.json({ authenticated: true, username: admin.username, csrfToken: req.session.csrfToken }));
  } catch (error) { next(error); }
});
app.post('/api/auth/logout', sameOrigin, requireCsrf, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('portfolio.sid', { httpOnly: true, secure: process.env.SESSION_SECURE_COOKIE === 'true', sameSite: 'strict', path: '/' });
    res.status(204).end();
  });
});
app.post('/api/auth/password', sameOrigin, requireAdmin, requireCsrf, async (req, res, next) => {
  try {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Use a new password with at least 12 characters.' });
    const admin = db.prepare('SELECT password_hash FROM admin WHERE id = 1').get();
    if (!await argon2.verify(admin.password_hash, parsed.data.currentPassword)) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
    db.prepare('UPDATE admin SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(hash);
    db.prepare('DELETE FROM sessions').run();
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.admin = { username: db.prepare('SELECT username FROM admin WHERE id = 1').get().username };
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    req.session.save((error) => error ? next(error) : res.json({ changed: true, csrfToken: req.session.csrfToken }));
  } catch (error) { next(error); }
});

app.get('/api/portfolio', (_req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(readPortfolio()); } catch (error) { next(error); }
});
app.put('/api/admin/portfolio', sameOrigin, requireAdmin, requireCsrf, (req, res, next) => {
  const parsed = portfolioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Portfolio data is invalid.', issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) });
  try { writePortfolio(parsed.data); res.json({ saved: true }); } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error('Request failed:', error.message);
  if (res.headersSent) return;
  res.status(error.status || 500).json({ error: error.status && error.status < 500 ? error.message : 'An unexpected server error occurred.' });
});

const server = createServer(app);
server.listen(port, '127.0.0.1', () => console.log(`Portfolio API listening on 127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
