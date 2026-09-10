# Master Progress — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**
Terakhir diperbarui: 2026-09-08

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

### 4.8 Bug ke-6 ditemukan & diperbaiki (2026-09-05, pasca deploy pertama)
- [x] **BUG**: `?action=ping` dari browser mengembalikan 401 "Token tidak valid" — seharusnya endpoint publik tanpa token, sama seperti `getConfig`
- [x] **Root cause**: di `Code.gs`, urutan pengecekan action `ping` diletakkan SETELAH blok validasi token, bukan di kelompok endpoint publik (`login`, `getConfig`) di awal fungsi `handleRequest`
- [x] **Fix**: pindahkan pengecekan `action === 'ping'` ke atas, sejajar dengan `login` dan `getConfig`, sebelum blok "wajib token"
- [x] User konfirmasi: `ping` sudah sukses tanpa token setelah fix — **deploy Web App (A7) dan test browser (A8) SELESAI dan BERHASIL**

---

## FASE 5 — Rombakan Besar Performa & UI (SELESAI — menunggu deploy & uji manual user)

**Konteks:** setelah deploy sukses dan diuji manual, user memberi daftar perbaikan besar mencakup UI (bottom nav, form grid, pagination di banyak tempat), fitur baru (info wali kelas, jadwal kelas publik, admin lihat jadwal per guru, filter admin), dan **PERFORMA sebagai prioritas utama** — target 40 guru pakai bersamaan, 30 kelas, ~1000 siswa.

### 5.1 Analisis akar masalah performa (SELESAI)
- [x] Ditemukan: `readSheet()` sebelumnya SELALU `getDataRange().getValues()` full-scan tanpa cache sama sekali, dipanggil berkali-kali per request (N+1 pattern) — ini akar masalah lambat
- [x] Ditemukan: `nextId()` lama pakai `getLastRow()` — rawan ID bentrok kalau ada baris terhapus di tengah (misal oleh `cleanupTestData`)
- [x] Ditemukan: kehadiran menyimpan SEMUA siswa (termasuk yang hadir) — untuk kelas 33 siswa, 1 jurnal = 33 baris tulis padahal biasanya cuma 1-2 yang tidak hadir → pemborosan tulis besar-besaran di skala 1000 siswa

### 5.2 Perbaikan BACKEND — Utils.gs (SELESAI, sudah di-package)
- [x] Cache 2 lapis: in-memory per eksekusi (`_execCache`) + `CacheService` lintas eksekusi (`SHEET_CACHE_TTL`) untuk sheet master data (CONFIG, TAHUN_AJARAN, GURU, KELAS, SISWA, MAPEL, JAM: 300 detik; USER: 60 detik; JADWAL: 180 detik)
- [x] Sheet transaksional (JURNAL, JURNAL_JAM, KEHADIRAN, LOG) SENGAJA TIDAK di-cache — harus selalu real-time
- [x] `invalidateCache(sheetName)` — wajib dipanggil setiap tulis, supaya request berikutnya tidak baca data basi
- [x] `appendToSheet()` dan `appendManyToSheet()` (baru — batch write pakai `setValues()`, jauh lebih cepat dari `appendRow()` berulang) otomatis invalidasi cache
- [x] `updateRowById()` dan `deleteRowsByIds()` (baru) otomatis invalidasi cache
- [x] `nextId()` diperbaiki — sekarang cari ID number TERBESAR sungguhan dari data (bukan `getLastRow()`), aman meski ada baris terhapus
- [x] `indexBy(rows, key)` dan `groupBy(rows, key)` (baru) — bangun Map sekali untuk lookup O(1), menggantikan `.find()`/`.filter()` berulang dalam loop (pola N+1 di kode lama)
- [x] `paginate(items, page, pageSize)` (baru) — helper generik potong array sesuai halaman, dipakai di semua endpoint list

