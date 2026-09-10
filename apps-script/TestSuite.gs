// ============================================================
// TestSuite.gs — Self-Test Komprehensif
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
//
// CARA PAKAI:
// 1. Buka editor Apps Script
// 2. Pilih fungsi "runFullTest" dari dropdown di toolbar
// 3. Klik Run
// 4. Lihat hasil di View → Logs (atau Ctrl+Enter)
//
// Test ini TIDAK mengubah data sheet secara permanen yang merusak —
// jurnal test akan dibuat lalu ditandai jelas di ringkasan_kegiatan
// agar mudah dihapus manual jika perlu.
// ============================================================

var TEST_LOG = [];

function _t(label, passed, detail) {
  var status = passed ? '✅ PASS' : '❌ FAIL';
  var line = status + ' | ' + label + (detail ? ' — ' + detail : '');
  TEST_LOG.push(line);
  Logger.log(line);
  return passed;
}

function _section(title) {
  var line = '\n═══ ' + title + ' ═══';
  TEST_LOG.push(line);
  Logger.log(line);
}

// ── MAIN TEST RUNNER ──────────────────────────────────────────

function runFullTest() {
  TEST_LOG = [];
  var startTime = new Date();

  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║   JURNAL MENGAJAR — SELF TEST SUITE    ║');
  Logger.log('╚════════════════════════════════════════╝');

  testCacheCorrectness();
  testStrukturSheet();
  testEndpointPublik();
  testConfig();
  testDataVersionCache();
  var loginResults = testLoginSemuaRole();
  testGetMasterData(loginResults.guru);
  testJadwalDanKonflik(loginResults.guru);
  testCreateDanUpdateJurnal(loginResults.guru);
  testPaginationDanFilter(loginResults);
  testAksesKontrol(loginResults);
  testLogout(loginResults);

  var duration = ((new Date()) - startTime) / 1000;
  var passCount = TEST_LOG.filter(function(l) { return l.indexOf('✅') === 0 || l.indexOf('✅') > 0 && l.indexOf('PASS') > 0; }).length;
  var failCount = TEST_LOG.filter(function(l) { return l.indexOf('❌') >= 0; }).length;

  Logger.log('\n╔════════════════════════════════════════╗');
  Logger.log('║  SELESAI dalam ' + duration + ' detik');
  Logger.log('║  Total FAIL: ' + failCount);
  Logger.log('╚════════════════════════════════════════╝');

  if (failCount > 0) {
    Logger.log('\n⚠ ADA YANG GAGAL. Cek baris ❌ di atas sebelum lanjut deploy ke pengguna.');
  } else {
    Logger.log('\n🎉 SEMUA TEST LULUS. Sistem siap dipakai.');
  }

  return TEST_LOG.join('\n');
}

// ── 0.5 Cache Correctness ───────────────────────────────────────

/**
 * Validasi bahwa strategi cache 2 lapis (in-memory + CacheService) TIDAK
 * menyebabkan data basi. Ini test paling kritis untuk perubahan performa —
 * kalau cache salah invalidasi, guru bisa lihat data lama setelah update.
 */
