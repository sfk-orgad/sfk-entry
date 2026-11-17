// calendar/todo.js
// シフトカレンダーに、共有のTODOリストの期限を出す(2026-12-16)。未完了のタスクを、期限の日のマスと、日を押したときの下に出す
//   index.html の一番下で読む：<script src="todo.js?v=1"></script>。TODOリストを使う権限がない人には何も出ない
(function () {
  if (typeof renderCal !== 'function') return;
  var TODO = {}, LOADED = '';
  var css = document.createElement('style');
  css.textContent = '.chip.todo{background:#EFEAF7 !important;color:#4B3480;border:1px solid #CBBFE6}.chip.todo.late{background:#FDECEA !important;color:#B42318;border-color:#F2B8B5}' +
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
  }
  function list(d) { var ym = C.month; var key = ym + '-' + ('0' + d).slice(-2); return (TODO[ym] || []).filter(function (x) { return x.due === key; }); }
  var origCal0 = renderCal, origDetail0 = renderDetail;
  function origCal() {
    origCal0();
    var t = today();
    Array.prototype.forEach.call(document.querySelectorAll('#cal .day[data-d]'), function (el) {
      list(Number(el.getAttribute('data-d'))).forEach(function (x) {
        el.insertAdjacentHTML('beforeend', '<span class="chip todo' + (x.due < t ? ' late' : '') + '">☐ ' + esc(x.title) + '</span>');
      });
    });
  }
  function origDetail() {
    origDetail0();
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
