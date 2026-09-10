// ============================================================
// Data.gs — Master Data Endpoints
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
//
// Endpoint yang ditangani:
//   getConfig, getGuru, getKelas, getSiswa,
//   getMapel, getJam, getJadwal, getJadwalGuru,
//   getJadwalHariIni, getUser, updateConfig
// ============================================================

// ── Config publik ─────────────────────────────────────────────

function actionGetConfig() {
  var cfg = getConfig();
  // Hanya kembalikan field yang aman untuk frontend
  return ok({
    nama_sekolah:  cfg.NAMA_SEKOLAH  || '',
    nama_aplikasi: cfg.NAMA_APLIKASI || 'Jurnal Mengajar',
    tahun_aktif:   cfg.TAHUN_AKTIF   || '',
    semester:      cfg.SEMESTER_AKTIF || '1',
    jam_maks: {
      SENIN:  cfg.JAM_MAKS_SENIN  || 9,
      SELASA: cfg.JAM_MAKS_SELASA || 9,
      RABU:   cfg.JAM_MAKS_RABU   || 9,
      KAMIS:  cfg.JAM_MAKS_KAMIS  || 8,
      JUMAT:  cfg.JAM_MAKS_JUMAT  || 4,
    },
    istirahat_setelah: (cfg.ISTIRAHAT_SETELAH || '3,6')
      .split(',').map(function(n) { return parseInt(n); }),
    batas_edit_hari: parseInt(cfg.BATAS_EDIT_HARI || 7),
    izin_edit:       cfg.IZIN_EDIT_JURNAL === 'TRUE' || cfg.IZIN_EDIT_JURNAL === true,
    // [BARU — arsitektur cache client-side, 2026-09-08] Naik otomatis lewat
    // trigger onEdit(e) tiap kali sheet master data (guru/kelas/siswa/mapel/
    // jadwal) diedit manual di Spreadsheet. Dipakai frontend (js/cache.js)
    // untuk tahu kapan cache di localStorage device harus dibersihkan.
    data_version: parseInt(cfg.DATA_VERSION || 0, 10),
  });
}

function actionUpdateConfig(body, session) {
  if (!hasRole(session, ['ADMIN'])) return err('Akses ditolak', 403);
  // body.updates = { NAMA_SEKOLAH: '...', ... }
  var updates = body.updates || {};
  var ws = SS.getSheetByName('01_CONFIG');
  var data = ws.getDataRange().getValues();
  var headers = data[2];
  var keyCol = headers.indexOf('config_key');
  var valCol = headers.indexOf('config_value');

  for (var i = 3; i < data.length; i++) {
    var k = data[i][keyCol];
    if (k && updates[k] !== undefined) {
      ws.getRange(i + 1, valCol + 1).setValue(updates[k]);
    }
  }
  _configCache = null; // reset cache in-memory
  invalidateCache('01_CONFIG'); // reset cache CacheService + in-memory readSheet
  writeLog(session.user_id, 'UPDATE', 'CONFIG', 'Update config: ' + Object.keys(updates).join(', '));
  return ok({ message: 'Config diperbarui' });
}

// ── Guru ──────────────────────────────────────────────────────

function actionGetGuru(session) {
  var rows = readSheet('04_GURU');
  var aktif = rows.filter(function(r) { return String(r.aktif) === 'TRUE'; });
  return ok(aktif.map(function(g) {
    return { guru_id: g.guru_id, nip: g.nip, nama: g.nama, jk: g.jenis_kelamin };
  }));
}

// ── Kelas ─────────────────────────────────────────────────────

function actionGetKelas(session) {
  var tahun = configVal('TAHUN_AKTIF');
  var kelas = readSheet('05_KELAS').filter(function(k) {
    return String(k.tahun_id) === String(tahun);
  });
  var guruIdx = indexBy(readSheet('04_GURU'), 'guru_id');

  return ok(kelas.map(function(k) {
    var wali = guruIdx[String(k.wali_kelas_id)];
    return {
      kelas_id:       k.kelas_id,
      nama_kelas:     k.nama_kelas,
      tingkat:        k.tingkat,
      wali_kelas_id:  k.wali_kelas_id,
      wali_kelas_nama: wali ? wali.nama : '',
      tahun_id:       k.tahun_id,
    };
  }));
}