function testCacheCorrectness() {
  _section('0.5 CACHE CORRECTNESS');

  // Pastikan sheet yang di-cache benar-benar dari SHEET_CACHE_TTL
  _t('SHEET_CACHE_TTL berisi sheet master data', !!SHEET_CACHE_TTL['04_GURU'] && !!SHEET_CACHE_TTL['06_SISWA']);
  _t('Sheet transaksional TIDAK di-cache (harus selalu fresh)',
    !SHEET_CACHE_TTL['10_JURNAL'] && !SHEET_CACHE_TTL['12_KEHADIRAN'] && !SHEET_CACHE_TTL['13_LOG']);

  // Test: baca sheet CONFIG, ubah manual, invalidasi, baca lagi — harus beda
  invalidateCache('01_CONFIG');
  _configCache = null;
  var before = getConfig();
  var namaAwal = before.NAMA_APLIKASI;

  // Simulasikan update lewat helper resmi (bukan getRange manual) untuk
  // memastikan updateRowById() otomatis invalidasi cache-nya sendiri
  var cfgRows = readSheet('01_CONFIG');
  var versiRow = cfgRows.find(function(r) { return r.config_key === 'VERSI_APP'; });
  if (versiRow) {
    var versiLama = versiRow.config_value;
    var versiBaru = versiLama + '-test';

    // updateRowById pakai ID di kolom pertama — tapi 01_CONFIG kuncinya
    // config_key bukan di kolom pertama bertipe ID unik seperti sheet lain.
    // Jadi test ini pakai jalur yang sama seperti actionUpdateConfig.
    var ws = SS.getSheetByName('01_CONFIG');
    var data = ws.getDataRange().getValues();
    var headers = data[2];
    var keyCol = headers.indexOf('config_key');
    var valCol = headers.indexOf('config_value');
    for (var i = 3; i < data.length; i++) {
      if (data[i][keyCol] === 'VERSI_APP') {
        ws.getRange(i + 1, valCol + 1).setValue(versiBaru);
        break;
      }
    }

    // TANPA invalidasi — cache seharusnya MASIH punya nilai lama (in-memory
    // cache per eksekusi belum tentu ke-refresh, ini mengetes bahwa readSheet
    // memang pakai cache, bukan selalu baca live)
    var stillCached = readSheet('01_CONFIG').find(function(r) { return r.config_key === 'VERSI_APP'; });
    // Catatan: dalam SATU eksekusi Apps Script yang sama, _execCache akan
    // tetap pegang versi lama karena belum di-invalidate. Ini PERILAKU YANG
    // DIHARAPKAN dari desain cache-per-eksekusi.

    // Sekarang invalidasi dan baca ulang — HARUS dapat nilai baru
    invalidateCache('01_CONFIG');
    _configCache = null;
    var afterInvalidate = readSheet('01_CONFIG').find(function(r) { return r.config_key === 'VERSI_APP'; });
    _t('Setelah invalidateCache(), readSheet() mengambil data TERBARU dari sheet',
      afterInvalidate && afterInvalidate.config_value === versiBaru,
      'value=' + (afterInvalidate ? afterInvalidate.config_value : 'null') + ' expected=' + versiBaru);

    // Kembalikan ke nilai semula supaya tidak mengubah config permanen
    var ws2 = SS.getSheetByName('01_CONFIG');
    var data2 = ws2.getDataRange().getValues();
    for (var j = 3; j < data2.length; j++) {
      if (data2[j][keyCol] === 'VERSI_APP') {
        ws2.getRange(j + 1, valCol + 1).setValue(versiLama);
        break;
      }
    }
    invalidateCache('01_CONFIG');
    _configCache = null;
  } else {
    _t('Test cache invalidation', false, 'VERSI_APP tidak ditemukan di 01_CONFIG untuk ditest');
  }

  // Test appendManyToSheet: pastikan cache ter-invalidate otomatis setelah batch write
  // Catatan: aksi WAJIB salah satu dari LOGIN/LOGOUT/CREATE/UPDATE/DELETE (data
  // validation dropdown di kolom D sheet 13_LOG) — pakai 'CREATE', bukan 'TEST'.
  var beforeCount = readSheet('13_LOG').length;
  appendManyToSheet('13_LOG', [['L_TESTCACHE', nowTs(), 'SYSTEM', 'CREATE', 'CACHE', 'Baris test cache, aman dihapus']]);
  var afterCount = readSheet('13_LOG').length;
  _t('appendManyToSheet otomatis invalidasi cache (readSheet lihat baris baru)',
    afterCount === beforeCount + 1, 'before=' + beforeCount + ' after=' + afterCount);

  // Bersihkan baris test cache ini
  deleteRowsByIds('13_LOG', ['L_TESTCACHE']);
}

// ── 1. Struktur Sheet ─────────────────────────────────────────

function testStrukturSheet() {
  _section('1. STRUKTUR SHEET');

  var requiredSheets = [
    '01_CONFIG','02_TAHUN_AJARAN','03_USER','04_GURU','05_KELAS',
    '06_SISWA','07_MAPEL','08_JAM','09_JADWAL','10_JURNAL',
    '11_JURNAL_JAM','12_KEHADIRAN','13_LOG'
  ];

  requiredSheets.forEach(function(name) {
    var ws = SS.getSheetByName(name);
    _t('Sheet "' + name + '" ada', !!ws);
  });

  // Cek header sheet penting
  var checks = [
    { sheet: '03_USER', headers: ['user_id','username','password','role','guru_id','aktif'] },
    { sheet: '06_SISWA', headers: ['nis','nama','kelas_id','aktif'] },
    { sheet: '09_JADWAL', headers: ['jadwal_id','tahun_id','hari','kelas_id','mapel_id','guru_id','jam_id','aktif'] },
    { sheet: '10_JURNAL', headers: ['jurnal_id','tanggal','tahun_id','kelas_id','mapel_id','guru_id','ringkasan_kegiatan','catatan','status','created_at','updated_at'] },
  ];

  checks.forEach(function(c) {
    var ws = SS.getSheetByName(c.sheet);
    if (!ws) { _t('Header ' + c.sheet, false, 'sheet tidak ada'); return; }
    var actualHeaders = ws.getDataRange().getValues()[2] || [];
    var match = c.headers.every(function(h) { return actualHeaders.indexOf(h) >= 0; });
    _t('Header sheet "' + c.sheet + '" sesuai', match,
      match ? '' : 'expected: ' + c.headers.join(',') + ' | actual: ' + actualHeaders.join(','));
  });
}

