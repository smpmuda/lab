// ============================================================
// Jurnal.gs — Jurnal Mengajar CRUD
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
//
// Endpoint:
//   createJurnal   → guru buat jurnal
//   updateJurnal   → guru edit jurnal (dalam batas waktu)
//   getJurnalSaya  → list jurnal milik guru yang login (dengan pagination)
//   getDetailJurnal → detail lengkap satu jurnal
//
// PERUBAHAN SKEMA KEHADIRAN (penting untuk database ringan):
// Sheet 12_KEHADIRAN HANYA menyimpan siswa yang TIDAK HADIR (SAKIT/IZIN/ALPA).
// Siswa yang hadir TIDAK ditulis sebagai baris sama sekali. Rekap kehadiran
// dihitung sebagai: hadir = total_siswa_kelas - jumlah_baris_tidak_hadir.
// Ini memangkas volume tulis ~90% untuk kelas yang mayoritas hadir penuh
// (mis. kelas 33 siswa, biasanya cuma 1-2 tidak hadir → dari 33 baris jadi 1-2).
// ============================================================

// ── Create Jurnal ─────────────────────────────────────────────

/**
 * Body yang diharapkan:
 * {
 *   token:       'xxx',
 *   tanggal:     '2026-09-05',   // opsional, default hari ini
 *   kelas_id:    'K001',
 *   mapel_id:    'M010',
 *   jam_ids:     ['J01','J02'],  // array jam yang dipilih guru
 *   ringkasan_kegiatan: '...',
 *   catatan:     '...',          // opsional
 *   kehadiran:   [               // HANYA siswa yang TIDAK hadir
 *     { nis: '1001003', status: 'SAKIT', keterangan: 'Demam' },
 *     { nis: '1001004', status: 'IZIN', keterangan: '' },
 *   ]
 * }
 */
// [BARU 2026-09-18] Batas karakter ringkasan/catatan — dijaga di backend
// (bukan cuma frontend) supaya panggilan API langsung tidak bisa melewati
// batas ini. Angka HARUS sama dengan BATAS_KARAKTER_RINGKASAN/CATATAN di
// frontend/js/app.js (dipakai juga untuk hitung tinggi kartu PDF nanti).
var BATAS_KARAKTER_RINGKASAN = 700;
var BATAS_KARAKTER_CATATAN = 200;

