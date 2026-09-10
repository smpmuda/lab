# MASTER CONTEXT / HANDOFF — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**
Dibuat: 2026-09-06 · Alasan: chat sebelumnya mendekati batas panjang, dipindah ke chat baru

---

## INSTRUKSI UNTUK CLAUDE DI CHAT BARU — BACA INI DULU

Dokumen ini adalah satu-satunya sumber kebenaran dari pekerjaan yang sudah dilakukan di percakapan sebelumnya. User TIDAK akan menjelaskan ulang dari awal — perlakukan dokumen ini seolah kamu sendiri yang menulis semua keputusan dan kode di dalamnya.

Sebelum melakukan apapun:
1. Baca seluruh dokumen ini sampai selesai
2. Cek file yang di-upload di chat ini (ada apps-script.zip dan frontend.zip — lihat Bagian C)
3. JANGAN mengulang pekerjaan yang sudah SELESAI (lihat Bagian A — Status Ringkas)
4. LANGSUNG lanjutkan dari titik yang ditandai "BELUM DIKERJAKAN" — jangan menulis ulang dari nol tanpa alasan
5. Kalau ada bagian yang ambigu atau kamu ragu, TANYA dulu ke user — jangan menebak
6. Setelah paham kondisi, validasi dengan user: "Saya paham kondisi terakhir adalah X, saya akan lanjutkan ke Y — benar?"

Jangan berkata "saya akan membangun aplikasi Jurnal Mengajar dari awal" atau semacamnya — proyek ini sudah sekitar 90% jadi, yang tersisa adalah menyelesaikan satu file frontend (app.js) dan beberapa CSS pendukung, lalu testing ulang.

---

## A. STATUS RINGKAS (per 2026-09-06)

| Komponen | Status |
|---|---|
| Spreadsheet (13 sheet, data dummy) | SELESAI |
| Backend Apps Script (5 file .gs) — versi PERFORMANCE REWRITE | KODE SELESAI DITULIS, BELUM DIUJI ULANG setelah rombakan besar |
| TestSuite.gs (self-test) — versi baru dengan test cache & pagination | KODE SELESAI DITULIS, BELUM DIJALANKAN |
| Deploy Web App ke Google (URL sudah didapat & tervalidasi) | SELESAI (dari sesi sebelumnya, sebelum rombakan performa) |
| Frontend login.html, app.html (struktur/shell) | SELESAI (versi lama, BELUM dapat CSS baru) |
| Frontend js/config.js, js/api.js, js/auth.js | SELESAI, tidak perlu diubah |
| Frontend js/app.js | BELUM SELESAI — INI PRIORITAS UTAMA LANJUTAN |
| CSS baru di app.html (pagination, grid form, dll) | BELUM DIKERJAKAN SAMA SEKALI |
| Homepage (index.html) perbaikan tombol + menu baru | BELUM DIKERJAKAN, tombol Masuk/Spesifikasi dilaporkan TIDAK BISA DIKLIK — akar masalah belum diketahui |

Kesimpulan: backend sudah lengkap kodenya (menunggu test ulang), frontend app.js adalah pekerjaan yang terputus di tengah jalan dan HARUS diselesaikan lebih dulu sebelum apapun lain.

---

## B. KRONOLOGI SINGKAT (supaya paham konteks keputusan)