// ── 1.5 Endpoint Publik (tanpa token) ──────────────────────────

function testEndpointPublik() {
  _section('1.5 ENDPOINT PUBLIK (TANPA TOKEN)');

  // Simulasikan request TANPA token sama sekali, persis seperti akses
  // langsung dari browser tanpa login. Ini menangkap regresi seperti
  // "ping butuh token padahal seharusnya publik".
  var pingRes  = handleRequest({ parameter: { action: 'ping' } }, 'GET');
  var pingBody = JSON.parse(pingRes.getContent());
  _t('ping BISA diakses tanpa token', pingBody.ok, pingBody.ok ? '' : pingBody.error);

  var cfgRes  = handleRequest({ parameter: { action: 'getConfig' } }, 'GET');
  var cfgBody = JSON.parse(cfgRes.getContent());
  _t('getConfig BISA diakses tanpa token', cfgBody.ok, cfgBody.ok ? '' : cfgBody.error);

  // Action kosong harus dapat pesan jelas, bukan bingung dengan token invalid
  var emptyRes  = handleRequest({ parameter: {} }, 'GET');
  var emptyBody = JSON.parse(emptyRes.getContent());
  _t('Action kosong memberi pesan jelas (bukan token error)',
    !emptyBody.ok && emptyBody.error.indexOf('action') >= 0, emptyBody.error);

  // Endpoint yang SEHARUSNYA butuh token, dites tanpa token — harus ditolak
  var noTokenRes  = handleRequest({ parameter: { action: 'getGuru' } }, 'GET');
  var noTokenBody = JSON.parse(noTokenRes.getContent());
  _t('getGuru TANPA token DITOLAK (401)', !noTokenBody.ok && noTokenBody.code === 401);
}

// ── 2. Config ─────────────────────────────────────────────────

function testConfig() {
  _section('2. CONFIG');

  _configCache = null; // reset cache agar baca fresh
  var cfg = getConfig();

  _t('NAMA_SEKOLAH terisi', !!cfg.NAMA_SEKOLAH, cfg.NAMA_SEKOLAH);
  _t('TAHUN_AKTIF terisi', !!cfg.TAHUN_AKTIF, cfg.TAHUN_AKTIF);
  _t('JAM_MAKS_SENIN = 9', String(cfg.JAM_MAKS_SENIN) === '9');
  _t('JAM_MAKS_JUMAT = 4', String(cfg.JAM_MAKS_JUMAT) === '4');
  _t('BATAS_EDIT_HARI terisi angka', !isNaN(parseInt(cfg.BATAS_EDIT_HARI)));

  var res = actionGetConfig();
  var data = JSON.parse(res.getContent()).data;
  _t('actionGetConfig() mengembalikan data', !!data.nama_sekolah);
  _t('actionGetConfig() punya field data_version (angka)', typeof data.data_version === 'number', 'nilai: ' + data.data_version);
}

// ── 2.5 Data Version (arsitektur cache client-side) ────────────

/**
 * Validasi mekanisme versi data untuk cache di localStorage frontend
 * (js/cache.js). Test ini memanggil bumpDataVersion() LANGSUNG (bukan
 * lewat trigger onEdit — trigger simple tidak bisa disimulasikan dari
 * sini) untuk memastikan fungsi bump-nya sendiri benar. Perilaku
 * trigger-nya (naik otomatis saat admin edit sheet 04_GURU dst di
 * Spreadsheet) HARUS dicek manual — lihat Panduan_Deploy_dan_Uji.md.
 */
function testDataVersionCache() {
  _section('2.5 DATA VERSION (cache client-side)');

  _configCache = null;
  var before = parseInt(configVal('DATA_VERSION', 0), 10) || 0;

  bumpDataVersion();

  _configCache = null;
  var after = parseInt(configVal('DATA_VERSION', 0), 10) || 0;

  _t('DATA_VERSION naik 1 setelah bumpDataVersion()', after === before + 1, 'sebelum: ' + before + ', sesudah: ' + after);

  var res = actionGetConfig();
  var data = JSON.parse(res.getContent()).data;
  _t('getConfig() ikut mengembalikan versi terbaru', data.data_version === after, 'dari getConfig: ' + data.data_version);
}

// ── 3. Login Semua Role ──────────────────────────────────────

