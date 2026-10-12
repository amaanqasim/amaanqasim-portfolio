import session from 'express-session';
import { db } from './db.js';

const Store = session.Store;

export default class SQLiteSessionStore extends Store {
  constructor() {
    super();
    this.getStatement = db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?');
    this.setStatement = db.prepare(`INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`);
    this.destroyStatement = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.pruneStatement = db.prepare('DELETE FROM sessions WHERE expires <= ?');
    this.pruneStatement.run(Date.now());
  }

  get(sid, callback) {
    try {
      const row = this.getStatement.get(sid);
      if (!row || row.expires <= Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.sess));
    } catch (error) { callback(error); }
  }

  set(sid, sess, callback = () => {}) {
    try {
      const expires = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 8 * 60 * 60 * 1000;
      this.setStatement.run(sid, JSON.stringify(sess), expires);
      callback(null);
    } catch (error) { callback(error); }
  }

  destroy(sid, callback = () => {}) {
    try { this.destroyStatement.run(sid); callback(null); }
    catch (error) { callback(error); }
  }
}
