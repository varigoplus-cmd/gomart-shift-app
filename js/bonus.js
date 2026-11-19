/* ເບີ້ຍຂະຫຍັນ — ຄິດຈາກຂໍ້ມູນທີ່ບັນທຶກໄວ້ແລ້ວ ບໍ່ມີການໃຫ້ຄະແນນດ້ວຍມື
 *
 * ຫຼັກການ: ທຸກຄົນເລີ່ມເດືອນດ້ວຍເບີ້ຍເຕັມ ແລ້ວຫັກລົງຕາມສິ່ງທີ່ເກີດຂຶ້ນຈິງ
 * ທຸກການຫັກຕ້ອງຊີ້ກັບໄປຫາກະໃດກະໜຶ່ງໄດ້ສະເໝີ — ພະນັກງານຈຶ່ງກວດຄືນໄດ້
 *
 * ກົດ 8 ຂໍ້ທີ່ຄິດອັດຕະໂນມັດ ຢູ່ໃນ CONFIG.bonusRules
 * ສ່ວນ "ບໍ່ມາເຮັດວຽກ" (absent) ຕ້ອງໃຫ້ຜູ້ຈັດການບັນທຶກເອງ ເພາະລະບົບຍັງບໍ່ມີຕາຕະລາງເວນ
 */
