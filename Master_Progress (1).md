# Master Progress — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**
Terakhir diperbarui: 2026-09-04

---

## Status Legend
```
[ ] Belum dimulai
[~] Sedang dikerjakan
[x] Selesai
[!] Blocked / ada masalah
```

---

## FASE 0 — Persiapan & Perencanaan

- [x] Tentukan arsitektur (GitHub Pages + Apps Script + Spreadsheet)
- [x] Tetapkan 3 role pengguna (ADMIN, GURU, WALI_KELAS)
- [x] Rancang struktur 13 sheet Spreadsheet
- [x] Rancang endpoint API
- [x] Buat Master_Specification.md
- [x] Buat Master_Progress.md
- [x] Buat halaman index/landing GitHub Pages
- [ ] Setup repository GitHub (smpmuda/lab)
- [ ] Buat template Google Spreadsheet kosong
- [ ] Deploy Google Apps Script pertama kali (health check)

---

## FASE 1 — Spreadsheet & Data Master

### 1.1 Buat Sheet Dasar
- [ ] Buat sheet `01_CONFIG` dengan semua key wajib
- [ ] Buat sheet `02_TAHUN_AJARAN`
- [ ] Buat sheet `03_USER`
- [ ] Buat sheet `04_GURU`
- [ ] Buat sheet `05_KELAS`
- [ ] Buat sheet `06_SISWA`
- [ ] Buat sheet `07_MAPEL`
- [ ] Buat sheet `08_JAM`
- [ ] Buat sheet `09_JADWAL`
- [ ] Buat sheet `10_JURNAL`
- [ ] Buat sheet `11_JURNAL_JAM`
- [ ] Buat sheet `12_KEHADIRAN`
- [ ] Buat sheet `13_LOG`

### 1.2 Isi Data Awal (Dummy / Real)
- [ ] Isi `01_CONFIG` (nama sekolah, jam per hari, dll)
- [ ] Isi `02_TAHUN_AJARAN` (TA 2026/2027)
- [ ] Isi `08_JAM` (Jam 1–9 dengan waktu mulai-selesai)
- [ ] Isi `07_MAPEL` (semua mapel)
- [ ] Isi `04_GURU` (data guru)
- [ ] Isi `05_KELAS` (kelas 7A–9x + wali kelas)
- [ ] Isi `06_SISWA` (daftar siswa per kelas)
- [ ] Isi `09_JADWAL` (jadwal mingguan)
- [ ] Buat akun `03_USER` untuk testing (1 admin, 2 guru, 1 wali kelas)

---

## FASE 2 — Google Apps Script (Backend/API) ✅ SELESAI

**Keputusan arsitektur:** Apps Script **bound ke Spreadsheet** (bukan standalone) — akses `SpreadsheetApp.getActiveSpreadsheet()` langsung, tanpa Spreadsheet ID di kode. Kode dikelola lewat clasp agar tetap bisa disimpan/dikembangkan via GitHub.

**File selesai (5 file, ~1.280 baris):** `Utils.gs`, `Auth.gs`, `Data.gs`, `Jurnal.gs`, `Code.gs` + `appsscript.json` + `.clasp.json` + `README.md` setup.

### 2.1 Fondasi
- [x] Koneksi ke Spreadsheet via `SpreadsheetApp.getActiveSpreadsheet()` (bound script)
- [x] Fungsi `doGet(e)` + `doPost(e)` router utama (`Code.gs` → `handleRequest`)
- [x] Fungsi helper: `readSheet()`, `appendToSheet()`, `updateRowById()`, `findBy()`, `filterBy()`
- [x] Fungsi `nextId()` generator ID per sheet
- [x] Fungsi `writeLog()` → menulis ke sheet 13_LOG
- [x] Fungsi `getConfig()` + cache → baca semua config dari 01_CONFIG
- [ ] Deploy sebagai Web App (dilakukan user saat upload ke Spreadsheet asli)

