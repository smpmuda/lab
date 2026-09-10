# Master Specification — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**
Versi: 1.0.0 | Terakhir diperbarui: 2026-09-04

---

## 1. Ringkasan Proyek

Aplikasi **Jurnal Mengajar** adalah sistem pencatatan kegiatan belajar mengajar (KBM) berbasis web yang berjalan di GitHub Pages, menggunakan Google Spreadsheet sebagai database dan Google Apps Script sebagai API backend.

### Tujuan Utama
- Guru mencatat kegiatan mengajar harian secara digital
- Wali kelas memantau kelengkapan jurnal kelas yang dipegang
- Admin mengelola seluruh data master dan memantau seluruh aktivitas

### Stack Teknologi
| Komponen | Teknologi |
|---|---|
| Frontend | HTML + CSS + Vanilla JS (GitHub Pages) |
| Backend/API | Google Apps Script (Web App) |
| Database | Google Spreadsheet |
| Autentikasi | Token session (Apps Script) |
| Hosting | GitHub Pages (smpmuda.github.io/lab) |

---

## 2. Role Pengguna (3 Role)

### 2.1 ADMIN
- Mengelola seluruh data master (guru, kelas, siswa, mapel, jadwal, jam, tahun ajaran)
- Melihat seluruh jurnal semua guru semua kelas
- Mengatur konfigurasi sekolah
- Melihat log aktivitas
- **Catatan:** Kepala Sekolah (KS) menggunakan role ADMIN

### 2.2 GURU
- Melihat jadwal mengajar sendiri (hari ini & mingguan)
- Mengisi jurnal berdasarkan jadwal
- Melihat & mengedit jurnal milik sendiri (sesuai batas waktu yang diatur admin)
- Menandai kehadiran siswa per jurnal

### 2.3 WALI_KELAS
- Melihat jurnal harian kelas yang dipegang
- Memilih tanggal untuk melihat jurnal hari lain
- Melihat ringkasan kehadiran per mata pelajaran
- Melihat daftar siswa tidak hadir
- **Catatan:** Seorang guru bisa merangkap sebagai wali kelas (role GURU, ditunjuk sebagai wali di data kelas)

---

## 3. Struktur Database (Google Spreadsheet)

### 3.1 Daftar Sheet

```
01_CONFIG
02_TAHUN_AJARAN
03_USER
04_GURU
05_KELAS
06_SISWA
07_MAPEL
08_JAM
09_JADWAL
10_JURNAL
11_JURNAL_JAM
12_KEHADIRAN
13_LOG
```

### 3.2 Detail Setiap Sheet

#### `01_CONFIG`
| Kolom | Tipe | Contoh |
|---|---|---|
| config_key | TEXT | NAMA_SEKOLAH |
| config_value | TEXT | SMP Muhammadiyah 2 Cilacap |
| keterangan | TEXT | Nama sekolah |
| tipe | TEXT | TEXT / NUMBER / BOOLEAN |
| aktif | BOOLEAN | TRUE |

**Konfigurasi wajib:**
```
NAMA_SEKOLAH, NAMA_APLIKASI, TAHUN_AKTIF, SEMESTER_AKTIF
JAM_MAKS_SENIN, JAM_MAKS_SELASA, JAM_MAKS_RABU
JAM_MAKS_KAMIS, JAM_MAKS_JUMAT, JAM_MAKS_SABTU
ZONA_WAKTU, IZIN_EDIT_JURNAL, BATAS_EDIT_HARI
```

**Konfigurasi otomatis (JANGAN diedit manual):**
```
DATA_VERSION  — [BARU, 2026-09-08] Nomor versi data master, naik +1 setiap
                kali sheet 04_GURU/05_KELAS/06_SISWA/07_MAPEL/09_JADWAL
                diedit, lewat trigger onEdit(e) di Code.gs. Dipakai cache
                client-side (frontend/js/cache.js) untuk tahu kapan cache
                di localStorage tiap pengguna harus dibersihkan. Baris ini
                dibuat OTOMATIS oleh bumpDataVersion() (Utils.gs) saat
                pertama kali dipakai — tidak perlu dibuat manual.
```

#### `02_TAHUN_AJARAN`
| Kolom | Tipe | Contoh |
|---|---|---|
| tahun_id | TEXT | TA001 |
| tahun_ajaran | TEXT | 2026/2027 |
| tanggal_mulai | DATE | 2026-07-01 |
| tanggal_selesai | DATE | 2027-06-30 |
| status | TEXT | AKTIF / NONAKTIF |

