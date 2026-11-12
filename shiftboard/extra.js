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

// =====================================================================
// 有給(社員のみ)・稼働と残業・遅れての提出の解禁(2026-12-13)。Bot の ShiftExtra.gs(app=sx)
//   ・月の一覧とチェックの下に「社員の有給・稼働・残業」：日のマスを押すと有給(1日／午前半休／午後半休)を入れる・取り消す
//     稼働日・実働・残業は、予定(確定シフト)と実績(打刻)の両方。残業＝1日8時間超＋週40時間超(月曜から。1日の分は除く)。有給の日は実働に入れない
//   ・日ごとの表：有給の日は名前の横に「有給」
//   ・この店舗の未提出の欄：人ごとに「解禁」(締め切り後でも、その人だけ提出できる。期限つき・本人に知らせる)と、解禁中の一覧
// =====================================================================
(function () {
  if (typeof renderAll !== 'function') return;
  var SXD = null, SXKEY = '';
  var KIND_SHORT = { '有給': '有', '午前半休': '前', '午後半休': '後' };
  function sxCall(action, extra) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ app: 'sx', action: action, token: S.token }, extra || {})) })
      .then(function (r) { return r.text(); }).then(function (t) { return JSON.parse(t); });
  }
  function loadSx(force) {
    var k = B.month + '|' + STORE;
    if (!force && SXKEY === k && SXD) { refresh(); return; }
    SXKEY = k;
    sxCall('sx.board', { month: B.month, store: STORE }).then(function (r) { SXD = r && r.ok ? r : { error: r ? r.error : '', employees: [], balances: {}, leaves: [], actual: {}, unlocks: [] }; refresh(); })
      .catch(function () { SXD = { error: '通信に失敗しました', employees: [], balances: {}, leaves: [], actual: {}, unlocks: [] }; refresh(); });
  }
  function refresh() { try { decorateUnsub(); decorateDayLeave(); if (!g('vMonth').hidden) renderMonth(); } catch (e) {} }
  function leaveOf(uid, d) { return SXD ? (SXD.leaves || []).filter(function (x) { return x[0] === uid && x[1] === d; })[0] : null; }
  function isEmp(uid) { return !!SXD && (SXD.employees || []).indexOf(uid) !== -1; }

  var origAll = renderAll;
  renderAll = function () { origAll.apply(this, arguments); loadSx(false); };
  var origDay2 = renderDay;
  renderDay = function () { origDay2.apply(this, arguments); try { decorateDayLeave(); } catch (e) {} };
  var origUnsub = renderUnsub;
  renderUnsub = function () { origUnsub.apply(this, arguments); try { decorateUnsub(); } catch (e) {} };

  // ----- 日ごとの表：有給の印 -----
  function decorateDayLeave() {
    if (!SXD) return;
    Array.prototype.forEach.call(document.querySelectorAll('#grid tr.staff[data-u]'), function (tr) {
      var u = tr.getAttribute('data-u'), lv = leaveOf(u, DAY), c0 = tr.querySelector('td.c0');
      if (!lv || !c0 || c0.querySelector('.lvtag')) return;
      var clash = confOf(STORE, DAY).some(function (c) { return c[0] === u; });
      c0.insertAdjacentHTML('beforeend', '<div class="lvtag" style="font-size:11px;color:#1F7A3D;font-weight:700;">🌴 ' + esc(lv[2]) + (clash && lv[2] === '有給' ? ' <span style="color:#B42318;">(確定シフトもある)</span>' : '') + '</div>');
    });
  }

  // ----- 未提出の欄：解禁 -----
  function untilLabel(ymd) { var p = ymd.split('-'); return Number(p[1]) + '/' + Number(p[2]); }
  function decorateUnsub() {
    if (!B || !g('unsub')) return;
    var list = (B.unsubmitted[STORE] || []);
    var unl = (SXD && SXD.unlocks) || [];
    var on = {}; unl.forEach(function (x) { if (x.active) on[x.uid] = x; });
    var h = list.length ? list.map(function (u) {
      var p = B.staff[u] || {}, x = on[u];
      return '<div style="display:flex;align-items:center;gap:6px;margin:3px 0;"><span style="flex:1;">' + esc(p.name || u) + (p.grade ? '(' + esc(p.grade) + ')' : '') + '</span>' +
        (x ? '<span style="font-size:11px;color:#1F7A3D;">解禁中 ' + untilLabel(x.until) + 'まで</span>' : (B.readonly ? '' : '<button class="mini2" data-unlock="' + esc(u) + '">解禁</button>')) + '</div>';
    }).join('') : 'なし';
    var others = unl.filter(function (x) { return list.indexOf(x.uid) === -1; });
    if (unl.length) h += '<div style="margin-top:8px;font-weight:700;color:var(--ink);">提出の解禁(この月)</div>' + unl.map(function (x) {
      return '<div style="display:flex;align-items:center;gap:6px;margin:3px 0;"><span style="flex:1;">' + esc(x.name) + '　' + untilLabel(x.until) + 'まで' + (x.active ? '' : '(終了)') + '</span>' +
        (B.readonly ? '' : '<button class="mini2" data-unlockdel="' + esc(x.uid) + '">取り消し</button>') + '</div>';
    }).join('');
    if (!B.readonly) h += '<div style="margin-top:8px;">提出済みの人も解禁：<select id="unlockAny" style="font-size:12px;padding:2px 4px;"><option value="">(選ぶ)</option>' +
      Object.keys(B.staff).filter(function (u) { var p = B.staff[u]; return list.indexOf(u) === -1 && (p.stores || []).some(function (c) { return c === '*' || c === STORE; }); })
        .sort(function (a, b) { return String(B.staff[a].name).localeCompare(String(B.staff[b].name), 'ja'); })
        .map(function (u) { return '<option value="' + esc(u) + '">' + esc(B.staff[u].name) + '</option>'; }).join('') +
      '</select> <button class="mini2" id="unlockAnyBtn">解禁</button></div><div style="font-size:11px;margin-top:4px;">解禁すると、締め切り後でもその人だけ、この月の希望を出し直せます(期限つき・本人に知らせる)</div>';
    g('unsub').innerHTML = h;
  }
  function doUnlock(u) {
    var p = B.staff[u] || { name: u }, st = storeOf(STORE);
    var d = prompt(p.name + 'さんに、' + st.name + 'の' + B.label + '分の提出を解禁します。\n何日間受け付けますか？(1〜14。今日を含む)', '3');
    if (d === null) return;
    d = Number(d); if (!(d >= 1 && d <= 14)) { alert('1〜14の数で入れてください'); return; }
    var notify = confirm('本人に LINE WORKS で知らせますか？\n［OK］知らせる　［キャンセル］知らせない');
    g('msg').textContent = '解禁しています…';
    sxCall('sx.unlock', { month: B.month, store: STORE, uid: u, days: d, notify: notify }).then(function (r) {
      if (!r.ok) { g('msg').textContent = '解禁できませんでした：' + r.error; return; }
      g('msg').textContent = p.name + 'さんの提出を ' + untilLabel(r.until) + ' まで解禁しました' + (notify ? (r.sent ? '(本人に知らせました)' : '(お試し中のため、本人には送っていません)') : '');
      loadSx(true);
    }).catch(function () { g('msg').textContent = '通信に失敗しました'; });
  }
  g('unsub').addEventListener('click', function (e) {
    var b = e.target.closest('[data-unlock]'), del = e.target.closest('[data-unlockdel]');
    if (b) return doUnlock(b.getAttribute('data-unlock'));
    if (del) {
      var u = del.getAttribute('data-unlockdel');
      if (!confirm((B.staff[u] || { name: u }).name + 'さんの解禁を取り消しますか？')) return;
      sxCall('sx.unlockDel', { month: B.month, store: STORE, uid: u }).then(function () { loadSx(true); });
      return;
    }
    if (e.target.id === 'unlockAnyBtn') { var v = g('unlockAny').value; if (!v) { alert('解禁する人を選んでください'); return; } doUnlock(v); }
  });

  // ----- 月の一覧：社員の有給・稼働・残業 -----
  function otStats(works, y, m, last) {
    var days = 0, total = 0, dayOT = 0, weekOT = 0, base = 0;
    for (var d = 1; d <= last; d++) {
      var w = works[d] || 0;
      if (w > 0) { days++; total += w; dayOT += Math.max(0, w - 480); base += Math.min(w, 480); }
      if (new Date(y, m - 1, d).getDay() === 0 || d === last) { weekOT += Math.max(0, base - 2400); base = 0; }
    }
    return { days: days, work: total, ot: dayOT + weekOT };
  }
  var origMonth = renderMonth;
  renderMonth = function () {
    origMonth.apply(this, arguments);
    var box = document.createElement('div');
    box.id = 'lvBox'; box.style.marginTop = '16px';
    g('vMonth').appendChild(box);
    if (!SXD) { box.innerHTML = '<div class="muted">社員の有給・残業を読み込んでいます…</div>'; return; }
    if (SXD.error) { box.innerHTML = '<div class="muted">社員の有給・残業を読めませんでした：' + esc(SXD.error) + '(Bot の更新が必要かもしれません)</div>'; return; }
    var y = Number(B.month.slice(0, 4)), m = Number(B.month.slice(5, 7)), last = B.days.length;
    var emps = (SXD.employees || []).filter(function (u) { var p = B.staff[u]; return p && (p.stores || []).some(function (c) { return c === '*' || c === STORE; }); })
      .sort(function (a, b) { return byStaff(a, b); });
    var h = '<h3 style="margin:4px 0;">社員の有給・稼働・残業</h3><div class="muted">日のマスを押すと有給を入れられます(有＝1日・前＝午前半休・後＝午後半休)。予定＝確定シフト(全店舗)、実績＝打刻。残業＝1日8時間超＋週40時間超(月曜から)。有給の日は実働・残業に入れません。</div>';
    if (!emps.length) { box.innerHTML = h + '<div class="muted" style="margin-top:6px;">この店舗の社員がいません</div>'; return; }
    h += '<div class="grid-wrap" style="margin-top:6px;"><table class="mt"><tr><th>氏名</th>' + B.days.map(function (x) {
      return '<th class="' + (x.hol || x.w === 0 ? 'sun' : x.w === 6 ? 'sat' : '') + '">' + x.d + '<br>' + W.charAt(x.w) + '</th>';
    }).join('') + '<th>稼働日<br>予定</th><th>実働<br>予定</th><th>残業<br>予定</th><th>実働<br>実績</th><th>残業<br>実績</th><th>有給<br>この月</th><th>有給の<br>残り</th><th>年5日</th></tr>';
    emps.forEach(function (u) {
      var plan = {}, act = (SXD.actual || {})[u] || {}, lvSum = 0;
      for (var d = 1; d <= last; d++) { var w = dayWork(u, d).work; if (w > 0) plan[d] = w; }
      var ps = otStats(plan, y, m, last), as = otStats(act, y, m, last), b = SXD.balances[u] || {};
      h += '<tr><td class="nm">' + esc(nameOfU(u)) + '</td>' + B.days.map(function (x) {
        var lv = leaveOf(u, x.d), w = plan[x.d];
        if (lv) lvSum += lv[3];
        var bg = lv ? 'background:#E3F4E8;color:#1F7A3D;font-weight:700;' : (w ? '' : 'color:#B0B6BD;');
        return '<td data-lv="' + esc(u) + '|' + x.d + '" style="cursor:pointer;' + bg + '" title="' + (w ? hrs(w) + '時間' : '') + '">' + (lv ? KIND_SHORT[lv[2]] || '有' : (w ? '●' : '・')) + '</td>';
      }).join('') +
        '<td class="sum">' + ps.days + '</td><td class="sum">' + hrs(ps.work) + '</td><td class="sum"' + (ps.ot ? ' style="color:#B42318;"' : '') + '>' + hrs(ps.ot) + '</td>' +
        '<td class="sum">' + hrs(as.work) + '</td><td class="sum"' + (as.ot ? ' style="color:#B42318;"' : '') + '>' + hrs(as.ot) + '</td>' +
        '<td class="sum">' + lvSum + '</td><td class="sum"' + (b.left < 3 ? ' style="color:#B42318;"' : '') + '>' + (b.noHire ? '入社日なし' : (b.left == null ? '' : b.left)) + '</td>' +
        '<td class="sum"' + (b.yearUsed != null && b.yearUsed < 5 ? ' style="color:#8A5A00;"' : '') + '>' + (b.yearUsed == null ? '―' : b.yearUsed + '/5') + '</td></tr>';
    });
    box.innerHTML = h + '</table></div><div class="muted" style="margin-top:4px;">●＝確定シフトのある日。時間は「時間」(例 8.5)。有給の残り＝今日の時点(予定の有給はまだ引いていない)。年5日＝付与日から1年の取得(予定を含む)。</div>';
  };
  // 有給を入れる小さなメニュー
  var menu = document.createElement('div');
  menu.style.cssText = 'display:none;position:fixed;z-index:80;background:#fff;border:1px solid #D5DAE0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);padding:8px;';
  document.body.appendChild(menu);
  var MENU_AT = null;
  g('vMonth').addEventListener('click', function (e) {
    var td = e.target.closest('[data-lv]'); if (!td || B.readonly) return;
    var p = td.getAttribute('data-lv').split('|'); MENU_AT = { uid: p[0], d: Number(p[1]) };
    var cur = leaveOf(MENU_AT.uid, MENU_AT.d);
    menu.innerHTML = '<div style="font-weight:700;margin-bottom:6px;">' + esc(nameOfU(MENU_AT.uid)) + '　' + MENU_AT.d + '日</div>' +
      ['有給', '午前半休', '午後半休'].map(function (k) { return '<button class="btn" data-k="' + k + '" style="margin:2px;' + (cur && cur[2] === k ? 'background:#E3F4E8;' : '') + '">' + k + '</button>'; }).join('') +
      (cur ? '<button class="btn" data-k="" style="margin:2px;">取り消し</button>' : '') + '<button class="btn" data-k="close" style="margin:2px;">閉じる</button>';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 300) + 'px'; menu.style.top = Math.min(e.clientY + 8, window.innerHeight - 120) + 'px'; menu.style.display = 'block';
  });
  menu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-k]'); if (!b || !MENU_AT) return;
    var k = b.getAttribute('data-k'); menu.style.display = 'none';
    if (k === 'close') return;
    var dd = B.month + '-' + ('0' + MENU_AT.d).slice(-2);
    var clash = k === '有給' && dayWork(MENU_AT.uid, MENU_AT.d).span > 0;
    if (clash && !confirm('この日は確定シフトがあります。有給にしますか？(確定シフトは自分で消してください)')) return;
    g('msg').textContent = '有給を保存しています…';
    sxCall('sx.leave', { date: dd, uid: MENU_AT.uid, kind: k }).then(function (r) {
      g('msg').textContent = r.ok ? (k ? nameOfU(MENU_AT.uid) + 'さん ' + MENU_AT.d + '日を ' + k + ' にしました' : '有給を取り消しました') : '保存できませんでした：' + r.error;
      loadSx(true);
    }).catch(function () { g('msg').textContent = '通信に失敗しました'; });
  });

  if (B) loadSx(true);
})();

