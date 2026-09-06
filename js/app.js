// ============================================================
// app.js — Router & Semua Tampilan
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
// ============================================================

if (!Auth.requireLogin()) { /* redirect sudah jalan */ }

var session = Auth.getSession();
var roles = Auth.getRoles();
var activeRole = roles[0]; // role aktif saat ini (untuk switching tampilan)
var appConfig = null;

var $main = document.getElementById('mainContent');
var $nav  = document.getElementById('bottomNav');
var $roleTabs = document.getElementById('roleTabs');

// ── State cache sederhana ──────────────────────────────────────
var STATE = {
  jadwalHariIni: null,
  jurnalSaya: null,
  kelasList: null,
  waliKelasId: (session.kelas_wali ? session.kelas_wali.kelas_id : null),
};

// ── Init ─────────────────────────────────────────────────────

function init() {
  document.getElementById('hdrUser').textContent = session.nama + ' · ' + roleLabel(activeRole);

  API.call('getConfig', {}, 'GET', false).then(function(res) {
    if (res.ok) {
      appConfig = res.data;
      document.getElementById('hdrAppName').textContent = appConfig.nama_aplikasi;
    }
    setupRoleTabs();
    setupBottomNav();
    navigate(defaultRouteFor(activeRole));
  });
}

function roleLabel(r) {
  return { ADMIN: 'Admin', GURU: 'Guru', WALI_KELAS: 'Wali Kelas' }[r] || r;
}

function defaultRouteFor(role) {
  if (role === 'GURU') return 'dashboard';
  if (role === 'WALI_KELAS') return 'jurnal-kelas';
  if (role === 'ADMIN') return 'admin-home';
  return 'dashboard';
}

// ── Role Tabs (jika multi-role) ────────────────────────────────

function setupRoleTabs() {
  if (roles.length <= 1) return;
  $roleTabs.style.display = 'flex';
  $roleTabs.innerHTML = roles.map(function(r) {
    return '<button class="role-tab' + (r === activeRole ? ' active' : '') + '" data-role="' + r + '">'
      + roleLabel(r) + '</button>';
  }).join('');

  $roleTabs.querySelectorAll('.role-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      activeRole = btn.dataset.role;
      document.getElementById('hdrUser').textContent = session.nama + ' · ' + roleLabel(activeRole);
      $roleTabs.querySelectorAll('.role-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      setupBottomNav();
      navigate(defaultRouteFor(activeRole));
    });
  });
}

// ── Bottom Nav (per role) ──────────────────────────────────────

function setupBottomNav() {
  var items = [];
  if (activeRole === 'GURU') {
    items = [
      { route: 'dashboard',   icon: '📅', label: 'Hari Ini' },
      { route: 'jurnal-saya', icon: '📋', label: 'Jurnal Saya' },
    ];
  } else if (activeRole === 'WALI_KELAS') {
    items = [
      { route: 'jurnal-kelas', icon: '🏫', label: 'Jurnal Kelas' },
    ];
  } else if (activeRole === 'ADMIN') {
    items = [
      { route: 'admin-home',   icon: '⚙️', label: 'Beranda' },
      { route: 'admin-jurnal', icon: '📚', label: 'Jurnal' },
      { route: 'admin-log',    icon: '🕒', label: 'Log' },
    ];
  }

  if (items.length <= 1) { $nav.style.display = 'none'; return; }

  $nav.style.display = 'flex';
  $nav.innerHTML = items.map(function(it) {
    return '<button class="nav-item" data-route="' + it.route + '">'
      + '<span class="nav-icon">' + it.icon + '</span>' + it.label + '</button>';
  }).join('');

  $nav.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.addEventListener('click', function() { navigate(btn.dataset.route); });
  });
}

function setActiveNav(route) {
  $nav.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.route === route);
  });
}

// ── Router ───────────────────────────────────────────────────

