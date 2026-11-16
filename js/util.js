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

  /* ---------- ກ້ອງໃນແອັບ ----------
   * ເປີດກ້ອງຈິງດ້ວຍ getUserMedia — ເລືອກຮູບຈາກຄັງພາບບໍ່ໄດ້
   * ຕ້ອງການ HTTPS. ຖ້າເປີດບໍ່ໄດ້ ຈະ throw ອອກມາໃຫ້ຜູ້ເອີ້ນຕັດສິນໃຈ
   */
  function cameraAvailable() {
    return !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function cameraError(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError')
      return 'ບໍ່ໄດ້ຮັບອະນຸຍາດໃຊ້ກ້ອງ — ເປີດສິດກ້ອງໃຫ້ເວັບນີ້ໃນຕັ້ງຄ່າມືຖື';
    if (n === 'NotFoundError' || n === 'OverconstrainedError')
      return 'ບໍ່ພົບກ້ອງໃນເຄື່ອງນີ້';
    if (n === 'NotReadableError')
      return 'ກ້ອງຖືກແອັບອື່ນໃຊ້ຢູ່ — ປິດແອັບກ້ອງອື່ນແລ້ວລອງໃໝ່';
    return 'ເປີດກ້ອງບໍ່ໄດ້: ' + (e && e.message ? e.message : 'ບໍ່ຮູ້ສາເຫດ');
  }

  /* ຄືນ Blob ຂອງຮູບ ຫຼື null ຖ້າຜູ້ໃຊ້ກົດຍົກເລີກ */
  function openCamera(title) {
    return new Promise(async (resolve, reject) => {
      let stream = null, facing = 'environment', closed = false;

      const video = el('video', { class: 'cam-video', autoplay: '', playsinline: '', muted: '' });
      video.muted = true;
      const shot = el('button', { class: 'cam-shot', 'aria-label': 'ຖ່າຍຮູບ' });
      const flip = el('button', { class: 'cam-flip', text: '⟳', 'aria-label': 'ສະຫຼັບກ້ອງໜ້າ-ຫຼັງ' });
      const cancel = el('button', { class: 'cam-x', text: '✕', 'aria-label': 'ຍົກເລີກ' });
      const hint = el('div', { class: 'cam-hint', text: title || '' });
      const wrap = el('div', { class: 'cam-wrap' }, [
        video,
        el('div', { class: 'cam-bar-top' }, [cancel, hint, flip]),
        el('div', { class: 'cam-bar' }, [shot])
      ]);

      function stop() {
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
      function close(v) {
        if (closed) return;
        closed = true;
        stop();
        document.removeEventListener('keydown', onKey);
        wrap.remove();
        resolve(v);
      }
      const onKey = e => { if (e.key === 'Escape') close(null); };

      async function start() {
        stop();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false
        });
        video.srcObject = stream;
        await video.play().catch(() => {});
      }

      cancel.addEventListener('click', () => close(null));
      flip.addEventListener('click', async () => {
        facing = facing === 'environment' ? 'user' : 'environment';
        try { await start(); } catch (e) { toast(cameraError(e), 'err'); }
      });
      shot.addEventListener('click', () => {
        if (!video.videoWidth) return toast('ກ້ອງຍັງບໍ່ພ້ອມ ລໍຖ້າຈັກໜ້ອຍ', 'err');
        const c = document.createElement('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0);
        shot.disabled = true;
        c.toBlob(b => b ? close(b) : (shot.disabled = false, toast('ບັນທຶກຮູບບໍ່ໄດ້', 'err')),
                 'image/jpeg', 0.92);
      });

      document.body.appendChild(wrap);
      document.addEventListener('keydown', onKey);
      try { await start(); }
      catch (e) { closed = true; wrap.remove(); document.removeEventListener('keydown', onKey); reject(e); }
    });
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
           theme, applyTheme, cameraAvailable, openCamera, cameraError };
})();