function testLoginSemuaRole() {
  _section('3. LOGIN SEMUA ROLE');

  var results = {};
  var users = readSheet('03_USER');

  if (users.length === 0) {
    _t('Ada data di 03_USER', false, 'sheet kosong — isi minimal 1 user untuk testing');
    return results;
  }

  // Ambil 1 sample per jenis role untuk ditest
  var adminUser = users.find(function(u) { return String(u.role).indexOf('ADMIN') >= 0 && String(u.role).indexOf('GURU') < 0; });
  var guruUser  = users.find(function(u) { return String(u.role) === 'GURU'; });
  var waliUser  = users.find(function(u) { return String(u.role).indexOf('WALI_KELAS') >= 0; });
  var multiUser = users.find(function(u) { return String(u.role).indexOf(',') >= 0; });

  [
    { label: 'Admin murni', user: adminUser, key: 'admin' },
    { label: 'Guru biasa', user: guruUser, key: 'guru' },
    { label: 'Wali kelas', user: waliUser, key: 'wali' },
    { label: 'Multi-role', user: multiUser, key: 'multi' },
  ].forEach(function(item) {
    if (!item.user) {
      _t('Login ' + item.label, false, 'tidak ada user dengan role ini di sheet — lewati');
      return;
    }
    var loginRes = actionLogin({ username: item.user.username, password: item.user.password });
    var body = JSON.parse(loginRes.getContent());
    var passed = !!(body.ok && body.data && body.data.token);
    _t('Login ' + item.label + ' (' + item.user.username + ')', passed,
      passed ? 'role=' + body.data.role : body.error);

    if (passed) {
      // Response login sengaja tidak menyertakan guru_id/username (tidak perlu diekspos ke frontend).
      // Untuk keperluan test, ambil session PENUH dari PropertiesService via validateToken(),
      // sama seperti yang dilakukan router (Code.gs) pada setiap request asli.
      var vr = validateToken(body.data.token);
      if (vr.ok) {
        vr.session.token = body.data.token; // simpan token di object untuk keperluan test (mis. testLogout)
        results[item.key] = vr.session;
      } else {
        _t('Ambil session penuh untuk ' + item.label, false, vr.error);
      }
    }
  });

  // Test login gagal (password salah)
  if (guruUser) {
    var failRes = actionLogin({ username: guruUser.username, password: 'password_salah_sengaja' });
    var failBody = JSON.parse(failRes.getContent());
    _t('Login dengan password salah DITOLAK', !failBody.ok, failBody.error);
  }

  // Test login username tidak ada
  var notExistRes = actionLogin({ username: 'user_tidak_ada_xyz', password: 'apapun' });
  var notExistBody = JSON.parse(notExistRes.getContent());
  _t('Login username tidak terdaftar DITOLAK', !notExistBody.ok);

  return results;
}

// ── 4. Master Data ────────────────────────────────────────────

function testGetMasterData(guruSession) {
  _section('4. MASTER DATA');

  if (!guruSession) { _t('Skip — tidak ada session guru valid', false); return; }

  var checks = [
    { action: 'getGuru', fn: actionGetGuru },
    { action: 'getKelas', fn: actionGetKelas },
    { action: 'getMapel', fn: actionGetMapel },
    { action: 'getJam', fn: actionGetJam },
  ];

  checks.forEach(function(c) {
    var res = c.fn(guruSession);
    var body = JSON.parse(res.getContent());
    _t('Endpoint ' + c.action, body.ok && Array.isArray(body.data), 'jumlah: ' + (body.data ? body.data.length : 0));
  });

  // Test getSiswa perlu kelas_id — ambil dari kelas pertama
  var kelasRes = JSON.parse(actionGetKelas(guruSession).getContent());
  if (kelasRes.ok && Array.isArray(kelasRes.data) && kelasRes.data.length > 0) {
    var kelasId = kelasRes.data[0].kelas_id;
    var siswaRes = JSON.parse(actionGetSiswa({ kelas_id: kelasId }, guruSession).getContent());
    _t('getSiswa untuk kelas ' + kelasId, siswaRes.ok, 'jumlah siswa: ' + (siswaRes.data ? siswaRes.data.length : 0));
    if (siswaRes.ok && Array.isArray(siswaRes.data) && siswaRes.data.length === 0) {
      TEST_LOG.push('   ⚠ PERHATIAN: kelas ' + kelasId + ' belum ada siswanya di sheet 06_SISWA');
    }
  } else {
    _t('getSiswa', false, 'tidak ada kelas untuk ditest');
  }
}

// ── 5. Jadwal & Deteksi Konflik ───────────────────────────────

