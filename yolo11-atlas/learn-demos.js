/* ============================================================================
 * YOLO11 Atlas · 交互式演示集合
 * 每个 demo 是一个函数：mount(host) 会在 host 里创建 DOM 并接管交互；返回可选的清理函数。
 * 全部纯前端、零依赖、可离线。数值均按官方公式计算。
 * ==========================================================================*/
window.Y11_DEMOS = (() => {

  /* ---------- 小工具 ---------- */
  const h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    }
    kids.flat().forEach(k => e.append(k?.nodeType ? k : document.createTextNode(k)));
    return e;
  };
  const fmt = n => (typeof n === 'number' ? n.toLocaleString('en-US') : n);
  // 参数量公式（与 py/y11_spec.py 完全一致）
  const pConv = (c1, c2, k, g = 1) => k * k * (c1 / g) * c2 + 2 * c2;
  const pBn = (c1, c2, e = 0.5, k = 3, g = 1) => {
    const c = Math.floor(c2 * e);
    return pConv(c1, c, k) + pConv(c, c2, k, g);
  };
  const pC3k = (c1, c2, n = 2, e = 0.5, k = 3) => {
    const ch = Math.floor(c2 * e);
    return pConv(c1, ch, 1) * 2 + pConv(2 * ch, c2, 1) + n * pBn(ch, ch, 1.0, k);
  };
  const pC2f = (c1, c2, n, e = 0.5, c3k = false) => {
    const c = Math.floor(c2 * e);
    let t = pConv(c1, 2 * c, 1);
    for (let i = 0; i < n; i++) t += c3k ? pC3k(c, c, 2, 0.5, 3) : pBn(c, c, 0.5);
    return t + pConv((2 + n) * c, c2, 1);
  };
  const pC2PSA = (c1, n = 1, e = 0.5) => {
    const c = Math.floor(c1 * e);
    const nh = Math.max(Math.floor(c / 64), 1);
    const hd = Math.floor(c / nh), kd = Math.floor(hd * 0.5);
    const pAttn = pConv(c, c + kd * nh * 2, 1) + pConv(c, c, 1) + pConv(c, c, 3, c);
    const pPsa = pAttn + pConv(c, 2 * c, 1) + pConv(2 * c, c, 1);
    return pConv(c1, 2 * c, 1) + pConv(2 * c, c1, 1) + n * pPsa;
  };

  const slider = (label, min, max, val, step, onInput) => {
    const out = h('span', { class: 'dv' }, String(val));
    const inp = h('input', {
      type: 'range', min, max, step: step || 1, value: val,
      oninput: e => { out.textContent = e.target.value; onInput(Number(e.target.value)); },
    });
    return h('label', { class: 'ctl' }, h('span', { class: 'cl' }, label), inp, out);
  };

  const grid = (cols, cells, cellH = 30) => h('div', {
    class: 'dgrid',
    style: `grid-template-columns:repeat(${cols},1fr);gap:2px;max-width:${cols * (cellH + 2)}px`,
  }, cells.map(c => h('div', {
    class: 'dcell',
    style: `height:${cellH}px;background:${c.bg};color:${c.fg || '#1b2430'}`,
  }, c.t ?? '')));

  /* ======================================================================
   * 1. 卷积核滑动
   * ==================================================================== */
  function demoConv(host) {
    let K = [[1, 0, -1], [2, 0, -2], [1, 0, -1]];   // Sobel 垂直边缘
    let px = 0, py = 0, stride = 1;
    const IN = [
      [10, 10, 10, 10, 10, 10, 10, 10],
      [10, 10, 10, 10, 10, 10, 10, 10],
      [10, 10, 200, 200, 200, 10, 10, 10],
      [10, 10, 200, 200, 200, 10, 10, 10],
      [10, 10, 200, 200, 200, 10, 10, 10],
      [10, 10, 200, 200, 200, 10, 10, 10],
      [10, 10, 10, 10, 10, 10, 10, 10],
      [10, 10, 10, 10, 10, 10, 10, 10],
    ];
    const N = 8;
    const outSize = Math.floor((N - 3) / stride) + 1;

    const inBox = h('div', { class: 'dwrap' });
    const kBox = h('div', { class: 'dwrap' });
    const outBox = h('div', { class: 'dwrap' });
    const resBox = h('div', { class: 'dres' });
    const steps = h('div', { class: 'dsteps' });

    function convolveAt(x, y) {
      let s = 0, terms = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const v = IN[y + i][x + j], w = K[i][j];
        s += v * w;
        if (w !== 0) terms.push(`${v}×${w}`);
      }
      return { s, terms };
    }

    function computeOut() {
      const o = [];
      for (let y = 0; y < outSize; y++) {
        o.push([]);
        for (let x = 0; x < outSize; x++) o[y].push(convolveAt(x * stride, y * stride).s);
      }
      return o;
    }
    let OUT = computeOut();

    function render() {
      // 输入 8×8，高亮当前窗口
      const ic = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const inWin = x >= px && x < px + 3 && y >= py && y < py + 3;
        const v = IN[y][x];
        const g = Math.round(10 + (v - 10) / 190 * 150);
        ic.push({
          t: v,
          bg: inWin ? `rgba(15,157,143,.9)` : `rgb(${g},${g + 8},${g + 16})`,
          fg: inWin ? '#fff' : (v > 100 ? '#fff' : '#94a3b8'),
        });
      }
      inBox.replaceChildren(grid(N, ic, 30));

      const kc = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const w = K[i][j];
        kc.push({
          t: w, bg: w > 0 ? 'rgba(224,138,46,.85)' : w < 0 ? 'rgba(79,110,247,.85)' : '#e2e8f0',
          fg: w === 0 ? '#64748b' : '#fff',
        });
      }
      kBox.replaceChildren(grid(3, kc, 34));

      const oc = [];
      for (let y = 0; y < outSize; y++) for (let x = 0; x < outSize; x++) {
        const cur = Math.floor(py / 1) === y && Math.floor(px / 1) === x;
        const v = OUT[y][x];
        const mag = Math.min(Math.abs(v) / 800, 1);
        oc.push({
          t: v, bg: cur ? '#16a34a' : v > 0 ? `rgba(15,157,143,${0.15 + mag * 0.75})`
            : `rgba(79,110,247,${0.15 + mag * 0.75})`,
          fg: cur ? '#fff' : (Math.abs(v) > 300 ? '#fff' : '#334155'),
        });
      }
      outBox.replaceChildren(grid(outSize, oc, 30));

      const { s, terms } = convolveAt(px, py);
      resBox.innerHTML = `<b>当前窗口（左上角在 ${px}, ${py}）：</b><br>
        输入窗口 → ${IN[py][px]} ${IN[py][px + 1]} ${IN[py][px + 2]} /
        ${IN[py + 1][px]} ${IN[py + 1][px + 1]} ${IN[py + 1][px + 2]} /
        ${IN[py + 2][px]} ${IN[py + 2][px + 1]} ${IN[py + 2][px + 2]}<br>
        逐项相乘再求和：<span class="mono">${terms.join(' + ') || '全为 0'}</span>
        = <b class="hi">${s}</b><br>
        <span class="dim">这就是输出特征图在 (${Math.floor(px / stride)}, ${Math.floor(py / stride)}) 处的值。</span>`;
    }

    function clampPos() {
      const maxP = (outSize - 1) * stride;
      px = Math.max(0, Math.min(px, maxP));
      py = Math.max(0, Math.min(py, maxP));
    }

    host.append(
      h('div', { class: 'drow' },
        h('div', {}, h('div', { class: 'dlab' }, '输入特征图 8×8（值 10~200）'), inBox),
        h('div', { class: 'darr' }, '∗'),
        h('div', {}, h('div', { class: 'dlab' }, '卷积核 3×3（Sobel）'), kBox),
        h('div', { class: 'darr' }, '='),
        h('div', {}, h('div', { class: 'dlab' }, `输出 ${outSize}×${outSize}`), outBox)),
      h('div', { class: 'dctl' },
        h('button', { class: 'btn', onclick: () => { px--; clampPos(); render(); } }, '← 左移'),
        h('button', { class: 'btn', onclick: () => { px++; clampPos(); render(); } }, '右移 →'),
        h('button', { class: 'btn', onclick: () => { py--; clampPos(); render(); } }, '↑ 上移'),
        h('button', { class: 'btn', onclick: () => { py++; clampPos(); render(); } }, '下移 ↓'),
        h('button', {
          class: 'btn', onclick: () => {
            px = 0; py = 0;
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) K[i][j] = (i + j) % 2 ? 0 : 1;
            K[1][1] = -4; OUT = computeOut(); render();
          }
        }, '换成拉普拉斯核'),
        h('button', {
          class: 'btn', onclick: () => {
            K = [[1, 0, -1], [2, 0, -2], [1, 0, -1]]; OUT = computeOut(); render();
          }
        }, '换回 Sobel 竖边'),
        slider('stride', 1, 2, 1, 1, v => { stride = v; OUT = computeOut(); px = 0; py = 0; render(); }),
      ),
      steps,
      resBox);

    // 键盘支持
    const onKey = e => {
      const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (!map[e.key]) return;
      // 只在演示区可见时接管
      const r = host.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      e.preventDefault();
      px += map[e.key][0]; py += map[e.key][1]; clampPos(); render();
    };
    window.addEventListener('keydown', onKey);
    render();
    return () => window.removeEventListener('keydown', onKey);
  }

  /* ======================================================================
   * 2. DWConv 参数量对比
   * ==================================================================== */
  function demoDwconv(host) {
    let C = 256, H = 80, K = 3;
    const box = h('div', { class: 'dres' });
    const bars = h('div', { class: 'dbars' });
    function render() {
      const std = K * K * C * C, dw = K * K * C + C * C;
      const stdM = std * H * H / 1e6, dwM = dw * H * H / 1e6;
      const ratio = std / dw;
      const maxV = Math.max(std, dw);
      bars.replaceChildren(
        bar('标准 3×3 卷积', std, stdM, maxV, '#e08a2e'),
        bar('DWConv + 1×1', dw, dwM, maxV, '#0f9d8f'));
      box.innerHTML = `<b>当前配置</b>　通道 C=${C}　特征图 ${H}×${H}　核 ${K}×${K}<br>
        <span class="mono">标准：k²·C² = ${K}²×${C}² = <b>${fmt(std)}</b> 参数，约 <b>${stdM.toFixed(1)}</b> M MACs</span><br>
        <span class="mono">可分离：k²·C + C² = ${K * K}×${C} + ${C}² = <b>${fmt(dw)}</b> 参数，约 <b>${dwM.toFixed(1)}</b> M MACs</span><br>
        <b class="hi">节省 ${ratio.toFixed(1)}× 算力</b>
        <span class="dim">　（对照：整个 yolo11n 约 32.5 亿 MACs = 3250 M）</span>`;
    }
    const bar = (name, v, macs, maxV, color) => h('div', { class: 'dbar' },
      h('span', { class: 'dbl' }, name),
      h('div', { class: 'dbt' }, h('div', {
        class: 'dbf', style: `width:${(v / maxV * 100).toFixed(1)}%;background:${color}`,
      })),
      h('span', { class: 'dbv mono' }, fmt(v)));
    host.append(
      h('div', { class: 'dctl' },
        slider('通道 C', 32, 512, C, 32, v => { C = v; render(); }),
        slider('特征图边长', 20, 160, H, 20, v => { H = v; render(); }),
        slider('卷积核 k', 3, 7, K, 2, v => { K = v; render(); })),
      bars, box);
    render();
  }

  /* ======================================================================
   * 3. Bottleneck 参数计算
   * ==================================================================== */
  function demoBottleneck(host) {
    let c2 = 256, e = 0.5, k = 3, res = true;
    const box = h('div', { class: 'dres' });
    function render() {
      const ch = Math.floor(c2 * e);
      const p1 = pConv(c2, ch, k), p2 = pConv(ch, c2, k);
      box.innerHTML = `
        <b>隐藏通道</b>　c_ = int(c2 × e) = int(${c2} × ${e}) = <b class="hi">${ch}</b>
        <span class="dim">${e === 1 ? '（C3k / C3k2 的 c3k=True 形态会传 e=1.0）' : '（官方默认 e=0.5）'}</span><br>
        <table class="dtab">
          <tr><th>步骤</th><th>结构</th><th>参数量</th></tr>
          <tr><td>cv1</td><td class="mono">Conv(${c2} → ${ch}, ${k}×${k})</td><td class="mono">${fmt(p1)}</td></tr>
          <tr><td>cv2</td><td class="mono">Conv(${ch} → ${c2}, ${k}×${k})</td><td class="mono">${fmt(p2)}</td></tr>
          <tr class="tot"><td>合计</td><td class="mono">${res ? '+ 残差（c1 == c2）' : '无残差'}</td><td class="mono">${fmt(p1 + p2)}</td></tr>
        </table>
        <span class="dim">参数量公式：k²·c1·c2 + 2·c2（含 BatchNorm 的 weight 与 bias）。两个卷积都是 3×3 —— 不是「1×1 再 3×3」。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      slider('输出通道 c2', 32, 512, c2, 32, v => { c2 = v; render(); }),
      slider('e（×100）', 25, 100, e * 100, 25, v => { e = v / 100; render(); }),
      slider('卷积核 k', 1, 5, k, 2, v => { k = v; render(); }),
      h('button', { class: 'btn', onclick: () => { res = !res; render(); } }, '切换残差')),
      box);
    render();
  }

  /* ======================================================================
   * 4/5. C3k 与 C2f / C3k2 通道流
   * ==================================================================== */
  function demoC3k(host) {
    let c1 = 128, c2 = 128, e = 0.5, n = 2, k = 3;
    const box = h('div', { class: 'dres' });
    const flow = h('div', { class: 'dflow' });
    function render() {
      const ch = Math.floor(c2 * e);
      const p1 = pConv(c1, ch, 1), p2 = pConv(c1, ch, 1), p3 = pConv(2 * ch, c2, 1);
      const pb = pBn(ch, ch, 1.0, k);
      flow.replaceChildren(
        node(`输入 ${c1}`), arrow(), node(`cv1 1×1 → ${ch}`), arrow(),
        node(`m: ${n} 个 Bottleneck(${ch},${ch},e=1.0,k=${k})`, 'hot'), arrow(),
        node(`cv3 1×1 → ${c2}`, 'out'),
        h('div', { class: 'dside' }, '旁路 cv2 1×1 → ' + ch));
      box.innerHTML = `<table class="dtab">
          <tr><th>部件</th><th>配置</th><th>参数量</th></tr>
          <tr><td>cv1</td><td class="mono">Conv(${c1} → ${ch}, 1×1)</td><td class="mono">${fmt(p1)}</td></tr>
          <tr><td>cv2（旁路）</td><td class="mono">Conv(${c1} → ${ch}, 1×1)</td><td class="mono">${fmt(p2)}</td></tr>
          <tr><td>m 中每个瓶颈</td><td class="mono">Conv(${ch}→${ch},${k}×${k}) ×2</td><td class="mono">${fmt(pb)}</td></tr>
          <tr><td>m 合计（${n} 个）</td><td class="mono">—</td><td class="mono">${fmt(pb * n)}</td></tr>
          <tr><td>cv3</td><td class="mono">Conv(${2 * ch} → ${c2}, 1×1)</td><td class="mono">${fmt(p3)}</td></tr>
          <tr class="tot"><td>总计</td><td class="mono">—</td><td class="mono">${fmt(p1 + p2 + pb * n + p3)}</td></tr>
        </table>
        <span class="dim">注意 cv3 的输入是 <b>2·c_ = ${2 * ch}</b>（两路各 ${ch} 拼接），不是 c1+c_。</span>`;
    }
    const node = (t, cls = '') => h('div', { class: 'dnode ' + cls }, t);
    const arrow = () => h('div', { class: 'darrow' }, '→');
    host.append(h('div', { class: 'dctl' },
      slider('c1', 32, 512, c1, 32, v => { c1 = v; render(); }),
      slider('c2', 32, 512, c2, 32, v => { c2 = v; render(); }),
      slider('e（×100）', 25, 100, e * 100, 25, v => { e = v / 100; render(); }),
      slider('n（瓶颈个数）', 1, 4, n, 1, v => { n = v; render(); })),
      flow, box);
    render();
  }

  /* C2f / C3k2 通道增长可视化 */
  function demoC3k2(host) {
    let c2 = 256, e = 0.5, n = 2, mode = 'bottleneck';
    const box = h('div', { class: 'dres' });
    const vis = h('div', { class: 'dcat' });
    function render() {
      const c = Math.floor(c2 * e);
      const parts = 2 + n;
      const total = parts * c;
      // 通道条形图
      const segs = [];
      segs.push(seg(`chunk[0] ${c}`, c, '#94a3b8'));
      segs.push(seg(`chunk[1] ${c}`, c, '#94a3b8'));
      for (let i = 1; i <= n; i++) segs.push(seg(`block${i} ${c}`, c, '#93c2e6'));
      vis.replaceChildren(
        h('div', { class: 'dlab' }, `cv1 输出 2c = ${2 * c} → chunk 劈成两半，再逐级串联，共 ${parts} 份送进 cv2`),
        h('div', { class: 'dstack' }, segs),
        h('div', { class: 'dnote' }, `cv2 的输入通道 = (2 + n) · c = (2 + ${n}) × ${c} = `, h('b', {}, String(total))));
      const inner = mode === 'bottleneck' ? pBn(c, c, 0.5)
        : mode === 'c3k' ? pC3k(c, c, 2, 0.5, 3) : pBn(c, c, 0.5) + pPsa(c);
      const totalP = pC2f(1, c2, n, e, mode === 'c3k');
      box.innerHTML = `<table class="dtab">
          <tr><th>部件</th><th>配置</th><th>参数量</th></tr>
          <tr><td>cv1</td><td class="mono">2c = ${2 * c} 通道</td><td class="mono">${fmt(pConv(1, 2 * c, 1))}</td></tr>
          <tr><td>每个内部单元</td><td class="mono">${mode === 'bottleneck' ? 'Bottleneck(c,c,e=0.5)' : mode === 'c3k' ? 'C3k(c,c,2)' : 'Bottleneck + PSABlock'}</td><td class="mono">${fmt(inner)}</td></tr>
          <tr><td>内部单元合计（n=${n}）</td><td class="mono">—</td><td class="mono">${fmt(inner * n)}</td></tr>
          <tr><td>cv2</td><td class="mono">(${parts})·c = ${total} → ${c2}</td><td class="mono">${fmt(pConv(total, c2, 1))}</td></tr>
          <tr class="tot"><td>总计</td><td class="mono">（c1 按 1 计，只比较相对量）</td><td class="mono">${fmt(totalP)}</td></tr>
        </table>
        <span class="dim">★ 三种形态的差别只在「内部单元」那一行。切到 c3k 看参数如何暴涨，切到 attn 看注意力加进来多少。</span>`;
    }
    const seg = (label, v, color) => h('div', {
      class: 'dseg', style: `flex:${v};background:${color}`,
    }, h('span', {}, `${v}`), h('i', {}, label));
    function pPsa(c) {
      const nh = Math.max(Math.floor(c / 64), 1);
      const hd = Math.floor(c / nh), kd = Math.floor(hd * 0.5);
      const attn = pConv(c, c + kd * nh * 2, 1) + pConv(c, c, 1) + pConv(c, c, 3, c);
      return attn + pConv(c, 2 * c, 1) + pConv(2 * c, c, 1);
    }
    host.append(h('div', { class: 'dctl' },
      slider('c2', 64, 512, c2, 64, v => { c2 = v; render(); }),
      slider('e（×100）', 25, 100, e * 100, 25, v => { e = v / 100; render(); }),
      slider('n（内部单元数）', 1, 4, n, 1, v => { n = v; render(); }),
      h('div', { class: 'dseg-ctl' },
        ...['bottleneck', 'c3k', 'attn'].map(m => h('button', {
          class: 'btn' + (mode === m ? ' on' : ''), onclick: (e2) => {
            mode = m;
            [...e2.target.parentNode.children].forEach(b => b.classList.remove('on'));
            e2.target.classList.add('on'); render();
          },
        }, m === 'bottleneck' ? '形态一 Bottleneck' : m === 'c3k' ? '形态二 C3k' : '形态三 attn'))),
    ), vis, box);
    render();
  }

  /* ======================================================================
   * 6. SPPF 等效感受野
   * ==================================================================== */
  function demoSppf(host) {
    let level = 3, C = 512;
    const box = h('div', { class: 'dres' });
    const vis = h('div', { class: 'drow' });
    function render() {
      const eq = 1 + level * 4;   // 1, 5, 9, 13
      const cc = Math.floor(C / 2);
      const cv1 = pConv(C, cc, 1), cv2 = pConv(cc * 4, C, 1);
      const grids = [];
      for (let l = 0; l <= level; l++) {
        const k = 1 + l * 4;
        const cellN = 13;
        const cells = [];
        for (let y = 0; y < cellN; y++) for (let x = 0; x < cellN; x++) {
          const half = (k - 1) / 2;
          const inK = Math.abs(x - 6) <= half && Math.abs(y - 6) <= half;
          cells.push({ bg: inK ? `rgba(183,155,224,${0.35 + l * 0.18})` : '#f1f5f9' });
        }
        grids.push(h('div', { class: 'dwrap' },
          h('div', { class: 'dlab' }, l === 0 ? `原始 x（等效 1×1）` : `第 ${l} 次池化（等效 ${k}×${k}）`),
          grid(cellN, cells, 9)));
      }
      vis.replaceChildren(...grids);
      box.innerHTML = `<b>当前：做了 ${level} 次 5×5 池化，等效最大感受野 ${eq}×${eq}</b>
        <span class="dim">（串联叠加规则：每次 +（k−1）= +4）</span><br>
        <span class="mono">cv1: Conv(${C} → ${cc}, 1×1) = ${fmt(cv1)} 参数　
        cv2: Conv(${cc * 4} → ${C}, 1×1) = ${fmt(cv2)} 参数　
        合计 <b>${fmt(cv1 + cv2)}</b></span><br>
        <span class="dim">SPPF 的参数几乎全在 cv2（4 路拼接后要压回去）。池化本身零参数。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      slider('串联池化次数', 0, 3, level, 1, v => { level = v; render(); }),
      slider('通道 C', 64, 1024, C, 64, v => { C = v; render(); })),
      vis, box);
    render();
  }

  /* ======================================================================
   * 7/8. Attention / PSABlock 规模与代价
   * ==================================================================== */
  function demoAttention(host) {
    let N = 20, C = 256;
    const box = h('div', { class: 'dres' });
    const mat = h('div', { class: 'dmat' });
    function render() {
      const nh = Math.max(Math.floor(C / 64), 1);
      const hd = Math.floor(C / nh), kd = Math.floor(hd * 0.5);
      const tokens = N * N;
      const attnElems = nh * tokens * tokens;
      const qkv = pConv(C, C + kd * nh * 2, 1), proj = pConv(C, C, 1), pe = pConv(C, C, 3, C);
      const psa = qkv + proj + pe + pConv(C, 2 * C, 1) + pConv(2 * C, C, 1);
      const macsAttn = (kd * tokens * tokens * nh + hd * tokens * tokens * nh) / 1e6;
      // 画一个小尺寸的注意力热度示意（真实 N 可能很大，这里只示意结构）
      const S = Math.min(N, 24);
      const cells = [];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const v = Math.exp(-((x - y) ** 2) / (2 * 4)) * 0.8 + 0.2 / S;
        cells.push({ bg: `rgba(15,157,143,${(v * 0.95).toFixed(3)})` });
      }
      mat.replaceChildren(
        h('div', { class: 'dlab' }, `注意力矩阵示意 ${tokens}×${tokens}（每头一份，共 ${nh} 头）`),
        grid(S, cells, Math.max(5, Math.min(16, Math.floor(360 / S)))));
      box.innerHTML = `<table class="dtab">
          <tr><th>量</th><th>计算</th><th>结果</th></tr>
          <tr><td>token 数 N</td><td class="mono">${N} × ${N}</td><td class="mono">${fmt(tokens)}</td></tr>
          <tr><td>头数 nh</td><td class="mono">max(C/64, 1)</td><td class="mono">${nh}</td></tr>
          <tr><td>head_dim / key_dim</td><td class="mono">C/nh / hd×0.5</td><td class="mono">${hd} / ${kd}</td></tr>
          <tr><td>注意力矩阵元素数</td><td class="mono">nh × N²</td><td class="mono">${fmt(attnElems)}</td></tr>
          <tr><td>注意力部分 MACs</td><td class="mono">—</td><td class="mono">${macsAttn.toFixed(1)} M</td></tr>
          <tr class="tot"><td>整个 PSABlock 参数</td><td class="mono">attn + proj + pe + FFN</td><td class="mono">${fmt(psa)}</td></tr>
        </table>
        <span class="dim">★ 把 N 从 20 调到 40：注意力矩阵元素数变成 <b>4 倍</b>；调到 80 是 <b>16 倍</b>。
        这就是注意力只能待在主干末端的原因。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      slider('特征图边长 N', 10, 80, N, 10, v => { N = v; render(); }),
      slider('通道 C', 64, 512, C, 64, v => { C = v; render(); })),
      h('div', { class: 'drow' }, mat), box);
    render();
  }

  function demoPsaBlock(host) {
    let C = 256, ratio = 2;
    const box = h('div', { class: 'dres' });
    function render() {
      const nh = Math.max(Math.floor(C / 64), 1);
      const hd = Math.floor(C / nh), kd = Math.floor(hd * 0.5);
      const attn = pConv(C, C + kd * nh * 2, 1) + pConv(C, C, 1) + pConv(C, C, 3, C);
      const ffn = pConv(C, C * ratio, 1) + pConv(C * ratio, C, 1);
      const tot = attn + ffn;
      const wid = Math.max(Math.floor(360 * attn / tot), 40);
      box.innerHTML = `
        <div class="dstack">
          <div class="dseg" style="flex:${attn};background:#b79be0"><span>${fmt(attn)}</span><i>Attention（含位置编码）</i></div>
          <div class="dseg" style="flex:${ffn};background:#e8bd85"><span>${fmt(ffn)}</span><i>FFN（${C}→${C * ratio}→${C}）</i></div>
        </div>
        <table class="dtab">
          <tr><th>子层</th><th>结构</th><th>参数量</th></tr>
          <tr><td>qkv</td><td class="mono">Conv(${C} → ${C + kd * nh * 2}, 1×1)</td><td class="mono">${fmt(pConv(C, C + kd * nh * 2, 1))}</td></tr>
          <tr><td>proj</td><td class="mono">Conv(${C} → ${C}, 1×1)</td><td class="mono">${fmt(pConv(C, C, 1))}</td></tr>
          <tr><td>位置编码 pe</td><td class="mono">深度卷积 3×3（g=${C}）</td><td class="mono">${fmt(pConv(C, C, 3, C))}</td></tr>
          <tr><td>FFN 第一层</td><td class="mono">Conv(${C} → ${C * ratio}, 1×1) + 激活</td><td class="mono">${fmt(pConv(C, C * ratio, 1))}</td></tr>
          <tr><td>FFN 第二层</td><td class="mono">Conv(${C * ratio} → ${C}, 1×1) <b>无激活</b></td><td class="mono">${fmt(pConv(C * ratio, C, 1))}</td></tr>
          <tr class="tot"><td>合计</td><td class="mono">—</td><td class="mono">${fmt(tot)}</td></tr>
        </table>
        <span class="dim">位置编码用深度可分离卷积：参数只有标准 3×3 的约 1/${C}，几乎免费 —— 这是「Position-Sensitive」名字的来源。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      slider('通道 C', 64, 512, C, 64, v => { C = v; render(); }),
      slider('FFN 扩张比', 1, 4, ratio, 1, v => { ratio = v; render(); })),
      box);
    render();
  }

  /* ======================================================================
   * 9. C2PSA 半通道设计
   * ==================================================================== */
  function demoC2psa(host) {
    let C = 512, n = 1, e = 0.5, half = true;
    const box = h('div', { class: 'dres' });
    const flow = h('div', { class: 'dflow' });
    function render() {
      const c = Math.floor(C * e);
      const psa = (() => {
        const nh = Math.max(Math.floor(c / 64), 1);
        const hd = Math.floor(c / nh), kd = Math.floor(hd * 0.5);
        const attn = pConv(c, c + kd * nh * 2, 1) + pConv(c, c, 1) + pConv(c, c, 3, c);
        return attn + pConv(c, 2 * c, 1) + pConv(2 * c, c, 1);
      })();
      const p1 = pConv(C, half ? 2 * c : 2 * C, 1);
      const p2 = pConv(half ? 2 * c : 2 * C, C, 1);
      const tot = p1 + p2 + n * psa;
      const nh = Math.max(Math.floor(c / 64), 1);
      const tokens = 400;
      flow.replaceChildren(
        node(`输入 ${C}×20×20`), arrow(),
        node(`cv1 1×1 → ${half ? 2 * c : 2 * C}`, 'hot'), arrow(),
        h('div', { class: 'dbranch' },
          h('div', { class: 'dnode' }, `a：${half ? c : C} 通道旁路`),
          h('div', { class: 'dnode out' }, `b：${half ? c : C} → ${n} 个 PSABlock`)),
        arrow(), node(`Concat → cv2 → ${C}`, 'out'));
      box.innerHTML = `<table class="dtab">
          <tr><th>部件</th><th>通道</th><th>参数量</th></tr>
          <tr><td>cv1</td><td class="mono">${C} → ${half ? 2 * c : 2 * C}</td><td class="mono">${fmt(p1)}</td></tr>
          <tr><td>${n} 个 PSABlock</td><td class="mono">作用在 ${half ? c : C} 通道上</td><td class="mono">${fmt(n * psa)}</td></tr>
          <tr><td>cv2</td><td class="mono">${half ? 2 * c : 2 * C} → ${C}</td><td class="mono">${fmt(p2)}</td></tr>
          <tr class="tot"><td>合计</td><td class="mono">—</td><td class="mono">${fmt(tot)}</td></tr>
        </table>
        <b>注意力矩阵规模</b>：每头 ${tokens}×${tokens}，共 ${nh} 头 → ${fmt(nh * tokens * tokens)} 个元素
        <span class="dim">（${half ? '半通道设计下' : '若全通道都过注意力'}）</span><br>
        <span class="dim">★ 切「全通道过注意力」看参数量涨多少 —— 这就是 C2PSA 只让一半通道过注意力的动机。</span>`;
    }
    const node = (t, cls = '') => h('div', { class: 'dnode ' + cls }, t);
    const arrow = () => h('div', { class: 'darrow' }, '→');
    host.append(h('div', { class: 'dctl' },
      slider('输入通道 C', 64, 1024, C, 64, v => { C = v; render(); }),
      slider('PSABlock 个数 n', 1, 4, n, 1, v => { n = v; render(); }),
      slider('e（×100）', 25, 100, e * 100, 25, v => { e = v / 100; render(); }),
      h('button', {
        class: 'btn', onclick: e2 => {
          half = !half; e2.target.textContent = half ? '当前：半通道过注意力（官方）' : '当前：全通道过注意力（贵）';
          render();
        },
      }, '当前：半通道过注意力（官方）')),
      flow, box);
    render();
  }

  /* ======================================================================
   * 10. PAN 颈部 13 步数据流
   * ==================================================================== */
  function demoPan(host) {
    const steps = [
      { n: 11, t: '上采样 ×2', i: '512×20×20', o: '512×40×40', d: '把 P5 的强语义拉高分辨率，准备与主干 P4 拼接。零参数。', g: 'top' },
      { n: 12, t: 'Concat', i: '512×40×40 + 256×40×40（主干 L6）', o: '768×40×40', d: '通道相加。要求 H/W 一致。', g: 'top' },
      { n: 13, t: 'C3k2 融合', i: '768×40×40', o: '512×40×40', d: '★ 输出被用两次：向上给第 14 层，向下被第 18 层拼接。', g: 'top' },
      { n: 14, t: '上采样 ×2', i: '512×40×40', o: '512×80×80', d: '继续拉高分辨率。', g: 'top' },
      { n: 15, t: 'Concat', i: '512×80×80 + 128×80×80（主干 L4）', o: '640×80×80', d: '小目标从这里获得强语义。', g: 'top' },
      { n: 16, t: 'C3k2 融合', i: '640×80×80', o: '256×80×80', d: '★ 这是 P3 检测头的输入（stride 8，负责小目标）。', g: 'top' },
      { n: 17, t: 'Conv stride 2', i: '256×80×80', o: '256×40×40', d: '开始自底向上：把 P3 的精细定位往回传。用卷积而非池化（同时换通道）。', g: 'bottom' },
      { n: 18, t: 'Concat', i: '256×40×40 + 512×40×40（L13）', o: '768×40×40', d: '复用了第 13 层的特征 —— 这是 PAN 的结构红利。', g: 'bottom' },
      { n: 19, t: 'C3k2 融合', i: '768×40×40', o: '512×40×40', d: '★ P4 检测头的输入（stride 16）。', g: 'bottom' },
      { n: 20, t: 'Conv stride 2', i: '512×40×40', o: '512×20×20', d: '继续下采样。', g: 'bottom' },
      { n: 21, t: 'Concat', i: '512×20×20 + 512×20×20（L10 C2PSA）', o: '1024×20×20', d: '与主干末端（注意力模块输出）拼接。', g: 'bottom' },
      { n: 22, t: 'C3k2 融合（c3k=True）', i: '1024×20×20', o: '512×20×20', d: '★ P5 检测头的输入（stride 32）。这是颈部唯一用重 block 的一层。', g: 'bottom' },
      { n: 23, t: 'Detect', i: '[16] 256×80×80, [19] 512×40×40, [22] 512×20×20', o: '(1, 144, 8400)', d: '三个尺度各跑一遍解耦头，拼成最终输出。', g: 'head' },
    ];
    let cur = 0, playing = null;
    const info = h('div', { class: 'dres' });
    const bar = h('div', { class: 'dpan' });
    function render() {
      bar.replaceChildren(...steps.map((s, i) => h('div', {
        class: `dpanstep g-${s.g}` + (i === cur ? ' on' : '') + (i < cur ? ' done' : ''),
        onclick: () => { cur = i; render(); },
      }, h('b', {}, 'L' + s.n), h('span', {}, s.t))));
      const s = steps[cur];
      info.innerHTML = `<b>第 ${s.n} 层 · ${s.t}</b>
        <table class="dtab">
          <tr><th>输入</th><td class="mono">${s.i}</td></tr>
          <tr><th>输出</th><td class="mono">${s.o}</td></tr>
        </table>
        <p>${s.d}</p>
        <div class="dnav">
          <button class="btn" onclick="this.closest('.dres').dispatchEvent(new CustomEvent('prev'))">← 上一步</button>
          <button class="btn" onclick="this.closest('.dres').dispatchEvent(new CustomEvent('next'))">下一步 →</button>
          <span class="dim">${cur + 1} / ${steps.length}</span>
        </div>`;
      info.addEventListener('prev', () => { cur = Math.max(0, cur - 1); render(); }, { once: true });
      info.addEventListener('next', () => { cur = Math.min(steps.length - 1, cur + 1); render(); }, { once: true });
    }
    host.append(h('div', { class: 'dctl' },
      h('button', {
        class: 'btn', onclick: e => {
          if (playing) { clearInterval(playing); playing = null; e.target.textContent = '▶ 自动播放'; return; }
          e.target.textContent = '⏸ 暂停';
          cur = 0; render();
          playing = setInterval(() => {
            cur++;
            if (cur >= steps.length) { cur = steps.length - 1; clearInterval(playing); playing = null; }
            render();
          }, 1400);
        },
      }, '▶ 自动播放'),
      h('button', { class: 'btn', onclick: () => { cur = 0; render(); } }, '回到开头'),
      h('button', { class: 'btn', onclick: () => { cur = 5; render(); } }, '跳到 P3 输出')),
      bar, info);
    render();
    return () => { if (playing) clearInterval(playing); };
  }

  /* ======================================================================
   * 11. 检测头形状计算器
   * ==================================================================== */
  function demoHead(host) {
    let imgsz = 640, nc = 80, regmax = 16;
    const box = h('div', { class: 'dres' });
    function render() {
      const strides = [8, 16, 32];
      const cells = strides.map(s => imgsz / s);
      const total = cells.reduce((a, b) => a + b * b, 0);
      const no = nc + regmax * 4;
      const c2 = Math.max(16, Math.floor(256 / 4), regmax * 4);
      const c3 = Math.max(256, Math.min(nc, 100));
      box.innerHTML = `<table class="dtab">
          <tr><th>尺度</th><th>stride</th><th>特征图</th><th>格子数</th></tr>
          ${strides.map((s, i) => `<tr><td>P${3 + i}</td><td class="mono">${s}</td><td class="mono">${cells[i]}×${cells[i]}</td><td class="mono">${fmt(cells[i] * cells[i])}</td></tr>`).join('')}
          <tr class="tot"><td>合计</td><td class="mono">—</td><td class="mono">—</td><td class="mono">${fmt(total)}</td></tr>
        </table>
        <b>每个预测点的输出长度</b>：no = nc + 4×reg_max = ${nc} + ${4 * regmax} = <b class="hi">${no}</b><br>
        <b>最终输出形状</b>：<span class="mono">(1, ${no}, ${fmt(total)})</span>
        <span class="dim">　← 这就是代码里那行 <code>torch.Size([1, ${no}, ${fmt(total)}])</code></span><br>
        <span class="dim">回归分支中间通道 c2 = max(16, 256/4, 4×reg_max) = ${c2}　
        分类分支中间通道 c3 = max(256, min(nc,100)) = ${c3}</span><br>
        <span class="dim">★ 改 imgsz 看总数怎么变：模型推理时的动态 shape 问题就来自这里。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      slider('imgsz', 320, 1280, imgsz, 32, v => { imgsz = v; render(); }),
      slider('类别数 nc', 1, 200, nc, 1, v => { nc = v; render(); }),
      slider('reg_max', 8, 32, regmax, 8, v => { regmax = v; render(); })),
      box);
    render();
  }

  /* ======================================================================
   * 12. DFL 分布 → 期望距离
   * ==================================================================== */
  function demoDfl(host) {
    let dist = [0, 0, .05, .45, .35, .1, .03, .02, 0, 0, 0, 0, 0, 0, 0, 0];
    const bars = h('div', { class: 'dflbars' });
    const box = h('div', { class: 'dres' });
    function render() {
      const sum = dist.reduce((a, b) => a + b, 0) || 1;
      const p = dist.map(v => v / sum);
      const expect = p.reduce((a, v, i) => a + v * i, 0);
      const maxv = Math.max(...p, 0.01);
      bars.replaceChildren(...p.map((v, i) => h('div', {
        class: 'dflbar', title: `桶 ${i}: ${(v * 100).toFixed(1)}%`,
        onclick: () => { dist[i] = (dist[i] || 0) + 0.1; render(); },
      }, h('div', { class: 'dflfill', style: `height:${(v / maxv * 100).toFixed(1)}%` }),
        h('span', {}, String(i)))));
      const trueD = 3.7;
      const loss = -(Math.log(Math.max(p[3], 1e-9)) * (1 - (trueD - 3)) + Math.log(Math.max(p[4], 1e-9)) * (trueD - 3));
      box.innerHTML = `
        <b>期望距离 d̂ = Σ pᵢ·i = <span class="hi">${expect.toFixed(3)}</span></b>
        <span class="dim">（点击柱子可以给它加概率，感受分布变化如何影响期望）</span><br>
        <span class="dim">分布越「尖」，说明网络越确信；分布越平，说明边界模糊 —— 这是直接回归一个数做不到的表达能力。</span><br>
        <span class="mono">假设真值距离 = ${trueD}：DFL loss ≈ ${loss.toFixed(3)}
        （对桶 3 与桶 4 按小数部分加权求交叉熵）</span>
        <div class="dctl" style="margin-top:8px">
          <button class="btn" onclick="this.closest('.dres').dispatchEvent(new CustomEvent('sharpen'))">分布更尖锐</button>
          <button class="btn" onclick="this.closest('.dres').dispatchEvent(new CustomEvent('flatten'))">分布更平坦</button>
          <button class="btn" onclick="this.closest('.dres').dispatchEvent(new CustomEvent('reset'))">重置</button>
        </div>`;
      box.addEventListener('sharpen', () => {
        dist = dist.map((v, i) => Math.exp(-((i - 3.7) ** 2) / 0.6)); render();
      }, { once: true });
      box.addEventListener('flatten', () => {
        dist = dist.map((v, i) => Math.exp(-((i - 3.7) ** 2) / 8)); render();
      }, { once: true });
      box.addEventListener('reset', () => {
        dist = [0, 0, .05, .45, .35, .1, .03, .02, 0, 0, 0, 0, 0, 0, 0, 0]; render();
      }, { once: true });
    }
    host.append(h('div', { class: 'dlab' }, '每条边 16 个桶的概率分布（横轴 = 桶编号 = 距离的整数值）'), bars, box);
    render();
  }

  /* ======================================================================
   * 13. TAL 标签分配
   * ==================================================================== */
  function demoTal(host) {
    let topk = 10, alpha = 0.5, beta = 6;
    const box = h('div', { class: 'dres' });
    const vis = h('div', { class: 'dtal' });
    // 造一组格子的 s（分类得分）与 u（IoU）
    const rand = (() => { let s = 42; return () => (s = s * 1103515245 + 12345 & 0x7fffffff) / 0x7fffffff; })();
    const N = 10;
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const inGt = x >= 2 && x <= 7 && y >= 2 && y <= 7;
      const cx = (x - 4.5) / 3, cy = (y - 4.5) / 3;
      const near = Math.exp(-(cx * cx + cy * cy) * 1.6);
      cells.push({
        x, y, inGt,
        s: inGt ? 0.25 + near * 0.7 + rand() * 0.05 : rand() * 0.1,
        u: inGt ? 0.3 + near * 0.65 + rand() * 0.05 : 0,
      });
    }
    function render() {
      const cands = cells.filter(c => c.inGt);
      cands.forEach(c => c.t = Math.pow(c.s, alpha) * Math.pow(c.u, beta));
      const sorted = [...cands].sort((a, b) => b.t - a.t);
      const pos = new Set(sorted.slice(0, topk).map(c => c.x + ',' + c.y));
      const maxT = sorted[0]?.t || 1;
      vis.replaceChildren(
        h('div', { class: 'dlab' }, `网格 10×10，绿框 = 真值框；彩色格子 = 落在框内的候选点，颜色深浅 = 对齐度 t`),
        grid(N, cells.map(c => {
          const isPos = pos.has(c.x + ',' + c.y);
          const a = c.inGt ? 0.15 + (c.t / maxT) * 0.8 : 0;
          return {
            t: isPos ? '✓' : '',
            bg: isPos ? '#16a34a' : c.inGt ? `rgba(15,157,143,${a.toFixed(2)})` : '#f1f5f9',
            fg: '#fff',
          };
        }), 30));
      const detail = sorted.slice(0, Math.min(12, sorted.length)).map((c, i) =>
        `<tr class="${i < topk ? 'pos' : ''}"><td class="mono">(${c.x},${c.y})</td>
         <td class="mono">${c.s.toFixed(3)}</td><td class="mono">${c.u.toFixed(3)}</td>
         <td class="mono">${c.t.toFixed(4)}</td>
         <td>${i < topk ? '<b class="hi">正样本</b>' : '<span class="dim">负样本</span>'}</td></tr>`).join('');
      box.innerHTML = `<b>对齐度公式</b> <span class="mono">t = s^α × u^β = s^${alpha} × u^${beta}</span>
        <span class="dim">（β 远大于 α：定位质量主导正样本选择）</span><br>
        <b>候选点数</b> ${cands.length}　<b>取 top-${topk}</b> → 正样本 ${Math.min(topk, cands.length)} 个<br>
        <table class="dtab">
          <tr><th>位置</th><th>分类得分 s</th><th>IoU u</th><th>对齐度 t</th><th>判定</th></tr>
          ${detail}
        </table>
        <span class="dim">★ 调大 β 看「框得准的点」如何被优先选中；调小 topk 看正样本变少（正样本不足会拖慢收敛）。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      slider('top-k', 1, 20, topk, 1, v => { topk = v; render(); }),
      slider('α（×10）', 0, 20, alpha * 10, 5, v => { alpha = v / 10; render(); }),
      slider('β', 0, 12, beta, 1, v => { beta = v; render(); })),
      vis, box);
    render();
  }

  /* ======================================================================
   * 14. NMS
   * ==================================================================== */
  function demoNms(host) {
    const boxes = [
      { x: 40, y: 40, w: 110, h: 96, s: 0.91, c: 0 },
      { x: 48, y: 46, w: 110, h: 96, s: 0.84, c: 0 },
      { x: 34, y: 44, w: 110, h: 96, s: 0.79, c: 0 },
      { x: 44, y: 36, w: 110, h: 96, s: 0.72, c: 0 },
      { x: 56, y: 50, w: 104, h: 92, s: 0.55, c: 0 },
      { x: 190, y: 60, w: 100, h: 90, s: 0.80, c: 1 },   // 另一个类别的独立目标
      { x: 196, y: 66, w: 100, h: 90, s: 0.62, c: 1 },
    ];
    let iou = 0.7, agnostic = false;
    const svg = h('div', { class: 'dnms' });
    const box = h('div', { class: 'dres' });
    const iouOf = (a, b) => {
      const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.w, ay2 = a.y + a.h;
      const bx1 = b.x, by1 = b.y, bx2 = b.x + b.w, by2 = b.y + b.h;
      const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
      const iy = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
      const inter = ix * iy;
      return inter / (a.w * a.h + b.w * b.h - inter);
    };
    function runNms() {
      const groups = agnostic ? [boxes] : [boxes.filter(b => b.c === 0), boxes.filter(b => b.c === 1)];
      const keep = [], removed = [];
      for (const g of groups) {
        let rest = [...g].sort((a, b) => b.s - a.s);
        while (rest.length) {
          const cur = rest.shift();
          keep.push(cur);
          const nxt = [];
          for (const o of rest) {
            const v = iouOf(cur, o);
            if (v > iou) removed.push({ box: o, by: cur, v }); else nxt.push(o);
          }
          rest = nxt;
        }
      }
      return { keep, removed };
    }
    function render() {
      const { keep, removed } = runNms();
      const keepSet = new Set(keep);
      const rmMap = new Map(removed.map(r => [r.box, r]));
      const W = 340, H = 220;
      const parts = [];
      for (const b of boxes) {
        const isKeep = keepSet.has(b);
        const rm = rmMap.get(b);
        const color = isKeep ? '#16a34a' : rm ? '#dc2626' : '#94a3b8';
        parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none"
          stroke="${color}" stroke-width="${isKeep ? 3 : 2}"
          stroke-dasharray="${isKeep ? '' : '5 3'}" opacity="${isKeep ? 1 : .65}"/>`);
        parts.push(`<text x="${b.x + b.w - 30}" y="${b.y + 16}" fill="${color}"
          font-size="11" font-family="monospace">${b.s.toFixed(2)}</text>`);
        parts.push(`<text x="${b.x + 4}" y="${b.y + b.h - 6}" fill="${color}"
          font-size="10">类${b.c}</text>`);
      }
      svg.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:420px;height:auto;background:#f8fafc;border:1px solid var(--line);border-radius:8px">${parts.join('')}</svg>`;
      const rmList = removed.map(r =>
        `<tr><td class="mono">${r.box.s.toFixed(2)}</td><td class="mono">${r.v.toFixed(3)}</td>
         <td class="mono">${r.by.s.toFixed(2)}</td><td><span class="dim">被抑制</span></td></tr>`).join('');
      box.innerHTML = `<b>IoU 阈值 ${iou}　模式：${agnostic ? '跨类别抑制 agnostic_nms=True' : '按类别独立 NMS（默认）'}</b>
        <span class="dim">（绿实线 = 保留；红虚线 = 被抑制）</span><br>
        保留 <b class="hi">${keep.length}</b> 个框，抑制 <b>${removed.length}</b> 个<br>
        <table class="dtab">
          <tr><th>被抑制框分数</th><th>与谁的 IoU</th><th>保留框分数</th><th>结果</th></tr>
          ${rmList || '<tr><td colspan="4" class="dim">当前阈值下没有被抑制的框</td></tr>'}
        </table>
        <span class="dim">★ 把阈值拖到 0.3 看密集框被大量删除（可能漏检）；拖到 0.95 看重复框残留。
        切到 agnostic 看跨类别抑制如何误删「类别 1」的目标。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      slider('IoU 阈值（×100）', 10, 95, iou * 100, 5, v => { iou = v / 100; render(); }),
      h('button', {
        class: 'btn', onclick: e => {
          agnostic = !agnostic;
          e.target.textContent = agnostic ? 'agnostic_nms = True' : 'agnostic_nms = False（默认）';
          render();
        },
      }, 'agnostic_nms = False（默认）')),
      svg, box);
    render();
  }

  /* ======================================================================
   * 15. mAP / PR 曲线
   * ==================================================================== */
  function demoMap(host) {
    let iouT = 0.5, quality = 0.8;
    const svg = h('div', { class: 'dmAP' });
    const box = h('div', { class: 'dres' });
    function curve(iouT, quality) {
      // 用一个受 IoU 阈值与模型质量控制的解析式模拟 PR 曲线
      const pts = [];
      const stiff = 1 + (iouT - 0.5) * 4;      // 阈值越高，曲线越早塌
      const base = Math.min(0.99, 0.55 + quality * 0.5);
      for (let r = 0; r <= 1.0001; r += 0.02) {
        const p = Math.max(0, Math.min(1, base * Math.exp(-Math.pow(r / (1 / stiff + .08), 2.2)) + 0.02));
        pts.push([r, p]);
      }
      return pts;
    }
    const ap = pts => {
      // 单调化 + 积分
      const m = pts.map(p => p[1]);
      for (let i = m.length - 2; i >= 0; i--) m[i] = Math.max(m[i], m[i + 1]);
      let a = 0;
      for (let i = 0; i < pts.length - 1; i++) a += (pts[i + 1][0] - pts[i][0]) * m[i + 1];
      return a;
    };
    function render() {
      const pts = curve(iouT, quality);
      const a = ap(pts);
      const W = 260, H = 200, PAD = 30;
      const X = r => PAD + r * (W - PAD - 12);
      const Y = p => H - PAD - p * (H - PAD - 12);
      const path = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
      const area = path + ` L${X(1)},${Y(0)} L${X(0)},${Y(0)} Z`;
      svg.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:320px;height:auto">
        <line x1="${PAD}" y1="${Y(0)}" x2="${W - 6}" y2="${Y(0)}" stroke="#94a3b8"/>
        <line x1="${PAD}" y1="${Y(1)}" x2="${PAD}" y2="${Y(0)}" stroke="#94a3b8"/>
        <path d="${area}" fill="rgba(15,157,143,.15)"/>
        <path d="${path}" fill="none" stroke="#0f9d8f" stroke-width="2.4"/>
        <text x="${PAD - 4}" y="${Y(1) + 4}" font-size="10" text-anchor="end" fill="#64748b">1.0</text>
        <text x="${PAD - 4}" y="${Y(0) + 4}" font-size="10" text-anchor="end" fill="#64748b">0</text>
        <text x="${(W + PAD) / 2}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#64748b">Recall →</text>
        <text x="10" y="14" font-size="11" fill="#0b7a70" font-weight="700">AP = ${a.toFixed(3)}</text>
      </svg>`;
      // mAP50-95：扫 10 个阈值取平均
      let sum = 0;
      for (let i = 0; i < 10; i++) sum += ap(curve(0.5 + i * 0.05, quality));
      const map5095 = sum / 10;
      const ap50 = ap(curve(0.5, quality));
      box.innerHTML = `
        <table class="dtab">
          <tr><th>指标</th><th>含义</th><th>当前值</th></tr>
          <tr><td>AP@IoU=${iouT.toFixed(2)}</td><td class="dim">当前阈值下的单点 AP</td><td class="mono">${a.toFixed(3)}</td></tr>
          <tr><td>mAP50</td><td class="dim">IoU=0.50 的 AP</td><td class="mono">${ap50.toFixed(3)}</td></tr>
          <tr class="tot"><td>mAP50-95</td><td class="dim">10 个阈值（0.50~0.95）AP 平均</td><td class="mono">${map5095.toFixed(3)}</td></tr>
        </table>
        <span class="dim">★ 提高 IoU 阈值 = 对定位要求更严 → 曲线整体下移、AP 下降。
        这就是 mAP50-95 一定低于 mAP50 的原因（差值通常 15~22 个点）。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      slider('IoU 阈值（×100）', 50, 95, iouT * 100, 5, v => { iouT = v / 100; render(); }),
      slider('模型质量（×100）', 30, 100, quality * 100, 5, v => { quality = v / 100; render(); })),
      h('div', { class: 'drow' }, svg, box));
    render();
  }

  /* ======================================================================
   * 16. 复合缩放
   * ==================================================================== */
  function demoScale(host) {
    let variant = 's';
    const SC = {
      n: { d: 0.5, w: 0.25, m: 1024, p: 2623632, f: 6.5, ap: 39.5 },
      s: { d: 0.5, w: 0.5, m: 1024, p: 9458304, f: 21.6, ap: 47.0 },
      m: { d: 0.5, w: 1.0, m: 512, p: 20114240, f: 68.1, ap: 51.5 },
      l: { d: 1.0, w: 1.0, m: 512, p: 25371712, f: 87.2, ap: 53.4 },
      x: { d: 1.0, w: 1.5, m: 512, p: 56965728, f: 195.3, ap: 54.7 },
    };
    const box = h('div', { class: 'dres' });
    const bars = h('div', { class: 'dbars' });
    const md = (c, w, mc) => Math.max(8, Math.floor(Math.min(c, mc) * w + 4) / 8 | 0) * 8;
    function render() {
      const c = SC[variant];
      const rows = [
        ['主干 L0 Conv [64]', 64], ['主干 L5 Conv [512]', 512],
        ['主干 L8 C3k2 [1024]', 1024], ['颈部 L13 C3k2 [512]', 512],
      ];
      const maxP = Math.max(...Object.values(SC).map(v => v.p));
      bars.replaceChildren(...Object.entries(SC).map(([k, v]) => h('div', {
        class: 'dbar', onclick: () => { variant = k; render(); }, style: 'cursor:pointer',
      },
        h('span', { class: 'dbl' + (k === variant ? ' on' : '') }, 'yolo11' + k),
        h('div', { class: 'dbt' }, h('div', {
          class: 'dbf', style: `width:${(v.p / maxP * 100).toFixed(1)}%;background:${k === variant ? '#0f9d8f' : '#93c2e6'}`,
        })),
        h('span', { class: 'dbv mono' }, (v.p / 1e6).toFixed(1) + 'M'))));
      box.innerHTML = `<b>yolo11${variant}</b>　depth=${c.d}　width=${c.w}　max_channels=${c.m}<br>
        <table class="dtab">
          <tr><th>位置</th><th>yaml 基准通道</th><th>缩放公式</th><th>实际通道</th></tr>
          ${rows.map(([n, base]) => `<tr><td class="mono">${n}</td><td class="mono">${base}</td>
            <td class="mono dim">min(${base},${c.m})×${c.w}</td><td class="mono"><b>${md(base, c.w, c.m)}</b></td></tr>`).join('')}
        </table>
        <table class="dtab">
          <tr><th>参数量</th><td class="mono">${fmt(c.p)}</td></tr>
          <tr><th>FLOPs</th><td class="mono">${c.f} G</td></tr>
          <tr><th>COCO mAP50-95</th><td class="mono">${c.ap}</td></tr>
          <tr><th>C3k2 内部 block 数（repeats=2 缩放后）</th><td class="mono">${c.d > 1 ? 2 : 1}</td></tr>
        </table>
        <span class="dim">★ 参数量与 FLOPs 来自我按官方 yaml 逐层推导的结果，与官方公布值误差 ≤0.02%。
        点柱子切换变体，观察通道如何随 width 变化。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      ...Object.keys(SC).map(k => h('button', {
        class: 'btn' + (k === variant ? ' on' : ''), onclick: e => {
          variant = k;
          [...e.target.parentNode.querySelectorAll('.btn')].forEach(b => b.classList.remove('on'));
          e.target.classList.add('on'); render();
        },
      }, 'yolo11' + k))),
      bars, box);
    render();
  }

  /* ======================================================================
   * 17. letterbox 坐标映射
   * ==================================================================== */
  function demoLetterbox(host) {
    let W = 1920, H = 1080, target = 640, bx = 0.35, by = 0.4, bw = 0.22, bh = 0.3;
    const svg = h('div', { class: 'dlb' });
    const box = h('div', { class: 'dres' });
    function render() {
      const r = Math.min(target / W, target / H);
      const nw = Math.round(W * r), nh = Math.round(H * r);
      const dw = (target - nw) / 2, dh = (target - nh) / 2;
      // 原图上的框（像素）
      const ox1 = bx * W, oy1 = by * H, ox2 = ox1 + bw * W, oy2 = oy1 + bh * H;
      // 映射到网络输入坐标系
      const nx1 = ox1 * r + dw, ny1 = oy1 * r + dh;
      const nx2 = ox2 * r + dw, ny2 = oy2 * r + dh;
      // 反向还原
      const rx1 = (nx1 - dw) / r, ry1 = (ny1 - dh) / r;
      const rx2 = (nx2 - dw) / r, ry2 = (ny2 - dh) / r;
      const scaleUI = 380 / Math.max(W, target + 20);
      const draw = (w, h, x0, y0, boxCoords, pad, label, fill) => {
        const s = 380 / w;
        return `<div style="position:relative;width:${(w * s).toFixed(1)}px;height:${(h * s).toFixed(1)}px;background:${fill};border:1px solid var(--line)">
          ${pad ? `<div style="position:absolute;left:0;top:0;width:100%;height:${(pad.dh * s).toFixed(1)}px;background:#727272"></div>
                   <div style="position:absolute;left:0;bottom:0;width:100%;height:${(pad.dh * s).toFixed(1)}px;background:#727272"></div>
                   <div style="position:absolute;left:0;top:0;height:100%;width:${(pad.dw * s).toFixed(1)}px;background:#727272"></div>
                   <div style="position:absolute;right:0;top:0;height:100%;width:${(pad.dw * s).toFixed(1)}px;background:#727272"></div>` : ''}
          <div style="position:absolute;left:${(boxCoords[0] * s).toFixed(1)}px;top:${(boxCoords[1] * s).toFixed(1)}px;
               width:${((boxCoords[2] - boxCoords[0]) * s).toFixed(1)}px;height:${((boxCoords[3] - boxCoords[1]) * s).toFixed(1)}px;
               border:2px solid #16a34a"></div>
          <div style="position:absolute;left:4px;bottom:4px;font-size:11px;color:#334155;background:rgba(255,255,255,.8);padding:1px 4px;border-radius:3px">${label}</div>
        </div>`;
      };
      svg.innerHTML = `<div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start">
        ${draw(W, H, 0, 0, [ox1, oy1, ox2, oy2], null, `原图 ${W}×${H}`, '#dbeafe')}
        ${draw(target, target, 0, 0, [nx1, ny1, nx2, ny2], { dw, dh }, `网络输入 ${target}×${target}`, '#fff')}
      </div>`;
      box.innerHTML = `<table class="dtab">
          <tr><th>量</th><th>公式</th><th>值</th></tr>
          <tr><td>缩放比 r</td><td class="mono">min(${target}/${W}, ${target}/${H})</td><td class="mono">${r.toFixed(4)}</td></tr>
          <tr><td>缩放后尺寸</td><td class="mono">round(${W}×r), round(${H}×r)</td><td class="mono">${nw} × ${nh}</td></tr>
          <tr><td>padding (dw, dh)</td><td class="mono">(${target}−${nw})/2, (${target}−${nh})/2</td><td class="mono">${dw.toFixed(1)}, ${dh.toFixed(1)}</td></tr>
          <tr><td>原图框（像素）</td><td class="mono">xyxy</td><td class="mono">${ox1.toFixed(1)}, ${oy1.toFixed(1)}, ${ox2.toFixed(1)}, ${oy2.toFixed(1)}</td></tr>
          <tr><td>输入坐标系框</td><td class="mono">×r + padding</td><td class="mono">${nx1.toFixed(1)}, ${ny1.toFixed(1)}, ${nx2.toFixed(1)}, ${ny2.toFixed(1)}</td></tr>
          <tr class="tot"><td>反向还原</td><td class="mono">(−padding)/r</td><td class="mono">${rx1.toFixed(1)}, ${ry1.toFixed(1)}, ${rx2.toFixed(1)}, ${ry2.toFixed(1)}</td></tr>
        </table>
        <span class="dim">★ 最后一行应当与「原图框」完全一致 —— 这就是部署时坐标还原必须做对的原因。
        把填充值改成 0（纯黑）会让网络把黑边当特征，实测掉点。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      slider('原图宽', 320, 3000, W, 40, v => { W = v; render(); }),
      slider('原图高', 240, 2000, H, 40, v => { H = v; render(); }),
      slider('目标尺寸', 320, 1280, target, 32, v => { target = v; render(); }),
      slider('框 x（×100）', 0, 80, bx * 100, 5, v => { bx = v / 100; render(); }),
      slider('框 y（×100）', 0, 70, by * 100, 5, v => { by = v / 100; render(); })),
      svg, box);
    render();
  }

  /* ======================================================================
   * 18. 训练时序动画
   * ==================================================================== */
  function demoPipeline(host) {
    const stages = [
      ['①', 'DataLoader', 'workers 个进程并行读图 + 读标签', 'CPU'],
      ['②', '在线增强', 'mosaic / mixup / HSV / 翻转 / copy_paste', 'CPU'],
      ['③', '预处理', 'letterbox + /255 + CHW + 打包 batch', 'CPU→GPU'],
      ['④', '前向传播', '主干 → 颈部 → 检测头，输出 (B,144,8400)', 'GPU'],
      ['⑤', '标签分配 TAL', '按对齐度 t = s^α·u^β 取 top-k 正样本', 'GPU'],
      ['⑥', '三项损失', 'box(CIoU+DFL) + cls(BCE) 加权求和', 'GPU'],
      ['⑦', '反向传播', 'AMP 混合精度，梯度回传至主干', 'GPU'],
      ['⑧', '优化器更新', 'SGD/AdamW + 动量 + 权重衰减', 'GPU'],
      ['⑨', 'EMA 更新', '滑动平均权重（验证与导出都用它）', 'GPU'],
    ];
    let cur = -1, timer = null;
    const rack = h('div', { class: 'dpipe' });
    const box = h('div', { class: 'dres' });
    function render() {
      rack.replaceChildren(...stages.map((s, i) => h('div', {
        class: 'dpstep' + (i === cur ? ' on' : '') + (cur >= 0 && i < cur ? ' done' : ''),
        onclick: () => { cur = i; render(); },
      },
        h('b', {}, s[0]), h('span', { class: 'dpn' }, s[1]),
        h('i', { class: 'dpg' }, s[3]))));
      box.innerHTML = cur < 0
        ? `<b>点任意阶段查看细节，或点「播放」看完整一轮</b>
           <p class="dim">一个 epoch 里，这 9 个阶段会循环「训练图数量 ÷ batch」次，然后做一次验证。</p>`
        : `<b>${stages[cur][0]} ${stages[cur][1]}</b><span class="dim">　（${stages[cur][3]}）</span>
           <p>${stages[cur][2]}</p>` + (cur === 8 ? `<p class="dim">★ 这就是为什么 best.pt 的效果比你训练时看到的更好 —— 验证用的是 EMA 权重。</p>` : '');
    }
    host.append(h('div', { class: 'dctl' },
      h('button', {
        class: 'btn', onclick: e => {
          if (timer) { clearInterval(timer); timer = null; e.target.textContent = '▶ 播放一轮'; return; }
          e.target.textContent = '⏸ 暂停';
          cur = -1;
          timer = setInterval(() => {
            cur++;
            if (cur >= stages.length) { cur = stages.length - 1; clearInterval(timer); timer = null; }
            render();
          }, 900);
        },
      }, '▶ 播放一轮'),
      h('button', { class: 'btn', onclick: () => { cur = -1; render(); } }, '重置')),
      rack, box);
    render();
    return () => { if (timer) clearInterval(timer); };
  }

  /* ======================================================================
   * 19. 感受野累积计算器
   * ==================================================================== */
  function demoRf(host) {
    let imgsz = 640, k = 3, s = 2, n = 5;
    const box = h('div', { class: 'dres' });
    function render() {
      const rows = [];
      let rf = 1, jump = 1;
      for (let i = 1; i <= n; i++) {
        rf = rf + (k - 1) * jump;
        jump *= s;
        rows.push({ i, rf, jump });
      }
      const last = rows[rows.length - 1];
      const cellRes = imgsz / last.jump;
      box.innerHTML = `<table class="dtab">
          <tr><th>层</th><th>计算</th><th>感受野</th><th>总 stride</th></tr>
          ${rows.map(r => `<tr><td>${r.i}</td><td class="mono dim">rf += (${k}−1)×${r.jump / s}</td>
            <td class="mono">${r.rf}</td><td class="mono">${r.jump}</td></tr>`).join('')}
        </table>
        <b>${n} 层 ${k}×${k} stride ${s} 卷积后：感受野 = <span class="hi">${last.rf}×${last.rf}</span>，
        总 stride = ${last.jump}</b><br>
        <span class="mono">输入 ${imgsz} → 特征图 ${cellRes}×${cellRes}；
        一个特征点「看到」原图 ${last.rf}×${last.rf} 的区域，占总面积的
        <b>${(last.rf * last.rf / (imgsz * imgsz) * 100).toFixed(2)}%</b></span><br>
        <span class="dim">公式：rf = rf + (k−1)·jump；jump = jump × s。stride 越大，感受野涨得越快，但分辨率掉得也越快。</span>`;
    }
    host.append(h('div', { class: 'dctl' },
      slider('层数', 1, 12, n, 1, v => { n = v; render(); }),
      slider('卷积核 k', 1, 7, k, 2, v => { k = v; render(); }),
      slider('stride', 1, 2, s, 1, v => { s = v; render(); }),
      slider('输入边长', 320, 1280, imgsz, 32, v => { imgsz = v; render(); })),
      box);
    render();
  }

  /* ======================================================================
   * 20. 锚框 vs Anchor-free
   * ==================================================================== */
  function demoAnchorfree(host) {
    let mode = 'free', nAnchor = 3;
    const box = h('div', { class: 'dres' });
    const vis = h('div', { class: 'daf' });
    function render() {
      const W = 300, H = 200, gt = { x: 95, y: 70, w: 110, h: 62 };
      const cellW = W / 6, cellH = H / 4;
      const cx = Math.floor((gt.x + gt.w / 2) / cellW), cy = Math.floor((gt.y + gt.h / 2) / cellH);
      const ax = cx * cellW + cellW / 2, ay = cy * cellH + cellH / 2;
      const anchors = [
        { w: 60, h: 40 }, { w: 110, h: 62 }, { w: 170, h: 90 },
      ].slice(0, nAnchor);
      let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:420px;height:auto;background:#f8fafc;border:1px solid var(--line);border-radius:8px">`;
      for (let i = 1; i < 6; i++) svg += `<line x1="${i * cellW}" y1="0" x2="${i * cellW}" y2="${H}" stroke="#e2e8f0"/>`;
      for (let i = 1; i < 4; i++) svg += `<line x1="0" y1="${i * cellH}" x2="${W}" y2="${i * cellH}" stroke="#e2e8f0"/>`;
      if (mode === 'anchor') {
        for (let gx = 0; gx < 6; gx++) for (let gy = 0; gy < 4; gy++) {
          const px = gx * cellW + cellW / 2, py = gy * cellH + cellH / 2;
          if (gx !== cx || gy !== cy) continue;
          anchors.forEach(a => {
            svg += `<rect x="${px - a.w / 2}" y="${py - a.h / 2}" width="${a.w}" height="${a.h}"
              fill="none" stroke="#dd93b7" stroke-width="1.6" stroke-dasharray="4 3"/>`;
          });
        }
      }
      svg += `<rect x="${gt.x}" y="${gt.y}" width="${gt.w}" height="${gt.h}" fill="none" stroke="#16a34a" stroke-width="2.6"/>`;
      svg += `<text x="${gt.x}" y="${gt.y - 5}" font-size="11" fill="#15803d">真值框</text>`;
      if (mode === 'free') {
        svg += `<circle cx="${ax}" cy="${ay}" r="5" fill="#e08a2e"/>`;
        const l = ax - gt.x, t = ay - gt.y, r2 = gt.x + gt.w - ax, b = gt.y + gt.h - ay;
        const ar = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e08a2e" stroke-width="2" marker-end="url(#ah2)"/>`;
        svg += `<defs><marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#e08a2e"/></marker></defs>`;
        svg += ar(ax, ay, gt.x, ay) + ar(ax, ay, ax, gt.y) + ar(ax, ay, gt.x + gt.w, ay) + ar(ax, ay, ax, gt.y + gt.h);
        svg += `<text x="${(ax + gt.x) / 2}" y="${ay - 5}" font-size="10" fill="#b45309">l=${l.toFixed(0)}</text>`;
        svg += `<text x="${ax + 5}" y="${(ay + gt.y) / 2}" font-size="10" fill="#b45309">t=${t.toFixed(0)}</text>`;
        svg += `<text x="${(ax + gt.x + gt.w) / 2 - 16}" y="${ay - 5}" font-size="10" fill="#b45309">r=${r2.toFixed(0)}</text>`;
        svg += `<text x="${ax + 5}" y="${(ay + gt.y + gt.h) / 2}" font-size="10" fill="#b45309">b=${b.toFixed(0)}</text>`;
      }
      svg += '</svg>';
      vis.innerHTML = svg;
      const nCells = 6 * 4;
      box.innerHTML = `<b>${mode === 'anchor' ? 'Anchor-based（v5 风格）' : 'Anchor-free（v8 / v11）'}</b>
        <table class="dtab">
          <tr><th>量</th><th>值</th></tr>
          <tr><td>格子数</td><td class="mono">${nCells}（6×4 示意）</td></tr>
          <tr><td>每格锚框数</td><td class="mono">${mode === 'anchor' ? nAnchor : 0}</td></tr>
          <tr><td>预测点总数</td><td class="mono">${mode === 'anchor' ? nCells * nAnchor : nCells}</td></tr>
          <tr><td>输出通道（80 类）</td><td class="mono">${mode === 'anchor' ? nAnchor + '×(5+80) = ' + nAnchor * 85 : '4×16+80 = 144'}</td></tr>
          <tr><td>需要锚框聚类</td><td class="mono">${mode === 'anchor' ? '需要（换数据集要重来）' : '不需要'}</td></tr>
        </table>
        <span class="dim">★ 注意 anchor-free 不是「不需要正负样本」，而是取消了预置锚框 —— 正样本分配交给 TAL 动态决定。</span>
        <div class="dctl" style="margin-top:8px">
          <button class="btn" onclick="this.closest('.dres').dispatchEvent(new CustomEvent('m'))">切换模式</button>
          ${mode === 'anchor' ? '<button class="btn" onclick="this.closest(\'.dres\').dispatchEvent(new CustomEvent(\'a\'))">+1 个锚框</button>' : ''}
        </div>`;
      box.addEventListener('m', () => { mode = mode === 'anchor' ? 'free' : 'anchor'; render(); }, { once: true });
      box.addEventListener('a', () => { nAnchor = nAnchor >= 5 ? 1 : nAnchor + 1; render(); }, { once: true });
    }
    host.append(vis, box);
    render();
  }

  return {
    conv: demoConv, dwconv: demoDwconv, bottleneck: demoBottleneck,
    c3k: demoC3k, c2f: demoC3k2, c3k2: demoC3k2,
    sppf: demoSppf, attention: demoAttention, psablock: demoPsaBlock, c2psa: demoC2psa,
    pan: demoPan, head: demoHead, dfl: demoDfl, anchorfree: demoAnchorfree,
    tal: demoTal, nms: demoNms, map: demoMap, scale: demoScale,
    letterbox: demoLetterbox, pipeline: demoPipeline, rf: demoRf,
  };
})();
