// ============================================================
// Dashboard.gs — Statistik Kegiatan (untuk dashboard-kegiatan.html)
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
//
// [BARU — 2026-09-26] Satu endpoint read-only: getDashboardStats.
// TIDAK mengubah endpoint/file yang sudah ada — murni tambahan baru,
// mengikuti pola yang SUDAH ADA di actionGetRekapJurnalGuru/Kelas
// (Jurnal.gs): baca sheet, index sekali jalan, join in-memory.
//
// AKSES: semua role yang login (GURU/WALI_KELAS/ADMIN) — keputusan
// eksplisit user (2026-09-26): dashboard kegiatan ini agregat SELURUH
// sekolah, sama persis untuk semua role, bukan cuma ADMIN.
//
// mode:
//   'hari_ini'    → 1 hari, hari ini
//   'kemarin'     → 1 hari, kemarin
//   'minggu_lalu' → 7 hari SEBELUM hari ini (H-7 s.d. H-1, sudah lewat
//                    semua — supaya cache 1 minggu di frontend aman,
//                    tidak akan berubah lagi selama seminggu ke depan)
//
// Konsep "sesi terisi": jadwal (09_JADWAL) dikelompokkan jadi blok
// mengajar dengan groupJadwalBlok() — SAMA PERSIS seperti yang dipakai
// _jadwalGuru() di Data.gs (satu blok = kandidat satu jurnal). Blok
// dianggap "terisi" kalau ada baris 10_JURNAL dengan kombinasi
// guru_id+kelas_id+mapel_id yang sama pada tanggal itu.
// ============================================================