#### `03_USER`
| Kolom | Tipe | Keterangan |
|---|---|---|
| user_id | TEXT | U001 |
| username | TEXT | unik, lowercase |
| password_hash | TEXT | SHA-256 hash |
| role | TEXT | ADMIN / GURU / WALI_KELAS |
| guru_id | TEXT | referensi ke 04_GURU (opsional untuk ADMIN murni) |
| aktif | BOOLEAN | TRUE |
| last_login | DATETIME | otomatis diisi sistem |

**Aturan role:**
- Seorang guru yang merangkap wali kelas cukup pakai role `GURU` — sistem deteksi otomatis dari kolom `wali_kelas_id` di tabel KELAS
- Role `WALI_KELAS` untuk akun yang HANYA menjadi wali kelas tanpa jadwal mengajar
- KS diberi role `ADMIN`

#### `04_GURU`
| Kolom | Tipe | Contoh |
|---|---|---|
| guru_id | TEXT | G001 |
| nip | TEXT | 198001012010011001 |
| nama | TEXT | Budi Santoso, S.Pd. |
| jenis_kelamin | TEXT | L / P |
| status | TEXT | PNS / PPPK / GTT |
| email | TEXT | budi@mudacil.sch.id |
| no_hp | TEXT | 0812xxxxxxxx |
| aktif | BOOLEAN | TRUE |

#### `05_KELAS`
| Kolom | Tipe | Contoh |
|---|---|---|
| kelas_id | TEXT | K001 |
| nama_kelas | TEXT | 7A |
| tingkat | NUMBER | 7 |
| wali_kelas_id | TEXT | G001 (referensi guru) |
| tahun_id | TEXT | TA001 |
| aktif | BOOLEAN | TRUE |

#### `06_SISWA`
| Kolom | Tipe | Contoh |
|---|---|---|
| siswa_id | TEXT | S0001 |
| nis | TEXT | 12345 |
| nisn | TEXT | 0012345678 |
| nama | TEXT | Ahmad Fauzi |
| kelas_id | TEXT | K001 |
| tahun_id | TEXT | TA001 |
| jenis_kelamin | TEXT | L / P |
| aktif | BOOLEAN | TRUE |

#### `07_MAPEL`
| Kolom | Tipe | Contoh |
|---|---|---|
| mapel_id | TEXT | M001 |
| kode_mapel | TEXT | INF |
| nama_mapel | TEXT | Informatika |
| kelompok | TEXT | UMUM / AGAMA / MULOK |
| aktif | BOOLEAN | TRUE |

#### `08_JAM`
| Kolom | Tipe | Contoh |
|---|---|---|
| jam_id | TEXT | J01 |
| nomor_jam | NUMBER | 1 |
| nama_jam | TEXT | Jam 1 |
| waktu_mulai | TIME | 07:00 |
| waktu_selesai | TIME | 07:40 |
| aktif | BOOLEAN | TRUE |

**Catatan:** Jumlah jam per hari dikontrol dari `01_CONFIG` (JAM_MAKS_xxx)

#### `09_JADWAL`
| Kolom | Tipe | Contoh |
|---|---|---|
| jadwal_id | TEXT | JD001 |
| tahun_id | TEXT | TA001 |
| hari | TEXT | SENIN/SELASA/RABU/KAMIS/JUMAT/SABTU |
| kelas_id | TEXT | K001 |
| mapel_id | TEXT | M001 |
| guru_id | TEXT | G001 |
| jam_id | TEXT | J01 |
| aktif | BOOLEAN | TRUE |

**Catatan:** Satu mapel yang menggunakan 2 jam = 2 baris dengan jadwal_id berbeda. Validasi bentrok dilakukan di Apps Script.

#### `10_JURNAL`
| Kolom | Tipe | Contoh |
|---|---|---|
| jurnal_id | TEXT | JR00001 |
| tanggal | DATE | 2026-07-09 |
| tahun_id | TEXT | TA001 |
| kelas_id | TEXT | K001 |
| mapel_id | TEXT | M001 |
| guru_id | TEXT | G001 |
| ringkasan_kegiatan | TEXT | Algoritma dasar dan flowchart |
| catatan | TEXT | Siswa aktif bertanya |
| status | TEXT | DRAFT / FINAL |
| created_at | DATETIME | otomatis |
| updated_at | DATETIME | otomatis |
| created_by | TEXT | U001 |

#### `11_JURNAL_JAM` *(tabel relasi)*
| Kolom | Tipe | Keterangan |
|---|---|---|
| jurnal_jam_id | TEXT | JJ001 |
| jurnal_id | TEXT | referensi ke 10_JURNAL |
| jam_id | TEXT | referensi ke 08_JAM |

