# Apps Script — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**

---

## Struktur File

```
apps-script/
├── Code.gs          ← Router utama (doGet / doPost)
├── Auth.gs          ← Login, session, cek role
├── Data.gs          ← Master data & jadwal
├── Jurnal.gs        ← CRUD jurnal mengajar
├── Utils.gs         ← Helper (sheet reader, ID gen, log)
├── appsscript.json  ← Manifest (timezone, runtime, webapp)
└── .clasp.json      ← Config clasp (sync ke GitHub)
```

---

## Cara Setup (Pertama Kali)

### 1. Buat Apps Script terikat ke Spreadsheet

1. Buka **Google Spreadsheet** template Jurnal Mengajar
2. Menu → **Extensions → Apps Script**
3. Ini otomatis membuat script yang **bound** ke spreadsheet
4. Catat **Script ID** dari URL:
   `https://script.google.com/home/projects/`**`SCRIPT_ID_ADA_DI_SINI`**`/edit`

### 2. Install clasp

```bash
npm install -g @google/clasp
clasp login
```

### 3. Update .clasp.json

Edit file `.clasp.json`:
```json
{
  "scriptId": "SCRIPT_ID_DARI_LANGKAH_1",
  "rootDir": "."
}
```

### 4. Push kode ke Apps Script

```bash
cd apps-script/
clasp push
```

Jawab `Y` jika ditanya overwrite.

### 5. Deploy sebagai Web App

Di editor Apps Script:
1. Klik **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Klik **Deploy**
6. Copy **Web app URL** — ini yang dimasukkan ke `js/config.js` di GitHub

### 6. Setup trigger harian

Di editor Apps Script, buka **Code.gs**, jalankan fungsi:
```
setupTriggers()
```
Ini mengaktifkan cleanup token expired setiap hari jam 3 pagi.

### 7. Test

Jalankan `testLogin()` dari editor untuk verifikasi koneksi ke Spreadsheet.

---

## Cara Update Kode (Setelah Setup)

Edit file `.gs` di lokal/GitHub, lalu:

```bash
clasp push
clasp deploy --deploymentId DEPLOYMENT_ID --description "update v1.1"
```

Atau re-deploy dari UI Apps Script.

---

## Endpoint API

Base URL: `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`

### Publik (tidak perlu token)

| Method | Action | Keterangan |
|--------|--------|------------|
| GET | `?action=ping` | Health check |
| GET | `?action=getConfig` | Konfigurasi publik sekolah |
| POST | `?action=login` | Login, return token |
| GET | `?action=getKelasPublik` | [BARU] Daftar kelas versi minimal (kelas_id, nama_kelas, tingkat) — untuk dropdown menu "Jadwal Kelas" publik di homepage, TANPA login |
| GET | `?action=getJadwalKelasPublik` | [BARU] Jadwal kelas manapun (mapel, guru, jam) TANPA data kehadiran/jurnal — param: `kelas_id` (wajib), `hari` (opsional, default hari ini). Publik tanpa login (keputusan eksplisit user, lihat MASTER_CONTEXT_HANDOFF.md Bagian K) |

**Login body:**
```json
{ "username": "budi_s", "password": "budi123" }
```

**Login response:**
```json
{
  "ok": true,
  "data": {
    "token": "abc123...",
    "nama": "Budi Santoso, S.Pd.",
    "role": "GURU",
    "kelas_wali": null
  }
}
```

### Butuh Token

Kirim token di:
- **GET**: `?action=xxx&token=TOKEN`
- **POST body**: `{ "token": "TOKEN", ... }`

