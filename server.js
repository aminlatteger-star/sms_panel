const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { sendSms, getSetting, setSetting } = require('./sms');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(PUBLIC_DIR, filePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('صفحه پیدا نشد');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // ---------- دانش‌آموزها ----------
    if (pathname === '/api/students' && req.method === 'GET') {
      const students = await db.all('SELECT * FROM students ORDER BY name');
      return sendJson(res, 200, students);
    }

    if (pathname === '/api/students' && req.method === 'POST') {
      const body = await readBody(req);
      const { name, phone } = body;
      if (!name || !phone) return sendJson(res, 400, { error: 'نام و شماره الزامیه' });
      const info = await db.run('INSERT INTO students (name, phone) VALUES (?, ?)', [name.trim(), phone.trim()]);
      return sendJson(res, 200, { id: info.lastInsertRowid, name, phone });
    }

    const studentDeleteMatch = pathname.match(/^\/api\/students\/(\d+)$/);
    if (studentDeleteMatch && req.method === 'DELETE') {
      await db.run('DELETE FROM students WHERE id = ?', [Number(studentDeleteMatch[1])]);
      return sendJson(res, 200, { ok: true });
    }

    // ---------- تاریخچه ----------
    if (pathname === '/api/history' && req.method === 'GET') {
      const rows = await db.all('SELECT * FROM history ORDER BY id DESC LIMIT 200');
      return sendJson(res, 200, rows);
    }

    // ---------- ارسال پیامک ----------
    if (pathname === '/api/send' && req.method === 'POST') {
      const body = await readBody(req);
      const { title, studentId } = body;
      if (!title || !studentId) return sendJson(res, 400, { error: 'عنوان و انتخاب دانش‌آموز الزامیه' });

      const student = await db.get('SELECT * FROM students WHERE id = ?', [Number(studentId)]);
      if (!student) return sendJson(res, 404, { error: 'دانش‌آموز پیدا نشد' });

      const template = await getSetting('message_template');
      const message = template.replace('{title}', title).replace('{student}', student.name);

      const result = await sendSms(student.phone, message);

      await db.run(
        `INSERT INTO history (title, student_name, phone, status, detail) VALUES (?, ?, ?, ?, ?)`,
        [title, student.name, student.phone, result.ok ? 'موفق' : 'ناموفق', result.detail]
      );

      if (!result.ok) return sendJson(res, 502, { error: result.detail });
      return sendJson(res, 200, { ok: true, detail: result.detail });
    }

    // ---------- تنظیمات ----------
    if (pathname === '/api/settings' && req.method === 'GET') {
      const rows = await db.all('SELECT * FROM settings');
      const settings = {};
      for (const r of rows) settings[r.key] = r.value;
      return sendJson(res, 200, settings);
    }

    if (pathname === '/api/settings' && req.method === 'POST') {
      const body = await readBody(req);
      const allowed = ['gateway_url', 'gateway_login', 'gateway_password', 'message_template'];
      for (const key of allowed) {
        if (typeof body[key] === 'string') await setSetting(key, body[key]);
      }
      return sendJson(res, 200, { ok: true });
    }

    // ---------- فایل‌های استاتیک (رابط کاربری) ----------
    if (req.method === 'GET') {
      return serveStatic(req, res, pathname);
    }

    sendJson(res, 404, { error: 'یافت نشد' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'خطای داخلی سرور: ' + err.message });
  }
});

db.init()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`پنل روی پورت ${PORT} اجرا شد → http://localhost:${PORT}`);
      console.log(db.isTurso ? 'دیتابیس: Turso (آنلاین، دائمی)' : 'دیتابیس: فایل محلی SQLite');
    });
  })
  .catch(err => {
    console.error('خطا در راه‌اندازی دیتابیس:', err);
    process.exit(1);
  });