1. Sesi 1-2: desain arsitektur (GitHub Pages + Apps Script bound ke Spreadsheet + 13 sheet), buat Master_Specification.md, Master_Progress.md, index.html landing page
2. Sesi 3: user beri detail skala nyata (1000 siswa, 30 kelas, 36 guru, jam 1-9 tanpa waktu clock, istirahat setelah jam 3&6, Senin-Rabu 9 jam/Kamis 8/Jumat 4), keputusan konflik jadwal = warning saja bukan blokir, keputusan password plain text tanpa hash
3. Sesi 4: spreadsheet dibuat ulang sesuai detail itu, backend Apps Script pertama kali ditulis (5 file .gs), frontend pertama kali ditulis (login.html, app.html, 4 file js)
4. Sesi 5: testing sungguhan dimulai — DITEMUKAN 6 BUG BERURUTAN (lihat Bagian D), semua diperbaiki satu-satu sampai runFullTest() di Apps Script return "SEMUA TEST LULUS"
5. Sesi 5 lanjutan: user deploy Web App ke Google, dapat URL, test manual dari browser (?action=ping, ?action=getConfig) — BERHASIL setelah bug ke-6 (routing ping) diperbaiki
6. Sesi 6 (sesi sebelum ini): user memberi daftar perbaikan besar mencakup UI, fitur baru, dan PERFORMA sebagai prioritas utama (target 40 guru bersamaan). Ini memicu rombakan besar:
   - Backend: strategi cache 2 lapis, skema kehadiran diubah total (hanya simpan tidak-hadir), pagination di banyak endpoint, index-based lookup (hilangkan pola N+1), endpoint baru (getJadwalPerGuru, getJadwalKelasPublik)
   - Frontend: rombakan app.js GAGAL TERSIMPAN karena error tool ("Field required"). Draft lengkap (~750 baris) sempat ditulis lengkap tapi tidak pernah benar-benar tersimpan ke disk. File app.js di disk masih versi LAMA, tidak ada satupun fitur baru di dalamnya
7. Sekarang: chat mendekati batas panjang, dipindah ke chat baru dengan dokumen ini sebagai handoff. CATATAN: bahkan dokumen handoff ini sendiri gagal tersimpan lewat create_file tool (error "Field required" yang sama), akhirnya ditulis pakai bash heredoc sebagai workaround.

---

## C. FILE YANG DI-UPLOAD BERSAMA DOKUMEN INI

Cek zip yang di-upload di chat ini:

- apps-script.zip — berisi 6 file .gs + .clasp.json + appsscript.json + README.md. Ini versi PALING BARU (performance rewrite), sudah termasuk cache, pagination, skema kehadiran baru, endpoint baru. BELUM PERNAH di-runFullTest() oleh user — ini yang harus dilakukan PERTAMA setelah user upload ulang ke Apps Script editor.
- frontend.zip — berisi login.html, app.html, folder js/ (config.js, api.js, auth.js, app.js). PERINGATAN: app.js di dalam zip ini MASIH VERSI LAMA (belum ada fitur baru dari Bagian E). app.html juga belum punya CSS baru yang dibutuhkan.

Kalau user tidak sempat upload zip atau file di zip beda dari yang disebutkan di sini, tanya dulu sebelum melanjutkan — jangan asumsikan.

---

## D. RIWAYAT BUG YANG SUDAH DITEMUKAN & DIPERBAIKI (jangan diulang polanya)

Total 6 bug ditemukan selama testing sebelum rombakan performa, semua sudah diperbaiki dan tervalidasi:

1. actionGetJadwalHariIni return type inkonsisten — return ok([]) (array) alih-alih ok({jadwal:[]}) (object) saat guru tidak punya guru_id. Fix: selalu return object dengan field jadwal.
2. TestSuite pakai response login mentah sebagai session — actionLogin() sengaja tidak sertakan guru_id/username di response (tidak perlu diekspos ke frontend), tapi test memakainya langsung sebagai "session". Fix: ambil session PENUH via validateToken(token) setelah login, sama seperti router asli.
3. BUG PALING KRITIS — Date vs String: Google Sheets otomatis convert string tanggal jadi objek Date internal saat ditulis via appendRow(). readSheet() awalnya baca apa adanya, jadi SEMUA perbandingan String(tanggal) === '...' gagal diam-diam. Fix: readSheet() normalisasi Date object menjadi string yyyy-MM-dd (kolom tanggal) atau yyyy-MM-dd HH:mm:ss (kolom _at/waktu/last_login).
4. REGRESI dari fix #3: perbaikan tanggal menambahkan configVal('ZONA_WAKTU',...) di dalam readSheet() — tapi configVal -> getConfig -> readSheet('01_CONFIG') balik manggil readSheet() lagi -> REKURSI TAK BERUJUNG, skrip macet total tanpa pesan error jelas. Fix: pakai Session.getScriptTimeZone() langsung, JANGAN PERNAH panggil configVal()/getConfig() dari dalam readSheet().
5. cleanupTestData() kena bug sama seperti #3 — baca row[1] mentah tanpa normalisasi Date, gagal mendeteksi & menghapus sisa data test lama, menyebabkan test create-jurnal berikutnya salah dianggap "duplikat" (padahal deteksi duplikatnya sendiri sudah benar). Fix: normalisasi Date di cleanupTestData() juga.
6. Router: ping butuh token padahal harus publik — di Code.gs, handler action === 'ping' diletakkan SETELAH blok validasi token, bukan sejajar login/getConfig. Fix: pindah ke kelompok endpoint publik di awal handleRequest().

