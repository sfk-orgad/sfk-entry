/*
 * common/tracker.js ― 管理簿の入力フォーム(忘れ物・キャンセル請求の共通の画面)
 *   使い方(lost/index.html など)：TrackerPage({ tool: 'lost', title: '忘れ物', noun: '忘れ物', version: '2026-10-31a' })
 *   データは Bot(app=tracker、action は '<tool>.list|get|save|delete')
 *   入力欄は管理簿の見出しの並びのまま(管理簿に列を足すと、フォームにも出る)。種類・必須・選択肢は Bot が返す
 *   一覧には個人情報を出さない。1件を開いたときだけ出る(開いた記録が管理簿に残る)
 *   新しい登録の入力途中は、この端末に7日だけ下書きを残す(個人情報の欄は残さない)
 */
(function (w) {
  'use strict';
  // この画面だけの見た目(共通の style.css に足すほどではないもの)
  var CSS = [
    '.t-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}',
    '.t-tab,.t-chip{padding:8px 14px;border:1px solid var(--p-line);border-radius:999px;background:#fff;font-size:15px;cursor:pointer;font-family:inherit;color:var(--p-ink)}',
    '.t-tab.on,.t-chip.on{background:var(--p-c);color:#fff;border-color:var(--p-c);font-weight:700}',
    '.t-chips{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 10px}',
    '.t-item{display:block;width:100%;text-align:left;background:#fff;border:1px solid var(--p-line);border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:pointer;font-family:inherit;color:var(--p-ink)}',
    '.t-item.warn{border-color:#F0B8B2;background:#FFF8F7}',
    '.t-l1{display:flex;align-items:center;gap:8px;font-size:17px}.t-l1 b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.t-no{font-size:13px;color:var(--p-muted);white-space:nowrap}',
    '.t-l2{font-size:14px;color:var(--p-muted);margin-top:2px}.t-l3{font-size:14px;margin-top:2px}.t-item.warn .t-l3{color:var(--p-err);font-weight:700}',
    '.t-must{font-size:12px;background:#FDECEA;color:var(--p-err);border-radius:999px;padding:1px 8px;font-weight:700}',
    '.t-pii{font-size:12px;color:var(--p-muted);font-weight:400}',
    '.t-auto{font-size:17px;padding:8px 2px;color:var(--p-muted)}',
    '.t-box{border-radius:10px;padding:10px 14px}.t-box ul{margin:6px 0 0;padding-left:20px}.t-box.bad{background:#FDECEA;color:var(--p-err)}.t-box.warn{background:#FCE9D9;color:#7A3A0F}',
    '.t-del{display:block;width:100%;margin-top:18px;color:var(--p-err);border-color:#E7B4AE}',
    '.t-toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:#1F2328;color:#fff;padding:12px 18px;border-radius:12px;font-size:16px;z-index:50;max-width:90%}',
  ].join('\n');

  w.TrackerPage = function (opt) {
    var g = Portal.$, esc = Portal.esc;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var P = Portal.start({ tool: opt.tool, title: opt.title });
    if (!P) return;
    var D = null, VIEW = 'list', FILTER = 'open', Q = '', CUR = null, DRAFT = Portal.draft(opt.tool + '_new', 7);
    DRAFT.cleanup(opt.tool + '_new');
    var KIND = { active: '対応中', hold: '保留', done: '終了' };

    function call(action, extra, o) { return P.call(opt.tool + '.' + action, extra, Object.assign({ app: 'tracker' }, o || {})); }
    function md(ymd) { if (!ymd) return ''; var p = String(ymd).split('-'); return p.length === 3 ? Number(p[1]) + '/' + Number(p[2]) : ymd; }
    function toast(t) {
      var x = g('tToast'); x.textContent = t; x.hidden = false;
      clearTimeout(toast.tm); toast.tm = setTimeout(function () { x.hidden = true; }, 3500);
    }
    function fail(res, where) {
      if (res && res.error === 'AUTH') { Portal.gate(Portal.authMessage(res, opt.title), { back: true }); return; }
      where.innerHTML = '<div class="p-err">' + esc(res && res.error ? res.error : '通信に失敗しました。電波の良いところでもう一度') + '</div>';
    }

    // ===== 一覧 =====
    function load(store) {
      var pre = !store && !D ? Portal.prefetched(opt.tool, 3) : null;
      if (pre && pre.init) { D = pre.init; Portal.showApp(); g('ver').textContent = Portal.timing(opt.version, '先読み'); showList(); }
      return call('list', { store: store || (D ? D.store : '') }, { retry: true }).then(function (res) {
        if (!res.ok) { if (res.error === 'AUTH' || !D) Portal.gate(res.error === 'AUTH' ? Portal.authMessage(res, opt.title) : '開けませんでした：' + res.error, { back: true }); return; }
        var first = !D;
        D = res.init;
        if (first) { Portal.showApp(); g('ver').textContent = Portal.timing(opt.version); }
        if (VIEW === 'list') showList();
      }).catch(function (e) { if (!D) Portal.gate('通信に失敗しました。\n電波の良いところで開き直してください。', { back: true, detail: e.message }); });
    }

    function showList() {
      VIEW = 'list'; CUR = null;
      var tabs = D.stores.length > 1 ? '<div class="t-tabs">' + D.stores.map(function (s) {
        return '<button class="t-tab' + (s.code === D.store ? ' on' : '') + '" data-store="' + esc(s.code) + '">' + esc(s.name) + '</button>';
      }).join('') + '</div>' : '';
      var n = { open: 0, active: 0, hold: 0, done: 0 };
      D.rows.forEach(function (r) { n[r.kind]++; if (r.kind !== 'done') n.open++; });
      var chips = [['open', '対応中・保留', n.open], ['active', '対応中', n.active], ['hold', '保留', n.hold], ['done', '終了', n.done]].map(function (c) {
        return '<button class="t-chip' + (FILTER === c[0] ? ' on' : '') + '" data-f="' + c[0] + '">' + c[1] + ' ' + c[2] + '</button>';
      }).join('');
      g('view').innerHTML = tabs +
        '<button class="p-btn p-solid p-big" id="tNew">＋ 新しく登録</button>' +
        (DRAFT.read() ? '<div class="p-note" style="margin:6px 2px 0;">入力途中の下書きがあります(「新しく登録」で続きから)</div>' : '') +
        '<div class="t-chips">' + chips + '</div>' +
        '<input class="p-input" id="tQ" placeholder="探す(' + esc(opt.searchHint || '品名・名前・No.') + ')" value="' + esc(Q) + '">' +
        '<div id="tList" style="margin-top:10px;"></div>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-store]'), function (b) {
        b.addEventListener('click', function () { D.store = b.getAttribute('data-store'); g('tList').innerHTML = '<div class="p-note">読み込み中…</div>'; load(D.store); });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-f]'), function (b) { b.addEventListener('click', function () { FILTER = b.getAttribute('data-f'); showList(); }); });
      g('tNew').addEventListener('click', function () { showForm(null); });
      g('tQ').addEventListener('input', function () { Q = g('tQ').value; renderList(); });
      renderList();
    }

    function renderList() {
      var q = Q.trim().toLowerCase();
      var rows = D.rows.filter(function (r) {
        if (FILTER === 'open' ? r.kind === 'done' : r.kind !== FILTER) return false;
        if (!q) return true;
        return (r.no + ' ' + r.title + ' ' + r.sub + ' ' + r.status).toLowerCase().indexOf(q) !== -1;
      });
      g('tList').innerHTML = rows.length ? rows.map(function (r) {
        var tag = r.kind === 'done' ? 'p-off' : r.warn ? 'p-bad' : r.kind === 'hold' ? 'p-warn' : 'p-on';
        return '<button class="t-item' + (r.warn ? ' warn' : '') + '" data-no="' + esc(r.no) + '">' +
          '<div class="t-l1"><span class="t-no">No.' + esc(r.no) + '</span><b>' + esc(r.title) + '</b><span class="p-tag ' + tag + '">' + esc(r.status || '(空欄)') + '</span></div>' +
          '<div class="t-l2">' + esc(r.sub) + (r.base ? '・' + md(r.base) : '') + '</div>' +
          (r.kind !== 'done' ? '<div class="t-l3">' + (r.warn ? '⚠ ' : '') + esc(r.detail) + '</div>' : '') + '</button>';
      }).join('') : '<div class="p-card p-muted">該当するものはありません</div>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-no]'), function (b) { b.addEventListener('click', function () { openRow(b.getAttribute('data-no')); }); });
    }

    // ===== 1件を開く =====
    function openRow(no) {
      VIEW = 'form';
      g('view').innerHTML = '<div class="p-card p-muted">開いています…</div>';
      call('get', { no: no }, { retry: true }).then(function (res) {
        if (VIEW !== 'form') return;
        if (!res.ok) { fail(res, g('view')); g('view').insertAdjacentHTML('beforeend', '<button class="p-btn" id="tBack" style="margin-top:10px;">‹ 一覧へ</button>'); g('tBack').addEventListener('click', showList); return; }
        showForm(res);
      }).catch(function (e) { fail({ error: '通信に失敗しました(' + e.message + ')' }, g('view')); });
    }

    // ===== 入力フォーム(新規：row＝null ／ 直す：row＝get の返事) =====
    function showForm(row) {
      VIEW = 'form'; CUR = row;
      var isNew = !row;
      var vals = isNew ? ((DRAFT.read() || {}).data || {}) : row.values;
      if (isNew && !vals[D.baseCol]) vals[D.baseCol] = D.today;
      var html = '<button class="p-btn" id="tBack">‹ 一覧へ</button>' +
        '<div class="p-card" style="margin-top:10px;"><h2>' + (isNew ? '新しく登録' : 'No.' + esc(row.no) + ' ' + esc((D.rows.filter(function (r) { return String(r.no) === String(row.no); })[0] || {}).title || '')) + '</h2>' +
        (D.stores.length > 1 ? '<div class="p-note">店舗：' + esc((D.stores.filter(function (s) { return s.code === D.store; })[0] || {}).name || D.store) + '</div>' : '');
      D.fields.forEach(function (f, i) {
        var id = 'f' + i, v = vals[f.h] == null ? '' : String(vals[f.h]);
        html += '<label class="p-label" for="' + id + '">' + esc(f.h) + '<span class="t-req" data-req="' + i + '"></span>' +
          (f.pii ? ' <span class="t-pii">🔒個人情報</span>' : '') + '</label>';
        if (f.type === 'auto') html += '<div class="t-auto">' + esc(v ? md(v) : '(保存すると入ります)') + '</div>';
        else if (f.type === 'select') {
          var opts = f.options.slice();
          if (v && opts.indexOf(v) === -1) opts.unshift(v); // 今の値が選択肢に無くても消さない(保存時にチェック)
          html += '<select class="p-select" id="' + id + '"><option value="">(選ぶ)</option>' + opts.map(function (o) {
            return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') + '</select>';
        } else if (f.type === 'textarea') html += '<textarea class="p-textarea" id="' + id + '" style="min-height:70px;">' + esc(v) + '</textarea>';
        else {
          var t = f.type === 'date' ? 'date' : f.type === 'tel' ? 'tel' : 'text';
          var im = f.type === 'yen' || f.type === 'number' || f.type === 'zip' ? ' inputmode="numeric"' : '';
          html += '<input class="p-input" id="' + id + '" type="' + t + '"' + im + ' value="' + esc(v) + '"' + (f.type === 'zip' ? ' placeholder="例：4700000"' : '') + '>';
        }
        if (f.hint) html += '<div class="p-note">' + esc(f.hint) + '</div>';
      });
      html += '<div id="tMsg" style="margin-top:12px;"></div>' +
        '<button class="p-btn p-solid p-big" id="tSave" style="margin-top:12px;">' + (isNew ? '登録する' : '保存する') + '</button></div>' +
        (!isNew && row.canDelete ? '<button class="p-btn t-del" id="tDel">この件を消す</button>' : '');
      g('view').innerHTML = html;
      window.scrollTo(0, 0);
      g('tBack').addEventListener('click', function () { showList(); });
      g('tSave').addEventListener('click', function () { save(false); });
      if (g('tDel')) g('tDel').addEventListener('click', del);
      D.fields.forEach(function (f, i) {
        var el = g('f' + i); if (!el) return;
        el.addEventListener(f.type === 'select' ? 'change' : 'input', function () { marks(); if (isNew) keepDraft(); });
      });
      marks();
    }
    function cur() {
      var v = {};
      D.fields.forEach(function (f, i) { var el = g('f' + i); if (el) v[f.h] = el.value; });
      return v;
    }
    // 必須の印(条件つきの必須は、選んだ選択肢で変わる)
    function marks() {
      var v = cur(), condF = D.fields.filter(function (f) { return f.cond; })[0], cond = condF ? v[condF.h] : '';
      D.fields.forEach(function (f, i) {
        var on = f.req.some(function (c) { return !c || c === cond; });
        var m = document.querySelector('[data-req="' + i + '"]');
        if (m) m.innerHTML = on ? ' <span class="t-must">必須</span>' : '';
      });
    }
    function keepDraft() {
      var v = cur();
      D.fields.forEach(function (f) { if (f.pii) delete v[f.h]; }); // 個人情報は端末に残さない
      DRAFT.save(v);
    }

    function save(force) {
      var btn = g('tSave'), box = g('tMsg');
      btn.disabled = true; btn.textContent = '保存しています…'; box.innerHTML = '';
      var isNew = !CUR;
      call('save', { store: D.store, no: CUR ? CUR.no : '', version: CUR ? CUR.version : '', values: cur(), force: !!force }).then(function (res) {
        btn.disabled = false; btn.textContent = isNew ? '登録する' : '保存する';
        if (res.ok) {
          if (isNew) DRAFT.clear();
          toast('No.' + res.no + ' を' + (isNew ? '登録' : '保存') + 'しました' + (res.warnings && res.warnings.length ? '(未入力は通知で知らせます)' : ''));
          showList(); load(D.store);
          return;
        }
        if (res.error === 'AUTH') { fail(res, box); return; }
        if (res.conflict) { box.innerHTML = '<div class="p-err">' + esc(res.error) + '</div><button class="p-btn" id="tReopen" style="margin-top:8px;">開き直す</button>'; g('tReopen').addEventListener('click', function () { openRow(CUR.no); }); return; }
        var h = '';
        if (res.errors && res.errors.length) h += '<div class="t-box bad"><b>直してください</b><ul>' + res.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
        if (res.needConfirm && !(res.errors && res.errors.length)) {
          h += '<div class="t-box warn"><b>確認してください</b><ul>' + res.warnings.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
            '<div class="p-note">あとで入れる場合は、このまま保存できます(未入力のあいだは朝・夜の通知で知らせます)</div>' +
            '<button class="p-btn" id="tForce" style="margin-top:8px;">このまま保存する</button></div>';
        }
        if (!h) h = '<div class="p-err">' + esc(res.error || '保存できませんでした') + '</div>';
        box.innerHTML = h;
        if (g('tForce')) g('tForce').addEventListener('click', function () { save(true); });
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = isNew ? '登録する' : '保存する';
        box.innerHTML = '<div class="p-err">通信に失敗しました。保存できたか分からないので、一覧で確かめてから、もう一度保存してください。\n(' + esc(e.message) + ')</div>';
      });
    }

    function del() {
      if (!confirm('No.' + CUR.no + ' を消します。元に戻せません(消した内容は記録に残ります)。\nよろしいですか？')) return;
      var b = g('tDel'); b.disabled = true; b.textContent = '消しています…';
      call('delete', { no: CUR.no, version: CUR.version }).then(function (res) {
        if (res.ok) { toast('No.' + CUR.no + ' を消しました'); showList(); load(D.store); return; }
        b.disabled = false; b.textContent = 'この件を消す';
        if (res.error === 'AUTH') { fail(res, g('tMsg')); return; }
        g('tMsg').innerHTML = '<div class="p-err">' + esc(res.error) + '</div>';
      }).catch(function (e) { b.disabled = false; b.textContent = 'この件を消す'; g('tMsg').innerHTML = '<div class="p-err">通信に失敗しました(' + esc(e.message) + ')</div>'; });
    }

    load('');
  };
})(window);
