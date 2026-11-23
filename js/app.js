/* GO+MART Shift System — ແອັບຫຼັກ */
const h = U.el;

/* ທຸກບັນທຶກກະ ຕິດຊື່ຜູ້ເຮັດ (by) ໄວ້ — ຜູ້ເຮັດຕອນນີ້ = S.actor ຫຼື ຜູ້ເຊັກອິນກະ */
const _SHIFT_STORES = ['checks', 'temps', 'photos', 'cash', 'issues'];
const _dbPut = DB.put, _dbPutMany = DB.putMany;
function stampBy(store, obj) {
  if (obj && obj.shiftId && _SHIFT_STORES.includes(store) && !obj.by) {
    obj.by = S.actor || (S.shift && S.shift.staff) || '';
  }
  return obj;
}
DB.put = (store, obj) => _dbPut(store, stampBy(store, obj));
DB.putMany = (store, arr) => _dbPutMany(store, arr.map(o => stampBy(store, o)));

/* ສົ່ງເຫດການໄປແຜ່ນ — ລະຫັດແຖວຄົງທີ່ ສົ່ງຊໍ້າຈະບໍ່ເພີ່ມແຖວຊ້ໍາ */
function syncEvt(sh, id, f) {
  SHEETSYNC.queue({ row: SHEETSYNC.row(id, {
    date: sh.date, time: U.nowTime(), branch: sh.branch, shift: shiftDef(sh.shiftKey).label,
    staff: sh.staff, type: f.type, cat: f.cat, item: f.item, qty: f.qty, unit: f.unit,
    note: f.note, status: f.status || 'ບັນທຶກແລ້ວ' }) });
}
let S = {            /* ສະຖານະແອັບ */
  settings: null,
  shift: null,       /* ກະທີ່ກໍາລັງເປີດຢູ່ */
  route: 'home'
};

/* ================= ຕັ້ງຄ່າ ================= */
/* ລາຍຊື່ພະນັກງານເຄີຍເກັບເປັນສະຕຣິງລ້ວນ ດຽວນີ້ເປັນ object ທີ່ມີກະ ແລະ ປະເພດ
 * ແປງໃຫ້ອັດຕະໂນມັດ ເພື່ອບໍ່ໃຫ້ເຄື່ອງທີ່ໃຊ້ຢູ່ແລ້ວຂໍ້ມູນຫາຍ */
function normStaff(raw) {
  if (!raw || !raw.length) return CONFIG.defaults.staff.map(x => ({ ...x }));
  return raw.map(x => typeof x === 'string'
    ? { name: x, shiftKey: null, type: 'full' }
    : { shiftKey: null, type: 'full', ...x });
}

async function loadSettings() {
  const d = CONFIG.defaults;
  /* ເວລາກະຕັ້ງຄ່າໃໝ່ຄັ້ງດຽວ (ກະແລງເລີ່ມ 14:00) ແລ້ວຈຶ່ງໃຊ້ຄ່າທີ່ແກ້ໄດ້ */
  if (!(await DB.setting('shiftsSeedV3'))) {
    await DB.setting('shifts', null);
    await DB.setting('shiftsSeedV3', true);
  }
  /* ລາຍຊື່ຊຸດນີ້ຕັ້ງຄ່າໃໝ່ຄັ້ງດຽວ (ແທນຊື່ສົມມຸດເກົ່າ) ຫຼັງຈາກນັ້ນແກ້ໄດ້ປົກກະຕິ */
  let rawStaff = await DB.setting('staff');
  if (!(await DB.setting('staffSeedV2'))) {
    rawStaff = null;
    await DB.setting('staffSeedV2', true);
  }
  S.settings = {
    branches: await DB.setting('branches') || d.branches.slice(),
    staff: normStaff(rawStaff),
    zones: await DB.setting('zones') || CONFIG.zones.slice(),
    shifts: await DB.setting('shiftsSeedV3') ? (await DB.setting('shifts') || d.shifts.map(x => ({ ...x })))
      : d.shifts.map(x => ({ ...x })),
    cashVarianceLimit: await DB.setting('cashVarianceLimit') ?? d.cashVarianceLimit,
    lateMinutes: await DB.setting('lateMinutes') ?? d.lateMinutes,
    earlyMinutes: await DB.setting('earlyMinutes') ?? d.earlyMinutes,
    zonesPerShift: await DB.setting('zonesPerShift') ?? d.zonesPerShift,
    bonusCutDay: await DB.setting('bonusCutDay') ?? d.bonusCutDay,
    bonusFull: await DB.setting('bonusFull') ?? d.bonusFull,
    bonusFullWeekend: await DB.setting('bonusFullWeekend') ?? d.bonusFullWeekend,
    bonusAmounts: await DB.setting('bonusAmounts') || {}
  };
  /* ຂຽນຮູບແບບໃໝ່ກັບລົງເຄື່ອງ ເພື່ອໃຫ້ໜ້າຕັ້ງຄ່າແກ້ໄດ້ເລີຍ */
  if (JSON.stringify(rawStaff) !== JSON.stringify(S.settings.staff))
    await DB.setting('staff', S.settings.staff);
}
/* ແຖວການຕັ້ງຄ່າທັງໝົດ ສໍາລັບສະແດງໃນແຜ່ນ — [ໝວດ, ລາຍການ, ຄ່າ] */
function settingsRows() {
  const st = S.settings, rows = [];
  rows.push(['ສາຂາ', 'ລາຍຊື່ສາຂາ', st.branches.join(', ')]);
  st.shifts.forEach(x => rows.push(['ເວລາກະ', x.label, x.start + ' – ' + x.end]));
  st.staff.forEach(p => rows.push(['ພະນັກງານ', p.name,
    (p.shiftKey ? (st.shifts.find(x => x.key === p.shiftKey) || {}).label : 'ບໍ່ກໍານົດກະ') + ' · ' + (p.type === 'weekend' ? 'ພາດທາມ' : 'ປະຈໍາ')]));
  rows.push(['ເກນ', 'ສ່ວນຕ່າງເງິນສົດ (ກີບ)', st.cashVarianceLimit]);
  rows.push(['ເກນ', 'ເຊັກອິນຊ້າ (ນາທີ)', st.lateMinutes]);
  rows.push(['ເກນ', 'ເຊັກເອົາກ່ອນເວລາ (ນາທີ)', st.earlyMinutes]);
  rows.push(['ເກນ', 'ຈໍານວນໂຊນຕໍ່ກະ', st.zonesPerShift]);
  rows.push(['ເບີ້ຍ', 'ເບີ້ຍເຕັມປະຈໍາ (ກີບ/ຮອບ)', st.bonusFull]);
  rows.push(['ເບີ້ຍ', 'ເບີ້ຍເຕັມພາດທາມ (ກີບ/ຮອບ)', st.bonusFullWeekend]);
  rows.push(['ເບີ້ຍ', 'ຕັດຍອດທຸກວັນທີ', st.bonusCutDay]);
  CONFIG.bonusRules.forEach(r => rows.push(['ກົດເບີ້ຍ', r.label, BONUS.amountOf(r.key)]));
  return rows;
}
let _pushTimer = null;
function pushSettingsSoon() {
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => SHEETSYNC.pushSettings(settingsRows()), 2000);
}
const saveSetting = (k, v) => { S.settings[k] = v; pushSettingsSoon(); return DB.setting(k, v); };

/* ================= ຕົວຊ່ວຍ ================= */
function shiftDef(key) { return S.settings.shifts.find(s => s.key === key) || S.settings.shifts[0]; }

async function loadOpenShift() {
  const all = await DB.all('shifts');
  S.shift = all.find(s => s.status === 'open') || null;
  return S.shift;
}

/* ຄວາມຄືບໜ້າຂອງກະ */
async function progress(shift) {
  if (!shift) return null;
  const [checks, photos, temps, cashRows] = await Promise.all([
    DB.by('checks', 'shiftId', shift.id),
    DB.by('photos', 'shiftId', shift.id),
    DB.by('temps', 'shiftId', shift.id),
    DB.by('cash', 'shiftId', shift.id)
  ]);
  const openPts = CONFIG.checkpoints.filter(c => c.open).map(c => c.key);
  const closePts = CONFIG.checkpoints.filter(c => c.close).map(c => c.key);
  const photoKeys = p => new Set(photos.filter(x => x.phase === p).map(x => x.checkpoint));
  const po = photoKeys('open'), pc = photoKeys('close');
  const zoneChecks = checks.filter(c => c.form === 'zone');
  const cash = cashRows[0] || null;
  /* ເວລາບັນທຶກລ່າສຸດ — ໃຫ້ພະນັກງານເຫັນວ່າບັນທຶກແລ້ວແທ້ */
  const lastTs = arr => arr.length ? arr.map(x => x.ts).sort().slice(-1)[0] : null;
  const clock = iso => iso ? U.stamp(iso).slice(-5) : '';

  return {
    savedAt: {
      checklist: clock(lastTs(checks.filter(c => c.form === 'checklist'))),
      temps1: clock(lastTs(temps.filter(t => t.round === 1))),
      temps2: clock(lastTs(temps.filter(t => t.round === 2))),
      photosOpen: clock(lastTs(photos.filter(p => p.phase === 'open'))),
      photosClose: clock(lastTs(photos.filter(p => p.phase === 'close'))),
      zones: clock(lastTs(zoneChecks)),
      cash: clock(cash && cash.ts)
    },
    checklist:  checks.some(c => c.form === 'checklist'),
    daily:      checks.filter(c => c.form === 'daily' && c.ok != null).length,
    dailyNeed:  CONFIG.dailyChecklist.reduce((a, sec) => a + sec.items.length, 0),
    temps1:     temps.some(t => t.round === 1),
    temps2:     temps.some(t => t.round === 2),
    photosOpen: openPts.every(k => po.has(k)),
    photosClose:closePts.every(k => pc.has(k)),
    float:      shift.float != null,
    zones:      new Set(zoneChecks.map(c => c.zone)).size,
    zonesNeeded:S.settings.zonesPerShift,
    cash,
    counts: { openPhotos: po.size, openNeed: openPts.length, closePhotos: pc.size, closeNeed: closePts.length }
  };
}

