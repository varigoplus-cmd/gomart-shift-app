/* ໜ້າຈໍ: ສິນຄ້າ · ບັນຫາ · ລາຍງານ · ຕັ້ງຄ່າ */

/* ---------- ສິນຄ້າ (ເມນູ) ---------- */
SCREENS.stock = async function () {
  const sh = S.shift;
  const rows = sh ? await DB.by('stock', 'shiftId', sh.id) : [];
  const nNear = rows.filter(r => r.kind === 'nearout').length;
  const nExp = rows.filter(r => r.kind === 'expired').length;
  /* ຍັງບໍ່ໄດ້ເປີດກະ — ລາຍການຕ້ອງກົດບໍ່ໄດ້ ແລະ ມີທາງໄປຕໍ່ */
  if (!sh) {
    return render('ສິນຄ້າ', 'ຍັງບໍ່ໄດ້ເປີດກະ', [
      card([
        h('div', { class: 'note', text: 'ຕ້ອງເປີດກະກ່ອນ ຈຶ່ງຈະບັນທຶກລາຍການສິນຄ້າໄດ້' }),
        btn('ໄປເປີດກະ', () => go('home'), 'primary')
      ]),
      card([
        taskRow('ສິນຄ້າໃກ້ໝົດ (ສັ່ງຊື້)', false, null, '', { disabled: true }),
        taskRow('ສິນຄ້າໝົດອາຍຸ / ເສຍຫາຍ', false, null, '', { disabled: true }),
        taskRow('ກວດນັບໂຊນສິນຄ້າ', false, null, '', { disabled: true })
      ], 'tasks')
    ]);
  }

  render('ສິນຄ້າ', sh.branch, [
    card([
      taskRow('ສິນຄ້າໃກ້ໝົດ (ສັ່ງຊື້)', nNear > 0, () => go('nearout'), `${nNear} ລາຍການ`),
      taskRow('ສິນຄ້າໝົດອາຍຸ / ເສຍຫາຍ', nExp > 0, () => go('expired'), `${nExp} ລາຍການ`),
      taskRow('ກວດນັບໂຊນສິນຄ້າ', false, () => go('zone'))
    ], 'tasks')
  ]);
};

/* ---------- ສິນຄ້າໃກ້ໝົດ ---------- */
SCREENS.nearout = async function () {
  const sh = S.shift; if (!sh) return go('stock');
  const rows = (await DB.by('stock', 'shiftId', sh.id)).filter(r => r.kind === 'nearout');
  const f = { name: '', qty: '', rop: '', order: '', checkedStore: false };

  const list = rows.length ? card(rows.map(r => h('div', { class: 'li', 'data-ui': 'content' }, [
    h('div', { class: 'li-m' }, [
      h('b', { text: r.name }),
      h('small', { text: `ເຫຼືອ ${r.qty} · ROP ${r.rop || '—'} · ສັ່ງ ${r.order || '—'}${r.checkedStore ? ' · ກວດສາງແລ້ວ' : ''}` })
    ]),
    h('button', { class: 'x', text: '✕', onclick: async () => { await DB.del('stock', r.id); go('nearout'); } })
  ])), 'tasks') : card([h('div', { class: 'note', text: 'ຍັງບໍ່ມີລາຍການ' })]);

  const nameIn = input({ placeholder: 'ຊື່ສິນຄ້າ', oninput: e => f.name = e.target.value });
  const qtyIn = input({ type: 'number', placeholder: 'ຈໍານວນຄົງເຫຼືອ', oninput: e => f.qty = e.target.value });
  const ropIn = input({ type: 'number', placeholder: 'ຈຸດສັ່ງຊື້ (ROP)', oninput: e => f.rop = e.target.value });
  const ordIn = input({ type: 'number', placeholder: 'ຈໍານວນທີ່ຕ້ອງສັ່ງ', oninput: e => f.order = e.target.value });
  const chk = h('input', { type: 'checkbox', onchange: e => f.checkedStore = e.target.checked });

  render('ສິນຄ້າໃກ້ໝົດ', `${rows.length} ລາຍການ`, [
    card([
      h('h3', { class: 'ttl', text: 'ເພີ່ມລາຍການ' }),
      rowLabel('ຊື່ສິນຄ້າ', nameIn),
      rowLabel('ຈໍານວນຄົງເຫຼືອ', qtyIn),
      rowLabel('ຈຸດສັ່ງຊື້ (ROP)', ropIn),
      rowLabel('ຈໍານວນທີ່ຕ້ອງສັ່ງ', ordIn),
      h('label', { class: 'cbrow' }, [chk, h('span', { text: 'ກວດຈໍານວນຈິງໃນສາງແລ້ວ' })]),
      btn('ເພີ່ມ', async () => {
        if (!f.name.trim()) return U.toast('ໃສ່ຊື່ສິນຄ້າ', 'err');
        if (!f.checkedStore) return U.toast('ຕ້ອງກວດຈໍານວນຈິງໃນສາງກ່ອນ', 'err');
        await DB.put('stock', {
          shiftId: sh.id, kind: 'nearout', branch: sh.branch, date: sh.date, staff: sh.staff,
          name: f.name.trim(), qty: U.num(f.qty), rop: U.num(f.rop), order: U.num(f.order),
          checkedStore: true, status: 'ລໍຖ້າສັ່ງ', ts: new Date().toISOString()
        });
        U.toast('ເພີ່ມແລ້ວ'); go('nearout');
      }, 'primary')
    ]),
    list,
    card([btn('ກັບ', () => go('stock'), 'ghost')])
  ]);
};