PELAJARAN PENTING yang harus terus dipegang:
- Fungsi pembaca data paling dasar (readSheet) TIDAK BOLEH bergantung pada fungsi level lebih tinggi (getConfig) yang balik memanggilnya
- Setiap kali menemukan test gagal, JANGAN langsung asumsikan "cuma salah test" — riwayat menunjukkan 5 dari 6 bug adalah bug produksi sungguhan
- Endpoint publik (tanpa token) harus dicek urutannya eksplisit di router, tidak cukup diasumsikan dari nama fungsi

---

## E. RINCIAN PERMINTAAN TERAKHIR USER (yang memicu rombakan performa — INI YANG SEDANG DIKERJAKAN)

User memberi daftar perbaikan lengkap ini:

### UI Jurnal
- Bottom menu terlalu besar paddingnya, kurang modern -> buat compact, selaras tema
- Bottom menu menutupi tombol Edit/Simpan -> naikkan posisinya
- Tambahkan div padding 40px di bawah tombol Edit/Simpan (div.form-box) agar tidak tertutup
- Form isi/edit jurnal dibuat sederhana, grid 2 kolom: Kelas | Tanggal, lalu Mapel, lalu Ringkasan Kegiatan, lalu Catatan, lalu Kehadiran
- Kehadiran: HANYA simpan siswa yang TIDAK hadir (bukan semua siswa) — database lebih ringan
- Jurnal lebih dari 25 data harus pakai pagination

### Guru
- Jadwal hari ini & pilih tanggal: sudah OK, jangan diubah fungsinya
- Percepat loading — saat ini terlalu lambat
- Jurnal Saya: pakai pagination
- Jam 1-9 tetap ditampilkan semua (sesuaikan jumlah pelajaran sehari per hari)
- Kalau guru tidak mengajar di jam tertentu, tetap tampilkan kartunya dengan keterangan "Tidak Mengajar"
- Guru harus bisa pilih LEBIH DARI 1 jam saat isi jurnal

### Wali Kelas
- Tampilkan info wali kelas mengajar kelas apa, contoh: "Wali Kelas: 7B"
- Halaman Hari Ini: tampilkan SEMUA jadwal mapel hari itu untuk kelas tsb

### Admin
- Saat lihat jurnal, tambah filter: Tanggal, Guru, Mapel
- Tanggal maksimal HANYA 1 hari dalam satu pencarian
- Log aktivitas terlalu panjang -> tambah pagination

### Homepage
- Sudah cukup bagus tapi terlalu banyak informasi -> kurangi
- Tombol Masuk di atas: sudah OK
- Perbaiki tombol "Masuk ke Aplikasi" dan "Baca Spesifikasi" — TIDAK BISA DIKLIK saat ini
- Tambahkan menu Jadwal Kelas — guru/siswa bisa lihat jadwal kelas manapun

### Security
- Logout & proteksi akses tanpa login: sudah OK, pertahankan, jangan diubah

### Konfigurasi Admin
- Data guru/kelas/siswa: tetap via Spreadsheet config — INI OK, jangan ubah
- Jadwal pelajaran: tetap manual via Spreadsheet — INI OK, jangan ubah
- Nama sekolah & jam pelajaran: tetap via config — INI OK, jangan ubah
- Admin lihat semua jurnal dengan filter — INI PERLU DITAMBAHKAN (sudah dikerjakan di backend, lihat Bagian F)
- Admin bisa pilih guru -> lihat jadwal guru itu mengajar dimana saja — fitur baru

