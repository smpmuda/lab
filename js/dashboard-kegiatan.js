// ============================================================
// dashboard-kegiatan.js — Dashboard Kegiatan (statistik sekolah)
// Jurnal Mengajar · SMP Muhammadiyah 2 Cilacap
//
// [BARU — 2026-09-26] Sengaja file & halaman TERPISAH dari app.js/app.html
// (keputusan eksplisit user) — dashboard ini murni tampilan baca-saja,
// dipakai SEMUA role (GURU/WALI_KELAS/ADMIN) setelah login, tidak masuk
// ke router SPA app.js supaya app.js tidak makin membengkak.
//
// Reuse dari file yang SUDAH ADA (tidak duplikasi): config.js (CONFIG),
// auth.js (Auth — sessionStorage token, namespaced per deployment),
// api.js (API.call — wrapper fetch ke Apps Script). Endpoint baru:
// getDashboardStats (lihat Dashboard.gs), read-only, semua role.
//
// CACHE (keputusan eksplisit user, 2026-09-26): localStorage per mode,
// TTL beda-beda sesuai seberapa cepat data itu berubah:
//   hari_ini    → 2 jam   (masih terus bertambah jurnalnya sepanjang hari)
//   kemarin     → 1 hari  (praktis sudah final)
//   minggu_lalu → 1 minggu (rentang H-7..H-1, sudah lewat semua)
// Pola cache mengikuti gaya cache.js yang sudah ada (namespaced,
// try-catch gagal-aman, tidak pernah bikin app error kalau localStorage
// penuh/nonaktif) — TAPI file terpisah karena cache.js khusus untuk data
// MASTER (guru/kelas/dst), bukan data agregat dashboard ini.
// ============================================================

