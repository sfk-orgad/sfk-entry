/*
 * common/portal.js ― ポータルのツールのページで共通に使う部品(GitHub Pages)
 *   読み込み方：script タグの src に ../common/portal.js?v=1 を書く(ページ自身の処理より前に置く)
 *   直したら：下の Portal.version と、各ページの「?v=」の番号を上げる(スマホが古い部品を覚えたままにならないように)
 *   秘密は置かない(通行証とAPIの入口は、ポータルがブラウザの中に置いたものを使う)
 *
 * 主な使い方
 *   var P = Portal.start({ tool: 'staff', title: 'スタッフ一覧' });   // 通行証の確認＋ヘッダー。だめなら入口の画面に理由を出して null
 *   P.call('staff.list', {}, { app: 'shift', retry: true })            // APIを呼ぶ(Promise。返事のJSON)
 *   Portal.gate('メッセージ', { back: true, detail: '…' })               // 入口の画面に出す
 *   Portal.showApp()                                                   // 入口の画面を消して本体を出す
 *   Portal.authMessage(res)                                            // 返事のエラー(AUTH など)を、利用者向けの文に
 *   Portal.draft('shift_2026-11', 7)                                   // 入力途中の自動保存(日数)：read() / save(obj) / clear()
 *   Portal.keepAwake(function (state) { … })                           // 画面オフの抑止(対応端末だけ)
 *   Portal.prefetched('shiftboard', 3)                                 // ポータルの先読み(分以内)
 *   Portal.esc(s) / Portal.$(id)
 */