### Performa (PRIORITAS UTAMA — kalimat asli user: "Ini prioritas utama")
"Aplikasi saat ini masih lambat meskipun baru digunakan 1 orang. Optimalkan agar stabil digunakan sekitar 40 guru secara bersamaan. Fokus pada: Query database, Index database, N+1 query, Loading data yang terlalu banyak, API/request yang berulang, Pagination, Caching jika diperlukan. Target data: 30 kelas, kurang lebih 1.000 siswa, kurang lebih 40 pengguna bersamaan."

Instruksi tambahan eksplisit dari user: "Jangan mengubah fitur yang sudah OK" dan "pastikan sistem efisien, minimalkan memanggil spreadsheet".

---

## F. APA YANG SUDAH DIKERJAKAN UNTUK MEMENUHI PERMINTAAN DI ATAS (BACKEND — SELESAI)

Semua ini ada di apps-script.zip yang di-upload, kode SUDAH DITULIS LENGKAP:

### Utils.gs
- Cache 2 lapis: in-memory per eksekusi (_execCache) + CacheService (SHEET_CACHE_TTL) — sheet master data (CONFIG, TAHUN_AJARAN, GURU, KELAS, SISWA, MAPEL, JAM) di-cache 300 detik, USER 60 detik, JADWAL 180 detik. Sheet transaksional (JURNAL, JURNAL_JAM, KEHADIRAN, LOG) SENGAJA TIDAK di-cache
- invalidateCache(sheetName) wajib dipanggil setiap tulis
- appendManyToSheet() (baru) — batch write pakai setValues(), bukan appendRow() berulang
- updateRowById(), deleteRowsByIds() (baru) — otomatis invalidasi cache
- nextId() diperbaiki — cari ID number terbesar sungguhan dari data, bukan getLastRow()
- indexBy(), groupBy() (baru) — bangun Map sekali untuk lookup O(1), ganti pola find/filter berulang (N+1)
- paginate() (baru) — helper generik potong array per halaman

### Jurnal.gs
- SKEMA BARU: 12_KEHADIRAN hanya simpan yang TIDAK HADIR. hadir = total_siswa minus jumlah_tidak_hadir (dihitung, tidak disimpan)
- actionCreateJurnal, actionUpdateJurnal/_replaceKehadiran: pakai appendManyToSheet/deleteRowsByIds (bukan loop manual)
- actionGetJurnalSaya: PAKAI PAGINATION — response sekarang { items, page, pageSize, totalItems, totalPages } bukan array langsung
- actionGetDetailJurnal: field response kehadiran diganti nama jadi tidak_hadir

### Data.gs
- _jadwalGuru: TAMPILKAN SEMUA JAM 1 sampai MAX-HARI, jam kosong ditandai { tidak_mengajar: true, nama_mapel: 'Tidak Mengajar' }
- actionGetJadwalKelas: tambah nama_kelas di response (untuk badge "Wali Kelas: X"), auto-detect kelas dari session.kelas_wali
- actionGetAllJurnal: parameter tanggal SEKARANG WAJIB (validasi format, ditolak kalau kosong), tambah filter guru_id+mapel_id, PAKAI PAGINATION
- ENDPOINT BARU actionGetJadwalPerGuru (admin only) — input guru_id, output jadwal per hari (SENIN-SABTU)
- ENDPOINT BARU actionGetJadwalKelasPublik — mirip getJadwalKelas tapi TANPA kehadiran/jurnal, TIDAK dibatasi harus wali kelas — untuk fitur "menu Jadwal Kelas" baru
- actionUpdateConfig: tambah invalidateCache('01_CONFIG') eksplisit

### Auth.gs
- last_login update saat login TIDAK memicu invalidasi cache USER (field non-kritis, demi performa saat 40 guru login bersamaan)