### 2.2 Autentikasi — disederhanakan sesuai keputusan (tanpa hash/enkripsi)
- [x] Password **plain text**, dibandingkan langsung (bukan SHA-256, sesuai keputusan)
- [x] Fungsi `generateToken()` → random 32 karakter
- [x] Token disimpan di **PropertiesService** (bukan sheet) dengan expiry (`DURASI_SESSION`)
- [x] Fungsi `validateToken()` → cek valid + belum expired
- [x] Fungsi `hasRole(session, requiredRoles[])` → dukung **multi-role** (`GURU,WALI_KELAS` dst.)
- [x] Endpoint `action=login` → return token + deteksi otomatis kelas_wali dari sheet KELAS
- [x] Endpoint `action=logout` → hapus token dari PropertiesService
- [x] `cleanupExpiredTokens()` + trigger harian jam 3 pagi (`setupTriggers()`)

### 2.3 Endpoint Data Master (baca — sesuai keputusan: input manual di spreadsheet)
- [x] `getGuru`, `getKelas`, `getSiswa&kelas_id=`, `getMapel`, `getJam`, `getUser` (admin only)
- [x] `updateConfig` (admin only) → update sheet 01_CONFIG dari web
- [ ] Create/Update guru, kelas, siswa, mapel, jam lewat web — **tidak dibuat**, sesuai keputusan data master dikelola langsung di spreadsheet

### 2.4 Endpoint Jadwal
- [x] `getJadwalHariIni` → jadwal guru hari ini (default) atau tanggal pilihan, auto grouping blok jam berurutan
- [x] `getJadwalGuru&hari=&tanggal=` → fleksibel, admin bisa query guru lain
- [x] `getJadwalKelas&kelas_id=&tanggal=` → untuk wali kelas, termasuk rekap kehadiran per mapel
- [x] **Deteksi konflik jadwal** guru (bukan blokir) → response `konflik: true` + info, sesuai keputusan
- [ ] Create/Update jadwal lewat web — **tidak dibuat**, sesuai keputusan (input manual di spreadsheet)

### 2.5 Endpoint Jurnal (Guru)
- [x] `getJurnalSaya&bulan=` → jurnal milik guru yang login, dengan flag `bisa_edit`
- [x] `createJurnal` → validasi lengkap (jam valid, ringkasan min 5 karakter, cegah duplikat sesi)
  - Tulis ke `10_JURNAL`, `11_JURNAL_JAM`, `12_KEHADIRAN` (siswa tak disebut = otomatis HADIR)
- [x] `updateJurnal` → validasi batas `BATAS_EDIT_HARI`, hanya pemilik (kecuali admin)
- [x] `getDetailJurnal&jurnal_id=` → detail + rekap kehadiran + daftar tidak hadir

### 2.6 Endpoint Jurnal (Wali Kelas)
- [x] `getJadwalKelas` sekaligus berfungsi sebagai jurnal kelas (nama mapel, guru, kehadiran, tidak hadir)
- [x] Validasi akses: wali kelas hanya bisa lihat kelas sendiri (kecuali admin)
- [ ] `getKalenderKelas` (lihat tanggal mana yang ada jurnal dalam sebulan) — belum dibuat, fase pengembangan lanjut

### 2.7 Endpoint Admin
- [x] `getAllJurnal` (filter tanggal/kelas/guru)
- [x] `getLog` → 200 log terakhir
- [x] `ping` → health check

---

## FASE 3 — Frontend (GitHub Pages) — SEBAGIAN SELESAI

**File selesai:**
- [x] `index.html` — landing page
- [x] `login.html` — form login + deteksi session aktif
- [x] `app.html` — shell SPA (topbar, role tabs, bottom nav, container)
- [x] `js/config.js` — API_URL placeholder (perlu diisi user)
- [x] `js/api.js` — fetch wrapper (GET query string, POST text/plain agar hindari CORS preflight)
- [x] `js/auth.js` — session di sessionStorage, cek role, multi-role helper
- [x] `js/app.js` — router + semua view dalam satu file (skala app masih kecil):
  - Dashboard guru (jadwal hari ini/tanggal pilihan, badge sudah/belum diisi, badge konflik)
  - Form isi jurnal (checkbox jam, textarea ringkasan/catatan, toggle kehadiran per siswa H/S/I/A)
  - Detail jurnal (rekap kehadiran, daftar tidak hadir)
  - Riwayat jurnal saya
  - Jurnal kelas (wali kelas) — kartu per mapel dengan rekap kehadiran
  - Admin: beranda, semua jurnal, log aktivitas
  - Role switcher (tab) untuk akun multi-role (mis. GURU+WALI_KELAS)

