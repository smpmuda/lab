# HANDOVER — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**
Disusun: 2026-09-05 · Status backend: ✅ SEMUA TEST LULUS

---

## BAGIAN 1 — KONTEKS UNTUK CHAT BARU
*(Blok ini bisa langsung di-copy-paste ke chat baru)*

```
KONTEKS PROYEK: Jurnal Mengajar — SMP Muhammadiyah 2 Cilacap

## TUJUAN PROYEK
Aplikasi web sederhana untuk mencatat kegiatan belajar mengajar (KBM) harian.
Guru mengisi jurnal dari HP, wali kelas memantau kelengkapan jurnal kelasnya,
admin mengelola seluruh sistem. Dibangun dengan GitHub Pages (frontend) +
Google Apps Script (backend/API) + Google Spreadsheet (database) — tanpa
server berbayar, semua di ekosistem Google gratis.

## STATUS SAAT INI
- Backend (Google Apps Script): SELESAI dan LULUS SEMUA TEST OTOMATIS
  (dites via runFullTest() di editor Apps Script, 2026-09-05, hasil:
  "SEMUA TEST LULUS. Sistem siap dipakai.")
- Frontend (GitHub Pages): kode sudah lengkap (login.html, app.html, 4 file js)
  TAPI BELUM di-deploy ke GitHub Pages, dan API_URL di js/config.js masih
  placeholder — PERLU DIISI dengan URL Web App hasil deploy Apps Script.
- Spreadsheet: sudah dibuat dengan 13 sheet + data DUMMY (bukan data sekolah
  asli). Perlu diganti dengan data guru/kelas/siswa/jadwal sungguhan sebelum
  dipakai guru beneran.
- PERLU DIKONFIRMASI: apakah Apps Script Web App di langkah A7 (deploy)
  sudah benar-benar dijalankan dan URL-nya sudah didapat — user bilang test
  backend lulus (A4) tapi belum eksplisit konfirmasi sudah sampai A5-A8.

## ARSITEKTUR
```
GitHub Pages (HTML+CSS+JS) → Google Apps Script (Web App, bound ke Spreadsheet) → Google Spreadsheet (13 sheet)
```
- Apps Script BOUND ke Spreadsheet (bukan standalone) — akses lewat
  SpreadsheetApp.getActiveSpreadsheet(), tanpa Spreadsheet ID di kode.
- Autentikasi: token sederhana (32 char random) disimpan di PropertiesService
  dengan expiry. TIDAK ADA hash/SHA/enkripsi password — plain text sesuai
  keputusan eksplisit user (skala internal sekolah, prioritas kesederhanaan).
- 3 role: ADMIN, GURU, WALI_KELAS. Satu akun BISA multi-role
  (contoh: "GURU,WALI_KELAS" atau "GURU,ADMIN" untuk KS yang masih mengajar),
  disimpan sebagai string pisah koma di kolom role sheet 03_USER.
- Wali kelas TIDAK perlu role eksplisit WALI_KELAS jika sudah terdaftar
  sebagai wali_kelas_id di sheet 05_KELAS — sistem otomatis mendeteksi
  saat login dan menambahkan kelas_wali ke session.

## STRUKTUR SPREADSHEET (13 sheet)
01_CONFIG, 02_TAHUN_AJARAN, 03_USER, 04_GURU, 05_KELAS, 06_SISWA, 07_MAPEL,
08_JAM, 09_JADWAL, 10_JURNAL, 11_JURNAL_JAM, 12_KEHADIRAN, 13_LOG

Detail kolom setiap sheet ada di Master_Specification.md (lihat file upload).
Baris 1-2 tiap sheet = judul & subtitle (bukan data), baris 3 = header kolom,
data mulai baris 4. Semua fungsi baca (readSheet()) mengasumsikan struktur ini.

## KEPUTUSAN TEKNIS PENTING (JANGAN DIUBAH TANPA ALASAN KUAT)
1. Password PLAIN TEXT, tanpa hash — keputusan eksplisit user, bukan oversight
2. siswa_id DIHAPUS, NIS jadi primary key siswa (bukan kode S001 dst)
3. Jam pelajaran 1-9 TANPA waktu clock (tidak ada kolom waktu_mulai/selesai) —
   istirahat setelah jam 3 dan jam 6 HANYA penanda visual, bukan data tersimpan
4. Jam per hari: Senin-Rabu=9, Kamis=8, Jumat=4, Sabtu=0 (diatur di 01_CONFIG,
   bukan hardcode)
5. Konflik jadwal guru (guru sama, hari sama, jam sama, kelas beda):
   sistem MEMBERI WARNING tapi TETAP MENGIZINKAN guru mengisi jurnal —
   TIDAK PERNAH diblokir. Ini keputusan eksplisit user.
6. Data master (guru/kelas/siswa/mapel/jam/jadwal) dikelola MANUAL di
   Spreadsheet langsung — TIDAK ADA halaman admin create/update di web app.
   Ini keputusan sengaja untuk kesederhanaan, bukan fitur yang terlewat.
7. Guru TIDAK BISA ganti password sendiri — hanya admin lewat Spreadsheet
8. Batas edit jurnal dikontrol dari 01_CONFIG (BATAS_EDIT_HARI, default 7 hari)
9. Tanggal jurnal FLEKSIBEL — guru bisa isi untuk hari ini (default) atau
   tanggal lain yang sedang dilihat di date picker, bukan cuma hari ini

## BUG YANG SUDAH DITEMUKAN & DIPERBAIKI (jangan diulang polanya)
Total 5 bug ditemukan selama testing di sesi sebelumnya, SEMUA SUDAH FIXED:

1. actionGetJadwalHariIni return ok([]) alih-alih ok({jadwal:[]}) saat guru
   tidak punya guru_id → diperbaiki jadi object konsisten
2. TestSuite menyimpan response mentah actionLogin() sebagai "session" —
   padahal response login sengaja tidak menyertakan guru_id/username.
   Diperbaiki: ambil session PENUH via validateToken(token) setelah login,
   sama seperti yang dilakukan router asli di Code.gs
3. BUG PALING KRITIS: Google Sheets otomatis mengonversi string tanggal
   ("2099-01-01") jadi objek Date saat disimpan. readSheet() awalnya baca
   apa adanya, sehingga SEMUA perbandingan String(tanggal) === '...' di
   seluruh sistem gagal diam-diam (deteksi duplikat jurnal, filter jadwal,
   filter bulan, dll). DIPERBAIKI: readSheet() sekarang menormalkan Date
   object jadi string 'yyyy-MM-dd' (kolom 'tanggal') atau
   'yyyy-MM-dd HH:mm:ss' (kolom mengandung '_at'/'waktu'/'last_login').
4. REGRESI dari fix #3: readSheet() sempat memanggil configVal() untuk
   ambil timezone, tapi configVal()→getConfig()→readSheet('01_CONFIG')
   balik lagi ke readSheet() → REKURSI TAK BERUJUNG, skrip macet total.
   DIPERBAIKI: pakai Session.getScriptTimeZone() langsung, TIDAK PERNAH
   panggil configVal()/getConfig() dari dalam readSheet().
5. cleanupTestData() (fungsi test) sendiri kena bug yang sama seperti #3 —
   baca row[1] mentah tanpa normalisasi Date, jadi gagal menghapus sisa
   data test lama, menyebabkan test create jurnal berikutnya salah
   terdeteksi "duplikat" (padahal deteksi duplikatnya sendiri sudah benar).

PELAJARAN PENTING: fungsi pembaca data paling dasar (readSheet) TIDAK BOLEH
bergantung pada fungsi level lebih tinggi (getConfig) yang balik memanggilnya.
Setiap fungsi yang baca tanggal dari sheet harus lewat readSheet() yang sudah
dinormalisasi, JANGAN baca getValues() mentah secara langsung di tempat lain.

## STRUKTUR FILE
Apps Script (bound ke Spreadsheet, dikelola juga via clasp+GitHub):
- Utils.gs      — helper: readSheet (dengan normalisasi tanggal), appendToSheet,
                  updateRowById, nextId, getConfig+cache, writeLog, findBy, filterBy
- Auth.gs       — login, token di PropertiesService, hasRole (multi-role),
                  generateToken, validateToken, cleanupExpiredTokens
- Data.gs       — semua endpoint baca master data + jadwal + deteksi konflik +
                  groupJadwalBlok (kelompokkan jam berurutan jadi satu blok)
- Jurnal.gs     — createJurnal, updateJurnal, getJurnalSaya, getDetailJurnal
- Code.gs       — router doGet/doPost, semua action didaftarkan di sini
- TestSuite.gs  — runFullTest() (8 kategori test), cleanupTestData(),
                  cekSisaDataTest() (diagnostik read-only)
- appsscript.json — manifest (timezone Asia/Jakarta, webapp access ANYONE_ANONYMOUS)
- .clasp.json   — config untuk push kode via clasp CLI ke GitHub

Frontend (untuk GitHub Pages, repo smpmuda/lab):
- index.html    — landing page (sudah ada, desain navy/biru)
- login.html    — form login
- app.html      — shell SPA (topbar, role-switcher tab, bottom nav)
- js/config.js  — API_URL (MASIH PLACEHOLDER, perlu diisi URL Web App asli)
- js/api.js     — fetch wrapper (POST pakai text/plain agar hindari CORS preflight)
- js/auth.js    — session di sessionStorage, helper multi-role
- js/app.js     — SEMUA router & view dalam satu file (dashboard guru, form
                  jurnal, edit jurnal, detail jurnal, riwayat, jurnal kelas
                  untuk wali kelas, 3 halaman admin)

Dokumentasi:
- Master_Specification.md    — blueprint lengkap: kolom tiap sheet, endpoint API,
                                aturan bisnis, struktur file
- Master_Progress.md         — checklist detail per fase, HARUS DIUPDATE setiap
                                ada progres baru (ini permintaan eksplisit user)
- Panduan_Deploy_dan_Uji.md  — checklist step-by-step: Bagian A (setup Spreadsheet
                                +Apps Script), B (frontend+GitHub Pages),
                                C (10 skenario uji end-to-end), D (serah terima)

## YANG SUDAH SELESAI
✅ Spreadsheet 13 sheet dengan struktur final + data dummy realistis
✅ Backend Apps Script lengkap (5 file .gs) — SEMUA ENDPOINT SUDAH DIUJI LULUS
✅ Self-test suite komprehensif (TestSuite.gs) — 8 kategori, semua PASS
✅ Frontend lengkap secara kode (login, dashboard, form jurnal, edit jurnal,
   detail, riwayat, jurnal kelas wali kelas, 3 halaman admin)
✅ Fitur edit jurnal (sempat placeholder, sudah diselesaikan penuh)
✅ Panduan deploy & uji step-by-step yang sangat rinci
✅ Bagian A1-A4 dari panduan deploy (setup spreadsheet, Apps Script, test)
   SUDAH DIKERJAKAN USER dan LULUS

## YANG BELUM DIKERJAKAN / PERLU DIKONFIRMASI
- PERLU DIKONFIRMASI: apakah A5 (cleanupTestData final run), A6 (setupTriggers),
  A7 (Deploy Web App, dapat URL), A8 (test ping/getConfig dari browser) sudah
  dikerjakan atau belum
- BELUM: js/config.js diisi dengan URL Web App asli (masih placeholder)
- BELUM: upload semua file frontend ke repo GitHub smpmuda/lab
- BELUM: aktifkan GitHub Pages di repo tersebut
- BELUM: 10 skenario uji end-to-end (Bagian C di Panduan_Deploy_dan_Uji.md) —
  login 4 skenario role, isi jurnal, edit jurnal, ganti tanggal, riwayat,
  alur wali kelas, deteksi konflik jadwal (sengaja dibuat bentrok), alur admin,
  batas edit jurnal, logout+proteksi akses
- BELUM: ganti SEMUA data dummy dengan data sekolah asli (36 guru, 30 kelas,
  1000 siswa bertahap, jadwal lengkap 40 jam/kelas)
- BELUM: pelatihan/uji coba dengan guru sungguhan sebelum full rollout

## TAHAP BERIKUTNYA YANG SEHARUSNYA DIKERJAKAN
Urutan prioritas:
1. Konfirmasi status A5-A8 (kalau belum, lanjutkan dari situ)
2. Bagian B: isi API_URL di js/config.js, upload ke GitHub, aktifkan Pages
3. Bagian C: jalankan 10 skenario uji end-to-end dari HP/laptop sungguhan
4. Bagian D: ganti data dummy jadi data asli, uji dengan guru, serah terima

## PRINSIP YANG HARUS DIPERTAHANKAN
- Claude TIDAK PUNYA akses ke akun Google/GitHub user — semua langkah deploy
  manual harus dipandu, bukan diasumsikan sudah selesai
- Update Master_Progress.md SETIAP KALI ada progres baru (permintaan eksplisit)
- Kalau menemukan bug, TEST DULU asumsi "ini cuma di test doang atau bug
  produksi sungguhan" — riwayat sesi ini menunjukkan 4 dari 5 bug adalah
  bug produksi asli, bukan salah asumsi test semata
- Jangan mengubah keputusan teknis yang sudah difinalisasi (lihat daftar di
  atas) tanpa user secara eksplisit meminta perubahan
```

