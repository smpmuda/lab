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
  var jamValid = readSheet('08_JAM').filter(function(j) { return j.aktif === 'TRUE' || j.aktif === true; });
  var jamValidIds = jamValid.map(function(j) { return j.jam_id; });
  var invalidJam = jamIds.filter(function(id) { return jamValidIds.indexOf(id) < 0; });
  if (invalidJam.length > 0) return err('Jam tidak valid: ' + invalidJam.join(', '));

  // Ambil siswa kelas HANYA untuk validasi NIS yang dikirim benar-benar ada di kelas ini
  var siswaKelas = filterBy('06_SISWA', 'kelas_id', kelasId)
    .filter(function(s) { return String(s.aktif) === 'TRUE'; });
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
    if (String(configVal('IZIN_EDIT_JURNAL')) !== 'TRUE') {
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
    updates.ringkasan_kegiatan = r;
  }
  if (body.catatan !== undefined) updates.catatan = String(body.catatan).trim();
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
    .filter(function(s) { return String(s.aktif) === 'TRUE'; });
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
  var izinEdit  = String(configVal('IZIN_EDIT_JURNAL')) === 'TRUE';
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
    .filter(function(s) { return String(s.aktif) === 'TRUE'; });
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
  var bisaEdit  = String(configVal('IZIN_EDIT_JURNAL')) === 'TRUE' && diffHari <= batasHari;

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
