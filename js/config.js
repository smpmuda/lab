// ============================================================
// config.js — Konfigurasi Aplikasi
// GANTI API_URL dengan URL Web App hasil deploy Apps Script
// ============================================================

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbyZ-nPXp3myV5pDfnTjVAgceV5kUEsPAWNYQumaax863uauXouZvCXsfZKoYYFtLTwW/exec",
  APP_NAME: "Jurnal Mengajar",
  VERSION: "1.0.0"
};

// [BARU — fix kritis 2026-09-12] GitHub Pages project-pages (mis.
// smpmuda.github.io/lab dan smpmuda.github.io/jurnal) berbagi ORIGIN YANG
// SAMA (smpmuda.github.io) — browser menyimpan sessionStorage/localStorage
// PER ORIGIN, BUKAN per path. Kalau dua deployment berbeda (mis. project
// Apps Script berbeda, dipakai sebagai staging/fallback) memakai key
// storage yang sama persis, sisa token login / cache dari satu deployment
// bisa "nyasar" kebaca di deployment lain dalam browser/tab yang sama —
// menyebabkan token invalid acak & data cache bercampur antar deployment.
//
// Solusi: turunkan namespace otomatis dari path URL saat ini (mis. "lab"
// atau "jurnal"), lalu semua key storage disisipi namespace ini. Tidak
// perlu diseting manual — otomatis ikut folder deployment mana pun app
// ini dibuka, termasuk kalau kelak ada folder fallback ketiga dst.
CONFIG.STORAGE_NS = (function() {
  var seg = window.location.pathname.split('/').filter(Boolean)[0];
  return seg ? seg.toLowerCase().replace(/[^a-z0-9_-]/g, '') : 'root';
})();
