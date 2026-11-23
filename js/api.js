/* ເອີ້ນ API ເຊີບເວີ (Cloudflare Worker) — ລາຍຊື່ພະນັກງານ ແລະ ລະຫັດຢູ່ບ່ອນດຽວ ທຸກເຄື່ອງເຊັກກັບຊຸດນີ້ */
const API = (() => {
  const BASE = 'https://gomart-api.varigoplus-393.workers.dev';

  /* ຄືນ { status, data } ຫຼື ໂຍນ error ເມື່ອຕໍ່ບໍ່ໄດ້ */
  async function call(path, { method = 'GET', headers = {}, body, ms = 6000 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: body ? { 'content-type': 'application/json', ...headers } : headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal
      });
      let data = {};
      try { data = await res.json(); } catch (e) { /* ບໍ່ມີ JSON */ }
      return { status: res.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /* ລາຍຊື່ພະນັກງານທີ່ໃຊ້ຢູ່ + ມີລະຫັດແລ້ວຫຼືບໍ່ */
    async staff(storeKey) {
      const r = await call('/api/staff', { headers: { 'x-store-key': storeKey }, ms: 4000 });
      if (r.status === 401) throw Object.assign(new Error('denied'), { reason: 'denied' });
      if (r.status !== 200) throw new Error('http ' + r.status);
      return r.data;
    },

    /* ກວດລະຫັດ — ຄືນ { ok:true } ຫຼື { ok:false, reason, left?, until? } */
    async checkIn(storeKey, staffId, pin) {
      const r = await call('/api/check-in', {
        method: 'POST', headers: { 'x-store-key': storeKey },
        body: { staff_id: staffId, pin }
      });
      if (r.status === 401) return { ok: false, reason: 'denied' };
      if (r.data && r.data.ok) return { ok: true, name: r.data.name };
      return { ok: false, reason: (r.data && r.data.reason) || 'unknown', left: r.data && r.data.left,
               until: r.data && r.data.until };
    },

    /* ຜູ້ຈັດການຕັ້ງລະຫັດໃຫ້ພະນັກງານ */
    async setPin(managerKey, staffId, pin) {
      const r = await call('/api/manager/set-pin', {
        method: 'POST', headers: { 'x-manager-key': managerKey },
        body: { staff_id: staffId, pin }
      });
      return r.status === 200 && r.data.ok ? { ok: true } : { ok: false, reason: r.status === 401 ? 'denied' : 'failed' };
    },

    /* ອັບໂຫຼດຮູບຂຶ້ນ R2 — ຄືນລິ້ງຮູບ ຫຼື ໂຍນ error ເມື່ອບໍ່ສຳເລັດ */
    async uploadPhoto(storeKey, blob) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      try {
        const res = await fetch(BASE + '/api/photos', {
          method: 'POST',
          headers: { 'x-store-key': storeKey, 'content-type': 'image/jpeg' },
          body: blob,
          signal: ctrl.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) throw new Error('upload ' + res.status);
        return data.url;
      } finally {
        clearTimeout(timer);
      }
    },

    /* ຜູ້ຈັດການລຶບລະຫັດ */
    async clearPin(managerKey, staffId) {
      const r = await call('/api/manager/clear-pin', {
        method: 'POST', headers: { 'x-manager-key': managerKey },
        body: { staff_id: staffId }
      });
      return r.status === 200 && r.data.ok ? { ok: true } : { ok: false, reason: r.status === 401 ? 'denied' : 'failed' };
    }
  };
})();