/* ================= ໂຄງໜ້າຈໍ ================= */
/* ວົງຄວາມຄືບໜ້າ — ບອກວ່າເຮັດໄປແລ້ວເທົ່າໃດຈາກທັງໝົດ */
function progressRing(done, total) {
  const R = 19, C = 2 * Math.PI * R;
  const pct = total ? Math.min(1, done / total) : 0;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '46'); svg.setAttribute('height', '46');
  svg.setAttribute('viewBox', '0 0 46 46');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    `<circle class="trk" cx="23" cy="23" r="${R}" fill="none" stroke-width="4"/>` +
    `<circle class="bar" cx="23" cy="23" r="${R}" fill="none" stroke-width="4"` +
    ` stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}"/>`;
  return h('div', { class: 'ring', role: 'img',
                    'aria-label': `ເຮັດແລ້ວ ${done} ຈາກ ${total} ລາຍການ` },
    [svg, h('div', { class: 'ring-n', text: done + '/' + total })]);
}

function header(title, sub, ring) {
  return h('header', { class: 'hdr' }, [
    h('div', { class: 'hdr-main' }, [
      h('img', { class: 'logo', src: 'img/logo-96.png', alt: 'GO+mart', width: '54', height: '54' }),
      h('div', { class: 'hdr-txt' }, [
        h('div', { class: 'hdr-title', text: title }),
        sub ? h('div', { class: 'hdr-sub', text: sub }) : null
      ]),
      ring || null
    ])
  ]);
}

/* ໄອຄອນເສັ້ນບາງ (SVG ໃນຕົວ ບໍ່ຕ້ອງໂຫຼດຈາກເນັດ ໃຊ້ໄດ້ offline) */
const ICON = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  checklist: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 9l2 2 4-4M8 16h8"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  temp: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'
};
function iconEl(name, cls = 'ico') {
  const el = document.createElement('span');
  el.className = cls; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICON[name] || '') + '</svg>';
  return el;
}

const NAV = [
  { key: 'home',    label: 'ໜ້າຫຼັກ', icon: 'home' },
  { key: 'daily',   label: 'ເຊັກລິສຕ໌', icon: 'checklist' },
  { key: 'issues',  label: 'ບັນຫາ', icon: 'alert' },
  { key: 'report',  label: 'ລາຍງານ', icon: 'chart' },
  { key: 'config',  label: 'ຕັ້ງຄ່າ', icon: 'settings' }
];

function nav() {
  return h('nav', { class: 'nav' }, NAV.map(n =>
    h('button', {
      class: 'nav-btn' + (S.route === n.key ? ' on' : ''),
      onclick: () => go(n.key)
    }, [iconEl(n.icon, 'nav-ico'), h('span', { text: n.label })])
  ));
}

function render(title, sub, body, ring) {
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(header(title, sub, ring));
  const main = h('main', { class: 'main' }, []);
  (Array.isArray(body) ? body : [body]).forEach(b => b && main.appendChild(b));
  root.appendChild(main);
  root.appendChild(nav());
  main.scrollTop = 0;
}

async function go(route, arg, fromPop) {
  const fn = SCREENS[route];
  if (!fn) return;
  S.route = route;
  if (!fromPop) {
    const cur = history.state;
    const same = cur && cur.route === route && JSON.stringify(cur.arg) === JSON.stringify(arg);
    /* ໜ້າຫຼັກເປັນຮາກ — ແທນທີ່ສະເໝີ ບໍ່ໃຫ້ຊ້ອນກັນ */
    if (route === 'home' || same) history.replaceState({ route, arg }, '');
    else history.pushState({ route, arg }, '');
  }
  await fn(arg);
}

/* ປຸ່ມຍ້ອນກັບຂອງມືຖື / ບຣາວເຊີ */
window.addEventListener('popstate', e => {
  const s = e.state || { route: 'home' };
  go(s.route, s.arg, true);
});

/* ---------- ຮ່າງທີ່ຕື່ມຄ້າງໄວ້ ---------- */
const draftId = (sh, form) => 'd_' + sh.id + '_' + form;
async function loadDraft(sh, form) {
  const d = await DB.get('drafts', draftId(sh, form));
  return d ? d.state : null;
}
let _draftTimer = null;
function saveDraft(sh, form, state) {
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(() => {
    DB.put('drafts', { id: draftId(sh, form), shiftId: sh.id, form, state, ts: Date.now() })
      .catch(() => {});
  }, 400);
}
function clearDraft(sh, form) {
  clearTimeout(_draftTimer);
  return DB.del('drafts', draftId(sh, form)).catch(() => {});
}
async function clearShiftDrafts(shiftId) {
  for (const d of await DB.by('drafts', 'shiftId', shiftId)) await DB.del('drafts', d.id);
}

/* ---------- ແຖບຄວາມຄືບໜ້າຕິດເທິງ ----------
 * ຄືນ object ທີ່ມີ .el ສໍາລັບວາງໃນໜ້າ ແລະ .set(n) ສໍາລັບອັບເດດ
 */
function progressBar(total, label) {
  const num = h('b', { text: '0/' + total });
  const fill = h('div', { class: 'prog-fill', style: 'width:0%' });
  const el = h('div', { class: 'prog' }, [
    h('div', { class: 'prog-top' }, [h('span', { text: label }), num]),
    h('div', { class: 'prog-bar' }, [fill])
  ]);
  return {
    el,
    set(n) {
      num.textContent = n + '/' + total;
      fill.style.width = (total ? (n / total) * 100 : 0) + '%';
      fill.classList.toggle('full', n >= total);
    }
  };
}

/* ເລື່ອນໄປແຖວຕໍ່ໄປທີ່ຍັງບໍ່ໄດ້ຕອບ — ໃຫ້ກົດຕໍ່ເນື່ອງໄດ້ໂດຍບໍ່ຕ້ອງເລື່ອນຈໍເອງ */
function advanceTo(rows, isAnswered) {
  const i = rows.findIndex(r => !isAnswered(r));
  if (i < 0) return;
  const row = rows[i];
  const box = row.getBoundingClientRect();
  if (box.top < 90 || box.bottom > window.innerHeight - 120) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* ---------- ຊີ້ຈຸດທີ່ຍັງບໍ່ຄົບ ---------- */
function markMissing(rows, labels) {
  document.querySelectorAll('.ck.miss').forEach(r => r.classList.remove('miss'));
  rows.forEach(r => r.classList.add('miss'));
  if (rows[0]) rows[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  const names = labels.slice(0, 3).join(', ') + (labels.length > 3 ? ' ແລະ ອີກ ' + (labels.length - 3) : '');
  U.toast('ຍັງຂາດ: ' + names, 'err');
}

/* ================= ຊິ້ນສ່ວນ UI ================= */
const card = (kids, cls = '') => h('section', { class: 'card ' + cls }, kids);

/* ປຸ່ມ — ຖ້າ handler ຄືນ Promise ຈະປິດປຸ່ມໄວ້ຈົນກວ່າຈະແລ້ວ ກັນການກົດຊໍ້າ */
function btn(text, onclick, cls = '', busyText = 'ກຳລັງບັນທຶກ…') {
  /* ບອກບົດບາດໃຫ້ຕົວກວດ UI ຮູ້ແນ່ນອນ ບໍ່ຕ້ອງເດົາຈາກໜ້າຕາ */
  const role = /\bprimary\b/.test(cls) ? 'primary' : 'secondary';
  const b = h('button', { class: 'btn ' + cls, 'data-ui': role }, text);
  b.addEventListener('click', async () => {
    if (b.disabled) return;
    let r;
    try { r = onclick(); } catch (e) { U.toast('ຜິດພາດ: ' + e.message, 'err'); return; }
    if (!r || typeof r.then !== 'function') return;
    const label = b.textContent;
    b.disabled = true; b.classList.add('busy'); b.textContent = busyText;
    try { await r; }
    catch (e) { U.toast('ເຮັດບໍ່ສໍາເລັດ: ' + e.message, 'err'); }
    finally {
      if (b.isConnected) { b.disabled = false; b.classList.remove('busy'); b.textContent = label; }
    }
  });
  return b;
}
const rowLabel = (label, kids) => h('label', { class: 'field' }, [h('span', { class: 'flabel', text: label }), ...(Array.isArray(kids) ? kids : [kids])]);

/* data-ui="skip": ຊ່ອງປ້ອນມີພື້ນທຶບໃນໂໝດມືດ ຕົວກວດ UX ຈຶ່ງນັບເປັນປຸ່ມຫຼັກ ຖ້າບໍ່ບອກມັນ */
function input(attrs = {}) { return h('input', { class: 'in', 'data-ui': 'skip', ...attrs }); }
function select(options, value, onchange, attrs = {}) {
  const s = h('select', { class: 'in', 'data-ui': 'skip', onchange, ...attrs },
    options.map(o => {
      const val = typeof o === 'string' ? o : o.value;
      const lab = typeof o === 'string' ? o : o.label;
      return h('option', { value: val, selected: String(val) === String(value) ? 'selected' : false }, lab);
    }));
  return s;
}

/* ກ່ອງຢືນຢັນໃນແອັບ — ປຸ່ມບອກຊື່ການກະທໍາ ແລະ ມີທາງອອກສະເໝີ */
function confirmSheet({ title, lines = [], confirmLabel, cancelLabel = 'ຍົກເລີກ', danger = false }) {
  return new Promise(resolve => {
    let closed = false;
    const done = v => { if (closed) return; closed = true; wrap.remove(); document.removeEventListener('keydown', esc); resolve(v); };
    const esc = e => { if (e.key === 'Escape') done(false); };
    const sheet = h('div', { class: 'sheet' }, [
      h('h3', { class: 'sheet-t', text: title }),
      ...lines.map(l => h('p', { class: 'sheet-l', text: l })),
      h('div', { class: 'sheet-b' }, [
        h('button', { class: 'btn ghost', onclick: () => done(false) }, cancelLabel),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => done(true) }, confirmLabel)
      ])
    ]);
    const wrap = h('div', { class: 'sheet-wrap', onclick: e => { if (e.target === wrap) done(false); } }, [sheet]);
    document.body.appendChild(wrap);
    document.addEventListener('keydown', esc);
    requestAnimationFrame(() => wrap.classList.add('show'));
  });
}

function statusPill(done, labelDone, labelTodo) {
  return h('span', { class: 'pill ' + (done ? 'ok' : 'todo'), text: done ? (labelDone || 'ຄົບແລ້ວ') : (labelTodo || 'ຍັງ') });
}

