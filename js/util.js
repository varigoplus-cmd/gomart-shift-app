/* ເຄື່ອງມືຊ່ວຍ: ກ້ອງ + ລາຍນໍ້າ, ວັນທີ, ຕົວເລກ, ສົ່ງອອກ CSV */
const U = (() => {

  /* ---------- ວັນທີ / ເວລາ ---------- */
  const pad = n => String(n).padStart(2, '0');
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const nowTime = () => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const stamp = (iso) => {
    const d = iso ? new Date(iso) : new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  /* ຄວາມຕ່າງເປັນນາທີ ລະຫວ່າງ "HH:MM" ກັບເວລາປັດຈຸບັນ */
  const minutesLate = (planned, actualIso) => {
    if (!planned) return 0;
    const a = actualIso ? new Date(actualIso) : new Date();
    const [h, m] = planned.split(':').map(Number);
    const p = new Date(a); p.setHours(h, m, 0, 0);
    return Math.round((a - p) / 60000);
  };

  /* ---------- ຕົວເລກ ---------- */
  const num = v => {
    const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const kip = v => num(v).toLocaleString('en-US');

  /* ---------- ກ້ອງ + ລາຍນໍ້າ ----------
   * ຮັບ File ຈາກ <input capture> → ຫຍໍ້ຂະໜາດ → ຂຽນລາຍນໍ້າ → ຄືນເປັນ Blob JPEG
   */
  function watermark(file, lines, maxW = 1280) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0, w, h);

        const fs = Math.max(13, Math.round(w / 42));
        const padX = Math.round(fs * 0.6);
        const lineH = Math.round(fs * 1.45);
        const boxH = lineH * lines.length + padX;
        x.fillStyle = 'rgba(0,0,0,0.62)';
        x.fillRect(0, h - boxH, w, boxH);
        x.fillStyle = '#fff';
        x.font = `${fs}px -apple-system, "Phetsarath OT", sans-serif`;
        x.textBaseline = 'top';
        lines.forEach((t, i) => x.fillText(t, padX, h - boxH + padX / 2 + i * lineH));

        c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.75);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ອ່ານຮູບບໍ່ໄດ້')); };
      img.src = url;
    });
  }

  /* ຕໍາແໜ່ງ GPS — ບໍ່ບັງຄັບ, ຖ້າບໍ່ໄດ້ກໍ່ຜ່ານໄປ */
  function geo(timeout = 6000) {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
        () => resolve(null),
        { timeout, maximumAge: 60000, enableHighAccuracy: false }
      );
    });
  }

  /* ---------- ສົ່ງອອກ ---------- */
  function csv(rows) {
    const esc = v => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n');
  }
  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const downloadCsv = (rows, name) => download(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), name);

  /* ---------- DOM ---------- */
  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
    });
    (Array.isArray(kids) ? kids : [kids]).forEach(k => {
      if (k == null) return;
      n.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    });
    return n;
  };

  let _toast = null;
  function toast(msg, kind = 'ok') {
    if (_toast) { _toast.remove(); _toast = null; }
    const t = el('div', { class: 'toast ' + kind, text: msg });
    document.body.appendChild(t);
    _toast = t;
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      if (_toast !== t) return;
      t.classList.remove('show');
      setTimeout(() => { t.remove(); if (_toast === t) _toast = null; }, 300);
    }, 2600);
    return t;
  }

  /* ຂໍ້ຄວາມພ້ອມປຸ່ມ "ຍ້ອນກັບ" — ຢູ່ດົນກວ່າປົກກະຕິ */
  function toastUndo(msg, label, onUndo, ms = 10000) {
    if (_toast) { _toast.remove(); _toast = null; }
    let done = false;
    const t = el('div', { class: 'toast undo' }, [
      el('span', { text: msg }),
      el('button', {
        class: 'toast-act', text: label,
        onclick: () => { if (done) return; done = true; close(); onUndo(); }
      })
    ]);
    function close() {
      t.classList.remove('show');
      setTimeout(() => { t.remove(); if (_toast === t) _toast = null; }, 300);
    }
    document.body.appendChild(t);
    _toast = t;
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { if (!done && _toast === t) { done = true; close(); } }, ms);
    return t;
  }

  function confirmBox(msg) {
    return Promise.resolve(window.confirm(msg));
  }

  /* ---------- ໂໝດສະແດງຜົນ (ຈໍາຕໍ່ເຄື່ອງ) ---------- */
  const THEME_KEY = 'gomart_theme';
  function theme(v) {
    if (v === undefined) {
      try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; }
    }
    try { v === 'auto' ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, v); }
    catch (e) { /* ໂໝດສ່ວນຕົວ — ຂ້າມໄປ */ }
    applyTheme();
    return v;
  }
  function applyTheme() {
    const v = theme();
    const r = document.documentElement;
    if (v === 'auto') r.removeAttribute('data-theme');
    else r.setAttribute('data-theme', v);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) {
      const dark = v === 'dark' ||
        (v === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', dark ? '#0d8a76' : '#008273');
    }
  }

  return { pad, today, nowTime, stamp, minutesLate, num, kip, watermark, geo,
           csv, download, downloadCsv, el, toast, toastUndo, confirmBox,
           theme, applyTheme };
})();
