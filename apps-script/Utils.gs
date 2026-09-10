// ============================================================
// Utils.gs — Helper Functions
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
// ============================================================

var SS = SpreadsheetApp.getActiveSpreadsheet();
var CACHE = CacheService.getScriptCache();

// TTL cache per jenis sheet (detik). Sheet yang jarang berubah (master data)
// di-cache lebih lama; sheet yang sering ditulis (jurnal/kehadiran) lebih pendek
// atau tidak di-cache sama sekali supaya data selalu segar.
var SHEET_CACHE_TTL = {
  '01_CONFIG':      300,  // 5 menit — jarang berubah
  '02_TAHUN_AJARAN':300,
  '04_GURU':        300,
  '05_KELAS':       300,
  '06_SISWA':       300,  // 1000 baris, jarang berubah — paling penting di-cache
  '07_MAPEL':       300,
  '08_JAM':         300,
  '09_JADWAL':      180,  // manual diedit admin, cache sedang
  '03_USER':        60,   // butuh agak segar untuk login, tapi tetap boleh cache singkat
  // 10_JURNAL, 11_JURNAL_JAM, 12_KEHADIRAN, 13_LOG: TIDAK di-cache (sering ditulis,
  // dan harus selalu real-time supaya "sudah diisi" langsung akurat setelah simpan)
};

// Cache in-memory per eksekusi (hidup selama satu request/doGet/doPost berjalan).
// Ini mencegah sheet yang sama dibaca berkali-kali DALAM SATU request yang
// butuh data sama (mis. getJadwalKelas butuh 05_KELAS lebih dari sekali).
var _execCache = {};

// ── Response builder ─────────────────────────────────────────

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(message, code) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: message, code: code || 400 }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Sheet reader (dengan cache 2 lapis) ────────────────────────

/**
 * Baca semua baris sheet sebagai array of objects.
 * Baris 3 = header (baris 1-2 = judul/subtitle).
 *
 * STRATEGI PERFORMA (penting untuk skala 40 guru bersamaan):
 * 1. Cache in-memory per eksekusi — kalau sheet yang sama diminta lagi
 *    dalam request yang sama, tidak baca ulang dari Spreadsheet sama sekali.
 * 2. CacheService (lintas eksekusi, TTL sesuai SHEET_CACHE_TTL) — untuk sheet
 *    master data yang jarang berubah (guru/kelas/siswa/mapel/jam/config),
 *    request BERIKUTNYA dalam beberapa menit tidak perlu buka Spreadsheet
 *    sama sekali, cukup ambil dari cache. Sheet transaksional (jurnal,
 *    kehadiran, log) TIDAK di-cache supaya selalu real-time.
 *
 * PENTING: Google Sheets otomatis mengonversi string tanggal (mis. "2026-09-05")
 * yang ditulis lewat appendRow() menjadi objek Date internal. Saat dibaca kembali
 * lewat getValues(), nilainya berupa Date, bukan string — ini merusak semua
 * perbandingan String(tanggal) === '2026-09-05' di seluruh kode.
 * Maka setiap kolom bernama persis 'tanggal' dinormalkan balik ke 'yyyy-MM-dd',
 * dan kolom yang mengandung '_at' (created_at, updated_at, dll) dinormalkan ke
 * 'yyyy-MM-dd HH:mm:ss'. Kolom lain dibiarkan apa adanya.
 */
function readSheet(sheetName) {
  // Lapis 1: cache in-memory per eksekusi
  if (_execCache[sheetName] !== undefined) return _execCache[sheetName];

  // Lapis 2: CacheService lintas eksekusi (hanya untuk sheet yang dikonfigurasi)
  var ttl = SHEET_CACHE_TTL[sheetName];
  if (ttl) {
    var cached = CACHE.get('sheet_' + sheetName);
    if (cached) {
      var parsed = JSON.parse(cached);
      _execCache[sheetName] = parsed;
      return parsed;
    }
  }

  // Cache miss — baca sungguhan dari Spreadsheet
  var rows = _readSheetRaw(sheetName);
  _execCache[sheetName] = rows;

  if (ttl) {
    try {
      CACHE.put('sheet_' + sheetName, JSON.stringify(rows), ttl);
    } catch (e) {
      // CacheService punya limit ukuran (100KB/key) — kalau sheet terlalu besar
      // (mis. 06_SISWA dengan 1000 baris bisa mepet), gagal cache tidak boleh
      // menghentikan request, cukup lanjut tanpa cache untuk sheet ini.
    }
  }

  return rows;
}