function taskRow(label, done, onclick, extra, opt = {}) {
  /* opt.icon = ແຜ່ນໄອຄອນເບື້ອງຊ້າຍ ແລະ ປ້າຍສະຖານະເບື້ອງຂວາ ແທນວົງກົມ */
  const lead = opt.icon
    ? h('span', { class: 'task-tile' + (done ? ' on' : '') + (opt.alert ? ' bad' : ''), text: opt.icon })
    : h('span', { class: 'task-ck', text: done ? '✓' : '○' });
  const body = h('span', { class: 'task-l' },
    [h('span', { text: label }), extra ? h('small', { text: extra }) : null]);

  if (opt.disabled) {
    return h('div', { class: 'task off', 'data-ui': 'content' }, [lead, body]);
  }
  /* ແຖວງານແມ່ນເນື້ອຫາຂອງໜ້າ ບໍ່ແມ່ນແຖບເຄື່ອງມື */
  return h('button', { class: 'task' + (done ? ' done' : '') + (opt.alert ? ' alert' : ''),
                       'data-ui': 'content', onclick }, [
    lead, body,
    opt.icon
      ? h('span', { class: 'pill ' + (opt.alert ? 'bad' : done ? 'ok' : 'todo'),
                    text: opt.alert ? 'ກວດເບິ່ງ' : done ? 'ແລ້ວ' : 'ຍັງ' })
      : h('span', { class: 'task-go', text: '›' })
  ]);
}

/* ================= ໜ້າຈໍ ================= */
const SCREENS = {};

/* ---------- ໜ້າຫຼັກ ---------- */
/* ເພີ່ມຄົນຮ່ວມກະ — ຕ້ອງໃສ່ລະຫັດຂອງຄົນນັ້ນ */
SCREENS.addhelper = async function () {
  const sh = S.shift; if (!sh) return go('home');
  const taken = [sh.staff, ...(sh.helpers || [])];
  const options = S.settings.staff.filter(p => !taken.includes(p.name) && p.pinHash);
  let who = '', pinV = '';
  const body = card([
    h('h2', { class: 'ttl', text: 'ເພີ່ມຄົນຮ່ວມກະ' }),
    options.length ? null : h('div', { class: 'note', text: 'ບໍ່ມີຄົນທີ່ພ້ອມເຂົ້າຮ່ວມ (ຕ້ອງມີລະຫັດກ່ອນ)' }),
    options.length ? rowLabel('ຊື່', select([{ value: '', label: '— ເລືອກ —' },
      ...options.map(p => ({ value: p.name, label: p.name }))], '', e => who = e.target.value)) : null,
    options.length ? rowLabel('ລະຫັດຂອງຊື່ນັ້ນ', input({ type: 'password', inputmode: 'numeric', autocomplete: 'off',
      placeholder: '4 ຕົວ', oninput: e => pinV = e.target.value })) : null,
    options.length ? btn('ເພີ່ມເຂົ້າກະ', async () => {
      const p = options.find(x => x.name === who);
      if (!p) return U.toast('ເລືອກຊື່ກ່ອນ', 'err');
      const [salt, hash] = p.pinHash.split(':');
      if ((await MGR.hash(pinV.trim(), salt)) !== hash) return U.toast('ລະຫັດບໍ່ຖືກ', 'err');
      sh.helpers = [...(sh.helpers || []), who];
      await DB.put('shifts', sh);
      U.toast(who + ' ເຂົ້າກະແລ້ວ');
      go('home');
    }, 'primary') : null,
    btn('ກັບ', () => go('home'), 'ghost')
  ]);
  render('ເພີ່ມຄົນຮ່ວມກະ', sh.branch, [body]);
};

SCREENS.home = async function () {
  await loadOpenShift();
  if (!S.shift) return screenStartShift();

  const sh = S.shift;
  const def = shiftDef(sh.shiftKey);
  const p = await progress(sh);
  const cashBad = p.cash && Math.abs(p.cash.variance) > S.settings.cashVarianceLimit;

  /* ງານບັງຄັບທັງໝົດ ເກັບໄວ້ບ່ອນດຽວ ໃຊ້ທັງນັບຄວາມຄືບໜ້າ ແລະ ວາດແຖວ */
  const TASKS = [
    { icon: '☑', phase: 'ເປີດກະ', label: 'ເຊັກລິສຕ໌ໜ້າຮ້ານ', hint: 'ກວດຄວາມພ້ອມ 19 ລາຍການ',
      done: p.checklist, go: () => go('checklist'),
      extra: p.checklist ? 'ບັນທຶກ ' + p.savedAt.checklist : '' },
    { icon: '°C', phase: 'ເປີດກະ', label: 'ກວດເຄື່ອງໃຊ້ ຮອບ 1', hint: 'ອ່ານອຸນຫະພູມຈາກໜ້າຈໍເຄື່ອງ',
      done: p.temps1, go: () => go('equipment', 1),
      extra: p.temps1 ? 'ບັນທຶກ ' + p.savedAt.temps1 : '' },
    { icon: '◉', phase: 'ເປີດກະ', label: 'ຮູບເປີດກະ', hint: 'ຖ່າຍ ' + p.counts.openNeed + ' ຈຸດ',
      done: p.photosOpen, go: () => go('photos', 'open'),
      extra: `${p.counts.openPhotos}/${p.counts.openNeed} ຈຸດ` },
    { icon: '₭', phase: 'ເປີດກະ', label: 'ເງິນທອນຕັ້ງຕົ້ນ', hint: 'ນັບເງິນທີ່ຮັບມາຕອນເລີ່ມກະ',
      done: p.float, go: () => go('float'),
      extra: p.float ? U.kip(sh.float) + ' ກີບ' : '' },
    { icon: '▤', phase: 'ລະຫວ່າງກະ', label: 'ກວດນັບໂຊນສິນຄ້າ', hint: 'ກວດ ' + p.zonesNeeded + ' ໂຊນຕໍ່ກະ',
      done: p.zones >= p.zonesNeeded, go: () => go('zone'),
      extra: `${p.zones}/${p.zonesNeeded} ໂຊນ` },
    { icon: '°C', phase: 'ປິດກະ', label: 'ກວດເຄື່ອງໃຊ້ ຮອບ 2', hint: 'ກ່ອນປິດຮ້ານ',
      done: p.temps2, go: () => go('equipment', 2),
      extra: p.temps2 ? 'ບັນທຶກ ' + p.savedAt.temps2 : '' },
    { icon: '◉', phase: 'ປິດກະ', label: 'ຮູບປິດກະ', hint: 'ຖ່າຍ ' + p.counts.closeNeed + ' ຈຸດ ລວມ Z-Report',
      done: p.photosClose, go: () => go('photos', 'close'),
      extra: `${p.counts.closePhotos}/${p.counts.closeNeed} ຈຸດ` },
    { icon: '✓', phase: 'ປິດກະ', label: 'ເຊັກລິສຕ໌ປະຈໍາວັນ', hint: 'ກວດ ' + p.dailyNeed + ' ຂໍ້ກ່ອນປິດກະ',
      done: p.daily >= p.dailyNeed, go: () => go('daily'), extra: `${p.daily}/${p.dailyNeed} ຂໍ້` },
    { icon: '₭', phase: 'ປິດກະ', label: 'ນັບເງິນ + ທຽບເຄື່ອງຂາຍ', hint: 'ນັບໃບເງິນ ແລະ ອ່ານຍອດຈາກເຄື່ອງຂາຍ',
      done: !!p.cash, go: () => go('cash'), alert: cashBad,
      extra: p.cash
        ? `ນັບໄດ້ ${U.kip(p.cash.counted)} · ສ່ວນຕ່າງ ${U.kip(p.cash.variance)} ກີບ · ບັນທຶກ ${p.savedAt.cash}`
        : '' }
  ];
  const doneN = TASKS.filter(t => t.done).length;
  const next = TASKS.find(t => !t.done);
  const closeReady = !next;

  /* ການ໌ດໃຫຍ່ໃບດຽວ: ບອກວ່າຕ້ອງເຮັດຫຍັງຕໍ່ ຫຼື ພ້ອມປິດກະແລ້ວ — ຖືປຸ່ມຫຼັກດຽວຂອງໜ້າ */
  const nextCard = closeReady
    ? h('section', { class: 'next done-all' }, [
        h('div', { class: 'next-k', text: 'ພ້ອມປິດກະ' }),
        h('div', { class: 'next-t', text: 'ເຮັດຄົບທຸກລາຍການແລ້ວ' }),
        h('div', { class: 'next-s',
          text: p.cash ? 'ສ່ວນຕ່າງເງິນສົດ ' + U.kip(p.cash.variance) + ' ກີບ' : '' }),
        btn('ປິດກະ', closeShift, 'primary big-btn')
      ])
    : h('section', { class: 'next' }, [
        h('div', { class: 'next-k', text: 'ງານຕໍ່ໄປ' }),
        h('div', { class: 'next-t', text: next.label }),
        h('div', { class: 'next-s', text: next.hint }),
        btn('ເລີ່ມເລີຍ', next.go, 'primary big-btn')
      ]);

  const phaseCard = ph => card(
    TASKS.filter(t => t.phase === ph).map(t =>
      taskRow(t.label, t.done, t.go, t.extra, { alert: t.alert, icon: t.icon })), 'tasks');

  /* ການ໌ດເທິງສຸດ: ເບີ້ຍຂະຫຍັນຂອງຕົນເອງ — ເຫັນທຸກມື້ວ່າເຫຼືອເທົ່າໃດ ແລະ ຍັງອີກຈັກມື້ຕັດຍອດ */
  const cyc = BONUS.thisCycle();
  const b = await BONUS.forStaff(sh.staff, cyc) ||
            { paid: 0, deducted: 0, shiftCount: 0, full: 0, pct: 0 };
  const span = BONUS.cycleRange(cyc);
  const hchip = (label, value) => h('div', { class: 'hchip' }, [
    h('div', { class: 'hchip-v', text: value }),
    h('div', { class: 'hchip-l', text: label })
  ]);
  const hero = h('section', { class: 'hero' + (b.pct < 70 ? ' low' : '') }, [
    h('div', { class: 'hero-top' }, [
      h('div', { class: 'hero-main' }, [
        h('div', { class: 'hero-l', text: 'ເບີ້ຍຂະຫຍັນຂອງທ່ານ' }),
        h('div', { class: 'hero-v', text: U.kip(b.paid) + ' ກີບ' }),
        h('div', { class: 'hero-s',
          text: `ຈາກເຕັມ ${U.kip(b.full)} · ຕັດຍອດ ${span.to} ເຫຼືອ ${BONUS.daysLeft(cyc)} ມື້` })
      ]),
      h('button', { class: 'hero-ico', 'data-ui': 'skip',
                    'aria-label': 'ເບິ່ງລາຍລະອຽດເບີ້ຍຂະຫຍັນ',
                    onclick: () => go('bonusStaff', cyc + '|' + sh.staff) }, '›')
    ]),
  ]);

  const quick = [
    { ic: 'checklist', t: 'ເຊັກລິສຕ໌', go: () => go('checklist') },
    { ic: 'camera', t: 'ຖ່າຍຮູບ', go: () => go('photos', 'open') },
    { ic: 'temp', t: 'ອຸນຫະພູມ', go: () => go('equipment', 1) },
    { ic: 'grid', t: 'ກວດໂຊນ', go: () => go('zone') }
  ];
  const quickGrid = h('div', { class: 'quick' }, quick.map(q =>
    h('button', { class: 'quick-t', 'data-ui': 'content', onclick: q.go }, [iconEl(q.ic), h('span', { text: q.t })])));

  const taskCard = card([
    ...['ເປີດກະ', 'ລະຫວ່າງກະ', 'ປິດກະ'].flatMap(ph => [
      h('div', { class: 'phase-k', text: ph }),
      ...TASKS.filter(t => t.phase === ph).map(t =>
        taskRow(t.label, t.done, t.go, t.extra, { alert: t.alert, icon: t.icon })),
      ...(ph === 'ລະຫວ່າງກະ' ? [taskRow('ແຈ້ງບັນຫາ', false, () => go('issueNew'), 'ເມື່ອພົບສິ່ງຜິດປົກກະຕິ', { icon: '!' })] : [])
    ])
  ], 'tasks');

  const closeCard = closeReady ? card([
    h('div', { class: 'next-k', text: 'ພ້ອມປິດກະ' }),
    h('div', { class: 'next-t', text: 'ເຮັດຄົບທຸກລາຍການແລ້ວ' }),
    btn('ປິດກະ', closeShift, 'primary big-btn')
  ]) : null;

  const people = [sh.staff, ...(sh.helpers || [])];
  if (!S.actor || !people.includes(S.actor)) S.actor = sh.staff;
  const actorCard = card([
    rowLabel('ຜູ້ເຮັດງານຕອນນີ້', select(people.map(x => ({ value: x, label: x })), S.actor,
      e => { S.actor = e.target.value; })),
    btn('+ ເພີ່ມຄົນຮ່ວມກະ', () => go('addhelper'), 'ghost')
  ]);

  const body = [
    hero,
    actorCard,
    sh.lateBy > 0
      ? card([h('div', { class: 'warn', text: `⚠ ເປີດກະຊ້າ ${sh.lateBy} ນາທີ (ກະເລີ່ມ ${def.start})` })])
      : null,
    closeCard,
    quickGrid,
    h('h3', { class: 'sec', text: 'ງານວັນນີ້' }),
    taskCard
  ];
  render(sh.branch,
         `${def.label} · ${sh.staff} · ເຊັກອິນ ${U.stamp(sh.openedAt).slice(-5)}`, body,
         progressRing(doneN, TASKS.length));
};