---

## BAGIAN 2 — PROJECT KNOWLEDGE

Rekomendasi item yang dimasukkan ke Project Knowledge (fitur "Project" di Claude, bukan per-chat):

| # | Nama/Topik | Isi Ringkas | Kenapa Perlu | Sifat |
|---|---|---|---|---|
| 1 | **Konteks Handover (Bagian 1 di atas)** | Seluruh blok di atas | Ini sumber kebenaran tunggal — tanpa ini, setiap chat baru harus digali ulang dari nol | Permanen, tapi **perlu di-update** tiap kali ada progres besar (deploy selesai, bug baru, dst) |
| 2 | **Master_Specification.md** | Blueprint kolom tiap sheet, daftar lengkap endpoint API, aturan bisnis | Referensi teknis yang sering dicek ulang saat menambah fitur baru | Cenderung permanen — hanya berubah kalau ada perubahan skema data/API |
| 3 | **Master_Progress.md** | Checklist detail per fase + catatan harian + tabel keputusan teknis + daftar bug&fix | Ini living document, harus selalu jadi rujukan status terkini | **Sering berubah** — upload versi terbaru tiap mulai chat baru, atau update manual di Project Knowledge |
| 4 | **Panduan_Deploy_dan_Uji.md** | Checklist step-by-step deploy dan 10 skenario uji | Dipakai berulang selama masih di fase deploy/testing/rollout | Permanen selama masih tahap ini — bisa diarsipkan setelah rollout selesai |

