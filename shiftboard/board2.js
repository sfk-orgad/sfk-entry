// shiftboard/board2.js
// シフト作成の新しい画面(2026-12-15〜)：「シフト組みボード」の見た目に近づけた
//   ・タブ「シフトを組む」(最初に開く)：左にカレンダー(日ごとの充足・不足・帯)と今月の稼働、右にその日のボード
//       ボード：必要人数・希望者数・配置人数の帯 → 人ごとの行(希望＝点線の帯、押すと採用／確定＝濃い帯)・右で時刻を調整・外す
//       「他店でもOK」の人は、ほかの店舗の区切りにも行として出る(緑の点線の帯。押すとその店舗に採用)
//   ・店舗のタブの「全店舗」：全店舗の区切りを上下に並べて、1つの画面で全店舗を組む(カレンダーも店舗ごとの充足を出す)
//   ・タブ「希望一覧」：スタッフ×日付で希望を一覧(スマレジの表の形)。Excel 用にコピー
//   ・前の版の「日ごと(タイムライン)」は隠している(SHOW_OLD_TIMELINE を true にすると戻る)
//   index.html の一番下で extra.js のあとに読む：<script src="board2.js?v=2"></script>
(function () {
  if (typeof renderAll !== 'function' || !g('vtabs')) return;
  var SHOW_OLD_TIMELINE = false; // 前の版の「細かく調整(タイムライン)」のタブを出すか(戻すときは true)

  // ===== 見た目 =====
  var css = document.createElement('style');
  css.textContent = [
    '#vBuild,#vWish{--ok:#3E7B4F;--ok-soft:#DCEEDF;--short:#B9432A;--short-soft:#F7DDD5;--over:#6F7F9C;--over-soft:#E2E7F0;--rq:#D6E9EF;--rq-edge:#5C97AA;--pk:#1F5D6C;--grid2:#E8EEEC;--warn2:#A15C00;font-size:15px;}',
    '.b2{display:grid;grid-template-columns:minmax(330px,400px) minmax(0,1fr);gap:20px;align-items:start}',
    '@media (max-width:1050px){.b2{grid-template-columns:1fr}}',
    '.b2 .side{display:grid;gap:14px}',
    '.b2 .cal{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px}',
    '.b2 .wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}',
    '.b2 .wh{font-size:12px;text-align:center;color:var(--muted)} .b2 .wh.sun{color:var(--short)} .b2 .wh.sat{color:var(--over)}',
    '.b2 .day{border:1px solid var(--line);border-radius:8px;background:#F5F7F6;padding:3px 3px 5px;min-height:60px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;font-family:inherit;min-width:0;overflow:hidden}',
    '.b2 .day.blank{visibility:hidden}',
    '.b2 .day .n{font-size:16px;font-weight:700;line-height:1.2} .b2 .day.hol .n{color:var(--short)} .b2 .day.sat .n{color:var(--over)}',
    '.b2 .day .st{font-size:11px;border-radius:4px;padding:0 3px;white-space:nowrap}',
    '.b2 .st.ok{background:var(--ok-soft);color:var(--ok)} .b2 .st.short{background:var(--short-soft);color:var(--short)} .b2 .st.none{color:var(--muted)}',
    '.b2 .day .lack{font-size:10px;color:var(--short);white-space:nowrap} .b2 .day .wc{font-size:10px;color:var(--warn2);font-weight:700;white-space:nowrap}',
    '.b2 .day .stp{display:flex;width:100%;height:6px;border-radius:2px;overflow:hidden;margin-top:auto}',
    '.b2 .day .stp i{flex:1} .b2 .stp .ok{background:var(--ok)} .b2 .stp .short{background:var(--short)} .b2 .stp .over{background:var(--over)} .b2 .stp .empty{background:var(--line)}',
    '.b2 .day.on{border:2px solid var(--pk);background:#fff}',
    '.b2 .prog{display:flex;align-items:center;gap:8px;font-size:13px;margin:0 2px 8px} .b2 .prog .pbar{flex:1;height:8px;border-radius:4px;background:var(--grid2);overflow:hidden} .b2 .prog .pbar i{display:block;height:100%;background:var(--ok)}',
    '.b2 .lg2{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted);margin-top:8px} .b2 .lg2 i{display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:-1px;margin-right:3px}',
    '.b2 .mon{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px}',
    '.b2 .mon h3{margin:0 0 6px;font-size:15px} .b2 .mon table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}',
    '.b2 .mon th{font-weight:400;color:var(--muted);font-size:12px;text-align:right;padding:2px 4px;border-bottom:1px solid var(--line)} .b2 .mon th:first-child,.b2 .mon td.nm{text-align:left}',
    '.b2 .mon td{text-align:right;padding:3px 4px;border-bottom:1px solid var(--grid2)} .b2 .mon tr.on td{font-weight:700;background:var(--rq)}',
    '.b2 .dh{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-bottom:10px} .b2 .dh h2{font-size:22px;margin:0}',
    '.b2 .dh .type{font-size:13px;padding:2px 10px;border-radius:99px;background:var(--grid2)} .b2 .dh .nav{margin-left:auto;display:flex;gap:6px}',
    '.b2 .board{background:#fff;border:1px solid var(--line);border-radius:12px;overflow-x:auto} .b2 .bi{min-width:860px}',
    '.b2 .r{display:grid;grid-template-columns:190px minmax(0,1fr) 250px;align-items:center;border-top:1px solid var(--grid2);min-height:50px}',
    '.b2 .r:first-child{border-top:0}',
    '.b2 .who{padding:6px 12px;font-weight:700;line-height:1.3} .b2 .who small{display:block;font-weight:400;font-size:12px;color:var(--muted)}',
    '.b2 .who .memo{display:block;font-weight:400;font-size:12px;color:var(--short);margin-top:2px} .b2 .who .ok2{display:block;font-weight:400;font-size:12px;color:var(--ok)}',
    '.b2 .who .warn{display:block;font-size:12px;color:var(--short)}',
    '.b2 .tg{display:inline-block;font-size:11px;font-weight:400;border:1px solid var(--warn2);color:var(--warn2);border-radius:4px;padding:0 4px;margin-left:4px;vertical-align:2px}',
    '.b2 .tg.ft{border-color:var(--pk);color:var(--pk)}',
    '.b2 .act{padding:6px 10px;display:flex;flex-direction:column;gap:4px;font-size:13px} .b2 .act .ln2{display:flex;align-items:center;gap:4px;flex-wrap:wrap}',
    '.b2 .act select{padding:2px;border:1px solid var(--line);border-radius:6px;background:#fff;font-size:13px}',
    '.b2 .track{position:relative;height:40px;margin:6px 0}',
    '.b2 .gl{position:absolute;inset:0;pointer-events:none} .b2 .gl span{position:absolute;top:0;bottom:0;border-left:1px solid var(--grid2)}',
    '.b2 .bar{position:absolute;top:4px;bottom:4px;border-radius:6px;border:2px dashed var(--rq-edge);background:var(--rq);font-size:12px;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden;padding:0 4px;font-family:inherit;color:inherit}',
    '.b2 button.bar{cursor:pointer} .b2 button.bar:hover{border-style:solid}',
    '.b2 .bar.pick{background:var(--pk);border:2px solid var(--pk);color:#fff;font-weight:700;top:9px;bottom:9px;pointer-events:none}',
    '.b2 .bar.out{background:#E07A1F;border-color:#E07A1F}',
    '.b2 .bar.oth{background:#EEF0F2;border:1px solid #C5CCD3;color:var(--muted);top:12px;bottom:12px;pointer-events:none;font-weight:400}',
    '.b2 .axis .track{height:24px;margin:0} .b2 .tick{position:absolute;top:3px;font-size:12px;color:var(--muted);transform:translateX(-50%)}',
    '.b2 .cov{min-height:36px} .b2 .cov .track{height:28px;margin:3px 0}',
    '.b2 .seg{position:absolute;top:2px;bottom:2px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border-right:1px solid #fff;overflow:hidden;white-space:nowrap}',
    '.b2 .seg.need{background:var(--grid2);font-weight:400} .b2 .seg.short{background:var(--short-soft);color:var(--short)} .b2 .seg.ok{background:var(--ok-soft);color:var(--ok)} .b2 .seg.over{background:var(--over-soft);color:var(--over)} .b2 .seg.closed{color:var(--muted);font-weight:400}',
    '.b2 .sec{min-height:0;background:#F5F7F6} .b2 .sec .who{font-size:13px;color:var(--muted);font-weight:400;grid-column:1/-1}',
    '.b2 .others{padding:10px 12px;border-top:1px solid var(--line);font-size:13px;line-height:1.9} .b2 .others b{display:inline-block;min-width:6.5em;color:var(--muted);font-weight:400}',
    '.b2 .addrow{display:flex;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid var(--line);font-size:13px;flex-wrap:wrap}',
    '.b2 .sum2{font-size:15px;margin:10px 2px 0} .b2 .sum2 .short{color:var(--short);font-weight:700} .b2 .sum2 .ok{color:var(--ok);font-weight:700}',
    '.b2 .wl{margin:4px 2px 0;color:var(--warn2);font-weight:700;font-size:14px}',
    '#vWish .wrap2{overflow:auto;background:#fff;border:1px solid var(--line);border-radius:12px;max-height:75vh}',
    '#vWish table{border-collapse:collapse;font-size:13px;min-width:100%}',
    '#vWish th,#vWish td{border:1px solid var(--grid2);padding:4px 5px;text-align:center;white-space:nowrap}',
    '#vWish th{background:#F5F7F6;position:sticky;top:0;z-index:1} #vWish th.hol{color:var(--short)} #vWish th.sat{color:var(--over)}',
    '#vWish td.nm,#vWish th.nm{text-align:left;position:sticky;left:0;background:#fff;font-weight:700;z-index:2} #vWish th.nm{z-index:3;background:#F5F7F6}',
    '#vWish td.t{line-height:1.25;font-size:12px} #vWish td.t.has{background:var(--rq)} #vWish td.t.cf{box-shadow:inset 0 -3px 0 var(--pk)}',
    '#vWish td.t .o{color:var(--ok);font-size:10px} #vWish td.t .m{font-size:10px}',
    '#vWish tr.uns td{color:#9AA3AD} #vWish td.sum{font-weight:700} #vWish tr.foot td{background:#F5F7F6;font-weight:700}',
    '#vWish .bar3{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}'
  ].join('\n');
  document.head.appendChild(css);
  var css2 = document.createElement('style');
  css2.textContent = [
    '.b2 .secst{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#16323A;color:#fff;font-weight:700;font-size:15px}',
    '.b2 .secst small{font-weight:400;opacity:.85}',
    '.b2 .bar.okb{border-color:#3E7B4F;background:#E3F2E6}',
    '.b2 .r.okr .who{color:#2E5E3B}',
    '.b2 .day .sl{display:flex;align-items:center;gap:2px;width:100%;font-size:10px;line-height:1.3;white-space:nowrap;overflow:hidden}',
    '.b2 .day .sl b{font-weight:700;min-width:1.6em;text-align:left}',
    '.b2 .day .sl .stp{flex:1;height:5px;margin:0}',
    '#tabs .tab.allst{border-style:dashed}'
  ].join('\n');
  document.head.appendChild(css2);

  // ===== タブと入れ物 =====
  var tabs = g('vtabs');
  var oldDayTab = tabs.querySelector('[data-v="vDay"]');
  if (oldDayTab) { oldDayTab.textContent = '細かく調整(タイムライン)'; if (!SHOW_OLD_TIMELINE) oldDayTab.style.display = 'none'; }
  tabs.insertAdjacentHTML('afterbegin', '<button class="vtab" data-v="vBuild">シフトを組む</button><button class="vtab" data-v="vWish">希望一覧</button>');
  g('vDay').insertAdjacentHTML('beforebegin', '<div id="vBuild"></div><div id="vWish" hidden></div>');
  var MINE = ['vBuild', 'vWish'], ALL = ['vBuild', 'vWish', 'vDay', 'vMonth', 'vAi', 'vRec'];
  function oldOnly() { return [g('showAll') && g('showAll').closest('label'), g('addOut') && g('addOut').previousElementSibling, g('addOut'), g('addOutBtn')]; }
  function show(v) {
    VIEWNOW = v;
    Array.prototype.forEach.call(tabs.querySelectorAll('.vtab'), function (x) { x.classList.toggle('on', x.getAttribute('data-v') === v); });
    ALL.forEach(function (id) { if (g(id)) g(id).hidden = id !== v; });
    oldOnly().forEach(function (el) { if (el) el.style.display = (MINE.indexOf(v) !== -1 || !SHOW_OLD_TIMELINE) ? 'none' : ''; });
    if (v === 'vBuild') renderBuild();
    if (v === 'vWish') renderWish();
  }
  var h1 = document.querySelector('header h1'); if (h1) h1.textContent = 'シフト作成';
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('.vtab'); if (!b) return;
    var v = b.getAttribute('data-v');
    if (MINE.indexOf(v) === -1) { MINE.forEach(function (id) { g(id).hidden = true; }); if (SHOW_OLD_TIMELINE) oldOnly().forEach(function (el) { if (el) el.style.display = ''; }); return; }
    e.stopImmediatePropagation();
    leaveDay().then(function () { show(v); });
  }, true);
  show('vBuild');

  // ===== 店舗のタブに「全店舗」 =====
  var ALLST = false;
  function multi() { return visibleStores().length > 1; }
  function paintStoreTabs() {
    if (!B || !g('tabs')) return;
    if (multi() && !g('tabs').querySelector('[data-allst]')) g('tabs').insertAdjacentHTML('afterbegin', '<button class="tab allst" data-allst="1">全店舗</button> ');
    var a = g('tabs').querySelector('[data-allst]'); if (a) a.classList.toggle('on', ALLST);
    if (ALLST) Array.prototype.forEach.call(g('tabs').querySelectorAll('.tab[data-s]'), function (x) { x.classList.remove('on'); });
  }
  g('tabs').addEventListener('click', function (e) {
    var a = e.target.closest('[data-allst]');
    if (a) { e.stopImmediatePropagation(); leaveDay().then(function () { ALLST = true; paintStoreTabs(); renderBuild(); renderWish(); }); return; }
    if (e.target.closest('.tab[data-s]')) ALLST = false; // 店舗を選んだら、その店舗だけ(index.html が切り替える)
  }, true);

  // データが変わったら、開いている画面を描き直す
  var origAll = renderAll;
  renderAll = function () { origAll.apply(this, arguments); paintStoreTabs(); if (VIEWNOW === 'vBuild') renderBuild(); if (VIEWNOW === 'vWish') renderWish(); };
  var origCK = changedKeys;
  changedKeys = function () { origCK.apply(this, arguments); if (VIEWNOW === 'vBuild') renderBuild(); };
  var origSet = setState;
  setState = function () { origSet.apply(this, arguments); var s2 = g('b2state'); if (s2) { s2.textContent = g('saveState').textContent; s2.className = g('saveState').className; } };

  // ===== 部品 =====
  function sh(t) { var p = String(t).split(':'); return Number(p[0]) + (p[1] === '00' ? '' : ':' + p[1]); }
  function exOf(uid, d) { return ((B && B.extra) || {})[uid] ? (B.extra[uid][d] || null) : null; }
  function okRanges(x) { return (x && x.other || []).map(function (o) { var a = String(o).split('@'), t = a[0].split('-'); return { s: t[0], e: t[1], store: a[1] || '' }; }); }
  function sname(c) { var st = storeOf(c); return st ? st.name : c; }
  function hm2(m) { return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
  function inStore(u, code) { var p = B.staff[u] || {}; return (p.stores || []).some(function (c) { return c === '*' || c === (code || STORE); }); }
  function storesNow() { return ALLST && multi() ? visibleStores().map(function (s) { return s.code; }) : [STORE]; }
  // 店舗を一時的に切り替えて動かす(sums・peopleOfDay などは「いまの店舗」で動くため)
  function withStore(code, fn) { var keep = STORE; STORE = code; try { return fn(); } finally { STORE = keep; } }
  function dayInfo(d) {
    var sm = sums(d), slot = B.slot, short = 0, lack = 0;
    sm.cols.forEach(function (t, i) {
      if (sm.need[i] > 0 && sm.count[i] < sm.need[i]) short += slot;
      if (sm.need[i] > 0 && sm.reqCount[i] < sm.need[i]) lack += slot;
    });
    return { sm: sm, short: short, lack: lack, placed: sm.cfU.length, hasNeed: sm.need.some(function (n) { return n > 0; }) };
  }
  function crossOn(d) { // 2店舗以上に確定がある人
    var by = {}; B.stores.forEach(function (st) { confOf(st.code, d).forEach(function (c) { (by[c[0]] = by[c[0]] || {})[st.code] = 1; }); });
    return Object.keys(by).filter(function (u) { return Object.keys(by[u]).length > 1; });
  }
  function stripHtml(c) {
    var s = '';
    c.sm.cols.forEach(function (t, i) { if (t % 30) return; var n = c.sm.need[i], v = c.sm.count[i]; s += '<i class="' + (!n || !c.placed ? 'empty' : v < n ? 'short' : v > n ? 'over' : 'ok') + '"></i>'; });
    return '<span class="stp">' + s + '</span>';
  }

  // ===== カレンダーと今月の稼働 =====
  function calendarHtml() {
    var y = Number(B.month.slice(0, 4)), m = Number(B.month.slice(5, 7)), first = new Date(y, m - 1, 1).getDay();
    var codes = storesNow(), many = codes.length > 1;
    var cells = '';
    for (var i = 0; i < first; i++) cells += '<div class="day blank"></div>';
    var placedDays = 0;
    B.days.forEach(function (x) {
      var infos = codes.map(function (code) { return { code: code, c: withStore(code, function () { return dayInfo(x.d); }) }; });
      if (infos.some(function (z) { return z.c.placed; })) placedDays++;
      var body = '';
      if (many) {
        body = infos.map(function (z) {
          var c = z.c, cls = !c.placed ? 'none' : c.hasNeed && c.short ? 'short' : 'ok';
          return '<span class="sl"><b class="st ' + cls + '" style="padding:0 2px;">' + esc(sname(z.code).replace(/^(SAUNA |Sauna Base )/i, '').slice(0, 3)) + '</b>' + stripHtml(c) + '</span>';
        }).join('');
      } else {
        var c = infos[0].c;
        body = (!c.placed ? '<span class="st none">未配置</span>' : (c.hasNeed ? (c.short ? '<span class="st short">不足' + (Math.ceil(c.short / 30) / 2) + 'h</span>' : '<span class="st ok">充足</span>') : '<span class="st ok">' + c.placed + '人</span>')) +
          (c.lack && c.hasNeed ? '<span class="lack">希望不足</span>' : '') + stripHtml(c);
      }
      var wn = crossOn(x.d).length;
      cells += '<button class="day' + (x.hol || x.w === 0 ? ' hol' : x.w === 6 ? ' sat' : '') + (x.d === DAY ? ' on' : '') + '" data-bd="' + x.d + '" title="' + x.d + '日' + (x.hol ? ' ' + esc(x.hol) : '') + '">' +
        '<span class="n">' + x.d + '</span>' + (wn ? '<span class="wc">2店舗' + wn + '</span>' : '') + body + '</button>';
    });
    return '<div class="cal"><div class="prog"><span>配置した日 <b>' + placedDays + '</b>／' + B.days.length + '日</span><span class="pbar"><i style="width:' + (placedDays / B.days.length * 100).toFixed(1) + '%"></i></span></div>' +
      '<div class="wk">' + W.split('').map(function (w, i) { return '<div class="wh' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + w + '</div>'; }).join('') + cells + '</div>' +
      '<div class="lg2"><span><i style="background:var(--ok-soft);border:1px solid var(--ok)"></i>必要人数を満たす</span><span><i style="background:var(--short-soft);border:1px solid var(--short)"></i>不足あり</span><span>帯＝時間ごとの充足</span>' +
      (many ? '<span>店舗ごとに1段</span>' : '<span style="color:var(--short)">希望不足＝希望者を全員入れても足りない日</span>') + '</div></div>';
  }
  function monthHtml() {
    var many = storesNow().length > 1;
    var ids = many ? confUids() : confUids(STORE);
    if (!ids.length) return '';
    var today = {}; storesNow().forEach(function (code) { confOf(code, DAY).forEach(function (c) { today[c[0]] = 1; }); });
    ids.sort(byStaff);
    var T = { n: 0, work: 0, br: 0 };
    var rows = ids.map(function (u) {
      var t = { n: 0, work: 0, br: 0 };
      B.days.forEach(function (x) { var w = dayWork(u, x.d); if (w.span) { t.n++; t.work += w.work; t.br += w.br; } });
      T.n += t.n; T.work += t.work; T.br += t.br;
      return '<tr class="' + (today[u] ? 'on' : '') + '"><td class="nm">' + esc(nameOfU(u)) + (empOf(u) === '社員' ? '<span class="tg ft">社員</span>' : '') + '</td><td>' + t.n + '日</td><td><b>' + hm2(t.work) + '</b></td><td>' + hm2(t.br) + '</td></tr>';
    }).join('');
    return '<div class="mon"><h3>今月の稼働(確定分・全店舗)</h3><table><thead><tr><th>スタッフ</th><th>日数</th><th>実働</th><th>休憩</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td class="nm"><b>合計</b></td><td>' + T.n + '日</td><td><b>' + hm2(T.work) + '</b></td><td>' + hm2(T.br) + '</td></tr></tfoot></table>' +
      '<div class="muted" style="margin-top:4px;">色つきの行＝選んでいる日に入っている人。休憩はシフト設定の「休憩の決まり」で自動計算。</div></div>';
  }

  // ===== シフトを組む =====
  function renderBuild() {
    if (!B || VIEWNOW !== 'vBuild') return;
    var keepY = window.scrollY;
    g('vBuild').innerHTML = '<div class="b2"><div class="side">' + calendarHtml() + monthHtml() + '</div><div id="b2day"></div></div>';
    renderBoard();
    window.scrollTo(0, keepY);
  }
  function renderBoard() {
    var x = B.days[DAY - 1], ro = !!B.readonly, codes = storesNow(), many = codes.length > 1;
    var head = '<div class="dh"><h2>' + Number(B.month.slice(5, 7)) + '月' + DAY + '日(' + W.charAt(x.w) + ')</h2>' + (x.hol ? '<span class="type">' + esc(x.hol) + '</span>' : '') +
      (many ? '<span class="type">全店舗</span>' : '') +
      '<span id="b2state" class="' + g('saveState').className + '" style="font-size:13px;padding:3px 10px;border-radius:99px;background:#E9EFEC;">' + esc(g('saveState').textContent) + '</span>' +
      (ro ? '' : '<button class="btn" id="b2fill">全員を希望どおりに採用</button>') +
      '<div class="nav"><button class="btn" id="b2prev"' + (DAY <= 1 ? ' disabled' : '') + '>‹ 前の日</button><button class="btn" id="b2next"' + (DAY >= B.days.length ? ' disabled' : '') + '>次の日 ›</button></div></div>';
    var body = codes.map(function (code) { return withStore(code, function () { return sectionHtml(code, many); }); }).join('<div style="height:14px"></div>');
    var badN = Object.keys(badLines()).length;
    var cross = crossOn(DAY);
    var noExtra = B.extra === undefined ? '<p class="wl" style="background:#FFF6F5;border:1px solid #F2B8B5;border-radius:8px;padding:8px 10px;">「他店でもOK」と「日のひとこと」のデータが Bot から届いていません。Bot の Shift.gs に、2026-12-12 の「直す3か所」(shMine_・shSubmit_・shBoardData_)が入っているか確かめてください。</p>' : '';
    g('b2day').innerHTML = head + noExtra + body +
      (badN ? '<p class="wl">注意：時間帯が重なっている人がいます(同じ人の確定が重なる・開始が終了より後)。直すと保存します</p>' : '') +
      cross.map(function (u) { return '<p class="wl">注意：' + esc(nameOfU(u)) + 'さんは、この日2つの店舗に入っています</p>'; }).join('');
    bindBoard();
  }
  // 1店舗分の区切り(呼ぶ側で STORE をその店舗にしてある)
  function sectionHtml(code, many) {
    var st = storeOf(code), c = dayInfo(DAY), sm = c.sm, ro = !!B.readonly;
    var lo = st.start, hi = st.end;
    var pct = function (m) { return ((m - lo) / (hi - lo) * 100).toFixed(3) + '%'; };
    var wid = function (a, b) { return ((b - a) / (hi - lo) * 100).toFixed(3) + '%'; };
    var gl = ''; for (var h = Math.ceil(lo / 60) * 60; h <= hi; h += 60) gl += '<span style="left:' + pct(h) + '"></span>';
    gl = '<div class="gl">' + gl + '</div>';
    var axis = ''; for (var h2 = Math.ceil(lo / 60) * 60; h2 <= hi; h2 += 60) axis += '<span class="tick" style="left:' + pct(h2) + '">' + Math.floor(h2 / 60) + '</span>';
    var runs = function (fn) {
      var out = [];
      sm.cols.forEach(function (t, i) { var v = fn(i), last = out[out.length - 1]; if (last && last.v === v.v && last.cls === v.cls) last.b = t + B.slot; else out.push({ a: t, b: t + B.slot, v: v.v, cls: v.cls }); });
      return out;
    };
    var segRow = function (label, list) {
      return '<div class="r cov"><div class="who" style="font-size:13px;">' + label + '</div><div class="track">' + gl + list.map(function (r) {
        return '<div class="seg ' + r.cls + '" style="left:' + pct(r.a) + ';width:' + wid(r.a, r.b) + '" title="' + hm(r.a) + '〜' + hm(r.b) + '">' + r.v + '</div>';
      }).join('') + '</div><div class="act"></div></div>';
    };
    var needR = runs(function (i) { return sm.need[i] ? { v: sm.need[i], cls: 'need' } : { v: '', cls: 'closed' }; });
    var availR = runs(function (i) { var n = sm.need[i], v = sm.reqCount[i]; return !n ? { v: v || '', cls: 'closed' } : { v: v, cls: v < n ? 'short' : 'need' }; });
    var pickR = runs(function (i) { var n = sm.need[i], v = sm.count[i]; return !n ? { v: v || '', cls: v ? 'over' : 'closed' } : { v: v, cls: v < n ? 'short' : v > n ? 'over' : 'ok' }; });

    var rowsU = peopleOfDay().slice().sort(byStaff);
    var shown = {}; rowsU.forEach(function (u) { shown[u] = 1; });
    // 他店でもOK：ほかの店舗に希望を出していて、その時間を「他店でもOK」にした人(この店舗の区切りにも行として出す)
    var okU = Object.keys(B.extra || {}).filter(function (u) { return !shown[u] && okRanges(exOf(u, DAY)).some(function (r) { return r.store !== code; }); }).sort(byStaff);
    okU.forEach(function (u) { shown[u] = 1; });
    var cross = crossOn(DAY);
    var stepOpts = function (sel, from, to) { var o = ''; for (var t = from; t <= to; t += B.slot) o += '<option value="' + hm(t) + '"' + (hm(t) === sel ? ' selected' : '') + '>' + sh(hm(t)) + '</option>'; return o; };
    var rowHtml = function (u, isOk) {
      var p = B.staff[u] || { name: u, grade: '' };
      var mine = isOk ? [] : reqOf(DAY, code).filter(function (r) { return r[4] === u; });
      var okr = isOk ? okRanges(exOf(u, DAY)).filter(function (r) { return r.store !== code && mins(r.s) < hi && mins(r.e) > lo; }) : [];
      var cf = confOf(code, DAY).map(function (cc, i) { return { c: cc, i: i }; }).filter(function (z) { return z.c[0] === u; });
      var others = []; B.stores.forEach(function (s2) { if (s2.code !== code) confOf(s2.code, DAY).forEach(function (cc) { if (cc[0] === u) others.push({ store: s2.code, s: cc[1], e: cc[2] }); }); });
      var ex = exOf(u, DAY);
      var okAll = okRanges(ex).filter(function (r) { return r.store !== code; }); // ほかの店舗に出した希望のうち「他店でもOK」の時間
      var w = dayWork(u, DAY);
      var mon = { n: 0, work: 0 }; B.days.forEach(function (y2) { var ww = dayWork(u, y2.d); if (ww.span) { mon.n++; mon.work += ww.work; } });
      var ownReq = isOk ? reqOf(DAY).filter(function (r) { return r[4] === u; }) : [];
      var tags = (p.grade ? '<span class="tg ft">' + esc(p.grade) + '</span>' : '') + (empOf(u) === '社員' ? '<span class="tg ft">社員</span>' : '') +
        (isOk ? '<span class="tg" style="border-color:var(--ok);color:var(--ok);">他店でもOK</span>' : (!mine.length ? (okAll.length ? '<span class="tg" style="border-color:var(--ok);color:var(--ok);">他店でもOK</span>' : '<span class="tg">' + (inStore(u, code) ? '希望なし' : '応援') + '</span>') : '')) +
        (!isOk && mine.length && okRanges(ex).length ? '<span class="tg" style="border-color:var(--ok);color:var(--ok);">他店OK</span>' : '');
      var who = '<div class="who">' + esc(p.name) + tags +
        '<small>' + (w.span ? '実働 <b>' + hm2(w.work) + '</b>' + (w.br ? '(休憩' + w.br + '分)' : '') + '・' : '') + '月 ' + hm2(mon.work) + '・' + mon.n + '日</small>' +
        (isOk && ownReq.length ? '<small style="color:var(--ok)">希望：' + esc(ownReq.map(function (r) { return sname(r[1]) + ' ' + sh(r[2]) + '-' + sh(r[3]); }).join(' / ')) + '</small>' : '') +
        (others.length ? '<span class="warn">' + (isOk ? '' : '他店で') + '確定：' + esc(others.map(function (o) { return sname(o.store) + ' ' + sh(o.s) + '-' + sh(o.e); }).join(' / ')) + '</span>' : '') +
        (cross.indexOf(u) !== -1 ? '<span class="warn">⚠ 2店舗に入っています</span>' : '') +
        (ex && ex.note ? '<span class="memo">📝 ' + esc(ex.note) + '</span>' : '') + '</div>';
      var okHere = okRanges(ex).filter(function (r) { return r.store === code; });
      var reqBars = (isOk ? okr.map(function (r) { return [r.s, r.e, 'okb', 1]; }) : mine.map(function (r) { var ok = okHere.some(function (o) { return o.s === r[2] && o.e === r[3]; }); return [r[2], r[3], ok ? 'okb' : '', ok ? 1 : 0]; })).map(function (r) {
        var a = Math.max(lo, mins(r[0])), b = Math.min(hi, mins(r[1]));
        var taken = cf.some(function (z) { return mins(z.c[1]) < b && a < mins(z.c[2]); });
        return '<button class="bar ' + r[2] + '" data-rq="' + esc(u) + '|' + hm(a) + '|' + hm(b) + '" style="left:' + pct(a) + ';width:' + wid(a, b) + '" title="押すと' + (taken ? '外す' : 'この店舗に採用') + '"' + (ro ? ' disabled' : '') + '>' + (taken ? '' : sh(hm(a)) + '-' + sh(hm(b)) + (r[3] ? ' 他店OK' : '')) + '</button>';
      }).join('');
      var othBars = others.map(function (o) {
        var a = Math.max(lo, mins(o.s)), b = Math.min(hi, mins(o.e)); if (a >= b) return '';
        return '<div class="bar oth" style="left:' + pct(a) + ';width:' + wid(a, b) + '">' + esc(sname(o.store)) + '</div>';
      }).join('');
      var pickBars = cf.map(function (z) {
        var a = mins(z.c[1]), b = mins(z.c[2]);
        var inReq = mine.some(function (r) { return mins(r[2]) <= a && b <= mins(r[3]); }) || okAll.some(function (r) { return mins(r.s) <= a && b <= mins(r.e); });
        var okMark = okHere.some(function (o) { return mins(o.s) <= a && b <= mins(o.e); }) || okAll.some(function (o) { return mins(o.s) <= a && b <= mins(o.e); });
        return '<div class="bar pick' + (inReq ? '' : ' out') + '" style="left:' + pct(a) + ';width:' + wid(a, b) + (okMark ? ';box-shadow:inset 0 -4px 0 #7CC48C' : '') + '">' + sh(z.c[1]) + '-' + sh(z.c[2]) + (inReq ? (okMark ? ' 他店OK' : '') : ' 希望外') + '</div>';
      }).join('');
      var act = cf.length ? cf.map(function (z) {
        return '<div class="ln2"><select data-cs="' + z.i + '"' + (ro ? ' disabled' : '') + '>' + stepOpts(z.c[1], lo, hi - B.slot) + '</select>〜<select data-ce="' + z.i + '"' + (ro ? ' disabled' : '') + '>' + stepOpts(z.c[2], lo + B.slot, hi) + '</select>' +
          (ro ? '' : '<button class="mini2" data-cdel="' + z.i + '">外す</button>') + '</div>';
      }).join('') + (ro ? '' : '<div class="ln2"><button class="mini2" data-cadd="' + esc(u) + '">＋時間帯</button></div>')
        : (ro ? '' : '<div class="ln2">' + (mine.length || okr.length ? '<button class="btn" data-adopt="' + esc(u) + '" style="padding:4px 12px;">採用</button>' : '<button class="mini2" data-cadd="' + esc(u) + '">＋時間帯</button>') + '</div>');
      return '<div class="r' + (isOk ? ' okr' : '') + '" data-u="' + esc(u) + '">' + who + '<div class="track">' + gl + reqBars + othBars + pickBars + '</div><div class="act">' + act + '</div></div>';
    };
    var rows = rowsU.map(function (u) { return rowHtml(u, false); }).join('');
    var okRows = okU.map(function (u) { return rowHtml(u, true); }).join('');

    var uns = (B.unsubmitted[code] || []).filter(function (u) { return !shown[u]; });
    var none = Object.keys(B.staff).filter(function (u) { return !shown[u] && inStore(u, code) && uns.indexOf(u) === -1; }).sort(byStaff);
    var nm = function (list) { return list.length ? list.map(function (u) { var e = exOf(u, DAY); return esc(nameOfU(u)) + (ro ? '' : ' <button class="mini2" data-addp="' + esc(u) + '">入れる</button>') + (e && e.note ? '<span style="color:var(--short)">(' + esc(e.note) + ')</span>' : ''); }).join('、') : 'なし'; };
    var cand = Object.keys(B.staff).filter(function (u) { return !shown[u]; }).sort(function (a, b) { return String(nameOfU(a)).localeCompare(String(nameOfU(b)), 'ja'); });
    var mineC = cand.filter(function (u) { return inStore(u, code); }), othC = cand.filter(function (u) { return !inStore(u, code); });
    var opt = function (u) { return '<option value="' + esc(u) + '">' + esc(nameOfU(u)) + '</option>'; };
    var summary = !c.placed ? '<span class="muted" style="font-size:14px;">まだ誰も入れていません。希望の帯(点線)を押すと採用されます。</span>'
      : !c.hasNeed ? '<span class="muted" style="font-size:14px;">この日の必要人数がシフト設定にありません(必要人数・曜日・期間のシート)</span>'
      : c.short ? '<span class="short">人が足りない時間帯が計 ' + hm2(c.short) + ' あります</span>(赤い区間)'
      : '<span class="ok">すべての時間帯で必要人数を満たしています</span>';
    var lackNote = c.lack && c.hasNeed ? '<br><span class="short">希望者(他店でもOKを除く)を全員入れても ' + hm2(c.lack) + ' 分足りません。' + (okU.length ? '緑の点線の「他店でもOK」の人も使えます。' : '募集文タブか、個別の依頼が必要です。') + '</span>' : '';
    return '<div data-st="' + esc(code) + '">' +
      '<div class="board"><div class="bi">' +
      (many ? '<div class="secst">' + esc(st.name) + (sm.pattern ? '<small>必要人数：' + esc(sm.pattern) + '</small>' : '') + '</div>' : (sm.pattern ? '<div class="r sec"><div class="who">必要人数：' + esc(sm.pattern) + '</div></div>' : '')) +
      '<div class="r axis"><div class="who"></div><div class="track">' + axis + '</div><div class="act"></div></div>' +
      segRow('必要人数', needR) + segRow('希望者数', availR) + segRow('配置人数', pickR) +
      '<div class="r sec"><div class="who">この店舗の希望 ' + rowsU.length + '名 ― 点線の帯を押すと採用／右で時間を調整(2秒後に自動で保存)。<span style="color:var(--ok)">緑の帯＝「他店でもOK」にした時間</span></div></div>' +
      (rows || '<div class="r"><div class="who muted" style="grid-column:1/-1;font-weight:400;">この日、この店舗の希望はありません</div></div>') +
      (okRows ? '<div class="r sec"><div class="who" style="color:var(--ok);">他店でもOKの人 ' + okU.length + '名 ― ほかの店舗に希望を出していて、この時間はこの店舗でもよい人(緑の点線を押すとこの店舗に採用)</div></div>' + okRows : '') +
      '<div class="others"><div><b>希望なし</b>' + nm(none) + '</div><div><b>未提出</b>' + nm(uns) + '</div></div>' +
      (ro || !cand.length ? '' : '<div class="addrow">希望の外の人を入れる：<select class="b2who"><option value="">(選ぶ)</option>' +
        (mineC.length ? '<optgroup label="この店舗の人">' + mineC.map(opt).join('') + '</optgroup>' : '') + (othC.length ? '<optgroup label="ほかの店舗の人(応援)">' + othC.map(opt).join('') + '</optgroup>' : '') +
        '</select><button class="btn b2add" style="padding:4px 12px;">追加</button><span class="muted">本人と確認してから入れてください</span></div>') +
      '</div></div><p class="sum2">' + (many ? '<b>' + esc(st.name) + '</b>：' : '') + summary + lackNote + '</p></div>';
  }
  function bindBoard() {
    var box = g('b2day');
    var go = function (d) { leaveDay().then(function () { DAY = d; closeEditor(); renderStrip(); renderDay(); renderBuild(); }); };
    g('b2prev').onclick = function () { if (DAY > 1) go(DAY - 1); };
    g('b2next').onclick = function () { if (DAY < B.days.length) go(DAY + 1); };
    if (g('b2fill')) g('b2fill').onclick = function () { g('fillAll').click(); };
    Array.prototype.forEach.call(g('vBuild').querySelectorAll('[data-bd]'), function (b) { b.onclick = function () { go(Number(b.getAttribute('data-bd'))); }; });
    box.onclick = function (e) {
      var t = e.target, sec = t.closest('[data-st]'); if (!sec) return;
      var code = sec.getAttribute('data-st');
      withStore(code, function () { act(t, code); });
    };
    box.onchange = function (e) {
      var t = e.target, sec = t.closest('[data-st]'); if (!sec) return;
      var code = sec.getAttribute('data-st'), list = CONF[key(code, DAY)] || [];
      if (t.hasAttribute('data-cs')) { list[Number(t.getAttribute('data-cs'))][1] = t.value; changedKeys([code]); }
      if (t.hasAttribute('data-ce')) { list[Number(t.getAttribute('data-ce'))][2] = t.value; changedKeys([code]); }
    };
  }
  // ほかの店舗の確定と重なるか(重なれば店舗名を返す)
  function clash(u, code, s, e) {
    var hit = '';
    B.stores.forEach(function (st) { if (st.code !== code) confOf(st.code, DAY).forEach(function (c) { if (c[0] === u && mins(c[1]) < mins(e) && mins(s) < mins(c[2])) hit = st.name; }); });
    return hit;
  }
  function act(t, code) {
    var k = key(code, DAY), st = storeOf(code), lo = st.start, hi = st.end;
    var rq = t.closest('[data-rq]');
    if (rq) {
      var p = rq.getAttribute('data-rq').split('|'), u = p[0], a = mins(p[1]), b = mins(p[2]);
      var list = CONF[k] || [];
      var hit = list.filter(function (c) { return c[0] === u && mins(c[1]) < b && a < mins(c[2]); });
      if (hit.length) CONF[k] = list.filter(function (c) { return hit.indexOf(c) === -1; }); // 採用済み → 外す
      else {
        var cl = clash(u, code, p[1], p[2]);
        if (cl) { alert(nameOfU(u) + 'さんは、この時間は ' + cl + ' に入っています。先にそちらを外してください'); return; }
        addConfTo(code, u, p[1], p[2]);
      }
      changedKeys([code]); return;
    }
    var ad = t.closest('[data-adopt]');
    if (ad) {
      var u2 = ad.getAttribute('data-adopt');
      var rs = reqOf(DAY, code).filter(function (r) { return r[4] === u2; }).map(function (r) { return [r[2], r[3]]; });
      if (!rs.length) rs = okRanges(exOf(u2, DAY)).filter(function (r) { return r.store !== code && mins(r.s) >= lo && mins(r.e) <= hi; }).map(function (r) { return [r.s, r.e]; });
      var skipped = [];
      rs.forEach(function (r) { var cl = clash(u2, code, r[0], r[1]); if (cl) skipped.push(cl); else addConfTo(code, u2, r[0], r[1]); });
      if (skipped.length) alert(nameOfU(u2) + 'さんは、ほかの店舗(' + skipped.join('・') + ')と時間が重なる分は入れていません');
      changedKeys([code]); return;
    }
    var del = t.closest('[data-cdel]');
    if (del) { (CONF[k] || []).splice(Number(del.getAttribute('data-cdel')), 1); changedKeys([code]); return; }
    var ca = t.closest('[data-cadd]');
    if (ca) { addDefault(ca.getAttribute('data-cadd'), code, lo, hi); return; }
    var ap = t.closest('[data-addp]');
    if (ap) { addPerson(ap.getAttribute('data-addp'), code, lo, hi); return; }
    if (t.closest('.b2add')) { var sel = t.closest('[data-st]').querySelector('.b2who'); addPerson(sel ? sel.value : '', code, lo, hi); return; }
  }
  function addDefault(u, code, lo, hi) {
    var k = key(code, DAY), s = lo, e = Math.min(hi, lo + 240);
    (CONF[k] = CONF[k] || []).push([u, hm(s), hm(e)]);
    changedKeys([code]);
  }
  function addPerson(u, code, lo, hi) {
    if (!u) { alert('入れる人を選んでください'); return; }
    var p = B.staff[u] || { name: u };
    var k = key(code, DAY);
    if (!OUTOK[u + '|' + k] && !confirm(p.name + 'さんは、この日この店舗の希望がありません。\n本人と確認しましたか？\n［OK］確認した → 入れる(時間は右で直す)')) return;
    OUTOK[u + '|' + k] = true;
    (ADDED[k] = ADDED[k] || []).push(u);
    addDefault(u, code, lo, hi);
  }

  // ===== 希望一覧(スマレジの表の形) =====
  var WALL = false;
  function renderWish() {
    if (!B || VIEWNOW !== 'vWish') return;
    if (ALLST && multi()) WALL = true;
    var st = storeOf(STORE);
    var people = Object.keys(B.staff).filter(function (u) { return WALL || inStore(u, STORE) || B.req.some(function (r) { return r[4] === u && r[1] === STORE; }); });
    var uns = B.unsubmitted[STORE] || [];
    people.sort(function (a, b) { var ua = uns.indexOf(a) !== -1, ub = uns.indexOf(b) !== -1; return ua !== ub ? (ua ? 1 : -1) : byStaff(a, b); });
    var head = B.days.map(function (x) { return '<th class="' + (x.hol || x.w === 0 ? 'hol' : x.w === 6 ? 'sat' : '') + '">' + x.d + '<br>' + W.charAt(x.w) + '</th>'; }).join('');
    var cnt = B.days.map(function () { return 0; });
    var body = people.map(function (u) {
      var n = 0, un = uns.indexOf(u) !== -1;
      var cells = B.days.map(function (x, i) {
        var rs = B.req.filter(function (r) { return r[0] === x.d && r[4] === u && (WALL || r[1] === STORE); });
        var ex = exOf(u, x.d), oks = okRanges(ex), cf = confOf(STORE, x.d).some(function (c) { return c[0] === u; });
        if (!rs.length && !(ex && ex.note)) return '<td class="t' + (cf ? ' cf' : '') + '"></td>';
        if (rs.length) { n++; cnt[i]++; }
        return '<td class="t' + (rs.length ? ' has' : '') + (cf ? ' cf' : '') + '" title="' + esc(ex && ex.note ? ex.note : '') + '">' +
          rs.map(function (r) { return (WALL && r[1] !== STORE ? '<span class="m">' + esc(sname(r[1]).slice(0, 4)) + '</span><br>' : '') + sh(r[2]) + '<br>' + sh(r[3]); }).join('<br>') +
          (oks.length ? '<br><span class="o">他店OK</span>' : '') + (ex && ex.note ? '<br><span class="m">📝</span>' : '') + '</td>';
      }).join('');
      return '<tr class="' + (un ? 'uns' : '') + '"><td class="nm">' + esc(nameOfU(u)) + (B.staff[u].grade ? ' <span class="muted">' + esc(B.staff[u].grade) + '</span>' : '') + (un ? ' <span class="muted">未提出</span>' : '') + '</td>' + cells + '<td class="sum">' + n + '日</td></tr>';
    }).join('');
    g('vWish').innerHTML = '<div class="bar3"><b>' + esc(st ? st.name : '') + '　' + esc(B.label) + 'のシフト希望</b>' +
      '<label class="muted"><input type="checkbox" id="wAll"' + (WALL ? ' checked' : '') + '> ほかの店舗の希望も出す</label>' +
      '<button class="btn" id="wCopy">Excel用にコピー</button><span class="muted">水色＝希望あり、下線＝確定済み、他店OK＝ほかの店舗でもよい時間、📝＝日のひとこと(マスに指を置くと出る)</span></div>' +
      '<div class="wrap2"><table><thead><tr><th class="nm">スタッフ</th>' + head + '<th>日数</th></tr></thead><tbody>' + body +
      '<tr class="foot"><td class="nm">希望の人数</td>' + cnt.map(function (n) { return '<td>' + (n || '') + '</td>'; }).join('') + '<td></td></tr></tbody></table></div>';
    g('wAll').onchange = function () { WALL = this.checked; renderWish(); };
    g('wCopy').onclick = function () {
      var lines = [['スタッフ'].concat(B.days.map(function (x) { return x.d + '(' + W.charAt(x.w) + ')'; })).join('\t')];
      people.forEach(function (u) {
        lines.push([nameOfU(u)].concat(B.days.map(function (x) {
          return B.req.filter(function (r) { return r[0] === x.d && r[4] === u && (WALL || r[1] === STORE); }).map(function (r) { return (WALL && r[1] !== STORE ? sname(r[1]) + ' ' : '') + r[2] + '-' + r[3]; }).join(' / ');
        })).join('\t'));
      });
      var t = lines.join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { g('msg').textContent = 'コピーしました。Excel に貼り付けできます'; })
        .catch(function () { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); g('msg').textContent = 'コピーしました'; });
    };
  }

  if (B) { paintStoreTabs(); renderBuild(); }
})();