function actionCreateJurnal(body, session) {
  if (!hasRole(session, ['GURU', 'ADMIN'])) return err('Akses ditolak', 403);

  var guruId   = session.guru_id;
  var tanggal  = String(body.tanggal || today()).trim();
  var kelasId  = String(body.kelas_id || '').trim();
  var mapelId  = String(body.mapel_id || '').trim();
  var jamIds   = body.jam_ids;
  var ringkasan = String(body.ringkasan_kegiatan || '').trim();
  var catatan   = String(body.catatan || '').trim();
  var tidakHadir = body.kehadiran || []; // hanya berisi yang TIDAK hadir

  // Validasi wajib
  if (!guruId)    return err('Guru tidak teridentifikasi');
  if (!kelasId)   return err('kelas_id wajib');
  if (!mapelId)   return err('mapel_id wajib');
  if (!jamIds || !Array.isArray(jamIds) || jamIds.length === 0)
    return err('Pilih minimal 1 jam');
  if (!ringkasan) return err('Ringkasan kegiatan wajib diisi');
  if (ringkasan.length < 5) return err('Ringkasan kegiatan terlalu singkat');
  if (ringkasan.length > BATAS_KARAKTER_RINGKASAN) return err('Ringkasan kegiatan maksimal ' + BATAS_KARAKTER_RINGKASAN + ' karakter');
  if (catatan.length > BATAS_KARAKTER_CATATAN) return err('Catatan maksimal ' + BATAS_KARAKTER_CATATAN + ' karakter');

  // Validasi tanggal valid
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return err('Format tanggal: yyyy-MM-dd');

  // Cek apakah kombinasi ini sudah ada jurnal hari itu
  var tahun = configVal('TAHUN_AKTIF');
  var jurnalExisting = readSheet('10_JURNAL').filter(function(j) {
    return String(j.tanggal)   === tanggal
      && String(j.guru_id)     === String(guruId)
      && String(j.kelas_id)    === String(kelasId)
      && String(j.mapel_id)    === String(mapelId)
      && String(j.tahun_id)    === tahun
      && String(j.status)      !== 'DELETED';
  });

  if (jurnalExisting.length > 0) {
    // Cek apakah ada irisan jam
    var jurnalJamAll = readSheet('11_JURNAL_JAM');
    var jamSudahAda = jurnalExisting.some(function(je) {
      var jj = jurnalJamAll.filter(function(x) { return x.jurnal_id === je.jurnal_id; });
      var jjIds = jj.map(function(x) { return x.jam_id; });
      return jamIds.some(function(id) { return jjIds.indexOf(id) >= 0; });
    });
    if (jamSudahAda) return err('Jurnal untuk sesi ini sudah pernah dibuat. Gunakan edit jurnal.');
  }

  // Validasi jam ada di sheet 08_JAM
  var jamValid = readSheet('08_JAM').filter(function(j) { return isAktif(j.aktif); });
  var jamValidIds = jamValid.map(function(j) { return j.jam_id; });
  var invalidJam = jamIds.filter(function(id) { return jamValidIds.indexOf(id) < 0; });
  if (invalidJam.length > 0) return err('Jam tidak valid: ' + invalidJam.join(', '));

  // Ambil siswa kelas HANYA untuk validasi NIS yang dikirim benar-benar ada di kelas ini
  var siswaKelas = filterBy('06_SISWA', 'kelas_id', kelasId)
    .filter(function(s) { return isAktif(s.aktif); });
  var siswaNisSet = {};
  siswaKelas.forEach(function(s) { siswaNisSet[String(s.nis)] = true; });

  // Validasi & normalisasi daftar tidak hadir
  var statusValid = ['SAKIT','IZIN','ALPA']; // HADIR tidak lagi disimpan sebagai baris
  var tidakHadirBersih = [];
  for (var i = 0; i < tidakHadir.length; i++) {
    var th = tidakHadir[i];
    var nis = String(th.nis || '');
    var status = String(th.status || '').toUpperCase();
    if (!siswaNisSet[nis]) continue; // abaikan NIS yang tidak ada di kelas ini
    if (statusValid.indexOf(status) < 0) {
      return err('Status kehadiran tidak valid: ' + status + ' (harus SAKIT/IZIN/ALPA)');
    }
    tidakHadirBersih.push({ nis: nis, status: status, keterangan: String(th.keterangan || '') });
  }

  // Generate ID
  var jurnalId = nextId('10_JURNAL', 'JR', 5);
  var ts = nowTs();

  // Tulis ke 10_JURNAL
  appendToSheet('10_JURNAL', [
    jurnalId, tanggal, tahun, kelasId, mapelId, guruId,
    ringkasan, catatan, 'FINAL', ts, ts
  ]);

  // Tulis ke 11_JURNAL_JAM — batch dalam SATU panggilan (bukan appendRow berulang)
  var jjBaseNum = _extractMaxNum(readSheet('11_JURNAL_JAM'), 'JJ');
  var jjRows = jamIds.map(function(jamId, idx) {
    return [_padId('JJ', jjBaseNum + idx + 1, 5), jurnalId, jamId];
  });
  appendManyToSheet('11_JURNAL_JAM', jjRows);

  // Tulis ke 12_KEHADIRAN — HANYA baris yang tidak hadir, batch sekaligus
  if (tidakHadirBersih.length > 0) {
    var khBaseNum = _extractMaxNum(readSheet('12_KEHADIRAN'), 'KH');
    var khRows = tidakHadirBersih.map(function(th, idx) {
      return [_padId('KH', khBaseNum + idx + 1, 6), jurnalId, th.nis, th.status, th.keterangan];
    });
    appendManyToSheet('12_KEHADIRAN', khRows);
  }

  writeLog(session.user_id, 'CREATE', 'JURNAL',
    'Buat jurnal ' + jurnalId + ' — ' + mapelId + ' ' + kelasId + ' ' + tanggal);

  return ok({
    jurnal_id: jurnalId,
    message:   'Jurnal berhasil disimpan',
    tanggal:   tanggal,
    jam_label: jamLabel(jamIds),
  });
}