### Code.gs
- Daftarkan endpoint baru: getJadwalKelasPublik, getJadwalPerGuru
- actionGetLog: PAKAI PAGINATION

### TestSuite.gs
- Section baru "0.5 CACHE CORRECTNESS" — test bahwa cache tidak menyebabkan data basi (test paling kritis untuk perubahan performa ini)
- Section baru "6.5 PAGINATION & FILTER ADMIN" — test semua endpoint baru dan yang berubah signature
- testCreateDanUpdateJurnal diperkaya — validasi skema kehadiran baru sampai level cek langsung ke sheet (bukti nyata "database ringan")
- cleanupTestData() diperbaiki — invalidasi cache eksplisit di akhir

STATUS: SEMUA KODE BACKEND DI ATAS SUDAH DITULIS LENGKAP, TAPI runFullTest() BELUM PERNAH DIJALANKAN LAGI SETELAH ROMBAKAN INI. Task pertama untuk chat baru: minta user upload ulang 6 file .gs ini ke Apps Script editor, jalankan runFullTest(), laporkan hasilnya — treat FAIL apapun dengan skeptis yang sama seperti riwayat bug di Bagian D (jangan buru-buru bilang "cuma salah test").

---

## G. APA YANG BELUM DIKERJAKAN — INI PEKERJAAN LANJUTAN (FRONTEND, PRIORITAS UTAMA)

### G.1 app.js — HARUS DITULIS ULANG TOTAL (paling prioritas)

File app.js di frontend.zip masih versi LAMA. Perlu ditulis ulang dengan SEMUA perubahan berikut:

- Bottom nav per role (lebih ringkas): GURU (Hari Ini, Jurnal Saya, Jadwal Kelas — baru), WALI_KELAS (Jurnal Kelas, Jadwal Kelas — baru), ADMIN (Beranda, Jurnal, Guru — baru, Log)
- viewDashboard: render SEMUA jam 1 sampai max-hari dari respons getJadwalHariIni (yang sekarang sudah menyertakan slot kosong tidak_mengajar: true) — kartu "Tidak Mengajar" harus tampak pudar/muted dan TIDAK bisa diklik
- viewJurnalForm: grid 2 kolom Kelas|Tanggal, lalu Mapel, lalu Ringkasan, lalu Catatan, lalu Kehadiran. Ambil SEMUA jam dari endpoint getJam (bukan cuma dari blok jadwal asal) — guru BISA PILIH LEBIH DARI jam yang terjadwal. Checkbox kehadiran: default semua "HADIR" (hijau), guru klik yang tidak hadir saja (S/I/A). Saat submit, HANYA kirim yang BUKAN status HADIR ke endpoint createJurnal. WAJIB tambahkan div padding 40px di akhir .form-box
- viewJurnalDetail/viewJurnalEdit: field response sekarang j.tidak_hadir (bukan j.kehadiran). Tambahkan padding 40px yang sama di akhir form-box
- viewJurnalSaya: response API sekarang { items, page, totalPages, totalItems } — render pagination (prev/next + info halaman)
- viewJurnalKelas: tambah badge "Wali Kelas: [nama kelas]" dari d.nama_kelas di response
- VIEW BARU viewJadwalKelasPublik: dropdown pilih kelas + dropdown pilih hari, panggil getJadwalKelasPublik, tampilkan mapel+guru+jam tanpa data kehadiran
- VIEW BARU viewAdminGuru: dropdown pilih guru, panggil getJadwalPerGuru, tampilkan jadwal per hari (SENIN-SABTU)
- viewAdminJurnal: filter form (tanggal wajib + dropdown guru dari getGuru + dropdown mapel dari getMapel), tombol "Cari", hasil dengan pagination
- viewAdminLog: response sekarang { items, page, totalPages, totalItems } — render pagination
- Helper baru dibutuhkan: paginationHtml(pageInfo), bindPagination(pageInfo, onNavigate), hariIniIndo(), capitalizeHari(h)