(function (w) {
  'use strict';
  var Portal = { version: 1, PORTAL_URL: '../' };

  Portal.$ = function (id) { return document.getElementById(id); };
  Portal.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };

  // ===== 通行証(ポータルが sessionStorage に置いたもの) =====
  Portal.session = function () {
    try { return JSON.parse(sessionStorage.getItem('portal_session') || 'null'); } catch (e) { return null; }
  };
  Portal.sessionOk = function (S) { S = S || Portal.session(); return !!(S && S.token && S.exp > Date.now()); };

  // ===== 入口の画面(準備中・エラー) =====
  //   ページに <div id="gate"> が無ければ作る。本体は <div id="app" hidden> に入れておく
  function ensureGate() {
    var g = Portal.$('gate');
    if (g) return g;
    g = document.createElement('div');
    g.id = 'gate';
    g.className = 'p-gate';
    g.innerHTML = '<div><div class="p-spin" id="gspin"></div><div class="p-gmsg" id="gmsg">準備しています…</div>' +
      '<div id="gact" class="p-gact"></div><div id="gdetail" class="p-gdetail"></div></div>';
    document.body.insertBefore(g, document.body.firstChild);
    return g;
  }
  Portal.gate = function (msg, opt) {
    opt = opt || {};
    var g = ensureGate();
    g.style.display = 'flex';
    var app = Portal.$('app'); if (app) app.hidden = true;
    var sp = Portal.$('gspin'); if (sp) sp.style.display = opt.loading ? 'block' : 'none';
    Portal.$('gmsg').textContent = msg;
    Portal.$('gact').innerHTML = opt.back ? '<a class="p-btn p-solid" href="' + Portal.PORTAL_URL + '">ポータルに戻る</a>' : '';
    Portal.$('gdetail').textContent = opt.detail || '';
  };
  Portal.showApp = function () {
    var g = Portal.$('gate'); if (g) g.style.display = 'none';
    var app = Portal.$('app'); if (app) app.hidden = false;
  };

  // 返事のエラーを、利用者向けの文にする
  Portal.authMessage = function (res, toolName) {
    if (!res) return '通信に失敗しました。\n電波の良いところで開き直してください。';
    if (res.error === 'AUTH') {
      if (res.reason === 'no_permission') return (toolName || 'このツール') + 'を使う権限がありません。';
      return 'ログインの期限が切れました。\nポータルから開き直してください。';
    }
    return '開けませんでした：' + res.error;
  };

  // ===== APIの呼び出し(一時的な失敗は、retry のときだけ1回やり直す。提出など二重に送りたくないものは retry なし) =====
  function call(api, token, action, extra, opt) {
    opt = opt || {};
    var payload = { action: action, token: token };
    if (opt.app) payload.app = opt.app;
    var body = JSON.stringify(Object.assign(payload, extra || {}));
    function once() {
      var status = 0;
      return fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })
        .then(function (r) { status = r.status; return r.text(); }, function (e) {
          var err = new Error('通信できませんでした(' + (e && e.message ? e.message : e) + ')'); err.stage = 'fetch'; throw err;
        })
        .then(function (t) {
          try { return JSON.parse(t); } catch (e) {
            var err = new Error('正しい返事ではありませんでした(' + status + '): ' + String(t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160));
            err.stage = 'response'; throw err;
          }
        });
    }
    return once().catch(function (e) {
      if (!opt.retry) throw e;
      return new Promise(function (ok) { setTimeout(ok, 800); }).then(once);
    });
  }

  // ===== ページの始まり：通行証の確認＋ヘッダー =====
  //   opt：{ tool: 'staff'(ツールID), title: '画面の名前', header: true(ヘッダーを出す) }
  //   戻り値：{ S, api, call(action, extra, opt) }。だめなら入口の画面に理由を出して null
  Portal.start = function (opt) {
    opt = opt || {};
    Portal.T0 = Date.now();
    ensureGate();
    Portal.gate('準備しています…', { loading: true });
    var S = Portal.session();
    if (!Portal.sessionOk(S)) { Portal.gate('ポータルから開き直してください。\n(ログインの期限が切れたか、直接開かれました)', { back: true }); return null; }
    var api = S.apis ? S.apis[opt.tool] : '';
    if (!api) { Portal.gate((opt.title || 'このツール') + 'を開く権限がないか、ポータルの設定が足りません。\nポータルから開き直してください。', { back: true }); return null; }
    if (opt.header !== false) Portal.header(opt.title, S.name);
    if (opt.title) document.title = opt.title;
    Portal.TOOL = opt.tool;
    // 表示までの時間を記録(重い画面を見つけるため)。ページが隠れたときにまとめて送る
    window.addEventListener('pagehide', function () { Portal.perfFlush(true); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') Portal.perfFlush(true); });
    return { S: S, api: api, call: function (action, extra, o) {
      var t0 = Date.now();
      return call(api, S.token, action, extra, o).then(function (r) {
        Portal.perfAdd(opt.tool, action, Date.now() - t0, r && r.ok !== false ? 'OK' : String(r && r.error || 'NG'));
        return r;
      }, function (e) {
        Portal.perfAdd(opt.tool, action, Date.now() - t0, '通信失敗');
        throw e;
      });
    } };
  };

  // ===== 動作の記録(どの画面のどの操作が何秒かかったか)。認証基盤の「動作の記録」シートに、10分おきにまとめて入る =====
  //   中身はツール・操作・秒・結果だけ(入力した内容は送らない)。送り先は認証基盤(ポータルが portal_session.apis._auth に入れる)
  var PERF_KEY = 'perf_buf';
  Portal.perfAdd = function (tool, action, ms, result) {
    try {
      var buf = JSON.parse(sessionStorage.getItem(PERF_KEY) || '[]');
      buf.push([Date.now(), tool, action, ms, result]);
      sessionStorage.setItem(PERF_KEY, JSON.stringify(buf.slice(-60)));
      if (buf.length >= 10) Portal.perfFlush(false);
    } catch (e) {}
  };
  Portal.perfFlush = function (leaving) {
    try {
      var S = Portal.session();
      var buf = JSON.parse(sessionStorage.getItem(PERF_KEY) || '[]');
      if (!buf.length || !S || !S.token || !S.apis || !S.apis._auth) return;
      sessionStorage.removeItem(PERF_KEY);
      fetch(S.apis._auth, { method: 'POST', keepalive: !!leaving, headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'perf.log', token: S.token, items: buf }) }).catch(function () {});
    } catch (e) {}
  };

  // ヘッダー(‹ ポータル・画面の名前・名前)。<header id="pHeader"> があればそこに、なければ #app の先頭に作る
  Portal.header = function (title, name) {
    var h = Portal.$('pHeader');
    if (!h) {
      h = document.createElement('header');
      h.id = 'pHeader';
      var app = Portal.$('app') || document.body;
      app.insertBefore(h, app.firstChild);
    }
    h.className = 'p-header';
    // 右上の名前：マイページを使える人は、押すとマイページへ(マイページの画面では押せない)
    var S0 = Portal.session() || {}, toMy = S0.apis && S0.apis.mypage && !/\/mypage\//.test(location.pathname);
    var nm = Portal.esc(name ? name + ' さん' : '');
    h.innerHTML = '<div class="p-top"><a href="' + Portal.PORTAL_URL + '">‹ ポータル</a>' + (toMy ? '<a href="../mypage/" style="text-decoration:underline;">' + nm + '</a>' : '<span>' + nm + '</span>') + '</div>' +
      '<h1>' + Portal.esc(title || '') + '</h1>';
  };

  // 開くまでの時間の表示(画面の下などに)
  Portal.timing = function (pageVersion, how) {
    return 'ver ' + pageVersion + '・開くまで ' + ((Date.now() - (Portal.T0 || Date.now())) / 1000).toFixed(1) + '秒' + (how ? '(' + how + ')' : '');
  };

  // ===== ポータルの先読み(minutes 分以内のものだけ) =====
  Portal.prefetched = function (name, minutes) {
    try {
      var x = JSON.parse(sessionStorage.getItem('prefetch_' + name) || 'null');
      return x && Date.now() - x.at < (minutes || 3) * 60 * 1000 ? x : null;
    } catch (e) { return null; }
  };

  // ===== 入力途中の自動保存(端末の中。通行証などの秘密は入れない) =====
  //   key：'shift_2026-11' など。days：この日数より古いものは読まない・掃除する
  Portal.draft = function (key, days) {
    var full = 'draft_' + key, maxMs = (days || 7) * 24 * 60 * 60 * 1000, last = '';
    return {
      read: function () {
        try { var x = JSON.parse(localStorage.getItem(full) || 'null'); return x && x.data && Date.now() - x.at < maxMs ? x : null; } catch (e) { return null; }
      },
      save: function (data) {
        try { var j = JSON.stringify(data); if (j === last) return; last = j; localStorage.setItem(full, JSON.stringify({ at: Date.now(), data: data })); } catch (e) {}
      },
      clear: function () { try { localStorage.removeItem(full); last = ''; } catch (e) {} },
      cleanup: function (prefix) { // 同じ種類(prefix)の古い下書きを掃除
        try {
          for (var i = localStorage.length - 1; i >= 0; i--) {
            var k = localStorage.key(i);
            if (!k || k.indexOf('draft_' + (prefix || '')) !== 0) continue;
            var x = JSON.parse(localStorage.getItem(k) || 'null');
            if (!x || Date.now() - x.at > maxMs) localStorage.removeItem(k);
          }
        } catch (e) {}
      },
    };
  };

  // ===== 画面オフの抑止(フォームを開いている間。対応端末だけ) =====
  //   onState('有効' / '非対応' / '使えません' / '解除')
  Portal.keepAwake = function (onState) {
    var lock = null;
    var say = function (t) { if (onState) onState(t); };
    function request() {
      if (!('wakeLock' in navigator)) { say('非対応'); return; }
      navigator.wakeLock.request('screen').then(function (l) {
        lock = l; say('有効');
        l.addEventListener('release', function () { say('解除'); });
      }).catch(function () { say('使えません'); });
    }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') request(); });
    request();
    return { release: function () { if (lock) { try { lock.release(); } catch (e) {} } } };
  };

  w.Portal = Portal;
})(window);