**Belum dibuat:**
- [x] ~~Edit jurnal dari UI~~ → **SELESAI**: view `viewJurnalEdit` lengkap, reuse data existing, panggil `updateJurnal`
- [ ] `css/print.css` — belum diperlukan di versi ini
- [ ] Halaman admin kelola data master dari web (create/update guru/kelas/siswa/dst) — **tidak diperlukan** sesuai keputusan, dikelola di spreadsheet
- [ ] Filter/pencarian di halaman admin jurnal & log (masih daftar polos, admin jurnal dibatasi 100 baris)
- [x] ~~Testing nyata dengan Apps Script live~~ → **Self-test suite dibuat** (`TestSuite.gs`), belum dijalankan user di Apps Script sungguhan

---

---

## FASE 4 — Deploy & Uji (Panduan Siap, Eksekusi Menunggu User)

**File baru:** `Panduan_Deploy_dan_Uji.md` — checklist step-by-step, dan `TestSuite.gs` — self-test otomatis yang jalan langsung dari editor Apps Script (tanpa perlu buka frontend).

### 4.1 TestSuite.gs — Self-Test Backend (kode sudah selesai)
- [x] Test struktur sheet (13 sheet ada, header sesuai)
- [x] Test config (nilai JAM_MAKS, TAHUN_AKTIF, dll terbaca benar)
- [x] Test login 4 skenario role (admin murni, guru biasa, wali kelas, multi-role) + login gagal (password salah, user tidak ada)
- [x] Test semua endpoint master data (getGuru, getKelas, getSiswa, getMapel, getJam)
- [x] Test jadwal + deteksi konflik
- [x] Test create jurnal (sukses, duplikat ditolak, ringkasan kosong ditolak, jam kosong ditolak)
- [x] Test update jurnal + verifikasi perubahan tersimpan
- [x] Test kontrol akses (guru ditolak endpoint admin, admin bisa akses)
- [x] Test token invalid/kosong ditolak
- [x] Test logout (token jadi invalid setelahnya)
- [x] `cleanupTestData()` — hapus otomatis semua data hasil testing
- **Cara pakai:** jalankan `runFullTest()` dari editor Apps Script, baca log — ✅/❌ per item

### 4.2 Deploy — Bagian A: Spreadsheet & Apps Script (menunggu eksekusi user)
- [ ] A1: Upload & convert xlsx ke Google Sheets
- [ ] A2: Buat Apps Script bound
- [ ] A3: Masukkan 6 file kode + appsscript.json
- [ ] A4: Jalankan `runFullTest()` pertama kali + authorize akses
- [ ] A5: Jalankan `cleanupTestData()`
- [ ] A6: Jalankan `setupTriggers()`
- [ ] A7: Deploy sebagai Web App, catat URL
- [ ] A8: Test `?action=ping` dan `?action=getConfig` langsung dari browser

### 4.3 Deploy — Bagian B: Frontend (menunggu eksekusi user)
- [ ] B1: Isi `API_URL` di `js/config.js`
- [ ] B2: Upload semua file ke repo `smpmuda/lab`
- [ ] B3: Aktifkan GitHub Pages

### 4.4 Uji End-to-End — Bagian C (10 skenario, menunggu eksekusi user)
- [ ] C1: Login 4 role + login gagal
- [ ] C2: Alur guru isi jurnal lengkap
- [ ] C3: Edit jurnal
- [ ] C4: Ganti tanggal di dashboard
- [ ] C5: Riwayat jurnal saya
- [ ] C6: Alur wali kelas
- [ ] C7: Deteksi konflik jadwal (sengaja dibuat bentrok)
- [ ] C8: Alur admin (semua jurnal + log)
- [ ] C9: Batas edit jurnal (ubah BATAS_EDIT_HARI ke 0)
- [ ] C10: Logout & proteksi akses tanpa login

### 4.5 Serah Terima — Bagian D
- [ ] Ganti semua data dummy → data nyata sekolah (guru, kelas, siswa, jadwal, config)
- [ ] Data test dibersihkan dari 10_JURNAL/11_JURNAL_JAM/12_KEHADIRAN
- [ ] Dicoba dari HP guru sungguhan, bukan cuma laptop
- [ ] Feedback dari 2-3 guru sebelum full rollout
- [ ] Backup Spreadsheet