/* ---------- ສິນຄ້າໝົດອາຍຸ / ເສຍຫາຍ ---------- */
SCREENS.expired = async function () {
  const sh = S.shift; if (!sh) return go('stock');
  const rows = (await DB.by('stock', 'shiftId', sh.id)).filter(r => r.kind === 'expired');
  const total = rows.reduce((s, r) => s + r.value, 0);
  const f = { name: '', barcode: '', qty: '', unit: '', expiry: '', price: '', action: '' };

  const list = rows.length ? card(rows.map(r => h('div', { class: 'li', 'data-ui': 'content' }, [
    h('div', { class: 'li-m' }, [
      h('b', { text: r.name }),
      h('small', { text: `${r.qty} ${r.unit || ''} · ໝົດອາຍຸ ${r.expiry || '—'} · ມູນຄ່າ ${U.kip(r.value)} ກີບ · ${r.actionLabel}` })
    ]),
    h('button', { class: 'x', text: '✕', onclick: async () => { await DB.del('stock', r.id); go('expired'); } })
  ])), 'tasks') : card([h('div', { class: 'note', text: 'ຍັງບໍ່ມີລາຍການ' })]);

  render('ສິນຄ້າໝົດອາຍຸ / ເສຍຫາຍ', `ມູນຄ່າລວມ ${U.kip(total)} ກີບ`, [
    card([
      h('h3', { class: 'ttl', text: 'ເພີ່ມລາຍການ' }),
      rowLabel('ຊື່ສິນຄ້າ', input({ oninput: e => f.name = e.target.value })),
      rowLabel('ບາໂຄດ / ລະຫັດ', input({ oninput: e => f.barcode = e.target.value })),
      rowLabel('ຈໍານວນ', input({ type: 'number', oninput: e => f.qty = e.target.value })),
      rowLabel('ຫົວໜ່ວຍ', input({ placeholder: 'ອັນ / ຂວດ / ຖົງ', oninput: e => f.unit = e.target.value })),
      rowLabel('ວັນໝົດອາຍຸ', input({ type: 'date', oninput: e => f.expiry = e.target.value })),
      rowLabel('ລາຄາຕໍ່ຫົວໜ່ວຍ (ກີບ)', input({ type: 'number', oninput: e => f.price = e.target.value })),
      rowLabel('ການຈັດການ', select(['— ເລືອກ —', ...CONFIG.disposalActions.map(a => `${a.code}. ${a.label}`)],
                                   '', e => f.action = e.target.value)),
      btn('ເພີ່ມ', async () => {
        if (!f.name.trim()) return U.toast('ໃສ່ຊື່ສິນຄ້າ', 'err');
        if (!f.action || f.action.startsWith('—')) return U.toast('ເລືອກວິທີຈັດການ', 'err');
        const value = U.num(f.qty) * U.num(f.price);
        const daysLeft = f.expiry ? Math.round((new Date(f.expiry) - new Date()) / 86400000) : null;
        await DB.put('stock', {
          shiftId: sh.id, kind: 'expired', branch: sh.branch, date: sh.date, staff: sh.staff,
          name: f.name.trim(), barcode: f.barcode, qty: U.num(f.qty), unit: f.unit,
          expiry: f.expiry, daysLeft, price: U.num(f.price), value,
          actionCode: U.num(f.action), actionLabel: f.action, ts: new Date().toISOString()
        });
        U.toast('ເພີ່ມແລ້ວ'); go('expired');
      }, 'primary')
    ]),
    list,
    card([btn('ກັບ', () => go('stock'), 'ghost')])
  ]);
};