Saran teknis: app.js versi LAMA yang masih ada di frontend.zip adalah referensi gaya kode yang baik (pola SPA single-file, konvensi penamaan fungsi view*, bind*, dll) — pertahankan konvensi yang sama saat menulis ulang, jangan ganti arsitektur/style coding.

### G.2 CSS baru di app.html — BELUM ADA SAMA SEKALI

Perlu ditambahkan style untuk:
- Bottom nav: padding lebih kecil, lebih modern, dan posisi/z-index diperbaiki supaya tidak menutupi tombol form
- .pagination-bar, .page-btn, .page-info (komponen pagination)
- .wali-info-badge (badge "Wali Kelas: 7B")
- .form-grid-2 (grid 2 kolom untuk form)
- .select-input (dropdown filter)
- .jadwal-card.kosong dan .jadwal-mapel.muted (kartu "Tidak Mengajar" — harus visually beda dari kartu aktif)

### G.3 Homepage (index.html) — BELUM DIKERJAKAN SAMA SEKALI

- Kurangi kepadatan informasi (user bilang "sudah bagus tapi terlalu banyak info")
- INVESTIGASI DULU kenapa tombol "Masuk ke Aplikasi" dan "Baca Spesifikasi" tidak bisa diklik — belum diketahui akar masalahnya (kemungkinan CSS pointer-events, z-index, atau href salah — perlu dicek langsung ke file index.html yang ada)
- Tambah menu/tautan "Jadwal Kelas" — PERLU DIKONFIRMASI ke user: apakah fitur ini butuh login dulu (endpoint getJadwalKelasPublik saat ini tetap butuh token) atau harus benar-benar publik tanpa login sama sekali? Ini keputusan yang belum diambil.

---

## H. KEPUTUSAN TEKNIS YANG TIDAK BOLEH DIUBAH (dari seluruh riwayat proyek)

1. Password plain text, tanpa hash/SHA — keputusan eksplisit user
2. siswa_id dihapus, NIS jadi primary key siswa
3. Jam 1-9 tanpa waktu clock — istirahat setelah jam 3 & 6 hanya penanda visual
4. Jam per hari: Senin-Rabu=9, Kamis=8, Jumat=4, Sabtu=0 — dari 01_CONFIG
5. Konflik jadwal guru: warning saja, TIDAK PERNAH diblokir
6. Data master (guru/kelas/siswa/mapel/jam/jadwal) dikelola manual di Spreadsheet — TIDAK ADA halaman admin create/update di web
7. Guru tidak bisa ganti password sendiri
8. Batas edit jurnal dari 01_CONFIG (BATAS_EDIT_HARI, default 7 hari)
9. Tanggal jurnal fleksibel — guru bisa isi untuk hari ini (default) atau tanggal lain
10. Apps Script BOUND ke Spreadsheet (bukan standalone) — akses via SpreadsheetApp.getActiveSpreadsheet(), tanpa Spreadsheet ID di kode
11. 3 role: ADMIN, GURU, WALI_KELAS — satu akun bisa multi-role (string pisah koma di kolom role)
12. [BARU sesi ini] Kehadiran hanya simpan yang TIDAK HADIR — siswa hadir tidak pernah jadi baris di sheet
13. [BARU sesi ini] Cache 2 lapis untuk sheet master data, sheet transaksional (JURNAL/JURNAL_JAM/KEHADIRAN/LOG) tidak pernah di-cache
14. [BARU sesi ini] getAllJurnal (admin) wajib parameter tanggal, maksimal 1 hari per pencarian
15. Logout dan proteksi akses tanpa login — sudah OK, jangan diubah
16. Jadwal hari ini & pilih tanggal (fungsi dasarnya) — sudah OK, jangan diubah, hanya ditambahkan tampilan "Tidak Mengajar" untuk jam kosong

---

## I. STRUKTUR FILE LENGKAP

apps-script/ (di apps-script.zip, VERSI TERBARU)
- Utils.gs — selesai, cache + pagination helper + index helper
- Auth.gs — selesai, login, token, multi-role
- Data.gs — selesai, master data, jadwal, endpoint baru
- Jurnal.gs — selesai, CRUD jurnal, skema kehadiran baru
- Code.gs — selesai, router, endpoint baru terdaftar
- TestSuite.gs — selesai, test baru untuk cache & pagination
- appsscript.json — tidak berubah
- .clasp.json — tidak berubah
- README.md — tidak berubah (mungkin perlu update dokumentasi endpoint baru, opsional)