// ── Siswa ─────────────────────────────────────────────────────

/**
 * GET siswa per kelas.
 * param: kelas_id
 */
function actionGetSiswa(params, session) {
  var kelasId = params.kelas_id || '';
  if (!kelasId) return err('kelas_id wajib');

  var siswa = filterBy('06_SISWA', 'kelas_id', kelasId)
    .filter(function(s) { return String(s.aktif) === 'TRUE'; });

  return ok(siswa.map(function(s) {
    return { nis: String(s.nis), nama: s.nama, kelas_id: s.kelas_id };
  }).sort(function(a, b) { return a.nama.localeCompare(b.nama); }));
}

// ── Mapel ─────────────────────────────────────────────────────

function actionGetMapel(session) {
  var rows = readSheet('07_MAPEL').filter(function(r) { return String(r.aktif) === 'TRUE'; });
  return ok(rows.map(function(m) {
    return { mapel_id: m.mapel_id, kode: m.kode_mapel, nama: m.nama_mapel, kelompok: m.kelompok };
  }));
}

// ── Jam ───────────────────────────────────────────────────────

function actionGetJam(session) {
  var rows = readSheet('08_JAM').filter(function(r) { return String(r.aktif) === 'TRUE'; });
  return ok(rows.map(function(j) {
    return { jam_id: j.jam_id, nomor: parseInt(j.nomor_jam), nama: j.nama_jam };
  }).sort(function(a, b) { return a.nomor - b.nomor; }));
}

// ── Jadwal ────────────────────────────────────────────────────

/**
 * Jadwal guru hari tertentu — untuk dashboard guru.
 * Mengelompokkan jam berturutan yang sama mapel+kelas jadi satu blok.
 * Juga mendeteksi konflik (guru sama, hari sama, jam sama).
 */
function actionGetJadwalHariIni(params, session) {
  var tanggal = params.tanggal || today();
  var hari    = hariDari(tanggal);
  var guruId  = session.guru_id;

  if (!guruId) return ok({ hari: hari, tanggal: tanggal, jadwal: [] }); // admin murni tidak punya jadwal mengajar

  return _jadwalGuru(guruId, hari, tanggal, session);
}

function actionGetJadwalGuru(params, session) {
  // Admin bisa query guru lain
  var guruId = hasRole(session, ['ADMIN']) && params.guru_id
    ? params.guru_id
    : session.guru_id;
  var hari    = (params.hari || '').toUpperCase();
  var tanggal = params.tanggal || today();
  if (!hari) hari = hariDari(tanggal);

  return _jadwalGuru(guruId, hari, tanggal, session);
}