function screenStartShift() {
  const st = S.settings;
  const people = BONUS.roster();
  let branch = st.branches[0];
  let name = '';
  let shiftKey = st.shifts[0].key;

  const def = () => st.shifts.find(x => x.key === shiftKey) || st.shifts[0];

  /* ບອກລ່ວງໜ້າວ່າເຊັກອິນຕອນນີ້ຈະຖືກບັນທຶກແນວໃດ — ຢ່າໃຫ້ຮູ້ຕອນຫຼັງ */
  const info = h('div', { class: 'note' }, '');
  function refresh() {
    const d = def();
    const late = U.minutesLate(d.start);
    const isLate = late > st.lateMinutes;
    info.className = 'note' + (isLate ? ' warn' : '');
    info.textContent = isLate
      ? `ເວລານີ້ ${U.nowTime()} · ກະເລີ່ມ ${d.start} — ຊ້າ ${late} ນາທີ ຈະຖືກບັນທຶກ`
      : `ເວລານີ້ ${U.nowTime()} · ກະ ${d.start}-${d.end} — ເຂົ້າວຽກຕົງເວລາ`;
  }

  const shiftSel = select(
    st.shifts.map(x => ({ value: x.key, label: `${x.label} (${x.start}-${x.end})` })),
    shiftKey, e => { shiftKey = e.target.value; refresh(); });

  const staffSel = people.length
    ? select(
        [{ value: '', label: '— ເລືອກຊື່ —' },
         ...people.map(p => ({ value: p.name,
           label: p.name + (p.type === 'weekend' ? ' · ພາດທາມ' : '') }))],
        '', e => {
          name = e.target.value;
          const p = people.find(x => x.name === name);
          /* ເລືອກຊື່ແລ້ວ ກະຂອງຄົນນັ້ນຂຶ້ນເອງ — ຫຼຸດການເລືອກຜິດກະ */
          if (p && p.shiftKey) { shiftKey = p.shiftKey; shiftSel.value = shiftKey; }
          refresh();
        })
    : input({ placeholder: 'ຊື່ພະນັກງານ', oninput: e => name = e.target.value });

  refresh();

  let pinEntered = '';
  const pinIn = input({ type: 'password', inputmode: 'numeric', autocomplete: 'off',
    placeholder: '4 ຕົວ', oninput: e => pinEntered = e.target.value });

  const body = card([
    h('h2', { class: 'ttl', text: 'ເຊັກອິນ ເຂົ້າວຽກ' }),
    rowLabel('ສາຂາ', select(st.branches, branch, e => branch = e.target.value)),
    rowLabel('ຊື່ພະນັກງານ', staffSel),
    rowLabel('ລະຫັດຂອງຊື່ນັ້ນ', pinIn),
    rowLabel('ກະ', shiftSel),
    info,
    btn('ເຊັກອິນ', async () => {
      const nm = (name || '').trim();
      if (!nm || nm.startsWith('—')) return U.toast('ກະລຸນາເລືອກຊື່ພະນັກງານ', 'err');
      const d = def();
      const lateBy = U.minutesLate(d.start);
      const p = people.find(x => x.name === nm);
      /* ຕ້ອງມີລະຫັດຂອງຄົນນັ້ນ — ກັນການເຊັກອິນແທນຄົນອື່ນ */
      if (!p || !p.pinHash) return U.toast('ຄົນນີ້ຍັງບໍ່ມີລະຫັດ ໃຫ້ຜູ້ຈັດການຕັ້ງກ່ອນ', 'err');
      const [salt, hash] = p.pinHash.split(':');
      if ((await MGR.hash(pinEntered.trim(), salt)) !== hash) return U.toast('ລະຫັດບໍ່ຖືກ', 'err');
      const shift = {
        id: DB.uid(), branch, shiftKey, staff: nm,
        staffType: p ? p.type : 'full',
        date: U.today(), openedAt: new Date().toISOString(),
        lateBy: lateBy > st.lateMinutes ? lateBy : 0,
        earlyBy: 0, float: null, status: 'open'
      };
      await DB.put('shifts', shift);
      SHEETSYNC.queue({ row: SHEETSYNC.row('OPEN-' + shift.id, {
        date: shift.date, time: U.nowTime(), branch, shift: def().label, staff: nm,
        type: 'ເປີດກະ', note: 'ເຊັກອິນ ' + U.nowTime() + (lateBy > st.lateMinutes ? ' · ຊ້າ ' + lateBy + ' ນາທີ' : ''),
        status: 'ເປີດຢູ່' }) });
      if (!people.some(x => x.name === nm))
        await saveSetting('staff', [...st.staff, { name: nm, shiftKey, type: 'full' }]);
      U.toast('ເຊັກອິນ ' + U.nowTime() + ' ແລ້ວ');
      go('home');
    }, 'primary big-btn')
  ]);
  render('GO+MART', 'ລະບົບລາຍງານກະ', body);
}

/* ນັບສິ່ງທີ່ຢູ່ໃນກະ — ໃຊ້ບອກຜູ້ໃຊ້ວ່າຈະເສຍຫຍັງແດ່ */
async function shiftContents(id) {
  const [checks, photos, temps, cashRows, stock] = await Promise.all([
    DB.by('checks', 'shiftId', id), DB.by('photos', 'shiftId', id),
    DB.by('temps', 'shiftId', id), DB.by('cash', 'shiftId', id),
    DB.by('stock', 'shiftId', id)
  ]);
  return { checks: checks.length, photos: photos.length, temps: temps.length,
           cash: cashRows.length, stock: stock.length,
           total: checks.length + photos.length + temps.length + cashRows.length + stock.length };
}

async function cancelShift() {
  const sh = S.shift; if (!sh) return;
  const n = await shiftContents(sh.id);
  const lines = ['ຂໍ້ມູນທີ່ຈະຫາຍໄປຈາກກະນີ້:'];
  if (n.checks) lines.push('· ລາຍການກວດ ' + n.checks + ' ລາຍການ');
  if (n.temps) lines.push('· ຄ່າອຸນຫະພູມ ' + n.temps + ' ຄ່າ');
  if (n.photos) lines.push('· ຮູບຖ່າຍ ' + n.photos + ' ໃບ');
  if (n.cash) lines.push('· ຂໍ້ມູນເງິນສົດ ' + n.cash + ' ຊຸດ');
  if (n.stock) lines.push('· ລາຍການສິນຄ້າ ' + n.stock + ' ລາຍການ');
  if (!n.total) lines.push('· ຍັງບໍ່ມີຂໍ້ມູນທີ່ຕື່ມໄວ້');
  lines.push('ຫຼັງກົດແລ້ວຍັງກົດ "ຍ້ອນກັບ" ໄດ້ 10 ວິນາທີ');

  const ok = await confirmSheet({
    title: 'ລຶບກະນີ້ຖິ້ມ?', lines, confirmLabel: 'ລຶບກະນີ້ຖິ້ມ', danger: true
  });
  if (!ok) return;

  /* ລຶບແບບຍ້ອນກັບໄດ້: ໝາຍສະຖານະໄວ້ກ່ອນ ຂໍ້ມູນຍັງຢູ່ */
  sh.status = 'cancelled';
  sh.cancelledAt = new Date().toISOString();
  await DB.put('shifts', sh);
  await clearShiftDrafts(sh.id);
  S.shift = null;
  await go('home');
  U.toastUndo('ລຶບກະແລ້ວ', 'ຍ້ອນກັບ', async () => {
    sh.status = 'open'; delete sh.cancelledAt;
    await DB.put('shifts', sh);
    S.shift = sh;
    U.toast('ກູ້ກະຄືນແລ້ວ');
    go('home');
  });
}

