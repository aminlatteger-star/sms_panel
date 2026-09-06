// کمک‌تابع‌های مشترک برای همه‌ی توابع API — با دیتابیس D1 کلادفلر کار می‌کنن

export async function dbAll(env, sql, params = []) {
  const stmt = env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all();
  return results;
}

export async function dbGet(env, sql, params = []) {
  const rows = await dbAll(env, sql, params);
  return rows[0] || null;
}

export async function dbRun(env, sql, params = []) {
  const stmt = env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const result = await bound.run();
  return {
    lastInsertRowid: result.meta.last_row_id,
    changes: result.meta.changes
  };
}

export async function getSetting(env, key) {
  const row = await dbGet(env, 'SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : '';
}

export async function setSetting(env, key, value) {
  await dbRun(
    env,
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

/**
 * ارسال پیامک از طریق اپلیکیشن SMS Gateway نصب‌شده روی گوشی اندروید
 * (پروژه‌ی متن‌باز android-sms-gateway - رایگان)
 */
export async function sendSms(env, phone, message) {
  const url = await getSetting(env, 'gateway_url');
  const login = await getSetting(env, 'gateway_login');
  const password = await getSetting(env, 'gateway_password');

  if (!url) {
    return { ok: false, detail: 'آدرس درگاه پیامک (گوشی) هنوز تنظیم نشده. اول از بخش تنظیمات پیامک، آدرس رو وارد کن.' };
  }

  try {
    const auth = btoa(`${login}:${password}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({ message, phoneNumbers: [phone] })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, detail: `خطا از درگاه پیامک (کد ${res.status}): ${text}` };
    }
    return { ok: true, detail: 'با موفقیت به درگاه پیامک ارسال شد' };
  } catch (err) {
    return { ok: false, detail: `عدم دسترسی به گوشی/درگاه پیامک: ${err.message}` };
  }
}
