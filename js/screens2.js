/* ໜ້າຈໍ: ບັນຫາ · ລາຍງານ · ເບີ້ຍຂະຫຍັນ · ຕັ້ງຄ່າ */

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
      line('B. ຍອດຂາຍເງິນສົດ (ເຄື່ອງຂາຍ)', U.kip(c.posCash)),
      line('C. ຄວນມີ (A+B)', U.kip(c.expected)),
      line('D. ນັບໄດ້ຈິງ', U.kip(c.counted)),
      line('E. ສ່ວນຕ່າງ', U.kip(c.variance), 'big-v'),
      c.reason ? h('div', { class: 'muted', text: 'ສາເຫດ: ' + c.reason + ' ' + (c.reasonNote || '') }) : null,
      c.manager ? h('div', { class: 'muted', text: 'ຜູ້ຈັດການທີ່ຮັບແຈ້ງ: ' + c.manager }) : null,
      c.correctedBy ? h('div', { class: 'warn', text: `ແກ້ໄຂໂດຍ ${c.correctedBy} ເມື່ອ ${U.stamp(c.correctedAt)} · ສ່ວນຕ່າງເດີມ ${U.kip(c.previousVariance)} ກີບ` }) : null,
      btn('ແກ້ໄຂຍອດເຄື່ອງຂາຍ', () => correctCash(sh, c), 'ghost')
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