/* ---------- ລາຍລະອຽດກະທີ່ປິດແລ້ວ ---------- */
SCREENS.shiftDetail = async function (shiftId) {
  const sh = await DB.get('shifts', shiftId);
  if (!sh) return go('report');
  const [cashRows, temps, checks, photos, issues, stock] = await Promise.all([
    DB.by('cash', 'shiftId', sh.id), DB.by('temps', 'shiftId', sh.id),
    DB.by('checks', 'shiftId', sh.id), DB.by('photos', 'shiftId', sh.id),
    DB.by('issues', 'shiftId', sh.id), DB.by('stock', 'shiftId', sh.id)
  ]);
  const c = cashRows[0];
  const def = shiftDef(sh.shiftKey);
  const outOfRange = temps.filter(t => t.min !== null && t.celsius !== null && (t.celsius < t.min || t.celsius > t.max));
  const failed = checks.filter(k => !k.ok);

  const line = (label, value, cls = '') => h('div', { class: 'vrow ' + cls },
    [h('span', { text: label }), h('b', { text: value })]);
  /* ແຖວເຕືອນໃຊ້ສີແດງ */

  const body = [
    card([
      h('div', { class: 'big', text: sh.branch }),
      h('div', { class: 'muted', text: `${def.label} · ${sh.date} · ${sh.staff}` }),
      h('div', { class: 'muted', text: 'ເປີດ ' + U.stamp(sh.openedAt) + (sh.closedAt ? ' · ປິດ ' + U.stamp(sh.closedAt) : '') }),
      sh.lateBy ? h('div', { class: 'warn', text: `⚠ ເປີດກະຊ້າ ${sh.lateBy} ນາທີ` }) : null
    ]),

    h('h3', { class: 'sec', text: 'ເງິນສົດ' }),
    c ? card([
      line('A. ເງິນທອນຕັ້ງຕົ້ນ', U.kip(c.float)),
      line('B. ຍອດຂາຍເງິນສົດ (POS)', U.kip(c.posCash)),
      line('C. ຄວນມີ (A+B)', U.kip(c.expected)),
      line('D. ນັບໄດ້ຈິງ', U.kip(c.counted)),
      line('E. ສ່ວນຕ່າງ', U.kip(c.variance), 'big-v'),
      c.reason ? h('div', { class: 'muted', text: 'ສາເຫດ: ' + c.reason + ' ' + (c.reasonNote || '') }) : null,
      c.manager ? h('div', { class: 'muted', text: 'ຜູ້ຈັດການທີ່ຮັບແຈ້ງ: ' + c.manager }) : null,
      c.correctedBy ? h('div', { class: 'warn', text: `ແກ້ໄຂໂດຍ ${c.correctedBy} ເມື່ອ ${U.stamp(c.correctedAt)} · ສ່ວນຕ່າງເດີມ ${U.kip(c.previousVariance)} ກີບ` }) : null,
      btn('ແກ້ໄຂຍອດ POS', () => correctCash(sh, c), 'ghost')
    ]) : card([h('div', { class: 'note', text: 'ກະນີ້ບໍ່ມີຂໍ້ມູນເງິນສົດ' })]),

    h('h3', { class: 'sec', text: 'ສະຫຼຸບ' }),
    card([
      line('ລາຍການກວດທີ່ບໍ່ຜ່ານ', String(failed.length)),
      line('ອຸນຫະພູມນອກເກນ', String(outOfRange.length)),
      line('ຮູບຖ່າຍ', photos.length + ' ໃບ'),
      (() => { const n = photos.filter(x => x.source && x.source !== 'camera').length;
               return n ? line('ຮູບທີ່ບໍ່ໄດ້ຜ່ານກ້ອງໃນແອັບ', String(n), 'bad-line') : null; })(),
      line('ບັນຫາທີ່ແຈ້ງ', String(issues.length)),
      line('ລາຍການສິນຄ້າ', String(stock.length))
    ]),

    outOfRange.length ? h('h3', { class: 'sec', text: 'ອຸນຫະພູມນອກເກນ' }) : null,
    outOfRange.length ? card(outOfRange.map(t => h('div', { class: 'li', 'data-ui': 'content' }, [
      h('div', { class: 'li-m' }, [h('b', { text: t.label }),
        h('small', { text: `ຮອບ ${t.round} · ວັດໄດ້ ${t.celsius}°C · ເກນ ${t.min} ຫາ ${t.max}°C` })]),
      h('span', { class: 'pill bad', text: 'ນອກເກນ' })
    ])), 'tasks') : null,

    failed.length ? h('h3', { class: 'sec', text: 'ລາຍການທີ່ບໍ່ຜ່ານ' }) : null,
    failed.length ? card(failed.map(k => h('div', { class: 'li', 'data-ui': 'content' }, [
      h('div', { class: 'li-m' }, [h('b', { text: k.label }),
        h('small', { text: (k.zone ? 'ໂຊນ ' + k.zone + ' · ' : '') + (k.note || '—') })])
    ])), 'tasks') : null,

    card([btn('ກັບໜ້າລາຍງານ', () => go('report'), 'ghost')])
  ];
  render('ລາຍລະອຽດກະ', sh.date + ' · ' + def.label, body);
};