### 5.3 Perbaikan BACKEND — Jurnal.gs (SELESAI, sudah di-package)
- [x] **PERUBAHAN SKEMA PENTING**: sheet `12_KEHADIRAN` sekarang HANYA menyimpan siswa yang TIDAK HADIR (SAKIT/IZIN/ALPA). Siswa hadir TIDAK ditulis sebagai baris sama sekali. Field `kehadiran` di request body TETAP bernama sama (kontrak API tidak berubah) tapi isinya sekarang HANYA yang tidak hadir
- [x] Rekap kehadiran dihitung: `hadir = total_siswa_kelas - jumlah_baris_tidak_hadir`
- [x] `actionCreateJurnal`: validasi NIS harus benar-benar siswa aktif di kelas tsb, status harus SAKIT/IZIN/ALPA (HADIR tidak lagi valid sebagai status tersimpan), pakai `appendManyToSheet` untuk batch insert ke `11_JURNAL_JAM` dan `12_KEHADIRAN` (bukan loop `appendRow`)
- [x] `actionUpdateJurnal` + `_replaceKehadiran`: hapus baris lama pakai `deleteRowsByIds` (cache-aware), tulis baru pakai `appendManyToSheet`
- [x] `actionGetJurnalSaya`: SEKARANG PAKAI PAGINATION — response berubah dari array langsung jadi `{ items, page, pageSize, totalItems, totalPages }`. Pagination dilakukan SEBELUM join data lain (kelas/mapel) demi efisiensi
- [x] `actionGetDetailJurnal`: field response `kehadiran` diganti nama jadi `tidak_hadir` (lebih eksplisit), pakai `indexBy` untuk lookup siswa

### 5.4 Perbaikan BACKEND — Data.gs (SELESAI, sudah di-package)
- [x] `_jadwalGuru` (dipakai `getJadwalHariIni`/`getJadwalGuru`): SEKARANG MENAMPILKAN SEMUA JAM 1 SAMPAI MAX-HARI (bukan cuma yang ada jadwal) — jam kosong ditandai objek dengan `tidak_mengajar: true`, `nama_mapel: 'Tidak Mengajar'`. Pakai `indexBy`/`groupBy`, bukan `.find()` linear berulang
- [x] `actionGetJadwalKelas`: tambah `nama_kelas` di response (untuk badge "Wali Kelas: 7B" di frontend), auto-detect `kelas_id` dari `session.kelas_wali` kalau tidak dikirim eksplisit, skema kehadiran baru (rekap dihitung dari tidak-hadir), pakai index
- [x] `actionGetAllJurnal` (Admin): **PARAMETER TANGGAL SEKARANG WAJIB** (validasi format `yyyy-MM-dd`, kalau kosong ditolak) — sesuai permintaan "maksimal 1 hari per pencarian". Tambah filter `guru_id` dan `mapel_id` (sebelumnya sudah ada `kelas_id`). SEKARANG PAKAI PAGINATION sama seperti `getJurnalSaya`
- [x] **ENDPOINT BARU** `actionGetJadwalPerGuru` (admin only): input `guru_id`, output jadwal mengajar guru tsb dikelompokkan per hari (SENIN-SABTU) — untuk fitur "admin pilih guru, lihat dia ngajar dimana saja"
- [x] **ENDPOINT BARU** `actionGetJadwalKelasPublik`: mirip `getJadwalKelas` tapi TANPA data kehadiran/jurnal (hanya info jadwal: mapel, guru, jam) dan TIDAK dibatasi harus wali kelas — untuk fitur baru "menu Jadwal Kelas" yang bisa diakses guru/siapapun yang login
- [x] `actionUpdateConfig`: tambah `invalidateCache('01_CONFIG')` eksplisit (sebelumnya cuma reset `_configCache` in-memory, cache CacheService tidak ikut ke-invalidate)
- [x] `actionGetKelas`: pakai `indexBy` untuk cari wali kelas, bukan `.find()` linear

### 5.5 Perbaikan BACKEND — Auth.gs (SELESAI, sudah di-package)
- [x] Update `last_login` saat login SEKARANG TIDAK memicu `invalidateCache('03_USER')` — field ini non-kritis, sengaja dibiarkan pakai data cache lama supaya 40 guru login bersamaan pagi hari tidak saling invalidasi cache USER satu sama lain (perbaikan performa spesifik untuk skenario login serentak)

### 5.6 Perbaikan BACKEND — Code.gs (SELESAI, sudah di-package)
- [x] Daftarkan endpoint baru: `getJadwalKelasPublik`, `getJadwalPerGuru`
- [x] `actionGetLog`: SEKARANG PAKAI PAGINATION (sebelumnya cuma slice 200 baris terakhir tanpa navigasi) — response `{ items, page, pageSize, totalItems, totalPages }`