frontend/ (di frontend.zip)
- login.html — tidak berubah, tidak perlu disentuh
- app.html — shell OK, TAPI BUTUH CSS BARU (lihat G.2)
- index.html — BELUM DIKERJAKAN (lihat G.3), TIDAK ada di frontend.zip, cek file terpisah kalau sudah pernah diupload sebelumnya
- js/config.js — tidak berubah, sudah ada API_URL asli
- js/api.js — tidak berubah
- js/auth.js — tidak berubah
- js/app.js — VERSI LAMA, HARUS DITULIS ULANG TOTAL (lihat G.1)

Dokumentasi:
- Master_Specification.md — blueprint kolom sheet + API (belum diupdate dengan endpoint baru, opsional)
- Master_Progress.md — sudah diupdate lengkap sampai Fase 5 di sesi sebelumnya
- Panduan_Deploy_dan_Uji.md — masih relevan untuk Bagian A (deploy backend), skenario Bagian C mungkin perlu ditambah untuk fitur baru
- HANDOVER.md — dokumen handoff sesi sebelumnya (sebelum rombakan performa), sudah agak usang
- MASTER_CONTEXT_HANDOFF.md — dokumen ini, PALING BARU, jadi rujukan utama sekarang

---

## J. URUTAN KERJA YANG DISARANKAN UNTUK CHAT BARU

1. Konfirmasi ke user dulu: "Saya paham kondisinya begini [ringkas Bagian A] — betul?"
2. Minta user upload ulang backend (apps-script.zip isinya) ke Apps Script editor, jalankan runFullTest(), kirim hasilnya. Perlakukan FAIL apapun dengan investigasi serius (lihat pola bug di Bagian D), jangan buru-buru anggap salah test
3. Setelah backend terkonfirmasi lulus test, tulis ulang app.js total sesuai rincian di G.1 — gunakan app.js versi lama sebagai referensi gaya kode
4. Tambahkan CSS baru ke app.html sesuai G.2
5. Perbaiki index.html — investigasi dulu kenapa tombol tidak bisa diklik, baru perbaiki, kurangi kepadatan info, tanya user soal keputusan login untuk menu Jadwal Kelas
6. Setelah semua kode siap, update Master_Progress.md mencatat penyelesaian Fase 5 (user secara eksplisit minta file ini selalu diupdate tiap ada progres)
7. Paketkan ulang jadi zip final, serahkan ke user untuk di-deploy dan diuji manual sesuai Panduan_Deploy_dan_Uji.md (mungkin perlu skenario tambahan untuk fitur baru, buat kalau belum ada)

---

## K. HAL YANG PERLU DIKONFIRMASI KE USER (jangan diasumsikan)

1. Apakah menu "Jadwal Kelas" baru di homepage harus bisa diakses TANPA login sama sekali, atau tetap butuh login (endpoint saat ini masih butuh token)?
2. Apakah user sudah sempat menjalankan runFullTest() dengan kode backend versi terbaru ini, atau memang belum sama sekali (mengingat rombakan besar terjadi tepat sebelum chat terputus)?
3. Apakah ada preferensi spesifik soal tampilan visual "Tidak Mengajar" (warna, ikon) atau bebas sesuai judgement desain?
4. Apakah README.md dan Master_Specification.md perlu diupdate mendokumentasikan endpoint baru (getJadwalPerGuru, getJadwalKelasPublik) dan perubahan skema kehadiran, atau cukup kode saja tanpa update dokumentasi formal?

---

Dokumen ini dibuat sebagai pengganti percakapan penuh sebelumnya. Perlakukan sebagai fakta, bukan ringkasan yang perlu diverifikasi ulang, kecuali item di Bagian K yang memang sengaja ditandai perlu konfirmasi.