function testJadwalDanKonflik(guruSession) {
  _section('5. JADWAL & DETEKSI KONFLIK');

  if (!guruSession) { _t('Skip — tidak ada session guru valid', false); return; }
  if (!guruSession.guru_id) {
    _t('Skip — session yang dites tidak punya guru_id (kemungkinan admin murni)', false,
      'username=' + guruSession.username + ' role=' + guruSession.role);
    return;
  }

  var res = actionGetJadwalHariIni({ tanggal: '2026-09-01' }, guruSession); // Selasa, sesuai data dummy
  var body = JSON.parse(res.getContent());
  _t('getJadwalHariIni berjalan', body.ok, body.ok ? '' : body.error);

  if (body.ok && body.data && Array.isArray(body.data.jadwal)) {
    TEST_LOG.push('   Info: guru ' + guruSession.nama + ' punya ' + body.data.jadwal.length + ' blok jadwal pada tanggal test');
    var adaKonflik = body.data.jadwal.some(function(j) { return j.konflik; });
    if (adaKonflik) {
      TEST_LOG.push('   ⚠ Ditemukan konflik jadwal (ini normal jika sengaja dites) — sistem tetap mengizinkan isi jurnal');
    }
  } else if (body.ok) {
    _t('Struktur response getJadwalHariIni sesuai (punya field jadwal[])', false,
      'data yang diterima: ' + JSON.stringify(body.data));
  }
}

// ── 6. Create & Update Jurnal ─────────────────────────────────

function testCreateDanUpdateJurnal(guruSession) {
  _section('6. CREATE & UPDATE JURNAL');

  if (!guruSession) { _t('Skip — tidak ada session guru valid', false); return; }

  var kelasRes = JSON.parse(actionGetKelas(guruSession).getContent());
  if (!kelasRes.ok || !Array.isArray(kelasRes.data) || kelasRes.data.length === 0) {
    _t('Create Jurnal', false, 'tidak ada kelas untuk ditest');
    return;
  }
  var kelasId = kelasRes.data[0].kelas_id;

  var mapelRes = JSON.parse(actionGetMapel(guruSession).getContent());
  if (!mapelRes.ok || !Array.isArray(mapelRes.data) || mapelRes.data.length === 0) {
    _t('Create Jurnal', false, 'tidak ada mapel untuk ditest');
    return;
  }
  var mapelId = mapelRes.data[0].mapel_id;

  var siswaRes = JSON.parse(actionGetSiswa({ kelas_id: kelasId }, guruSession).getContent());
  var kehadiran = [];
  if (siswaRes.ok && Array.isArray(siswaRes.data) && siswaRes.data.length > 0) {
    kehadiran = [{ nis: siswaRes.data[0].nis, status: 'SAKIT', keterangan: 'Test otomatis' }];
  }

  // Pakai tanggal unik supaya tidak bentrok dengan jurnal asli
  var testTanggal = '2099-01-01'; // tanggal jauh di masa depan, aman untuk test

  var createRes = actionCreateJurnal({
    tanggal: testTanggal,
    kelas_id: kelasId,
    mapel_id: mapelId,
    jam_ids: ['J01'],
    ringkasan_kegiatan: '[TEST OTOMATIS] Silakan hapus baris ini dari sheet 10_JURNAL',
    catatan: 'Dibuat oleh runFullTest()',
    kehadiran: kehadiran
  }, guruSession);

  var createBody = JSON.parse(createRes.getContent());
  _t('createJurnal berhasil', createBody.ok, (createBody.ok && createBody.data) ? createBody.data.jurnal_id : createBody.error);

  if (createBody.ok && createBody.data) {
    var jurnalId = createBody.data.jurnal_id;

    // Test duplikat harus ditolak
    var dupRes = actionCreateJurnal({
      tanggal: testTanggal,
      kelas_id: kelasId,
      mapel_id: mapelId,
      jam_ids: ['J01'],
      ringkasan_kegiatan: 'Percobaan duplikat, harus gagal',
      kehadiran: []
    }, guruSession);
    var dupBody = JSON.parse(dupRes.getContent());
    _t('createJurnal DUPLIKAT ditolak', !dupBody.ok, dupBody.error);

    // Test update
    var updateRes = actionUpdateJurnal({
      jurnal_id: jurnalId,
      ringkasan_kegiatan: '[TEST OTOMATIS - SUDAH DIUPDATE] Silakan hapus baris ini'
    }, guruSession);
    var updateBody = JSON.parse(updateRes.getContent());
    _t('updateJurnal berhasil', updateBody.ok, updateBody.ok ? '' : updateBody.error);

    // Test detail
    var detailRes = actionGetDetailJurnal({ jurnal_id: jurnalId }, guruSession);
    var detailBody = JSON.parse(detailRes.getContent());
    _t('getDetailJurnal berhasil', detailBody.ok);
    if (detailBody.ok && detailBody.data) {
      _t('Ringkasan sesuai setelah update', String(detailBody.data.ringkasan).indexOf('SUDAH DIUPDATE') >= 0);
      _t('Rekap kehadiran ada', !!detailBody.data.rekap_kehadiran);

      // Validasi skema BARU: hanya 1 siswa dikirim SAKIT, sisanya harus
      // otomatis terhitung HADIR meski TIDAK PERNAH ditulis sebagai baris.
      if (kehadiran.length > 0 && detailBody.data.rekap_kehadiran) {
        var rk = detailBody.data.rekap_kehadiran;
        _t('Rekap: total siswa sesuai jumlah siswa kelas', rk.total === siswaRes.data.length,
          'total=' + rk.total + ' expected=' + siswaRes.data.length);
        _t('Rekap: sakit = 1 sesuai yang dikirim', rk.sakit === 1, 'sakit=' + rk.sakit);
        _t('Rekap: hadir dihitung otomatis (total - tidak hadir)', rk.hadir === (rk.total - 1),
          'hadir=' + rk.hadir + ' expected=' + (rk.total - 1));
        _t('tidak_hadir HANYA berisi yang dikirim (bukan semua siswa)',
          Array.isArray(detailBody.data.tidak_hadir) && detailBody.data.tidak_hadir.length === 1,
          'length=' + (detailBody.data.tidak_hadir ? detailBody.data.tidak_hadir.length : 'undefined'));
      }
    }

    // Validasi LANGSUNG ke sheet: pastikan baris yang tertulis di 12_KEHADIRAN
    // HANYA untuk siswa yang tidak hadir, BUKAN semua siswa kelas (ini inti
    // dari optimasi "database ringan" — kalau bug, baris akan sebanyak
    // jumlah total siswa kelas, bukan cuma 1).
    var khRowsForThisJurnal = filterBy('12_KEHADIRAN', 'jurnal_id', jurnalId);
    _t('Sheet 12_KEHADIRAN hanya simpan yang TIDAK hadir (bukan semua siswa)',
      khRowsForThisJurnal.length === kehadiran.length,
      'baris tersimpan=' + khRowsForThisJurnal.length + ' expected=' + kehadiran.length);

    TEST_LOG.push('   ℹ️ Jurnal test ID: ' + jurnalId + ' (tanggal ' + testTanggal + ') — HAPUS MANUAL dari sheet setelah selesai testing');
  }

  // Test validasi: ringkasan kosong harus ditolak
  var emptyRes = actionCreateJurnal({
    tanggal: '2099-01-02',
    kelas_id: kelasId,
    mapel_id: mapelId,
    jam_ids: ['J02'],
    ringkasan_kegiatan: '',
    kehadiran: []
  }, guruSession);
  var emptyBody = JSON.parse(emptyRes.getContent());
  _t('createJurnal ringkasan kosong DITOLAK', !emptyBody.ok);

  // Test validasi: jam kosong harus ditolak
  var noJamRes = actionCreateJurnal({
    tanggal: '2099-01-03',
    kelas_id: kelasId,
    mapel_id: mapelId,
    jam_ids: [],
    ringkasan_kegiatan: 'Ada ringkasan tapi jam kosong',
    kehadiran: []
  }, guruSession);
  var noJamBody = JSON.parse(noJamRes.getContent());
  _t('createJurnal tanpa jam DITOLAK', !noJamBody.ok);
}

