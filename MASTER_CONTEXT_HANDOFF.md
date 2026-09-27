# MASTER CONTEXT HANDOFF — Jurnal Mengajar
**SMP Muhammadiyah 2 Cilacap**
Diperbarui: 2026-09-22 — RESUME UNTUK CHAT BARU (chat sebelumnya dihentikan karena sudah terlalu panjang, BUKAN karena pekerjaan belum selesai)

---

## BACA INI DULU

Dokumen ini BUKAN ringkasan biasa — perlakukan sebagai fakta yang sudah
terjadi, tidak perlu diverifikasi ulang dari nol dan tidak perlu membaca
ulang riwayat chat sebelumnya. Baca dokumen ini + `Master_Progress.md`
(bagian tanggal PALING BARU ada di paling BAWAH file, sebelum bagian
"Keputusan Teknis Penting") untuk detail teknis lengkap tiap perubahan.

Backend (`.gs`) HANYA boleh diubah dengan izin eksplisit dari user.
Perubahan frontend yang cukup besar juga sebaiknya dikonfirmasi dulu.
Kalau user minta perubahan LAYOUT/STRUKTUR PDF atau UI yang cukup besar,
pola yang sudah terbukti berhasil di proyek ini: **tanya detail dulu
(boleh minta sketsa/contoh) sebelum mulai coding**, jangan langsung
menebak — beberapa kali sesi sebelumnya harus diulang karena
implementasi pertama salah paham maksud user.

---

## RINGKASAN PROYEK

Aplikasi jurnal mengajar digital untuk sekolah — Google Apps Script
(backend, terhubung ke Google Spreadsheet sebagai database) + GitHub
Pages (frontend statis, HTML/CSS/JS vanilla tanpa framework). Menggantikan
jurnal kertas manual. 3 peran pengguna: **GURU** (isi jurnal harian),
**WALI_KELAS** (pantau jurnal & kehadiran kelas yang diampu — biasanya
guru yang merangkap), **ADMIN** (kelola data master, pantau semua jurnal,
atur konfigurasi — dipakai juga oleh Kepala Sekolah, tidak ada role
terpisah untuk Kepsek).

**Struktur folder proyek:**
- `apps-script/*.gs` — backend (Auth, Code=router, Data, Jurnal, Utils, TestSuite)
- `frontend/*.html` + `frontend/js/*.js` — frontend (app.html=SPA utama,
  index.html, login.html, jadwal-publik.html=halaman publik tanpa login)
- `frontend/robots.txt` — blokir indexing mesin pencari
- `materi-sosialisasi/` — **[BARU 22 Sept]** materi presentasi, TERPISAH
  dari kode aplikasi
- `Master_Progress.md` — log lengkap SETIAP perubahan per tanggal (baca
  dari bawah untuk yang terbaru)
- `Panduan_Deploy_dan_Uji.md` — cara upload ke Apps Script/GitHub Pages
  + catatan test manual per update
- `Master_Specification.md` — spesifikasi awal (bisa sudah agak usang
  dibanding `Master_Progress.md`, tapi masih berguna untuk konteks skema
  data/sheet)
- `MASTER_CONTEXT_HANDOFF.md` — dokumen ini

**Cara kerja setiap sesi sebelumnya (ikuti pola ini):** user melaporkan
bug/minta fitur → analisis kode yang ada → implementasi → `node --check`
semua file `.gs`/`.js` yang berubah + cek balance div/brace HTML kalau
`app.html` berubah → update `Master_Progress.md` (tambah bagian baru,
JANGAN timpa yang lama) + `MASTER_CONTEXT_HANDOFF.md` (bagian STATUS) +
`Panduan_Deploy_dan_Uji.md` (catatan update) → zip seluruh folder proyek
→ `present_files`. User TIDAK PUNYA akses Claude Code/terminal — semua
verifikasi lewat `node --check` di sandbox Claude sendiri, user hanya
upload-timpa file ke Apps Script editor & GitHub Pages secara manual.

---

## STATUS SAAT INI

