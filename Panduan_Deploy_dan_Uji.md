# Panduan Deploy & Uji — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**

Ikuti urutan ini persis. Setiap langkah ada cara verifikasinya sendiri —
jangan lanjut ke langkah berikutnya kalau verifikasi gagal.

> **CATATAN UNTUK YANG SUDAH PERNAH DEPLOY SEBELUMNYA (update 2026-09-08, PUTARAN KE-3 — cache client-side):**
> Ada perubahan lagi di backend (`Data.gs`, `Utils.gs`, `Code.gs` — trigger `onEdit` baru + field `data_version`)
> dan frontend (file baru `js/cache.js`, `app.js` & `app.html` diubah). Anda **wajib**:
> 1. Timpa ulang **SEMUA** file `.gs` di Apps Script editor (bukan cuma yang disebut di catatan sebelumnya)
> 2. Jalankan ulang `runFullTest()` — ada test baru `testDataVersionCache()`
> 3. **PENTING**: setelah deploy pertama kali dengan versi ini, buka sheet `01_CONFIG` sekali dan pastikan baris `DATA_VERSION` muncul otomatis (dibuat sendiri oleh sistem saat pertama kali ada yang mengedit sheet master data, atau saat `runFullTest()` dijalankan) — kalau setelah beberapa hari baris ini belum juga muncul, kabari untuk diperiksa
> 4. Timpa ulang seluruh isi folder `frontend/` di GitHub, termasuk file baru `js/cache.js`
> 5. **Test WAJIB**: jalankan skenario C8.9 (test cache & trigger `onEdit`) — ini fitur baru yang paling berisiko kalau ada yang tidak sesuai harapan

---

## BAGIAN A — Setup Spreadsheet & Apps Script