function _jadwalGuru(guruId, hari, tanggal, session) {
  var tahun   = configVal('TAHUN_AKTIF');
  var maxJam  = maxJamHari(hari);

  // Ambil semua jadwal hari itu untuk guru ini
  var jadwalAll = readSheet('09_JADWAL').filter(function(j) {
    return String(j.tahun_id) === tahun
      && String(j.hari) === hari
      && String(j.guru_id) === String(guruId)
      && String(j.aktif) === 'TRUE';
  });

  // Filter jam sesuai maks hari (mis. Jumat cuma sampai jam 4)
  jadwalAll = jadwalAll.filter(function(j) {
    var nomor = parseInt(String(j.jam_id).replace('J', ''));
    return nomor <= maxJam;
  });

  // Deteksi konflik: guru mengajar kelas berbeda pada jam yang sama
  var jamCount = {};
  jadwalAll.forEach(function(j) {
    jamCount[j.jam_id] = (jamCount[j.jam_id] || 0) + 1;
  });
  var konflikJam = Object.keys(jamCount).filter(function(k) { return jamCount[k] > 1; });

  // Grup: kelas + mapel berturutan = satu blok mengajar
  var blok = groupJadwalBlok(jadwalAll);

  // Index sekali jalan untuk lookup O(1) — bukan .find()/.filter() berulang
  var kelasIdx = indexBy(readSheet('05_KELAS'), 'kelas_id');
  var mapelIdx = indexBy(readSheet('07_MAPEL'), 'mapel_id');

  // Jurnal yang sudah diisi guru ini hari ini — index by kelas_id+mapel_id
  var jurnalHariIni = readSheet('10_JURNAL').filter(function(j) {
    return String(j.tanggal) === String(tanggal)
      && String(j.guru_id) === String(guruId)
      && String(j.tahun_id) === tahun;
  });
  var jurnalJamByJurnal = groupBy(readSheet('11_JURNAL_JAM'), 'jurnal_id');

  // Bangun peta jam_id -> blok mengajar (untuk tahu jam mana yang terisi jadwal)
  var jamToBlok = {};
  blok.forEach(function(b) {
    b.jam_ids.forEach(function(jid) { jamToBlok[jid] = b; });
  });

  var result = [];
  var jamNumSudahDiproses = {};

  for (var nomor = 1; nomor <= maxJam; nomor++) {
    var jamId = 'J' + String(nomor).padStart(2, '0');
    if (jamNumSudahDiproses[jamId]) continue; // sudah masuk sebagai bagian blok sebelumnya

    var b = jamToBlok[jamId];

    if (!b) {
      // Guru tidak mengajar di jam ini — tetap tampilkan kartu "Tidak Mengajar"
      result.push({
        blok_id:     'kosong_' + jamId,
        hari:        hari,
        tanggal:     tanggal,
        kelas_id:    null,
        nama_kelas:  null,
        mapel_id:    null,
        nama_mapel:  'Tidak Mengajar',
        jam_ids:     [jamId],
        jam_label:   jamLabel([jamId]),
        sudah_diisi: false,
        jurnal_id:   null,
        konflik:     false,
        konflik_info: null,
        tidak_mengajar: true,
      });
      continue;
    }

    // Tandai semua jam di blok ini sudah diproses supaya tidak diulang
    b.jam_ids.forEach(function(jid) { jamNumSudahDiproses[jid] = true; });

    var kelas = kelasIdx[String(b.kelas_id)];
    var mapel = mapelIdx[String(b.mapel_id)];

    var jurnalBlok = jurnalHariIni.find(function(jr) {
      if (jr.kelas_id !== b.kelas_id || jr.mapel_id !== b.mapel_id) return false;
      var jj = jurnalJamByJurnal[String(jr.jurnal_id)] || [];
      var jjIds = jj.map(function(x) { return x.jam_id; });
      return b.jam_ids.some(function(id) { return jjIds.indexOf(id) >= 0; });
    });

    var isKonflik = b.jam_ids.some(function(id) { return konflikJam.indexOf(id) >= 0; });

    result.push({
      blok_id:     b.kelas_id + '_' + b.mapel_id + '_' + b.jam_ids[0],
      hari:        hari,
      tanggal:     tanggal,
      kelas_id:    b.kelas_id,
      nama_kelas:  kelas ? kelas.nama_kelas : b.kelas_id,
      mapel_id:    b.mapel_id,
      nama_mapel:  mapel ? mapel.nama_mapel : b.mapel_id,
      jam_ids:     b.jam_ids,
      jam_label:   jamLabel(b.jam_ids),
      sudah_diisi: !!jurnalBlok,
      jurnal_id:   jurnalBlok ? jurnalBlok.jurnal_id : null,
      konflik:     isKonflik,
      konflik_info: isKonflik ? 'Jam ini juga terdapat di kelas lain' : null,
      tidak_mengajar: false,
    });
  }

  return ok({ hari: hari, tanggal: tanggal, jadwal: result });
}

// ── Jadwal Kelas (untuk wali kelas) ──────────────────────────