### 5.7 Perbaikan TestSuite.gs (SELESAI, sudah di-package)
- [x] Section baru **"0.5 CACHE CORRECTNESS"** (`testCacheCorrectness`, dipanggil PALING AWAL di `runFullTest`): validasi bahwa `SHEET_CACHE_TTL` terisi benar, sheet transaksional tidak ke-cache, `invalidateCache()` benar-benar bikin `readSheet()` re-read dari sheet (test ubah `VERSI_APP` manual → invalidate → baca ulang harus dapat nilai baru → dikembalikan ke semula), `appendManyToSheet` otomatis invalidasi cache
- [x] Section baru **"6.5 PAGINATION & FILTER ADMIN"** (`testPaginationDanFilter`): validasi `getJurnalSaya` return struktur pagination, `getAllJurnal` TANPA tanggal DITOLAK, `getAllJurnal` DENGAN tanggal berhasil + pagination, `getLog` return struktur pagination, `getJadwalKelasPublik` bisa diakses guru biasa, `getJadwalPerGuru` berhasil untuk admin DAN ditolak untuk guru biasa
- [x] `testCreateDanUpdateJurnal` diperkaya: validasi eksplisit skema kehadiran baru — kirim 1 siswa SAKIT, cek `rekap.total` sesuai jumlah siswa kelas, `rekap.sakit === 1`, `rekap.hadir === total - 1` (dihitung otomatis, bukan disimpan), `tidak_hadir` array HANYA berisi 1 item (bukan semua siswa), DAN validasi LANGSUNG ke sheet `12_KEHADIRAN` bahwa jumlah baris tersimpan = jumlah yang dikirim (bukti nyata "database ringan" — kalau bug, baris akan sebanyak total siswa kelas)
- [x] `cleanupTestData()` diperbaiki: sekarang eksplisit `invalidateCache('10_JURNAL')`, `invalidateCache('11_JURNAL_JAM')`, `invalidateCache('12_KEHADIRAN')` di akhir — sebelumnya hapus baris manual via `deleteRow()` tanpa invalidasi, jadi data basi bisa nyangkut di cache
- [x] Urutan pemanggilan di `runFullTest()`: `testCacheCorrectness()` → `testStrukturSheet()` → `testEndpointPublik()` → `testConfig()` → `testLoginSemuaRole()` → `testGetMasterData()` → `testJadwalDanKonflik()` → `testCreateDanUpdateJurnal()` → `testPaginationDanFilter()` → `testAksesKontrol()` → `testLogout()`
- [x] **Router (Code.gs) — perubahan lanjutan (chat baru, 2026-09-08):** `getJadwalKelasPublik` dipindah ke grup endpoint PUBLIK (tanpa token) sesuai keputusan eksplisit user (menu "Jadwal Kelas" di homepage harus bisa diakses tanpa login). Ditambahkan endpoint publik baru `getKelasPublik` (daftar kelas versi minimal: kelas_id/nama_kelas/tingkat, TANPA nama wali kelas) khusus untuk dropdown di halaman publik — `getKelas` (versi lengkap) TIDAK diubah dan tetap butuh token untuk pemakaian di dalam app.
- **STATUS: Backend (5 file .gs + TestSuite.gs) sudah dijalankan `runFullTest()` oleh user dan LULUS untuk versi sebelum perubahan router di atas.** Perubahan router (pindah `getJadwalKelasPublik` + endpoint baru `getKelasPublik`) BELUM diuji ulang — user perlu jalankan `runFullTest()` sekali lagi setelah upload ulang ke Apps Script editor.

### 5.8 Perbaikan FRONTEND — app.html (SELESAI)
- [x] Bottom nav: padding dikurangi, item aktif dapat highlight pill (`background: var(--blue-l)`), lebih modern
- [x] Bottom nav: z-index dinaikkan ke 70 (di atas `.topbar` z-index 50) supaya SELALU bisa diklik, termasuk saat menimpa area form
- [x] Style baru `.pagination-bar`, `.page-btn`, `.page-info` — dipakai Jurnal Saya, Admin Jurnal, Admin Log
- [x] Style baru `.wali-info-badge` — badge "👤 Wali Kelas: X" di halaman Jurnal Kelas
- [x] Style baru `.form-grid-2` — grid 2 kolom (Kelas|Tanggal), otomatis jadi 1 kolom di layar <380px
- [x] Style baru `.select-input` — dropdown filter admin & pilih kelas/guru/hari
- [x] Style baru `.jadwal-card.kosong` (border dashed, background abu-abu) dan `.jadwal-mapel.muted` (italic, abu-abu) — kartu "Tidak Mengajar" kini visually beda dan TIDAK diberi event click
- [x] Style baru `.form-bottom-space` (height 40px) — spacer wajib di akhir setiap `.form-box` supaya tombol Simpan/Edit tidak tertutup bottom nav

