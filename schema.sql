CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  student_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('gateway_url', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('gateway_login', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('gateway_password', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('message_template', 'با سلام
{title}
دانش‌آموز: {student}');