function actionGetJadwalKelas(params, session) {
  if (!hasRole(session, ['ADMIN', 'WALI_KELAS', 'GURU'])) return err('Akses ditolak', 403);

  var kelasId = params.kelas_id || (session.kelas_wali ? session.kelas_wali.kelas_id : '');
  var tanggal = params.tanggal || today();
  var hari    = hariDari(tanggal);

  if (!kelasId) return err('kelas_id wajib (atau Anda belum ditugaskan sebagai wali kelas)');

  // Wali kelas hanya boleh lihat kelas sendiri (kecuali admin)
  if (!hasRole(session, ['ADMIN'])) {
    if (!session.kelas_wali || session.kelas_wali.kelas_id !== kelasId) {
      return err('Akses ditolak: bukan kelas Anda', 403);
    }
  }

  var tahun  = configVal('TAHUN_AKTIF');
  var maxJam = maxJamHari(hari);

  var jadwalKelas = readSheet('09_JADWAL').filter(function(j) {
    return String(j.tahun_id) === tahun
      && String(j.hari) === hari
      && String(j.kelas_id) === String(kelasId)
      && String(j.aktif) === 'TRUE'
      && parseInt(String(j.jam_id).replace('J', '')) <= maxJam;
  });

  var blok = groupJadwalBlok(jadwalKelas);

  // Index sekali jalan
  var guruIdx  = indexBy(readSheet('04_GURU'), 'guru_id');
  var mapelIdx = indexBy(readSheet('07_MAPEL'), 'mapel_id');
  var kelasInfo = findBy('05_KELAS', 'kelas_id', kelasId);

  var jurnal = readSheet('10_JURNAL').filter(function(j) {
    return String(j.tanggal) === String(tanggal)
      && String(j.kelas_id) === String(kelasId)
      && String(j.tahun_id) === tahun;
  });
  var jurnalJamByJurnal = groupBy(readSheet('11_JURNAL_JAM'), 'jurnal_id');

  var siswa = filterBy('06_SISWA', 'kelas_id', kelasId)
    .filter(function(s) { return String(s.aktif) === 'TRUE'; });
  var siswaIdx = indexBy(siswa, 'nis');

  // Kehadiran (hanya berisi yang TIDAK hadir) — index by jurnal_id sekali jalan
  var tidakHadirByJurnal = groupBy(readSheet('12_KEHADIRAN'), 'jurnal_id');

  var result = blok.map(function(b) {
    var guru  = guruIdx[String(b.guru_id)];
    var mapel = mapelIdx[String(b.mapel_id)];

    var jurnalBlok = jurnal.find(function(jr) {
      if (jr.guru_id !== b.guru_id || jr.mapel_id !== b.mapel_id) return false;
      var jj = jurnalJamByJurnal[String(jr.jurnal_id)] || [];
      var jjIds = jj.map(function(x) { return x.jam_id; });
      return b.jam_ids.some(function(id) { return jjIds.indexOf(id) >= 0; });
    });

    var rekapKehadiran = { hadir: siswa.length, sakit: 0, izin: 0, alpa: 0, total: siswa.length };
    var tidakHadirList = [];

    if (jurnalBlok) {
      var th = tidakHadirByJurnal[String(jurnalBlok.jurnal_id)] || [];
      th.forEach(function(k) {
        var st = String(k.status).toLowerCase();
        if (rekapKehadiran[st] !== undefined) rekapKehadiran[st]++;
        var s = siswaIdx[String(k.nis)];
        tidakHadirList.push({
          nis:       String(k.nis),
          nama:      s ? s.nama : String(k.nis),
          status:    k.status,
          keterangan: k.keterangan || '',
        });
      });
      rekapKehadiran.hadir = Math.max(0, siswa.length - th.length);
    }

    return {
      blok_id:      b.kelas_id + '_' + b.mapel_id + '_' + b.jam_ids[0],
      mapel_id:     b.mapel_id,
      nama_mapel:   mapel ? mapel.nama_mapel : b.mapel_id,
      guru_id:      b.guru_id,
      nama_guru:    guru ? guru.nama : b.guru_id,
      jam_ids:      b.jam_ids,
      jam_label:    jamLabel(b.jam_ids),
      sudah_diisi:  !!jurnalBlok,
      jurnal_id:    jurnalBlok ? jurnalBlok.jurnal_id : null,
      ringkasan:    jurnalBlok ? jurnalBlok.ringkasan_kegiatan : null,
      catatan:      jurnalBlok ? jurnalBlok.catatan : null,
      kehadiran:    rekapKehadiran,
      tidak_hadir:  tidakHadirList,
    };
  });

  result.sort(function(a, b) {
    return parseInt(a.jam_ids[0].replace('J','')) - parseInt(b.jam_ids[0].replace('J',''));
  });

  return ok({
    kelas_id: kelasId,
    nama_kelas: kelasInfo ? kelasInfo.nama_kelas : kelasId,
    tanggal: tanggal,
    hari: hari,
    mapel: result
  });
}