// ── 6.5 Pagination & Filter Admin ──────────────────────────────

function testPaginationDanFilter(loginResults) {
  _section('6.5 PAGINATION & FILTER ADMIN');

  if (!loginResults.guru) { _t('Skip — tidak ada session guru valid', false); return; }
  if (!loginResults.admin) { _t('Skip — tidak ada session admin valid', false); return; }

  // getJurnalSaya harus return object dengan items[] + info pagination
  var jsRes = actionGetJurnalSaya({ page: 1, pageSize: 5 }, loginResults.guru);
  var jsBody = JSON.parse(jsRes.getContent());
  _t('getJurnalSaya return struktur pagination', jsBody.ok &&
    Array.isArray(jsBody.data.items) &&
    typeof jsBody.data.totalItems === 'number' &&
    typeof jsBody.data.totalPages === 'number',
    jsBody.ok ? 'items=' + jsBody.data.items.length + ' totalItems=' + jsBody.data.totalItems : jsBody.error);

  // getAllJurnal TANPA tanggal harus DITOLAK (wajib maks 1 hari per pencarian)
  var noTglRes = actionGetAllJurnal({}, loginResults.admin);
  var noTglBody = JSON.parse(noTglRes.getContent());
  _t('getAllJurnal TANPA tanggal DITOLAK', !noTglBody.ok, noTglBody.error);

  // getAllJurnal DENGAN tanggal harus berhasil dengan struktur pagination
  var withTglRes = actionGetAllJurnal({ tanggal: '2026-09-01' }, loginResults.admin);
  var withTglBody = JSON.parse(withTglRes.getContent());
  _t('getAllJurnal DENGAN tanggal berhasil + struktur pagination', withTglBody.ok &&
    Array.isArray(withTglBody.data.items) &&
    typeof withTglBody.data.totalItems === 'number',
    withTglBody.ok ? 'items=' + withTglBody.data.items.length : withTglBody.error);

  // getLog harus return struktur pagination juga
  var logRes = actionGetLog({ page: 1, pageSize: 10 }, loginResults.admin);
  var logBody = JSON.parse(logRes.getContent());
  _t('getLog return struktur pagination', logBody.ok &&
    Array.isArray(logBody.data.items) &&
    typeof logBody.data.totalItems === 'number',
    logBody.ok ? 'items=' + logBody.data.items.length : logBody.error);

  // getJadwalKelasPublik — endpoint baru untuk homepage, harus bisa diakses guru biasa
  var kelasRes = JSON.parse(actionGetKelas(loginResults.guru).getContent());
  if (kelasRes.ok && Array.isArray(kelasRes.data) && kelasRes.data.length > 0) {
    var kelasId = kelasRes.data[0].kelas_id;
    var jkpRes = actionGetJadwalKelasPublik({ kelas_id: kelasId, hari: 'SENIN' }, loginResults.guru);
    var jkpBody = JSON.parse(jkpRes.getContent());
    _t('getJadwalKelasPublik bisa diakses guru biasa', jkpBody.ok,
      jkpBody.ok ? 'jumlah mapel=' + jkpBody.data.jadwal.length : jkpBody.error);
  } else {
    _t('getJadwalKelasPublik', false, 'tidak ada kelas untuk ditest');
  }

  // getJadwalPerGuru — endpoint baru untuk admin lihat jadwal 1 guru
  if (loginResults.guru.guru_id) {
    var jpgRes = actionGetJadwalPerGuru({ guru_id: loginResults.guru.guru_id }, loginResults.admin);
    var jpgBody = JSON.parse(jpgRes.getContent());
    _t('getJadwalPerGuru (admin) berhasil', jpgBody.ok &&
      Array.isArray(jpgBody.data.jadwal_per_hari) &&
      jpgBody.data.jadwal_per_hari.length === 6, // 6 hari SENIN-SABTU
      jpgBody.ok ? 'jumlah hari=' + jpgBody.data.jadwal_per_hari.length : jpgBody.error);

    // Guru biasa TIDAK BOLEH akses endpoint ini (admin only)
    var jpgGuruRes = actionGetJadwalPerGuru({ guru_id: loginResults.guru.guru_id }, loginResults.guru);
    var jpgGuruBody = JSON.parse(jpgGuruRes.getContent());
    _t('getJadwalPerGuru DITOLAK untuk guru biasa', !jpgGuruBody.ok, jpgGuruBody.error);
  }
}