| Action | Method | Role | Keterangan |
|--------|--------|------|------------|
| `logout` | POST | Semua | Logout |
| `getJadwalHariIni` | GET | GURU | Jadwal guru hari ini (+ param `tanggal`) |
| `getJadwalGuru` | GET | GURU/ADMIN | Jadwal guru per hari |
| `getJadwalKelas` | GET | GURU/WALI/ADMIN | Jurnal kelas + rekap kehadiran (param: `kelas_id`, `tanggal`) — WALI hanya kelasnya sendiri |
| `getJadwalPerGuru` | GET | ADMIN | [BARU] Seluruh jadwal mengajar 1 guru per hari (SENIN–SABTU) — param: `guru_id` |
| `createJurnal` | POST | GURU/ADMIN | Buat jurnal baru (param `kehadiran`: HANYA array siswa TIDAK hadir) |
| `updateJurnal` | POST | GURU/ADMIN | Edit jurnal (dalam batas `BATAS_EDIT_HARI`) |
| `getJurnalSaya` | GET | GURU | [PAGINATION] Daftar jurnal milik sendiri — param opsional `page`, `pageSize` (default 25) |
| `getDetailJurnal` | GET | GURU/WALI/ADMIN | Detail jurnal — field `tidak_hadir` (bukan lagi `kehadiran`) |
| `getGuru` | GET | Semua | Daftar guru |
| `getKelas` | GET | Semua | Daftar kelas lengkap (dengan nama wali kelas) |
| `getSiswa` | GET | Semua | Siswa per kelas |
| `getMapel` | GET | Semua | Daftar mapel |
| `getJam` | GET | Semua | Daftar jam |
| `getAllJurnal` | GET | ADMIN | [PAGINATION] Semua jurnal — param `tanggal` WAJIB (maks. 1 hari/pencarian), filter opsional `guru_id`, `mapel_id`, `page`, `pageSize` |
| `getUser` | GET | ADMIN | Daftar akun |
| `updateConfig` | POST | ADMIN | Update konfigurasi |
| `getLog` | GET | ADMIN | [PAGINATION] Log aktivitas, terbaru dulu — param opsional `page`, `pageSize` (default 25) |

**Catatan response terpaginasi** — semua endpoint bertanda `[PAGINATION]` mengembalikan bentuk:
```json
{ "ok": true, "data": { "items": [...], "page": 1, "pageSize": 25, "totalItems": 42, "totalPages": 2 } }
```

### Contoh: Create Jurnal

```json
POST ?action=createJurnal
{
  "token": "TOKEN",
  "tanggal": "2026-09-05",
  "kelas_id": "K001",
  "mapel_id": "M010",
  "jam_ids": ["J01", "J02"],
  "ringkasan_kegiatan": "Algoritma dan flowchart dasar",
  "catatan": "Siswa aktif bertanya",
  "kehadiran": [
    { "nis": "1001003", "status": "SAKIT", "keterangan": "Demam" }
  ]
}
```

> **Penting:** `kehadiran` HANYA berisi siswa yang **TIDAK hadir** (SAKIT/IZIN/ALPA). Siswa yang hadir **tidak dikirim sama sekali** — lihat "Skema Kehadiran" di bawah.

---

## Skema Kehadiran (Hanya-Tidak-Hadir)

Sheet `12_KEHADIRAN` **hanya menyimpan baris untuk siswa yang TIDAK hadir**. Siswa yang hadir tidak pernah ditulis sebagai baris. Jumlah hadir dihitung di server:

```
hadir = total_siswa_kelas − jumlah_baris_tidak_hadir
```

Ini memangkas volume tulis ke Spreadsheet secara signifikan untuk kelas yang mayoritas hadir penuh (mis. kelas 33 siswa dengan 1–2 tidak hadir → dari 33 baris jadi 1–2 baris), bagian dari optimasi performa untuk ~40 guru bersamaan.

---

## Performa & Caching

- **Cache 2 lapis (server, Apps Script)**: in-memory per eksekusi + `CacheService` lintas eksekusi. Sheet master data (`CONFIG`, `TAHUN_AJARAN`, `GURU`, `KELAS`, `SISWA`, `MAPEL`, `JAM`) di-cache 300 detik, `USER` 60 detik, `JADWAL` 180 detik.
- Sheet transaksional (`JURNAL`, `JURNAL_JAM`, `KEHADIRAN`, `LOG`) **sengaja tidak di-cache** karena berubah terus.
- Setiap operasi tulis memanggil `invalidateCache(sheetName)` agar tidak ada data basi.
- Batch write (`appendManyToSheet`, `setValues`) dipakai untuk semua insert multi-baris, menggantikan `appendRow()` berulang.
- Lookup relasi (guru↔kelas↔mapel dsb.) memakai `indexBy()`/`groupBy()` (Map sekali-bangun), bukan `.find()`/`.filter()` berulang di dalam loop (menghindari pola N+1).