function navigate(route, params) {
  setActiveNav(route);
  params = params || {};

  var routes = {
    'dashboard':       viewDashboard,
    'jurnal-saya':      viewJurnalSaya,
    'jurnal-form':      viewJurnalForm,
    'jurnal-detail':    viewJurnalDetail,
    'jurnal-edit':      viewJurnalEdit,
    'jurnal-kelas':     viewJurnalKelas,
    'admin-home':       viewAdminHome,
    'admin-jurnal':     viewAdminJurnal,
    'admin-log':        viewAdminLog,
  };

  if (routes[route]) routes[route](params);
  else $main.innerHTML = '<div class="empty"><div class="empty-icon">🚧</div><div class="empty-text">Halaman tidak ditemukan</div></div>';
}

// ── Helper: loading & toast ─────────────────────────────────────

function showLoading(msg) {
  $main.innerHTML = '<div class="loading-box"><div class="spinner"></div><br>' + (msg || 'Memuat...') + '</div>';
}

function showToast(msg, isError) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(function() { t.className = 'toast'; }, 2600);
}

function fmtTanggalIndo(tanggalStr) {
  var bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var d = new Date(tanggalStr + 'T00:00:00');
  var hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
  return hari + ', ' + d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// ══════════════════════════════════════════════════════════════
// VIEW: Dashboard Guru (Jadwal Hari Ini / Tanggal Pilihan)
// ══════════════════════════════════════════════════════════════

var dashTanggal = todayStr();

function viewDashboard(params) {
  if (params.tanggal) dashTanggal = params.tanggal;
  showLoading('Memuat jadwal...');

  API.call('getJadwalHariIni', { tanggal: dashTanggal }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }

    var d = res.data;
    STATE.jadwalHariIni = d;

    var html = '';
    html += dateBarHtml(dashTanggal, 'dashboard');
    html += '<div class="sec-title">Jadwal Mengajar — ' + fmtTanggalIndo(dashTanggal) + '</div>';

    if (d.jadwal.length === 0) {
      html += '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">Tidak ada jadwal mengajar pada hari ini</div></div>';
    } else {
      d.jadwal.forEach(function(j) {
        html += jadwalCardHtml(j);
      });
    }

    $main.innerHTML = html;
    bindDateBar('dashboard');
    bindJadwalCards();
  });
}

function dateBarHtml(tanggal, route) {
  return '<div class="date-bar">'
    + '<input type="date" id="datePicker" value="' + tanggal + '">'
    + '<button class="date-today-btn" id="btnToday">Hari Ini</button>'
    + '</div>';
}

function bindDateBar(route) {
  var picker = document.getElementById('datePicker');
  var btnToday = document.getElementById('btnToday');
  if (picker) {
    picker.addEventListener('change', function() {
      navigate(route, { tanggal: picker.value, kelas_id: STATE._kelasIdCtx });
    });
  }
  if (btnToday) {
    btnToday.addEventListener('click', function() {
      navigate(route, { tanggal: todayStr(), kelas_id: STATE._kelasIdCtx });
    });
  }
}

