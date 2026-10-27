// ذخیره‌سازی ماندگار: localStorage برای پیش‌نویس کوچک، IndexedDB برای فایل/صدا/بازخوردهای ثبت‌شده
export const LS_KEY = 'bioark:draft:v1';
const DB_NAME = 'bioark-feedback';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('files', { keyPath: 'id' });
      db.createObjectStore('kv');
      db.createObjectStore('feedbacks', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function store(name, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(name, mode);
        const r = fn(t.objectStore(name));
        t.oncomplete = () => resolve(r ? r.result : undefined);
        t.onerror = t.onabort = () => reject(t.error);
      })
  );
}

export const dbPut = (name, val, key) =>
  store(name, 'readwrite', (s) => (key === undefined ? s.put(val) : s.put(val, key)));
export const dbGet = (name, key) => store(name, 'readonly', (s) => s.get(key));
export const dbAll = (name) => store(name, 'readonly', (s) => s.getAll());
export const dbDel = (name, key) => store(name, 'readwrite', (s) => s.delete(key));
export const dbClear = (name) => store(name, 'readwrite', (s) => s.clear());