### A1. Upload Spreadsheet
- [ ] Buka [Google Drive](https://drive.google.com)
- [ ] Upload `JurnalMengajar_v2.xlsx`
- [ ] Klik kanan file → **Buka dengan → Google Sheets** (convert ke format Sheets)
- [ ] Rename file jadi misalnya **"DB_JurnalMengajar"**

**Verifikasi:** buka file, pastikan 13 sheet semua muncul di tab bawah.

---

### A2. Buat Apps Script Terikat (Bound)
- [ ] Di spreadsheet yang sama, klik **Extensions → Apps Script**
- [ ] Ini akan membuka editor baru, otomatis terhubung ke spreadsheet ini
- [ ] Hapus semua isi file `Code.gs` bawaan (kosongkan)

**Verifikasi:** judul project di kiri atas biasanya "Untitled project" — rename jadi **"Jurnal Mengajar - Backend"** (klik judulnya).

---

### A3. Masukkan 6 File Kode

Buat file baru untuk masing-masing (klik ikon **+** di sebelah "Files" → Script):

- [ ] `Utils.gs` — paste isi dari file yang sama
- [ ] `Auth.gs`
- [ ] `Data.gs`
- [ ] `Jurnal.gs`
- [ ] `Code.gs` (paste ke file Code.gs yang sudah dikosongkan tadi)
- [ ] `TestSuite.gs`

Juga update manifest:
- [ ] Klik ikon ⚙️ (Project Settings) → centang **"Show appsscript.json manifest file in editor"**
- [ ] Buka `appsscript.json`, ganti isinya dengan file `appsscript.json` yang disediakan

**Verifikasi:** total ada 7 file di panel kiri (6 `.gs` + 1 `appsscript.json`). Klik **Save** (ikon disket atau Ctrl+S).

---

### A4. Jalankan Self-Test PERTAMA KALI

- [ ] Di dropdown fungsi (toolbar atas, biasanya bertuliskan nama fungsi), pilih **`runFullTest`**
- [ ] Klik tombol **▶ Run**
- [ ] **PENTING:** Akan muncul dialog minta izin (authorization) — klik **Review permissions**
  - Pilih akun Google kamu
  - Akan ada warning "Google hasn't verified this app" → klik **Advanced** → **Go to Jurnal Mengajar - Backend (unsafe)**
  - Klik **Allow**
- [ ] Setelah selesai jalan, buka **View → Logs** (atau `Ctrl+Enter`)

**Verifikasi — baca log baris demi baris:**
- Semua baris `01_CONFIG` sampai `13_LOG` harus **✅ PASS**
- Bagian **LOGIN SEMUA ROLE** — minimal "Guru biasa" harus ✅ PASS
- Kalau ada **❌ FAIL**, catat pesannya — biasanya berarti data di sheet belum lengkap (lihat Bagian B)

> Kalau banyak yang FAIL karena "tidak ada user dengan role ini" — itu normal jika kamu belum isi semua jenis akun di `03_USER`. Minimal harus ada 1 akun GURU yang valid untuk lanjut testing.

---

### A5. Bersihkan Data Test

- [ ] Di dropdown fungsi, pilih **`cleanupTestData`**
- [ ] Klik **▶ Run**
- [ ] Cek sheet `10_JURNAL` — baris dengan tanggal `2099-xx-xx` atau `[TEST OTOMATIS]` harus sudah hilang

---

### A6. Setup Trigger Harian

- [ ] Di dropdown fungsi, pilih **`setupTriggers`**
- [ ] Klik **▶ Run**
- [ ] Cek ikon ⏰ (Triggers) di panel kiri — harus ada 1 trigger `cleanupExpiredTokens` jalan tiap hari jam 3 pagi

---

### A7. Deploy sebagai Web App

- [ ] Klik tombol **Deploy → New deployment** (kanan atas)
- [ ] Klik ikon ⚙️ di sebelah "Select type" → pilih **Web app**
- [ ] Isi:
  - Description: `v1.0.0 - initial deploy`
  - Execute as: **Me (email kamu)**
  - Who has access: **Anyone**
- [ ] Klik **Deploy**
- [ ] **COPY URL Web App** yang muncul (formatnya `https://script.google.com/macros/s/XXXXXXXX/exec`)

**Simpan URL ini — akan dipakai di langkah B.**

---

### A8. Test URL Langsung dari Browser

- [ ] Buka tab baru, paste: `[URL_WEB_APP]?action=ping`
- [ ] Harus muncul JSON: `{"ok":true,"data":{"status":"ok","ts":"..."}}`

**Kalau muncul halaman login Google atau error 403** → cek lagi "Who has access" di deployment settings harus **Anyone**, bukan "Anyone with Google account".

- [ ] Test lagi: `[URL_WEB_APP]?action=getConfig`
- [ ] Harus muncul data nama sekolah dalam JSON

---

## BAGIAN B — Setup Frontend (GitHub Pages)

### B1. Masukkan URL API ke config.js

- [ ] Buka file `js/config.js`
- [ ] Ganti baris `API_URL` dengan URL dari langkah A7:
```js
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/URL_KAMU_DI_SINI/exec",
  APP_NAME: "Jurnal Mengajar",
  VERSION: "1.0.0"
};
```

---

### B2. Upload ke Repo GitHub

- [ ] Buka repo `smpmuda/lab`
- [ ] Upload semua file: `index.html`, `login.html`, `app.html`, folder `js/` (4 file di dalamnya), `Master_Specification.md`, `Master_Progress.md`
- [ ] Pastikan struktur folder benar:
```
lab/
├── index.html
├── login.html
├── app.html
├── js/
│   ├── config.js
│   ├── api.js
│   ├── auth.js
│   └── app.js
├── Master_Specification.md
└── Master_Progress.md
```

---

### B3. Aktifkan GitHub Pages

- [ ] Di repo → **Settings → Pages**
- [ ] Source: **Deploy from a branch**
- [ ] Branch: **main** (atau branch utama kamu), folder **/ (root)**
- [ ] Klik **Save**
- [ ] Tunggu 1-2 menit, cek `smpmuda.github.io/lab` sudah bisa diakses

---

## BAGIAN C — Uji Menyeluruh (End-to-End)

Lakukan di HP dan laptop, idealnya oleh orang berbeda untuk tiap role.

### C1. Test Login — 3 Role

| Role | Username uji | Password | Yang diharapkan |
|---|---|---|---|
| Guru biasa | `budi_s` | `budi123` | Masuk ke Dashboard, lihat jadwal hari ini |
| Guru + Wali Kelas | `siti_a` | `siti123` | Masuk, ada tab switcher "Guru" / "Wali Kelas" |
| Guru + Admin | `andi_w` | `andi123` | Masuk, ada tab switcher "Guru" / "Admin" |
| Admin murni | `admin` | `admin123` | Masuk langsung ke Beranda Admin |

- [ ] Semua 4 akun bisa login tanpa error
- [ ] Coba login dengan password salah → muncul pesan error, tidak masuk
- [ ] Coba login dengan username tidak ada → muncul pesan error

---

### C2. Test Alur Guru — Isi Jurnal

Login sebagai `budi_s`:

- [ ] Dashboard menampilkan jadwal (cek tanggal `2026-09-07` — Senin, harus ada jadwal 7A Informatika Jam 1-2)
- [ ] Klik salah satu blok jadwal yang **belum diisi**
- [ ] Form muncul dengan kelas/mapel/jam sudah terisi otomatis
- [ ] Isi ringkasan kegiatan (contoh: "Uji coba sistem jurnal digital")
- [ ] Coba klik Simpan **tanpa isi ringkasan** → harus muncul peringatan, tidak tersimpan
- [ ] Isi ringkasan, ubah beberapa siswa jadi Sakit/Izin/Alpa
- [ ] Klik **Simpan Jurnal**
- [ ] Harus kembali ke dashboard, blok tadi sekarang bertanda **✓ Sudah diisi**
- [ ] Klik blok yang sudah diisi → muncul halaman detail dengan rekap kehadiran benar

---

### C3. Test Edit Jurnal

- [ ] Dari halaman detail jurnal yang baru dibuat, klik **Edit Jurnal Ini**
- [ ] Ubah ringkasan kegiatan
- [ ] Ubah status salah satu siswa
- [ ] Klik **Simpan Perubahan**
- [ ] Kembali ke detail, pastikan perubahan tersimpan

---

### C4. Test Ganti Tanggal

- [ ] Di Dashboard, ubah date picker ke tanggal lain (misal kemarin atau besok)
- [ ] Pastikan jadwal yang muncul sesuai hari itu (Senin/Selasa/dst sesuai `09_JADWAL`)
- [ ] Klik **Hari Ini** → kembali ke tanggal sekarang

---

### C5. Test Jurnal Saya (Riwayat)

- [ ] Klik tab **Jurnal Saya** (bottom nav)
- [ ] Jurnal yang baru dibuat harus muncul di list, urut dari terbaru
- [ ] Klik salah satu → masuk ke detail

---

### C6. Test Wali Kelas

Login sebagai `siti_a` (guru + wali kelas):

- [ ] Muncul tab switcher di atas — klik **Wali Kelas**
- [ ] Halaman **Jurnal Kelas** muncul, otomatis untuk kelas yang diampu
- [ ] Kalau ada jurnal yang sudah diisi guru mapel lain hari itu, harus tampil sebagai kartu dengan rekap kehadiran
- [ ] Ubah tanggal, pastikan data ikut berubah

---

### C7. Test Deteksi Konflik Jadwal

Ini butuh data sengaja dibuat bentrok di sheet `09_JADWAL`:

- [ ] Di spreadsheet, tambahkan 1 baris jadwal baru: guru yang sama, hari sama, jam sama, tapi kelas berbeda dari jadwal yang sudah ada
- [ ] Login sebagai guru tersebut, buka Dashboard di hari itu
- [ ] Kedua blok (kelas A dan kelas B) di jam yang sama harus muncul dengan **badge kuning "⚠ Jam ini juga terdapat di kelas lain"**
- [ ] Pastikan guru tetap **bisa** mengisi salah satu jurnal (tidak diblokir)
- [ ] Hapus baris jadwal test ini setelah selesai

---

### C8. Test Admin

Login sebagai `admin`:

- [ ] Halaman Beranda muncul dengan menu **Semua Jurnal** dan **Log Aktivitas**
- [ ] Klik **Semua Jurnal** → semua jurnal dari semua guru muncul
- [ ] Klik salah satu → detail muncul (admin bisa lihat semua, bukan cuma miliknya)
- [ ] Klik **Log Aktivitas** → riwayat LOGIN, CREATE, UPDATE muncul dengan waktu yang benar

---

### C8.5. Test Fitur Admin Baru — Filter Jurnal & Jadwal per Guru

Login sebagai `admin`:

- [ ] Beranda sekarang punya 3 menu: **Semua Jurnal**, **Jadwal per Guru**, **Log Aktivitas**
- [ ] Buka **Semua Jurnal** → ada form filter (Tanggal wajib, dropdown Guru, dropdown Mapel) + tombol **Cari**
- [ ] Coba hapus tanggal lalu klik **Cari** → harus muncul toast "Tanggal wajib diisi" (tidak mengirim request)
- [ ] Isi tanggal hari ini, pilih salah satu guru dari dropdown, klik **Cari** → hanya jurnal guru tsb yang muncul
- [ ] Kalau jurnal di tanggal itu lebih dari 25 (pageSize default), tombol pagination **Sebelumnya/Selanjutnya** muncul di bawah hasil dan berfungsi
- [ ] Buka **Jadwal per Guru** → pilih guru dari dropdown → jadwal mengajar guru tsb muncul dikelompokkan per hari SENIN–SABTU, hari tanpa jadwal ditampilkan sebagai kartu pudar "Tidak ada jadwal"

---

### C8.6. Test Menu "Jadwal Kelas" (Dalam Aplikasi, Login GURU/WALI_KELAS)

- [ ] Login sebagai guru atau wali kelas → bottom nav punya item **Jadwal Kelas** (ikon 🏫/🗓️)
- [ ] Klik → muncul dropdown Pilih Kelas + Pilih Hari (default: hari ini)
- [ ] Pilih kelas & hari lain → daftar mapel, guru pengajar, dan jam pelajaran muncul, **TANPA** data kehadiran/jurnal
- [ ] Pilih kelas yang tidak punya jadwal di hari tsb → muncul pesan "Tidak ada jadwal pada hari ini"

---

### C8.7. Test Halaman Publik "Jadwal Kelas" (TANPA Login)

- [ ] Buka `index.html`, pastikan tombol **Masuk ke Aplikasi** dan **Baca Spesifikasi** SEKARANG BISA DIKLIK (bug sebelumnya sudah diperbaiki)
- [ ] Klik **🗓️ Lihat Jadwal Kelas** di homepage
- [ ] Halaman `jadwal-publik.html` terbuka **tanpa diminta login sama sekali**
- [ ] Dropdown kelas otomatis terisi, hari default = hari ini
- [ ] Pilih kelas & hari → jadwal (mapel/guru/jam) muncul tanpa kehadiran
- [ ] Buka halaman ini di mode **incognito/browser lain yang belum pernah login** → harus tetap berfungsi normal (membuktikan benar-benar publik)
- [ ] Tombol **← Beranda** kembali ke `index.html`

---

### C8.8. Test Skema Kehadiran Baru (Default Hadir) & Grid Form

- [ ] Login sebagai guru, buka jadwal yang belum diisi → klik kartu jadwal
- [ ] Form terbuka dengan layout **Kelas | Tanggal** berdampingan (grid 2 kolom), Mapel di bawahnya full-width
- [ ] Bagian "Jam Pelajaran" menampilkan **semua jam** hari itu (bukan cuma jam yang sedang terjadwal) — jam asli sudah ter-highlight terpilih, guru bisa tambah/kurangi pilihan
- [ ] Daftar siswa: semua **default berwarna hijau (Hadir)** — guru TIDAK perlu klik satu-satu untuk menandai hadir
- [ ] Klik 1-2 siswa untuk ubah ke Sakit/Izin/Alpa → klik **Simpan Jurnal**
- [ ] Buka detail jurnal tsb → rekap kehadiran menunjukkan angka Hadir = total − (jumlah yang ditandai tidak hadir), dan daftar "Tidak Hadir" hanya berisi siswa yang memang ditandai
- [ ] (Opsional, untuk admin/pemilik Spreadsheet) Cek langsung sheet `12_KEHADIRAN` — jumlah baris baru yang masuk harus sama dengan jumlah siswa yang ditandai tidak hadir, BUKAN sejumlah total siswa kelas

---

### C8.9. Test Cache Client-Side (localStorage) & Trigger `onEdit`

**Bagian ini WAJIB diuji** — ini fitur baru yang menyentuh cara app mengambil data master.

**Cek dasar cache jalan:**
- [ ] Login, buka menu manapun yang pakai data master (mis. **Jurnal Kelas** wali kelas, atau **Admin → Jadwal per Guru**) — catat lama loading pertama kali
- [ ] Keluar dari menu itu lalu masuk lagi (atau reload halaman) → loading kedua kalinya harus terasa **instan** (data diambil dari cache lokal, bukan fetch ulang ke server)
- [ ] Buka DevTools browser (F12) → tab **Application/Storage → Local Storage** → domain app Anda → harus terlihat key berawalan `jm_cache_` (mis. `jm_cache_guru`, `jm_cache_kelas`) dan `jm_cache_version`

**Cek trigger `onEdit` otomatis menaikkan versi:**
- [ ] Buka Spreadsheet langsung, cari sheet `01_CONFIG` → cari baris `DATA_VERSION`, catat angkanya (kalau belum ada barisnya, berarti belum pernah ke-trigger — lanjut ke langkah berikut dulu)
- [ ] Edit satu sel apa saja di sheet `04_GURU` (mis. ubah lalu kembalikan lagi nama guru) → simpan
- [ ] Cek lagi sheet `01_CONFIG` → angka `DATA_VERSION` harus naik 1 dari sebelumnya (butuh beberapa detik, trigger jalan di background)
- [ ] Ulangi untuk sheet `05_KELAS`, `06_SISWA`, `07_MAPEL`, `09_JADWAL` — masing-masing harus ikut menaikkan `DATA_VERSION`
- [ ] **Sebagai pembanding**: edit sesuatu di `10_JURNAL` atau `13_LOG` → `DATA_VERSION` **TIDAK BOLEH** ikut naik (sheet transaksional sengaja tidak memicu trigger ini)

**Cek cache otomatis refresh setelah versi berubah:**
- [ ] Setelah `DATA_VERSION` naik (dari langkah di atas), buka/reload app di browser yang sebelumnya sudah login → cache lama otomatis terhapus, data diambil ulang dari server (loading pertama terasa seperti biasa lagi, bukan instan)
- [ ] Cek DevTools Local Storage lagi → `jm_cache_version` sudah update ke angka baru yang sama dengan `DATA_VERSION` di sheet

**Cek tombol sinkronisasi manual:**
- [ ] Klik ikon 🔄 di pojok kanan atas header (sebelah tombol Keluar) — ikon berputar sesaat, lalu muncul toast "Data berhasil disinkronkan"
- [ ] Cek DevTools Local Storage → semua key `jm_cache_*` sebelumnya sudah bersih/terisi ulang dengan data baru
- [ ] Tombol ini harus muncul dan berfungsi untuk **semua role** (Guru, Wali Kelas, Admin), tidak cuma admin

**Cek gagal-aman (opsional, teknikal):**
- [ ] Buka browser dalam mode Incognito/Private (localStorage biasanya tetap jalan di mode ini di kebanyakan browser modern, tapi coba juga browser dengan localStorage benar-benar dimatikan lewat pengaturan privasi jika memungkinkan) → app harus tetap bisa dipakai normal, hanya saja setiap buka menu akan selalu fetch ulang (tanpa manfaat cache, tapi TIDAK boleh muncul error)

---

### C9. Test Batas Edit Jurnal


- [ ] Di sheet `01_CONFIG`, ubah `BATAS_EDIT_HARI` dari `7` jadi `0`
- [ ] Login sebagai guru, buka jurnal yang dibuat hari ini
- [ ] Tombol **Edit Jurnal Ini** harus **hilang** (karena sudah lewat batas 0 hari)
- [ ] Kembalikan `BATAS_EDIT_HARI` ke `7`

---

### C10. Test Logout & Session Expired

- [ ] Klik **Keluar** di pojok kanan atas
- [ ] Harus kembali ke halaman login
- [ ] Coba akses `app.html` langsung dari URL tanpa login → harus redirect ke login

---

## BAGIAN D — Checklist Sebelum Serah Terima ke Guru

- [ ] Semua akun guru asli sudah dibuat di `03_USER` dan `04_GURU` (bukan data dummy)
- [ ] Semua kelas asli + wali kelas sudah benar di `05_KELAS`
- [ ] Jadwal mingguan lengkap sudah diinput di `09_JADWAL`
- [ ] Minimal data siswa untuk kelas yang aktif dipakai sudah ada di `06_SISWA`
- [ ] `01_CONFIG` sudah diisi data sekolah asli (bukan dummy)
- [ ] Data dummy/test di `10_JURNAL`, `11_JURNAL_JAM`, `12_KEHADIRAN` sudah dibersihkan (`cleanupTestData()`)
- [ ] Link aplikasi (`smpmuda.github.io/lab`) sudah dites bisa dibuka dari HP guru (bukan cuma laptop)
- [ ] Minimal 2-3 guru sudah dicoba langsung tanya "gampang dipakai atau bingung?"

---

## Troubleshooting Umum

| Gejala | Kemungkinan Penyebab | Solusi |
|---|---|---|
| `ping` return error 403 | Deployment access bukan "Anyone" | Deploy ulang, pilih Anyone |
| Login selalu gagal padahal password benar | Username di sheet ada spasi/beda kapital | Cek `03_USER`, username dibandingkan lowercase otomatis tapi cek spasi tersembunyi |
| Dashboard guru kosong padahal ada jadwal | `tahun_id` di jadwal beda dengan `TAHUN_AKTIF` di config | Samakan `TAHUN_AKTIF` di `01_CONFIG` dengan `tahun_id` di `09_JADWAL` |
| Jam tidak urut / label salah | ID jam tidak konsisten (`J1` vs `J01`) | Pastikan semua pakai format `J01`, `J02`, dst (2 digit) |
| CORS error di console browser | Jarang terjadi karena pakai `text/plain`, tapi jika muncul | Pastikan `API_URL` benar, tidak ada typo/trailing slash |
| Wali kelas tidak lihat kelasnya | `wali_kelas_id` di `05_KELAS` tidak cocok `guru_id` user | Cek ejaan ID persis sama |
| Perubahan kode tidak muncul di aplikasi | Lupa re-deploy setelah edit Apps Script | Deploy → Manage deployments → Edit (pensil) → New version → Deploy |

