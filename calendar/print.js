// calendar/print.js
// シフトカレンダーの印刷(2026-12-15)：「自分」＝その月の自分のシフトの一覧(A4縦)／「全体」＝選んでいる店舗のスタッフ×日付の表(A4横)
//   index.html の一番下(</body> の直前)で読む：<script src="print.js?v=1"></script>
//   スマホでも「印刷」から PDF に保存できる。画面のデータ(C)をそのまま使う(新しく取りに行かない)
(function () {
  if (typeof renderAll !== 'function' || !document.getElementById('vt')) return;
  var css = document.createElement('style');
  css.textContent = [
    '.prbtn{display:block;width:100%;margin:10px 0 0;padding:10px;font-size:15px;border:1px solid #B9C0C8;border-radius:10px;background:#fff;cursor:pointer;font-family:inherit;color:var(--ink)}',
    '#printArea{display:none}',
    '@media print{',
    '  @page{size:A4 portrait;margin:10mm}',
    '  html,body{background:#fff !important}',
    '  body>*:not(#printArea){display:none !important}',
    '  #printArea{display:block !important;color:#000;font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}',
    '  #printArea.land{}',
    '}',
    '#printArea h1{font-size:16pt;margin:0 0 2mm} #printArea .meta{font-size:8pt;color:#555;margin-bottom:3mm;display:flex;justify-content:space-between}',
    '#printArea table{border-collapse:collapse;width:100%}',
    '#printArea .mine th,#printArea .mine td{border:.3mm solid #9AA3AD;padding:1.6mm 2mm;font-size:10.5pt;text-align:left}',
    '#printArea .mine th{background:#EEF1F4} #printArea .mine td.d{white-space:nowrap;width:22mm} #printArea .mine tr.off td{color:#999}',
    '#printArea .mine .sun,#printArea .mine .hol{color:#B42318} #printArea .mine .sat{color:#1D5BB8}',
    '#printArea .all{table-layout:fixed;font-size:6.5pt} #printArea .all th,#printArea .all td{border:.3mm solid #9AA3AD;padding:.5mm .2mm;text-align:center;overflow:hidden;white-space:nowrap}',
    '#printArea .all th{background:#EEF1F4} #printArea .all th.sun,#printArea .all th.hol{color:#B42318} #printArea .all th.sat{color:#1D5BB8}',
    '#printArea .all td.nm{text-align:left;font-weight:700;font-size:7.5pt;padding-left:1mm} #printArea .all td.t{line-height:1.15} #printArea .all tr.foot td{background:#F4F6F8;font-weight:700}',
    '#printArea .note{font-size:7pt;color:#555;margin-top:2mm}'
  ].join('\n');
  document.head.appendChild(css);
  var area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area);
  var pageStyle = document.createElement('style'); document.head.appendChild(pageStyle);

  // ボタン：「自分」はカレンダーの下、「全体」は表の下
  document.getElementById('cal').insertAdjacentHTML('afterend', '<button class="prbtn" id="prMine">🖨 この月の自分のシフトを印刷・PDFに保存</button>');
  document.getElementById('allView').insertAdjacentHTML('beforeend', '<button class="prbtn" id="prAll">🖨 この店舗の表を印刷・PDFに保存</button>');
  // 「全体」のときは自分の印刷ボタンを隠す
  document.getElementById('vt').addEventListener('click', function () { setTimeout(function () { document.getElementById('prMine').style.display = VIEW === 'all' ? 'none' : ''; }, 0); });

  function stamp() { var n = new Date(); return n.getFullYear() + '/' + (n.getMonth() + 1) + '/' + n.getDate() + ' ' + n.getHours() + ':' + ('0' + n.getMinutes()).slice(-2); }
  function go(land) {
    pageStyle.textContent = '@media print{@page{size:A4 ' + (land ? 'landscape' : 'portrait') + ';margin:' + (land ? '6mm' : '10mm') + '}}';
    setTimeout(function () { window.print(); }, 50);
  }
  function cls(x) { return x.hol ? 'hol' : x.w === 0 ? 'sun' : x.w === 6 ? 'sat' : ''; }

  // 自分のシフト(日ごとに1行。シフトのない日も、休みとして薄く出す)
  document.getElementById('prMine').addEventListener('click', function () {
    if (!C) return;
    var ym = C.month.split('-').map(Number), n = 0, total = 0;
    var rows = C.days.map(function (x) {
      var ms = C.mine.filter(function (m) { return m[0] === x.d; });
      var evs = (C.events || []).filter(function (ev) { return ev.d === x.d && ev.mine; });
      if (ms.length) n++;
      ms.forEach(function (m) { var a = m[2].split(':'), b = m[3].split(':'); total += (Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1])); });
      return '<tr class="' + (ms.length || evs.length ? '' : 'off') + '"><td class="d ' + cls(x) + '">' + ym[1] + '/' + x.d + '(' + W.charAt(x.w) + ')' + (x.hol ? ' ' + esc(x.hol) : '') + '</td>' +
        '<td>' + (ms.length ? ms.map(function (m) { return '<b>' + esc(storeName(m[1])) + '</b>　' + hmShort(m[2]) + '〜' + hmShort(m[3]); }).join('<br>') : '休み') + '</td>' +
        '<td>' + evs.map(function (ev) { return (ev.s ? hmShort(ev.s) + '〜' + hmShort(ev.e) + ' ' : '') + esc(ev.title); }).join('<br>') + '</td></tr>';
    }).join('');
    area.innerHTML = '<h1>' + esc(C.label) + '　' + esc(C.name || '') + ' さんのシフト</h1>' +
      '<div class="meta"><span>出勤 ' + n + '日・在籍 ' + Math.floor(total / 60) + '時間' + (total % 60 ? (total % 60) + '分' : '') + '(休憩を含む)</span><span>出力：' + stamp() + '</span></div>' +
      '<table class="mine"><tr><th>日付</th><th>シフト</th><th>予定</th></tr>' + rows + '</table>' +
      '<div class="note">公開されたシフトだけを載せています。変わることがあるので、最新はシフトカレンダーで確かめてください。</div>';
    go(false);
  });

  // 全体の表(選んでいる店舗。スタッフ×日付)
  document.getElementById('prAll').addEventListener('click', function () {
    if (!C || !TSTORE) return;
    var list = C.team.filter(function (t) { return t[1] === TSTORE; });
    var names = []; list.forEach(function (t) { if (names.indexOf(t[4]) === -1) names.push(t[4]); });
    names.sort(function (a, b) { return a.localeCompare(b, 'ja'); });
    ((C.members || {})[TSTORE] || []).forEach(function (nm) { if (names.indexOf(nm) === -1) names.push(nm); }); // シフトが無い人も(2026-12-18)
    var nmW = 22, cntW = 8, dayW = (285 - nmW - cntW) / C.days.length;
    var h = '<h1>' + esc(C.label) + '　' + esc(storeName(TSTORE)) + '　シフト表</h1><div class="meta"><span>公開されたシフト</span><span>出力：' + stamp() + '</span></div>' +
      '<table class="all"><colgroup><col style="width:' + nmW + 'mm">' + C.days.map(function () { return '<col style="width:' + dayW.toFixed(2) + 'mm">'; }).join('') + '<col style="width:' + cntW + 'mm"></colgroup>' +
      '<tr><th>氏名</th>' + C.days.map(function (x) { return '<th class="' + cls(x) + '">' + x.d + '<br>' + W.charAt(x.w) + '</th>'; }).join('') + '<th>日数</th></tr>';
    names.forEach(function (nm) {
      var n = 0;
      h += '<tr><td class="nm">' + esc(nm) + '</td>' + C.days.map(function (x) {
        var ts = list.filter(function (t) { return t[4] === nm && t[0] === x.d; });
        if (ts.length) n++;
        return '<td class="t">' + ts.map(function (t) { return hmShort(t[2]) + '-<br>' + hmShort(t[3]); }).join('<br>') + '</td>';
      }).join('') + '<td>' + n + '</td></tr>';
    });
    h += '<tr class="foot"><td class="nm">人数</td>' + C.days.map(function (x) { var u = {}; list.forEach(function (t) { if (t[0] === x.d) u[t[4]] = 1; }); return '<td>' + (Object.keys(u).length || '') + '</td>'; }).join('') + '<td></td></tr></table>' +
      '<div class="note">時間は上が開始・下が終了(10- / 18 ＝10:00〜18:00)。公開されたシフトだけを載せています。</div>';
    area.innerHTML = h;
    go(true);
  });
})();