### Cache Client-Side (localStorage, di perangkat pengguna)

**Ini lapis cache TERPISAH dari cache server di atas** — disepakati 2026-09-08 setelah diskusi keamanan (lihat MASTER_CONTEXT_HANDOFF.md).

- Data master (`getGuru`, `getKelas`, `getMapel`, `getJam`, `getSiswa` per kelas, `getJadwalPerGuru`) di-cache di `localStorage` browser masing-masing pengguna oleh `frontend/js/cache.js` — **BUKAN** disimpan sebagai file JSON di repo GitHub (repo ini publik; menyimpan data siswa/guru sebagai file publik akan jauh LEBIH TIDAK aman dibanding kondisi sekarang).
- Data transaksional (`getJadwalHariIni`, `getJadwalKelas`, `getJadwalKelasPublik`, jurnal, kehadiran, log) **TIDAK PERNAH** di-cache client-side — selalu live, karena mengandung status yang berubah tiap hari (`sudah_diisi`, konflik, dsb.).
- **Invalidasi otomatis**: `01_CONFIG` punya baris `DATA_VERSION` (dibuat otomatis pertama kali dipakai). Trigger sederhana `onEdit(e)` di `Code.gs` menaikkan angka ini setiap kali sheet `04_GURU`/`05_KELAS`/`06_SISWA`/`07_MAPEL`/`09_JADWAL` diedit langsung di Spreadsheet — **trigger ini aktif otomatis, admin TIDAK PERLU setup apapun** (simple trigger bawaan Google Sheets).
- `getConfig` mengembalikan `data_version`. Frontend bandingkan dengan versi tersimpan di perangkat; kalau beda, seluruh cache lokal dihapus dan diisi ulang secara lazy (baru fetch lagi saat benar-benar dibutuhkan, bukan preload semua sekaligus).
- Tombol 🔄 di header app (semua role) memaksa sinkronisasi kapan saja — berguna sesaat setelah admin melakukan banyak perubahan sekaligus, sebelum trigger sempat jalan, atau untuk troubleshooting.
- **Gagal-aman**: semua akses `localStorage` dibungkus try-catch. Kalau nonaktif (mode privat browser) atau penuh, cache dianggap selalu kosong — aplikasi tetap berjalan normal, hanya tanpa manfaat cache (kembali ke perilaku fetch-langsung seperti sebelumnya).

---

## Multi-Role

Role disimpan sebagai string pisah koma di `03_USER.role`:

| Nilai di sheet | Akses |
|---|---|
| `GURU` | Dashboard guru, isi jurnal |
| `ADMIN` | Semua akses |
| `WALI_KELAS` | Jurnal kelas yang dipegang |
| `GURU,WALI_KELAS` | Guru + lihat jurnal kelas |
| `GURU,ADMIN` | Guru + semua akses admin (untuk KS yang juga mengajar) |

---

## Konflik Jadwal

Jika guru mengajar dua kelas pada jam yang sama, sistem **tidak memblokir** — tapi response `getJadwalHariIni` akan menyertakan:
```json
{ "konflik": true, "konflik_info": "Jam ini juga terdapat di kelas lain" }
```
Frontend menampilkan badge/warning. Guru memilih kelas mana yang diisi.

---

## Catatan Keamanan

- Password **plain text** sesuai keputusan desain (sekolah internal)
- Token disimpan di **PropertiesService** (server-side), tidak di Spreadsheet
- Token expired otomatis dibersihkan setiap hari via trigger
- CORS ditangani otomatis oleh Google Apps Script Web App
- Spreadsheet ID **tidak pernah terekspos** ke frontend (bound script)