/* ແກ້ຍອດ POS ຫຼັງປິດກະ — ຕ້ອງບອກວ່າໃຜແກ້ ແລະ ເກັບຄ່າເດີມໄວ້ */
async function correctCash(sh, c) {
  let posCash = c.posCash, who = '';
  const out = h('b', { text: U.kip(c.variance) });
  const recalc = () => {
    const v = c.counted - (c.float + U.num(posCash));
    out.textContent = U.kip(v);
    return v;
  };
  const sheet = await new Promise(resolve => {
    const wrap = h('div', { class: 'sheet-wrap' }, [
      h('div', { class: 'sheet' }, [
        h('h3', { class: 'sheet-t', text: 'ແກ້ໄຂຍອດຂາຍເງິນສົດ (POS)' }),
        h('p', { class: 'sheet-l', text: 'ໃຊ້ເມື່ອພິມຍອດຈາກ POS ຜິດ ເງິນສົດທີ່ນັບໄດ້ຈະບໍ່ປ່ຽນ' }),
        rowLabel('B. ຍອດຂາຍເງິນສົດ (ກີບ)',
          input({ type: 'number', value: posCash, oninput: e => { posCash = e.target.value; recalc(); } })),
        h('div', { class: 'vrow big-v' }, [h('span', { text: 'ສ່ວນຕ່າງໃໝ່' }), out]),
        rowLabel('ຊື່ຜູ້ແກ້ໄຂ', input({ oninput: e => who = e.target.value })),
        h('div', { class: 'sheet-b' }, [
          h('button', { class: 'btn ghost', onclick: () => { wrap.remove(); resolve(false); } }, 'ຍົກເລີກ'),
          h('button', {
            class: 'btn primary', onclick: () => {
              if (!who.trim()) return U.toast('ຕ້ອງໃສ່ຊື່ຜູ້ແກ້ໄຂ', 'err');
              wrap.remove(); resolve(true);
            }
          }, 'ບັນທຶກການແກ້ໄຂ')
        ])
      ])
    ]);
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
  });
  if (!sheet) return;
  const v = recalc();
  await DB.put('cash', {
    ...c, posCash: U.num(posCash), expected: c.float + U.num(posCash), variance: v,
    previousVariance: c.previousVariance !== undefined ? c.previousVariance : c.variance,
    correctedBy: who.trim(), correctedAt: new Date().toISOString()
  });
  await DB.put('issues', {
    shiftId: sh.id, branch: sh.branch, date: sh.date,
    text: `ແກ້ໄຂຍອດ POS ຫຼັງປິດກະ: ສ່ວນຕ່າງ ${U.kip(c.variance)} → ${U.kip(v)} ກີບ`,
    owner: who.trim(), due: '', status: 'ແກ້ແລ້ວ',
    createdAt: new Date().toISOString(), closedAt: new Date().toISOString(), createdBy: who.trim()
  });
  U.toast('ບັນທຶກການແກ້ໄຂແລ້ວ');
  go('shiftDetail', sh.id);
}