**Status: menunggu eksekusi manual oleh user** — Claude tidak punya akses ke akun Google untuk deploy langsung. Semua kode dan panduan sudah siap pakai — ikuti `Panduan_Deploy_dan_Uji.md` dari Bagian A.

### 4.6 Bugfix dari hasil test pertama (2026-09-05)
- [x] **BUG DITEMUKAN & DIPERBAIKI**: `actionGetJadwalHariIni` di `Data.gs` mengembalikan `ok([])` (array kosong) saat guru tidak punya `guru_id` — seharusnya `ok({ hari, tanggal, jadwal: [] })` (object dengan field `jadwal`). Ini menyebabkan `TypeError: Cannot read properties of undefined (reading 'length')` di `TestSuite.gs` saat admin murni kebetulan terpilih sebagai session guru untuk test jadwal.
- [x] Perkuat semua akses `body.data.xxx` di `TestSuite.gs` dengan guard `Array.isArray()` / cek `body.data` ada dulu — supaya self-test tidak crash meski ada bug serupa di endpoint lain, dan pesan error lebih informatif
- [ ] User perlu re-run `runFullTest()` setelah update kode untuk verifikasi bug sudah tidak muncul lagi
- [x] **BUG KEDUA DITEMUKAN & DIPERBAIKI**: `testLoginSemuaRole` di `TestSuite.gs` menyimpan response mentah `actionLogin()` (`body.data`) sebagai "session" untuk test lanjutan — padahal response login sengaja tidak menyertakan `guru_id`/`username` (tidak perlu diekspos ke frontend). Akibatnya semua test yang butuh `session.guru_id` gagal dengan `username=undefined`. Diperbaiki: setelah login sukses, ambil session PENUH lewat `validateToken(token)` — persis seperti yang dilakukan router asli (`Code.gs`) di tiap request. Token disisipkan manual ke object session hasil test untuk keperluan `testLogout()`.
- [ ] User perlu re-run `runFullTest()` lagi setelah update kedua ini
- [x] **BUG KETIGA DITEMUKAN & DIPERBAIKI — BUG PRODUKSI SUNGGUHAN (bukan cuma di test)**: `readSheet()` di `Utils.gs` membaca kolom `tanggal` apa adanya dari `getValues()`. Google Sheets otomatis mengonversi string tanggal (mis. `"2099-01-01"`) yang ditulis via `appendRow()` menjadi objek `Date` internal. Saat dibaca kembali, nilainya jadi `Date` object bukan string — merusak SEMUA perbandingan `String(j.tanggal) === '2099-01-01'` di seluruh sistem (deteksi duplikat jurnal, filter jadwal hari ini, filter jurnal per bulan, dll). Terdeteksi lewat test "createJurnal DUPLIKAT ditolak" yang FAIL — jurnal kedua dengan tanggal/kelas/mapel/jam sama berhasil dibuat, seharusnya ditolak.
  - **Dampak jika tidak diperbaiki**: guru bisa membuat jurnal duplikat tanpa sengaja, filter tanggal di dashboard/riwayat bisa salah menampilkan data.
  - **Perbaikan**: `readSheet()` sekarang menormalkan setiap nilai `Date` — kolom bernama persis `tanggal` → string `yyyy-MM-dd`; kolom mengandung `_at`/`waktu`/`last_login` → string `yyyy-MM-dd HH:mm:ss`. Perbaikan terpusat di satu fungsi, otomatis berlaku ke semua endpoint yang memakai `readSheet()`.
- [ ] User perlu re-run `runFullTest()` ketiga kalinya untuk verifikasi — jika lolos semua, backend siap lanjut ke deploy Web App (langkah A7)
- [x] **BUG KEEMPAT — REGRESI DARI PERBAIKAN SENDIRI, DITEMUKAN & DIPERBAIKI**: perbaikan bug ketiga (normalisasi tanggal) menambahkan `configVal('ZONA_WAKTU', ...)` di dalam `readSheet()`. Ini menciptakan rekursi tak berujung: `getConfig() → readSheet('01_CONFIG') → configVal() → getConfig() → readSheet('01_CONFIG') → ...` — skrip macet/timeout tanpa pesan error jelas (Apps Script biasanya diam saja atau exceeded execution time). Terdeteksi karena `runFullTest()` macet total di section "2. CONFIG" tanpa lanjut.
  - **Perbaikan**: `readSheet()` sekarang mengambil timezone langsung dari `Session.getScriptTimeZone()` — TIDAK pernah lewat `configVal()`/`getConfig()` lagi, memutus rantai rekursi permanen. Sudah diaudit ulang seluruh `Utils.gs` baris per baris untuk memastikan tidak ada siklus rekursi lain.
  - **Pelajaran**: fungsi pembaca data dasar (`readSheet`) tidak boleh bergantung pada fungsi level lebih tinggi (`getConfig`) yang balik memanggilnya.