async function closeShift() {
  const sh = S.shift; if (!sh) return;
  const p = await progress(sh);
  const v = p.cash ? p.cash.variance : 0;
  const def = shiftDef(sh.shiftKey);
  /* ອອກກ່ອນເວລາ = ເຊັກເອົາກ່ອນເວລາຈົບກະ ເກີນເກນນາທີທີ່ຕັ້ງໄວ້ */
  const early = -U.minutesLate(def.end);
  const earlyBy = early > S.settings.earlyMinutes ? early : 0;
  const lines = [
    'ເຊັກເອົາເວລາ ' + U.nowTime() + ' (ກະຈົບ ' + def.end + ')',
    'ສ່ວນຕ່າງເງິນສົດ: ' + U.kip(v) + ' ກີບ',
    'ຫຼັງປິດກະແລ້ວ ຈະແກ້ໄຂຂໍ້ມູນບໍ່ໄດ້ອີກ'
  ];
  if (earlyBy) lines.push('⚠ ອອກກ່ອນເວລາ ' + earlyBy + ' ນາທີ ຈະຖືກບັນທຶກ ແລະ ມີຜົນກັບເບີ້ຍຂະຫຍັນ');
  if (Math.abs(v) > S.settings.cashVarianceLimit) lines.push('⚠ ສ່ວນຕ່າງເກີນເກນ ຜູ້ຈັດການຈະເຫັນລາຍການນີ້');
  if (!await confirmSheet({ title: 'ເຊັກເອົາ ແລະ ປິດກະ?', lines, confirmLabel: 'ເຊັກເອົາ' })) return;
  sh.status = 'closed';
  sh.earlyBy = earlyBy;
  sh.closedAt = new Date().toISOString();
  await DB.put('shifts', sh);
  SHEETSYNC.queue({ row: SHEETSYNC.row('CLOSE-' + sh.id, {
    date: sh.date, time: U.nowTime(), branch: sh.branch, shift: def.label, staff: sh.staff,
    type: 'ປິດກະ', qty: p.cash ? p.cash.variance : '', unit: 'ກີບ',
    note: 'ສ່ວນຕ່າງເງິນສົດ ' + U.kip(v) + (earlyBy ? ' · ອອກກ່ອນ ' + earlyBy + ' ນາທີ' : ''),
    status: 'ປິດແລ້ວ' }) });
  await clearShiftDrafts(sh.id);
  S.shift = null;
  U.toast('ປິດກະສໍາເລັດ');
  go('report');
}

/* ---------- ເຊັກລິສຕ໌ໜ້າຮ້ານ ---------- */
SCREENS.checklist = async function () {
  const sh = S.shift; if (!sh) return go('home');
  const existing = (await DB.by('checks', 'shiftId', sh.id)).filter(c => c.form === 'checklist');
  const state = {};
  existing.forEach(c => state[c.itemKey] = { ok: c.ok, note: c.note || '' });
  const draft = await loadDraft(sh, 'checklist');
  if (draft) Object.assign(state, draft);

  const rowRef = {};
  const allItems = CONFIG.checklist.flatMap(s => s.items);
  const pbar = progressBar(allItems.length, 'ກວດແລ້ວ');
  const answered = k => state[k] && state[k].ok != null;
  const tick = () => {
    pbar.set(allItems.filter(i => answered(i.key)).length);
    advanceTo(allItems.map(i => rowRef[i.key]).filter(Boolean),
              r => r.querySelector('.yn.on'));
  };
  const blocks = [pbar.el];
  CONFIG.checklist.forEach(sec => {
    blocks.push(h('h3', { class: 'sec', text: sec.section }));
    blocks.push(card(sec.items.map(it => {
      const cur = state[it.key] || { ok: null, note: '' };
      const noteIn = input({
        class: 'in note', placeholder: 'ໝາຍເຫດ / ລາຍລະອຽດບັນຫາ',
        value: cur.note, style: cur.ok === false ? '' : 'display:none',
        oninput: e => {
          state[it.key] = { ...(state[it.key] || {}), note: e.target.value };
          saveDraft(sh, 'checklist', state);
        }
      });
      const mark = (ok) => {
        state[it.key] = { ok, note: (state[it.key] || {}).note || '' };
        noteIn.style.display = ok === false ? '' : 'none';
        row.querySelectorAll('.yn').forEach(b => b.classList.remove('on'));
        row.querySelector(ok ? '.yes' : '.no').classList.add('on');
        row.classList.remove('miss');
        saveDraft(sh, 'checklist', state);
        tick();
      };
      const row = h('div', { class: 'ck' }, [
        h('div', { class: 'ck-l', text: it.label }),
        h('div', { class: 'ck-b' }, [
          h('button', { class: 'yn yes' + (cur.ok === true ? ' on' : ''), onclick: () => mark(true), text: '✓' }),
          h('button', { class: 'yn no' + (cur.ok === false ? ' on' : ''), onclick: () => mark(false), text: '✗' })
        ]),
        noteIn
      ]);
      rowRef[it.key] = row;
      return row;
    }), 'tasks'));
  });

  blocks.push(card([btn('ບັນທຶກ', async () => {
    const all = CONFIG.checklist.flatMap(s => s.items);
    const missing = all.filter(i => !state[i.key] || state[i.key].ok == null);
    if (missing.length) return markMissing(missing.map(i => rowRef[i.key]), missing.map(i => i.label));
    await DB.putMany('checks', all.map(i => ({
      id: 'chk_' + sh.id + '_' + i.key,
      shiftId: sh.id, form: 'checklist', itemKey: i.key, label: i.label,
      ok: state[i.key].ok, note: state[i.key].note, ts: new Date().toISOString()
    })));
    const bad = all.filter(i => state[i.key].ok === false);
    if (bad.length) await autoIssues(bad.map(i => `ເຊັກລິສຕ໌: ${i.label} — ${state[i.key].note || 'ບໍ່ຜ່ານ'}`));
    syncEvt(sh, 'CHK-' + sh.id, { type: 'ເຊັກລິສຕ໌', cat: 'ໜ້າຮ້ານ', item: 'ເຊັກລິສຕ໌ໜ້າຮ້ານ',
      qty: all.length - bad.length, unit: 'ຂໍ້ຜ່ານ',
      note: `ຜ່ານ ${all.length - bad.length}/${all.length}` + (bad.length ? ' · ບໍ່ຜ່ານ: ' + bad.map(i => i.label).join(', ') : '') });
    await clearDraft(sh, 'checklist');
    U.toast('ບັນທຶກແລ້ວ');
    go('home');
  }, 'primary big-btn')]));

  render('ເຊັກລິສຕ໌ໜ້າຮ້ານ', sh.branch + ' · ' + allItems.length + ' ລາຍການ', blocks);
  pbar.set(allItems.filter(i => answered(i.key)).length);
  if (draft && !existing.length) U.toast('ກູ້ຂໍ້ມູນທີ່ຕື່ມຄ້າງໄວ້ຄືນແລ້ວ');
};

/* ສ້າງລາຍການບັນຫາອັດຕະໂນມັດ */
async function autoIssues(texts) {
  const sh = S.shift;
  await DB.putMany('issues', texts.map(t => ({
    shiftId: sh.id, branch: sh.branch, date: sh.date,
    text: t, owner: '', due: '', status: 'ເປີດ',
    createdAt: new Date().toISOString(), createdBy: sh.staff
  })));
}