### 5.9 Perbaikan FRONTEND — app.js (SELESAI — ditulis ulang total via bash heredoc, bukan create_file, untuk hindari bug "Field required")
File `js/app.js` (1043 baris) sudah ditulis ulang total dan lolos `node --check` (syntax valid). Semua item berikut SUDAH ada:

- [x] Bottom nav ringkas per role: GURU (Hari Ini, Jurnal Saya, Jadwal Kelas), WALI_KELAS (Jurnal Kelas, Jadwal Kelas), ADMIN (Beranda, Jurnal, Guru, Log)
- [x] `viewDashboard`: render SEMUA jam dari `getJadwalHariIni`, kartu "Tidak Mengajar" (`tidak_mengajar:true`) muted & tidak bisa diklik (`bindJadwalCards` skip `.kosong`)
- [x] `viewJurnalForm`: grid 2 kolom Kelas|Tanggal, Mapel full-width, jam diambil dari `getJam` (difilter `<= appConfig.jam_maks[blok.hari]`) sehingga guru bisa pilih lebih dari jam asal terjadwal. Kehadiran default HADIR (hijau), submit hanya kirim non-HADIR via `kumpulkanTidakHadir()`. `.form-bottom-space` ditambahkan di akhir form-box
- [x] `viewJurnalDetail`/`viewJurnalEdit`: pakai `j.tidak_hadir` (bukan `j.kehadiran`), `.form-bottom-space` ditambahkan
- [x] `viewJurnalSaya`: pagination penuh (`paginationHtml`/`bindPagination`, state `jurnalSayaPage`)
- [x] `viewJurnalKelas`: badge "👤 Wali Kelas: [nama kelas]" dari `d.nama_kelas`
- [x] **VIEW BARU** `viewJadwalKelasLihat` (route `jadwal-kelas-lihat`): dropdown kelas (dari `getKelas`) + dropdown hari, panggil `getJadwalKelasPublik`, render mapel+guru+jam tanpa kehadiran. Terdaftar di bottom nav GURU & WALI_KELAS
- [x] **VIEW BARU** `viewAdminGuru`: dropdown guru (`getGuru`), panggil `getJadwalPerGuru`, render per hari SENIN–SABTU (hari tanpa jadwal ditandai kartu kosong muted)
- [x] `viewAdminJurnal`: filter form (tanggal wajib default hari ini, dropdown guru & mapel), tombol "Cari", hasil dengan pagination
- [x] `viewAdminLog`: pagination penuh
- [x] Helper baru: `paginationHtml(pageInfo)`, `bindPagination(pageInfo, onNavigate)`, `hariIniIndo()`, `capitalizeHari(h)`

### 5.10 Homepage (index.html) — SELESAI
- [x] **Akar masalah tombol tak bisa diklik DITEMUKAN & DIPERBAIKI**: `.hero::before` (pattern dekoratif) memakai `position:absolute; inset:0` tanpa `pointer-events`/`z-index`. Secara default CSS stacking, elemen positioned (meski z-index:auto) dirender DI ATAS konten normal-flow di stacking context yang sama — sehingga pseudo-element dekoratif ini menutupi `.hero-actions` dan memblokir klik meski opacity-nya sangat rendah (0.03) dan terlihat seperti "hanya background". Fix: tambah `pointer-events: none` pada `.hero::before`
- [x] Kurangi kepadatan info: section "13 Tabel Database" (grid detail 13 sheet) DIHAPUS — sudah terwakili ringkas di stats bar ("13 Tabel Database"). Bagian Arsitektur diringkas (baris "Bisa digunakan sekolah lain tanpa coding ulang" dihapus, cukup 3 poin inti)
- [x] Menu/tautan "Jadwal Kelas" ditambahkan di hero-actions, mengarah ke halaman baru `jadwal-publik.html`
- [x] **Keputusan user (dikonfirmasi):** akses "Jadwal Kelas" PUBLIK, tanpa login sama sekali. Dibuat halaman standalone `jadwal-publik.html` (tidak pakai `Auth.requireLogin()`/`app.js`, hanya `js/config.js` + script inline) yang panggil endpoint publik baru `getKelasPublik` + `getJadwalKelasPublik` langsung tanpa token

