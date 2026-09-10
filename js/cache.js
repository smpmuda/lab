// ============================================================
// cache.js — Cache Data Master di Browser (localStorage)
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
//
// ARSITEKTUR (disepakati 2026-09-08, lihat MASTER_CONTEXT_HANDOFF.md):
//   Data Utama (Spreadsheet) → Apps Script (endpoint token-auth, TIDAK
//   berubah) → localStorage per-perangkat (BUKAN file publik di GitHub)
//   → Aplikasi.
//
// YANG DI-CACHE: hanya data master yang jarang berubah (guru, kelas,
// mapel, jam, siswa per-kelas, jadwal per-guru). Data transaksional
// (jurnal, kehadiran, log, jadwal-hari-ini yang mengandung status
// sudah_diisi) TIDAK PERNAH masuk sini — selalu live dari server.
//
// INVALIDASI: server punya angka `data_version` (di getConfig, naik
// otomatis lewat trigger onEdit tiap admin edit sheet master data).
// Begitu app mendeteksi angka ini beda dari yang tersimpan lokal,
// SELURUH cache lokal dihapus dan diisi ulang secara lazy (baru fetch
// lagi saat masing-masing data benar-benar dibutuhkan).
//
// GAGAL-AMAN: semua operasi localStorage dibungkus try-catch. Kalau
// localStorage penuh/nonaktif (mode privat, dsb.), cache dianggap
// selalu "miss" — aplikasi tetap jalan normal, cuma tanpa cache
// (selalu fetch live), TIDAK PERNAH error ke pengguna karena ini.
// ============================================================

var DataCache = (function() {
  var LS_PREFIX = 'jm_cache_';
  var LS_VERSION_KEY = 'jm_cache_version';

  function isAvailable() {
    try {
      var t = '__jm_test__';
      localStorage.setItem(t, '1');
      localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getLocalVersion() {
    try {
      var v = localStorage.getItem(LS_VERSION_KEY);
      return v ? parseInt(v, 10) : 0;
    } catch (e) { return 0; }
  }

  function setLocalVersion(v) {
    try { localStorage.setItem(LS_VERSION_KEY, String(v)); } catch (e) { /* diamkan, gagal-aman */ }
  }

  function get(key) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null; // rusak/nonaktif → dianggap cache miss, aman
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      // localStorage penuh atau dinonaktifkan browser (mode privat) —
      // diamkan. Aplikasi tetap berfungsi penuh, hanya tanpa cache.
    }
  }

  function clearAll() {
    try {
      var toRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(LS_PREFIX) === 0) toRemove.push(k);
      }
      toRemove.forEach(function(k) { localStorage.removeItem(k); });
    } catch (e) { /* diamkan, gagal-aman */ }
  }

  // Bandingkan versi server vs lokal. Kalau beda (termasuk pemakaian
  // pertama kali di perangkat ini), hapus seluruh cache lama supaya
  // tidak ada data basi tercecer. Return true kalau cache di-reset.
  function syncIfNeeded(serverVersion) {
    serverVersion = (serverVersion === undefined || serverVersion === null) ? 0 : serverVersion;
    var localVersion = getLocalVersion();
    if (localVersion === serverVersion) return false;
    clearAll();
    setLocalVersion(serverVersion);
    return true;
  }

  return {
    isAvailable: isAvailable,
    get: get,
    set: set,
    clearAll: clearAll,
    getLocalVersion: getLocalVersion,
    setLocalVersion: setLocalVersion,
    syncIfNeeded: syncIfNeeded,
  };
})();
