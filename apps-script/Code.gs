// ============================================================
// Code.gs — Router Utama (doGet / doPost)
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
//
// Deploy sebagai Web App:
//   Execute as:  Me
//   Who has access: Anyone
//
// Semua request masuk ke sini, diteruskan ke handler yang sesuai.
// ============================================================

// ── Entry point GET ───────────────────────────────────────────

function doGet(e) {
  return handleRequest(e, 'GET');
}

// ── Trigger sederhana bawaan Google Sheets (OTOMATIS aktif begitu file ini
// ter-deploy — admin TIDAK PERLU setup trigger manual apapun) ───────────
//
// [BARU — arsitektur cache client-side, 2026-09-08] Naikkan DATA_VERSION
// setiap kali sheet MASTER DATA (bukan transaksional) diedit langsung di
// Spreadsheet, supaya cache di localStorage semua pengguna tahu kapan
// harus refresh. Sheet transaksional (10_JURNAL, 11_JURNAL_JAM,
// 12_KEHADIRAN, 13_LOG) SENGAJA TIDAK memicu ini — data itu memang selalu
// live di frontend, tidak pernah di-cache client-side.
//
// PENTING: hanya BOLEH ada SATU fungsi bernama `onEdit` di seluruh proyek
// (Apps Script menggabungkan semua file .gs jadi satu konteks global) —
// jangan tambahkan onEdit lain di file manapun.
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheetName = e.range.getSheet().getName();
    var sheetMasterData = ['04_GURU', '05_KELAS', '06_SISWA', '07_MAPEL', '09_JADWAL'];
    if (sheetMasterData.indexOf(sheetName) === -1) return;
    bumpDataVersion();
  } catch (err) {
    // Simple trigger TIDAK BOLEH melempar error yang terlihat admin.
  }
}

// ── Entry point POST ──────────────────────────────────────────

function doPost(e) {
  return handleRequest(e, 'POST');
}

// ── Router utama ──────────────────────────────────────────────

function handleRequest(e, method) {
  try {
    var params  = (e && e.parameter) ? e.parameter : {};
    var action  = String(params.action || '').trim();
    var body    = (method === 'POST') ? parseBody(e) : {};

    // ── Tidak ada action sama sekali (mis. akses URL polos tanpa query) ──
    if (!action) {
      return err('Parameter "action" wajib disertakan. Contoh: ?action=ping', 400);
    }

    // ── Endpoint publik (tidak perlu token) ──────────────────
    if (action === 'login')     return actionLogin(body);
    if (action === 'getConfig') return actionGetConfig();
    if (action === 'ping')      return ok({ status: 'ok', ts: nowTs() });
    // [BARU] Menu "Jadwal Kelas" di homepage: publik tanpa login (keputusan eksplisit user).
    // Hanya info jadwal (mapel/guru/jam), TIDAK ada data kehadiran/jurnal — aman diekspos publik.
    if (action === 'getJadwalKelasPublik') return actionGetJadwalKelasPublik(params, null);
    if (action === 'getKelasPublik')       return actionGetKelasPublik();

    // ── Semua endpoint lain butuh token ──────────────────────
    var session = getSession(e);
    if (!session) {
      // Coba dari body POST
      if (body.token) {
        var vr = validateToken(body.token);
        if (vr.ok) session = vr.session;
      }
    }
    if (!session) return err('Token tidak valid atau session expired', 401);

    // ── Logout ───────────────────────────────────────────────
    if (action === 'logout') return actionLogout(session);

    // ── Master Data (GET) ────────────────────────────────────
    if (action === 'getGuru')           return actionGetGuru(session);
    if (action === 'getKelas')          return actionGetKelas(session);
    if (action === 'getSiswa')          return actionGetSiswa(params, session);
    if (action === 'getMapel')          return actionGetMapel(session);
    if (action === 'getJam')            return actionGetJam(session);
    if (action === 'getUser')           return actionGetUser(session);

    // ── Jadwal ───────────────────────────────────────────────
    if (action === 'getJadwalHariIni')  return actionGetJadwalHariIni(params, session);
    if (action === 'getJadwalGuru')     return actionGetJadwalGuru(params, session);
    if (action === 'getJadwalKelas')    return actionGetJadwalKelas(params, session);
    if (action === 'getJadwalPerGuru')  return actionGetJadwalPerGuru(params, session);

    // ── Jurnal ───────────────────────────────────────────────
    if (action === 'createJurnal')      return actionCreateJurnal(body, session);
    if (action === 'updateJurnal')      return actionUpdateJurnal(body, session);
    if (action === 'getJurnalSaya')     return actionGetJurnalSaya(params, session);
    if (action === 'getDetailJurnal')   return actionGetDetailJurnal(params, session);
    if (action === 'getJurnalKelas')    return actionGetJadwalKelas(params, session);

    // ── Admin ────────────────────────────────────────────────
    if (action === 'getAllJurnal')       return actionGetAllJurnal(params, session);
    if (action === 'updateConfig')       return actionUpdateConfig(body, session);
    if (action === 'getLog')             return actionGetLog(params, session);

    return err('Action tidak dikenal: ' + action, 404);

  } catch (ex) {
    Logger.log('ERROR: ' + ex.toString() + ' | Stack: ' + ex.stack);
    return err('Terjadi kesalahan server: ' + ex.message, 500);
  }
}

// ── Log endpoint (Admin, dengan pagination) ────────────────────

/**
 * params: { page?, pageSize? }
 * Log diurutkan dari yang TERBARU dulu. Default pageSize 25.
 */
function actionGetLog(params, session) {
  if (!hasRole(session, ['ADMIN'])) return err('Akses ditolak', 403);
  var rows = readSheet('13_LOG').slice(); // copy supaya reverse tidak mengubah cache
  rows.reverse(); // terbaru dulu
  var paged = paginate(rows, params.page, params.pageSize || 25);
  return ok({
    items: paged.items,
    page: paged.page,
    pageSize: paged.pageSize,
    totalItems: paged.totalItems,
    totalPages: paged.totalPages,
  });
}

// ── Setup trigger harian (jalankan sekali manual) ─────────────

function setupTriggers() {
  // Hapus trigger lama
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });
  // Bersihkan token expired setiap hari jam 3 pagi
  ScriptApp.newTrigger('cleanupExpiredTokens')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  Logger.log('Trigger setup selesai');
}

// ── Test manual (jalankan dari editor) ───────────────────────

function testPing() {
  var result = handleRequest({ parameter: { action: 'ping' } }, 'GET');
  Logger.log(result.getContent());
}

function testLogin() {
  var e = {
    parameter: { action: 'login' },
    postData: { contents: JSON.stringify({ username: 'budi_s', password: 'budi123' }) }
  };
  var result = handleRequest(e, 'POST');
  Logger.log(result.getContent());
}