/* ---------- ກວດເຄື່ອງໃຊ້ ---------- */
SCREENS.equipment = async function (round) {
  round = Number(round) || 1;
  const sh = S.shift; if (!sh) return go('home');
  const existing = (await DB.by('temps', 'shiftId', sh.id)).filter(t => t.round === round);
  const state = {};
  existing.forEach(t => state[t.equipKey] = { c: t.celsius, ok: t.condition, note: t.note || '' });
  const form = 'equipment' + round;
  const draft = await loadDraft(sh, form);
  if (draft) Object.assign(state, draft);

  const rowRef = {};
  const pbar = progressBar(CONFIG.equipment.length, 'ກວດແລ້ວ');
  const ok = e => {
    const st = state[e.key];
    if (!st || st.ok == null) return false;
    return e.min === null || (st.c != null && st.c !== '');
  };
  const tick = () => {
    pbar.set(CONFIG.equipment.filter(ok).length);
    advanceTo(CONFIG.equipment.map(e => rowRef[e.key]).filter(Boolean),
              r => r.querySelector('.yn.on'));
  };
  const rows = CONFIG.equipment.map(eq => {
    const cur = state[eq.key] || { c: '', ok: null, note: '' };
    const hasTemp = eq.min !== null && eq.max !== null;
    const spec = hasTemp ? `${eq.min} ຫາ ${eq.max} °C` : (eq.note || '—');
    const warn = h('div', { class: 'warn small', style: 'display:none' });

    const specId = 'eqspec_' + round + '_' + eq.key;
    /* ແປ້ນຕົວເລກມືຖື iPhone ບໍ່ມີເຄື່ອງໝາຍລົບ ຈຶ່ງໃຊ້ຊ່ອງຂໍ້ຄວາມ + ປຸ່ມ +/− */
    const tempIn = hasTemp ? input({
      class: 'in temp', type: 'text', inputmode: 'text', autocomplete: 'off',
      'aria-labelledby': specId,
      placeholder: '°C', value: cur.c ?? '',
      oninput: e => {
        const clean = e.target.value.replace(/[^0-9.\-]/g, '').replace(/(?!^)-/g, '');
        if (clean !== e.target.value) e.target.value = clean;
        const v = clean;
        state[eq.key] = { ...(state[eq.key] || {}), c: v === '' ? null : U.num(v) };
        const n = U.num(v);
        const bad = v !== '' && (n < eq.min || n > eq.max);
        warn.style.display = bad ? '' : 'none';
        warn.textContent = bad ? `⚠ ອອກນອກເກນ (${eq.min} ຫາ ${eq.max} °C) — ຕ້ອງແຈ້ງຜູ້ຈັດການ` : '';
        e.target.classList.toggle('bad', bad);
        row.classList.remove('miss');
        saveDraft(sh, form, state);
      }
    }) : null;

    const noteIn = input({
      class: 'in note', placeholder: 'ບັນຫາທີ່ພົບ', value: cur.note,
      style: cur.ok === false ? '' : 'display:none',
      oninput: e => {
        state[eq.key] = { ...(state[eq.key] || {}), note: e.target.value };
        saveDraft(sh, form, state);
      }
    });

    const mark = ok => {
      state[eq.key] = { ...(state[eq.key] || {}), ok };
      noteIn.style.display = ok === false ? '' : 'none';
      row.querySelectorAll('.yn').forEach(b => b.classList.remove('on'));
      row.querySelector(ok ? '.yes' : '.no').classList.add('on');
      row.classList.remove('miss');
      saveDraft(sh, form, state);
      tick();
    };

    /* ປຸ່ມສະຫຼັບເຄື່ອງໝາຍ ± — ແຕະຄັ້ງດຽວໄດ້ຄ່າລົບ/ບວກ */
    const signBtn = hasTemp ? h('button', {
      class: 'yn sign', type: 'button', 'aria-label': 'ສະຫຼັບເຄື່ອງໝາຍ ບວກ/ລົບ', text: '+/−',
      onclick: () => {
        const v = tempIn.value.trim();
        tempIn.value = v.startsWith('-') ? v.slice(1) : (v === '' ? '-' : '-' + v);
        tempIn.dispatchEvent(new Event('input', { bubbles: true }));
        tempIn.focus();
      }
    }) : null;

    const row = h('div', { class: 'ck eq' }, [
      h('div', { class: 'ck-l' }, [h('span', { text: eq.label }),
                                   h('small', { id: specId, text: spec })]),
      h('div', { class: 'ck-b' }, [
        signBtn,
        tempIn,
        h('button', { class: 'yn yes' + (cur.ok === true ? ' on' : ''), onclick: () => mark(true), text: '✓' }),
        h('button', { class: 'yn no' + (cur.ok === false ? ' on' : ''), onclick: () => mark(false), text: '✗' })
      ]),
      warn, noteIn
    ]);
    if (hasTemp && cur.c != null && (cur.c < eq.min || cur.c > eq.max)) {
      warn.style.display = ''; warn.textContent = `⚠ ອອກນອກເກນ (${eq.min} ຫາ ${eq.max} °C)`;
    }
    rowRef[eq.key] = row;
    return row;
  });

  const body = [
    pbar.el,
    card([h('div', { class: 'note', text: 'ຊ່ອງອຸນຫະພູມຕ້ອງອ່ານຈາກໜ້າຈໍເຄື່ອງ ແລະ ຂຽນເປັນຕົວເລກ' })]),
    card(rows, 'tasks'),
    card([btn('ບັນທຶກ', async () => {
      const needTemp = CONFIG.equipment.filter(e => e.min !== null);
      const miss = CONFIG.equipment.filter(e => !state[e.key] || state[e.key].ok == null);
      if (miss.length) return markMissing(miss.map(e => rowRef[e.key]), miss.map(e => e.label));
      const noTemp = needTemp.filter(e => state[e.key].c == null || state[e.key].c === '');
      if (noTemp.length) return markMissing(noTemp.map(e => rowRef[e.key]),
                                            noTemp.map(e => e.label + ' (ອຸນຫະພູມ)'));

      await DB.putMany('temps', CONFIG.equipment.map(e => ({
        id: 'tmp_' + sh.id + '_' + round + '_' + e.key,
        shiftId: sh.id, round, equipKey: e.key, label: e.label,
        celsius: state[e.key].c ?? null, min: e.min, max: e.max,
        condition: state[e.key].ok, note: state[e.key].note || '',
        ts: new Date().toISOString()
      })));
      const outN = CONFIG.equipment.filter(e => {
        const c = state[e.key].c; return c != null && e.min !== null && (c < e.min || c > e.max);
      }).length;
      syncEvt(sh, 'TMP-' + sh.id + '-' + round, { type: 'ກວດເຄື່ອງໃຊ້', cat: 'ຮອບ ' + round,
        item: 'ເຄື່ອງໃຊ້ ຮອບ ' + round, qty: outN, unit: 'ຈຸດນອກເກນ',
        note: outN ? 'ມີຈຸດນອກເກນ — ຕ້ອງແຈ້ງຜູ້ຈັດການ' : 'ທຸກຈຸດຢູ່ໃນເກນ' });

      const problems = CONFIG.equipment.filter(e => {
        const s = state[e.key];
        const outOfRange = e.min !== null && (s.c < e.min || s.c > e.max);
        return s.ok === false || outOfRange;
      });
      if (problems.length) {
        await autoIssues(problems.map(e => {
          const s = state[e.key];
          const t = e.min !== null ? ` (ວັດໄດ້ ${s.c}°C / ເກນ ${e.min} ຫາ ${e.max}°C)` : '';
          return `ເຄື່ອງໃຊ້ ຮອບ ${round}: ${e.label}${t} — ${s.note || 'ຜິດປົກກະຕິ'}`;
        }));
        U.toast(`ບັນທຶກແລ້ວ · ພົບ ${problems.length} ບັນຫາ ແຈ້ງຜູ້ຈັດການດ່ວນ`, 'err');
      } else U.toast('ບັນທຶກແລ້ວ');
      await clearDraft(sh, form);
      go('home');
    }, 'primary big-btn')])
  ];
  render(`ກວດເຄື່ອງໃຊ້ ຮອບ ${round}`,
         (round === 1 ? 'ກ່ອນເປີດຮ້ານ' : 'ກ່ອນປິດຮ້ານ') + ' · ' + sh.branch, body);
  pbar.set(CONFIG.equipment.filter(ok).length);
  if (draft && !existing.length) U.toast('ກູ້ຂໍ້ມູນທີ່ຕື່ມຄ້າງໄວ້ຄືນແລ້ວ');
};

/* ---------- ຮູບຖ່າຍ ---------- */
SCREENS.photos = async function (phase) {
  phase = phase || 'open';
  const sh = S.shift; if (!sh) return go('home');
  const pts = CONFIG.checkpoints.filter(c => phase === 'open' ? c.open : c.close);
  const taken = (await DB.by('photos', 'shiftId', sh.id)).filter(p => p.phase === phase);
  const byKey = {}; taken.forEach(p => byKey[p.checkpoint] = p);

  /* ປຸ່ມຫຼັກມີໄດ້ 1 ປຸ່ມຕໍ່ຈໍ — ໃຫ້ເປັນຈຸດຕໍ່ໄປທີ່ຍັງບໍ່ໄດ້ຖ່າຍ */
  const nextKey = (pts.find(c => !byKey[c.key]) || {}).key;

  /* ບັນທຶກຮູບ — ໃຊ້ທາງດຽວກັນທັງກ້ອງໃນແອັບ ແລະ ທາງສໍາຮອງ */
  async function savePhoto(pt, source, src, existing) {
    U.toast('ກໍາລັງບັນທຶກຮູບ...');
    const pos = await U.geo();
    const lines = [
      `${sh.branch} · ${shiftDef(sh.shiftKey).label}`,
      `${U.stamp()} · ${sh.staff}`,
      pt.label + (pos ? ` · ${pos.lat},${pos.lng}` : '')
    ];
    const blob = await U.watermark(src, lines);
    if (existing) await DB.del('photos', existing.id);
    await DB.put('photos', {
      shiftId: sh.id, phase, checkpoint: pt.key, label: pt.label,
      blob, gps: pos, source,              /* camera = ກ້ອງໃນແອັບ · fallback = ທາງສໍາຮອງ */
      ts: new Date().toISOString(), staff: sh.staff, branch: sh.branch
    });
    syncEvt(sh, 'PHT-' + sh.id + '-' + phase + '-' + pt.key + '-' + Date.now(), { type: 'ຖ່າຍຮູບ',
      cat: phase === 'open' ? 'ເປີດກະ' : 'ປິດກະ', item: pt.label, qty: 1, unit: 'ຮູບ',
      note: source === 'camera' ? 'ກ້ອງໃນແອັບ' : 'ທາງສໍາຮອງ ⚠ ບໍ່ໄດ້ຖ່າຍຜ່ານກ້ອງໃນແອັບ' });
    U.toast(source === 'camera' ? 'ບັນທຶກຮູບແລ້ວ' : 'ບັນທຶກແລ້ວ (ບໍ່ໄດ້ໃຊ້ກ້ອງໃນແອັບ)');
    go('photos', phase);
  }

  const cards = pts.map(pt => {
    const existing = byKey[pt.key];
    const thumb = h('div', { class: 'thumb' });
    if (existing) {
      thumb.appendChild(h('img', { src: URL.createObjectURL(existing.blob) }));
      if (existing.source && existing.source !== 'camera') {
        thumb.appendChild(h('div', { class: 'thumb-warn',
          text: '⚠ ຮູບນີ້ບໍ່ໄດ້ຖ່າຍຜ່ານກ້ອງໃນແອັບ' }));
      }
    }

    /* ທາງສໍາຮອງ — ໃຊ້ສະເພາະເມື່ອກ້ອງໃນແອັບເປີດບໍ່ໄດ້ */
    const file = h('input', {
      type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none',
      onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        try { await savePhoto(pt, 'fallback', f, existing); }
        catch (err) { U.toast('ບັນທຶກຮູບບໍ່ໄດ້: ' + err.message, 'err'); }
      }
    });

    async function shoot() {
      if (!U.cameraAvailable()) {
        U.toast('ເຄື່ອງນີ້ໃຊ້ກ້ອງໃນແອັບບໍ່ໄດ້ — ໃຊ້ທາງສໍາຮອງ', 'err');
        return file.click();
      }
      let blob;
      try {
        blob = await U.openCamera(pt.label);
      } catch (err) {
        /* ເປີດກ້ອງບໍ່ໄດ້ — ບອກສາເຫດ ແລ້ວໃຫ້ທາງສໍາຮອງ ບໍ່ໃຫ້ພະນັກງານຕິດຂັດ */
        const ok = await confirmSheet({
          title: 'ເປີດກ້ອງບໍ່ໄດ້',
          lines: [U.cameraError(err),
                  'ຈະໃຊ້ທາງສໍາຮອງແທນບໍ? ຮູບຈະຖືກໝາຍໄວ້ວ່າບໍ່ໄດ້ຖ່າຍຜ່ານກ້ອງໃນແອັບ'],
          confirmLabel: 'ໃຊ້ທາງສໍາຮອງ'
        });
        if (ok) file.click();
        return;
      }
      if (!blob) return;                    /* ຜູ້ໃຊ້ກົດຍົກເລີກ */
      try { await savePhoto(pt, 'camera', blob, existing); }
      catch (err) { U.toast('ບັນທຶກຮູບບໍ່ໄດ້: ' + err.message, 'err'); }
    }

    /* ຈຸດທີ່ຖ່າຍແລ້ວ: ແຖວສັ້ນ ບໍ່ໃຫ້ຮູບໃຫຍ່ຊ້ອນກັນ ບໍ່ໃຫ້ປຸ່ມຖ່າຍໃໝ່ເດັ່ນ */
    if (existing) {
      const small = h('div', { class: 'pt-done' }, [
        h('img', { class: 'pt-thumb', src: URL.createObjectURL(existing.blob), alt: pt.label }),
        h('div', { class: 'pt-meta' }, [
          h('div', { class: 'pt-l', text: '✓ ' + pt.label }),
          h('small', { class: 'muted',
            text: 'ຖ່າຍ ' + U.stamp(existing.ts).slice(-5) +
                  (existing.source && existing.source !== 'camera' ? ' · ⚠ ທາງສໍາຮອງ' : '') })
        ]),
        btn('ຖ່າຍໃໝ່', async () => {
          /* ຖ່າຍໃໝ່ຕ້ອງຢືນຢັນ — ກັນແຕະພລາດແລ້ວຮູບເກົ່າຫາຍ */
          const ok = await confirmSheet({
            title: 'ຖ່າຍໃໝ່ຈຸດນີ້?',
            lines: [pt.label, 'ຮູບເກົ່າຈະຖືກແທນທີ່ດ້ວຍຮູບໃໝ່'],
            confirmLabel: 'ຖ່າຍໃໝ່'
          });
          if (ok) return shoot();
        }, 'ghost sm', 'ກຳລັງເປີດກ້ອງ…')
      ]);
      return card([small, file], 'pt-card-done');
    }

    return card([
      h('div', { class: 'pt-top' }, [
        h('div', {}, [h('div', { class: 'pt-l', text: pt.label }),
                      pt.hint ? h('small', { class: 'muted', text: pt.hint }) : null]),
        statusPill(false, 'ຖ່າຍແລ້ວ', 'ຍັງ')
      ]),
      file,
      btn('ຖ່າຍຮູບ', shoot,
          pt.key === nextKey ? 'primary' : 'ghost', 'ກຳລັງເປີດກ້ອງ…')
    ]);
  });

  const allDone = !nextKey;
  cards.push(card([btn('ກັບໜ້າຫຼັກ', () => go('home'), allDone ? 'primary big-btn' : 'ghost big-btn')]));
  render(phase === 'open' ? 'ຮູບເປີດກະ' : 'ຮູບປິດກະ', `${taken.length}/${pts.length} ຈຸດ`, cards);
};

