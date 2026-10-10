/* ============================================================================
 * 我的学习基地 · 主逻辑
 * 数据优先级：浏览器 localStorage('hub-data-v2') > data/hub-data.js 默认值
 * 备忘录：'hub-memo-v2' ｜ 学习活动记录：'hub-activity-v2' ｜ 主题：'hub-theme-v2'
 * ==========================================================================*/
(function () {
  'use strict';

  /* ---------------- 小工具 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function load(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || 'null');
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  function dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------------- 常量 ---------------- */
  var DATA_KEY = 'hub-data-v2';
  var MEMO_KEY = 'hub-memo-v2';
  var THEME_KEY = 'hub-theme-v2';
  var ACT_KEY = 'hub-activity-v2';
  var STATUS_TEXT = { doing: '进行中', done: '已完成', todo: '待开始' };

  /* ---------------- 数据 ---------------- */
  var DEFAULTS = window.HUB_DEFAULT_DATA;
  var data = load(DATA_KEY, null) || JSON.parse(JSON.stringify(DEFAULTS));
  var editing = false;
  function persist() { save(DATA_KEY, data); }

  /* 记录今天的访问（学习热力图的数据来源） */
  var activity = load(ACT_KEY, {});
  var today = dayKey(new Date());
  activity[today] = (activity[today] || 0) + 1;
  save(ACT_KEY, activity);

  /* YOLO 分站打卡进度（file:// 页面在 Chrome 里共享 localStorage） */
  function yoloProgress() {
    var s = load('y11-plan-progress-v1', null);
    if (!s) return null;
    var keys = Object.keys(s);
    if (!keys.length) return null;
    var done = keys.filter(function (k) { return s[k]; }).length;
    return { done: done, total: keys.length, pct: Math.round(done / keys.length * 100) };
  }

  /* 学习天数统计 */
  function studyStats() {
    var days = Object.keys(activity).filter(function (k) { return activity[k] > 0; });
    var total = days.length;
    var streak = 0;
    var d = new Date();
    /* 今天还没记录时（理论上不会，因为上面已记录）从昨天往前数也行 */
    if (!activity[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (activity[dayKey(d)] > 0) { streak++; d.setDate(d.getDate() - 1); }
    return { total: total, streak: streak };
  }

  /* ---------------- 渲染 ---------------- */
  function renderAll() {
    document.title = data.site.title;
    $('#navTitle').textContent = data.site.title;
    $('#navSub').textContent = data.site.subtitle;
    $('[data-ed="heroTitle"]').textContent = data.hero.title;
    $('[data-ed="heroDesc"]').textContent = data.hero.desc;

    var gh = 'https://github.com/' + data.github.user + '/' + data.github.repo;
    $('#ghLink').href = gh;

    var now = new Date();
    var week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    $('#todayLine').textContent =
      now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' +
      String(now.getDate()).padStart(2, '0') + ' · 星期' + week;

    renderStats();
    renderHeatmap();
    renderBranches();
    renderMilestones();
    renderQuickLinks();
  }

  function renderStats() {
    var yp = yoloProgress();
    var ss = studyStats();
    var doing = data.branches.filter(function (b) { return b.status === 'doing'; }).length;
    $('#stats').innerHTML =
      '<div class="stat"><div class="n">' + ss.streak + '<small> 天</small></div><div class="t">连续学习</div></div>' +
      '<div class="stat"><div class="n">' + ss.total + '<small> 天</small></div><div class="t">累计学习日</div></div>' +
      '<div class="stat"><div class="n">' + (yp ? yp.pct + '<small>%</small>' : '—') + '</div><div class="t">YOLO11 课程打卡' + (yp ? '（' + yp.done + '/' + yp.total + '）' : '') + '</div></div>' +
      '<div class="stat"><div class="n">' + data.branches.length + '</div><div class="t">学习分支（' + doing + ' 个进行中）</div></div>';
  }

  /* GitHub 风格学习热力图：最近 26 周 */
  function renderHeatmap() {
    var WEEKS = 26;
    var end = new Date();
    var start = new Date();
    start.setDate(start.getDate() - (WEEKS * 7 - 1));
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); /* 对齐到周一 */

    var html = '';
    var cursor = new Date(start);
    var monthLabels = [];
    for (var w = 0; w < WEEKS + 1; w++) {
      if (cursor > end) break;
      html += '<div class="hm-col">';
      for (var d = 0; d < 7; d++) {
        if (cursor > end) { html += '<span class="hm-cell" style="visibility:hidden"></span>'; continue; }
        var k = dayKey(cursor);
        var c = activity[k] || 0;
        var lv = c === 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : c <= 4 ? 3 : 4;
        var isToday = k === today;
        html += '<span class="hm-cell' + (lv ? ' l' + lv : '') + (isToday ? ' today' : '') +
          '" title="' + k + ' · 学习活动 ' + c + ' 次"></span>';
        cursor.setDate(cursor.getDate() + 1);
      }
      html += '</div>';
      monthLabels.push(cursor.getMonth() + 1 + '月');
    }
    $('#heatmap').innerHTML = html;
    $('#hmRange').textContent = '最近 26 周 · 颜色越深代表当天学习活动越多';
  }

  function renderBranches() {
    var box = $('#branches');
    box.innerHTML = '';
    data.branches.forEach(function (b, i) {
      var card = document.createElement('div');
      card.className = 'branch';

      var progHtml = '';
      if (b.progressKey === 'yolo11') {
        var yp = yoloProgress();
        if (yp) {
          progHtml = '<div class="pbar"><i style="width:' + yp.pct + '%"></i></div>' +
            '<div class="pbar-note">课程打卡 ' + yp.done + '/' + yp.total + '</div>';
        }
      }

      var linkHtml = b.link
        ? '<a class="plink" href="' + esc(b.link) + '"' + (/^https?:/.test(b.link) ? ' target="_blank" rel="noopener"' : '') + '>进入分支 →</a>'
        : '<span class="plink" style="color:var(--ink-4)">未设置链接</span>';

      card.innerHTML =
        '<button class="del" title="删除这个分支">✕</button>' +
        '<div class="b-top">' +
          '<span class="icon" data-ed-f="icon">' + esc(b.icon) + '</span>' +
          '<h3 data-ed-f="name">' + esc(b.name) + '</h3>' +
          '<span class="st st-' + esc(b.status) + '" data-status title="编辑模式下点击切换状态">' + (STATUS_TEXT[b.status] || b.status) + '</span>' +
        '</div>' +
        '<p class="desc" data-ed-f="desc">' + esc(b.desc) + '</p>' +
        progHtml +
        '<div class="b-foot">' +
          '<span class="tag" data-ed-f="tag">' + esc(b.tag || '') + '</span>' +
          linkHtml +
        '</div>' +
        '<div class="only-edit link-edit">链接：<span data-ed-f="link">' + esc(b.link || '点我填写（站内 ./xxx 或 https://…）') + '</span></div>';

      card.querySelector('.del').addEventListener('click', function () {
        if (!editing) return;
        if (confirm('确定删除分支「' + b.name + '」？')) {
          data.branches.splice(i, 1); persist(); renderAll(); toast('已删除');
        }
      });
      card.querySelector('[data-status]').addEventListener('click', function () {
        if (!editing) return;
        var order = ['todo', 'doing', 'done'];
        b.status = order[(order.indexOf(b.status) + 1) % order.length];
        persist(); renderAll();
      });
      $all('[data-ed-f]', card).forEach(function (el) {
        el.contentEditable = editing ? 'true' : 'false';
        el.addEventListener('blur', function () {
          var f = el.getAttribute('data-ed-f');
          var v = el.textContent.trim();
          if (f === 'link' && v.indexOf('点我填写') === 0) v = '';
          if (b[f] !== v) { b[f] = v; persist(); renderAll(); }
        });
      });
      box.appendChild(card);
    });
  }

  function renderMilestones() {
    var ul = $('#milestones');
    ul.innerHTML = '';
    data.milestones.forEach(function (m, i) {
      var li = document.createElement('li');
      li.innerHTML =
        '<div class="d" data-ed-m="date">' + esc(m.date) + '</div>' +
        '<div class="x"><span data-ed-m="text">' + esc(m.text) + '</span><button class="del" title="删除">✕</button></div>';
      li.querySelector('.del').addEventListener('click', function () {
        if (!editing) return;
        data.milestones.splice(i, 1); persist(); renderAll();
      });
      $all('[data-ed-m]', li).forEach(function (el) {
        el.contentEditable = editing ? 'true' : 'false';
        el.addEventListener('blur', function () {
          var f = el.getAttribute('data-ed-m');
          if (m[f] !== el.textContent.trim()) { m[f] = el.textContent.trim(); persist(); }
        });
      });
      ul.appendChild(li);
    });
  }

  function renderQuickLinks() {
    $('#quickLinks').innerHTML = data.quickLinks.map(function (q) {
      return '<a class="qlink" href="' + esc(q.link) + '"' +
        (/^https?:/.test(q.link) ? ' target="_blank" rel="noopener"' : '') + '>' +
        '<span class="q-ic">' + esc(q.icon) + '</span>' +
        '<span>' + esc(q.name) + '<span class="dim">' + esc(q.desc) + '</span></span></a>';
    }).join('');
  }

  /* ---------------- 编辑模式 ---------------- */
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('editing', on);
    $('#editBtn').textContent = on ? '✓ 完成' : '✏️ 编辑模式';
    $all('.hero [data-ed]').forEach(function (el) { el.contentEditable = on ? 'true' : 'false'; });
    renderBranches();
    renderMilestones();
    if (!on) { persist(); toast('已保存到本机'); }
  }
  $('#editBtn').addEventListener('click', function () { setEditing(!editing); });

  $all('.hero [data-ed]').forEach(function (el) {
    el.addEventListener('blur', function () {
      var f = el.getAttribute('data-ed') === 'heroTitle' ? 'title' : 'desc';
      if (data.hero[f] !== el.textContent.trim()) { data.hero[f] = el.textContent.trim(); persist(); }
    });
  });

  $('#addBranch').addEventListener('click', function () {
    data.branches.push({ icon: '🌱', name: '新分支', desc: '点这里写这个分支要学什么。', status: 'todo', link: '', tag: '新方向', progressKey: '' });
    persist(); renderAll(); toast('已添加，直接在卡片上改内容');
  });
  $('#addMs').addEventListener('click', function () {
    data.milestones.push({ date: dayKey(new Date()), text: '点这里写今天完成了什么。' });
    persist(); renderAll();
  });

  /* ---------------- 导出 / 导入 / 重置 ---------------- */
  $('#exportBtn').addEventListener('click', function () {
    var payload = { exportedAt: new Date().toISOString(), data: data, memo: $('#memo').value, activity: activity };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'learning-hub-backup-' + dayKey(new Date()) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('备份已下载');
  });
  $('#importBtn').addEventListener('click', function () { $('#importFile').click(); });
  $('#importFile').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var p = JSON.parse(rd.result);
        if (p.data && p.data.branches) {
          data = p.data; persist();
          if (typeof p.memo === 'string') { $('#memo').value = p.memo; save(MEMO_KEY, p.memo); }
          if (p.activity) { activity = p.activity; save(ACT_KEY, activity); }
          renderAll(); toast('导入成功');
        } else toast('文件格式不对');
      } catch (err) { toast('导入失败：不是有效的 JSON'); }
    };
    rd.readAsText(f);
    e.target.value = '';
  });
  $('#resetBtn').addEventListener('click', function () {
    if (confirm('恢复默认内容？网页上的修改会丢失（备忘和热力图除外），data/hub-data.js 的内容重新生效。')) {
      data = JSON.parse(JSON.stringify(DEFAULTS));
      persist(); renderAll(); toast('已恢复默认');
    }
  });

  /* ---------------- 主题 ---------------- */
  var savedTheme = load(THEME_KEY, null);
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  else if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', 'dark');
  $('#themeBtn').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    save(THEME_KEY, cur);
  });

  /* ---------------- 备忘录 ---------------- */
  $('#memo').value = load(MEMO_KEY, '');
  $('#memo').addEventListener('input', function () { save(MEMO_KEY, $('#memo').value); });

  renderAll();
})();