// Helper lokal: cari nomor terbesar dari ID berprefix tertentu di array baris
function _extractMaxNum(rows, prefix) {
  var maxNum = 0;
  rows.forEach(function(r) {
    var id = String(r[Object.keys(r)[0]] || '');
    if (id.indexOf(prefix) === 0) {
      var num = parseInt(id.substring(prefix.length), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return maxNum;
}
function _padId(prefix, num, padLength) {
  return prefix + String(num).padStart(padLength, '0');
}

// ── Update Jurnal ─────────────────────────────────────────────

/**
 * Body:
 * {
 *   token:       'xxx',
 *   jurnal_id:   'JR00001',
 *   ringkasan_kegiatan: '...',   // opsional
 *   catatan:     '...',           // opsional
 *   kehadiran:   [...]            // opsional — HANYA siswa tidak hadir, seluruh array diganti
 * }
 */
function actionUpdateJurnal(body, session) {
  if (!hasRole(session, ['GURU', 'ADMIN'])) return err('Akses ditolak', 403);

  var jurnalId = String(body.jurnal_id || '').trim();
  if (!jurnalId) return err('jurnal_id wajib');

  var jurnal = findBy('10_JURNAL', 'jurnal_id', jurnalId);
  if (!jurnal) return err('Jurnal tidak ditemukan');

  // Guru hanya bisa edit jurnalnya sendiri
  if (!hasRole(session, ['ADMIN'])) {
    if (String(jurnal.guru_id) !== String(session.guru_id)) {
      return err('Tidak bisa edit jurnal milik guru lain', 403);
    }

    // Cek batas waktu edit
    // [FIX 2026-09-15] Sebelumnya pakai `String(...) !== 'TRUE'` — bug yang
    // sama persis dengan root cause isAktif() (2026-09-13): kalau admin
    // mengisi IZIN_EDIT_JURNAL di 01_CONFIG sebagai checkbox boolean asli
    // (bukan teks "TRUE"), perbandingan ini SELALU true (dianggap "bukan
    // TRUE"), sehingga SEMUA guru non-admin diblokir edit jurnal dengan
    // pesan "Fitur edit jurnal sedang dinonaktifkan" walau admin sudah
    // mengaktifkannya. Titik lain di file ini (baris ~292, ~378) sudah
    // benar pakai isAktif() — titik ini terlewat saat migrasi sebelumnya.
    if (!isAktif(configVal('IZIN_EDIT_JURNAL'))) {
      return err('Fitur edit jurnal sedang dinonaktifkan oleh admin');
    }
    var batasHari = parseInt(configVal('BATAS_EDIT_HARI', 7));
    var tglJurnal = new Date(String(jurnal.tanggal) + 'T00:00:00');
    var diffHari  = (Date.now() - tglJurnal.getTime()) / (1000 * 60 * 60 * 24);
    if (diffHari > batasHari) {
      return err('Jurnal ini sudah lebih dari ' + batasHari + ' hari, tidak bisa diedit lagi');
    }
  }

  // Update field yang dikirim
  var updates = {};
  if (body.ringkasan_kegiatan !== undefined) {
    var r = String(body.ringkasan_kegiatan).trim();
    if (r.length < 5) return err('Ringkasan terlalu singkat');
    if (r.length > BATAS_KARAKTER_RINGKASAN) return err('Ringkasan kegiatan maksimal ' + BATAS_KARAKTER_RINGKASAN + ' karakter');
    updates.ringkasan_kegiatan = r;
  }
  if (body.catatan !== undefined) {
    var c = String(body.catatan).trim();
    if (c.length > BATAS_KARAKTER_CATATAN) return err('Catatan maksimal ' + BATAS_KARAKTER_CATATAN + ' karakter');
    updates.catatan = c;
  }
  updates.updated_at = nowTs();

  updateRowById('10_JURNAL', jurnalId, updates);

  // Update kehadiran jika dikirim (hapus lama, tulis baru — hanya yang tidak hadir)
  if (body.kehadiran && Array.isArray(body.kehadiran)) {
    _replaceKehadiran(jurnalId, body.kehadiran, jurnal.kelas_id);
  }

  writeLog(session.user_id, 'UPDATE', 'JURNAL', 'Edit jurnal ' + jurnalId);

  return ok({ message: 'Jurnal berhasil diperbarui', jurnal_id: jurnalId });
}

function _replaceKehadiran(jurnalId, tidakHadirBaru, kelasId) {
  // Hapus semua baris kehadiran lama untuk jurnal ini (pakai helper cache-aware)
  var existing = filterBy('12_KEHADIRAN', 'jurnal_id', jurnalId);
  var idsToDelete = existing.map(function(r) { return r.kehadiran_id; });
  deleteRowsByIds('12_KEHADIRAN', idsToDelete);

  // Validasi NIS benar-benar siswa kelas ini
  var siswaKelas = filterBy('06_SISWA', 'kelas_id', kelasId)
    .filter(function(s) { return isAktif(s.aktif); });
  var siswaNisSet = {};
  siswaKelas.forEach(function(s) { siswaNisSet[String(s.nis)] = true; });

  var statusValid = ['SAKIT','IZIN','ALPA'];
  var bersih = [];
  tidakHadirBaru.forEach(function(k) {
    var nis = String(k.nis || '');
    var status = String(k.status || '').toUpperCase();
    if (!siswaNisSet[nis]) return;
    if (statusValid.indexOf(status) < 0) return; // lewati status tak dikenal, jangan gagalkan seluruh request
    bersih.push({ nis: nis, status: status, keterangan: String(k.keterangan || '') });
  });

  if (bersih.length > 0) {
    var khBaseNum = _extractMaxNum(readSheet('12_KEHADIRAN'), 'KH');
    var khRows = bersih.map(function(k, idx) {
      return [_padId('KH', khBaseNum + idx + 1, 6), jurnalId, k.nis, k.status, k.keterangan];
    });
    appendManyToSheet('12_KEHADIRAN', khRows);
  }
}

// ── Jurnal Saya (Guru) ────────────────────────────────────────

/**
 * params: { bulan?, page?, pageSize? }
 * Default pageSize 25 sesuai kebutuhan pagination di frontend.
 */
function actionGetJurnalSaya(params, session) {
  if (!hasRole(session, ['GURU', 'ADMIN'])) return err('Akses ditolak', 403);

  var guruId = session.guru_id;
  if (!guruId) return ok(paginate([], 1, 25));

  var tahun    = configVal('TAHUN_AKTIF');
  var jurnal   = readSheet('10_JURNAL').filter(function(j) {
    return String(j.guru_id) === String(guruId)
      && String(j.tahun_id) === tahun;
  });

  // Filter bulan jika ada
  if (params.bulan) {
    var bulan = String(params.bulan).padStart(2, '0');
    jurnal = jurnal.filter(function(j) {
      return String(j.tanggal).substring(5, 7) === bulan;
    });
  }

  jurnal.sort(function(a, b) { return b.tanggal.localeCompare(a.tanggal); });

  // Pagination DULU sebelum join data lain — supaya join hanya dikerjakan
  // untuk baris yang benar-benar akan ditampilkan, bukan semua jurnal guru.
  var paged = paginate(jurnal, params.page, params.pageSize || 25);

  // Index sekali jalan untuk lookup O(1), bukan .find()/.filter() berulang
  var jurnalJamByJurnal = groupBy(readSheet('11_JURNAL_JAM'), 'jurnal_id');
  var kelasIdx = indexBy(readSheet('05_KELAS'), 'kelas_id');
  var mapelIdx = indexBy(readSheet('07_MAPEL'), 'mapel_id');

  var batasHari = parseInt(configVal('BATAS_EDIT_HARI', 7));
  var izinEdit  = isAktif(configVal('IZIN_EDIT_JURNAL'));
  var nowMs     = Date.now();

  var items = paged.items.map(function(j) {
    var k  = kelasIdx[String(j.kelas_id)];
    var m  = mapelIdx[String(j.mapel_id)];
    var jj = jurnalJamByJurnal[String(j.jurnal_id)] || [];
    var jamIds = jj.map(function(x) { return x.jam_id; });

    var tglJurnal = new Date(String(j.tanggal) + 'T00:00:00');
    var diffHari  = (nowMs - tglJurnal.getTime()) / (1000 * 60 * 60 * 24);
    var bisaEdit  = izinEdit && diffHari <= batasHari;

    return {
      jurnal_id:    j.jurnal_id,
      tanggal:      j.tanggal,
      hari:         hariDari(String(j.tanggal)),
      nama_kelas:   k ? k.nama_kelas : j.kelas_id,
      nama_mapel:   m ? m.nama_mapel : j.mapel_id,
      jam_ids:      jamIds,
      jam_label:    jamLabel(jamIds),
      ringkasan:    j.ringkasan_kegiatan,
      status:       j.status,
      bisa_edit:    bisaEdit,
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

// ── Detail Jurnal ─────────────────────────────────────────────

function actionGetDetailJurnal(params, session) {
  var jurnalId = params.jurnal_id || '';
  if (!jurnalId) return err('jurnal_id wajib');

  var jurnal = findBy('10_JURNAL', 'jurnal_id', jurnalId);
  if (!jurnal) return err('Jurnal tidak ditemukan');

  // Guru hanya bisa lihat milik sendiri (kecuali admin/wali kelas kelasnya)
  if (!hasRole(session, ['ADMIN'])) {
    var isOwner = String(jurnal.guru_id) === String(session.guru_id);
    var isWali  = session.kelas_wali && session.kelas_wali.kelas_id === jurnal.kelas_id;
    if (!isOwner && !isWali) return err('Akses ditolak', 403);
  }

  var jurnalJam  = filterBy('11_JURNAL_JAM', 'jurnal_id', jurnalId);
  var tidakHadir = filterBy('12_KEHADIRAN',  'jurnal_id', jurnalId); // hanya berisi yg tidak hadir
  var siswaKelas = filterBy('06_SISWA', 'kelas_id', jurnal.kelas_id)
    .filter(function(s) { return isAktif(s.aktif); });
  var siswaIdx = indexBy(siswaKelas, 'nis');

  var guru  = findBy('04_GURU', 'guru_id', jurnal.guru_id);
  var kelas = findBy('05_KELAS', 'kelas_id', jurnal.kelas_id);
  var mapel = findBy('07_MAPEL', 'mapel_id', jurnal.mapel_id);
  var jamIds = jurnalJam.map(function(x) { return x.jam_id; });

  var tidakHadirDetail = tidakHadir.map(function(k) {
    var s = siswaIdx[String(k.nis)];
    return {
      nis:        String(k.nis),
      nama:       s ? s.nama : String(k.nis),
      status:     k.status,
      keterangan: k.keterangan || '',
    };
  });
  tidakHadirDetail.sort(function(a, b) { return a.nama.localeCompare(b.nama); });

  // Rekap: hadir dihitung dari total siswa kelas dikurangi yang tidak hadir
  // (karena sheet 12_KEHADIRAN sekarang hanya menyimpan yang TIDAK hadir)
  var rekapKh = { hadir: 0, sakit: 0, izin: 0, alpa: 0, total: siswaKelas.length };
  tidakHadirDetail.forEach(function(k) {
    var st = k.status.toLowerCase();
    if (rekapKh[st] !== undefined) rekapKh[st]++;
  });
  rekapKh.hadir = Math.max(0, rekapKh.total - tidakHadirDetail.length);

  var batasHari = parseInt(configVal('BATAS_EDIT_HARI', 7));
  var tglJurnal = new Date(String(jurnal.tanggal) + 'T00:00:00');
  var diffHari  = (Date.now() - tglJurnal.getTime()) / (1000 * 60 * 60 * 24);
  var bisaEdit  = isAktif(configVal('IZIN_EDIT_JURNAL')) && diffHari <= batasHari;

  return ok({
    jurnal_id:   jurnal.jurnal_id,
    tanggal:     jurnal.tanggal,
    hari:        hariDari(String(jurnal.tanggal)),
    kelas_id:    jurnal.kelas_id,
    nama_kelas:  kelas ? kelas.nama_kelas : jurnal.kelas_id,
    mapel_id:    jurnal.mapel_id,
    nama_mapel:  mapel ? mapel.nama_mapel : jurnal.mapel_id,
    guru_id:     jurnal.guru_id,
    nama_guru:   guru ? guru.nama : jurnal.guru_id,
    jam_ids:     jamIds,
    jam_label:   jamLabel(jamIds),
    ringkasan:   jurnal.ringkasan_kegiatan,
    catatan:     jurnal.catatan,
    status:      jurnal.status,
    created_at:  jurnal.created_at,
    updated_at:  jurnal.updated_at,
    tidak_hadir: tidakHadirDetail,      // ganti nama field: eksplisit hanya tidak hadir
    rekap_kehadiran: rekapKh,
    bisa_edit:   bisaEdit,
  });
}

// ══════════════════════════════════════════════════════════════
// [BARU — 2026-09-15] Rekap Jurnal Mingguan (dasar fitur Export PDF)
//
// Dua endpoint read-only, dipakai frontend untuk menyusun PDF rekap:
//   getRekapJurnalGuru  → semua sesi milik SATU guru dalam rentang tanggal
//   getRekapJurnalKelas → semua sesi SATU kelas dalam rentang tanggal
//
// Sengaja TIDAK dipakai ulang endpoint lain (getJurnalSaya hanya per-bulan
// & guru sendiri; getAllJurnal Admin-only & maks 1 hari; getJadwalKelas
// campur jadwal-kosong+jurnal 1 hari) — kebutuhan di sini murni "jurnal
// yang SUDAH ADA di rentang tanggal", jadi cukup filter 10_JURNAL langsung
// seperti getAllJurnal, tapi dengan rentang tanggal alih-alih 1 hari, dan
// tanpa pagination (rentang dibatasi REKAP_MAX_HARI supaya tetap aman).
// Akses & scoping data mengikuti pola yang SUDAH ADA di getJurnalSaya
// (guru → hanya milik sendiri) dan getJadwalKelas (wali kelas → hanya
// kelas sendiri, admin → bebas) — TIDAK membuat aturan akses baru.
// ══════════════════════════════════════════════════════════════

var REKAP_MAX_HARI = 31; // batas aman satu request (fitur ini untuk rekap MINGGUAN, 31 hari jauh lebih dari cukup)

function _validasiRentangTanggalRekap(mulai, selesai) {
  if (!mulai || !selesai) return 'Parameter tanggal_mulai dan tanggal_selesai wajib diisi';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mulai) || !/^\d{4}-\d{2}-\d{2}$/.test(selesai)) {
    return 'Format tanggal: yyyy-MM-dd';
  }
  if (mulai > selesai) return 'tanggal_mulai tidak boleh setelah tanggal_selesai';
  var d1 = new Date(mulai + 'T00:00:00');
  var d2 = new Date(selesai + 'T00:00:00');
  var diffHari = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  if (diffHari > REKAP_MAX_HARI) return 'Rentang tanggal maksimal ' + REKAP_MAX_HARI + ' hari per export';
  return null;
}

// Helper bersama: hitung rekap kehadiran + detail "tidak hadir" (NIS + nama
// + status) untuk satu baris jurnal, dari data yang sudah di-index sekali
// di pemanggil (supaya tidak filterBy/groupBy berulang per baris — pola
// sama seperti fungsi lain di file ini/Data.gs).
//
// [FIX 2026-09-17] NIS di 12_KEHADIRAN vs 06_SISWA bisa tersimpan beda tipe
// di Google Sheets (angka murni vs teks dengan leading zero, mis. 7821 vs
// "007821") tergantung cara data dientri — String() biasa TIDAK cukup untuk
// menyamakan keduanya. _nisKey() menormalkan dengan membuang leading zero
// supaya lookup nama siswa tetap kena walau format aslinya beda. Sebelumnya
// nama siswa gagal ditemukan (jatuh ke fallback NIS-only) untuk kasus ini.
function _nisKey(nis) {
  return String(nis).trim().replace(/^0+(?=\d)/, '');
}

function _indexSiswaByNis(siswaRows) {
  var map = {};
  siswaRows.forEach(function(s) { map[_nisKey(s.nis)] = s; });
  return map;
}

// [FIX 2026-09-20] Normalisasi nilai status kehadiran sebelum dicocokkan.
// Sebelumnya pakai `String(t.status).toLowerCase()` polos dibandingkan
// LANGSUNG ke key 'sakit'/'izin'/'alpa' — kalau nilai asli di sheet sedikit
// beda (spasi ekstra, "Alpha" bukan "Alpa", dst), pencocokan gagal TOTAL:
// rekap.sakit/izin/alpa selalu 0 (meski hadir/tidak-hadir tetap benar,
// karena itu dihitung dari JUMLAH baris, bukan dari status) — dan di
// frontend, pengelompokan nama siswa per status jadi KOSONG SAMA SEKALI
// (nama tidak hadir tidak muncul, walau datanya ADA). Dicocokkan pakai
// "dimulai dengan" (bukan exact match) supaya lebih toleran.
function _normalisasiStatusKehadiran(status) {
  var s = String(status || '').trim().toLowerCase();
  if (s.indexOf('sakit') === 0) return 'sakit';
  if (s.indexOf('izin') === 0) return 'izin';
  if (s.indexOf('alp') === 0) return 'alpa'; // cocok utk "Alpa" maupun "Alpha"
  return s;
}

function _rekapKehadiranSatuJurnal(jurnalId, totalSiswaKelas, tidakHadirByJurnal, siswaIdx) {
  var th = tidakHadirByJurnal[String(jurnalId)] || [];
  var rekap = { hadir: Math.max(0, totalSiswaKelas - th.length), sakit: 0, izin: 0, alpa: 0, total: totalSiswaKelas };
  var label = [];
  var detail = []; // [BARU] {nis, nama, status, keterangan} — dipakai PDF & prompt AI supaya NIS+nama tampil lengkap
  th.forEach(function(t) {
    var st = _normalisasiStatusKehadiran(t.status);
    if (rekap[st] !== undefined) rekap[st]++;
    var nisAsli = String(t.nis).trim();
    var s = siswaIdx[_nisKey(nisAsli)];
    var nama = s ? s.nama : '(nama tidak ditemukan)';
    label.push(nisAsli + ' - ' + nama + ' (' + t.status + ')');
    detail.push({ nis: nisAsli, nama: nama, status: t.status, keterangan: t.keterangan || '' });
  });
  return { rekap: rekap, label: label.join(', '), detail: detail };
}

function _urutkanRekapItems(items) {
  items.sort(function(a, b) {
    if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
    var na = parseInt(String((a.jam_ids && a.jam_ids[0]) || 'J99').replace('J', ''), 10);
    var nb = parseInt(String((b.jam_ids && b.jam_ids[0]) || 'J99').replace('J', ''), 10);
    return na - nb;
  });
}

/**
 * params: {
 *   guru_id?         hanya dipakai kalau ADMIN yang memanggil (guru biasa
 *                     selalu hanya melihat jurnalnya sendiri, sama seperti getJurnalSaya),
 *   tanggal_mulai,   (wajib) yyyy-MM-dd
 *   tanggal_selesai  (wajib) yyyy-MM-dd
 * }
 */
function actionGetRekapJurnalGuru(params, session) {
  if (!hasRole(session, ['GURU', 'ADMIN'])) return err('Akses ditolak', 403);

  var isAdmin = hasRole(session, ['ADMIN']);
  var guruId = (isAdmin && params.guru_id) ? String(params.guru_id).trim() : session.guru_id;
  if (!guruId) return err('guru_id wajib (akun ini tidak terhubung ke data guru)');

  var mulai = String(params.tanggal_mulai || '').trim();
  var selesai = String(params.tanggal_selesai || '').trim();
  var errMsg = _validasiRentangTanggalRekap(mulai, selesai);
  if (errMsg) return err(errMsg);

  var tahun = configVal('TAHUN_AKTIF');
  var jurnal = readSheet('10_JURNAL').filter(function(j) {
    return String(j.guru_id) === String(guruId)
      && String(j.tahun_id) === tahun
      && String(j.status) !== 'DELETED'
      && String(j.tanggal) >= mulai
      && String(j.tanggal) <= selesai;
  });

  var guru = findBy('04_GURU', 'guru_id', guruId);
  var kelasIdx = indexBy(readSheet('05_KELAS'), 'kelas_id');
  var mapelIdx = indexBy(readSheet('07_MAPEL'), 'mapel_id');
  var jurnalJamByJurnal = groupBy(readSheet('11_JURNAL_JAM'), 'jurnal_id');
  var tidakHadirByJurnal = groupBy(readSheet('12_KEHADIRAN'), 'jurnal_id');
  var siswaIdx = _indexSiswaByNis(readSheet('06_SISWA'));

  // Guru bisa mengajar >1 kelas dalam satu minggu — hitung jumlah siswa
  // aktif per kelas HANYA untuk kelas yang benar-benar muncul di hasil.
  var kelasTerpakai = {};
  jurnal.forEach(function(j) { kelasTerpakai[String(j.kelas_id)] = true; });
  var siswaCountByKelas = {};
  Object.keys(kelasTerpakai).forEach(function(kid) {
    siswaCountByKelas[kid] = filterBy('06_SISWA', 'kelas_id', kid)
      .filter(function(s) { return isAktif(s.aktif); }).length;
  });

  var items = jurnal.map(function(j) {
    var k = kelasIdx[String(j.kelas_id)];
    var m = mapelIdx[String(j.mapel_id)];
    var jj = jurnalJamByJurnal[String(j.jurnal_id)] || [];
    var jamIds = jj.map(function(x) { return x.jam_id; });
    var rk = _rekapKehadiranSatuJurnal(j.jurnal_id, siswaCountByKelas[String(j.kelas_id)] || 0, tidakHadirByJurnal, siswaIdx);

    return {
      jurnal_id:  j.jurnal_id,
      tanggal:    j.tanggal,
      hari:       hariDari(String(j.tanggal)),
      kelas_id:   j.kelas_id,
      nama_kelas: k ? k.nama_kelas : j.kelas_id,
      mapel_id:   j.mapel_id,
      nama_mapel: m ? m.nama_mapel : j.mapel_id,
      jam_ids:    jamIds,
      jam_label:  jamLabel(jamIds),
      ringkasan:  j.ringkasan_kegiatan,
      catatan:    j.catatan,
      kehadiran:  rk.rekap,
      tidak_hadir_label: rk.label,
      tidak_hadir_detail: rk.detail,
    };
  });

  _urutkanRekapItems(items);

  return ok({
    guru_id: guruId,
    nama_guru: guru ? guru.nama : guruId,
    tanggal_mulai: mulai,
    tanggal_selesai: selesai,
    total_sesi: items.length,
    items: items,
  });
}

/**
 * params: {
 *   kelas_id?        wajib untuk ADMIN; wali kelas default ke kelas sendiri
 *                     (sama seperti getJadwalKelas),
 *   tanggal_mulai,   (wajib) yyyy-MM-dd
 *   tanggal_selesai  (wajib) yyyy-MM-dd
 * }
 */
function actionGetRekapJurnalKelas(params, session) {
  if (!hasRole(session, ['ADMIN', 'WALI_KELAS', 'GURU'])) return err('Akses ditolak', 403);

  var kelasId = params.kelas_id || (session.kelas_wali ? session.kelas_wali.kelas_id : '');
  if (!kelasId) return err('kelas_id wajib (atau Anda belum ditugaskan sebagai wali kelas)');

  // Sama seperti getJadwalKelas: wali kelas hanya boleh lihat kelas sendiri.
  if (!hasRole(session, ['ADMIN'])) {
    if (!session.kelas_wali || session.kelas_wali.kelas_id !== kelasId) {
      return err('Akses ditolak: bukan kelas Anda', 403);
    }
  }

  var mulai = String(params.tanggal_mulai || '').trim();
  var selesai = String(params.tanggal_selesai || '').trim();
  var errMsg = _validasiRentangTanggalRekap(mulai, selesai);
  if (errMsg) return err(errMsg);

  var tahun = configVal('TAHUN_AKTIF');
  var jurnal = readSheet('10_JURNAL').filter(function(j) {
    return String(j.kelas_id) === String(kelasId)
      && String(j.tahun_id) === tahun
      && String(j.status) !== 'DELETED'
      && String(j.tanggal) >= mulai
      && String(j.tanggal) <= selesai;
  });

  var kelasInfo = findBy('05_KELAS', 'kelas_id', kelasId);
  var guruIdx = indexBy(readSheet('04_GURU'), 'guru_id');
  var mapelIdx = indexBy(readSheet('07_MAPEL'), 'mapel_id');
  var jurnalJamByJurnal = groupBy(readSheet('11_JURNAL_JAM'), 'jurnal_id');
  var tidakHadirByJurnal = groupBy(readSheet('12_KEHADIRAN'), 'jurnal_id');

  // [FIX 2026-09-20] siswaIdx SEBELUMNYA cuma dibangun dari siswa AKTIF di
  // kelas ini (var siswaKelas di bawah) — akibatnya nama siswa yang sudah
  // dinonaktifkan/pindah kelas (tapi punya catatan kehadiran historis di
  // jurnal lama kelas ini) GAGAL ditemukan, jatuh ke fallback "(nama tidak
  // ditemukan)". totalSiswa (utk hitung Hadir/Tidak Hadir) TETAP dari siswa
  // AKTIF saja di kelas ini (itu benar, mencerminkan jumlah siswa saat ini)
  // — tapi pencarian NAMA untuk histori kehadiran dicari dari SELURUH
  // 06_SISWA (NIS unik secara nasional, jadi aman dicari lintas kelas/status
  // aktif) — sama seperti pola di actionGetRekapJurnalGuru.
  var siswaKelas = filterBy('06_SISWA', 'kelas_id', kelasId).filter(function(s) { return isAktif(s.aktif); });
  var totalSiswa = siswaKelas.length;
  var siswaIdx = _indexSiswaByNis(readSheet('06_SISWA'));

  var items = jurnal.map(function(j) {
    var g = guruIdx[String(j.guru_id)];
    var m = mapelIdx[String(j.mapel_id)];
    var jj = jurnalJamByJurnal[String(j.jurnal_id)] || [];
    var jamIds = jj.map(function(x) { return x.jam_id; });
    var rk = _rekapKehadiranSatuJurnal(j.jurnal_id, totalSiswa, tidakHadirByJurnal, siswaIdx);

    return {
      jurnal_id:  j.jurnal_id,
      tanggal:    j.tanggal,
      hari:       hariDari(String(j.tanggal)),
      guru_id:    j.guru_id,
      nama_guru:  g ? g.nama : j.guru_id,
      mapel_id:   j.mapel_id,
      nama_mapel: m ? m.nama_mapel : j.mapel_id,
      jam_ids:    jamIds,
      jam_label:  jamLabel(jamIds),
      ringkasan:  j.ringkasan_kegiatan,
      catatan:    j.catatan,
      kehadiran:  rk.rekap,
      tidak_hadir_label: rk.label,
      tidak_hadir_detail: rk.detail,
    };
  });

  _urutkanRekapItems(items);

  return ok({
    kelas_id: kelasId,
    nama_kelas: kelasInfo ? kelasInfo.nama_kelas : kelasId,
    tanggal_mulai: mulai,
    tanggal_selesai: selesai,
    total_sesi: items.length,
    items: items,
  });
}
