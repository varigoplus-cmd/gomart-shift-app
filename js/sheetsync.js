/* ສົ່ງຂໍ້ມູນກະຂຶ້ນ Google Sheets ຜ່ານ Apps Script
 * ຕັ້ງ URL ແລະ ລະຫັດໃນ ຕັ້ງຄ່າ → ເຊື່ອມ Google Sheets (ບໍ່ຝັງໃນໂຄ້ດ)
 * ເກັບຄິວໄວ້ໃນເຄື່ອງກ່ອນ ເນັດຂາດກໍ່ບໍ່ເສຍ ສົ່ງຊ້ໍາໄດ້ປອດໄພ (ລະຫັດແຖວຄົງທີ່) */
const SHEETSYNC = (() => {
  /* ລິງ Apps Script ບໍ່ຖືວ່າເປັນຄວາມລັບ — ລະຫັດ (SHEET_TOKEN) ຍັງຕ້ອງໃສ່ໃນແຕ່ລະເຄື່ອງ */
  const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbxB1vrYjA7EjXbwC2NgzDwTTlKhFgwL6n9SkQSI9V6DmXtbL5iAzDW-OmCsoSD6PJQ9/exec';

  const COLS = ['ລະຫັດ','ວັນທີ','ເວລາ','ສາຂາ','ກະ','ຜູ້ບັນທຶກ','ປະເພດ','ໝວດ','ລາຍການ','ຈໍານວນ','ຫົວໜ່ວຍ','ເຫດຜົນ / ລາຍລະອຽດ','ຜູ້ອະນຸມັດ','ສະຖານະ','ອັບເດດລ່າສຸດ','ໝາຍເຫດ'];

  function row(id, { date, time, branch, shift, staff, type, cat, item, qty, unit, note, status, remark }) {
    const r = new Array(COLS.length).fill('');
    r[0] = id; r[1] = date; r[2] = time; r[3] = branch; r[4] = shift; r[5] = staff;
    r[6] = type; r[7] = cat; r[8] = item; r[9] = qty ?? ''; r[10] = unit ?? '';
    r[11] = note ?? ''; r[13] = status ?? 'ປິດແລ້ວ';
    r[14] = new Date().toISOString().slice(0, 16).replace('T', ' ');
    r[15] = remark ?? '';
    return r;
  }

  /* ເພີ່ມເຫດການເຂົ້າຄິວ */
  /* ທຸກການອ່าน-ແກ້ໄຂຄິວເຮັດຕາມລໍາດັບ ບໍ່ໃຫ້ສອງເຫດການຂຽນທັບກັນ */
  let chain = Promise.resolve();
  function serial(fn) { chain = chain.then(fn, fn); return chain; }

  function queue(ev) {
    return serial(async () => {
      const q = (await DB.setting('sheetQueue')) || [];
      q.push(ev);
      await DB.setting('sheetQueue', q.slice(-500));
    }).then(() => flush());
  }

  /* ສົ່ງຄິວ ຖ້າຍັງບໍ່ໄດ້ຕັ້ງຄ່າ ເກັບໄວ້ກ່ອນ */
  function flush() { return serial(doFlush); }
  async function doFlush() {
    const url = (await DB.setting('sheetUrl')) || DEFAULT_URL;
    const token = await DB.setting('sheetToken');
    const q = (await DB.setting('sheetQueue')) || [];
    if (!url || !token || q.length === 0) return { sent: 0, pending: q.length };
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ token, rows: q.map(e => e.row) }) });
      const out = await res.json();
      if (!out.ok) return { sent: 0, pending: q.length, error: out.error };
      await DB.setting('sheetQueue', []);
      return { sent: q.length, pending: 0 };
    } catch (err) {
      return { sent: 0, pending: q.length, error: 'ເນັດຂາດ — ເກັບໄວ້ໃນເຄື່ອງ' };
    }
  }

  /* ທົດສອບການເຊື່ອມຕໍ່ໂດຍບໍ່ເຂົ້າແຖວໃໝ່ */
  async function test(url, token) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ token, rows: [] }) });
      const out = await res.json();
      return out.ok ? { ok: true } : { ok: false, error: out.error };
    } catch (err) { return { ok: false, error: 'ເຊື່ອມຕໍ່ບໍ່ໄດ້' }; }
  }

  /* ສົ່ງການຕັ້ງຄ່າປັດຈຸບັນໄປແຜ່ນ (ແຜ່ນສະແດງຜົນ ແອັບເປັນຜູ້ແກ້) */
  async function pushSettings(rows) {
    const url = (await DB.setting('sheetUrl')) || DEFAULT_URL;
    const token = await DB.setting('sheetToken');
    if (!url || !token) return { ok: false, error: 'ຍັງບໍ່ໄດ້ຕັ້ງລະຫັດ' };
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ token, action: 'settings', rows }) });
      return await res.json();
    } catch (err) { return { ok: false, error: 'ເຊື່ອມບໍ່ໄດ້' }; }
  }

  /* ດຶງທຸກແຖວຈາກແຜ່ນ (ທຸກເຄື່ອງ) ສໍາລັບໜ້າພາບລວມທີມງານຂອງຜູ້ຈັດການ
   * ຄືນ { ok:true, rows:[...] } ຫຼື { ok:false, error } — ແຜ່ນເກົ່າທີ່ຍັງບໍ່ມີ action read ຈະຕອບ error */
  async function readAll() {
    const url = (await DB.setting('sheetUrl')) || DEFAULT_URL;
    const token = await DB.setting('sheetToken');
    if (!url || !token) return { ok: false, error: 'ຍັງບໍ່ໄດ້ຕັ້ງລະຫັດ Sheet ໃນເຄື່ອງນີ້' };
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ token, action: 'read' }) });
      const out = await res.json();
      if (!out.ok) return { ok: false, error: out.error || 'ດຶງຂໍ້ມູນບໍ່ໄດ້' };
      if (!Array.isArray(out.rows)) return { ok: false, error: 'ແຜ່ນຍັງເປັນເວີຊັນເກົ່າ — ຕ້ອງອັບເດດ Apps Script' };
      return { ok: true, rows: out.rows };
    } catch (err) { return { ok: false, error: 'ເນັດຂາດ — ດຶງຂໍ້ມູນບໍ່ໄດ້' }; }
  }

  return { COLS, row, queue, flush, test, DEFAULT_URL, pushSettings, readAll };
})();