function jadwalCardHtml(j) {
  var cls = j.sudah_diisi ? 'done' : (j.konflik ? 'konflik' : '');
  var badge = j.sudah_diisi
    ? '<span class="badge badge-done">✓ Sudah diisi</span>'
    : '<span class="badge badge-todo">Belum diisi</span>';

  var html = '<div class="jadwal-card ' + cls + '" data-blok=\'' + JSON.stringify(j).replace(/'/g, "&apos;") + '\'>';
  html += '<div class="jadwal-top">';
  html += '<div class="jadwal-info">';
  html += '<div class="jadwal-mapel">' + esc(j.nama_mapel) + '</div>';
  html += '<div class="jadwal-meta">' + esc(j.nama_kelas) + ' · ' + esc(j.jam_label) + '</div>';
  html += '</div>' + badge;
  html += '</div>';

  if (j.konflik) {
    html += '<div class="jadwal-warn">⚠ ' + esc(j.konflik_info) + '</div>';
  }

  $main; // no-op, keep structure
  html += '</div>';
  return html;
}

function bindJadwalCards() {
  document.querySelectorAll('.jadwal-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var data = JSON.parse(card.dataset.blok.replace(/&apos;/g, "'"));
      if (data.sudah_diisi) {
        navigate('jurnal-detail', { jurnal_id: data.jurnal_id });
      } else {
        navigate('jurnal-form', { blok: data });
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Form Isi Jurnal
// ══════════════════════════════════════════════════════════════

function viewJurnalForm(params) {
  var blok = params.blok;
  if (!blok) { navigate('dashboard'); return; }

  showLoading('Memuat data siswa...');

  API.call('getSiswa', { kelas_id: blok.kelas_id }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var siswa = res.data;

    var html = '<button class="btn-back" onclick="navigate(\'dashboard\', {tanggal:\'' + blok.tanggal + '\'})">← Kembali</button>';
    html += '<div class="form-box">';

    html += '<div class="form-group"><span class="form-label">Kelas & Mapel</span>';
    html += '<div class="form-readonly">' + esc(blok.nama_kelas) + ' — ' + esc(blok.nama_mapel) + '</div></div>';

    html += '<div class="form-group"><span class="form-label">Tanggal</span>';
    html += '<div class="form-readonly">' + fmtTanggalIndo(blok.tanggal) + '</div></div>';

    html += '<div class="form-group"><span class="form-label">Jam Pelajaran</span>';
    html += '<div class="jam-check-row" id="jamCheckRow">';
    blok.jam_ids.forEach(function(jid) {
      html += '<button type="button" class="jam-check selected" data-jam="' + jid + '">'
        + jid.replace('J', 'Jam ') + '</button>';
    });
    html += '</div></div>';

    html += '<div class="form-group"><span class="form-label">Ringkasan Kegiatan *</span>';
    html += '<textarea id="ringkasan" rows="3" placeholder="Contoh: Algoritma dan flowchart dasar" required></textarea></div>';

    html += '<div class="form-group"><span class="form-label">Catatan (opsional)</span>';
    html += '<textarea id="catatan" rows="2" placeholder="Catatan tambahan..."></textarea></div>';

    html += '<div class="form-group"><span class="form-label">Kehadiran Siswa (' + siswa.length + ' siswa)</span>';
    html += '<div id="siswaList">';
    if (siswa.length === 0) {
      html += '<div class="empty" style="padding:20px"><div class="empty-text">Belum ada data siswa untuk kelas ini</div></div>';
    } else {
      siswa.forEach(function(s) {
        html += siswaRowHtml(s);
      });
    }
    html += '</div></div>';

    html += '<button class="btn-primary" id="btnSimpan">Simpan Jurnal</button>';
    html += '</div>';

    $main.innerHTML = html;

    bindJamCheckboxes();
    bindStatusButtons();
    bindSimpanJurnal(blok);
  });
}

function siswaRowHtml(s) {
  return '<div class="siswa-row" data-nis="' + s.nis + '" data-status="HADIR">'
    + '<div><div class="siswa-nama">' + esc(s.nama) + '</div><div class="siswa-nis">' + esc(s.nis) + '</div></div>'
    + '<div class="status-btns">'
    + '<button type="button" class="status-btn active-h" data-status="HADIR">H</button>'
    + '<button type="button" class="status-btn" data-status="SAKIT">S</button>'
    + '<button type="button" class="status-btn" data-status="IZIN">I</button>'
    + '<button type="button" class="status-btn" data-status="ALPA">A</button>'
    + '</div></div>';
}

function bindJamCheckboxes() {
  document.querySelectorAll('.jam-check').forEach(function(btn) {
    btn.addEventListener('click', function() {
      btn.classList.toggle('selected');
    });
  });
}

var statusClassMap = { HADIR: 'active-h', SAKIT: 'active-s', IZIN: 'active-i', ALPA: 'active-a' };

function bindStatusButtons() {
  document.querySelectorAll('.siswa-row').forEach(function(row) {
    row.querySelectorAll('.status-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        row.dataset.status = btn.dataset.status;
        row.querySelectorAll('.status-btn').forEach(function(b) {
          b.className = 'status-btn';
        });
        btn.className = 'status-btn ' + statusClassMap[btn.dataset.status];
      });
    });
  });
}