/* ---------- ເຊັກລິສຕ໌ປະຈໍາວັນ (ກ່ອນປິດກະ) ---------- */
SCREENS.daily = async function () {
  const sh = S.shift; if (!sh) return go('home');
  const rows = (await DB.by('checks', 'shiftId', sh.id)).filter(c => c.form === 'daily');
  const byKey = {}; rows.forEach(r => byKey[r.itemKey] = r);
  const all = CONFIG.dailyChecklist.flatMap(s => s.items);
  const doneN = all.filter(i => byKey[i.key] && byKey[i.key].ok != null).length;

  /* ບັນທຶກທັນທີທີ່ແຕະ — ກົດຊໍ້າບໍ່ສ້າງແຖວໃໝ່ (id ຄົງທີ່) */
  async function mark(it, ok) {
    await DB.put('checks', {
      id: 'dly_' + sh.id + '_' + it.key, shiftId: sh.id, form: 'daily',
      itemKey: it.key, label: it.label, ok, ts: new Date().toISOString()
    });
    /* ຂໍ້ທີ່ຍັງບໍ່ໄດ້ເຮັດ ສ້າງວຽກຕິດຕາມອັດຕະໂນມັດ */
    if (ok === false) await autoIssues(['ເຊັກລິສຕ໌ປະຈໍາວັນ: ' + it.label]);
    const answered = (await DB.by('checks', 'shiftId', sh.id)).filter(c => c.form === 'daily' && c.ok != null).length;
    if (answered === all.length) {
      syncEvt(sh, 'DLY-' + sh.id, { type: 'ເຊັກລິສຕ໌ປະຈໍາວັນ', cat: 'ກ່ອນປິດກະ',
        item: 'ເຊັກລິສຕ໌ປະຈໍາວັນ', qty: all.length, unit: 'ຂໍ້',
        note: 'ກວດຄົບ ' + all.length + ' ຂໍ້' });
    }
    go('daily');
  }

  const sections = CONFIG.dailyChecklist.map(sec => card([
    h('h3', { class: 'ttl', text: sec.section }),
    ...sec.items.map(it => {
      const rec = byKey[it.key];
      return h('div', { class: 'dly' }, [
        h('div', { class: 'dly-t', text: it.label }),
        h('ul', { class: 'dly-sub' }, it.subs.map(x => h('li', { text: x }))),
        h('div', { class: 'dly-btns' }, [
          btn('✓ ເຮັດແລ້ວ', () => mark(it, true), rec && rec.ok === true ? 'primary' : 'ghost'),
          btn('✗ ຍັງບໍ່ໄດ້', () => mark(it, false), rec && rec.ok === false ? 'danger-quiet' : 'ghost')
        ])
      ]);
    })
  ], 'dly-card'));

  const body = [
    card([h('div', { class: 'note', text: 'ກວດທຸກຂໍ້ກ່ອນປິດກະ — ຍັງເຫຼືອ ' + (all.length - doneN) + ' ຂໍ້' })]),
    ...sections,
    card([btn('ກັບໜ້າຫຼັກ', () => go('home'), doneN === all.length ? 'primary big-btn' : 'ghost big-btn')])
  ];
  render('ເຊັກລິສຕ໌ປະຈໍາວັນ', doneN + '/' + all.length + ' ຂໍ້', body);
};

/* ---------- ເງິນທອນຕັ້ງຕົ້ນ ---------- */
SCREENS.float = async function () {
  const sh = S.shift; if (!sh) return go('home');
  let v = sh.float ?? '';
  const body = card([
    h('div', { class: 'note', text: 'ນັບເງິນທອນທີ່ຮັບມາຕອນເລີ່ມກະ' }),
    rowLabel('ເງິນທອນຕັ້ງຕົ້ນ (ກີບ)',
      input({ type: 'number', inputmode: 'numeric', value: v, oninput: e => v = e.target.value })),
    btn('ບັນທຶກ', async () => {
      if (v === '' || v == null) return U.toast('ກະລຸນາໃສ່ຈໍານວນ', 'err');
      sh.float = U.num(v);
      await DB.put('shifts', sh);
      U.toast('ບັນທຶກແລ້ວ'); go('home');
    }, 'primary big-btn')
  ]);
  render('ເງິນທອນຕັ້ງຕົ້ນ', sh.branch, body);
};