**Contoh:** Jurnal JR001 mencakup Jam 1 dan Jam 2 → 2 baris:
```
JJ001 | JR001 | J01
JJ002 | JR001 | J02
```

#### `12_KEHADIRAN`
> **[DIPERBARUI — skema hanya-tidak-hadir]** Sheet ini HANYA menyimpan baris untuk
> siswa yang TIDAK hadir (SAKIT/IZIN/ALPA). Siswa yang hadir TIDAK ditulis sebagai
> baris sama sekali — dihitung di server sebagai `total_siswa_kelas − jumlah_baris_ini`.
> Ini optimasi performa (kelas 33 siswa yang mayoritas hadir penuh: dari 33 baris
> jadi 1–2 baris). Kolom kunci siswa juga sudah `nis` (bukan `siswa_id`), sesuai
> keputusan NIS sebagai primary key siswa (lihat §3.2 `06_SISWA`).

| Kolom | Tipe | Contoh |
|---|---|---|
| kehadiran_id | TEXT | KH000001 |
| jurnal_id | TEXT | JR00001 |
| nis | TEXT | 1001003 |
| status | TEXT | SAKIT / IZIN / ALPA (HADIR tidak pernah disimpan) |
| keterangan | TEXT | opsional |

#### `13_LOG`
| Kolom | Tipe | Keterangan |
|---|---|---|
| log_id | TEXT | L001 |
| waktu | DATETIME | otomatis |
| user_id | TEXT | siapa yang melakukan |
| aksi | TEXT | CREATE / UPDATE / DELETE / LOGIN |
| tabel | TEXT | nama tabel yang terpengaruh |
| data_id | TEXT | ID data yang berubah |
| keterangan | TEXT | deskripsi singkat |

---

## 4. Desain API (Google Apps Script)

> **[DIPERBARUI]** Bagian ini adalah blueprint awal proyek. Implementasi final
> berbeda di beberapa detail teknis (dijelaskan di catatan tiap bagian) hasil
> keputusan-keputusan selama pengembangan — lihat MASTER_CONTEXT_HANDOFF.md
> Bagian H untuk daftar lengkap keputusan yang tidak boleh diubah lagi.
> Semua endpoint (kecuali `login`/`getConfig`/`ping`/`getKelasPublik`/
> `getJadwalKelasPublik`) memakai **GET dengan query param `?action=...&token=...`**
> atau **POST dengan body JSON berisi `token`** — bukan method HTTP PUT (Apps
> Script Web App hanya mendukung `doGet`/`doPost`).

### 4.1 Endpoint Autentikasi
```
POST /exec?action=login
     body: { username, password }
     return: { token, nama, role, kelas_wali }
     Catatan: password PLAIN TEXT (keputusan eksplisit, sekolah internal,
     TIDAK di-hash — lihat MASTER_CONTEXT_HANDOFF.md Bagian H.1)

POST /exec?action=logout
     body: { token }
```

### 4.2 Endpoint Guru
```
GET  /exec?action=getJadwalHariIni&tanggal=YYYY-MM-DD&token=...
     → SEMUA jam 1..max-hari ditampilkan; jam kosong ditandai
       { tidak_mengajar: true, nama_mapel: 'Tidak Mengajar' }
GET  /exec?action=getJurnalSaya&page=1&pageSize=25&token=...
     → { items, page, pageSize, totalItems, totalPages }
POST /exec?action=createJurnal
     body: { token, tanggal, kelas_id, mapel_id, jam_ids[], ringkasan_kegiatan,
             catatan, kehadiran[] }
     Catatan: kehadiran[] HANYA berisi siswa TIDAK hadir (SAKIT/IZIN/ALPA)
POST /exec?action=updateJurnal
     body: { token, jurnal_id, ringkasan_kegiatan, catatan, kehadiran[] }
```

### 4.3 Endpoint Wali Kelas
```
GET  /exec?action=getJadwalKelas&kelas_id=K001&tanggal=YYYY-MM-DD&token=...
     → termasuk rekap kehadiran + nama_kelas (untuk badge "Wali Kelas: X")
```