**Sesi 2026-09-22 (sesi ini):** user minta materi sosialisasi (PPTX)
untuk guru/wali kelas/admin & kepala sekolah. **SUDAH SELESAI**:
`materi-sosialisasi/Sosialisasi_Jurnal_Mengajar.pptx`, 29 slide, dibuat
pakai skill pptx (pptxgenjs) + ikon react-icons dirender ke PNG lalu
ditempel di lingkaran warna. Sudah di-QA render 4 slide (cover, langkah
isi jurnal, highlight fitur Prompt AI, hal-hal penting) — semua rapi.
Detail lengkap struktur 29 slide ada di `Master_Progress.md` bagian
**"2026-09-22 — Materi Sosialisasi (PPTX)"**. **Ini file terpisah dari
aplikasi — TIDAK ADA perubahan kode aplikasi di sesi ini**, jadi tidak
ada yang perlu di-deploy ulang untuk bagian ini.

**Sesi-sesi sebelumnya (13 Sept s.d. 21 Sept)** sudah membangun & terus
menyempurnakan seluruh aplikasi — semua kode SUDAH DIKIRIM ke user lewat
zip di tiap sesi, TAPI **belum ada konfirmasi eksplisit dari user bahwa
SEMUANYA sudah di-deploy & dites** kecuali yang disebutkan di bagian
"YANG SUDAH DIKONFIRMASI USER" di bawah. Jangan asumsikan sudah beres —
kalau ragu, tanyakan status deploy/test ke user di awal chat baru.

---

## YANG SUDAH DIKONFIRMASI USER (hasil test dari sesi-sesi sebelumnya)

- Login terasa lebih cepat setelah optimasi (hapus write `last_login`
  yang tidak terpakai) — dikonfirmasi 20 Sept.
- Layout PDF portrait A4 margin sempit, 1 baris per sesi, kolom kiri
  70% materi+catatan / kanan 30% kehadiran, header rata tengah —
  dikonfirmasi bagus, lalu diminta 2 penyempurnaan lanjutan (lihat
  riwayat bug-fix di bawah).
- Fitur "Salin Prompt AI" — sudah dipakai, TAPI user berencana minta
  perbaikan kualitas hasilnya (lihat "RENCANA FITUR BERIKUTNYA").

**BELUM ada konfirmasi test untuk:** fitur Export Jadwal Mingguan (Guru
& Kelas) dari 21 Sept, fix kolom Kehadiran "bebas tumbuh" dari 21 Sept,
fix nama siswa tidak hadir (NIS lookup + status matching longgar) dari
20 Sept, dan 2-tab UI dari 19 Sept.

---

## RIWAYAT SINGKAT BUG-FIX PENTING (kronologis, detail lengkap di Master_Progress.md)

Beberapa bug/keputusan desain yang PENTING diketahui supaya tidak
diulang atau salah diasumsikan sudah beres:

1. **Bug `isAktif` (13 & 15 Sept):** kolom `aktif` di sheet manapun
   BOLEH berisi boolean checkbox ATAU teks "TRUE"/"FALSE" — kode HARUS
   selalu pakai helper `isAktif(val)` dari `Utils.gs`, JANGAN PERNAH
   tulis `=== 'TRUE'` atau `!== 'TRUE'` manual. Ini juga berlaku untuk
   config lain seperti `IZIN_EDIT_JURNAL` di `01_CONFIG`, bukan cuma
   kolom `aktif` — pelajaran dari bug tersembunyi yang baru ketemu 15 Sept.
2. **NIS siswa bisa beda tipe data** antar sheet (`12_KEHADIRAN` vs
   `06_SISWA` — angka murni vs teks dengan leading zero). Helper
   `_nisKey()`/`_indexSiswaByNis()` di `Jurnal.gs` menormalkan ini —
   dipakai untuk lookup nama siswa tidak hadir. Untuk rekap KELAS,
   pencarian nama HARUS dari SELURUH `06_SISWA` (bukan cuma siswa aktif
   kelas itu), supaya siswa yang sudah nonaktif/pindah kelas tapi punya
   riwayat kehadiran tetap ketemu namanya (20 Sept).
3. **Status kehadiran (Sakit/Izin/Alpa) dicocokkan LONGGAR** ("dimulai
   dengan", via `_normalisasiStatusKehadiran` backend & `_pdfKelompokkanTidakHadir`
   frontend) — BUKAN exact match — supaya tahan terhadap variasi kecil
   penulisan di data (spasi, "Alpha" vs "Alpa", dst). Exact match
   sebelumnya bikin nama siswa tidak hadir GAGAL TAMPIL SAMA SEKALI
   kalau string status meleset sedikit (20 Sept, ditemukan dari
   screenshot user).
