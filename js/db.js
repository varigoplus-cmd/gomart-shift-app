/* ຖານຂໍ້ມູນທ້ອງຖິ່ນ (IndexedDB) — ໃຊ້ໄດ້ແມ່ນແຕ່ບໍ່ມີອິນເຕີເນັດ */
const DB = (() => {
  const NAME = 'gomart_shift';
  const VERSION = 3;
  const STORES = {
    settings: { keyPath: 'key' },
    drafts:   { keyPath: 'id', indexes: ['shiftId'] },
    shifts:   { keyPath: 'id', indexes: ['branch', 'date', 'status'] },
    checks:   { keyPath: 'id', indexes: ['shiftId'] },
    photos:   { keyPath: 'id', indexes: ['shiftId'] },
    temps:    { keyPath: 'id', indexes: ['shiftId'] },
    cash:     { keyPath: 'id', indexes: ['shiftId'] },
    issues:   { keyPath: 'id', indexes: ['shiftId', 'status', 'branch'] },
    stock:    { keyPath: 'id', indexes: ['shiftId', 'kind'] },
    /* ການຫັກເບີ້ຍທີ່ຜູ້ຈັດການບັນທຶກເອງ ເຊັ່ນ ບໍ່ມາເຮັດວຽກ */
    bonusAdj: { keyPath: 'id', indexes: ['month', 'staffName'] }
  };

  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        Object.entries(STORES).forEach(([name, def]) => {
          if (db.objectStoreNames.contains(name)) return;
          const os = db.createObjectStore(name, { keyPath: def.keyPath });
          (def.indexes || []).forEach(ix => os.createIndex(ix, ix, { unique: false }));
        });
      };
      req.onsuccess = () => { _db = req.result; res(_db); };
      req.onerror = () => rej(req.error);
    });
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      let out;
      try { out = fn(os); } catch (err) { rej(err); return; }
      t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  return {
    uid,
    put: (store, obj) => {
      if (!obj.id && STORES[store].keyPath === 'id') obj.id = uid();
      return tx(store, 'readwrite', os => { os.put(obj); return obj; });
    },
    putMany: (store, arr) => tx(store, 'readwrite', os => {
      arr.forEach(o => { if (!o.id && STORES[store].keyPath === 'id') o.id = uid(); os.put(o); });
      return arr;
    }),
    get: (store, key) => tx(store, 'readonly', os => os.get(key)),
    all: (store) => tx(store, 'readonly', os => os.getAll()),
    by: (store, index, value) => tx(store, 'readonly', os => os.index(index).getAll(value)),
    del: (store, key) => tx(store, 'readwrite', os => { os.delete(key); }),
    clear: (store) => tx(store, 'readwrite', os => { os.clear(); }),

    /* ຄ່າຕັ້ງຄ່າ */
    setting: (key, value) => value === undefined
      ? tx('settings', 'readonly', os => os.get(key)).then(r => r ? r.value : undefined)
      : tx('settings', 'readwrite', os => { os.put({ key, value }); return value; }),

    wipeAll: () => Promise.all(Object.keys(STORES).map(s => tx(s, 'readwrite', os => { os.clear(); })))
  };
})();