// =====================================================================
// 店舗ごとの表示と、店舗をまたぐ確定の注意(2026-12-14)
//   ・「この日の調整」は、この店舗を希望した人・この店舗に確定がある人・足した人だけを出す(ほかの店舗だけを希望した人は出さない)
//   ・ほかの店舗を希望した人で「他店でもOK」の人は、下の「別店舗からの候補」に分けて出し、「この店舗の候補に入れる」で足せる
//   ・同じ日に2つの店舗に確定がある人：調整の欄と表に「⚠ 2店舗」、移動が30分未満なら「移動の時間が短い」。月の一覧とチェック・公開前の確認にも出る
// =====================================================================
(function () {
  if (typeof peopleOfDay !== 'function') return;
  var MOVE_MIN = 30; // 店舗をまたぐときに空けたい時間(分)
  function exOf(uid, d) { return ((B && B.extra) || {})[uid] ? (B.extra[uid][d] || null) : null; }
  function otherOkRanges(uid, d) { var x = exOf(uid, d); return x ? (x.other || []).map(function (o) { var a = String(o).split('@'), t = a[0].split('-'); return { s: t[0], e: t[1], store: a[1] || '' }; }) : []; }

  // この店舗の人だけ
  peopleOfDay = function () {
    var u = [];
    reqOf(DAY, STORE).forEach(function (r) { if (u.indexOf(r[4]) === -1) u.push(r[4]); });
    confOf(STORE, DAY).forEach(function (c) { if (u.indexOf(c[0]) === -1) u.push(c[0]); });
    (ADDED[key(STORE, DAY)] || []).forEach(function (x) { if (u.indexOf(x) === -1) u.push(x); });
    if (g('showAll').checked) Object.keys(B.staff).forEach(function (x) {
      var p = B.staff[x]; if (u.indexOf(x) === -1 && (p.stores.indexOf('*') !== -1 || p.stores.indexOf(STORE) !== -1)) u.push(x);
    });
    return u;
  };

  // 同じ日に、店舗をまたいで確定がある人 { uid: [{store, s, e}] }(2店舗以上)と、移動の時間が短い組
  function crossOf(d) {
    var by = {};
    B.stores.forEach(function (st) { confOf(st.code, d).forEach(function (c) { (by[c[0]] = by[c[0]] || []).push({ store: st.code, s: c[1], e: c[2] }); }); });
    var out = {};
    Object.keys(by).forEach(function (u) {
      var list = by[u].sort(function (a, b) { return mins(a.s) - mins(b.s); });
      var stores = list.map(function (x) { return x.store; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      if (stores.length < 2) return;
      var tight = false;
      for (var i = 1; i < list.length; i++) if (list[i].store !== list[i - 1].store && mins(list[i].s) - mins(list[i - 1].e) < MOVE_MIN) tight = true;
      out[u] = { list: list, tight: tight };
    });
    return out;
  }
  function sname(code) { var st = storeOf(code); return st ? st.name : code; }
  function crossText(x) { return x.list.map(function (s) { return sname(s.store) + ' ' + s.s + '-' + s.e; }).join(' → '); }

  // 調整の欄：注意の印＋別店舗からの候補
  var origPanel = renderPanel;
  renderPanel = function () {
    origPanel.apply(this, arguments);
    var cross = crossOf(DAY);
    Array.prototype.forEach.call(document.querySelectorAll('#panelBody tr[data-u]'), function (tr) {
      var x = cross[tr.getAttribute('data-u')], nm = tr.querySelector('td.nm');
      if (x && nm) nm.insertAdjacentHTML('beforeend', '<div style="font-size:11px;font-weight:700;color:' + (x.tight ? '#B42318' : '#8A5A00') + ';">⚠ 2店舗' + (x.tight ? '・移動の時間が短い' : '') + '</div>');
    });
    var shown = {}; peopleOfDay().forEach(function (u) { shown[u] = 1; });
    var cand = Object.keys((B && B.extra) || {}).filter(function (u) {
      return !shown[u] && otherOkRanges(u, DAY).some(function (r) { return r.store !== STORE; });
    }).sort(byStaff);
    if (!cand.length) return;
    var h = '<div style="padding:10px 14px;border-top:2px solid var(--soft);"><div style="font-weight:700;">別店舗からの候補(この日「他店でもOK」の人)</div><div class="muted">ほかの店舗を希望していて、他店でもOKにしている人です。足すと、この店舗の表に入り、ドラッグで時間を決められます。</div>' +
      cand.map(function (u) {
        var p = B.staff[u] || { name: u };
        return '<div class="ln" style="margin-top:6px;"><b style="min-width:7em;">' + esc(p.name) + '</b><span class="muted">' + esc(otherOkRanges(u, DAY).map(function (r) { return sname(r.store) + ' ' + r.s + '-' + r.e; }).join(' / ')) + '</span>' +
          (B.readonly ? '' : '<button class="mini2" data-cand="' + esc(u) + '">この店舗の候補に入れる</button>') + '</div>';
      }).join('') + '</div>';
    g('panelBody').insertAdjacentHTML('beforeend', h);
  };
  g('panelBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cand]'); if (!b) return;
    var u = b.getAttribute('data-cand'), k = key(STORE, DAY);
    (ADDED[k] = ADDED[k] || []).push(u);
    OUTOK[u + '|' + k] = true;
    renderDay();
    g('msg').textContent = (B.staff[u] || { name: u }).name + 'さんを、この店舗の候補に入れました。表の行をドラッグして時間を決めてください';
  });

  // タイムラインの名前の下にも
  var origDay3 = renderDay;
  renderDay = function () {
    origDay3.apply(this, arguments);
    try {
      var cross = crossOf(DAY);
      Array.prototype.forEach.call(document.querySelectorAll('#grid tr.staff[data-u]'), function (tr) {
        var x = cross[tr.getAttribute('data-u')], c0 = tr.querySelector('td.c0');
        if (x && c0 && !c0.querySelector('.xstag')) c0.insertAdjacentHTML('beforeend', '<div class="xstag" style="font-size:11px;font-weight:700;color:' + (x.tight ? '#B42318' : '#8A5A00') + ';">⚠ 2店舗' + (x.tight ? '・移動短い' : '') + '</div>');
      });
    } catch (e) {}
  };

  // 確定を変えたとき：店舗をまたぐ確定が新しくできたら、上に知らせる
  var origChanged = changedKeys;
  changedKeys = function (stores) {
    var before = crossOf(DAY);
    origChanged.apply(this, arguments);
    var after = crossOf(DAY), news = Object.keys(after).filter(function (u) { return !before[u] || (after[u].tight && !before[u].tight); });
    if (news.length) g('msg').innerHTML = '<span style="color:#B42318;font-weight:700;">⚠ 店舗をまたぐ確定：' + news.map(function (u) { return esc(nameOfU(u)) + '(' + esc(crossText(after[u])) + (after[u].tight ? '・移動が' + MOVE_MIN + '分未満' : '') + ')'; }).join('、') + '</span>';
  };

  // 月の一覧とチェック・公開前の確認：店舗をまたぐ日を注意に足す(この店舗に確定がある人)
  var origChecks = checks;
  checks = function () {
    var out = origChecks.apply(this, arguments);
    if (!B) return out;
    B.days.forEach(function (x) {
      var cross = crossOf(x.d);
      Object.keys(cross).forEach(function (u) {
        if (!cross[u].list.some(function (s) { return s.store === STORE; })) return;
        out.push(nameOfU(u) + '：' + x.d + '日に2店舗(' + crossText(cross[u]) + ')' + (cross[u].tight ? '。移動の時間が' + MOVE_MIN + '分未満' : ''));
      });
    });
    return out;
  };

  if (B) { renderDay(); renderChecks(); }
})();