- [ ] User perlu re-run `runFullTest()` keempat kalinya — harus lolos sampai akhir sekarang
- [x] **BUG KELIMA — bukan bug kode aplikasi, tapi cleanup test tidak efektif karena bug ketiga**: `createJurnal berhasil` FAIL dengan pesan "sudah pernah dibuat" — ini justru validasi duplikat bekerja BENAR, tapi menabrak sisa data test dari percobaan sebelumnya yang gagal terhapus. Ternyata `cleanupTestData()` sendiri membaca `row[1]` (kolom tanggal) langsung dari `getValues()` mentah tanpa normalisasi — kena bug Date-vs-string yang sama seperti bug ketiga, sehingga gagal mencocokkan pola `2099-` dan tidak pernah menghapus baris test lama.
  - **Perbaikan**: `cleanupTestData()` sekarang menormalkan `Date` object ke string sebelum dicocokkan, sama seperti `readSheet()`.
  - **Tambahan**: fungsi baru `cekSisaDataTest()` — diagnostik read-only untuk melihat apa saja yang akan dihapus sebelum benar-benar menjalankan `cleanupTestData()`, berguna untuk verifikasi manual di sheet.
- [ ] User: jalankan `cleanupTestData()` untuk membersihkan sisa jurnal test yang menumpuk dari percobaan sebelumnya, baru jalankan `runFullTest()` lagi

### 4.7 HASIL AKHIR: SEMUA TEST LULUS ✅ (2026-09-05)
- [x] `runFullTest()` dijalankan ulang setelah 5 bugfix di atas
- [x] **Hasil: "🎉 SEMUA TEST LULUS. Sistem siap dipakai."** — 0 FAIL
- [x] Backend Apps Script (5 file .gs) dinyatakan SIAP PRODUKSI dari sisi logika/validasi
- [x] `HANDOVER.md` dibuat — dokumen transisi lengkap untuk melanjutkan proyek di chat baru
- **Status backend: SELESAI DAN TERUJI.** Langkah selanjutnya (A5-A8: cleanup final, setup trigger, deploy Web App, test URL browser) — **PERLU DIKONFIRMASI** apakah sudah dikerjakan user atau belum sebelum lanjut ke Bagian B (frontend)

### 4.8 BUG KEENAM — ditemukan SETELAH deploy Web App (2026-09-05)
- [x] **BUG DITEMUKAN**: setelah deploy sukses (A7), test manual `?action=ping` dari browser mengembalikan `401 Token tidak valid` — padahal `ping` seharusnya endpoint publik seperti `getConfig` (yang sudah dikonfirmasi sukses). Ternyata di `Code.gs`, handler `ping` diletakkan SETELAH blok pengecekan token (baris ~80), bukan sejajar dengan `login`/`getConfig` di kelompok endpoint publik (baris ~38). Akibatnya endpoint health-check yang seharusnya paling sederhana justru selalu gagal tanpa token.
  - **Perbaikan**: `ping` dipindah ke kelompok endpoint publik, sejajar `login` dan `getConfig`.
  - **Tambahan pencegahan regresi**: fungsi baru `testEndpointPublik()` di `TestSuite.gs` — secara eksplisit mensimulasikan request TANPA token ke `ping`, `getConfig` (harus sukses), action kosong (harus dapat pesan jelas bukan "token invalid"), dan `getGuru` (harus ditolak 401 karena butuh token). Dipanggil di awal `runFullTest()` sebelum test lain.
  - **Pelajaran**: `runFullTest()` sebelumnya TIDAK PERNAH menguji endpoint publik lewat jalur HTTP asli tanpa token — semua test kemarin memanggil fungsi `actionXxx()` secara langsung dengan session yang sudah divalidasi, sehingga bug urutan routing seperti ini lolos dari testing internal dan baru ketahuan saat akses manual dari browser sungguhan.