/* ---------- ນັບເງິນ + ທຽບເຄື່ອງຂາຍ ---------- */
SCREENS.cash = async function () {
  const sh = S.shift; if (!sh) return go('home');
  const prev = (await DB.by('cash', 'shiftId', sh.id))[0] || null;
  const d = {};
  CONFIG.denominations.forEach(x => d[x] = prev ? (prev.denoms[x] || 0) : 0);
  const f = {
    posCash: prev ? prev.posCash : '', posTotal: prev ? prev.posTotal : '',
    posQr: prev ? prev.posQr : '', posOther: prev ? prev.posOther : '',
    bills: prev ? prev.bills : '', voided: prev ? prev.voided : '',
    reason: prev ? prev.reason : '', reasonNote: prev ? prev.reasonNote : '',
    manager: prev ? prev.manager : ''
  };
  const draft = await loadDraft(sh, 'cash');
  if (draft) { Object.assign(d, draft.d || {}); Object.assign(f, draft.f || {}); }
  const keep = () => saveDraft(sh, 'cash', { d, f });

  const out = {
    counted: h('b', { text: '0' }), expected: h('b', { text: '0' }),
    variance: h('b', { text: '0' })
  };
  const varBox = h('div', { class: 'varbox' }, [
    h('div', { class: 'vrow' }, [h('span', { text: 'D. ເງິນສົດນັບໄດ້' }), out.counted]),
    h('div', { class: 'vrow' }, [h('span', { text: 'C. ເງິນສົດທີ່ຄວນມີ (A+B)' }), out.expected]),
    h('div', { class: 'vrow big-v' }, [h('span', { text: 'E. ສ່ວນຕ່າງ (D−C)' }), out.variance])
  ]);
  /* ແຖບສະຫຼຸບຕິດລຸ່ມ — ເຫັນສ່ວນຕ່າງຕະຫຼອດເວລາພິມ ບໍ່ຕ້ອງເລື່ອນຈໍຫາ */
  const ssV = h('div', { class: 'ss-v', text: '0' });
  const ssSub = h('div', { class: 'ss-sub', text: '' });
  const stickySum = h('div', { class: 'sticky-sum' }, [
    h('div', { class: 'ss-row' }, [
      h('div', {}, [h('div', { class: 'ss-k', text: 'ສ່ວນຕ່າງ (E)' }), ssSub]),
      ssV
    ])
  ]);

  const reasonWrap = h('div', { style: 'display:none' });

  function recalc() {
    const counted = CONFIG.denominations.reduce((s, x) => s + x * U.num(d[x]), 0);
    const expected = U.num(sh.float) + U.num(f.posCash);
    const variance = counted - expected;
    out.counted.textContent = U.kip(counted);
    out.expected.textContent = U.kip(expected);
    out.variance.textContent = U.kip(variance);
    const over = Math.abs(variance) > S.settings.cashVarianceLimit;
    varBox.classList.toggle('alert', over);
    reasonWrap.style.display = variance !== 0 ? '' : 'none';
    ssV.textContent = U.kip(variance) + ' ກີບ';
    ssSub.textContent = 'ນັບໄດ້ ' + U.kip(counted) + ' · ຄວນມີ ' + U.kip(expected);
    stickySum.classList.toggle('alert', over);
    stickySum.classList.toggle('good', !over && variance === 0 && counted > 0);
    return { counted, expected, variance, over };
  }

  /* ປ້າຍທີ່ເຫັນດ້ວຍຕາ (ຕົວເລກໃບເງິນ) ຜູກກັບຊ່ອງດ້ວຍ <label for> */
  const denomRows = CONFIG.denominations.map(x => {
    const id = 'den_' + x;
    return h('div', { class: 'den' }, [
      h('label', { class: 'den-l', for: id, text: U.kip(x) }),
      input({
        id, type: 'number', inputmode: 'numeric', min: '0', value: d[x] || '',
        placeholder: 'ໃບ', oninput: e => { d[x] = U.num(e.target.value); recalc(); keep(); }
      }),
      h('span', { class: 'den-v', text: '' })
    ]);
  });
  function paintDen() {
    denomRows.forEach((r, i) => {
      const x = CONFIG.denominations[i];
      r.querySelector('.den-v').textContent = U.kip(x * U.num(d[x]));
    });
  }
  denomRows.forEach(r => r.querySelector('input').addEventListener('input', paintDen));

  reasonWrap.appendChild(card([
    h('h3', { class: 'ttl', text: 'ສາເຫດຂອງສ່ວນຕ່າງ' }),
    rowLabel('ສາເຫດ', select(['— ເລືອກ —', ...CONFIG.varianceReasons], f.reason, e => { f.reason = e.target.value; keep(); })),
    rowLabel('ລາຍລະອຽດ', input({ value: f.reasonNote, placeholder: 'ອະທິບາຍ', oninput: e => { f.reasonNote = e.target.value; keep(); } })),
    rowLabel('ຊື່ຜູ້ຈັດການທີ່ຮັບແຈ້ງ', input({ value: f.manager, oninput: e => { f.manager = e.target.value; keep(); } }))
  ]));

  const body = [
    card([h('h3', { class: 'ttl', text: 'ສ່ວນທີ 1 · ນັບໃບເງິນ' }), ...denomRows]),
    card([
      h('h3', { class: 'ttl', text: 'ສ່ວນທີ 2 · ອ່ານຈາກເຄື່ອງຂາຍ' }),
      rowLabel('A. ເງິນທອນຕັ້ງຕົ້ນ (ກີບ)', input({ value: U.kip(sh.float), disabled: 'disabled' })),
      rowLabel('B. ຍອດຂາຍດ້ວຍເງິນສົດ (ກີບ)',
        input({ type: 'number', inputmode: 'numeric', value: f.posCash, oninput: e => { f.posCash = e.target.value; recalc(); keep(); } })),
      varBox
    ]),
    card([
      h('h3', { class: 'ttl', text: 'ສ່ວນທີ 3 · ຊ່ອງທາງການຊໍາລະ' }),
      rowLabel('ຍອດຂາຍລວມທັງໝົດ (ກີບ)', input({ type: 'number', value: f.posTotal, oninput: e => { f.posTotal = e.target.value; keep(); } })),
      rowLabel('ຊໍາລະດ້ວຍ QR / ໂອນ (ກີບ)', input({ type: 'number', value: f.posQr, oninput: e => { f.posQr = e.target.value; keep(); } })),
      rowLabel('ອື່ນໆ (ກີບ)', input({ type: 'number', value: f.posOther, oninput: e => { f.posOther = e.target.value; keep(); } })),
      rowLabel('ຈໍານວນບິນທັງໝົດ (ໃບ)', input({ type: 'number', value: f.bills, oninput: e => { f.bills = e.target.value; keep(); } })),
      rowLabel('ບິນຍົກເລີກ / ຄືນເງິນ (ໃບ)', input({ type: 'number', value: f.voided, oninput: e => { f.voided = e.target.value; keep(); } }))
    ]),
    reasonWrap,
    card([btn('ບັນທຶກ', async () => {
      const r = recalc();
      if (f.posCash === '' ) return U.toast('ຕ້ອງໃສ່ຍອດຂາຍເງິນສົດຈາກເຄື່ອງຂາຍ', 'err');
      if (r.over && (!f.reason || f.reason.startsWith('—')))
        return U.toast(`ສ່ວນຕ່າງເກີນ ${U.kip(S.settings.cashVarianceLimit)} ກີບ ຕ້ອງເລືອກສາເຫດ`, 'err');
      if (r.over && !f.manager.trim())
        return U.toast('ຕ້ອງໃສ່ຊື່ຜູ້ຈັດການທີ່ຮັບແຈ້ງ', 'err');

      /* ລະຫັດຕາຍຕົວ: 1 ກະ = 1 ແຖວ ກົດຊໍ້າກໍ່ທັບແຖວເກົ່າ ບໍ່ເກີດແຖວຊໍ້າ */
      await DB.put('cash', {
        id: 'cash_' + sh.id,
        shiftId: sh.id, branch: sh.branch, date: sh.date, staff: sh.staff,
        denoms: d, float: U.num(sh.float),
        posCash: U.num(f.posCash), posTotal: U.num(f.posTotal),
        posQr: U.num(f.posQr), posOther: U.num(f.posOther),
        bills: U.num(f.bills), voided: U.num(f.voided),
        counted: r.counted, expected: r.expected, variance: r.variance,
        reason: f.reason, reasonNote: f.reasonNote, manager: f.manager,
        ts: new Date().toISOString()
      });
      if (r.over) await autoIssues([`ເງິນສົດ: ສ່ວນຕ່າງ ${U.kip(r.variance)} ກີບ — ${f.reason} ${f.reasonNote}`]);
      await clearDraft(sh, 'cash');
      U.toast('ບັນທຶກແລ້ວ'); go('home');
    }, 'primary big-btn')]),
    h('div', { style: 'height:78px' }),   /* ເນື້ອທີ່ໃຫ້ແຖບສະຫຼຸບທີ່ລອຍຢູ່ລຸ່ມ */
    stickySum
  ];
  render('ນັບເງິນ + ທຽບເຄື່ອງຂາຍ', sh.branch, body);
  paintDen(); recalc();
};

/* ---------- ກວດນັບໂຊນ ---------- */
SCREENS.zone = async function () {
  const sh = S.shift;
  /* ບໍ່ມີກະເປີດຢູ່ — ບອກເຫດຜົນ ແລະ ມີທາງໄປຕໍ່ ດີກວ່າເດັ້ງກັບໂດຍບໍ່ບອກຫຍັງ */
  if (!sh) return render('ກວດນັບໂຊນສິນຄ້າ', 'ຍັງບໍ່ໄດ້ເຊັກອິນ', [
    card([
      h('div', { class: 'note', text: 'ຕ້ອງເຊັກອິນເຂົ້າກະກ່ອນ ຈຶ່ງຈະກວດນັບໂຊນໄດ້' }),
      btn('ໄປເຊັກອິນ', () => go('home'), 'primary')
    ])
  ]);
  const done = (await DB.by('checks', 'shiftId', sh.id)).filter(c => c.form === 'zone');
  const doneZones = [...new Set(done.map(c => c.zone))];
  let zone = S.settings.zones.find(z => !doneZones.includes(z)) || S.settings.zones[0];
  const state = {};
  const draft = await loadDraft(sh, 'zone');
  if (draft && draft.zone === zone) Object.assign(state, draft.state);
  const rowRef = {};
  const pbar = progressBar(CONFIG.stockChecks.length, 'ກວດແລ້ວ');
  const tick = () => {
    pbar.set(CONFIG.stockChecks.filter(c => state[c.key] && state[c.key].ok != null).length);
    advanceTo(CONFIG.stockChecks.map(c => rowRef[c.key]).filter(Boolean),
              r => r.querySelector('.yn.on'));
  };

  const list = card(CONFIG.stockChecks.map(c => {
    const cur = state[c.key] || {};
    const noteIn = input({ class: 'in note', placeholder: 'ຊື່ສິນຄ້າ ແລະ ຈໍານວນ',
      value: cur.note || '', style: cur.ok === false ? '' : 'display:none',
      oninput: e => {
        state[c.key] = { ...(state[c.key] || {}), note: e.target.value };
        saveDraft(sh, 'zone', { zone, state });
      } });
    const mark = ok => {
      state[c.key] = { ...(state[c.key] || {}), ok };
      noteIn.style.display = ok === false ? '' : 'none';
      row.querySelectorAll('.yn').forEach(b => b.classList.remove('on'));
      row.querySelector(ok ? '.yes' : '.no').classList.add('on');
      row.classList.remove('miss');
      saveDraft(sh, 'zone', { zone, state });
      tick();
    };
    const row = h('div', { class: 'ck' }, [
      h('div', { class: 'ck-l', text: c.label }),
      h('div', { class: 'ck-b' }, [
        h('button', { class: 'yn yes' + (cur.ok === true ? ' on' : ''), onclick: () => mark(true), text: '✓' }),
        h('button', { class: 'yn no' + (cur.ok === false ? ' on' : ''), onclick: () => mark(false), text: '✗' })
      ]), noteIn
    ]);
    rowRef[c.key] = row;
    return row;
  }), 'tasks');

  const body = [
    pbar.el,
    card([
      h('div', { class: 'note', text: `ກວດແລ້ວ ${doneZones.length}/${S.settings.zones.length} ໂຊນ · ຕ້ອງການ ${S.settings.zonesPerShift} ໂຊນຕໍ່ກະ` }),
      rowLabel('ໂຊນທີ່ກໍາລັງກວດ', select(S.settings.zones, zone, e => {
        zone = e.target.value; saveDraft(sh, 'zone', { zone, state });
      })),
      doneZones.length ? h('div', { class: 'muted', text: 'ກວດແລ້ວ: ' + doneZones.join(', ') }) : null
    ]),
    list,
    card([btn('ບັນທຶກໂຊນນີ້', async () => {
      const miss = CONFIG.stockChecks.filter(c => !state[c.key] || state[c.key].ok == null);
      if (miss.length) return markMissing(miss.map(c => rowRef[c.key]), miss.map(c => c.label));
      if (doneZones.includes(zone) && !await U.confirmBox('ໂຊນນີ້ກວດແລ້ວ ຈະບັນທຶກທັບບໍ?')) return;
      await DB.putMany('checks', CONFIG.stockChecks.map(c => ({
        id: 'zone_' + sh.id + '_' + zone + '_' + c.key,
        shiftId: sh.id, form: 'zone', zone, itemKey: c.key, label: c.label,
        ok: state[c.key].ok, note: state[c.key].note || '', ts: new Date().toISOString()
      })));
      const bad = CONFIG.stockChecks.filter(c => state[c.key].ok === false);
      if (bad.length) await autoIssues(bad.map(c => `ໂຊນ ${zone}: ${c.label} — ${state[c.key].note || 'ມີບັນຫາ'}`));
      await clearDraft(sh, 'zone');
      U.toast('ບັນທຶກແລ້ວ'); go('home');
    }, 'primary big-btn')])
  ];
  render('ກວດນັບໂຊນສິນຄ້າ', sh.branch, body);
  pbar.set(CONFIG.stockChecks.filter(c => state[c.key] && state[c.key].ok != null).length);
};

window.addEventListener('DOMContentLoaded', async () => {
  U.applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => U.applyTheme());
  await loadSettings();
  await loadOpenShift();
  go('home');
});
