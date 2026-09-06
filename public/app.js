const menuBtn = document.getElementById('menuBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const menuItems = document.querySelectorAll('.menu-item');
const views = document.querySelectorAll('.view');

function openMenu() {
  sideMenu.classList.add('open');
  overlay.classList.add('show');
  menuBtn.classList.add('open');
}
function closeMenu() {
  sideMenu.classList.remove('open');
  overlay.classList.remove('show');
  menuBtn.classList.remove('open');
}
menuBtn.addEventListener('click', () => {
  sideMenu.classList.contains('open') ? closeMenu() : openMenu();
});
overlay.addEventListener('click', closeMenu);

menuItems.forEach(item => {
  item.addEventListener('click', () => {
    menuItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const target = item.dataset.view;
    views.forEach(v => v.classList.remove('active-view'));
    document.getElementById('view-' + target).classList.add('active-view');
    closeMenu();
    if (target === 'students') loadStudents();
    if (target === 'history') loadHistory();
    if (target === 'settings') loadSettings();
    if (target === 'send') loadStudentOptions();
  });
});

// ---------- ارسال پیامک ----------

const sendForm = document.getElementById('sendForm');
const sendMsg = document.getElementById('sendMsg');
const studentSelect = document.getElementById('studentSelect');

async function loadStudentOptions() {
  const res = await fetch('/api/students');
  const students = await res.json();
  studentSelect.innerHTML = '<option value="">— انتخاب کنید —</option>' +
    students.map(s => `<option value="${s.id}">${s.name} (${s.phone})</option>`).join('');
}

sendForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  sendMsg.textContent = 'در حال ارسال...';
  sendMsg.className = 'msg';

  const title = document.getElementById('titleInput').value.trim();
  const studentId = studentSelect.value;

  const res = await fetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, studentId })
  });
  const data = await res.json();

  if (res.ok) {
    sendMsg.textContent = 'پیامک با موفقیت ارسال شد ✅';
    sendMsg.className = 'msg ok';
    sendForm.reset();
  } else {
    sendMsg.textContent = data.error || 'ارسال ناموفق بود';
    sendMsg.className = 'msg err';
  }
});

// ---------- مدیریت دانش‌آموزان ----------

const studentForm = document.getElementById('studentForm');
const studentsList = document.getElementById('studentsList');

async function loadStudents() {
  const res = await fetch('/api/students');
  const students = await res.json();
  if (students.length === 0) {
    studentsList.innerHTML = '<p class="empty">هنوز دانش‌آموزی اضافه نشده</p>';
    return;
  }
  studentsList.innerHTML = students.map(s => `
    <div class="list-item">
      <div class="info">
        <span class="name">${s.name}</span>
        <span class="sub">${s.phone}</span>
      </div>
      <button class="btn-delete" data-id="${s.id}">حذف</button>
    </div>
  `).join('');

  studentsList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('حذف این دانش‌آموز از لیست؟')) return;
      await fetch('/api/students/' + btn.dataset.id, { method: 'DELETE' });
      loadStudents();
    });
  });
}

studentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('studentName').value.trim();
  const phone = document.getElementById('studentPhone').value.trim();
  if (!name || !phone) return;

  await fetch('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone })
  });
  studentForm.reset();
  loadStudents();
});

// ---------- تاریخچه ----------

const historyList = document.getElementById('historyList');

async function loadHistory() {
  const res = await fetch('/api/history');
  const rows = await res.json();
  if (rows.length === 0) {
    historyList.innerHTML = '<p class="empty">هنوز پیامکی ارسال نشده</p>';
    return;
  }
  historyList.innerHTML = rows.map(r => `
    <div class="list-item">
      <div class="info">
        <span class="name">${r.title} — ${r.student_name}</span>
        <span class="sub">${r.phone} • ${r.created_at}</span>
      </div>
      <span class="status-badge ${r.status === 'موفق' ? 'ok' : 'err'}">${r.status}</span>
    </div>
  `).join('');
}

// ---------- تنظیمات ----------

const settingsForm = document.getElementById('settingsForm');
const settingsMsg = document.getElementById('settingsMsg');

async function loadSettings() {
  const res = await fetch('/api/settings');
  const s = await res.json();
  document.getElementById('gatewayUrl').value = s.gateway_url || '';
  document.getElementById('gatewayLogin').value = s.gateway_login || '';
  document.getElementById('gatewayPassword').value = s.gateway_password || '';
  document.getElementById('messageTemplate').value = s.message_template || '';
}

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    gateway_url: document.getElementById('gatewayUrl').value.trim(),
    gateway_login: document.getElementById('gatewayLogin').value.trim(),
    gateway_password: document.getElementById('gatewayPassword').value,
    message_template: document.getElementById('messageTemplate').value
  };
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  settingsMsg.textContent = 'تنظیمات ذخیره شد ✅';
  settingsMsg.className = 'msg ok';
});

// بارگذاری اولیه
loadStudentOptions();
