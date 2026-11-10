// shiftboard/extra.js
// シフト作成の追加(2026-12)：シフト希望の「日のひとこと」と「他店でもOK」を見せる・他店OKの人を候補に出す
//   index.html の一番下(</body> の直前)で読み込む：<script src="extra.js?v=1"></script>
//   Bot の board.get が返す B.extra = { uid: { 日: { note, other:['10:00-13:00@BUG', …] } } } を使う(無ければ何もしない)
(function () {
  if (typeof renderDay !== 'function') return;
  function ex(uid, d) { return ((B && B.extra) || {})[uid] ? (B.extra[uid][d] || null) : null; }
  function rangesOf(x) { return (x && x.other || []).map(function (o) { var p = String(o).split('@')[0].split('-'); return { s: p[0], e: p[1], store: String(o).split('@')[1] || '' }; }); }
  function stName(code) { var st = storeOf(code); return st ? st.name : code; }

  // 1. 日ごとの表と調整の欄に、ひとこと・他店OKを足す
  var origRender = renderDay;
  renderDay = function () {
    origRender.apply(this, arguments);
    try { decorate(); } catch (e) {}
  };
  function decorate() {
    Array.prototype.forEach.call(document.querySelectorAll('#grid tr.staff[data-u]'), function (tr) {
      var x = ex(tr.getAttribute('data-u'), DAY); if (!x) return;
      var c2 = tr.querySelector('td.c2'); if (!c2) return;
      var h = '';
      var oth = rangesOf(x);
      if (oth.length) h += '<div class="other" style="color:#1F7A3D;">他店でもOK：' + esc(oth.map(function (r) { return r.s + '-' + r.e; }).join(' / ')) + '</div>';
      if (x.note) h += '<div class="evm">📝 ' + esc(x.note) + '</div>';
      c2.insertAdjacentHTML('beforeend', h);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#panelBody tr[data-u]'), function (tr) {
      var x = ex(tr.getAttribute('data-u'), DAY); if (!x) return;
      var nm = tr.querySelector('td.nm'); if (!nm) return;
      var oth = rangesOf(x);
      nm.insertAdjacentHTML('beforeend', (oth.length ? '<div class="other" style="color:#1F7A3D;font-weight:400;">他店OK</div>' : '') + (x.note ? '<div class="evm">📝 ' + esc(x.note) + '</div>' : ''));
    });
  }

  // 2. 「希望の外の人を入れる」に、ほかの店舗の人で、この日に「他店でもOK」の人を上に出す
  var origFill = fillAddOut;
  fillAddOut = function () {
    origFill.apply(this, arguments);
    try { addOtherOk(); } catch (e) {}
  };
  function addOtherOk() {
    var sel = g('addOut'); if (!sel || !B) return;
    var shown = {};
    Array.prototype.forEach.call(document.querySelectorAll('#grid tr[data-u], #panelBody tr[data-u]'), function (tr) { shown[tr.getAttribute('data-u')] = 1; });
    var have = {}; Array.prototype.forEach.call(sel.options, function (o) { have[o.value] = 1; });
    var list = Object.keys(B.extra || {}).filter(function (u) {
      var x = ex(u, DAY); if (!x || !rangesOf(x).length || shown[u]) return false;
      return rangesOf(x).some(function (r) { return r.store !== STORE; }); // この店舗以外の希望で「他店でもOK」
    });
    if (!list.length) return;
    var grp = document.createElement('optgroup');
    grp.label = '他店でもOK(この日)';
    list.forEach(function (u) {
      if (have[u]) { var old = sel.querySelector('option[value="' + u.replace(/"/g, '') + '"]'); if (old) old.parentNode.removeChild(old); }
      var p = B.staff[u] || { name: u };
      var o = document.createElement('option');
      o.value = u;
      o.textContent = p.name + '(' + rangesOf(ex(u, DAY)).map(function (r) { return stName(r.store) + ' ' + r.s + '-' + r.e; }).join(' / ') + ')';
      grp.appendChild(o);
    });
    sel.insertBefore(grp, sel.options[1] || null);
    g('addOutBtn').disabled = !!B.readonly;
  }

  // 3. 他店でもOKの時間の中なら、確定に入れるときの「本人に確認しましたか？」を聞かない
  var origOk = outsideOk;
  outsideOk = function (uid, s, e) {
    var x = ex(uid, DAY);
    if (x && rangesOf(x).some(function (r) { return mins(r.s) <= s && e <= mins(r.e); })) return true;
    return origOk.apply(this, arguments);
  };

  // 4. 他店でもOKの人を「行を足す」ときは、確認を出さずに足す(もとの処理より先に動く)
  g('addOutBtn').addEventListener('click', function (e) {
    var u = g('addOut').value, x = u ? ex(u, DAY) : null;
    if (!x || !rangesOf(x).length) return; // ふだんの人は、もとの処理(本人に確認しましたか？)へ
    e.stopImmediatePropagation();
    var k = key(STORE, DAY);
    (ADDED[k] = ADDED[k] || []).push(u);
    renderDay();
    g('msg').textContent = (B.staff[u] || { name: u }).name + 'さん(他店でもOK)の行を足しました。他店OKの時間の中でドラッグして時間を決めてください';
  }, true);

  if (B) renderDay(); // 先読みで先に表示していたら、すぐ反映
})();
