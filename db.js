const path = require('path');

// اگه متغیرهای محیطی Turso ست شده باشن (روی هاست آنلاین)، از دیتابیس دائمی
// و رایگان Turso استفاده می‌کنیم. در غیر این‌صورت (اجرای محلی روی خودت)
// از دیتابیس محلی SQLite (ماژول داخلی node:sqlite) استفاده می‌کنیم.
const USE_TURSO = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

let localDb = null;
if (!USE_TURSO) {
  const { DatabaseSync } = require('node:sqlite');
  localDb = new DatabaseSync(path.join(__dirname, 'panel.db'));
}

// ---------------- کمک‌تابع‌های Turso (HTTP API) ----------------

function tursoUrl() {
  let u = process.env.TURSO_DATABASE_URL.trim();
  u = u.replace(/^libsql:\/\//, 'https://').replace(/^turso:\/\//, 'https://');
  u = u.replace(/\/+$/, '');
  if (!u.endsWith('/v2/pipeline')) u += '/v2/pipeline';
  return u;
}

function tursoValue(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  }
  return { type: 'text', value: String(v) };
}

async function tursoPipeline(requests) {
  const res = await fetch(tursoUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TURSO_AUTH_TOKEN}`
    },
    body: JSON.stringify({ requests: [...requests, { type: 'close' }] })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`خطای اتصال به دیتابیس آنلاین (کد ${res.status}): ${text}`);
  }
  const data = await res.json();
  for (const r of data.results) {
    if (r.type === 'error') {
      throw new Error('خطای دیتابیس: ' + (r.error && r.error.message ? r.error.message : JSON.stringify(r.error)));
    }
  }
  return data.results;
}

function parseExecResult(r) {
  const result = r.response.result;
  const cols = (result.cols || []).map(c => c.name);
  const rows = (result.rows || []).map(row => {
    const obj = {};
    row.forEach((cell, i) => { obj[cols[i]] = cell.value === undefined ? null : cell.value; });
    return obj;
  });
  return {
    rows,
    lastInsertRowid: result.last_insert_rowid != null ? Number(result.last_insert_rowid) : null,
    changes: result.affected_row_count || 0
  };
}

// ---------------- API یکپارچه (چه لوکال، چه Turso) ----------------

async function run(sql, args = []) {
  if (USE_TURSO) {
    const results = await tursoPipeline([{ type: 'execute', stmt: { sql, args: args.map(tursoValue) } }]);
    const parsed = parseExecResult(results[0]);
    return { lastInsertRowid: parsed.lastInsertRowid, changes: parsed.changes };
  }
  const info = localDb.prepare(sql).run(...args);
  return { lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
}

async function all(sql, args = []) {
  if (USE_TURSO) {
    const results = await tursoPipeline([{ type: 'execute', stmt: { sql, args: args.map(tursoValue) } }]);
    return parseExecResult(results[0]).rows;
  }
  return localDb.prepare(sql).all(...args);
}

async function get(sql, args = []) {
  const rows = await all(sql, args);
  return rows[0] || null;
}

async function init() {
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      student_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`
  ];

  if (USE_TURSO) {
    await tursoPipeline(createStatements.map(sql => ({ type: 'execute', stmt: { sql } })));
  } else {
    for (const sql of createStatements) localDb.exec(sql);
  }

  const defaults = {
    gateway_url: '',
    gateway_login: '',
    gateway_password: '',
    message_template: 'با سلام\n{title}\nدانش‌آموز: {student}'
  };
  for (const [k, v] of Object.entries(defaults)) {
    await run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [k, v]);
  }
}

module.exports = { init, run, all, get, isTurso: USE_TURSO };