### 5.11 Keputusan yang TIDAK BOLEH diubah dari permintaan terakhir user (eksplisit dikonfirmasi OK, jangan disentuh)
- Data guru, kelas, siswa → tetap dikelola manual via Spreadsheet config (BUKAN via web admin)
- Jadwal pelajaran → tetap manual via Spreadsheet (BUKAN via web admin)
- Nama sekolah dan jam pelajaran → tetap via 01_CONFIG di Spreadsheet
- Logout dan proteksi akses tanpa login → SUDAH OK, jangan diubah
- Jadwal hari ini dan pilih tanggal (fungsi dasarnya) → SUDAH OK, jangan diubah — hanya PERLU DITAMBAHKAN tampilan jam kosong "Tidak Mengajar"

### 5.12 Dokumentasi (SELESAI, atas permintaan eksplisit user)
- [x] `apps-script/README.md` diupdate: endpoint baru (`getKelasPublik`, `getJadwalKelasPublik` [dipindah ke publik], `getJadwalPerGuru`), semua endpoint pagination ditandai `[PAGINATION]` dengan contoh bentuk response, section baru "Skema Kehadiran (Hanya-Tidak-Hadir)" dan "Performa & Caching"
- [x] `Master_Specification.md` diupdate: skema `12_KEHADIRAN` (kolom `nis` bukan `siswa_id`, hanya simpan tidak-hadir), section 4 (Desain API) ditandai `[DIPERBARUI]` dengan catatan deviasi dari blueprint awal (bukan method PUT, password tidak di-hash, tidak ada endpoint manage* karena data master manual di Spreadsheet), endpoint baru & pagination didokumentasikan

---

## Catatan Harian

### 2026-09-08 (lanjutan — implementasi arsitektur cache client-side, poin 9–13)
Setelah dibahas dulu (lihat percakapan sebelumnya) dan disepakati user, diimplementasikan:

**Backend:**
- `Data.gs`: `actionGetConfig()` sekarang mengembalikan field baru `data_version` (integer, dari `configVal('DATA_VERSION', 0)`)
- `Utils.gs`: fungsi baru `bumpDataVersion()` — menaikkan `DATA_VERSION` di sheet `01_CONFIG` (kolom dicari dinamis via header, bukan hardcode posisi), otomatis membuat barisnya kalau belum ada saat pertama kali dipanggil. Dibungkus try-catch total (dipanggil dari simple trigger, tidak boleh throw)
- `Code.gs`: trigger sederhana `onEdit(e)` (nama fungsi reserved Google Sheets, otomatis aktif tanpa setup manual admin) — memanggil `bumpDataVersion()` HANYA kalau sheet yang diedit adalah `04_GURU`/`05_KELAS`/`06_SISWA`/`07_MAPEL`/`09_JADWAL` (bukan sheet transaksional)
- `TestSuite.gs`: test baru `testDataVersionCache()` (section 2.5), didaftarkan di `runFullTest()` — panggil `bumpDataVersion()` langsung dan verifikasi angkanya naik 1, DAN `getConfig()` ikut mengembalikan versi terbaru. **Catatan: test ini tidak bisa mensimulasikan trigger `onEdit` itu sendiri** (event object `e` tidak bisa dipalsukan dari `runFullTest()`) — perilaku triggernya HARUS dicek manual (lihat Panduan_Deploy_dan_Uji.md C8.9)