### 4.4 Endpoint Admin
```
GET  /exec?action=getAllJurnal&tanggal=YYYY-MM-DD&guru_id=&mapel_id=&page=1&token=...
     Catatan: tanggal WAJIB, maksimal 1 hari per pencarian (mencegah tarik
     seluruh riwayat sekaligus). Response terpaginasi.
GET  /exec?action=getJadwalPerGuru&guru_id=G001&token=...    [BARU]
     → jadwal 1 guru dikelompokkan per hari (SENIN–SABTU)
GET  /exec?action=getUser&token=...
POST /exec?action=updateConfig    body: { token, updates: {...} }
GET  /exec?action=getLog&page=1&token=...   → terpaginasi, terbaru dulu

Catatan: TIDAK ADA endpoint manageGuru/manageKelas/manageSiswa/manageMapel/
manageJadwal/manageJam/manageUser — data master dikelola manual langsung di
Spreadsheet (keputusan eksplisit, lihat MASTER_CONTEXT_HANDOFF.md Bagian H.6).
```

### 4.5 Endpoint Umum
```
GET  /exec?action=getConfig                    → publik, tanpa token
GET  /exec?action=getMapel&token=...           → daftar mapel aktif
GET  /exec?action=getKelas&token=...           → daftar kelas (+ nama wali kelas)
GET  /exec?action=getGuru&token=...            → daftar guru aktif
GET  /exec?action=getJam&token=...             → daftar jam pelajaran
GET  /exec?action=getKelasPublik               → [BARU] publik, tanpa token,
     daftar kelas minimal — untuk menu "Jadwal Kelas" di homepage
GET  /exec?action=getJadwalKelasPublik&kelas_id=&hari=  → [BARU] publik, tanpa
     token, jadwal (mapel+guru+jam) tanpa data kehadiran/jurnal
```

### 4.6 Validasi di Apps Script (wajib)
- Cek token valid setiap request (kecuali `login`/`getConfig`/`ping`/`getKelasPublik`/`getJadwalKelasPublik`)
- Cek role sesuai endpoint yang diakses
- Konflik jadwal ditampilkan sebagai **warning** (`konflik`/`konflik_info`), **TIDAK PERNAH diblokir** (keputusan eksplisit, Bagian H.5)
- Validasi batas waktu edit jurnal (`BATAS_EDIT_HARI` dari config, default 7 hari)
- Password **TIDAK di-hash** (keputusan eksplisit, Bagian H.1) — jangan tambahkan SHA-256 tanpa diskusi ulang dengan user
- Sanitasi input sebelum menulis ke Spreadsheet

### 4.7 Arsitektur Cache Client-Side [BARU, 2026-09-08]

> Keputusan ini diambil setelah diskusi keamanan eksplisit — lihat catatan
> di bawah sebelum mengubah apapun di area ini.

```
Spreadsheet (sumber data asli)
        │
        │  Apps Script — endpoint token-authenticated, SAMA seperti biasa
        ▼
   Browser tiap pengguna
   ┌──────────────────────────────┐
   │ localStorage (per perangkat) │  ← guru, kelas, mapel, jam, siswa
   │ + DATA_VERSION               │     per-kelas, jadwal per-guru
   └──────────────────────────────┘
        │
        ▼
     Aplikasi (app.js)
```

**Keputusan sadar yang PENTING dipertahankan:**
- **TIDAK PERNAH** menyimpan data master (siswa/guru/kelas) sebagai file JSON statis di repo GitHub. Repo `smpmuda/jurnal` bersifat publik (syarat GitHub Pages gratis) — menaruh data siswa (anak di bawah umur) di sana berarti bisa diakses siapa saja tanpa login, JAUH lebih tidak aman dibanding kondisi sekarang (di balik token Apps Script).
- Cache HANYA di `localStorage`, scope per-perangkat, tidak pernah dikirim ke mana pun.
- Data transaksional (jurnal, kehadiran, log, dan endpoint jadwal yang mengandung status `sudah_diisi`/konflik) **TIDAK PERNAH** masuk cache ini — selalu live.
- Invalidasi otomatis via `DATA_VERSION` di `01_CONFIG`, dinaikkan oleh trigger sederhana `onEdit(e)` (Code.gs) — admin tidak perlu setup apapun.
- Tombol sinkronisasi manual (🔄) tersedia untuk SEMUA role sebagai jalan pintas.
- Kalau `localStorage` gagal/nonaktif, aplikasi otomatis fallback ke perilaku lama (selalu fetch live) — TIDAK PERNAH menyebabkan error ke pengguna. Lihat `frontend/js/cache.js` untuk detail implementasi gagal-aman ini.

---

## 5. Struktur File GitHub

> **[DIPERBARUI]** Bagian ini adalah blueprint awal proyek. Struktur final
> lebih sederhana (satu `app.js` sebagai single-file SPA, bukan dipecah
> per-halaman; CSS inline di `<style>` masing-masing file HTML, bukan
> file `.css` terpisah). Repo juga sudah dipindah dari `smpmuda/lab` ke
> `smpmuda/jurnal`.