4. **Kolom Kehadiran di PDF rekap jurnal TIDAK dibatasi tinggi materi**
   — sempat dicoba 2 pendekatan (tinggi tetap konstanta → lalu "plafon
   dari tinggi teoritis materi 700+catatan 200 karakter"), KEDUANYA
   ditolak user karena tetap memotong nama padahal ruang halaman
   longgar. Desain FINAL (21 Sept): kolom Kehadiran BEBAS tumbuh sesuai
   kebutuhan (tampilkan SEMUA nama), tinggi baris = tinggi kolom mana
   pun yang lebih besar. Blur/fade cuma katup pengaman mutlak di 420pt
   (`PDF_KEHADIRAN_MAKS_ABSOLUT`), nyaris tidak pernah kena di
   pemakaian normal. **JANGAN kembalikan ke pendekatan "plafon dari
   materi" — sudah 2x ditolak user.**
5. **Log (`13_LOG`) dibatasi retensi 90 hari** lewat trigger harian
   `cleanupLogLama()` (jam 4 pagi) — kalau belum jalan, user perlu
   jalankan `setupTriggers()` manual sekali di Apps Script editor.

---

## RENCANA FITUR BERIKUTNYA — sudah diberitahukan user, BELUM DIKERJAKAN SAMA SEKALI

User bilang di akhir sesi sebelumnya akan lanjut ke 3 hal ini:

1. **Export Jurnal BULANAN untuk Guru** — dikelompokkan per PERTEMUAN
   guru di tiap KELAS+MAPEL (bukan per-hari/per-minggu seperti rekap
   yang sudah ada sekarang). Kemungkinan bentuknya: 1 bagian per
   kombinasi kelas+mapel, berisi daftar semua tanggal pertemuan bulan
   itu beserta materi/kehadiran masing-masing.
2. **Export Jurnal KELAS Bulanan** — serupa tapi dikelompokkan per MATA
   PELAJARAN (bukan per kelas+mapel seperti guru, karena kelasnya sudah
   pasti 1). Kemungkinan besar berbagi banyak logic dengan poin 1.
3. **Perbaikan prompt AI default** — `buildPromptJurnalGuru`/
   `buildPromptJurnalKelas` (`frontend/js/app.js`) perlu disempurnakan
   supaya hasil dokumen dari ChatGPT/Gemini lebih berkualitas. User
   BELUM kasih detail spesifik apa yang kurang — **gali dulu di chat
   baru**: contoh hasil yang kurang bagus? bagian instruksi/struktur/
   tingkat detail yang perlu diperbaiki?

**PENTING — jangan langsung coding poin 1 & 2:**
- Endpoint backend yang ADA SEKARANG (`getRekapJurnalGuru`/
  `getRekapJurnalKelas`, `Jurnal.gs`) sifatnya MINGGUAN, dikelompokkan
  per TANGGAL/HARI, rentang maks 31 hari (`REKAP_MAX_HARI`). Kebutuhan
  BULANAN yang dikelompokkan per KELAS+MAPEL (bukan per hari)
  kemungkinan besar butuh ENDPOINT BARU dengan struktur data yang beda
  total — jangan asumsikan cukup perbesar `REKAP_MAX_HARI`, itu tidak
  mengubah cara pengelompokan datanya sama sekali.
- **Tanya dulu ke user** bagaimana tepatnya tampilan yang diinginkan
  (boleh minta sketsa ASCII/contoh seperti pola sesi-sesi sebelumnya)
  sebelum mulai ubah backend maupun bikin mesin PDF baru — riwayat
  proyek ini menunjukkan asumsi tanpa konfirmasi sering meleset untuk
  perubahan struktur PDF yang cukup besar.

---

## YANG HARUS DILAKUKAN DI CHAT BARU

1. **Sapa & konfirmasi dulu**: tanyakan apakah user sudah sempat deploy
   & test update-update dari 19-21 Sept (2-tab UI, fix nama tidak hadir,
   Export Jadwal Mingguan, kolom Kehadiran bebas tumbuh) — supaya tahu
   titik pasti untuk lanjut, jangan berasumsi semua sudah lancar.
2. Kalau user langsung lanjut ke salah satu dari 3 rencana fitur di
   atas: untuk poin 1/2 (export bulanan), **tanya dulu detail
   tampilan/pengelompokan yang diinginkan** sebelum coding. Untuk poin 3
   (perbaikan prompt AI), **tanya dulu apa spesifiknya yang kurang**
   dari prompt yang ada sekarang.
3. Kalau user melaporkan bug dari fitur yang sudah dikirim: baca dulu
   bagian "RIWAYAT SINGKAT BUG-FIX PENTING" di atas — jangan mengulang
   pendekatan yang sudah 2x ditolak (poin 4).
4. Ikuti pola kerja yang sudah baku (lihat "RINGKASAN PROYEK" di atas):
   verifikasi syntax, update ketiga file dokumentasi, zip, present.

---

## KONTEKS DATA PRODUKSI (spreadsheet, dari sesi-sesi awal — masih berlaku)

13 sheet: `01_CONFIG`, `02_TAHUN_AJARAN`, `03_USER`, `04_GURU`,
`05_KELAS`, `06_SISWA` (~1000 baris), `07_MAPEL`, `08_JAM`, `09_JADWAL`
(~1278 baris — besar), `10_JURNAL`, `11_JURNAL_JAM`, `12_KEHADIRAN`,
`13_LOG` (kini dijaga ≤90 hari otomatis). Header berada di ROW 3 tiap
sheet (row 1-2 dipakai judul/keterangan), data mulai row 4 — dipakai
konsisten oleh `readSheet()`/`_readSheetRaw()` di `Utils.gs`.

---

## CATATAN ARSITEKTUR YANG TETAP BERLAKU (jangan diubah tanpa diskusi)

- Kolom `aktif` & config boolean apa pun: SELALU pakai `isAktif(val)`
  dari `Utils.gs`, tidak pernah bandingkan string manual.
- NIS: SELALU normalisasi lewat `_nisKey()`/`_indexSiswaByNis()` kalau
  perlu mencocokkan/mencari siswa lintas sheet.
- Status kehadiran (Sakit/Izin/Alpa): SELALU cocokkan longgar
  (`_normalisasiStatusKehadiran` / `_pdfKelompokkanTidakHadir`), jangan
  exact-match string.
- Cache localStorage (`cache.js`) untuk data master saja, invalidasi via
  `DATA_VERSION`. Cache in-memory (`staleWhileRevalidate()`) untuk kesan
  performa data transaksional, hilang saat reload. Endpoint rekap PDF
  (`getRekapJurnalGuru/Kelas`, `getJadwalPerGuru/Kelas`) SENGAJA TIDAK
  pakai cache — selalu fetch fresh saat tombol Export ditekan.
- jsPDF + jsPDF-AutoTable dimuat dari CDN di `app.html` — TAPI AutoTable
  SUDAH TIDAK DIPAKAI LAGI sejak redesain PDF jadi kartu/baris manual
  (17-18 Sept), tag CDN-nya dibiarkan saja (tidak mengganggu).
  `doc.GState`/`doc.setGState` (opacity) dipakai untuk efek fade,
  dibungkus try/catch untuk jaga-jaga kalau versi jsPDF tidak mendukung.
- Batas karakter jurnal: `BATAS_KARAKTER_RINGKASAN=700`,
  `BATAS_KARAKTER_CATATAN=200` — dijaga DUA KALI (frontend `app.js`
  maxlength+counter, DAN backend `Jurnal.gs` validasi) supaya panggilan
  API langsung tidak bisa melewati batas.
  `PDF_PALET_MAPEL` (Jadwal) — semua sudah didefinisikan di `app.js`,
  reuse kalau bikin PDF baru, jangan duplikat definisi.
- Deploy Apps Script Web App WAJIB "Execute as: Me" + "Who has access:
  Anyone". Redeploy pakai "Manage deployments → Edit → New version"
  (BUKAN "New deployment", supaya URL `/exec` tidak berubah).
- 2-tab UI (Jurnal Saya/Kelas/Guru masing-masing punya tab "list" vs
  "export") pakai parameter route `tab` (`'list'`|`'export'`, default
  `'list'`), lihat `subtabBarHtml()`/`bindSubtabBar()` di `app.js` kalau
  mau menambah tab serupa di tempat lain.

---

## FILE YANG DISERTAKAN DI ZIP INI

`apps-script/*.gs` (6 file, versi TERBARU per 21 Sept — tidak berubah
di sesi 22 Sept), `frontend/*` (semua file, versi TERBARU per 21 Sept),
`materi-sosialisasi/Sosialisasi_Jurnal_Mengajar.pptx` (**BARU**, 22
Sept), dan dokumentasi (`Master_Progress.md` paling lengkap — baca
bagian tanggal terbaru di BAWAH file dulu, `Panduan_Deploy_dan_Uji.md`,
`Master_Specification.md`, dokumen ini).