/* ---------- ບັນຫາ ---------- */
SCREENS.issues = async function () {
  const all = (await DB.all('issues')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = all.filter(i => i.status !== 'ແກ້ແລ້ວ');
  const closed = all.filter(i => i.status === 'ແກ້ແລ້ວ');

  const item = (i) => h('div', { class: 'issue ' + (i.status === 'ແກ້ແລ້ວ' ? 'done' : '') }, [
    h('div', { class: 'issue-t', text: i.text }),
    h('div', { class: 'issue-m', text: `${i.branch} · ${i.date} · ${i.createdBy || ''}` }),
    h('div', { class: 'issue-f' }, [
      h('label', { class: 'ilabel' }, [
        h('span', { text: 'ຜູ້ຮັບຜິດຊອບ' }),
        input({ placeholder: 'ຊື່', value: i.owner || '', oninput: e => i.owner = e.target.value })
      ]),
      h('label', { class: 'ilabel' }, [
        h('span', { text: 'ກໍານົດແລ້ວເສັດ' }),
        input({ type: 'date', value: i.due || '', oninput: e => i.due = e.target.value })
      ]),
      select(CONFIG.issueStatuses, i.status, e => i.status = e.target.value),
      btn('ບັນທຶກ', async () => {
        if (i.status === 'ແກ້ແລ້ວ' && !i.closedAt) i.closedAt = new Date().toISOString();
        if (i.status !== 'ແກ້ແລ້ວ') i.closedAt = null;
        await DB.put('issues', i); U.toast('ບັນທຶກແລ້ວ'); go('issues');
      }, 'sm')
    ])
  ]);

  render('ຕິດຕາມບັນຫາ', `ຍັງບໍ່ແກ້ ${open.length} ລາຍການ`, [
    card([btn('+ ແຈ້ງບັນຫາໃໝ່', () => go('issueNew'), 'primary')]),
    open.length ? h('h3', { class: 'sec', text: 'ຍັງບໍ່ແກ້' }) : null,
    open.length ? card(open.map(item)) : card([h('div', { class: 'note', text: 'ບໍ່ມີບັນຫາຄ້າງ' })]),
    closed.length ? h('h3', { class: 'sec', text: 'ແກ້ແລ້ວ' }) : null,
    closed.length ? card(closed.slice(0, 20).map(item)) : null
  ]);
};

SCREENS.issueNew = async function () {
  const sh = S.shift;
  let text = '', owner = '', due = '';
  render('ແຈ້ງບັນຫາ', sh ? sh.branch : '', [
    card([
      rowLabel('ບັນຫາທີ່ພົບ', h('textarea', { class: 'in', rows: '3', oninput: e => text = e.target.value })),
      rowLabel('ຜູ້ຮັບຜິດຊອບແກ້ໄຂ', input({ oninput: e => owner = e.target.value })),
      rowLabel('ກໍານົດແລ້ວເສັດ', input({ type: 'date', oninput: e => due = e.target.value })),
      btn('ບັນທຶກ', async () => {
        if (!text.trim()) return U.toast('ໃສ່ລາຍລະອຽດບັນຫາ', 'err');
        await DB.put('issues', {
          shiftId: sh ? sh.id : null, branch: sh ? sh.branch : S.settings.branches[0],
          date: U.today(), text: text.trim(), owner, due, status: 'ເປີດ',
          createdAt: new Date().toISOString(), createdBy: sh ? sh.staff : ''
        });
        U.toast('ແຈ້ງແລ້ວ'); go('issues');
      }, 'primary big-btn'),
      btn('ກັບ', () => go('issues'), 'ghost')
    ])
  ]);
};

/* ---------- ລາຍງານ / Dashboard ---------- */
SCREENS.report = async function (branchFilter) {
  const [shifts, cash, issues, temps, stock] = await Promise.all([
    DB.all('shifts'), DB.all('cash'), DB.all('issues'), DB.all('temps'), DB.all('stock')
  ]);
  /* ກະທີ່ຖືກລຶບບໍ່ນັບເຂົ້າສະຖິຕິ */
  const all = shifts.filter(s => s.status !== 'cancelled');

  /* ຊິບສາຂາ — ສະແດງສະເພາະສາຂາທີ່ມີຂໍ້ມູນຈິງ (ບໍ່ໂຊວ໌ເລກ 0) */
  const branches = [...new Set(all.map(s => s.branch))].sort();
  const pick = branchFilter && branches.includes(branchFilter) ? branchFilter : null;
  const live = pick ? all.filter(s => s.branch === pick) : all;

  const last30 = live.filter(s => (new Date() - new Date(s.openedAt)) < 30 * 86400000);
  const closed = last30.filter(s => s.status === 'closed');
  const ids = new Set(last30.map(s => s.id));
  const cashIn = cash.filter(c => ids.has(c.shiftId));

  const sumVar = cashIn.reduce((s, c) => s + c.variance, 0);
  const absVar = cashIn.reduce((s, c) => s + Math.abs(c.variance), 0);
  const overs = cashIn.filter(c => Math.abs(c.variance) > S.settings.cashVarianceLimit);
  const lateCount = last30.filter(s => s.lateBy > 0).length;
  const openIssues = issues.filter(i => i.status !== 'ແກ້ແລ້ວ' && (!pick || i.branch === pick)).length;
  const outOfRange = temps.filter(t => ids.has(t.shiftId) && t.min !== null && t.celsius !== null
                                    && (t.celsius < t.min || t.celsius > t.max)).length;
  const lossValue = stock.filter(r => r.kind === 'expired' && (!pick || r.branch === pick))
                         .reduce((s, r) => s + r.value, 0);

  const stat = (label, value, extra, cls = '') => h('div', { class: 'stat ' + cls }, [
    h('div', { class: 'stat-v', text: value }),
    h('div', { class: 'stat-l', text: label }),
    extra ? h('div', { class: 'stat-x', text: extra }) : null
  ]);

  const chips = branches.length > 1
    ? h('div', { class: 'chips' }, [
        h('button', { class: 'chip' + (pick ? '' : ' on'), 'data-ui': 'chip',
                      onclick: () => go('report') }, 'ທຸກສາຂາ'),
        ...branches.map(b => h('button', {
          class: 'chip' + (pick === b ? ' on' : ''), 'data-ui': 'chip',
          onclick: () => go('report', b)
        }, b))
      ])
    : null;

  const recent = live.slice(-12).reverse().map(s => {
    const c = cash.find(x => x.shiftId === s.id);
    const v = c ? c.variance : null;
    const open = s.status === 'open';
    return h('button', { class: 'li li-tap', 'data-ui': 'content',
                         onclick: () => go('shiftDetail', s.id) }, [
      h('div', { class: 'li-m' }, [
        h('b', { text: `${s.date} · ${shiftDef(s.shiftKey).label}${pick ? '' : ' · ' + s.branch}` }),
        h('small', { text: `${s.staff}${open ? ' · ຍັງບໍ່ປິດກະ' : ''}${s.lateBy ? ' · ຊ້າ ' + s.lateBy + ' ນາທີ' : ''}` })
      ]),
      h('span', {
        class: 'pill ' + (v === null ? 'todo' : Math.abs(v) > S.settings.cashVarianceLimit ? 'bad' : 'ok'),
        /* ສູນ = ນັບເງິນຕົງເປັນສິ່ງທີ່ດີ ບອກເປັນຄໍາຈະເຂົ້າໃຈກວ່າເລກ 0 */
        text: v === null ? '—' : (v === 0 ? 'ກົງ' : U.kip(v))
      })
    ]);
  });

  render('ລາຍງານ', (pick || 'ທຸກສາຂາ') + ' · 30 ມື້ຜ່ານມາ', [
    chips,
    /* ກະຕິກາ 4: ຕົວເລກບໍ່ເກີນ 6 ຊ່ອງ */
    h('div', { class: 'stats', 'data-ui': 'content' }, [
      stat('ກະທີ່ປິດແລ້ວ', `${closed.length}/${last30.length}`,
           last30.length ? Math.round(closed.length / last30.length * 100) + '%' : ''),
      stat('ສ່ວນຕ່າງສະສົມ (ກີບ)', U.kip(sumVar), 'ສົມບູນ ' + U.kip(absVar),
           Math.abs(sumVar) > S.settings.cashVarianceLimit ? 'bad' : ''),
      stat('ກະທີ່ເງິນຜິດແຮງ', String(overs.length),
           'ເກີນ ' + U.kip(S.settings.cashVarianceLimit) + ' ກີບ', overs.length ? 'bad' : ''),
      stat('ເປີດກະຊ້າ', String(lateCount),
           'ເກີນ ' + S.settings.lateMinutes + ' ນາທີ', lateCount ? 'bad' : ''),
      stat('ອຸນຫະພູມນອກເກນ', String(outOfRange), '', outOfRange ? 'bad' : ''),
      stat('ບັນຫາຍັງບໍ່ແກ້', String(openIssues), '', openIssues ? 'bad' : '')
    ]),
    lossValue ? card([h('div', { class: 'vrow' },
      [h('span', { text: 'ມູນຄ່າສິນຄ້າເສຍຫາຍ' }), h('b', { text: U.kip(lossValue) + ' ກີບ' })])]) : null,

    h('h3', { class: 'sec', text: 'ກະລ່າສຸດ' }),
    recent.length
      ? card(recent, 'tasks')
      : card([
          h('div', { class: 'note', text: 'ຍັງບໍ່ມີກະໃນຊ່ວງນີ້' }),
          btn('ໄປເປີດກະ', () => go('home'), 'primary')
        ]),

    h('h3', { class: 'sec', text: 'ສົ່ງອອກຂໍ້ມູນ' }),
    card([
      h('div', { class: 'muted', text: 'ໄຟລ໌ CSV ມີຖັນສາຂາຄົບທຸກຊຸດ ເປີດດ້ວຍ Excel ໄດ້' }),
      btn('ສົ່ງອອກ ກະ + ເງິນສົດ', exportShifts, 'primary', 'ກຳລັງສົ່ງອອກ…'),
      btn('ສົ່ງອອກ ອຸນຫະພູມ', exportTemps, 'ghost', 'ກຳລັງສົ່ງອອກ…'),
      btn('ສົ່ງອອກ ບັນຫາ', exportIssues, 'ghost', 'ກຳລັງສົ່ງອອກ…'),
      btn('ສົ່ງອອກ ສິນຄ້າ', exportStock, 'ghost', 'ກຳລັງສົ່ງອອກ…'),
      btn('ດາວໂຫຼດຮູບທັງໝົດ', exportPhotos, 'ghost', 'ກຳລັງດາວໂຫຼດ…')
    ])
  ]);
};

async function exportShifts() {
  const [shifts, cash] = await Promise.all([DB.all('shifts'), DB.all('cash')]);
  const rows = [['ວັນທີ', 'ສາຂາ', 'ກະ', 'ພະນັກງານ', 'ເປີດເວລາ', 'ຊ້າ(ນາທີ)', 'ປິດເວລາ', 'ສະຖານະ',
                 'ເງິນທອນຕັ້ງຕົ້ນ', 'ຍອດເງິນສົດPOS', 'ເງິນສົດນັບໄດ້', 'ຄວນມີ', 'ສ່ວນຕ່າງ',
                 'ຍອດລວມPOS', 'QR/ໂອນ', 'ອື່ນໆ', 'ຈໍານວນບິນ', 'ບິນຍົກເລີກ', 'ສາເຫດສ່ວນຕ່າງ', 'ຜູ້ຈັດການ']];
  shifts.forEach(s => {
    const c = cash.find(x => x.shiftId === s.id) || {};
    rows.push([s.date, s.branch, shiftDef(s.shiftKey).label, s.staff, U.stamp(s.openedAt), s.lateBy || 0,
               s.closedAt ? U.stamp(s.closedAt) : '', s.status, s.float ?? '',
               c.posCash ?? '', c.counted ?? '', c.expected ?? '', c.variance ?? '',
               c.posTotal ?? '', c.posQr ?? '', c.posOther ?? '', c.bills ?? '', c.voided ?? '',
               [c.reason, c.reasonNote].filter(Boolean).join(' - '), c.manager ?? '']);
  });
  U.downloadCsv(rows, `gomart_shifts_${U.today()}.csv`);
}

async function exportTemps() {
  const [temps, shifts] = await Promise.all([DB.all('temps'), DB.all('shifts')]);
  const rows = [['ວັນທີ', 'ສາຂາ', 'ກະ', 'ຮອບ', 'ເຄື່ອງ', 'ອຸນຫະພູມ', 'ເກນຕໍ່າ', 'ເກນສູງ', 'ນອກເກນ', 'ສະພາບ', 'ໝາຍເຫດ', 'ເວລາ']];
  temps.forEach(t => {
    const s = shifts.find(x => x.id === t.shiftId) || {};
    const bad = t.min !== null && t.celsius !== null && (t.celsius < t.min || t.celsius > t.max);
    rows.push([s.date || '', s.branch || '', s.shiftKey ? shiftDef(s.shiftKey).label : '', t.round,
               t.label, t.celsius ?? '', t.min ?? '', t.max ?? '', bad ? 'ແມ່ນ' : '',
               t.condition ? 'ປົກກະຕິ' : 'ມີບັນຫາ', t.note, U.stamp(t.ts)]);
  });
  U.downloadCsv(rows, `gomart_temps_${U.today()}.csv`);
}

async function exportIssues() {
  const issues = await DB.all('issues');
  const rows = [['ວັນທີ', 'ສາຂາ', 'ບັນຫາ', 'ຜູ້ແຈ້ງ', 'ຜູ້ຮັບຜິດຊອບ', 'ກໍານົດແລ້ວເສັດ', 'ສະຖານະ', 'ປິດເມື່ອ']];
  issues.forEach(i => rows.push([i.date, i.branch, i.text, i.createdBy || '', i.owner || '',
                                 i.due || '', i.status, i.closedAt ? U.stamp(i.closedAt) : '']));
  U.downloadCsv(rows, `gomart_issues_${U.today()}.csv`);
}

async function exportStock() {
  const rows0 = await DB.all('stock');
  const rows = [['ປະເພດ', 'ວັນທີ', 'ສາຂາ', 'ພະນັກງານ', 'ຊື່ສິນຄ້າ', 'ບາໂຄດ', 'ຈໍານວນ', 'ຫົວໜ່ວຍ',
                 'ຄົງເຫຼືອ', 'ROP', 'ຕ້ອງສັ່ງ', 'ວັນໝົດອາຍຸ', 'ເຫຼືອ(ມື້)', 'ລາຄາ/ຫົວໜ່ວຍ', 'ມູນຄ່າເສຍຫາຍ', 'ການຈັດການ']];
  rows0.forEach(r => rows.push([
    r.kind === 'nearout' ? 'ໃກ້ໝົດ' : 'ໝົດອາຍຸ/ເສຍຫາຍ', r.date, r.branch, r.staff, r.name,
    r.barcode || '', r.qty ?? '', r.unit || '', r.kind === 'nearout' ? r.qty : '',
    r.rop ?? '', r.order ?? '', r.expiry || '', r.daysLeft ?? '', r.price ?? '', r.value ?? '', r.actionLabel || r.status || ''
  ]));
  U.downloadCsv(rows, `gomart_stock_${U.today()}.csv`);
}

async function exportPhotos() {
  const [photos, shifts] = await Promise.all([DB.all('photos'), DB.all('shifts')]);
  if (!photos.length) return U.toast('ຍັງບໍ່ມີຮູບ', 'err');
  if (!await U.confirmBox(`ດາວໂຫຼດ ${photos.length} ຮູບ? ບຣາວເຊີຈະຖາມອະນຸຍາດ`)) return;
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const s = shifts.find(x => x.id === p.shiftId) || {};
    const name = `${s.date || 'x'}_${(s.branch || '').replace(/\s/g, '')}_${p.phase}_${p.checkpoint}_${i + 1}.jpg`;
    U.download(p.blob, name);
    await new Promise(r => setTimeout(r, 350));
  }
  U.toast('ດາວໂຫຼດຄົບແລ້ວ');
}