const BONUS = (() => {

  const monthOf = iso => (iso || '').slice(0, 7);
  const thisMonth = () => U.today().slice(0, 7);

  function ruleOf(key) { return CONFIG.bonusRules.find(r => r.key === key); }

  /* ຈໍານວນເງິນທີ່ຫັກຕໍ່ຄັ້ງ — ເຈົ້າຂອງຮ້ານແກ້ໄດ້ໃນໜ້າຕັ້ງຄ່າ */
  function amountOf(key) {
    const over = (S.settings && S.settings.bonusAmounts) || {};
    const r = ruleOf(key);
    return over[key] != null ? over[key] : (r ? r.amount : 0);
  }

  /* ເບີ້ຍເຕັມ — ພາດທາມໄດ້ຄົນລະອັດຕາ */
  function fullFor(staff) {
    const st = S.settings;
    return staff && staff.type === 'weekend' ? st.bonusFullWeekend : st.bonusFull;
  }

  /* ລາຍຊື່ພະນັກງານແບບມີໂຄງສ້າງ — ຮອງຮັບຂໍ້ມູນເກົ່າທີ່ເປັນແຕ່ສະຕຣິງ */
  function roster() {
    return (S.settings.staff || []).map(s =>
      typeof s === 'string' ? { name: s, shiftKey: null, type: 'full' } : s);
  }
  function staffByName(name) {
    return roster().find(s => s.name === name) || { name, shiftKey: null, type: 'full' };
  }

  /* key ຂອງ checklist ທີ່ຖືວ່າເປັນຄວາມຮັບຜິດຊອບສ່ວນຕົວ (ການແຕ່ງກາຍ + ຄວາມສະອາດ) */
  function selfCheckKeys() {
    const out = new Set();
    CONFIG.selfCheckSections.forEach(i => {
      const sec = CONFIG.checklist[i];
      if (sec) sec.items.forEach(it => out.add(it.key));
    });
    return out;
  }

  /* ================= ການຄິດ =================
   * ຄືນຄ່າ: [{ staff, full, deducted, paid, pct, lines:[{rule, count, amount, total, refs}] }]
   * refs = ລາຍການອ້າງອີງ {shiftId, date, text} ເພື່ອໃຫ້ກົດເຂົ້າໄປເບິ່ງກະຕົ້ນທາງໄດ້
   */
  async function month(ym, branch) {
    ym = ym || thisMonth();
    const [shifts, cash, temps, checks, photos, issues, adjs] = await Promise.all([
      DB.all('shifts'), DB.all('cash'), DB.all('temps'),
      DB.all('checks'), DB.all('photos'), DB.all('issues'), DB.all('bonusAdj')
    ]);

    const inMonth = shifts.filter(s =>
      s.status !== 'cancelled' &&
      monthOf(s.date || s.openedAt) === ym &&
      (!branch || s.branch === branch));

    const byId = new Map(inMonth.map(s => [s.id, s]));
    const mine = id => byId.get(id);
    const today = U.today();
    const selfKeys = selfCheckKeys();
    const limit = S.settings.cashVarianceLimit;

    /* ລວບລວມເຫດການທັງໝົດເປັນແຖວດຽວກັນກ່ອນ ແລ້ວຄ່ອຍແຍກຕາມຄົນ */
    const events = [];   /* {name, key, text, shiftId, date} */
    const add = (sh, key, text) => events.push({
      name: sh.staff, key, text, shiftId: sh.id, date: sh.date
    });

    inMonth.forEach(sh => {
      if (sh.lateBy > 0) add(sh, 'late', 'ຊ້າ ' + sh.lateBy + ' ນາທີ');
      if (sh.earlyBy > 0) add(sh, 'earlyOut', 'ອອກກ່ອນ ' + sh.earlyBy + ' ນາທີ');
      if (sh.status === 'open' && sh.date < today) add(sh, 'noClose', 'ກະວັນທີ ' + sh.date + ' ຍັງເປີດຢູ່');
    });

    cash.forEach(c => {
      const sh = mine(c.shiftId); if (!sh) return;
      if (Math.abs(c.variance) > limit) add(sh, 'cashVar', 'ສ່ວນຕ່າງ ' + U.kip(c.variance) + ' ກີບ');
    });

    temps.forEach(t => {
      const sh = mine(t.shiftId); if (!sh) return;
      if (t.min !== null && t.celsius !== null && (t.celsius < t.min || t.celsius > t.max))
        add(sh, 'tempOut', t.label + ' ' + t.celsius + '°C');
    });

    photos.forEach(p => {
      const sh = mine(p.shiftId); if (!sh) return;
      if (p.source && p.source !== 'camera') add(sh, 'photoFb', p.label || p.checkpoint);
    });

    checks.forEach(c => {
      const sh = mine(c.shiftId); if (!sh) return;
      if (c.form === 'checklist' && c.ok === false && selfKeys.has(c.itemKey))
        add(sh, 'selfCheck', c.label || c.itemKey);
    });

    issues.forEach(i => {
      if (!i.owner) return;
      if (i.status === 'ແກ້ແລ້ວ') return;
      if (!i.due || i.due >= today) return;
      if (branch && i.branch !== branch) return;
      if (monthOf(i.date || i.ts) !== ym) return;
      events.push({ name: i.owner, key: 'issueDue', text: i.text,
                    shiftId: i.shiftId || null, date: i.date || '' });
    });

    /* ການຫັກທີ່ຜູ້ຈັດການບັນທຶກເອງ (ເຊັ່ນ ບໍ່ມາເຮັດວຽກ) */
    adjs.filter(a => a.month === ym && (!branch || !a.branch || a.branch === branch))
        .forEach(a => events.push({
          name: a.staffName, key: a.ruleKey, text: a.note || '', date: a.date || '',
          shiftId: null, manual: true, amountOverride: a.amount
        }));

    /* ແຍກຕາມຄົນ — ເອົາທຸກຄົນໃນລາຍຊື່ ເຖິງຍັງບໍ່ມີເຫດການກໍ່ຕາມ */
    const names = new Set(roster().map(s => s.name));
    events.forEach(e => names.add(e.name));
    inMonth.forEach(s => names.add(s.staff));

    const rows = [...names].filter(Boolean).map(name => {
      const staff = staffByName(name);
      const full = fullFor(staff) || 0;
      const own = events.filter(e => e.name === name);

      const lines = CONFIG.bonusRules.map(r => {
        const hits = own.filter(e => e.key === r.key);
        if (!hits.length) return null;
        const total = hits.reduce((sum, e) =>
          sum + (e.amountOverride != null ? e.amountOverride : amountOf(r.key)), 0);
        return { rule: r, count: hits.length, amount: amountOf(r.key), total, refs: hits };
      }).filter(Boolean).sort((a, b) => b.total - a.total);

      const rawDeducted = lines.reduce((s, l) => s + l.total, 0);
      const deducted = Math.min(full, rawDeducted);
      const shiftCount = inMonth.filter(s => s.staff === name).length;
      return {
        staff, name, full,
        rawDeducted, capped: rawDeducted > full,
        deducted,
        paid: Math.max(0, full - deducted),
        pct: full ? Math.round((full - deducted) / full * 100) : 0,
        lines, shiftCount
      };
    });

    /* ຄົນທີ່ຖືກຫັກຫຼາຍສຸດຢູ່ເທິງ ຈະໄດ້ເຫັນກ່ອນ */
    rows.sort((a, b) => b.deducted - a.deducted || a.name.localeCompare(b.name));
    return rows;
  }

  /* ເດືອນທີ່ມີຂໍ້ມູນຈິງ ໃໝ່ສຸດຢູ່ໜ້າ */
  async function monthsAvailable() {
    const shifts = await DB.all('shifts');
    const set = new Set(shifts.filter(s => s.status !== 'cancelled')
                              .map(s => monthOf(s.date || s.openedAt)));
    set.add(thisMonth());
    return [...set].filter(Boolean).sort().reverse();
  }

  /* ໃຜກໍາລັງຢູ່ໃນຮ້ານຕອນນີ້ — ກະທີ່ເຊັກອິນແລ້ວແຕ່ຍັງບໍ່ເຊັກເອົາ */
  async function onDuty() {
    const shifts = await DB.all('shifts');
    return shifts.filter(s => s.status === 'open')
                 .sort((a, b) => (a.openedAt || '').localeCompare(b.openedAt || ''));
  }

  return { month, monthsAvailable, onDuty, roster, staffByName, amountOf, fullFor, thisMonth, monthOf };
})();