function bindSimpanJurnal(blok) {
  document.getElementById('btnSimpan').addEventListener('click', function() {
    var jamIds = Array.from(document.querySelectorAll('.jam-check.selected')).map(function(b) { return b.dataset.jam; });
    var ringkasan = document.getElementById('ringkasan').value.trim();
    var catatan = document.getElementById('catatan').value.trim();

    if (jamIds.length === 0) { showToast('Pilih minimal 1 jam', true); return; }
    if (ringkasan.length < 5) { showToast('Ringkasan kegiatan wajib diisi (min 5 karakter)', true); return; }

    var kehadiran = Array.from(document.querySelectorAll('.siswa-row')).map(function(row) {
      return { nis: row.dataset.nis, status: row.dataset.status, keterangan: '' };
    });

    var btn = document.getElementById('btnSimpan');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    API.call('createJurnal', {
      tanggal: blok.tanggal,
      kelas_id: blok.kelas_id,
      mapel_id: blok.mapel_id,
      jam_ids: jamIds,
      ringkasan_kegiatan: ringkasan,
      catatan: catatan,
      kehadiran: kehadiran
    }, 'POST').then(function(res) {
      if (!res.ok) {
        showToast(res.error || 'Gagal menyimpan', true);
        btn.disabled = false;
        btn.textContent = 'Simpan Jurnal';
        return;
      }
      showToast('Jurnal berhasil disimpan ✓');
      navigate('dashboard', { tanggal: blok.tanggal });
    });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Detail Jurnal (sudah diisi)
// ══════════════════════════════════════════════════════════════

function viewJurnalDetail(params) {
  showLoading('Memuat detail jurnal...');

  API.call('getDetailJurnal', { jurnal_id: params.jurnal_id }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var j = res.data;

    var html = '<button class="btn-back" onclick="history.back()">← Kembali</button>';
    html += '<div class="form-box">';

    html += '<div class="form-group"><span class="form-label">Kelas & Mapel</span>';
    html += '<div class="form-readonly">' + esc(j.nama_kelas) + ' — ' + esc(j.nama_mapel) + '</div></div>';

    html += '<div class="form-group"><span class="form-label">Tanggal & Jam</span>';
    html += '<div class="form-readonly">' + fmtTanggalIndo(j.tanggal) + ' · ' + esc(j.jam_label) + '</div></div>';

    html += '<div class="form-group"><span class="form-label">Ringkasan Kegiatan</span>';
    html += '<div class="form-readonly" style="font-weight:400">' + esc(j.ringkasan) + '</div></div>';

    if (j.catatan) {
      html += '<div class="form-group"><span class="form-label">Catatan</span>';
      html += '<div class="form-readonly" style="font-weight:400">' + esc(j.catatan) + '</div></div>';
    }

    var rk = j.rekap_kehadiran;
    html += '<div class="form-group"><span class="form-label">Kehadiran (' + rk.total + ' siswa)</span>';
    html += '<div class="pill-row">';
    html += '<span class="pill pill-g">' + rk.hadir + ' Hadir</span>';
    if (rk.sakit) html += '<span class="pill pill-s">' + rk.sakit + ' Sakit</span>';
    if (rk.izin) html += '<span class="pill pill-i">' + rk.izin + ' Izin</span>';
    if (rk.alpa) html += '<span class="pill pill-a">' + rk.alpa + ' Alpa</span>';
    html += '</div></div>';

    if (j.kehadiran.filter(function(k) { return k.status !== 'HADIR'; }).length > 0) {
      html += '<div class="form-group"><span class="form-label">Tidak Hadir</span>';
      j.kehadiran.filter(function(k) { return k.status !== 'HADIR'; }).forEach(function(k) {
        html += '<div class="siswa-row"><div><div class="siswa-nama">' + esc(k.nama) + '</div>'
          + '<div class="siswa-nis">' + (k.keterangan || '') + '</div></div>'
          + '<span class="pill pill-' + k.status.charAt(0).toLowerCase() + '">' + k.status + '</span></div>';
      });
      html += '</div>';
    }

    if (j.bisa_edit && (Auth.hasRole('GURU') || Auth.hasRole('ADMIN'))) {
      html += '<button class="btn-secondary" id="btnEdit">Edit Jurnal Ini</button>';
    }

    html += '</div>';
    $main.innerHTML = html;

    var btnEdit = document.getElementById('btnEdit');
    if (btnEdit) {
      btnEdit.addEventListener('click', function() {
        navigate('jurnal-edit', { jurnal: j });
      });
    }
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Edit Jurnal (ringkasan, catatan, kehadiran — jam & kelas/mapel tetap)
// ══════════════════════════════════════════════════════════════

function viewJurnalEdit(params) {
  var j = params.jurnal;
  if (!j) { navigate('jurnal-saya'); return; }

  showLoading('Memuat data siswa...');

  API.call('getSiswa', { kelas_id: j.kelas_id }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var siswa = res.data;

    // Peta status kehadiran existing per NIS
    var khMap = {};
    (j.kehadiran || []).forEach(function(k) { khMap[String(k.nis)] = k.status; });

    var html = '<button class="btn-back" onclick="navigate(\'jurnal-detail\', {jurnal_id:\'' + j.jurnal_id + '\'})">← Batal, kembali ke detail</button>';
    html += '<div class="form-box">';

    html += '<div class="form-group"><span class="form-label">Kelas & Mapel</span>';
    html += '<div class="form-readonly">' + esc(j.nama_kelas) + ' — ' + esc(j.nama_mapel) + '</div></div>';

    html += '<div class="form-group"><span class="form-label">Tanggal & Jam</span>';
    html += '<div class="form-readonly">' + fmtTanggalIndo(j.tanggal) + ' · ' + esc(j.jam_label) + '</div>';
    html += '<div style="font-size:11px;color:var(--gray-400);margin-top:6px">ℹ Tanggal, kelas, mapel, dan jam tidak bisa diubah. Buat jurnal baru jika salah sesi.</div></div>';

    html += '<div class="form-group"><span class="form-label">Ringkasan Kegiatan *</span>';
    html += '<textarea id="ringkasan" rows="3" required>' + esc(j.ringkasan) + '</textarea></div>';

    html += '<div class="form-group"><span class="form-label">Catatan (opsional)</span>';
    html += '<textarea id="catatan" rows="2">' + esc(j.catatan || '') + '</textarea></div>';

    html += '<div class="form-group"><span class="form-label">Kehadiran Siswa (' + siswa.length + ' siswa)</span>';
    html += '<div id="siswaList">';
    if (siswa.length === 0) {
      html += '<div class="empty" style="padding:20px"><div class="empty-text">Belum ada data siswa untuk kelas ini</div></div>';
    } else {
      siswa.forEach(function(s) {
        html += siswaRowHtmlWithStatus(s, khMap[String(s.nis)] || 'HADIR');
      });
    }
    html += '</div></div>';

    html += '<button class="btn-primary" id="btnUpdate">Simpan Perubahan</button>';
    html += '</div>';

    $main.innerHTML = html;

    bindStatusButtons();
    bindUpdateJurnal(j.jurnal_id);
  });
}

function siswaRowHtmlWithStatus(s, status) {
  var cls = { HADIR: 'active-h', SAKIT: 'active-s', IZIN: 'active-i', ALPA: 'active-a' };
  var btn = function(st, label) {
    return '<button type="button" class="status-btn' + (status === st ? ' ' + cls[st] : '') + '" data-status="' + st + '">' + label + '</button>';
  };
  return '<div class="siswa-row" data-nis="' + s.nis + '" data-status="' + status + '">'
    + '<div><div class="siswa-nama">' + esc(s.nama) + '</div><div class="siswa-nis">' + esc(s.nis) + '</div></div>'
    + '<div class="status-btns">' + btn('HADIR','H') + btn('SAKIT','S') + btn('IZIN','I') + btn('ALPA','A') + '</div></div>';
}

function bindUpdateJurnal(jurnalId) {
  document.getElementById('btnUpdate').addEventListener('click', function() {
    var ringkasan = document.getElementById('ringkasan').value.trim();
    var catatan = document.getElementById('catatan').value.trim();

    if (ringkasan.length < 5) { showToast('Ringkasan kegiatan wajib diisi (min 5 karakter)', true); return; }

    var kehadiran = Array.from(document.querySelectorAll('.siswa-row')).map(function(row) {
      return { nis: row.dataset.nis, status: row.dataset.status, keterangan: '' };
    });

    var btn = document.getElementById('btnUpdate');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    API.call('updateJurnal', {
      jurnal_id: jurnalId,
      ringkasan_kegiatan: ringkasan,
      catatan: catatan,
      kehadiran: kehadiran
    }, 'POST').then(function(res) {
      if (!res.ok) {
        showToast(res.error || 'Gagal menyimpan perubahan', true);
        btn.disabled = false;
        btn.textContent = 'Simpan Perubahan';
        return;
      }
      showToast('Perubahan berhasil disimpan ✓');
      navigate('jurnal-detail', { jurnal_id: jurnalId });
    });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Jurnal Saya (Riwayat Guru)
// ══════════════════════════════════════════════════════════════

function viewJurnalSaya(params) {
  showLoading('Memuat riwayat jurnal...');

  API.call('getJurnalSaya', {}, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var list = res.data;

    var html = '<div class="sec-title">Riwayat Jurnal Saya</div>';

    if (list.length === 0) {
      html += '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Belum ada jurnal yang dibuat</div></div>';
    } else {
      list.forEach(function(j) {
        html += '<div class="admin-list-item" data-id="' + j.jurnal_id + '" style="cursor:pointer">'
          + '<div><div class="admin-list-main">' + esc(j.nama_mapel) + ' — ' + esc(j.nama_kelas) + '</div>'
          + '<div class="admin-list-sub">' + fmtTanggalIndo(j.tanggal) + ' · ' + esc(j.jam_label) + '</div></div>'
          + '<span class="badge badge-done">✓</span></div>';
      });
    }

    $main.innerHTML = html;
    document.querySelectorAll('.admin-list-item').forEach(function(item) {
      item.addEventListener('click', function() {
        navigate('jurnal-detail', { jurnal_id: item.dataset.id });
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Jurnal Kelas (Wali Kelas)
// ══════════════════════════════════════════════════════════════

var jurnalKelasTanggal = todayStr();

function viewJurnalKelas(params) {
  if (params.tanggal) jurnalKelasTanggal = params.tanggal;
  var kelasId = params.kelas_id || STATE.waliKelasId;

  if (!kelasId) {
    $main.innerHTML = '<div class="empty"><div class="empty-icon">🏫</div><div class="empty-text">Anda belum ditugaskan sebagai wali kelas</div></div>';
    return;
  }
  STATE._kelasIdCtx = kelasId;

  showLoading('Memuat jurnal kelas...');

  API.call('getJadwalKelas', { kelas_id: kelasId, tanggal: jurnalKelasTanggal }, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var d = res.data;

    var html = dateBarHtml(jurnalKelasTanggal, 'jurnal-kelas');
    html += '<div class="sec-title">Jurnal Kelas · ' + fmtTanggalIndo(jurnalKelasTanggal) + '</div>';

    if (d.mapel.length === 0) {
      html += '<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">Tidak ada jadwal pada hari ini</div></div>';
    } else {
      d.mapel.forEach(function(m) {
        html += mapelCardHtml(m);
      });
    }

    $main.innerHTML = html;
    bindDateBar('jurnal-kelas');
  });
}

function mapelCardHtml(m) {
  var cls = m.sudah_diisi ? 'done' : '';
  var html = '<div class="jadwal-card ' + cls + '">';
  html += '<div class="jadwal-top"><div class="jadwal-info">';
  html += '<div class="jadwal-mapel">' + esc(m.nama_mapel) + '</div>';
  html += '<div class="jadwal-meta">' + esc(m.jam_label) + ' · Guru: ' + esc(m.nama_guru) + '</div>';
  html += '</div>';
  html += m.sudah_diisi ? '<span class="badge badge-done">✓ Diisi</span>' : '<span class="badge badge-todo">Belum diisi</span>';
  html += '</div>';

  if (m.sudah_diisi) {
    var k = m.kehadiran;
    html += '<div class="jadwal-preview">';
    html += '<div>' + esc(m.ringkasan) + '</div>';
    html += '<div class="pill-row">';
    html += '<span class="pill pill-g">' + k.hadir + ' Hadir</span>';
    if (k.sakit) html += '<span class="pill pill-s">' + k.sakit + ' Sakit</span>';
    if (k.izin) html += '<span class="pill pill-i">' + k.izin + ' Izin</span>';
    if (k.alpa) html += '<span class="pill pill-a">' + k.alpa + ' Alpa</span>';
    html += '</div>';
    if (m.tidak_hadir.length > 0) {
      html += '<div style="margin-top:8px;font-size:12px">Tidak hadir: ' +
        m.tidak_hadir.map(function(t) { return esc(t.nama); }).join(', ') + '</div>';
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// ══════════════════════════════════════════════════════════════
// VIEW: Admin — Beranda
// ══════════════════════════════════════════════════════════════

function viewAdminHome(params) {
  var html = '<div class="sec-title">Ringkasan</div>';
  html += '<div class="admin-list-item"><div><div class="admin-list-main">' + esc(session.nama) + '</div>'
    + '<div class="admin-list-sub">Admin — akses penuh sistem</div></div></div>';

  html += '<div class="sec-title">Menu</div>';
  html += '<div class="admin-list-item" id="goJurnal" style="cursor:pointer"><div class="admin-list-main">📚 Semua Jurnal</div></div>';
  html += '<div class="admin-list-item" id="goLog" style="cursor:pointer"><div class="admin-list-main">🕒 Log Aktivitas</div></div>';

  html += '<div class="sec-title">Catatan</div>';
  html += '<div class="admin-list-item"><div class="admin-list-sub" style="line-height:1.6">'
    + 'Data master (Guru, Kelas, Siswa, Mapel, Jadwal, User) dikelola langsung di Google Spreadsheet. '
    + 'Konfigurasi sekolah ada di sheet 01_CONFIG.</div></div>';

  $main.innerHTML = html;
  document.getElementById('goJurnal').addEventListener('click', function() { navigate('admin-jurnal'); });
  document.getElementById('goLog').addEventListener('click', function() { navigate('admin-log'); });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Admin — Semua Jurnal
// ══════════════════════════════════════════════════════════════

function viewAdminJurnal(params) {
  showLoading('Memuat semua jurnal...');

  API.call('getAllJurnal', {}, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var list = res.data;

    var html = '<div class="sec-title">Semua Jurnal (' + list.length + ')</div>';

    if (list.length === 0) {
      html += '<div class="empty"><div class="empty-icon">📚</div><div class="empty-text">Belum ada jurnal</div></div>';
    } else {
      list.slice(0, 100).forEach(function(j) {
        html += '<div class="admin-list-item" data-id="' + j.jurnal_id + '" style="cursor:pointer">'
          + '<div><div class="admin-list-main">' + esc(j.nama_mapel) + ' — ' + esc(j.nama_kelas) + '</div>'
          + '<div class="admin-list-sub">' + esc(j.nama_guru) + ' · ' + fmtTanggalIndo(j.tanggal) + '</div></div>'
          + '<span class="badge badge-done">' + esc(j.status) + '</span></div>';
      });
    }

    $main.innerHTML = html;
    document.querySelectorAll('.admin-list-item[data-id]').forEach(function(item) {
      item.addEventListener('click', function() {
        navigate('jurnal-detail', { jurnal_id: item.dataset.id });
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════
// VIEW: Admin — Log Aktivitas
// ══════════════════════════════════════════════════════════════

function viewAdminLog(params) {
  showLoading('Memuat log...');

  API.call('getLog', {}, 'GET').then(function(res) {
    if (!res.ok) { $main.innerHTML = errorBox(res.error); return; }
    var list = res.data;

    var html = '<div class="sec-title">Log Aktivitas (200 terakhir)</div>';

    if (list.length === 0) {
      html += '<div class="empty"><div class="empty-icon">🕒</div><div class="empty-text">Belum ada log</div></div>';
    } else {
      list.forEach(function(l) {
        html += '<div class="admin-list-item"><div>'
          + '<div class="admin-list-main">' + esc(l.aksi) + ' — ' + esc(l.tabel) + '</div>'
          + '<div class="admin-list-sub">' + esc(l.keterangan) + '</div>'
          + '<div class="admin-list-sub">' + esc(l.waktu) + '</div></div></div>';
      });
    }

    $main.innerHTML = html;
  });
}

// ── Helper umum ──────────────────────────────────────────────

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function errorBox(msg) {
  return '<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text">' + esc(msg || 'Terjadi kesalahan') + '</div></div>';
}

// ── Start ────────────────────────────────────────────────────

init();
