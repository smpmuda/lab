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
| Kolom | Tipe | Contoh |
|---|---|---|
| kehadiran_id | TEXT | KH00001 |
| jurnal_id | TEXT | JR00001 |
| siswa_id | TEXT | S0001 |
| status | TEXT | HADIR / SAKIT / IZIN / ALPA |
| keterangan | TEXT | opsional |
| updated_at | DATETIME | otomatis |

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

### 4.1 Endpoint Autentikasi
```
POST /exec?action=login
     body: { username, password }
     return: { token, user: { user_id, nama, role, kelas_id? } }

POST /exec?action=logout
     header: Authorization: Bearer <token>
```

### 4.2 Endpoint Guru
```
GET  /exec?action=getJadwalSaya&tanggal=YYYY-MM-DD
GET  /exec?action=getJurnalSaya&tanggal=YYYY-MM-DD
POST /exec?action=createJurnal
     body: { tanggal, kelas_id, mapel_id, jam_ids[], ringkasan_kegiatan, catatan, kehadiran[] }
PUT  /exec?action=updateJurnal
     body: { jurnal_id, ringkasan_kegiatan, catatan, kehadiran[] }
```

### 4.3 Endpoint Wali Kelas
```
GET  /exec?action=getJurnalKelas&kelas_id=K001&tanggal=YYYY-MM-DD
GET  /exec?action=getSiswaKelas&kelas_id=K001
GET  /exec?action=getRingkasanBulanan&kelas_id=K001&bulan=07&tahun=2026
```

### 4.4 Endpoint Admin
```
GET/POST/PUT /exec?action=manageGuru
GET/POST/PUT /exec?action=manageKelas
GET/POST/PUT /exec?action=manageSiswa
GET/POST/PUT /exec?action=manageMapel
GET/POST/PUT /exec?action=manageJadwal
GET/POST/PUT /exec?action=manageJam
GET/POST/PUT /exec?action=manageUser
GET          /exec?action=getAllJurnal
GET          /exec?action=getConfig
PUT          /exec?action=updateConfig
GET          /exec?action=getLog
```

### 4.5 Endpoint Umum
```
GET  /exec?action=getConfig      → konfigurasi publik (nama sekolah, dll)
GET  /exec?action=getMapel       → daftar mapel aktif
GET  /exec?action=getKelas       → daftar kelas aktif
GET  /exec?action=getGuru        → daftar guru aktif
GET  /exec?action=getJam         → daftar jam pelajaran
```

### 4.6 Validasi di Apps Script (wajib)
- Cek token valid setiap request (kecuali login)
- Cek role sesuai endpoint yang diakses
- Validasi bentrok jadwal saat input jadwal baru
- Validasi batas waktu edit jurnal (`BATAS_EDIT_HARI` dari config)
- Hash password dengan SHA-256 sebelum disimpan
- Sanitasi input sebelum menulis ke Spreadsheet

---

## 5. Struktur File GitHub

```
smpmuda/lab/
│
├── index.html              ← halaman utama / landing
├── app.html                ← aplikasi utama (single-page)
├── login.html              ← halaman login
│
├── css/
│   ├── style.css
│   └── print.css           ← untuk cetak laporan
│
├── js/
│   ├── config.js           ← API_URL + APP_NAME + VERSION
│   ├── auth.js             ← login, logout, session
│   ├── api.js              ← wrapper fetch ke Apps Script
│   ├── app.js              ← router + init
│   ├── dashboard.js        ← halaman dashboard
│   ├── jurnal.js           ← isi/lihat jurnal
│   ├── kelas.js            ← jurnal kelas (wali kelas)
│   └── admin.js            ← manajemen data master
│
├── assets/
│   ├── logo.png
│   └── favicon.ico
│
├── Master_Specification.md ← file ini
├── Master_Progress.md      ← progress tracker
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