(function () {

  if (!Auth.requireLogin()) return; // redirect ke login.html kalau belum login

  var session = Auth.getSession();

  // ── Cache kecil khusus dashboard (localStorage, TTL per mode) ──
  var DashCache = (function () {
    var LS_PREFIX = 'jm_dashcache_' + CONFIG.STORAGE_NS + '_';
    var TTL_MS = {
      hari_ini:    2  * 60 * 60 * 1000,
      kemarin:     24 * 60 * 60 * 1000,
      minggu_lalu: 7  * 24 * 60 * 60 * 1000,
    };

    function get(mode) {
      try {
        var raw = localStorage.getItem(LS_PREFIX + mode);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        var umur = Date.now() - parsed.cachedAt;
        if (umur > (TTL_MS[mode] || 0)) return null; // basi
        return parsed;
      } catch (e) {
        return null;
      }
    }

    function set(mode, data) {
      try {
        localStorage.setItem(LS_PREFIX + mode, JSON.stringify({ data: data, cachedAt: Date.now() }));
      } catch (e) { /* penuh/nonaktif — diamkan, gagal-aman */ }
    }

    function ttlLabel(mode) {
      if (mode === 'hari_ini') return '2 jam';
      if (mode === 'kemarin') return '1 hari';
      return '1 minggu';
    }

    return { get: get, set: set, ttlLabel: ttlLabel };
  })();

  // ── State ──
  var MODES = ['hari_ini', 'kemarin', 'minggu_lalu'];
  var MODE_LABEL = { hari_ini: 'Hari Ini', kemarin: 'Kemarin', minggu_lalu: 'Minggu Lalu' };
  var activeMode = 'hari_ini';
  var chartDonut = null, chartTren = null, chartKehadiran = null;
  var loadedData = {}; // mode -> data terakhir yang berhasil dirender

  // ── DOM refs ──
  var $tabs = document.getElementById('dashTabs');
  var $content = document.getElementById('dashContent');
  var $skeleton = document.getElementById('dashSkeleton');
  var $empty = document.getElementById('dashEmpty');
  var $err = document.getElementById('dashError');
  var $errMsg = document.getElementById('dashErrorMsg');
  var $cacheInfo = document.getElementById('dashCacheInfo');
  var $btnRefresh = document.getElementById('btnDashRefresh');
  var $hdrUser = document.getElementById('hdrUser');

  $hdrUser.textContent = session.nama + ' · ' + roleLabelSingkat(session.role);

  function roleLabelSingkat(roleStr) {
    var roles = String(roleStr || '').split(',').map(function (r) { return r.trim(); });
    if (roles.indexOf('ADMIN') >= 0) return 'Admin';
    if (roles.indexOf('WALI_KELAS') >= 0) return 'Wali Kelas';
    return 'Guru';
  }

  // ── Init tabs ──
  $tabs.innerHTML = MODES.map(function (m) {
    return '<button class="dtab' + (m === activeMode ? ' active' : '') + '" data-mode="' + m + '">' + MODE_LABEL[m] + '</button>';
  }).join('');
  $tabs.querySelectorAll('.dtab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.dataset.mode === activeMode) return;
      activeMode = btn.dataset.mode;
      $tabs.querySelectorAll('.dtab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      showModeFromCacheOrFetch(activeMode, false);
    });
  });

  $btnRefresh.addEventListener('click', function () {
    if ($btnRefresh.classList.contains('spinning')) return;
    showModeFromCacheOrFetch(activeMode, true);
  });

  // ── Load ──
  function showModeFromCacheOrFetch(mode, forceRefresh) {
    setState('loading');

    if (!forceRefresh) {
      var cached = DashCache.get(mode);
      if (cached) {
        loadedData[mode] = cached.data;
        render(mode, cached.data, cached.cachedAt);
        return;
      }
    }

    $btnRefresh.classList.add('spinning');
    API.call('getDashboardStats', { mode: mode }, 'GET', true).then(function (res) {
      $btnRefresh.classList.remove('spinning');
      if (!res.ok) {
        setState('error', res.error);
        return;
      }
      DashCache.set(mode, res.data);
      loadedData[mode] = res.data;
      render(mode, res.data, Date.now());
    });
  }

  function setState(state, msg) {
    $skeleton.style.display = state === 'loading' ? 'block' : 'none';
    $content.style.display  = state === 'ok' ? 'block' : 'none';
    $empty.style.display    = state === 'empty' ? 'block' : 'none';
    $err.style.display      = state === 'error' ? 'block' : 'none';
    if (state === 'error') $errMsg.textContent = msg || 'Terjadi kesalahan';
  }

  // ── Render ──
  function render(mode, data, cachedAt) {
    if (mode !== activeMode) return; // hasil fetch tab lama yang sudah ditinggalkan

    if (!data.ringkasan || data.ringkasan.total_jadwal_sesi === 0) {
      setState('empty');
      return;
    }
    setState('ok');

    renderCacheInfo(mode, cachedAt);
    renderStatCards(data.ringkasan);
    renderDonut(data.ringkasan);
    renderTren(data.tren, data.tren_tipe);
    renderKehadiran(data.kehadiran);
    renderGuruBelum(data.guru_belum_isi);
  }

  function renderCacheInfo(mode, cachedAt) {
    var jam = new Date(cachedAt);
    var jamStr = jam.getHours().toString().padStart(2, '0') + ':' + jam.getMinutes().toString().padStart(2, '0');
    $cacheInfo.textContent = 'Diperbarui pukul ' + jamStr + ' · cache ' + DashCache.ttlLabel(mode);
  }

  function animateNumber($el, target) {
    var start = 0;
    var dur = 600;
    var t0 = performance.now();
    function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      $el.textContent = Math.round(start + (target - start) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderStatCards(r) {
    animateNumber(document.getElementById('statTotalSesi'), r.total_jadwal_sesi);
    animateNumber(document.getElementById('statTerisi'), r.total_jurnal_terisi);
    document.getElementById('statPersen').textContent = r.persentase_terisi + '%';
    animateNumber(document.getElementById('statGuruBelum'), r.jumlah_guru_belum_isi);
    document.getElementById('statGuruTotal').textContent = r.jumlah_guru_dijadwalkan + ' guru dijadwalkan';
  }

  function renderDonut(r) {
    var ctx = document.getElementById('chartDonut').getContext('2d');
    var belum = Math.max(0, r.total_jadwal_sesi - r.total_jurnal_terisi);
    document.getElementById('donutBigNum').textContent = r.persentase_terisi + '%';
    if (chartDonut) chartDonut.destroy();
    chartDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Terisi', 'Belum'],
        datasets: [{
          data: [r.total_jurnal_terisi, belum],
          backgroundColor: ['#0d8f4f', '#e5e9e6'],
          borderWidth: 0,
        }],
      },
      options: {
        cutout: '72%',
        animation: { animateRotate: true, duration: 700 },
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
      },
    });
  }

  function renderTren(tren, tipe) {
    var ctx = document.getElementById('chartTren').getContext('2d');
    var labels = tren.map(function (t) { return t.label; });
    var values = tren.map(function (t) { return t.jumlah; });
    if (chartTren) chartTren.destroy();
    chartTren = new Chart(ctx, {
      type: tipe === 'harian' ? 'bar' : 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Jurnal',
          data: values,
          borderColor: '#2563eb',
          backgroundColor: tipe === 'harian' ? '#93b7fb' : 'rgba(37,99,235,.12)',
          fill: tipe !== 'harian',
          tension: 0.35,
          pointRadius: tipe === 'harian' ? 0 : 3,
          pointBackgroundColor: '#2563eb',
          borderRadius: tipe === 'harian' ? 6 : 0,
        }],
      },
      options: {
        animation: { duration: 700 },
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef1ef' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function renderKehadiran(k) {
    var ctx = document.getElementById('chartKehadiran').getContext('2d');
    if (chartKehadiran) chartKehadiran.destroy();
    chartKehadiran = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Hadir', 'Sakit', 'Izin', 'Alpa'],
        datasets: [{
          data: [k.hadir, k.sakit, k.izin, k.alpa],
          backgroundColor: ['#0d8f4f', '#f59e0b', '#2563eb', '#dc2626'],
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        animation: { duration: 700 },
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#eef1ef' } },
          y: { grid: { display: false } },
        },
      },
    });
    document.getElementById('kehadiranTotal').textContent = k.total + ' data kehadiran tercatat';
  }

  function renderGuruBelum(list) {
    var $wrap = document.getElementById('guruBelumList');
    var $count = document.getElementById('guruBelumCount');
    $count.textContent = list.length;

    if (list.length === 0) {
      $wrap.innerHTML = '<div class="dash-empty-mini"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Semua guru sudah mengisi jurnal.</div>';
      return;
    }

    $wrap.innerHTML = list.map(function (g) {
      var initial = (g.nama || '?').trim().charAt(0).toUpperCase();
      var detailRows = g.detail.map(function (d) {
        return '<div class="gb-detail-row"><span>' + esc(d.nama_kelas) + ' · ' + esc(d.nama_mapel) + '</span><span class="gb-detail-jam">' + esc(d.jam_label) + (d.hari ? ' · ' + esc(d.hari.charAt(0) + d.hari.substring(1, 3).toLowerCase() + ' ' + d.tanggal.substring(8, 10) + '/' + d.tanggal.substring(5, 7)) : '') + '</span></div>';
      }).join('');
      var lebih = g.jumlah_sesi_belum > g.detail.length ? '<div class="gb-detail-more">+' + (g.jumlah_sesi_belum - g.detail.length) + ' sesi lainnya</div>' : '';

      return '<details class="gb-item">'
        + '<summary><span class="gb-avatar">' + initial + '</span>'
        + '<span class="gb-name">' + esc(g.nama) + '</span>'
        + '<span class="gb-badge">' + g.jumlah_sesi_belum + ' sesi</span></summary>'
        + '<div class="gb-detail">' + detailRows + lebih + '</div>'
        + '</details>';
    }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ── Mulai ──
  showModeFromCacheOrFetch(activeMode, false);

})();
