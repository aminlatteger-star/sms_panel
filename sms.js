const db = require('./db');

async function getSetting(key) {
  const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : '';
}

async function setSetting(key, value) {
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

/**
 * ارسال پیامک از طریق اپلیکیشن SMS Gateway نصب‌شده روی گوشی اندروید
 * (پروژه‌ی متن‌باز android-sms-gateway - رایگان)
 * مستندات: https://github.com/capcom6/android-sms-gateway
 */
async function sendSms(phone, message) {
  const url = await getSetting('gateway_url');
  const login = await getSetting('gateway_login');
  const password = await getSetting('gateway_password');

  if (!url) {
    return { ok: false, detail: 'آدرس درگاه پیامک (گوشی) هنوز تنظیم نشده. اول از بخش تنظیمات پیامک، آدرس رو وارد کن.' };
  }

  try {
    const auth = Buffer.from(`${login}:${password}`).toString('base64');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        message: message,
        phoneNumbers: [phone]
      })
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

module.exports = { sendSms, getSetting, setSetting };
