/* ============================================================================
 * YOLO11 Atlas · 渲染器
 * 把 data-modules-*.js 的知识数据渲染成「左侧模块导航 + 右侧 5 区块精读」界面
 * ==========================================================================*/
(() => {
  const MODULES = window.Y11_MODULES || [];
  const DEMOS = window.Y11_DEMOS || {};

  /* ---------- 代码高亮（轻量，零依赖） ---------- */
  const KEYWORDS = new Set(('def class return if else elif for while in not and or is None True False ' +
    'import from as with try except raise lambda self pass break continue yield global assert del ' +
    'print super init __init__ nn torch').split(' '));

  function highlight(src) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // 按行处理，先摘出注释，再处理字符串、数字、关键字
    return src.split('\n').map(line => {
      let out = '', i = 0;
      // 三引号 docstring 行（以 """ 开头）
      const m = line.match(/^(\s*)(.*?"""|''')(.*)$/);
      if (m && (line.trim().startsWith('"""') || line.trim().startsWith("'''"))) {
        return esc(line).replace(/^(.*?)(&quot;&quot;&quot;|&quot;&quot;&quot;)/, '$1<span class="cm">$2</span>');
      }
      let code = line;
      let comment = '';
      // 找不在字符串里的 # 或 !
      let inStr = null;
      for (let k = 0; k < code.length; k++) {
        const ch = code[k];
        if (inStr) { if (ch === inStr && code[k - 1] !== '\\') inStr = null; continue; }
        if (ch === '"' || ch === "'") { inStr = ch; continue; }
        if (ch === '#') { comment = code.slice(k); code = code.slice(0, k); break; }
        if (ch === '!' && code.slice(k, k + 4) === '!cm ') { comment = '# ' + code.slice(k + 4); code = code.slice(0, k); break; }
      }
      // 字符串
      code = esc(code).replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;|'[^']*?'|"[^"]*?")/g,
        '<span class="st">$1</span>');
      // 数字
      code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="nu">$1</span>');
      // 关键字
      code = code.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (mm) =>
        KEYWORDS.has(mm) ? `<span class="kw">${mm}</span>` : mm);
      // 修掉被包裹两次的标签属性
      code = code.replace(/<span class="(kw|st|nu)"><span class="(kw|st|nu)">/g, '<span class="$1">')
        .replace(/<\/span><\/span>/g, '</span>');
      out = code + (comment ? `<span class="cm">${esc(comment)}</span>` : '');
      return out;
    }).join('\n');
  }

  /* ---------- 渲染 5 个区块 ---------- */
  function section(icon, title, note, body) {
    return `<section class="blk">
      <h4 class="blk-h"><span class="blk-i">${icon}</span>${title}${note ? `<span class="blk-n">${note}</span>` : ''}</h4>
      <div class="blk-b">${body}</div>
    </section>`;
  }

  function renderSteps(steps) {
    return `<ol class="steps">${steps.map(s =>
      `<li><b>${s.t}</b><p>${s.d}</p></li>`).join('')}</ol>`;
  }

  function renderModule(m) {
    const demoId = m.demo && DEMOS[m.demo] ? m.demo : null;
    const blocks = [];

    // 1. 一句话 + 为什么
    blocks.push(section('&#9679;', '是什么 / 为什么需要它', '',
      `<p class="oneline">${m.oneLine}</p>
       <div class="why"><b>为什么需要它：</b>${m.why}</div>`));

    // 2. 结构图
    if (m.structure) {
      blocks.push(section('&#9635;', '结构拆解', '手绘示意图，标注了每一处卷积的通道变化',
        `<div class="figbox">${m.structure}</div>`));
    }

    // 3. 张量演算
    if (m.steps?.length) {
      blocks.push(section('&#8721;', '张量演算：逐步推导', '用真实数字走一遍，不要跳过',
        renderSteps(m.steps)));
    }

    // 4. 代码
    if (m.code) {
      blocks.push(section('&#123;&#125;', '代码实现', m.code.src ? `对照：${m.code.src}` : '',
        `<div class="code-h">${m.code.title || ''}</div>
         <pre class="code"><code>${highlight(m.code.text)}</code></pre>`));
    }

    // 5. 动手演示
    if (demoId) {
      blocks.push(section('&#9654;', '动手演示', '拖动滑块 / 点击按钮，实时看数值变化',
        `<div class="demo" id="demo-${m.id}"></div>`));
    } else {
      blocks.push(section('&#9654;', '动手演示', '',
        `<div class="demo-empty">这个模块的数值推导已经在上面的表格里完整给出，
          没有可交互的部分。<b>建议自己用 Python 跑一遍参数计算</b>，
          例如 <code>sum(p.numel() for p in C3k2(256,256,2).parameters())</code>。</div>`));
    }

    // 6. 避坑
    if (m.pitfalls?.length) {
      blocks.push(section('&#9888;', '避坑提示', '',
        `<ul class="pitfalls">${m.pitfalls.map(p => `<li>${p}</li>`).join('')}</ul>`));
    }

    return `<article class="mod" data-mod="${m.id}">
      <header class="mod-h">
        <div>
          <h3>${m.title}</h3>
          <div class="mod-sub">
            <span class="tag k">${m.group}</span>
            <span class="tag">难度 ${m.difficulty || '★★'}</span>
          </div>
        </div>
      </header>
      ${blocks.join('')}
    </article>`;
  }

  /* ---------- 目录树 ---------- */
  function buildNav() {
    const groups = [];
    for (const m of MODULES) {
      let g = groups.find(x => x.name === m.group);
      if (!g) groups.push(g = { name: m.group, items: [] });
      g.items.push(m);
    }
    return groups.map(g => `
      <div class="nav-g">
        <div class="nav-gt">${g.name}</div>
        <ul>${g.items.map(m =>
      `<li><a href="#${m.id}" data-id="${m.id}">${m.title.replace(/^★\s*/, '')}</a></li>`).join('')}</ul>
      </div>`).join('');
  }

  /* ---------- 挂载 ---------- */
  function mount() {
    const body = document.getElementById('modbody');
    if (!body) return;

    // 侧栏：模块导航独立托管在 #moduleNav（不占用 #toc，避免与其他视图冲突）
    let nav = document.getElementById('moduleNav');
    if (!nav) {
      nav = document.createElement('div');
      nav.id = 'moduleNav';
      nav.style.display = 'none';
      const aside = document.querySelector('aside');
      if (aside) aside.appendChild(nav);
      else document.body.appendChild(nav);
    }

    nav.innerHTML = `<div class="nav-search">
        <input id="modq" type="search" placeholder="搜索模块（如 c3k2 / 注意力 / 损失）">
      </div>` + buildNav();

    body.innerHTML = MODULES.map(renderModule).join('');

    // 演示实例化（每个只实例化一次）
    const built = new Set();
    const cleanups = [];
    function buildDemo(id) {
      if (built.has(id)) return;
      built.add(id);
      const el = document.getElementById('demo-' + id);
      const mod = MODULES.find(m => m.id === id);
      if (!el || !mod?.demo || !DEMOS[mod.demo]) return;
      try {
        const fn = DEMOS[mod.demo];
        const cleanup = fn(el);
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      } catch (e) {
        el.innerHTML = `<div class="demo-err">演示初始化失败：${e.message}</div>`;
        console.error(e);
      }
    }

    // 模块切换
    const links = [...nav.querySelectorAll('a[data-id]')];
    function show(id, push = true) {
      const mod = MODULES.find(m => m.id === id);
      if (!mod) return;
      links.forEach(a => a.classList.toggle('on', a.dataset.id === id));
      body.querySelectorAll('.mod').forEach(a => a.classList.toggle('on', a.dataset.mod === id));
      buildDemo(id);
      if (push) { history.replaceState(null, '', '#' + id); }
      const main = document.getElementById('main');
      if (main) main.scrollTop = 0;
    }
    window.Y11_LEARN_SHOW = show;      // 供视图切换调用
    nav.addEventListener('click', e => {
      const a = e.target.closest('a[data-id]');
      if (a) { e.preventDefault(); show(a.dataset.id); }
    });

    // 搜索
    const q = document.getElementById('modq');
    q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase();
      nav.querySelectorAll('.nav-g').forEach(g => {
        let any = false;
        g.querySelectorAll('li').forEach(li => {
          const mod = MODULES.find(m => m.id === li.querySelector('a').dataset.id);
          const hit = !v || li.textContent.toLowerCase().includes(v) ||
            (mod?.oneLine || '').toLowerCase().includes(v) ||
            (mod?.why || '').toLowerCase().includes(v);
          li.style.display = hit ? '' : 'none';
          if (hit) any = true;
        });
        g.style.display = any ? '' : 'none';
      });
    });

    // 初始模块：优先用 hash，其次第一个
    const init = (location.hash || '').replace('#', '');
    show(MODULES.some(m => m.id === init) ? init : MODULES[0].id, false);

    window.addEventListener('beforeunload', () =>
      cleanups.forEach(f => { try { f(); } catch (e) { } }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