function _readSheetRaw(sheetName) {
  var ws = SS.getSheetByName(sheetName);
  if (!ws) return [];
  var data = ws.getDataRange().getValues();
  if (data.length < 3) return [];

  var headers = data[2]; // baris ke-3 = header
  // PENTING: JANGAN panggil configVal()/getConfig() di sini — itu akan
  // memanggil readSheet('01_CONFIG') lagi dan menyebabkan rekursi tak berujung.
  // Pakai timezone script secara langsung sebagai gantinya.
  var tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
  var rows = [];

  for (var i = 3; i < data.length; i++) {
    var row = data[i];
    // skip baris kosong (semua kolom pertama kosong)
    if (!row[0] && row[0] !== 0) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var colName = headers[j];
      var val = row[j] !== undefined ? row[j] : '';

      if (val instanceof Date) {
        if (colName === 'tanggal') {
          val = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
        } else if (String(colName).indexOf('_at') >= 0 || colName === 'waktu' || colName === 'last_login') {
          val = Utilities.formatDate(val, tz, 'yyyy-MM-dd HH:mm:ss');
        } else {
          val = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
        }
      }

      obj[colName] = val;
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * Hapus cache untuk satu sheet (in-memory + CacheService).
 * WAJIB dipanggil setiap kali sheet ditulis (append/update/delete) supaya
 * request berikutnya tidak membaca data basi dari cache.
 */
function invalidateCache(sheetName) {
  delete _execCache[sheetName];
  try { CACHE.remove('sheet_' + sheetName); } catch (e) {}
}

/**
 * Append satu baris ke sheet. Otomatis invalidasi cache sheet tsb.
 * values = array sesuai urutan kolom.
 */
function appendToSheet(sheetName, values) {
  var ws = SS.getSheetByName(sheetName);
  if (!ws) throw new Error('Sheet tidak ditemukan: ' + sheetName);
  ws.appendRow(values);
  invalidateCache(sheetName);
}

/**
 * Append BANYAK baris sekaligus dalam satu panggilan (jauh lebih cepat
 * daripada appendRow() berulang, karena hanya 1 kali write ke Spreadsheet
 * API alih-alih N kali). Dipakai untuk insert kehadiran/jurnal_jam massal.
 * rowsArray = array of array, mis. [[a,b,c],[d,e,f],...]
 */
function appendManyToSheet(sheetName, rowsArray) {
  if (!rowsArray || rowsArray.length === 0) return;
  var ws = SS.getSheetByName(sheetName);
  if (!ws) throw new Error('Sheet tidak ditemukan: ' + sheetName);
  var startRow = ws.getLastRow() + 1;
  var numCols = rowsArray[0].length;
  ws.getRange(startRow, 1, rowsArray.length, numCols).setValues(rowsArray);
  invalidateCache(sheetName);
}

/**
 * Update satu baris berdasarkan nilai kolom pertama (ID).
 * Otomatis invalidasi cache sheet tsb.
 * newValues = object { kolom: nilai, ... }
 */
function updateRowById(sheetName, idValue, newValues) {
  var ws = SS.getSheetByName(sheetName);
  if (!ws) return false;
  var data = ws.getDataRange().getValues();
  var headers = data[2];

  for (var i = 3; i < data.length; i++) {
    if (String(data[i][0]) === String(idValue)) {
      for (var key in newValues) {
        var col = headers.indexOf(key);
        if (col >= 0) ws.getRange(i + 1, col + 1).setValue(newValues[key]);
      }
      invalidateCache(sheetName);
      return true;
    }
  }
  return false;
}

/**
 * Hapus baris berdasarkan array nilai kolom pertama (ID). Menghapus dari
 * bawah ke atas supaya indeks baris tidak bergeser saat proses berjalan.
 * Otomatis invalidasi cache sheet tsb.
 */
function deleteRowsByIds(sheetName, ids) {
  if (!ids || ids.length === 0) return 0;
  var ws = SS.getSheetByName(sheetName);
  if (!ws) return 0;
  var data = ws.getDataRange().getValues();
  var deleted = 0;

  for (var i = data.length - 1; i >= 3; i--) {
    if (ids.indexOf(data[i][0]) >= 0) {
      ws.deleteRow(i + 1);
      deleted++;
    }
  }
  if (deleted > 0) invalidateCache(sheetName);
  return deleted;
}

// ── ID Generator ─────────────────────────────────────────────

/**
 * Generate ID berikutnya dengan membaca ID TERBESAR yang sungguhan ada di
 * sheet (bukan sekadar getLastRow()), supaya aman meski ada baris yang
 * pernah dihapus di tengah (mis. oleh cleanupTestData).
 */
function nextId(sheetName, prefix, padLength) {
  var rows = readSheet(sheetName);
  var maxNum = 0;
  rows.forEach(function(r) {
    var id = String(r[Object.keys(r)[0]] || '');
    if (id.indexOf(prefix) === 0) {
      var num = parseInt(id.substring(prefix.length), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return prefix + String(maxNum + 1).padStart(padLength || 5, '0');
}

// ── Config ───────────────────────────────────────────────────

var _configCache = null;

function getConfig() {
  if (_configCache) return _configCache;
  var rows = readSheet('01_CONFIG');
  var cfg = {};
  rows.forEach(function(r) {
    if (r.aktif === 'TRUE' || r.aktif === true) {
      cfg[r.config_key] = r.config_value;
    }
  });
  _configCache = cfg;
  return cfg;
}

function configVal(key, fallback) {
  var cfg = getConfig();
  return cfg[key] !== undefined ? cfg[key] : (fallback !== undefined ? fallback : null);
}

/**
 * [BARU — arsitektur cache client-side, 2026-09-08]
 * Naikkan angka DATA_VERSION di sheet 01_CONFIG. Dipanggil otomatis oleh
 * trigger sederhana onEdit(e) di Code.gs setiap kali admin mengedit sheet
 * master data (guru/kelas/siswa/mapel/jadwal) langsung di Spreadsheet.
 * Frontend membandingkan angka ini (via getConfig) dengan yang tersimpan
 * di localStorage tiap perangkat untuk tahu kapan cache lokal harus
 * dibersihkan — lihat js/cache.js.
 *
 * SENGAJA membungkus semuanya dalam try-catch: fungsi ini dipanggil dari
 * simple trigger, yang TIDAK BOLEH melempar error terlihat ke admin saat
 * dia sedang mengedit sheet biasa. Kalau bump gagal (mis. sheet 01_CONFIG
 * terhapus/berubah struktur), kegagalan diam-diam diabaikan — efeknya
 * paling buruk cuma cache pengguna lain sedikit basi sampai bump berikutnya
 * berhasil atau mereka pakai tombol "Sinkronkan Data" manual di app.
 */
function bumpDataVersion() {
  try {
    var ws = SS.getSheetByName('01_CONFIG');
    if (!ws) return;
    var data = ws.getDataRange().getValues();
    var headers = data[2]; // baris header ada di baris ke-3 (index 2)
    var keyCol = headers.indexOf('config_key');
    var valCol = headers.indexOf('config_value');
    if (keyCol === -1 || valCol === -1) return;

    for (var i = 3; i < data.length; i++) {
      if (String(data[i][keyCol]) === 'DATA_VERSION') {
        var current = parseInt(data[i][valCol], 10) || 0;
        ws.getRange(i + 1, valCol + 1).setValue(current + 1);
        _configCache = null;
        invalidateCache('01_CONFIG');
        return;
      }
    }

    // Baris DATA_VERSION belum ada (mis. baru pertama kali dipakai) —
    // buat otomatis, kolom mengikuti header sheet SAAT INI (dinamis,
    // bukan hardcode posisi, biar tahan kalau kolom pernah ditambah/geser).
    var newRow = headers.map(function(h) {
      if (h === 'config_key') return 'DATA_VERSION';
      if (h === 'config_value') return 1;
      if (h === 'keterangan') return 'Nomor versi data master (guru/kelas/siswa/mapel/jadwal) — NAIK OTOMATIS via trigger onEdit, JANGAN diedit manual';
      if (h === 'tipe') return 'NUMBER';
      if (h === 'aktif') return true;
      return '';
    });
    ws.appendRow(newRow);
    _configCache = null;
    invalidateCache('01_CONFIG');
  } catch (err) {
    // Diamkan — lihat catatan di atas fungsi ini.
  }
}

// ── Tanggal ───────────────────────────────────────────────────

function today() {
  var tz = configVal('ZONA_WAKTU', 'Asia/Jakarta');
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function nowTs() {
  var tz = configVal('ZONA_WAKTU', 'Asia/Jakarta');
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Ambil nama hari dari tanggal (format 'yyyy-MM-dd').
 * Return: 'SENIN' | 'SELASA' | dst.
 */
function hariDari(tanggal) {
  var days = ['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'];
  var d = new Date(tanggal + 'T00:00:00');
  return days[d.getDay()];
}

// ── Max jam per hari ──────────────────────────────────────────

function maxJamHari(hari) {
  var map = {
    'SENIN':  parseInt(configVal('JAM_MAKS_SENIN',  9)),
    'SELASA': parseInt(configVal('JAM_MAKS_SELASA', 9)),
    'RABU':   parseInt(configVal('JAM_MAKS_RABU',   9)),
    'KAMIS':  parseInt(configVal('JAM_MAKS_KAMIS',  8)),
    'JUMAT':  parseInt(configVal('JAM_MAKS_JUMAT',  4)),
    'SABTU':  parseInt(configVal('JAM_MAKS_SABTU',  0)),
  };
  return map[hari] || 0;
}

// ── Log ───────────────────────────────────────────────────────

function writeLog(userId, aksi, tabel, keterangan) {
  try {
    var logId = nextId('13_LOG', 'L', 4);
    appendToSheet('13_LOG', [logId, nowTs(), userId, aksi, tabel, keterangan]);
  } catch(e) {
    // log gagal tidak boleh hentikan proses utama
  }
}

// ── Parse body POST ───────────────────────────────────────────

function parseBody(e) {
  try {
    if (e && e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
  } catch(ex) {}
  return {};
}

// ── Lookup helpers ────────────────────────────────────────────

function findBy(sheetName, key, value) {
  var rows = readSheet(sheetName);
  return rows.find(function(r) { return String(r[key]) === String(value); }) || null;
}

function filterBy(sheetName, key, value) {
  var rows = readSheet(sheetName);
  return rows.filter(function(r) { return String(r[key]) === String(value); });
}

// ── Index builder (hindari O(n²) saat lookup berulang) ─────────

/**
 * Bangun Map dari array of objects berdasarkan satu field, untuk lookup O(1)
 * alih-alih .find()/.filter() berulang di dalam loop (yang jadi O(n*m)).
 * Dipakai saat join data lintas sheet (mis. cocokkan guru_id ke nama guru
 * untuk banyak baris jadwal sekaligus).
 */
function indexBy(rows, key) {
  var map = {};
  rows.forEach(function(r) { map[String(r[key])] = r; });
  return map;
}

/**
 * Bangun Map<key, array> untuk kasus satu key punya banyak baris terkait
 * (mis. semua kehadiran untuk satu jurnal_id).
 */
function groupBy(rows, key) {
  var map = {};
  rows.forEach(function(r) {
    var k = String(r[key]);
    if (!map[k]) map[k] = [];
    map[k].push(r);
  });
  return map;
}

// ── Pagination ──────────────────────────────────────────────

/**
 * Potong array sesuai halaman. page dimulai dari 1.
 * Return: { items, page, pageSize, totalItems, totalPages }
 */
function paginate(items, page, pageSize) {
  page = Math.max(1, parseInt(page) || 1);
  pageSize = Math.max(1, parseInt(pageSize) || 25);
  var totalItems = items.length;
  var totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  page = Math.min(page, totalPages);
  var start = (page - 1) * pageSize;
  var pageItems = items.slice(start, start + pageSize);
  return {
    items: pageItems,
    page: page,
    pageSize: pageSize,
    totalItems: totalItems,
    totalPages: totalPages
  };
}
