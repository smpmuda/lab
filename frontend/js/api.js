// ============================================================
// api.js — Wrapper fetch ke Google Apps Script
// ============================================================

const API = {

  /**
   * Panggil endpoint Apps Script.
   * @param {string} action - nama action
   * @param {object} params - untuk GET: query params. untuk POST: body
   * @param {string} method - 'GET' atau 'POST'
   * @param {boolean} withToken - sertakan token dari session (default true)
   */
  call: function(action, params, method, withToken) {
    params = params || {};
    method = method || 'GET';
    withToken = withToken !== false;

    if (withToken) {
      var token = Auth.getToken();
      if (token) params.token = token;
    }

    var url = CONFIG.API_URL;

    if (method === 'GET') {
      var query = Object.keys(params)
        .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
        .join('&');
      url += '?action=' + encodeURIComponent(action) + (query ? '&' + query : '');

      return fetch(url, { method: 'GET' })
        .then(function(r) { return r.json(); })
        .catch(function(e) {
          return { ok: false, error: 'Koneksi gagal. Periksa internet Anda.' };
        });
    } else {
      url += '?action=' + encodeURIComponent(action);
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight
        body: JSON.stringify(params)
      })
        .then(function(r) { return r.json(); })
        .catch(function(e) {
          return { ok: false, error: 'Koneksi gagal. Periksa internet Anda.' };
        });
    }
  }
};