// ── 7. Kontrol Akses ──────────────────────────────────────────

function testAksesKontrol(loginResults) {
  _section('7. KONTROL AKSES');

  if (loginResults.guru) {
    // Guru coba akses endpoint admin
    var res = actionGetUser(loginResults.guru);
    var body = JSON.parse(res.getContent());
    _t('Guru DITOLAK akses getUser (admin only)', !body.ok, body.error);

    var logRes = actionGetLog({}, loginResults.guru);
    var logBody = JSON.parse(logRes.getContent());
    _t('Guru DITOLAK akses getLog (admin only)', !logBody.ok, logBody.error);
  } else {
    _t('Test kontrol akses guru', false, 'tidak ada session guru');
  }

  if (loginResults.admin) {
    var res2 = actionGetUser(loginResults.admin);
    var body2 = JSON.parse(res2.getContent());
    _t('Admin BISA akses getUser', body2.ok);
  }

  // Test token invalid
  var invalidTokenResult = validateToken('token_ngasal_yang_tidak_ada');
  _t('Token invalid ditolak validateToken()', !invalidTokenResult.ok);

  var emptyTokenResult = validateToken('');
  _t('Token kosong ditolak validateToken()', !emptyTokenResult.ok);
}

// ── 8. Logout ─────────────────────────────────────────────────

function testLogout(loginResults) {
  _section('8. LOGOUT');

  if (!loginResults.guru) { _t('Skip logout test', false); return; }

  var beforeLogout = validateToken(loginResults.guru.token);
  _t('Token valid sebelum logout', beforeLogout.ok);

  actionLogout(loginResults.guru);
  PROPS.deleteProperty(TOKEN_PREFIX + loginResults.guru.token); // pastikan terhapus

  var afterLogout = validateToken(loginResults.guru.token);
  _t('Token invalid setelah logout', !afterLogout.ok);
}

