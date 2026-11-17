// calendar/todo.js
// 2026-12-17：営業の情報(休業・料金区分・祝日・トピック/イベント。締めチェック管理簿のカレンダー)も重ねて出す(営業カレンダーの画面の役割をシフトカレンダーに寄せる)
// シフトカレンダーに、共有のTODOリストの期限を出す(2026-12-16)。未完了のタスクを、期限の日のマスと、日を押したときの下に出す
//   index.html の一番下で読む：<script src="todo.js?v=4"></script>。TODOリストを使う権限がない人には何も出ない
(function () {
  if (typeof renderCal !== 'function') return;
  var TODO = {}, LOADED = '', BIZ = {};
  var BZSHOW = (function () { try { return localStorage.getItem('cal_bz_show') || ''; } catch (e) { return ''; } })(); // 営業の表示：''＝全店舗 ／ 店舗コード＝その店舗だけ(2026-12-17)
  // 店舗の色：ポータル設定の店舗一覧の「色」があれば、カレンダー全体(シフトの色・凡例・営業・イベント)でそれを使う(2026-12-17)
  var MCOL = null;
  function useMasterColors(list) {
    var o = {}; (list || []).forEach(function (s2) { if (s2.color) o[s2.code] = s2.color; });
    if (!Object.keys(o).length || MCOL) return;
    MCOL = o;
    var base = colorOf;
    colorOf = function (code) { return MCOL[code] || base(code); };
    try { g('legend').innerHTML = C.stores.map(function (s2) { return '<span><i style="background:' + colorOf(s2.code) + '"></i>' + esc(s2.name) + (s2.open ? '' : '(未公開)') + '</span>'; }).join(''); } catch (e) {}
  }
  // Shift.gs が店舗の色を返していれば、最初からその色にする(2026-12-18)
  (function () { try { if (C && C.stores && C.stores.some(function (x) { return x.color; })) useMasterColors(C.stores); } catch (e) {} })();
  var SHORT = {};
  function shortOf(code, name) { return SHORT[code] || shortName(name); }
  function shortName(n) { return String(n).replace(/^(Sauna Base |SAUNA )/i, '').slice(0, 8); }
  function bzStores(bz) { return bz.stores.filter(function (s2) { return !BZSHOW || s2.code === BZSHOW; }); }
  function tint(code) { var c = typeof colorOf === 'function' ? colorOf(code) : '#5F6670'; return 'background:' + c + '1A !important;color:' + c + ';border:1px solid ' + c + '66'; }
  // 営業の表示の切り替え(凡例の下)
  function paintSwitch() {
    var bz = C && BIZ[C.month], box = document.getElementById('bzSw');
    if (!bz || bz.stores.length < 2) { if (box) box.remove(); return; }
    if (!box) { document.getElementById('cal').insertAdjacentHTML('beforebegin', '<div id="bzSw" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 8px;font-size:13px;"></div>'); box = document.getElementById('bzSw'); }
    box.innerHTML = '<span style="color:var(--muted);">営業・イベントの表示：</span>' + [{ code: '', name: '全店舗' }].concat(bz.stores).map(function (s2) {
      var on = BZSHOW === s2.code;
      return '<button data-bzs="' + esc(s2.code) + '" style="padding:4px 12px;border-radius:999px;font-size:13px;cursor:pointer;font-family:inherit;border:1px solid ' + (s2.code ? colorOf(s2.code) : '#B9C0C8') + ';' +
        (on ? 'background:' + (s2.code ? colorOf(s2.code) : '#16323A') + ';color:#fff;font-weight:700;' : 'background:#fff;color:' + (s2.code ? colorOf(s2.code) : 'var(--ink)') + ';') + '">' + esc(s2.code ? shortOf(s2.code, s2.name) : s2.name) + '</button>';
    }).join('');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-bzs]'); if (!b) return;
    BZSHOW = b.getAttribute('data-bzs'); try { localStorage.setItem('cal_bz_show', BZSHOW); } catch (x) {}
    origCal(); origDetail();
  });
  var css = document.createElement('style');
  css.textContent = '.chip.todo{background:#EFEAF7 !important;color:#4B3480;border:1px solid #CBBFE6}.chip.todo.late{background:#FDECEA !important;color:#B42318;border-color:#F2B8B5}' +
    '.chip.biz{background:#EEF0F2 !important;color:#5F6670;border:1px solid #D5DAE0}.chip.biz.tp{background:#FFF4DA !important;color:#8A5A00;border-color:#F2D58A}.day.closed{background:#F1F3F5 !important}' +
    '.bzs{margin-top:10px;border-top:1px dashed var(--line);padding-top:8px}.bz1{font-size:14px;padding:4px 0;border-bottom:1px solid #EEF1F4}.bz1 .cl{color:#B42318;font-weight:700}.bz1 ul{margin:2px 0 0 18px;padding:0}' +
    '.tds{margin-top:10px;border-top:1px dashed var(--line);padding-top:8px}.td1{font-size:14px;padding:4px 0;border-bottom:1px solid #EEF1F4}.td1 .sf{font-size:11px;color:#6B4FA0;font-weight:700;margin-left:4px}';
  document.head.appendChild(css);
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fetchTodo() {
    if (!C || LOADED === C.month) return;
    LOADED = C.month;
    var m = C.month;
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ app: 'todo', action: 'todo.list', token: S.token, month: m }) })
      .then(function (r) { return r.text(); }).then(function (t) { return JSON.parse(t); })
      .then(function (r) { if (!r.ok) return; TODO[m] = r.items.filter(function (x) { return !x.done; }); if (C && C.month === m) { origCal(); origDetail(); } })
      .catch(function () {});
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ app: 'todo', action: 'biz.month', token: S.token, month: m }) })
      .then(function (r) { return r.text(); }).then(function (t) { return JSON.parse(t); })
      .then(function (r) { if (!r.ok) return; BIZ[m] = r; (r.stores || []).forEach(function (x) { if (x.short) SHORT[x.code] = x.short; }); useMasterColors(r.stores); if (C && C.month === m) { origCal(); origDetail(); if (typeof renderNext === 'function') renderNext(); if (typeof VIEW !== 'undefined' && VIEW === 'all') renderAll(); } })
      .catch(function () {});
  }
  function list(d) { var ym = C.month; var key = ym + '-' + ('0' + d).slice(-2); return (TODO[ym] || []).filter(function (x) { return x.due === key; }); }
  var origCal0 = renderCal, origDetail0 = renderDetail;
  function origCal() {
    origCal0();
    paintSwitch();
    var t = today(), bz = BIZ[C.month];
    Array.prototype.forEach.call(document.querySelectorAll('#cal .day[data-d]'), function (el) {
      if (bz) {
        var d = Number(el.getAttribute('data-d')), ss = bzStores(bz).map(function (s2) { return { s: s2, x: (bz.days[s2.code] || {})[d] }; }).filter(function (z) { return z.x; });
        var closed = ss.filter(function (z) { return z.x.closed; });
        if (ss.length && closed.length === ss.length) { el.classList.add('closed'); el.insertAdjacentHTML('beforeend', '<span class="chip biz">休業</span>'); }
        else if (closed.length) el.insertAdjacentHTML('beforeend', '<span class="chip biz">休：' + esc(closed.map(function (z) { return shortOf(z.s.code, z.s.name); }).join('・')) + '</span>');
        // トピック・イベントは店舗ごとに1つずつ、店舗の色で(全店舗のときは頭に店舗の略称)
        ss.forEach(function (z) {
          if (!z.x.topics.length) return;
          el.insertAdjacentHTML('beforeend', '<span class="chip biz" style="' + tint(z.s.code) + '">' + (BZSHOW ? '★ ' : esc(shortOf(z.s.code, z.s.name)).slice(0, 4) + '★') + esc(z.x.topics[0]) + (z.x.topics.length > 1 ? ' 他' + (z.x.topics.length - 1) : '') + '</span>');
        });
      }
      list(Number(el.getAttribute('data-d'))).forEach(function (x) {
        el.insertAdjacentHTML('beforeend', '<span class="chip todo' + (x.due < t ? ' late' : '') + '">☐ ' + esc(x.title) + '</span>');
      });
    });
  }
  function origDetail() {
    origDetail0();
    var bz = C && BIZ[C.month];
    if (bz && DAY && g('detail')) {
      var rows = bzStores(bz).map(function (s2) {
        var x = (bz.days[s2.code] || {})[DAY]; if (!x) return '';
        return '<div class="bz1" style="border-left:4px solid ' + colorOf(s2.code) + ';padding-left:8px;"><b style="color:' + colorOf(s2.code) + '">' + esc(s2.name) + '</b>　' + (x.closed ? '<span class="cl">休業</span>' : '営業・' + esc(x.price)) + (x.hol ? '　' + esc(x.hol) : '') +
          (x.topics.length ? '<ul>' + x.topics.map(function (tp) { return '<li>' + esc(tp) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
      }).join('');
      if (rows) g('detail').insertAdjacentHTML('beforeend', '<div class="bzs"><div style="font-weight:700;font-size:14px;">営業</div>' + rows + '</div>');
    }
    var xs = C && DAY ? list(DAY) : [];
    if (!xs.length || !g('detail')) return;
    g('detail').insertAdjacentHTML('beforeend', '<div class="tds"><div style="font-weight:700;font-size:14px;">TODO(この日が期限)</div>' + xs.map(function (x) {
      return '<div class="td1">☐ ' + esc(x.title) + (x.scope === '社員のみ' ? '<span class="sf">社員のみ</span>' : '') + (x.who ? '<span class="muted">　担当 ' + esc(x.who) + '</span>' : '') + '</div>';
    }).join('') + '<div class="muted" style="margin-top:4px;">完了にするのは、ポータルの「TODOリスト」から</div></div>');
  }
  renderCal = function () { origCal(); fetchTodo(); };
  renderDetail = function () { origDetail(); };
  if (C) { renderCal(); renderDetail(); }
})();