**Frontend:**
- File baru `frontend/js/cache.js` — modul `DataCache` (get/set/clearAll/syncIfNeeded), pakai `localStorage`, SEMUA operasi dibungkus try-catch (gagal-aman total: localStorage nonaktif/penuh → cache selalu dianggap kosong, app tetap jalan normal tanpa cache)
- `app.js`: fungsi baru `cachedApiCall(cacheKey, action, params)` — dipakai untuk `getGuru`, `getKelas`, `getMapel`, `getJam`, `getSiswa` (per kelas_id, key `siswa_<kelas_id>`), `getJadwalPerGuru` (per guru_id, key `jadwalGuru_<guru_id>`). **TIDAK dipakai** untuk `getJadwalHariIni`/`getJadwalKelas`/`getJadwalKelasPublik`/jurnal/kehadiran/log — semua itu mengandung status transaksional (`sudah_diisi`, konflik) yang harus selalu live
- `init()`: setelah `getConfig` sukses, panggil `DataCache.syncIfNeeded(appConfig.data_version)` — kalau versi beda dari yang tersimpan di perangkat, seluruh cache lokal dihapus (refresh lazy per-view, bukan preload sekaligus)
- Fungsi baru `forceSyncData()` — dipanggil tombol 🔄 baru di header (`app.html`, SEMUA role bisa pakai): hapus semua cache, ambil `data_version` terbaru, lalu render ulang halaman yang sedang dibuka
- `app.html`: tombol `#btnSync` + CSS animasi spin saat proses sync + `<script src="js/cache.js">` ditambahkan SEBELUM `app.js`

**Dokumentasi:**
- `README.md`: section "Cache Client-Side (localStorage...)" baru di bawah "Performa & Caching", menjelaskan kenapa BUKAN file JSON di GitHub (repo publik → data siswa anak di bawah umur bisa diakses tanpa login kalau ditaruh di sana)
- `Master_Specification.md`: section baru 4.7 "Arsitektur Cache Client-Side" (diagram alur, keputusan sadar yang harus dipertahankan), `01_CONFIG` didokumentasikan ada key otomatis `DATA_VERSION` (jangan diedit manual), section 5 (Struktur File GitHub) diperbarui total supaya sesuai kondisi nyata (sebelumnya masih blueprint lama yang tidak sesuai implementasi — repo `/lab`, file `dashboard.js`/`jurnal.js`/`kelas.js`/`admin.js` yang sebenarnya tidak pernah ada, karena semua digabung jadi satu `app.js`)

**Keamanan yang SENGAJA dihindari** (sesuai diskusi arsitektur): TIDAK ADA data siswa/guru/kelas yang disimpan sebagai file JSON statis di repo GitHub manapun — repo `smpmuda/jurnal` bersifat publik (syarat GitHub Pages gratis), jadi cache HANYA boleh di `localStorage` per-perangkat pengguna yang sudah login, tidak pernah di tempat yang bisa diakses tanpa autentikasi.

Semua file `.gs`, `app.js`, dan `cache.js` lolos `node --check` setelah perubahan ini.

### 2026-09-08 (lanjutan — feedback hasil uji manual user, 8 poin perbaikan)
Backend TIDAK ada perubahan sesi ini — semua sudah cukup (getAllJurnal sudah support filter kelas_id, getJurnalSaya sudah support filter bulan sejak awal, ternyata belum dipakai di frontend).

Perbaikan frontend (`app.js`, `app.html`, `index.html`):
1. **Bug "Kembali" ke login — DIPERBAIKI.** Akar masalah: tombol pakai `history.back()` (browser history), yang masih menyimpan `login.html` sebagai halaman sebelumnya karena redirect login→app pakai `location.href` (bukan `replace`). Solusi: dibuat sistem riwayat navigasi custom DI DALAM APP (`navStack`, fungsi `goBack()`) yang sama sekali tidak menyentuh browser history. Semua tombol "← Kembali"/"← Batal" sekarang pakai `goBack()`.
2. Menu **Jadwal Kelas** kini juga ada di: bottom nav Admin (baru), menu Beranda Admin (baru), dan link cepat "🏫 Lihat Jadwal Kelas Lain" di Dashboard Guru & Jurnal Kelas Wali (sebelumnya cuma ada di bottom nav Guru/Wali, kurang kelihatan).
3. **Admin — Jurnal**: ditambah filter Kelas (dropdown, dari `getKelas`) — backend sudah support `kelas_id` sejak awal, tinggal disambungkan di UI.
4. **Admin — Jadwal Guru**: diubah total dari daftar panjang semua hari jadi TAB HARI (Senin–Jumat, hanya hari aktif sesuai `appConfig.jam_maks`). Data diambil SEKALI saat pilih guru (`adminGuruDataCache`), ganti tab hari HANYA render ulang dari cache — TIDAK ada API call tambahan.
5. **Log Aktivitas — pagination ketutup bottom nav — DIPERBAIKI**: `body padding-bottom` dinaikkan 76px→100px, `.pagination-bar` diberi `margin-bottom:30px` tambahan.
6. **Bottom nav diredesain** — lebih ringan/modern: hilangkan background pill tebal, ganti jadi indikator strip tipis di atas ikon aktif, kurangi shadow, kurangi padding, tambah `backdrop-filter blur`. Berlaku untuk SEMUA role.
7. **Homepage**: tombol "Baca Spesifikasi" **dihapus total** (sebelumnya cuma diarahkan ke .md, sekarang dihapus sesuai permintaan).
8. **Guru/Wali Kelas**: ditambah hint text di bawah date-bar ("Menampilkan data [tanggal]. Pilih tanggal lain di atas untuk melihat data pada tanggal tersebut.") — dipakai di Dashboard & Jurnal Kelas.
9. **Jurnal Saya**: ditambah filter Bulan (dropdown Januari–Desember) — backend `getJurnalSaya` ternyata SUDAH support param `bulan` sejak awal (belum pernah disambungkan ke UI).
10. **Wali Kelas**: ditambah panel ringkasan **"😷 Siswa Tidak Hadir Hari Ini"** di atas Jurnal Kelas — mengumpulkan semua siswa tidak hadir dari SELURUH mapel hari itu (bukan per-mapel satu-satu), tiap baris tampilkan nama + badge status per mapel (siswa bisa tidak hadir di lebih dari 1 mapel dengan status berbeda, jadi ditampilkan multi-tag).