/* ---------- ຕັ້ງຄ່າ ---------- */
SCREENS.config = async function () {
  const st = S.settings;
  const listEditor = (key, title, placeholder) => {
    const wrap = h('div', {});
    const redraw = () => {
      wrap.innerHTML = '';
      st[key].forEach((v, idx) => wrap.appendChild(h('div', { class: 'li', 'data-ui': 'content' }, [
        h('div', { class: 'li-m' }, [h('b', { text: v })]),
        h('button', {
          class: 'x', text: '✕', onclick: async () => {
            const next = st[key].filter((_, i) => i !== idx);
            await saveSetting(key, next); redraw();
          }
        })
      ])));
      let nv = '';
      const addId = 'add_' + key;
      wrap.appendChild(h('label', { class: 'flabel', for: addId, text: placeholder }));
      wrap.appendChild(h('div', { class: 'addrow' }, [
        input({ id: addId, placeholder, oninput: e => nv = e.target.value }),
        btn('+', async () => {
          if (!nv.trim()) return;
          await saveSetting(key, [...st[key], nv.trim()]); redraw();
        }, 'sm')
      ]));
    };
    redraw();
    return card([h('h3', { class: 'ttl', text: title }), wrap]);
  };

  render('ຕັ້ງຄ່າ', 'ລະບົບ v' + CONFIG.version, [
    listEditor('branches', 'ສາຂາ', 'ຊື່ສາຂາໃໝ່'),
    listEditor('zones', 'ໂຊນສິນຄ້າ', 'ຊື່ໂຊນໃໝ່'),
    listEditor('staff', 'ພະນັກງານ', 'ຊື່ພະນັກງານ'),
    card([
      h('h3', { class: 'ttl', text: 'ເກນ' }),
      rowLabel('ສ່ວນຕ່າງເງິນສົດທີ່ຍອມຮັບໄດ້ (ກີບ)',
        input({ type: 'number', value: st.cashVarianceLimit, onchange: e => saveSetting('cashVarianceLimit', U.num(e.target.value)) })),
      rowLabel('ຖືວ່າເປີດກະຊ້າເມື່ອເກີນ (ນາທີ)',
        input({ type: 'number', value: st.lateMinutes, onchange: e => saveSetting('lateMinutes', U.num(e.target.value)) })),
      rowLabel('ຈໍານວນໂຊນທີ່ຕ້ອງກວດຕໍ່ກະ',
        input({ type: 'number', value: st.zonesPerShift, onchange: e => saveSetting('zonesPerShift', U.num(e.target.value)) }))
    ]),
    card([
      h('h3', { class: 'ttl', text: 'ເວລາກະ' }),
      ...st.shifts.map((sdef, i) => h('div', { class: 'addrow' }, [
        h('span', { class: 'flabel', text: sdef.label }),
        input({ type: 'time', value: sdef.start, onchange: e => { st.shifts[i].start = e.target.value; saveSetting('shifts', st.shifts); } }),
        input({ type: 'time', value: sdef.end, onchange: e => { st.shifts[i].end = e.target.value; saveSetting('shifts', st.shifts); } })
      ]))
    ]),
    card([
      h('h3', { class: 'ttl', text: 'ໜ້າຕາ' }),
      h('div', { class: 'muted', text: 'ໂໝດມືດຊ່ວຍເວລາເຮັດກະກາງຄືນ ຕັ້ງແຍກຕໍ່ເຄື່ອງ' }),
      h('div', { class: 'chips', style: 'padding-top:12px' },
        [['auto', 'ຕາມເຄື່ອງ'], ['light', 'ສະຫວ່າງ'], ['dark', 'ມືດ']].map(([v, label]) =>
          h('button', {
            class: 'chip' + (U.theme() === v ? ' on' : ''), 'data-ui': 'chip',
            onclick: () => { U.theme(v); go('config'); }
          }, label)))
    ]),
    card([
      h('h3', { class: 'ttl', text: 'ຂໍ້ມູນ' }),
      btn('ສໍາຮອງຂໍ້ມູນທັງໝົດ (ໄຟລ໌ສໍາຮອງ)', backup, 'primary', 'ກຳລັງສໍາຮອງ…'),
      btn('ລຶບກະທີ່ຖືກລຶບໄວ້ ອອກຖາວອນ', purgeCancelled, 'ghost', 'ກຳລັງລຶບ…'),
      btn('ລຶບຂໍ້ມູນທັງໝົດ', async () => {
        const n = (await DB.all('shifts')).length;
        const ok = await confirmSheet({
          title: 'ລຶບຂໍ້ມູນທັງໝົດ?',
          lines: ['ຈະລຶບກະທັງໝົດ ' + n + ' ກະ ພ້ອມຮູບ ອຸນຫະພູມ ແລະ ຂໍ້ມູນເງິນສົດ',
                  'ກູ້ຄືນບໍ່ໄດ້ ແນະນໍາໃຫ້ກົດ "ສໍາຮອງຂໍ້ມູນ" ກ່ອນ'],
          confirmLabel: 'ລຶບທັງໝົດ', danger: true
        });
        if (!ok) return;
        await DB.wipeAll(); await loadSettings(); S.shift = null;
        U.toast('ລຶບແລ້ວ'); go('home');
      }, 'danger')
    ])
  ]);
};

