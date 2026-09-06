import { dbAll, dbGet, dbRun, getSetting, setSetting, sendSms } from '../functions/_lib.js';

function json(data, status = 200) {
  return Response.json(data, { status });
}

async function handleApi(request, env, pathname) {
  const method = request.method;

  // ---------- دانش‌آموزها ----------
  if (pathname === '/api/students' && method === 'GET') {
    const rows = await dbAll(env, 'SELECT * FROM students ORDER BY name');
    return json(rows);
  }

  if (pathname === '/api/students' && method === 'POST') {
    const body = await request.json();
    const { name, phone } = body;
    if (!name || !phone) return json({ error: 'نام و شماره الزامیه' }, 400);
    const info = await dbRun(env, 'INSERT INTO students (name, phone) VALUES (?, ?)', [name.trim(), phone.trim()]);
    return json({ id: info.lastInsertRowid, name, phone });
  }

  const studentDeleteMatch = pathname.match(/^\/api\/students\/(\d+)$/);
  if (studentDeleteMatch && method === 'DELETE') {
    await dbRun(env, 'DELETE FROM students WHERE id = ?', [Number(studentDeleteMatch[1])]);
    return json({ ok: true });
  }

  // ---------- تاریخچه ----------
  if (pathname === '/api/history' && method === 'GET') {
    const rows = await dbAll(env, 'SELECT * FROM history ORDER BY id DESC LIMIT 200');
    return json(rows);
  }

  // ---------- ارسال پیامک ----------
  if (pathname === '/api/send' && method === 'POST') {
    const body = await request.json();
    const { title, studentId } = body;
    if (!title || !studentId) return json({ error: 'عنوان و انتخاب دانش‌آموز الزامیه' }, 400);

    const student = await dbGet(env, 'SELECT * FROM students WHERE id = ?', [Number(studentId)]);
    if (!student) return json({ error: 'دانش‌آموز پیدا نشد' }, 404);

    const template = await getSetting(env, 'message_template');
    const message = template.replace('{title}', title).replace('{student}', student.name);
    const result = await sendSms(env, student.phone, message);

    await dbRun(
      env,
      `INSERT INTO history (title, student_name, phone, status, detail) VALUES (?, ?, ?, ?, ?)`,
      [title, student.name, student.phone, result.ok ? 'موفق' : 'ناموفق', result.detail]
    );

    if (!result.ok) return json({ error: result.detail }, 502);
    return json({ ok: true, detail: result.detail });
  }

  // ---------- تنظیمات ----------
  if (pathname === '/api/settings' && method === 'GET') {
    const rows = await dbAll(env, 'SELECT * FROM settings');
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    return json(settings);
  }

  if (pathname === '/api/settings' && method === 'POST') {
    const body = await request.json();
    const allowed = ['gateway_url', 'gateway_login', 'gateway_password', 'message_template'];
    for (const key of allowed) {
      if (typeof body[key] === 'string') await setSetting(env, key, body[key]);
    }
    return json({ ok: true });
  }

  return json({ error: 'یافت نشد' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith('/api/')) {
        return await handleApi(request, env, url.pathname);
      }
      // هر مسیر دیگه‌ای (خود پنل، CSS، JS) از فایل‌های استاتیک پوشه‌ی public سرو میشه
      return env.ASSETS.fetch(request);
    } catch (err) {
      return json({ error: 'خطای داخلی سرور: ' + err.message }, 500);
    }
  }
};