**Poin 9–13 di feedback user (arsitektur cache/static data/sinkronisasi) — SENGAJA BELUM diimplementasikan**, sesuai instruksi eksplisit user ("jangan langsung implementasi, bahas dulu pola arsitekturnya"). Dijawab terpisah sebagai diskusi arsitektur, bukan kode.

Semua file `.gs` dan `app.js` lolos `node --check` setelah semua perubahan di atas.

### 2026-09-08 (chat baru, lanjutan handoff)
- Backend dikonfirmasi user: `runFullTest()` sudah dijalankan dan lulus untuk versi backend hasil rombakan performa (sebelum perubahan router sesi ini)
- Keputusan Bagian K dikonfirmasi user: (1) menu "Jadwal Kelas" PUBLIK tanpa login, (2) tampilan kartu "Tidak Mengajar" bebas sesuai desain, (3) dokumentasi ikut diupdate
- Router (Code.gs) diubah: `getJadwalKelasPublik` dipindah ke grup publik, endpoint baru `getKelasPublik` ditambahkan — **perlu `runFullTest()` ulang setelah upload**
- `frontend/js/app.js` ditulis ulang total (1043 baris) via bash heredoc (menghindari bug "Field required" pada `create_file` untuk file besar yang tercatat di sesi sebelumnya) — semua item Bagian G.1 selesai
- `frontend/app.html`: CSS baru lengkap ditambahkan (bottom nav, pagination, badge wali kelas, form grid, select dropdown, kartu kosong/muted, spacer form)
- `frontend/index.html`: akar masalah tombol tak bisa diklik ditemukan (`.hero::before` absolute tanpa `pointer-events`) dan diperbaiki; kepadatan info dikurangi (section 13 tabel database dihapus); tautan "Jadwal Kelas" ditambahkan
- File baru `frontend/jadwal-publik.html` dibuat — halaman publik berdiri sendiri (tanpa `Auth`/`app.js`), langsung panggil `getKelasPublik`+`getJadwalKelasPublik`
- `apps-script/README.md` dan `Master_Specification.md` diupdate mendokumentasikan endpoint baru, skema kehadiran, dan pagination
- Semua file `.gs` lolos `node --check`; `app.js` dan script inline `jadwal-publik.html` lolos `node --check`
- **Belum dilakukan**: deploy sungguhan, `runFullTest()` ulang setelah perubahan router, dan uji manual end-to-end oleh user

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
| 2026-09-08 | `testCacheCorrectness` di TestSuite.gs menulis baris log dummy dengan `aksi:'TEST'`, melanggar data validation dropdown kolom D sheet `13_LOG` (hanya terima LOGIN/LOGOUT/CREATE/UPDATE/DELETE) → `runFullTest()` gagal dengan error di baris sheet, bukan di logic cache-nya | Ganti `'TEST'` jadi `'CREATE'` di baris `appendManyToSheet('13_LOG', ...)` pada `testCacheCorrectness` | Selesai |