// ── Jadwal Kelas Publik (untuk menu "Jadwal Kelas" di homepage) ──

/**
 * Endpoint PUBLIK (butuh token, tapi TIDAK dibatasi harus wali kelas
 * kelas tsb) — untuk guru/siapapun yang login melihat jadwal kelas manapun.
 * Beda dengan actionGetJadwalKelas yang punya rekap kehadiran & dibatasi
 * hanya wali kelas — endpoint ini HANYA info jadwal (kelas, mapel, guru, jam),
 * tanpa data kehadiran/jurnal, supaya aman dilihat siapa saja yang login.
 * params: { kelas_id (WAJIB), hari? } — kalau hari tidak diisi, pakai hari ini
 */
/**
 * [BARU] Daftar kelas versi PUBLIK (tanpa login) — dipakai dropdown pilih
 * kelas di menu "Jadwal Kelas" homepage. Sengaja hanya field minimal
 * (kelas_id, nama_kelas, tingkat) — TIDAK ada nama wali kelas, beda dengan
 * actionGetKelas (versi lengkap, tetap butuh token, tidak diubah).
 */
function actionGetKelasPublik() {
  var tahun = configVal('TAHUN_AKTIF');
  var kelas = readSheet('05_KELAS').filter(function(k) {
    return String(k.tahun_id) === String(tahun);
  });
  kelas.sort(function(a, b) { return String(a.nama_kelas).localeCompare(String(b.nama_kelas)); });
  return ok(kelas.map(function(k) {
    return { kelas_id: k.kelas_id, nama_kelas: k.nama_kelas, tingkat: k.tingkat };
  }));
}

function actionGetJadwalKelasPublik(params, session) {
  var kelasId = String(params.kelas_id || '').trim();
  if (!kelasId) return err('kelas_id wajib');

  var hari = (params.hari || '').toUpperCase();
  if (!hari) hari = hariDari(today());

  var tahun  = configVal('TAHUN_AKTIF');
  var maxJam = maxJamHari(hari);

  var jadwalKelas = readSheet('09_JADWAL').filter(function(j) {
    return String(j.tahun_id) === tahun
      && String(j.hari) === hari
      && String(j.kelas_id) === kelasId
      && String(j.aktif) === 'TRUE'
      && parseInt(String(j.jam_id).replace('J', '')) <= maxJam;
  });

  var blok = groupJadwalBlok(jadwalKelas);
  var guruIdx  = indexBy(readSheet('04_GURU'), 'guru_id');
  var mapelIdx = indexBy(readSheet('07_MAPEL'), 'mapel_id');
  var kelasInfo = findBy('05_KELAS', 'kelas_id', kelasId);

  var items = blok.map(function(b) {
    var guru  = guruIdx[String(b.guru_id)];
    var mapel = mapelIdx[String(b.mapel_id)];
    return {
      mapel_id:   b.mapel_id,
      nama_mapel: mapel ? mapel.nama_mapel : b.mapel_id,
      nama_guru:  guru ? guru.nama : b.guru_id,
      jam_ids:    b.jam_ids,
      jam_label:  jamLabel(b.jam_ids),
    };
  });
  items.sort(function(a, b) {
    return parseInt(a.jam_ids[0].replace('J','')) - parseInt(b.jam_ids[0].replace('J',''));
  });

  return ok({
    kelas_id: kelasId,
    nama_kelas: kelasInfo ? kelasInfo.nama_kelas : kelasId,
    hari: hari,
    jadwal: items,
  });
}

