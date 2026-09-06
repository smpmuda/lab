// ============================================================
// auth.js — Session Management (sessionStorage)
// ============================================================

const Auth = {

  KEY: 'jm_session',

  saveSession: function(data) {
    sessionStorage.setItem(this.KEY, JSON.stringify(data));
  },

  getSession: function() {
    var raw = sessionStorage.getItem(this.KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e) { return null; }
  },

  getToken: function() {
    var s = this.getSession();
    return s ? s.token : null;
  },

  getRoles: function() {
    var s = this.getSession();
    if (!s || !s.role) return [];
    return String(s.role).split(',').map(function(r) { return r.trim(); });
  },

  hasRole: function(role) {
    return this.getRoles().indexOf(role) >= 0;
  },

  isAdmin: function() { return this.hasRole('ADMIN'); },
  isGuru: function() { return this.hasRole('GURU'); },
  isWaliKelas: function() {
    var s = this.getSession();
    return this.hasRole('WALI_KELAS') || (s && s.kelas_wali);
  },

  logout: function() {
    var token = this.getToken();
    if (token) {
      API.call('logout', {}, 'POST', true).catch(function() {});
    }
    sessionStorage.removeItem(this.KEY);
    window.location.href = 'login.html';
  },

  requireLogin: function() {
    if (!this.getToken()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }
};