```
smpmuda/jurnal/
│
├── index.html                ← halaman utama / landing (publik)
├── app.html                  ← aplikasi utama (single-page, CSS inline)
├── login.html                ← halaman login
├── jadwal-publik.html        ← [BARU] Jadwal Kelas publik, TANPA login
│
├── js/
│   ├── config.js              ← API_URL + APP_NAME + VERSION
│   ├── api.js                 ← wrapper fetch ke Apps Script
│   ├── auth.js                ← login, logout, session
│   ├── cache.js               ← [BARU] cache data master di localStorage
│   └── app.js                 ← router + SEMUA view (single file)
│
├── apps-script/                ← source Apps Script (di-sync via clasp)
│   ├── Code.gs                  ← router + trigger onEdit
│   ├── Auth.gs, Data.gs, Jurnal.gs, Utils.gs, TestSuite.gs
│   └── appsscript.json
│
├── Master_Specification.md    ← file ini
├── Master_Progress.md         ← progress tracker
├── Panduan_Deploy_dan_Uji.md
└── README.md
```

---

## 6. Alur Penggunaan

### 6.1 Guru Mengisi Jurnal
```
1. Login → dashboard
2. Lihat "Jadwal Hari Ini"
3. Klik satu blok jadwal (misal: 7A - Informatika - Jam 1-2)
4. Form jurnal muncul:
   - Tanggal (otomatis hari ini)
   - Kelas, Mapel (sudah terisi dari jadwal)
   - Pilih jam: ☑ Jam 1  ☑ Jam 2  ☐ Jam 3
   - Ringkasan kegiatan (textarea wajib)
   - Kehadiran: daftar siswa, klik nama = toggle HADIR/ALPA
   - Keterangan tidak hadir (SAKIT/IZIN/ALPA)
   - Catatan (opsional)
5. Simpan → status FINAL
6. Dashboard tampilkan ✓ pada jadwal yang sudah diisi
```

### 6.2 Wali Kelas Memantau
```
1. Login → langsung ke Jurnal Kelas
2. Pilih tanggal (default: hari ini)
3. Tampil kartu per mata pelajaran:
   - Nama mapel + jam
   - Nama guru
   - Ringkasan kegiatan
   - Kehadiran: 28/30 • 1 Sakit • 1 Izin
   - Daftar tidak hadir
4. Bisa scroll ke atas/bawah untuk melihat semua mapel hari itu
```

### 6.3 Admin Mengelola Data
```
1. Login → dashboard admin
2. Menu: Guru | Kelas | Siswa | Mapel | Jadwal | Jam | Pengguna | Konfigurasi | Log
3. Setiap menu: tabel data + tombol Tambah/Edit/Nonaktifkan
4. Jadwal: grid visual per hari-jam-kelas
5. Konfigurasi: form key-value
```

---

## 7. Aturan Bisnis

| Aturan | Detail |
|---|---|
| Edit jurnal | Hanya bisa diedit dalam `BATAS_EDIT_HARI` hari sejak dibuat |
| Satu jurnal per sesi | Satu guru, satu kelas, satu set jam, satu tanggal = satu jurnal |
| Jam ganda | Guru boleh memilih lebih dari 1 jam dalam satu jurnal |
| Konflik jadwal | Satu kelas tidak boleh punya 2 mapel di jam yang sama |
| Wali kelas | Ditentukan dari data kelas, bukan dari role user |
| Status jurnal | DRAFT (belum final) dan FINAL |
| Password | Di-hash SHA-256, tidak pernah disimpan plaintext |
| Session | Token berbasis waktu, expired setelah X jam (dikonfigurasi) |

---

## 8. Antarmuka — Prinsip Desain

- **Mobile-first:** guru sering mengisi dari HP di kelas
- **Minimal klik:** dari login ke isi jurnal maksimal 3 klik
- **Status jelas:** jurnal yang sudah diisi vs belum harus terlihat langsung
- **Offline graceful:** tampil pesan error yang informatif jika koneksi putus
- **Print-friendly:** jurnal kelas bisa dicetak untuk arsip

---

## 9. Batasan Versi 1.0

- Tidak ada notifikasi push/email otomatis
- Tidak ada ekspor PDF otomatis (hanya print browser)
- Tidak ada rekap nilai (ini bukan e-raport, fokus di jurnal)
- Tidak ada multi-semester dalam satu tampilan
- Tidak ada offline mode / PWA