// ── User (Admin) ──────────────────────────────────────────────

function actionGetUser(session) {
  if (!hasRole(session, ['ADMIN'])) return err('Akses ditolak', 403);
  var rows = readSheet('03_USER');
  return ok(rows.map(function(u) {
    return {
      user_id:  u.user_id,
      username: u.username,
      role:     u.role,
      guru_id:  u.guru_id,
      aktif:    u.aktif,
      // password TIDAK dikembalikan
    };
  }));
}

// ── Semua Jurnal (Admin) ──────────────────────────────────────

/**
 * params: { tanggal (WAJIB), guru_id?, mapel_id?, kelas_id?, page?, pageSize? }
 * Tanggal WAJIB dan hanya boleh 1 hari per pencarian — ini sengaja dibatasi
 * supaya admin tidak menarik seluruh riwayat jurnal (bisa ribuan baris)
 * dalam satu request yang berat.
 */
function actionGetAllJurnal(params, session) {
  if (!hasRole(session, ['ADMIN'])) return err('Akses ditolak', 403);

  var tanggal = String(params.tanggal || '').trim();
  if (!tanggal) return err('Parameter tanggal wajib diisi (maksimal 1 hari per pencarian)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return err('Format tanggal: yyyy-MM-dd');

  var jurnal = readSheet('10_JURNAL').filter(function(j) { return String(j.tanggal) === tanggal; });

  if (params.guru_id)  jurnal = jurnal.filter(function(j) { return String(j.guru_id)  === String(params.guru_id);  });
  if (params.mapel_id) jurnal = jurnal.filter(function(j) { return String(j.mapel_id) === String(params.mapel_id); });
  if (params.kelas_id) jurnal = jurnal.filter(function(j) { return String(j.kelas_id) === String(params.kelas_id); });

  jurnal.sort(function(a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });

  // Pagination dulu, baru join — supaya join hanya untuk baris yang ditampilkan
  var paged = paginate(jurnal, params.page, params.pageSize || 25);

  var guruIdx  = indexBy(readSheet('04_GURU'), 'guru_id');
  var kelasIdx = indexBy(readSheet('05_KELAS'), 'kelas_id');
  var mapelIdx = indexBy(readSheet('07_MAPEL'), 'mapel_id');
  var jurnalJamByJurnal = groupBy(readSheet('11_JURNAL_JAM'), 'jurnal_id');

  var items = paged.items.map(function(j) {
    var g = guruIdx[String(j.guru_id)];
    var k = kelasIdx[String(j.kelas_id)];
    var m = mapelIdx[String(j.mapel_id)];
    var jj = jurnalJamByJurnal[String(j.jurnal_id)] || [];
    var jamIds = jj.map(function(x) { return x.jam_id; });

    return {
      jurnal_id:   j.jurnal_id,
      tanggal:     j.tanggal,
      kelas_id:    j.kelas_id,
      nama_kelas:  k ? k.nama_kelas : j.kelas_id,
      mapel_id:    j.mapel_id,
      nama_mapel:  m ? m.nama_mapel : j.mapel_id,
      guru_id:     j.guru_id,
      nama_guru:   g ? g.nama : j.guru_id,
      jam_ids:     jamIds,
      jam_label:   jamLabel(jamIds),
      ringkasan:   j.ringkasan_kegiatan,
      status:      j.status,
      created_at:  j.created_at,
    };
  });

  return ok({
    items: items,
    page: paged.page,
    pageSize: paged.pageSize,
    totalItems: paged.totalItems,
    totalPages: paged.totalPages,
  });
}

// ── Jadwal Mengajar Seorang Guru — untuk Admin lihat "guru X ngajar di mana" ──

/**
 * params: { guru_id (WAJIB) }
 * Menampilkan seluruh jadwal mengajar satu guru selama seminggu (semua hari),
 * dikelompokkan per hari, untuk keperluan admin memeriksa penyebaran jadwal
 * seorang guru tanpa perlu buka Spreadsheet manual.
 */
function actionGetJadwalPerGuru(params, session) {
  if (!hasRole(session, ['ADMIN'])) return err('Akses ditolak', 403);

  var guruId = String(params.guru_id || '').trim();
  if (!guruId) return err('guru_id wajib');

  var tahun = configVal('TAHUN_AKTIF');
  var jadwalGuru = readSheet('09_JADWAL').filter(function(j) {
    return String(j.tahun_id) === tahun
      && String(j.guru_id) === guruId
      && String(j.aktif) === 'TRUE';
  });

  var kelasIdx = indexBy(readSheet('05_KELAS'), 'kelas_id');
  var mapelIdx = indexBy(readSheet('07_MAPEL'), 'mapel_id');
  var guru = findBy('04_GURU', 'guru_id', guruId);

  var hariUrutan = ['SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'];
  var perHari = {};
  hariUrutan.forEach(function(h) { perHari[h] = []; });

  jadwalGuru.forEach(function(j) {
    if (!perHari[j.hari]) perHari[j.hari] = [];
    perHari[j.hari].push(j);
  });

  var result = hariUrutan.map(function(h) {
    var blok = groupJadwalBlok(perHari[h] || []);
    var items = blok.map(function(b) {
      var k = kelasIdx[String(b.kelas_id)];
      var m = mapelIdx[String(b.mapel_id)];
      return {
        kelas_id: b.kelas_id,
        nama_kelas: k ? k.nama_kelas : b.kelas_id,
        mapel_id: b.mapel_id,
        nama_mapel: m ? m.nama_mapel : b.mapel_id,
        jam_ids: b.jam_ids,
        jam_label: jamLabel(b.jam_ids),
      };
    });
    items.sort(function(a, b) {
      return parseInt(a.jam_ids[0].replace('J','')) - parseInt(b.jam_ids[0].replace('J',''));
    });
    return { hari: h, jadwal: items };
  });

  return ok({
    guru_id: guruId,
    nama_guru: guru ? guru.nama : guruId,
    jadwal_per_hari: result,
  });
}

// ── Helper: Grup jadwal jadi blok ─────────────────────────────

/**
 * Mengelompokkan baris jadwal (kelas+mapel+guru sama, jam berurutan) 
 * jadi satu blok.
 */
function groupJadwalBlok(jadwalRows) {
  // Urutkan berdasarkan jam
  var sorted = jadwalRows.slice().sort(function(a, b) {
    return parseInt(String(a.jam_id).replace('J',''))
         - parseInt(String(b.jam_id).replace('J',''));
  });

  var blok = [];
  sorted.forEach(function(j) {
    var last = blok[blok.length - 1];
    if (last
      && last.kelas_id === j.kelas_id
      && last.mapel_id === j.mapel_id
      && last.guru_id  === j.guru_id) {
      last.jam_ids.push(j.jam_id);
    } else {
      blok.push({
        kelas_id: j.kelas_id,
        mapel_id: j.mapel_id,
        guru_id:  j.guru_id,
        jam_ids:  [j.jam_id],
      });
    }
  });
  return blok;
}

/**
 * Buat label jam: ['J01','J02','J03'] → 'Jam 1–3'
 * ['J01','J03'] → 'Jam 1, 3' (tidak berurutan)
 */
function jamLabel(jamIds) {
  if (!jamIds || jamIds.length === 0) return '';
  var nums = jamIds.map(function(id) { return parseInt(String(id).replace('J','')); }).sort(function(a,b){return a-b;});
  if (nums.length === 1) return 'Jam ' + nums[0];

  // Cek apakah berurutan
  var isSeq = nums.every(function(n, i) { return i === 0 || n === nums[i-1] + 1; });
  if (isSeq) return 'Jam ' + nums[0] + '–' + nums[nums.length-1];
  return 'Jam ' + nums.join(', ');
}