**Yang SEBAIKNYA TIDAK dimasukkan ke Project Knowledge:**
- **Kode sumber (.gs, .js, .html)** — Project Knowledge cocok untuk dokumen referensi yang dibaca, bukan kode yang akan diedit terus-menerus. Kode lebih baik di-upload sebagai file di chat yang sedang aktif mengerjakannya, supaya Claude bisa langsung `str_replace`/edit dan versinya selalu sinkron dengan yang sedang dikerjakan. Kalau kode taruh di Project Knowledge, risiko besar: Claude edit versi yang di-upload chat, tapi Project Knowledge tetap versi lama → membingungkan di chat berikutnya.
- **Data dummy/isi spreadsheet** — tidak relevan lintas chat, dan berpotensi besar (1000 siswa dst).

---

## BAGIAN 3 — FILE YANG PERLU DI-UPLOAD

### A. WAJIB di-upload ke chat baru
| File | Alasan |
|---|---|
| **Master_Progress.md** (versi TERBARU, sudah termasuk update pasca-test lulus) | Status paling akurat — chat baru harus tahu persis sudah sampai mana |
| **Konteks Handover (Bagian 1)** | Di-paste langsung sebagai teks pembuka chat, bukan file — tapi wajib ada |

### B. SEBAIKNYA di-upload (tergantung apa yang mau dikerjakan lanjut)
| File | Alasan |
|---|---|
| **Master_Specification.md** | Perlu kalau mau menambah fitur baru atau ubah struktur data — chat baru bisa cek kolom/endpoint tanpa nebak |
| **Panduan_Deploy_dan_Uji.md** | Perlu kalau lanjut ke Bagian B/C/D (deploy frontend, uji end-to-end, serah terima) — kalau justru mau nambah fitur baru dulu, ini belum krusial |
| **Semua file .gs** (Utils, Auth, Data, Jurnal, Code, TestSuite) | **Hanya perlu kalau** mau mengubah/menambah logika backend. Kalau sesi berikutnya murni soal deploy/testing frontend, tidak wajib upload ulang — cukup jelaskan di teks bahwa backend sudah final dan lulus test |
| **Semua file frontend** (login.html, app.html, js/*.js) | **Hanya perlu kalau** mau mengubah tampilan/fitur frontend. Kalau sesi berikutnya murni upload-ke-GitHub tanpa ubah kode, tidak wajib |

### C. TIDAK PERLU di-upload
| File/Item | Alasan |
|---|---|
| `JurnalMengajar_v2.xlsx` (spreadsheet dummy) | Data dummy tidak relevan lagi setelah tervalidasi — kalau perlu referensi struktur, cukup `Master_Specification.md` |
| `apps-script.zip`, `frontend.zip` (arsip lama) | Sudah digantikan versi file individual yang lebih baru; zip lama berpotensi membingungkan (versi mana yang benar) |
| Screenshot log Apps Script | Sudah dirangkum di Master_Progress.md, tidak perlu file gambar terpisah |
| `index.html` (landing page) | Kecuali mau mengubah desain landing page, ini stabil dan tidak krusial untuk pekerjaan lanjutan (deploy/testing) |

### ⚠️ PERINGATAN KEAMANAN — JANGAN PERNAH UPLOAD
- **URL Web App Apps Script** yang sudah di-deploy (mengandung deployment ID) — kalau perlu didiskusikan, oke disebut di teks chat biasa, tapi **jangan** ditaruh di Project Knowledge yang sifatnya lebih permanen/lintas-chat
- **Username & password akun user 03_USER** (meski cuma dummy) — kalau nanti sudah diganti data asli, JANGAN PERNAH upload sheet/file yang berisi kredensial guru asli
- **Isi data siswa asli** (NIS, nama lengkap) — data pribadi anak di bawah umur, hindari upload spreadsheet berisi data siswa sungguhan ke chat manapun
- File `.clasp.json` **setelah** diisi `scriptId` asli — script ID sebenarnya bukan rahasia besar tapi tidak perlu diekspos tanpa alasan
- Tidak ada `.env`/API key/token pihak ketiga di proyek ini sejauh yang saya lihat — arsitektur ini memang sengaja dirancang tanpa credential tersembunyi (itu salah satu alasan pilih Apps Script bound). Tapi tetap waspada kalau ke depan menambah integrasi lain (misal WhatsApp API, email service) yang butuh API key.

---

## BAGIAN 4 — STRUKTUR UPLOAD YANG PALING IDEAL

**Aturan sederhana:**

1. **Project Knowledge** = dokumen yang **dibaca sebagai referensi**, jarang diedit langsung oleh Claude, dan relevan di HAMPIR SEMUA chat lanjutan proyek ini → `Master_Progress.md`, `Master_Specification.md`, konteks handover.

2. **Upload di chat aktif** = file yang **akan diedit atau dibahas detail** di sesi itu juga → kalau mau lanjut ngoding backend, upload file `.gs` yang relevan; kalau mau bahas frontend, upload file frontend yang relevan. Tidak usah upload semuanya sekaligus "jaga-jaga".

3. **Cukup disebut di teks, tidak perlu upload** = fakta status singkat yang sudah terangkum di Master_Progress.md → misal "backend sudah lulus semua test" tidak perlu bukti file log, cukup pernyataan (karena sudah tercatat di Progress).

**Patokan cepat sebelum upload sesuatu:**
> "Apakah file ini akan AKTIF DIUBAH atau DIBACA DETAIL di sesi ini?"
> - Ya → upload di chat
> - Tidak, tapi jadi konteks umum yang sering dicek → Project Knowledge
> - Tidak keduanya → jangan upload, cukup disebut di teks

---

## BAGIAN 5 — PROMPT PEMBUKA CHAT BARU

```
Aku melanjutkan proyek "Jurnal Mengajar" (SMP Muhammadiyah 2 Cilacap) dari
chat sebelumnya. Konteks lengkap ada di bawah ini dan/atau di Project
Knowledge (Master_Progress.md, Master_Specification.md).

TOLONG LAKUKAN INI DULU sebelum mengerjakan apapun:
1. Baca seluruh konteks handover yang aku berikan (di bawah, atau di Project
   Knowledge) sampai benar-benar paham kondisi proyek saat ini
2. Cek file yang aku upload di chat ini (kalau ada) — sesuaikan dengan yang
   disebut di handover, dan tanya kalau ada yang tidak jelas atau kurang
3. JANGAN mengulang pekerjaan yang sudah selesai — backend Apps Script SUDAH
   LULUS SEMUA TEST OTOMATIS, jangan menyarankan menulis ulang dari nol
4. Validasi dulu status sebenarnya: tanya aku secara eksplisit apakah langkah
   deploy (A5-A8 di Panduan_Deploy_dan_Uji.md) sudah dikerjakan atau belum,
   jangan berasumsi
5. Setelah paham kondisi dan tervalidasi, baru lanjutkan ke tahap berikutnya
   sesuai urutan prioritas yang tercantum di bagian "TAHAP BERIKUTNYA" pada
   handover

Kalau ada bagian dari handover yang menurutmu ambigu atau kurang informasi
untuk melanjutkan dengan aman, tanyakan dulu — jangan menebak atau
mengasumsikan sesuatu yang tidak disebutkan eksplisit.

[TEMPEL KONTEKS HANDOVER BAGIAN 1 DI SINI]
```