/* ລຶບກະທີ່ຖືກລຶບໄວ້ອອກຈາກເຄື່ອງແທ້ໆ */
async function purgeCancelled() {
  const gone = (await DB.all('shifts')).filter(s => s.status === 'cancelled');
  if (!gone.length) return U.toast('ບໍ່ມີກະທີ່ຖືກລຶບໄວ້');
  const ok = await confirmSheet({
    title: 'ລຶບອອກຖາວອນ?',
    lines: ['ມີກະທີ່ຖືກລຶບໄວ້ ' + gone.length + ' ກະ', 'ລຶບແລ້ວກູ້ຄືນບໍ່ໄດ້ອີກ'],
    confirmLabel: 'ລຶບອອກຖາວອນ', danger: true
  });
  if (!ok) return;
  for (const sh of gone) {
    for (const st of ['checks', 'photos', 'temps', 'cash', 'stock', 'drafts']) {
      for (const r of await DB.by(st, 'shiftId', sh.id)) await DB.del(st, r.id);
    }
    await DB.del('shifts', sh.id);
  }
  U.toast('ລຶບ ' + gone.length + ' ກະອອກແລ້ວ');
  go('config');
}

async function backup() {
  const out = {};
  for (const s of ['settings', 'shifts', 'checks', 'temps', 'cash', 'issues', 'stock']) out[s] = await DB.all(s);
  const photos = await DB.all('photos');
  out.photos = photos.map(p => ({ ...p, blob: undefined, size: p.blob ? p.blob.size : 0 }));
  U.download(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }),
             `gomart_backup_${U.today()}.json`);
  U.toast('ສໍາຮອງແລ້ວ (ຮູບບໍ່ລວມ — ໃຊ້ປຸ່ມດາວໂຫຼດຮູບ)');
}