- [ ] User perlu update `Code.gs` di Apps Script editor, **Deploy → Manage deployments → edit (pensil) → New Version → Deploy** (supaya URL Web App TIDAK BERUBAH), lalu jalankan `runFullTest()` sekali lagi untuk verifikasi test regresi baru ini lolos
- [ ] Setelah itu, test ulang `?action=ping` dari browser — harus sukses tanpa token

---

## Catatan Harian

### 2026-09-04
- Dokumen spesifikasi dan progress dibuat
- Halaman index/landing dibuat
- Arsitektur dan struktur database difinalisasi

### 2026-09-05
- Spreadsheet disesuaikan: siswa pakai NIS (bukan ID terpisah), jam 1-9 tanpa waktu clock (istirahat hanya penanda), skala 30 kelas/36 guru/1000 siswa
- Apps Script lengkap dibuat: Utils, Auth (plain text password, token di PropertiesService), Data (master data + jadwal + deteksi konflik), Jurnal (create/update/detail), Code (router)
- Frontend dibuat: login.html, app.html (shell SPA), js/config.js, js/api.js, js/auth.js, js/app.js (semua view dalam satu file router)
- Fitur konflik jadwal: sistem beri warning, guru tetap bisa isi salah satu (tidak diblokir)
- Multi-role: satu akun bisa GURU+WALI_KELAS atau GURU+ADMIN, ada role switcher di UI
- Fitur edit jurnal diselesaikan (viewJurnalEdit) — sebelumnya placeholder
- TestSuite.gs dibuat: self-test otomatis 8 kategori, langsung jalan dari editor Apps Script tanpa perlu frontend
- Panduan_Deploy_dan_Uji.md dibuat: langkah A (spreadsheet+script), B (frontend+GitHub Pages), C (10 skenario uji end-to-end), D (checklist serah terima)
- Deploy sungguhan & uji end-to-end BELUM dieksekusi — perlu dilakukan manual oleh user karena Claude tidak punya akses akun Google

---

## Keputusan Teknis Penting

| Tanggal | Keputusan | Alasan |
|---|---|---|
| 2026-09-04 | 3 role saja (ADMIN/GURU/WALI_KELAS) | Lebih simpel, KS = ADMIN |
| 2026-09-04 | Wali kelas deteksi otomatis dari data kelas | Fleksibel, guru merangkap tidak perlu 2 akun |
| 2026-09-04 | `JURNAL_JAM` sebagai tabel relasi terpisah | Lebih proper dari menyimpan "1,2,3" di satu sel |
| 2026-09-04 | Jam per hari dikontrol dari CONFIG | Admin bisa ubah tanpa deploy ulang |
| 2026-09-04 | Token session di Apps Script | Tidak pakai Google Auth supaya lebih simpel |
| 2026-09-05 | Password plain text, tanpa hash/SHA | Sekolah internal, kesederhanaan diprioritaskan |
| 2026-09-05 | siswa_id dihapus, NIS jadi kunci utama | Menghindari data ganda, NIS sudah unik |
| 2026-09-05 | Jam 1-9 tanpa waktu clock | Jadwal lebih fleksibel, waktu real tidak perlu disimpan |
| 2026-09-05 | Konflik jadwal guru: warning saja, tidak blokir | Guru butuh fleksibilitas untuk kasus nyata di lapangan |
| 2026-09-05 | Apps Script bound ke Spreadsheet, dikelola via clasp+GitHub | Tidak perlu expose Spreadsheet ID, kode tetap versioned di GitHub |
| 2026-09-05 | Semua view frontend dalam satu app.js | Skala aplikasi masih kecil, memisah file menambah kompleksitas tanpa manfaat nyata |
| 2026-09-05 | Data master (guru/kelas/siswa/jadwal) dikelola di spreadsheet, bukan lewat web | Sesuai keputusan user — input manual di spreadsheet |

---

## Masalah & Resolusi

*(isi saat menemukan masalah)*

| Tanggal | Masalah | Resolusi | Status |
|---|---|---|---|
| - | - | - | - |