/* ແກ້ຍອດເຄື່ອງຂາຍຫຼັງປິດກະ — ຕ້ອງບອກວ່າໃຜແກ້ ແລະ ເກັບຄ່າເດີມໄວ້ */
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
        h('h3', { class: 'sheet-t', text: 'ແກ້ໄຂຍອດຂາຍເງິນສົດ (ເຄື່ອງຂາຍ)' }),
        h('p', { class: 'sheet-l', text: 'ໃຊ້ເມື່ອພິມຍອດຈາກເຄື່ອງຂາຍຜິດ ເງິນສົດທີ່ນັບໄດ້ຈະບໍ່ປ່ຽນ' }),
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
    text: `ແກ້ໄຂຍອດເຄື່ອງຂາຍ ຫຼັງປິດກະ: ສ່ວນຕ່າງ ${U.kip(c.variance)} → ${U.kip(v)} ກີບ`,
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
  const [shifts, cash, issues, temps] = await Promise.all([
    DB.all('shifts'), DB.all('cash'), DB.all('issues'), DB.all('temps')
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

  /* ໃຜກໍາລັງຢູ່ໃນຮ້ານຕອນນີ້ — ເຊັກອິນແລ້ວຍັງບໍ່ເຊັກເອົາ */
  const duty = await BONUS.onDuty();
  const dutyCard = card([
    h('h3', { class: 'ttl', text: 'ກໍາລັງເຂົ້າວຽກຕອນນີ້' }),
    ...(duty.length
      ? duty.map(s2 => {
          const d2 = shiftDef(s2.shiftKey);
          const mins = Math.max(0, Math.round((new Date() - new Date(s2.openedAt)) / 60000));
          return h('div', { class: 'li', 'data-ui': 'content' }, [
            h('div', { class: 'li-m' }, [
              h('b', { text: s2.staff + ' · ' + s2.branch }),
              h('small', { text: `${d2.label} · ເຊັກອິນ ${U.stamp(s2.openedAt).slice(-5)}`
                + ` · ເຮັດວຽກມາ ${Math.floor(mins / 60)} ຊມ ${mins % 60} ນາທີ`
                + (s2.lateBy ? ' · ຊ້າ ' + s2.lateBy + ' ນາທີ' : '') })
            ]),
            h('span', { class: 'pill ' + (s2.lateBy ? 'bad' : 'ok'),
                        text: s2.lateBy ? 'ຊ້າ' : 'ຕົງເວລາ' })
          ]);
        })
      : [h('div', { class: 'note', text: 'ຕອນນີ້ບໍ່ມີໃຜເຊັກອິນຢູ່' })])
  ], 'tasks');

  render('ລາຍງານ', (pick || 'ທຸກສາຂາ') + ' · 30 ມື້ຜ່ານມາ', [
    chips,
    dutyCard,
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
    h('h3', { class: 'sec', text: 'ກະລ່າສຸດ' }),
    recent.length
      ? card(recent, 'tasks')
      : card([
          h('div', { class: 'note', text: 'ຍັງບໍ່ມີກະໃນຊ່ວງນີ້' }),
          btn('ໄປເປີດກະ', () => go('home'), 'ghost')
        ]),

    h('h3', { class: 'sec', text: 'ເບີ້ຍຂະຫຍັນ' }),
    card([
      h('div', { class: 'muted', text: 'ຄິດຈາກຂໍ້ມູນກະຈິງ ບໍ່ມີການໃຫ້ຄະແນນດ້ວຍມື' }),
      btn('ເບິ່ງເບີ້ຍຂະຫຍັນລາຍເດືອນ', () => go('bonus'), 'primary')
    ]),

    h('h3', { class: 'sec', text: 'ສົ່ງອອກຂໍ້ມູນ' }),
    card([
      h('div', { class: 'muted', text: 'ໄຟລ໌ CSV ມີຖັນສາຂາຄົບທຸກຊຸດ ເປີດດ້ວຍ Excel ໄດ້' }),
      btn('ສົ່ງອອກ ກະ + ເງິນສົດ', exportShifts, 'ghost', 'ກຳລັງສົ່ງອອກ…'),
      btn('ສົ່ງອອກ ອຸນຫະພູມ', exportTemps, 'ghost', 'ກຳລັງສົ່ງອອກ…'),
      btn('ສົ່ງອອກ ບັນຫາ', exportIssues, 'ghost', 'ກຳລັງສົ່ງອອກ…'),
      btn('ສົ່ງອອກ ເບີ້ຍຂະຫຍັນ', exportBonus, 'ghost', 'ກຳລັງສົ່ງອອກ…'),
      btn('ດາວໂຫຼດຮູບທັງໝົດ', exportPhotos, 'ghost', 'ກຳລັງດາວໂຫຼດ…')
    ])
  ]);
};

async function exportShifts() {
  const [shifts, cash] = await Promise.all([DB.all('shifts'), DB.all('cash')]);
  const rows = [['ວັນທີ', 'ສາຂາ', 'ກະ', 'ພະນັກງານ', 'ປະເພດ',
                 'ເຊັກອິນ', 'ຊ້າ(ນາທີ)', 'ເຊັກເອົາ', 'ອອກກ່ອນ(ນາທີ)', 'ສະຖານະ',
                 'ເງິນທອນຕັ້ງຕົ້ນ', 'ຍອດເງິນສົດPOS', 'ເງິນສົດນັບໄດ້', 'ຄວນມີ', 'ສ່ວນຕ່າງ',
                 'ຍອດລວມPOS', 'QR/ໂອນ', 'ອື່ນໆ', 'ຈໍານວນບິນ', 'ບິນຍົກເລີກ', 'ສາເຫດສ່ວນຕ່າງ', 'ຜູ້ຈັດການ']];
  shifts.forEach(s => {
    const c = cash.find(x => x.shiftId === s.id) || {};
    rows.push([s.date, s.branch, shiftDef(s.shiftKey).label, s.staff,
               s.staffType === 'weekend' ? 'ພາດທາມ' : 'ປະຈໍາ',
               U.stamp(s.openedAt), s.lateBy || 0,
               s.closedAt ? U.stamp(s.closedAt) : '', s.earlyBy || 0, s.status, s.float ?? '',
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

/* ---------- ເບີ້ຍຂະຫຍັນ ---------- */

/* ແຖບເລືອກເດືອນ — ໃຊ້ຮ່ວມກັນທັງສອງໜ້າ */
async function monthChips(current, onPick) {
  const months = (await BONUS.cyclesAvailable()).slice(0, 6);
  return h('div', { class: 'chips' }, months.map(m =>
    h('button', { class: 'chip' + (m === current ? ' on' : ''), 'data-ui': 'chip',
                  onclick: () => onPick(m) }, m)));
}

SCREENS.bonus = async function (ym) {
  ym = ym || BONUS.thisCycle();
  const rows = await BONUS.cycle(ym);
  const chips = await monthChips(ym, m => go('bonus', m));

  const totalFull = rows.reduce((a, r) => a + r.full, 0);
  const totalPaid = rows.reduce((a, r) => a + r.paid, 0);
  const totalCut = totalFull - totalPaid;
  const perfect = rows.filter(r => r.deducted === 0 && r.shiftCount > 0).length;

  const stat = (label, value, extra, cls = '') => h('div', { class: 'stat ' + cls }, [
    h('div', { class: 'stat-v', text: value }),
    h('div', { class: 'stat-l', text: label }),
    extra ? h('div', { class: 'stat-x', text: extra }) : null
  ]);

  const list = rows.map(r => h('button', {
    class: 'li li-tap', 'data-ui': 'content',
    onclick: () => go('bonusStaff', ym + '|' + r.name)
  }, [
    h('div', { class: 'li-m' }, [
      h('b', { text: r.name + (r.staff.type === 'weekend' ? ' · ພາດທາມ' : '') }),
      h('small', { text: r.shiftCount + ' ກະ'
        + (r.deducted ? ' · ຫັກ ' + U.kip(r.deducted) + ' ກີບ' : ' · ບໍ່ມີການຫັກ') })
    ]),
    h('span', { class: 'pill ' + (r.pct === 100 ? 'ok' : r.pct >= 70 ? 'todo' : 'bad'),
                text: U.kip(r.paid) })
  ]));

  const span = BONUS.cycleRange(ym);
  render('ເບີ້ຍຂະຫຍັນ', span.from + ' ຫາ ' + span.to + ' · ' + rows.length + ' ຄົນ', [
    chips,
    h('div', { class: 'stats', 'data-ui': 'content' }, [
      stat('ຈ່າຍຈິງ (ກີບ)', U.kip(totalPaid), 'ເຕັມ ' + U.kip(totalFull)),
      stat('ຫັກລວມ (ກີບ)', U.kip(totalCut), '', totalCut ? 'bad' : ''),
      stat('ໄດ້ເຕັມ', String(perfect) + '/' + rows.filter(r => r.shiftCount > 0).length, 'ຄົນ')
    ]),
    h('h3', { class: 'sec', text: 'ລາຍຄົນ' }),
    list.length ? card(list, 'tasks')
                : card([h('div', { class: 'note', text: 'ເດືອນນີ້ຍັງບໍ່ມີຂໍ້ມູນກະ' }),
                        btn('ໄປໜ້າຫຼັກ', () => go('home'), 'ghost')]),
    card([
      h('div', { class: 'muted',
        text: 'ຕັດຍອດທຸກວັນທີ ' + BONUS.cutDay() + ' ຮອບນີ້ເຫຼືອອີກ ' + BONUS.daysLeft(ym) + ' ມື້' }),
      h('div', { class: 'muted',
        text: 'ກົດຊື່ເພື່ອເບິ່ງວ່າຖືກຫັກຍ້ອນຫຍັງແດ່ ແລະ ບັນທຶກການຫັກເພີ່ມເຊັ່ນ ບໍ່ມາເຮັດວຽກ' })
    ])
  ]);
};

SCREENS.bonusStaff = async function (arg) {
  const [ym, name] = String(arg || '').split('|');
  if (!name) return go('bonus');
  const rows = await BONUS.cycle(ym);
  const r = rows.find(x => x.name === name);
  if (!r) return go('bonus', ym);

  const adjs = (await DB.by('bonusAdj', 'month', ym)).filter(a => a.staffName === name);

  /* ແຕ່ລະກົດທີ່ຖືກຫັກ — ບອກເຫດຜົນເປັນລາຍການ ເພື່ອໃຫ້ພະນັກງານກວດຄືນໄດ້ */
  const lineCards = r.lines.map(l => card([
    h('div', { class: 'vrow bad-line' }, [
      h('span', { text: l.rule.label }),
      h('b', { text: '-' + U.kip(l.total) })
    ]),
    h('div', { class: 'muted', text: l.count + ' ຄັ້ງ × ' + U.kip(l.amount) + ' ກີບ' }),
    ...l.refs.slice(0, 8).map(ref => h('div', {
      class: 'li' + (ref.shiftId ? ' li-tap' : ''), 'data-ui': 'content',
      onclick: ref.shiftId ? () => go('shiftDetail', ref.shiftId) : null
    }, [
      h('div', { class: 'li-m' }, [
        h('b', { text: ref.date || '—' }),
        h('small', { text: (ref.manual ? 'ຜູ້ຈັດການບັນທຶກ · ' : '') + (ref.text || '') })
      ])
    ])),
    l.refs.length > 8
      ? h('div', { class: 'muted', text: 'ແລະ ອີກ ' + (l.refs.length - 8) + ' ລາຍການ' })
      : null
  ]));

  /* ບັນທຶກການຫັກເອງ — ສໍາລັບສິ່ງທີ່ລະບົບຮູ້ເອງບໍ່ໄດ້ ເຊັ່ນ ບໍ່ມາເຮັດວຽກ */
  const form = { ruleKey: 'absent', amount: BONUS.amountOf('absent'), date: U.today(), note: '' };
  const amtIn = input({ type: 'number', value: form.amount,
                        oninput: e => form.amount = U.num(e.target.value) });
  const addCard = card([
    h('h3', { class: 'ttl', text: 'ບັນທຶກການຫັກເອງ' }),
    h('div', { class: 'muted', text: 'ໃຊ້ກັບສິ່ງທີ່ລະບົບກວດເອງບໍ່ໄດ້ ເຊັ່ນ ບໍ່ມາເຮັດວຽກ ຫຼື ຜິດກົດລະບຽບ' }),
    rowLabel('ເຫດຜົນ', select(
      CONFIG.bonusRules.map(x => ({ value: x.key, label: x.label })), form.ruleKey,
      e => { form.ruleKey = e.target.value; form.amount = BONUS.amountOf(form.ruleKey);
             amtIn.value = form.amount; })),
    rowLabel('ວັນທີ', input({ type: 'date', value: form.date, oninput: e => form.date = e.target.value })),
    rowLabel('ຈໍານວນທີ່ຫັກ (ກີບ)', amtIn),
    rowLabel('ໝາຍເຫດ', input({ placeholder: 'ເຊັ່ນ ບໍ່ມາ ແລະ ບໍ່ແຈ້ງ', oninput: e => form.note = e.target.value })),
    btn('ບັນທຶກການຫັກ', async () => {
      if (!form.amount || form.amount <= 0) return U.toast('ໃສ່ຈໍານວນທີ່ຫັກກ່ອນ', 'err');
      const rule = CONFIG.bonusRules.find(x => x.key === form.ruleKey);
      const ok = await confirmSheet({
        title: 'ຫັກເບີ້ຍຂະຫຍັນ?',
        lines: [name, rule.label, '-' + U.kip(form.amount) + ' ກີບ · ວັນທີ ' + form.date,
                'ຫັກແລ້ວຍັງລຶບອອກໄດ້ໃນໜ້ານີ້'],
        confirmLabel: 'ຫັກ ' + U.kip(form.amount), danger: true
      });
      if (!ok) return;
      await DB.put('bonusAdj', {
        month: ym, staffName: name, ruleKey: form.ruleKey, amount: form.amount,
        date: form.date, note: form.note, ts: new Date().toISOString()
      });
      U.toast('ບັນທຶກແລ້ວ');
      go('bonusStaff', arg);
    }, 'danger')
  ]);

  const adjCard = adjs.length ? card([
    h('h3', { class: 'ttl', text: 'ການຫັກທີ່ບັນທຶກເອງ' }),
    ...adjs.map(a => h('div', { class: 'li', 'data-ui': 'content' }, [
      h('div', { class: 'li-m' }, [
        h('b', { text: (CONFIG.bonusRules.find(x => x.key === a.ruleKey) || {}).label || a.ruleKey }),
        h('small', { text: a.date + (a.note ? ' · ' + a.note : '') })
      ]),
      h('span', { class: 'pill bad', text: '-' + U.kip(a.amount) }),
      h('button', { class: 'x', text: '✕', onclick: async () => {
        await DB.del('bonusAdj', a.id);
        U.toast('ລຶບການຫັກແລ້ວ');
        go('bonusStaff', arg);
      } })
    ]))
  ], 'tasks') : null;

  const span2 = BONUS.cycleRange(ym);
  render(name, span2.from + ' ຫາ ' + span2.to + ' · ' + r.shiftCount + ' ກະ', [
    card([
      h('div', { class: 'vrow' }, [h('span', { text: 'ເບີ້ຍເຕັມ' }), h('b', { text: U.kip(r.full) + ' ກີບ' })]),
      h('div', { class: 'vrow bad-line' }, [h('span', { text: 'ຫັກທັງໝົດ' }), h('b', { text: '-' + U.kip(r.deducted) })]),
      /* ຖ້າລວມການຫັກແລ້ວເກີນເບີ້ຍເຕັມ ຕ້ອງບອກ ບໍ່ດັ່ງນັ້ນຕົວເລກຂ້າງລຸ່ມຈະບໍ່ຕົງກັບລາຍການ */
      r.capped
        ? h('div', { class: 'warn small',
            text: 'ລາຍການຫັກລວມ ' + U.kip(r.rawDeducted) + ' ກີບ ເກີນເບີ້ຍເຕັມ — ຫັກໄດ້ສູງສຸດເທົ່າເບີ້ຍເຕັມ ບໍ່ຕິດລົບ' })
        : null,
      h('div', { class: 'vrow big-v' }, [h('span', { text: 'ໄດ້ຈິງ' }), h('b', { text: U.kip(r.paid) + ' ກີບ' })]),
      h('div', { class: 'muted', text: 'ຄິດເປັນ ' + r.pct + '% ຂອງເບີ້ຍເຕັມ' })
    ]),
    r.lines.length ? h('h3', { class: 'sec', text: 'ຫັກຍ້ອນຫຍັງແດ່' }) : null,
    ...lineCards,
    !r.lines.length ? card([h('div', { class: 'note', text: 'ເດືອນນີ້ບໍ່ມີການຫັກ — ໄດ້ເບີ້ຍເຕັມ' })]) : null,
    adjCard,
    addCard,
    btn('ກັບໄປລາຍຊື່', () => go('bonus', ym), 'ghost')
  ]);
};

async function exportBonus() {
  const ym = BONUS.thisCycle();
  const rows = await BONUS.cycle(ym);
  const head = ['ເດືອນ', 'ພະນັກງານ', 'ປະເພດ', 'ຈໍານວນກະ', 'ເບີ້ຍເຕັມ', 'ຫັກ', 'ໄດ້ຈິງ', '%',
                ...CONFIG.bonusRules.map(r => r.label)];
  const body = rows.map(r => [
    ym, r.name, r.staff.type === 'weekend' ? 'ພາດທາມ' : 'ປະຈໍາ', r.shiftCount,
    r.full, r.deducted, r.paid, r.pct,
    ...CONFIG.bonusRules.map(rule => {
      const l = r.lines.find(x => x.rule.key === rule.key);
      return l ? l.count : 0;
    })
  ]);
  U.downloadCsv([head, ...body], 'gomart_bonus_' + ym + '.csv');
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

  /* ພະນັກງານ — ຊື່ + ກະປະຈໍາ + ປະເພດ ໃຊ້ທັງໜ້າເຊັກອິນ ແລະ ການຄິດເບີ້ຍຂະຫຍັນ */
  function staffEditor() {
    const wrap = h('div', {});
    const save = () => saveSetting('staff', st.staff);
    const redraw = () => {
      wrap.innerHTML = '';
      st.staff.forEach((p, i) => wrap.appendChild(h('div', { class: 'li', 'data-ui': 'content' }, [
        /* ທຸກຊ່ອງມີປ້າຍຊື່ເໜືອຊ່ອງ — ຄໍາໃບ້ໃນຊ່ອງຢ່າງດຽວຈະຫາຍໄປຕອນພິມ */
        h('div', { class: 'li-m' }, [
          rowLabel('ຊື່ພະນັກງານ', input({
            value: p.name, placeholder: 'ຊື່ພະນັກງານ',
            onchange: e => { st.staff[i].name = e.target.value.trim(); save(); } })),
          h('div', { class: 'addrow' }, [
            rowLabel('ກະປະຈໍາ', select([{ value: '', label: '— ບໍ່ກໍານົດ —' },
                    ...st.shifts.map(x => ({ value: x.key, label: x.label }))],
                   p.shiftKey || '', e => { st.staff[i].shiftKey = e.target.value || null; save(); })),
            rowLabel('ປະເພດ', select([{ value: 'full', label: 'ປະຈໍາ' }, { value: 'weekend', label: 'ພາດທາມ' }],
                   p.type || 'full', e => { st.staff[i].type = e.target.value; save(); }))
          ])
        ]),
        h('button', { class: 'x', text: '✕', onclick: async () => {
          st.staff = st.staff.filter((_, j) => j !== i); await save(); redraw();
        } })
      ])));
      wrap.appendChild(h('div', { class: 'addrow' }, [
        btn('+ ເພີ່ມພະນັກງານ', async () => {
          st.staff = [...st.staff, { name: '', shiftKey: null, type: 'full' }];
          await save(); redraw();
        }, 'sm')
      ]));
    };
    redraw();
    return card([
      h('h3', { class: 'ttl', text: 'ພະນັກງານ' }),
      h('div', { class: 'muted', text: 'ຊື່ທີ່ໃສ່ນີ້ຈະຂຶ້ນໃຫ້ເລືອກຕອນເຊັກອິນ ແລະ ໃຊ້ຄິດເບີ້ຍຂະຫຍັນ' }),
      wrap
    ]);
  }

  /* ເບີ້ຍຂະຫຍັນ — ຈໍານວນເງິນທັງໝົດແກ້ໄດ້ຢູ່ນີ້ບ່ອນດຽວ */
  const bonusCard = card([
    h('h3', { class: 'ttl', text: 'ເບີ້ຍຂະຫຍັນ' }),
    h('div', { class: 'muted', text: 'ທຸກຄົນເລີ່ມເດືອນດ້ວຍເບີ້ຍເຕັມ ແລ້ວຫັກລົງຕາມສິ່ງທີ່ເກີດຂຶ້ນຈິງ' }),
    rowLabel('ເບີ້ຍເຕັມ ພະນັກງານປະຈໍາ (ກີບ/ເດືອນ)',
      input({ type: 'number', value: st.bonusFull,
              onchange: e => saveSetting('bonusFull', U.num(e.target.value)) })),
    rowLabel('ເບີ້ຍເຕັມ ພາດທາມ (ກີບ/ເດືອນ)',
      input({ type: 'number', value: st.bonusFullWeekend,
              onchange: e => saveSetting('bonusFullWeekend', U.num(e.target.value)) })),
    rowLabel('ຕັດຍອດເບີ້ຍທຸກວັນທີ',
      input({ type: 'number', min: 1, max: 28, value: st.bonusCutDay,
              onchange: e => saveSetting('bonusCutDay', U.num(e.target.value)) })),
    rowLabel('ອອກວຽກກ່ອນເວລາເກີນ (ນາທີ) = ຖືວ່າອອກກ່ອນ',
      input({ type: 'number', value: st.earlyMinutes,
              onchange: e => saveSetting('earlyMinutes', U.num(e.target.value)) })),
    h('div', { class: 'muted', style: 'margin-top:14px', text: 'ຫັກຄັ້ງລະເທົ່າໃດ — ຮຽງຈາກຄວາມຮັບຜິດຊອບໜັກສຸດລົງມາ' }),
    ...CONFIG.bonusRules.map(r => rowLabel(
      r.label + ' (ນໍ້າໜັກ ' + r.weight + ')',
      input({ type: 'number', value: BONUS.amountOf(r.key),
              onchange: e => {
                const next = { ...(st.bonusAmounts || {}), [r.key]: U.num(e.target.value) };
                saveSetting('bonusAmounts', next);
              } })))
  ]);

  /* ລຶບກະທີ່ເປີດຜິດ — ຍ້າຍມາຈາກໜ້າຫຼັກ ບໍ່ໃຫ້ກົດຜິດຕອນເຮັດວຽກ */
  const cancelCard = card([
    h('h3', { class: 'ttl', text: 'ກະທີ່ເປີດຜິດ' }),
    h('div', { class: 'muted', text: 'ໃຊ້ສະເພາະເມື່ອເປີດກະຜິດສາຂາ ຫຼື ຜິດກະ — ຂໍ້ມູນທີ່ຕື່ມໄວ້ທັງໝົດຂອງກະນີ້ຈະຫາຍໄປ' }),
    S.shift
      ? btn('ລຶບກະນີ້ຖິ້ມ', cancelShift, 'danger-quiet')
      : h('div', { class: 'note', text: 'ຍັງບໍ່ມີກະທີ່ເປີດຢູ່' })
  ], 'danger-zone');

  render('ຕັ້ງຄ່າ', 'ລະບົບ v' + CONFIG.version, [
    listEditor('branches', 'ສາຂາ', 'ຊື່ສາຂາໃໝ່'),
    listEditor('zones', 'ໂຊນສິນຄ້າ', 'ຊື່ໂຊນໃໝ່'),
    staffEditor(),
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
    bonusCard,
    cancelCard,
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
  for (const s of ['settings', 'shifts', 'checks', 'temps', 'cash', 'issues', 'stock', 'bonusAdj']) out[s] = await DB.all(s);
  const photos = await DB.all('photos');
  out.photos = photos.map(p => ({ ...p, blob: undefined, size: p.blob ? p.blob.size : 0 }));
  U.download(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }),
             `gomart_backup_${U.today()}.json`);
  U.toast('ສໍາຮອງແລ້ວ (ຮູບບໍ່ລວມ — ໃຊ້ປຸ່ມດາວໂຫຼດຮູບ)');
}