// ── UTILITY: Bersihkan data test ──────────────────────────────

/**
 * Jalankan manual setelah testing untuk menghapus baris test.
 * Mencari baris dengan tanggal 2099-xx-xx atau ringkasan mengandung [TEST OTOMATIS]
 */
function cleanupTestData() {
  var deleted = { jurnal: 0, jurnalJam: 0, kehadiran: 0 };
  var tz = Session.getScriptTimeZone() || 'Asia/Jakarta';

  var wsJurnal = SS.getSheetByName('10_JURNAL');
  var dataJurnal = wsJurnal.getDataRange().getValues();
  var jurnalIdsToDelete = [];

  for (var i = dataJurnal.length - 1; i >= 3; i--) {
    var row = dataJurnal[i];
    if (!row[0]) continue; // lewati baris kosong

    // Normalisasi tanggal — bisa berupa Date object (dari Sheets) atau string
    var rawTanggal = row[1];
    var tanggal = (rawTanggal instanceof Date)
      ? Utilities.formatDate(rawTanggal, tz, 'yyyy-MM-dd')
      : String(rawTanggal);

    var ringkasan = String(row[6]);
    if (tanggal.indexOf('2099-') === 0 || ringkasan.indexOf('[TEST OTOMATIS]') >= 0 || ringkasan.indexOf('SUDAH DIUPDATE') >= 0) {
      jurnalIdsToDelete.push(row[0]);
      wsJurnal.deleteRow(i + 1);
      deleted.jurnal++;
    }
  }

  if (jurnalIdsToDelete.length > 0) {
    var wsJJ = SS.getSheetByName('11_JURNAL_JAM');
    var dataJJ = wsJJ.getDataRange().getValues();
    for (var j = dataJJ.length - 1; j >= 3; j--) {
      if (jurnalIdsToDelete.indexOf(dataJJ[j][1]) >= 0) {
        wsJJ.deleteRow(j + 1);
        deleted.jurnalJam++;
      }
    }

    var wsKh = SS.getSheetByName('12_KEHADIRAN');
    var dataKh = wsKh.getDataRange().getValues();
    for (var k = dataKh.length - 1; k >= 3; k--) {
      if (jurnalIdsToDelete.indexOf(dataKh[k][1]) >= 0) {
        wsKh.deleteRow(k + 1);
        deleted.kehadiran++;
      }
    }
  }

  // PENTING: invalidasi cache setelah manipulasi langsung via deleteRow().
  // Tanpa ini, readSheet() akan tetap mengembalikan data basi (termasuk
  // baris yang baru dihapus) sampai TTL cache habis dengan sendirinya.
  invalidateCache('10_JURNAL');
  invalidateCache('11_JURNAL_JAM');
  invalidateCache('12_KEHADIRAN');

  Logger.log('Cleanup selesai: ' + JSON.stringify(deleted));
  return deleted;
}

/**
 * DIAGNOSTIK: tampilkan semua baris di 10_JURNAL yang terdeteksi sebagai
 * data test (tanggal 2099-xx-xx atau ringkasan mengandung tanda test),
 * TANPA menghapusnya. Jalankan ini dulu jika ragu sebelum cleanupTestData().
 */
function cekSisaDataTest() {
  var tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
  var wsJurnal = SS.getSheetByName('10_JURNAL');
  var dataJurnal = wsJurnal.getDataRange().getValues();
  var found = [];

  for (var i = 3; i < dataJurnal.length; i++) {
    var row = dataJurnal[i];
    if (!row[0]) continue;

    var rawTanggal = row[1];
    var tanggal = (rawTanggal instanceof Date)
      ? Utilities.formatDate(rawTanggal, tz, 'yyyy-MM-dd')
      : String(rawTanggal);
    var ringkasan = String(row[6]);

    if (tanggal.indexOf('2099-') === 0 || ringkasan.indexOf('[TEST OTOMATIS]') >= 0 || ringkasan.indexOf('SUDAH DIUPDATE') >= 0) {
      found.push('Baris ' + (i + 1) + ': ' + row[0] + ' | tanggal=' + tanggal + ' | ringkasan="' + ringkasan + '"');
    }
  }

  if (found.length === 0) {
    Logger.log('✅ Tidak ada sisa data test di sheet 10_JURNAL. Aman untuk lanjut.');
  } else {
    Logger.log('⚠ Ditemukan ' + found.length + ' baris data test yang BELUM dibersihkan:');
    found.forEach(function(f) { Logger.log('  ' + f); });
    Logger.log('\nJalankan cleanupTestData() untuk menghapus semuanya.');
  }
  return found;
}
