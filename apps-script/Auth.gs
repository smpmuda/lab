// ============================================================
// Auth.gs — Autentikasi & Session
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
//
// Pendekatan: token sederhana disimpan di PropertiesService.
// Token = random string 32 karakter, expired sesuai DURASI_SESSION.
// Plain text password (sesuai keputusan desain).
// ============================================================

var TOKEN_PREFIX = 'TOKEN_';
var PROPS = PropertiesService.getScriptProperties();

// ── Login ─────────────────────────────────────────────────────

function actionLogin(body) {
  var username = String(body.username || '').trim().toLowerCase();
  var password = String(body.password || '').trim();

  if (!username || !password) return err('Username dan password wajib diisi');

  // Cari user
  var users = readSheet('03_USER');
  var user = users.find(function(u) {
    return String(u.username).toLowerCase() === username && isAktif(u.aktif);
  });

  if (!user) return err('Username tidak ditemukan atau akun nonaktif', 401);
  if (String(user.password) !== password) return err('Password salah', 401);

  // Ambil data guru jika ada
  var guruData = null;
  if (user.guru_id) {
    guruData = findBy('04_GURU', 'guru_id', user.guru_id);
  }

  // Cek apakah guru ini juga wali kelas
  var kelasWali = null;
  if (user.guru_id) {
    var kelasList = readSheet('05_KELAS');
    var kw = kelasList.find(function(k) {
      return String(k.wali_kelas_id) === String(user.guru_id) && String(k.tahun_id) === configVal('TAHUN_AKTIF');
    });
    if (kw) kelasWali = { kelas_id: kw.kelas_id, nama_kelas: kw.nama_kelas };
  }

  // Buat token
  var token = generateToken();
  var durasiMenit = parseInt(configVal('DURASI_SESSION', 480));
  var expiry = new Date(Date.now() + durasiMenit * 60 * 1000).toISOString();

  var sessionData = {
    user_id:  user.user_id,
    username: user.username,
    role:     String(user.role),       // bisa 'GURU' | 'ADMIN' | 'GURU,WALI_KELAS' dst
    guru_id:  user.guru_id || '',
    nama:     guruData ? guruData.nama : user.username,
    kelas_wali: kelasWali,
    expiry:   expiry
  };

  PROPS.setProperty(TOKEN_PREFIX + token, JSON.stringify(sessionData));

  // [FIX 2026-09-19] Sebelumnya di sini ada update kolom last_login yang
  // melakukan FULL READ mentah (bypass cache) + 1 WRITE langsung ke sheet
  // 03_USER — 2 round-trip Sheets API tambahan di jalur kritis login, PADAHAL
  // last_login TIDAK PERNAH ditampilkan atau dipakai di manapun (dicek: tidak
  // ada di frontend maupun backend lain). Timestamp login tetap tercatat via
  // writeLog() di bawah (masuk ke 13_LOG). Dihapus supaya login lebih cepat —
  // login sekarang cukup 1 write (writeLog), bukan 3.
  writeLog(user.user_id, 'LOGIN', 'USER', 'Login berhasil — ' + user.username);

  return ok({
    token:   token,
    user_id: sessionData.user_id,
    nama:    sessionData.nama,
    role:    sessionData.role,
    guru_id: sessionData.guru_id,
    kelas_wali: kelasWali
  });
}

// ── Logout ────────────────────────────────────────────────────

function actionLogout(session) {
  // token key dikirim dari router
  writeLog(session.user_id, 'LOGOUT', 'USER', 'Logout — ' + session.username);
  return ok({ message: 'Logout berhasil' });
}

// ── Validasi token ────────────────────────────────────────────

/**
 * Return: { ok: true, session: {...} } atau { ok: false, error: '...' }
 */
function validateToken(token) {
  if (!token) return { ok: false, error: 'Token tidak ada' };

  var raw = PROPS.getProperty(TOKEN_PREFIX + token);
  if (!raw) return { ok: false, error: 'Token tidak valid atau sudah logout' };

  var session;
  try { session = JSON.parse(raw); } catch(e) {
    return { ok: false, error: 'Token rusak' };
  }

  if (new Date() > new Date(session.expiry)) {
    PROPS.deleteProperty(TOKEN_PREFIX + token);
    return { ok: false, error: 'Session expired, silakan login kembali' };
  }

  return { ok: true, session: session };
}

/**
 * Cek apakah session memiliki salah satu role yang dibutuhkan.
 * requiredRoles = ['ADMIN'] atau ['GURU','ADMIN'] dst.
 */
function hasRole(session, requiredRoles) {
  var userRoles = String(session.role).split(',').map(function(r) { return r.trim(); });
  return requiredRoles.some(function(r) { return userRoles.indexOf(r) >= 0; });
}

// ── Generate token ────────────────────────────────────────────

function generateToken() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var token = '';
  for (var i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ── Middleware helper (dipakai di router) ─────────────────────

/**
 * Ambil token dari header Authorization atau param token.
 * Return session object atau null.
 */
function getSession(e) {
  var token = '';

  // dari query param (GET) atau body
  if (e && e.parameter && e.parameter.token) {
    token = e.parameter.token;
  }
  // dari body POST
  if (!token && e && e.postData) {
    try {
      var body = JSON.parse(e.postData.contents);
      if (body.token) token = body.token;
    } catch(ex) {}
  }

  if (!token) return null;
  var result = validateToken(token);
  if (!result.ok) return null;
  return result.session;
}

// ── Cleanup expired tokens (bisa dipanggil trigger harian) ────

function cleanupExpiredTokens() {
  var allProps = PROPS.getProperties();
  var now = new Date();
  var deleted = 0;
  for (var key in allProps) {
    if (key.indexOf(TOKEN_PREFIX) === 0) {
      try {
        var s = JSON.parse(allProps[key]);
        if (now > new Date(s.expiry)) {
          PROPS.deleteProperty(key);
          deleted++;
        }
      } catch(e) {
        PROPS.deleteProperty(key);
        deleted++;
      }
    }
  }
  Logger.log('Cleaned up ' + deleted + ' expired tokens');
}