function actionGetDashboardStats(params, session) {
  if (!session) return err('Akses ditolak', 403);

  var mode = String(params.mode || 'hari_ini').trim();
  var tz = configVal('ZONA_WAKTU', 'Asia/Jakarta');
  var range = _rangeTanggalDashboard(mode, tz);
  if (!range) return err('mode tidak dikenal (hari_ini/kemarin/minggu_lalu)');

  var tahun = configVal('TAHUN_AKTIF');

  // ── Baca & siapkan data sekali jalan (bukan per-tanggal, biar hemat) ──
  var jadwalAktif = readSheet('09_JADWAL').filter(function(j) {
    return String(j.tahun_id) === tahun && isAktif(j.aktif);
  });
  var jurnalRange = readSheet('10_JURNAL').filter(function(j) {
    return String(j.tahun_id) === tahun
      && String(j.status) !== 'DELETED'
      && range.tanggalList.indexOf(String(j.tanggal)) >= 0;
  });
  var jurnalByTanggal = groupBy(jurnalRange, 'tanggal');

  var guruIdx  = indexBy(readSheet('04_GURU'), 'guru_id');
  var kelasIdx = indexBy(readSheet('05_KELAS'), 'kelas_id');
  var mapelIdx = indexBy(readSheet('07_MAPEL'), 'mapel_id');
  var siswaAktifByKelas = groupBy(
    readSheet('06_SISWA').filter(function(s) { return isAktif(s.aktif); }),
    'kelas_id'
  );
  var siswaIdx = _indexSiswaByNis(readSheet('06_SISWA')); // dari Jurnal.gs
  var tidakHadirByJurnal = groupBy(readSheet('12_KEHADIRAN'), 'jurnal_id');

  // ── Akumulator ──
  var totalSesi = 0, totalTerisi = 0;
  var guruDijadwalkanSet = {};
  var guruSudahIsiSet = {};
  var guruBelumMap = {}; // guru_id -> { guru_id, nama, jumlah_sesi_belum, detail: [...] }
  var trenPerTanggal = {}; // tanggal -> jumlah sesi terisi hari itu (dipakai mode minggu_lalu)
  var trenPerJam = {}; // 'HH' -> jumlah jurnal dibuat pada jam itu (dipakai mode harian)
  var kehadiran = { hadir: 0, sakit: 0, izin: 0, alpa: 0, total: 0 };

  range.tanggalList.forEach(function(tgl) {
    var hari = hariDari(tgl);
    var maxJam = maxJamHari(hari);

    var jadwalHari = jadwalAktif.filter(function(j) { return String(j.hari) === hari; })
      .filter(function(j) {
        var nomor = parseInt(String(j.jam_id).replace('J', ''));
        return nomor <= maxJam;
      });
    var blok = groupJadwalBlok(jadwalHari); // helper dari Data.gs

    var jTgl = jurnalByTanggal[tgl] || [];
    var isiSet = {};
    jTgl.forEach(function(j) { isiSet[j.guru_id + '|' + j.kelas_id + '|' + j.mapel_id] = true; });

    var terisiTanggalIni = 0;

    blok.forEach(function(b) {
      totalSesi++;
      guruDijadwalkanSet[b.guru_id] = true;
      var key = b.guru_id + '|' + b.kelas_id + '|' + b.mapel_id;

      if (isiSet[key]) {
        totalTerisi++;
        terisiTanggalIni++;
        guruSudahIsiSet[b.guru_id] = true;
      } else {
        var g = guruIdx[b.guru_id];
        var k = kelasIdx[b.kelas_id];
        var m = mapelIdx[b.mapel_id];
        if (!guruBelumMap[b.guru_id]) {
          guruBelumMap[b.guru_id] = {
            guru_id: b.guru_id,
            nama: g ? g.nama : b.guru_id,
            jumlah_sesi_belum: 0,
            detail: [],
          };
        }
        guruBelumMap[b.guru_id].jumlah_sesi_belum++;
        // Batasi detail per guru supaya payload tidak membengkak untuk mode minggu_lalu
        if (guruBelumMap[b.guru_id].detail.length < 10) {
          guruBelumMap[b.guru_id].detail.push({
            tanggal: tgl,
            hari: hari,
            nama_kelas: k ? k.nama_kelas : b.kelas_id,
            nama_mapel: m ? m.nama_mapel : b.mapel_id,
            jam_label: jamLabel(b.jam_ids),
          });
        }
      }
    });

    trenPerTanggal[tgl] = terisiTanggalIni;

    // Kehadiran + tren per jam — dari jurnal yang SUNGGUHAN sudah terisi tanggal ini
    jTgl.forEach(function(j) {
      var totalSiswaKelas = (siswaAktifByKelas[String(j.kelas_id)] || []).length;
      var rk = _rekapKehadiranSatuJurnal(j.jurnal_id, totalSiswaKelas, tidakHadirByJurnal, siswaIdx);
      kehadiran.hadir += rk.rekap.hadir;
      kehadiran.sakit += rk.rekap.sakit;
      kehadiran.izin  += rk.rekap.izin;
      kehadiran.alpa  += rk.rekap.alpa;
      kehadiran.total += rk.rekap.total;

      var jam = String(j.created_at || '').substring(11, 13); // 'yyyy-MM-dd HH:mm:ss' → 'HH'
      if (jam) trenPerJam[jam] = (trenPerJam[jam] || 0) + 1;
    });
  });

  // ── Susun tren sesuai mode ──
  var tren, trenTipe;
  if (mode === 'minggu_lalu') {
    trenTipe = 'harian';
    tren = range.tanggalList.map(function(tgl) {
      var hari = hariDari(tgl);
      var labelHari = hari.charAt(0) + hari.substring(1, 3).toLowerCase();
      return { label: labelHari + ' ' + tgl.substring(8, 10) + '/' + tgl.substring(5, 7), tanggal: tgl, jumlah: trenPerTanggal[tgl] || 0 };
    });
  } else {
    trenTipe = 'jam';
    // Jam sekolah wajar: 06–17. Isi 0 untuk jam tanpa data supaya grafik tetap rapi.
    tren = [];
    for (var h = 6; h <= 17; h++) {
      var hh = String(h).padStart(2, '0');
      tren.push({ label: hh + ':00', jumlah: trenPerJam[hh] || 0 });
    }
  }

  // ── Susun daftar guru belum isi (urut: paling banyak bolong dulu) ──
  var guruBelumList = Object.keys(guruBelumMap).map(function(k) { return guruBelumMap[k]; });
  guruBelumList.sort(function(a, b) { return b.jumlah_sesi_belum - a.jumlah_sesi_belum; });
  guruBelumList = guruBelumList.slice(0, 40); // batas aman payload

  var jumlahGuruDijadwalkan = Object.keys(guruDijadwalkanSet).length;
  var jumlahGuruSudahIsi    = Object.keys(guruSudahIsiSet).length;
  var jumlahGuruBelumIsi    = Object.keys(guruBelumMap).length;
  var persentaseTerisi = totalSesi > 0 ? Math.round((totalTerisi / totalSesi) * 100) : 0;

  return ok({
    mode: mode,
    tanggal_mulai: range.tanggalList[0],
    tanggal_selesai: range.tanggalList[range.tanggalList.length - 1],
    ringkasan: {
      total_jadwal_sesi: totalSesi,
      total_jurnal_terisi: totalTerisi,
      persentase_terisi: persentaseTerisi,
      jumlah_guru_dijadwalkan: jumlahGuruDijadwalkan,
      jumlah_guru_sudah_isi: jumlahGuruSudahIsi,
      jumlah_guru_belum_isi: jumlahGuruBelumIsi,
    },
    guru_belum_isi: guruBelumList,
    tren_tipe: trenTipe,
    tren: tren,
    kehadiran: kehadiran,
    generated_at: nowTs(),
  });
}

// Hitung daftar tanggal (yyyy-MM-dd) untuk satu mode dashboard.
function _rangeTanggalDashboard(mode, tz) {
  var base = new Date(today() + 'T00:00:00');
  var list = [];

  if (mode === 'hari_ini') {
    list = [today()];
  } else if (mode === 'kemarin') {
    var d = new Date(base); d.setDate(d.getDate() - 1);
    list = [Utilities.formatDate(d, tz, 'yyyy-MM-dd')];
  } else if (mode === 'minggu_lalu') {
    for (var i = 7; i >= 1; i--) {
      var d2 = new Date(base); d2.setDate(d2.getDate() - i);
      list.push(Utilities.formatDate(d2, tz, 'yyyy-MM-dd'));
    }
  } else {
    return null;
  }

  return { tanggalList: list };
}
