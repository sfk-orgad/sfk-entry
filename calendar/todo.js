// calendar/todo.js
// 2026-12-17：営業の情報(休業・料金区分・祝日・トピック/イベント。締めチェック管理簿のカレンダー)も重ねて出す(営業カレンダーの画面の役割をシフトカレンダーに寄せる)
// シフトカレンダーに、共有のTODOリストの期限を出す(2026-12-16)。未完了のタスクを、期限の日のマスと、日を押したときの下に出す
//   index.html の一番下で読む：<script src="todo.js?v=2"></script>。TODOリストを使う権限がない人には何も出ない
(function () {
  if (typeof renderCal !== 'function') return;
  var TODO = {}, LOADED = '', BIZ = {};
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
      .then(function (r) { if (!r.ok) return; BIZ[m] = r; if (C && C.month === m) { origCal(); origDetail(); } })
      .catch(function () {});
  }
  function list(d) { var ym = C.month; var key = ym + '-' + ('0' + d).slice(-2); return (TODO[ym] || []).filter(function (x) { return x.due === key; }); }
  var origCal0 = renderCal, origDetail0 = renderDetail;
  function origCal() {
    origCal0();
    var t = today(), bz = BIZ[C.month];
    Array.prototype.forEach.call(document.querySelectorAll('#cal .day[data-d]'), function (el) {
      if (bz) {
        var d = Number(el.getAttribute('data-d')), ss = bz.stores.map(function (s2) { return { s: s2, x: (bz.days[s2.code] || {})[d] }; }).filter(function (z) { return z.x; });
        var closed = ss.filter(function (z) { return z.x.closed; });
        if (ss.length && closed.length === ss.length) { el.classList.add('closed'); el.insertAdjacentHTML('beforeend', '<span class="chip biz">休業</span>'); }
        else if (closed.length) el.insertAdjacentHTML('beforeend', '<span class="chip biz">休：' + esc(closed.map(function (z) { return z.s.name.replace(/^(SAUNA |Sauna Base )/i, '').slice(0, 4); }).join('・')) + '</span>');
        var tp = []; ss.forEach(function (z) { z.x.topics.forEach(function (x) { if (tp.indexOf(x) === -1) tp.push(x); }); });
        if (tp.length) el.insertAdjacentHTML('beforeend', '<span class="chip biz tp">★ ' + esc(tp[0]) + (tp.length > 1 ? ' 他' + (tp.length - 1) : '') + '</span>');
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
      var rows = bz.stores.map(function (s2) {
        var x = (bz.days[s2.code] || {})[DAY]; if (!x) return '';
        return '<div class="bz1"><b>' + esc(s2.name) + '</b>　' + (x.closed ? '<span class="cl">休業</span>' : '営業・' + esc(x.price)) + (x.hol ? '　' + esc(x.hol) : '') +
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
