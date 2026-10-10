/* ============================================================================
 * YOLO11 逐模块精细解析 · 第 2 部分：检测头 / 训练机制 / 工程
 * 追加到 window.Y11_MODULES
 * ==========================================================================*/
window.Y11_MODULES.push(

/* ==================== E. 检测头 ==================== */
{
  id: "head", title: "★ Detect 解耦检测头", group: "E · 检测头", weight: 3, difficulty: "★★★",
  oneLine: "分类和回归各用一条独立卷积分支；YOLO11 把分类分支的 3×3 换成了「深度可分离 + 1×1」。",
  why: `早期 YOLO 用一个分支同时输出类别和框位置。问题是这两个任务的关注点冲突：分类关心「这块区域像不像猫」，对位置微调不敏感；回归关心「边界到底在哪一个像素」，对类别不敏感。共享参数时两个目标会互相妥协。解耦头让它们各走一条分支，各自专心。而 YOLO11 进一步发现：分类分支的 3×3 卷积在高分辨率尺度上贵得离谱（80×80 上一个 256→256 的 3×3 就是 37.7 亿 MACs，比整个 yolo11n 还大），而分类对空间细节并不敏感——所以换成深度可分离卷积。`,
  structure: `<svg viewBox="0 0 840 360" class="fig">
  <defs><marker id="ad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.in{fill:#e7f3ff;stroke:#b9d8f5;stroke-width:1.4}.reg{fill:#fdf1c9;stroke:#e6cf7a;stroke-width:1.4}
  .cls{fill:#dde6fb;stroke:#a9bff0;stroke-width:1.4}.out{fill:#eef1f5;stroke:#c6d2e0;stroke-width:1.3}
  .lb{font:11px var(--sans);fill:#3d4a5c}.ti{font:700 11.5px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.5;fill:none;marker-end:url(#ad)}</style></defs>
  <rect class="in" x="8" y="140" width="112" height="64" rx="8"/>
  <text class="ti" x="64" y="166" text-anchor="middle">颈部输出</text>
  <text class="lb" x="64" y="186" text-anchor="middle">P3 / P4 / P5</text>
  <rect class="reg" x="168" y="42" width="126" height="44" rx="8"/>
  <text class="ti" x="231" y="62" text-anchor="middle">Conv 3×3</text><text class="lb" x="231" y="78" text-anchor="middle">x → c2</text>
  <rect class="reg" x="324" y="42" width="126" height="44" rx="8"/>
  <text class="ti" x="387" y="62" text-anchor="middle">Conv 3×3</text><text class="lb" x="387" y="78" text-anchor="middle">c2 → c2</text>
  <rect class="out" x="480" y="42" width="158" height="44" rx="8"/>
  <text class="ti" x="559" y="62" text-anchor="middle">Conv2d 1×1</text><text class="lb" x="559" y="78" text-anchor="middle">→ 4×16 = 64（DFL）</text>
  <text class="lb" x="648" y="68">回归分支 cv2</text>
  <rect class="cls" x="168" y="252" width="160" height="44" rx="8"/>
  <text class="ti" x="248" y="272" text-anchor="middle">DWConv 3×3 + Conv 1×1</text>
  <text class="lb" x="248" y="288" text-anchor="middle">空间卷积 → 通道混合</text>
  <rect class="cls" x="352" y="252" width="160" height="44" rx="8"/>
  <text class="ti" x="432" y="272" text-anchor="middle">DWConv 3×3 + Conv 1×1</text>
  <rect class="out" x="536" y="252" width="140" height="44" rx="8"/>
  <text class="ti" x="606" y="272" text-anchor="middle">Conv2d 1×1</text><text class="lb" x="606" y="288" text-anchor="middle">→ nc（类别数）</text>
  <text class="lb" x="688" y="278">分类分支 cv3</text>
  <path class="ar" d="M120,158 C146,158 150,66 164,64"/>
  <path class="ar" d="M120,186 C146,186 150,274 164,274"/>
  <path class="ar" d="M294,64 H320"/><path class="ar" d="M450,64 H476"/>
  <path class="ar" d="M328,274 H348"/><path class="ar" d="M512,274 H532"/>
  <rect x="480" y="140" width="216" height="64" rx="8" fill="#cfeedd" stroke="#8fcdaa" stroke-width="1.4"/>
  <text class="ti" x="588" y="164" text-anchor="middle">拼接并展平</text>
  <text class="lb" x="588" y="186" text-anchor="middle">(B, 64+nc, H·W)</text>
  <path class="ar" d="M559,86 C559,116 574,128 588,136"/>
  <path class="ar" d="M606,252 C606,220 594,208 590,200"/>
  <text class="lb" x="8" y="328">三个尺度（80×80 / 40×40 / 20×20）各跑一遍这两条分支，最后沿最后一维拼接：</text>
  <text class="lb" x="8" y="350">输出 (B, 64+nc, 6400+1600+400) = (B, 144, 8400)　当 nc=80 时</text>
</svg>`,
  steps: [
    { t: "输入", d: "三个尺度的特征：P3 <b>[256,80,80]</b>、P4 <b>[512,40,40]</b>、P5 <b>[512,20,20]</b>（yolo11s 数值）。" },
    { t: "确定中间通道", d: "<code>c2 = max(16, ch[0]//4, reg_max*4) = max(16, 64, 64) = 64</code>（回归分支）；<code>c3 = max(ch[0], min(nc,100)) = max(256, 80) = 256</code>（分类分支）。<b>注意 c3 比 c2 大 4 倍。</b>" },
    { t: "回归分支走一遍", d: "以 P3 为例：Conv(256→64, 3×3) → Conv(64→64, 3×3) → Conv2d(64→64, 1×1)。输出 <b>[64, 80, 80]</b>，即每个位置 4 条边 × 16 个 DFL 桶。" },
    { t: "分类分支走一遍", d: "DWConv(256→256, 3×3) → Conv(256→256, 1×1) → DWConv(256→256,3×3) → Conv(256→256,1×1) → Conv2d(256→80, 1×1)。输出 <b>[80, 80, 80]</b>。" },
    { t: "拼成统一张量", d: "两个分支沿通道拼接 → <b>[144, 80, 80]</b>，再 flatten 后两维 → <b>[144, 6400]</b>。" },
    { t: "三个尺度合并", d: "6400 + 1600 + 400 = <b>8400</b>。最终输出 <b>(1, 144, 8400)</b>。这就是你在任何 YOLO11 代码里都能看到的那行形状。" },
  ],
  code: {
    title: "Detect 头（官方语义）",
    src: "ultralytics/nn/modules/head.py · class Detect",
    text: `class Detect(nn.Module):
    def __init__(self, nc=80, reg_max=16, ch=()):
        super().__init__()
        self.nc, self.nl, self.reg_max = nc, len(ch), reg_max
        self.no = nc + self.reg_max * 4            # !cm 每个预测点的输出长度
        c2 = max((16, ch[0] // 4, self.reg_max * 4))   # 回归分支中间通道
        c3 = max(ch[0], min(self.nc, 100))             # 分类分支中间通道

        # 回归分支：两条标准 3×3 CBS
        self.cv2 = nn.ModuleList(
            nn.Sequential(Conv(x, c2, 3), Conv(c2, c2, 3),
                          nn.Conv2d(c2, 4 * self.reg_max, 1)) for x in ch)

        # !cm 分类分支：DWConv(3×3) + Conv(1×1) 交替 —— YOLO11 的改动点
        self.cv3 = nn.ModuleList(
            nn.Sequential(
                nn.Sequential(DWConv(x, x, 3),  Conv(x, c3, 1)),   # 空间 → 通道
                nn.Sequential(DWConv(c3, c3, 3), Conv(c3, c3, 1)),
                nn.Conv2d(c3, self.nc, 1),                          # 输出类别
            ) for x in ch)

        self.dfl = DFL(self.reg_max)               # 把 16 桶积分成 1 个距离

    def forward(self, x):
        for i in range(self.nl):
            x[i] = torch.cat((self.cv2[i](x[i]), self.cv3[i](x[i])), 1)
        # 训练时返回三个尺度的 list；推理时转置并拼接成 (B, 144, 8400)
        ...`,
  },
  demo: "head",
  pitfalls: [
    "<b>c3 用的是 ch[0]，对所有尺度相同。</b>官方写 <code>c3 = max(ch[0], min(nc,100))</code>，其中 ch[0] 是 P3 的通道。所以三个尺度的分类分支中间通道都是 256。这是刻意设计（让 head 参数量可控），不是 bug。",
    "<b>输出形状 (1,144,8400) 依赖输入分辨率。</b>换成 768 输入，格子数变成 96²+48²+24² = 11520。所以部署时动态 shape 会带来额外复杂度，固定输入尺寸是常态。",
    "<b>训练和推理的输出不同。</b>训练时返回 list（三尺度分开，方便按尺度做标签分配）；推理时拼接并解码成框。看代码时别被这个分叉绕晕。",
  ],
},
{
  id: "dfl", title: "DFL 分布式边框回归", group: "E · 检测头", weight: 3, difficulty: "★★★",
  oneLine: "不直接预测「距离 = 3.7 像素」，而是预测「距离落在 0~15 每个整数桶的概率」，再求期望。",
  why: `直接回归一个连续距离值看起来简单，但有个隐患：边界模糊的目标（比如雾中的物体）应该有「我不确定」的表达能力，而单个数值无法表达不确定性。DFL（Distribution Focal Loss）把回归问题转成分类问题：让网络输出 16 个概率值（分别代表距离落在 0、1、…、15 这几个整数位置的概率），再对这 16 个概率做加权求和得到连续距离。这样一来：① 训练变成分类任务，更稳定（交叉熵比 L1/L2 对异常值更鲁棒）；② 网络能表达「分布散开」的不确定性；③ 距离被限制在 0~15 的有界范围内，不会训飞。`,
  structure: `<svg viewBox="0 0 800 300" class="fig">
  <defs><marker id="ae" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.5;fill:none;marker-end:url(#ae)}</style></defs>
  <text class="ti" x="10" y="20">① 网络输出 16 个 logits（每条边一组，共 4 组）</text>
  <g transform="translate(10,38)">
    <g fill="#cfe6f7" stroke="#93c2e6">
      <rect x="0" y="34" width="28" height="16"/><rect x="32" y="24" width="28" height="26"/>
      <rect x="64" y="10" width="28" height="40"/><rect x="96" y="0" width="28" height="50"/>
      <rect x="128" y="16" width="28" height="34"/><rect x="160" y="30" width="28" height="20"/>
      <rect x="192" y="40" width="28" height="10"/><rect x="224" y="44" width="28" height="6"/>
      <rect x="256" y="46" width="28" height="4"/><rect x="288" y="47" width="28" height="3"/>
      <rect x="320" y="47.5" width="28" height="2.5"/><rect x="352" y="48" width="28" height="2"/>
      <rect x="384" y="48" width="28" height="2"/><rect x="416" y="48" width="28" height="2"/>
      <rect x="448" y="48" width="28" height="2"/><rect x="480" y="48" width="28" height="2"/>
    </g>
    <text class="lb" x="0" y="76">桶 0</text>
    <text class="lb" x="466" y="76">桶 15</text>
  </g>
  <text class="lb" x="10" y="146">↑ 这张分布说明：距离最可能在 3~4 像素之间（峰在桶 3），但有一定不确定性（桶 2、4 也有概率）</text>
  <path class="ar" d="M600,92 V128"/>
  <text class="ti" x="616" y="102">softmax</text>
  <text class="ti" x="616" y="122">+ 期望</text>
  <g transform="translate(10,168)">
    <text class="ti" x="0" y="14">② 对 16 个桶做 softmax，再乘以 0,1,2,…,15 并求和</text>
    <text class="lb" x="0" y="42">d̂ = Σ pᵢ · i　　（i = 0..15）</text>
    <text class="lb" x="0" y="68">官方实现用了一个不可学习的 1×1 卷积，权重固定为 [0,1,2,…,15]：</text>
    <text class="lb" x="0" y="94">所以「求期望」这一步被写成了一个卷积层 —— 看到 DFL 里有个 conv 不要惊讶。</text>
  </g>
  <g transform="translate(470,166)">
    <rect x="0" y="0" width="320" height="96" rx="8" fill="#111820" stroke="#33404f"/>
    <text x="14" y="26" font-family="monospace" font-size="11.5" fill="#7fb8ff">self.conv = nn.Conv2d(16, 1, 1, bias=False)</text>
    <text x="14" y="46" font-family="monospace" font-size="11.5" fill="#7fb8ff">self.conv.weight.data[:] = arange(16)</text>
    <text x="14" y="66" font-family="monospace" font-size="11.5" fill="#ff8ad4">.requires_grad_(False)   # 不学习</text>
    <text x="14" y="86" font-family="monospace" font-size="11.5" fill="#8ee2b8">softmax 后这个卷积就是求期望</text>
  </g>
  <text class="lb" x="10" y="288">最终 d̂ 是连续值（例如 3.42），再通过 dist2bbox 转成真实坐标。reg_max=16 是官方默认，可调大到 32 但收益很小。</text>
</svg>`,
  steps: [
    { t: "回归分支输出", d: "P3 分支输出 <b>[64, 80, 80]</b>。64 = 4 条边 × 16 个桶。" },
    { t: "reshape 与转置", d: "<code>x.view(b, 4, 16, a)</code> 再 <code>transpose(2,1)</code> 变成 (b, 16, 4, a)，让 16 个桶落在 softmax 维上。" },
    { t: "softmax", d: "沿 16 桶维度做 softmax → 每条边得到一个 16 维概率分布，和为 1。" },
    { t: "求期望", d: "用固定权重 [0,1,…,15] 的 1×1 卷积做加权求和 → <b>[4, a]</b>，即 4 条边的连续距离。" },
    { t: "转成坐标", d: "<code>dist2bbox(distance, anchor_points)</code>：以特征图格子中心为锚点，左减、上减、右加、下加，得到 xyxy。<b>这就是 anchor-free 的实现方式。</b>" },
    { t: "为什么还要 DFL loss", d: "除了回归距离值，DFL 还额外监督「分布形状」：真值距离 3.7 时，会鼓励桶 3 和桶 4 的概率都高（按小数部分加权）。这让分布在训练中更平滑，收敛更快。" },
  ],
  code: {
    title: "DFL：用固定卷积实现「求期望」",
    src: "ultralytics/nn/modules/block.py · class DFL",
    text: `class DFL(nn.Module):
    """Distribution Focal Loss 的积分层

    把 (B, 4*reg_max, A) 的分布解码成 (B, 4, A) 的期望距离。
    权重固定为 0..reg_max-1 且不可学习 —— 这不是「网络层」，
    而是把 softmax 分布积分成标量的确定性运算。
    """
    def __init__(self, c1=16):
        super().__init__()
        self.conv = nn.Conv2d(c1, 1, 1, bias=False).requires_grad_(False)
        x = torch.arange(c1, dtype=torch.float)
        self.conv.weight.data[:] = nn.Parameter(x.view(1, c1, 1, 1))
        self.c1 = c1

    def forward(self, x):
        b, _, a = x.shape
        # view → 4 条边分开；transpose → 16 桶放到 softmax 维；conv → 加权求和
        return self.conv(
            x.view(b, 4, self.c1, a).transpose(2, 1).softmax(1)
        ).view(b, 4, a)`,
  },
  demo: "dfl",
  pitfalls: [
    "<b>输出通道数变了。</b>不用 DFL 时回归分支只需要 4 个通道；用 DFL 需要 4×16 = 64。这就是「输出从 84 变成 144」的原因（80 类时）。改网络时别忘了同步修改解码逻辑。",
    "<b>reg_max 不能随便调大。</b>调到 32 意味着输出通道 4×32 = 128，头部参数翻倍，而 DFL 论文里 reg_max=16 已接近饱和。收益远小于代价。",
    "<b>它同时是「损失」也是「解码器」。</b>DFL 有两层含义：① 训练时的 DFL loss（监督分布形状）；② 推理时的积分层（把分布变成标量）。看论文时注意区分。",
  ],
},
{
  id: "anchorfree", title: "锚框与 Anchor-free 的转变", group: "E · 检测头", weight: 2, difficulty: "★★",
  oneLine: "从「预设一堆候选框并回归偏移量」变成「每个点直接回归到框四条边的距离」。",
  why: `YOLOv2~v5 属于 anchor-based：先在训练集上跑 k-means 聚类出若干典型宽高（锚框），然后让每个格子预测「相对锚框的偏移」。好处是网络只需学小的修正量，容易收敛。坏处是：① 锚框是超参，换数据集必须重新聚类；② 目标形状与锚框差太多时学不动；③ 正样本匹配依赖 IoU 阈值，比较粗糙。Anchor-free 取消了锚框假设：每个特征点直接预测「到框左/上/右/下边的距离」。这让模型与数据集解耦，也简化了正样本分配。`,
  structure: `<svg viewBox="0 0 820 320" class="fig">
  <defs><marker id="af" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#e08a2e"/></marker>
  <style>.lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}
  .ar{stroke:#e08a2e;stroke-width:2;fill:none;marker-end:url(#af)}</style></defs>
  <text class="ti" x="10" y="20">Anchor-based（v5）：每个格子预置 3 个锚框，再回归偏移</text>
  <g transform="translate(10,34)">
    <rect x="0" y="0" width="210" height="156" fill="#f8fafc" stroke="#cbd5e1"/>
    <g stroke="#e2e8f0" fill="none"><path d="M52,0 V156 M105,0 V156 M157,0 V156 M0,52 H210 M0,104 H210"/></g>
    <g fill="#f5cfe0" stroke="#dd93b7" stroke-dasharray="4 3">
      <rect x="26" y="70" width="50" height="26"/><rect x="80" y="66" width="60" height="34"/><rect x="30" y="22" width="42" height="60"/>
      <rect x="132" y="70" width="50" height="26"/><rect x="184" y="66" width="60" height="34"/><rect x="136" y="22" width="42" height="60"/>
    </g>
    <rect x="62" y="54" width="84" height="48" fill="none" stroke="#16a34a" stroke-width="2.5"/>
    <text class="lb" x="105" y="146" text-anchor="middle" fill="#5b6b80">绿 = 真值框　粉虚线 = 预置锚框</text>
  </g>
  <text class="lb" x="10" y="212">需要：k-means 聚类锚框尺寸 → 换数据集要重聚类</text>
  <text class="lb" x="10" y="234">输出通道 = 3 锚 × (5 + 80 类) = 255（COCO）</text>
  <text class="ti" x="256" y="20">Anchor-free（v8 / v11）：以格子中心为锚点，回归到四边的距离</text>
  <g transform="translate(256,34)">
    <rect x="0" y="0" width="210" height="156" fill="#f8fafc" stroke="#cbd5e1"/>
    <g stroke="#e2e8f0" fill="none"><path d="M52,0 V156 M105,0 V156 M157,0 V156 M0,52 H210 M0,104 H210"/></g>
    <rect x="62" y="54" width="84" height="48" fill="none" stroke="#16a34a" stroke-width="2.5"/>
    <circle cx="105" cy="78" r="5" fill="#e08a2e"/>
    <path class="ar" d="M105,78 H62"/><path class="ar" d="M105,78 V54"/>
    <path class="ar" d="M105,78 H146"/><path class="ar" d="M105,78 V102"/>
    <text class="lb" x="48" y="74" text-anchor="end">l</text><text class="lb" x="110" y="52">t</text>
    <text class="lb" x="150" y="74">r</text><text class="lb" x="110" y="116">b</text>
    <text class="lb" x="105" y="146" text-anchor="middle" fill="#5b6b80">橙点 = 格子中心（锚点）</text>
  </g>
  <text class="lb" x="256" y="212">需要：无。每个格子中心就是一个锚点</text>
  <text class="lb" x="256" y="234">输出通道 = 4×16(DFL) + 80 类 = 144（COCO）</text>
  <g transform="translate(520,34)">
    <rect x="0" y="0" width="290" height="156" rx="8" fill="#e3f6f3" stroke="#8fd8cf"/>
    <text class="ti" x="145" y="26" text-anchor="middle">坐标换算公式</text>
    <text class="lb" x="16" y="56">x1 = ax − l　　y1 = ay − t</text>
    <text class="lb" x="16" y="80">x2 = ax + r　　y2 = ay + b</text>
    <text class="lb" x="16" y="108">(ax, ay) 是格子中心映射回原图的坐标</text>
    <text class="lb" x="16" y="128">= stride × 格子索引 + 0.5×stride</text>
  </g>
  <text class="lb" x="10" y="286">通道从 255 降到 144：头部参数大幅下降，解码逻辑也更简单。这是 anchor-free 最直接的工程收益。</text>
</svg>`,
  steps: [
    { t: "特征图上的格子", d: "P3 是 80×80，意味着原图 640×640 被划成 80×80 个 8×8 像素的格子。每个格子的中心就是一个「锚点」。" },
    { t: "锚点坐标", d: "第 (i,j) 个格子的中心在原图上是 <code>(8×i + 4, 8×j + 4)</code>（stride=8，+0.5 格子）。" },
    { t: "四个距离", d: "网络预测 l、t、r、b 四个距离（经 DFL 得到连续值），表示框的四条边离锚点多远。" },
    { t: "还原成框", d: "<code>x1 = ax − l，y1 = ay − t，x2 = ax + r，y2 = ay + b</code>。得到真实坐标的框。" },
    { t: "哪个点负责哪个目标", d: "这是标签分配的任务（见 TAL 小节）。anchor-free 下正样本不再依赖锚框 IoU，而是靠「预测框与真值框的对齐度」动态选择。" },
    { t: "为什么输出少了 111 个通道", d: "3 锚 × 85 = 255 → 144。通道减少意味着头部参数大幅下降，解码更简单。<b>这是 anchor-free 最直接的工程收益。</b>" },
  ],
  code: {
    title: "距离 → 坐标：两行核心代码",
    src: "ultralytics/utils/tal.py · dist2bbox / bbox2dist",
    text: `def dist2bbox(distance, anchor_points, xywh=False, dim=-1):
    """把「到四边的距离」还原成真实框坐标。

    distance: (B, 4, A) —— 顺序是 [left, top, right, bottom]
    anchor_points: (A, 2) —— 每个格子的中心坐标（已映射回原图）
    """
    lt, rb = distance.chunk(2, dim)              # 拆成左上、右下两组
    x1y1 = anchor_points - lt                    # 左上 = 锚点 - 距离
    x2y2 = anchor_points + rb                    # 右下 = 锚点 + 距离
    return torch.cat((x1y1, x2y2), dim)

def bbox2dist(anchor_points, bbox, reg_max):
    """反向：真值框 → 距离，用于计算损失（注意要 clamp 到 reg_max-1）"""
    x1y1, x2y2 = bbox.chunk(2, -1)
    return torch.cat((anchor_points - x1y1, x2y2 - anchor_points), -1).clamp_(0, reg_max - 0.01)`,
  },
  demo: "anchorfree",
  pitfalls: [
    "<b>anchor-free 不等于「不需要正负样本概念」。</b>它只是取消了预置锚框，正/负样本的划分依然存在，且更依赖分配策略（TAL）。「anchor-free 更简单」只在网络结构层面成立。",
    "<b>距离被限制在 reg_max 内。</b>如果某个目标的框特别大（离锚点超过 15 个格子的距离），DFL 就表达不了。这正是大目标必须交给 P5（stride 32）的原因——<b>尺度分配与 DFL 的量程是绑定的</b>。",
    "<b>clamp(0, reg_max-0.01) 不能省。</b>真值距离刚好等于 reg_max 时会在桶边界上产生无效标签导致 loss 异常。这个 0.01 是刻意留的。",
  ],
},
{
  id: "tal", title: "★ TAL 标签分配（Task-Aligned Assigner）", group: "F · 训练机制", weight: 3, difficulty: "★★★",
  oneLine: "训练时决定「8400 个预测点里，哪些点该为这个真值框负责」——检测里最被低估、对结果影响最大的一环。",
  why: `一张图有 5 个真值框，但网络输出了 8400 个预测点。哪些点算正样本（要学这个框）、哪些算负样本（要学背景）？这个决定直接决定了模型学到什么。早期做法是 IoU 阈值匹配（>0.5 算正），简单但粗糙：一个框得准但分类错的点会被当成好样本。TAL 的核心思想是「让分类和定位互相成就」：用一个对齐度指标 t = s^α × u^β 同时衡量「这个点分类得分 s 有多高」和「它预测的框与真值 IoU u 有多大」，然后取 top-k 作为正样本。<b>框得准的点被鼓励多学分类，分类准的点被鼓励多学定位。</b>`,
  structure: `<svg viewBox="0 0 840 360" class="fig">
  <defs><marker id="ag" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.5;fill:none;marker-end:url(#ag)}</style></defs>
  <text class="ti" x="10" y="20">① 计算对齐度 t = s^α × u^β（s=分类得分，u=预测框与真值框 IoU）</text>
  <g transform="translate(10,36)">
    <rect x="0" y="0" width="240" height="196" fill="#f8fafc" stroke="#cbd5e1"/>
    <g stroke="#eef2f7" fill="none"><path d="M48,0 V196 M96,0 V196 M144,0 V196 M192,0 V196 M0,49 H240 M0,98 H240 M0,147 H240"/></g>
    <rect x="62" y="54" width="116" height="88" fill="none" stroke="#16a34a" stroke-width="2.5"/>
    <text class="lb" x="120" y="42" text-anchor="middle" fill="#15803d">真值框</text>
    <g>
      <rect x="54" y="64" width="20" height="20" fill="rgba(15,157,143,.88)"/><text class="lb" x="64" y="79" text-anchor="middle" fill="#fff" font-size="10">.9</text>
      <rect x="80" y="64" width="20" height="20" fill="rgba(15,157,143,.68)"/><text class="lb" x="90" y="79" text-anchor="middle" fill="#fff" font-size="10">.7</text>
      <rect x="106" y="64" width="20" height="20" fill="rgba(15,157,143,.46)"/><text class="lb" x="116" y="79" text-anchor="middle" fill="#fff" font-size="10">.5</text>
      <rect x="132" y="64" width="20" height="20" fill="rgba(15,157,143,.24)"/><text class="lb" x="142" y="79" text-anchor="middle" fill="#3d4a5c" font-size="10">.2</text>
      <rect x="67" y="102" width="20" height="20" fill="rgba(15,157,143,.62)"/><text class="lb" x="77" y="117" text-anchor="middle" fill="#fff" font-size="10">.6</text>
      <rect x="106" y="102" width="20" height="20" fill="rgba(15,157,143,.32)"/><text class="lb" x="116" y="117" text-anchor="middle" fill="#3d4a5c" font-size="10">.3</text>
    </g>
    <text class="lb" x="120" y="170" text-anchor="middle" fill="#5b6b80">颜色深浅 = 对齐度 t 的大小</text>
    <text class="lb" x="120" y="188" text-anchor="middle" fill="#5b6b80">（只统计中心落在真值框内的点）</text>
  </g>
  <text class="ti" x="280" y="20">② 取 top-k 个点作为正样本（k 通常为 10）</text>
  <text class="lb" x="280" y="50">· 中心落进真值框内的点 = 候选</text>
  <text class="lb" x="280" y="72">· 按 t 降序排，取前 k 个</text>
  <text class="lb" x="280" y="94">· 这些点共同负责这一个框</text>
  <text class="lb" x="280" y="116">· 其余点归为负样本（背景）</text>
  <text class="lb" x="280" y="138">· 一个点最多负责一个框（去重规则）</text>
  <text class="ti" x="280" y="178">③ 对齐度的定义</text>
  <rect x="280" y="190" width="252" height="66" rx="8" fill="#e3f6f3" stroke="#8fd8cf"/>
  <text class="lb" x="296" y="214">align_metric = s^α × u^β</text>
  <text class="lb" x="296" y="238">官方 α = 0.5，β = 6.0（β 远大于 α）</text>
  <text class="ti" x="570" y="20">④ 掩码：只有正样本参与 box loss</text>
  <g transform="translate(570,36)">
    <rect x="0" y="0" width="262" height="196" rx="8" fill="#fdf1c9" stroke="#e6cf7a"/>
    <text class="lb" x="14" y="28">target_scores（分类软标签）</text>
    <text class="lb" x="14" y="50">· 正样本位置 = 该点对齐度归一化值</text>
    <text class="lb" x="14" y="72">· 负样本位置 = 0</text>
    <text class="lb" x="14" y="104">fg_mask（前景掩码）</text>
    <text class="lb" x="14" y="126">· 正样本 = True</text>
    <text class="lb" x="14" y="148">· 只有 True 的位置算 box / dfl loss</text>
    <text class="lb" x="14" y="176">这就是 TAL 比「IoU 阈值」聪明的地方</text>
  </g>
  <path class="ar" d="M266,130 H276"/>
  <path class="ar" d="M548,196 H566"/>
  <text class="lb" x="10" y="266">β=6 远大于 α=0.5：说明 <tspan font-weight="700">IoU 的权重被刻意放大</tspan> —— 定位准的点优先当正样本，这就是「任务对齐」的字面含义。</text>
  <text class="lb" x="10" y="288">效果：同一个目标被 k 个点共同负责 → 梯度更平滑，训练初期更稳。</text>
  <text class="lb" x="10" y="310">副作用：k 太大时小目标会被过多点覆盖（可能学到「一物多框」）；k 太小则正样本不足。</text>
  <text class="lb" x="10" y="332">k=10 是官方在 COCO 上调出的平衡点；换数据集时值得重扫（8 / 10 / 13）。</text>
</svg>`,
  steps: [
    { t: "输入", d: "预测张量 <b>(B, 144, 8400)</b> 拆成 <code>pred_scores</code>(B,80,8400) 与 <code>pred_bboxes</code>(B,4,8400)；真值 <code>gt_bboxes</code>、<code>gt_labels</code>。" },
    { t: "第一步：粗筛候选", d: "只保留<b>中心落在真值框内部</b>的预测点（<code>select_candidates_in_gts</code>）。8400 个点里通常只有几十个进入候选，大幅减少后续计算。" },
    { t: "第二步：算 IoU", d: "对候选点与真值框算 CIoU 矩阵，形状 (B, n_max_boxes, num_candidates)。" },
    { t: "第三步：算对齐度", d: "<code>align_metric = s^0.5 × u^6.0</code>，其中 s 是<b>该点对真值类别的分类得分</b>（不是最大类得分，这个细节容易写错）。" },
    { t: "第四步：top-k 选择", d: "对每个真值框，按对齐度取前 k=10 个点作为正样本；同时用「一个点最多负责一个框」的规则去重。" },
    { t: "第五步：生成监督信号", d: "得到 <code>target_labels</code>、<code>target_bboxes</code>、<code>target_scores</code>（分类软标签 = 归一化后的对齐度）、<code>fg_mask</code>。这三个张量直接喂给损失函数。" },
  ],
  code: {
    title: "TAL 的核心三步",
    src: "ultralytics/utils/tal.py · class TaskAlignedAssigner",
    text: `class TaskAlignedAssigner(nn.Module):
    """任务对齐分配器：同时考虑分类得分与定位质量"""
    def __init__(self, topk=13, num_classes=80, alpha=1.0, beta=6.0, eps=1e-9):
        super().__init__()
        self.topk, self.alpha, self.beta = topk, alpha, beta

    def forward(self, pd_scores, pd_bboxes, anc_points, gt_labels, gt_bboxes, mask_gt):
        # ① 粗筛：只保留中心落在真值框内的点
        mask_in_gts = self.select_candidates_in_gts(anc_points, gt_bboxes)
        # ② 算对齐度（分类得分 × IoU）
        align_metric, overlaps = self.get_box_metrics(
            pd_scores, pd_bboxes, gt_labels, gt_bboxes, mask_in_gts * mask_gt)
        # ③ top-k 选择正样本（外加「一点一框」去重）
        mask_pos, align_metric, overlaps = self.select_topk_candidates(
            align_metric, topk_mask=mask_gt.expand(-1, -1, self.topk).bool())
        target_gt_idx, fg_mask, mask_pos = self.select_highest_overlaps(
            mask_pos, overlaps, self.n_max_boxes)
        # ④ 生成监督目标
        target_labels, target_bboxes, target_scores = self.get_targets(
            gt_labels, gt_bboxes, target_gt_idx, fg_mask)
        # 分类软标签：对齐度归一化到 [0,1]
        target_scores = target_scores * align_metric.max(2, keepdim=True)[0].clamp_(0, 1) / (
            align_metric.max(2, keepdim=True)[0] + self.eps)
        return target_labels, target_bboxes, target_scores, fg_mask.bool(), target_gt_idx

    @staticmethod
    def get_box_metrics(pd_scores, pd_bboxes, gt_labels, gt_bboxes, mask_in_gts):
        """!cm 核心：align = score^alpha * iou^beta"""
        na = pd_bboxes.shape[-2]
        # 取出每个候选点对「真值类别」的预测得分（不是最大类！）
        bbox_scores = torch.gather(pd_scores, 1,
                                   gt_labels.unsqueeze(-1).expand(-1, -1, na))
        overlaps = CIoU(gt_bboxes, pd_bboxes)                     # 预测框与真值的 CIoU
        align_metric = bbox_scores.pow(0.5) * overlaps.pow(6.0)   # !cm α=0.5, β=6
        return align_metric, overlaps`,
  },
  demo: "tal",
  pitfalls: [
    "<b>它是「训练时」的机制，推理时完全不存在。</b>你在推理代码里找不到 TAL——它只负责生成训练信号。理解这一点，才能明白为什么「改标签分配」不会增加推理成本（这也是它成为热门改进方向的原因）。",
    "<b>α=0.5、β=6 的悬殊比例是刻意的。</b>β 远大于 α 意味着定位质量主导正样本选择。看着反直觉（不是应该先分类对吗？），但实测更有效：先找到框得准的点，再让它学分类。",
    "<b>top-k 的 k 在不同版本里不同。</b>源码里 <code>topk=13</code>，但配置里常用 10。做改进实验时要显式固定这个值并在论文里写清楚。",
    "<b>它继承了 TOOD 的思想。</b>引用时应提 TOOD（arXiv:2108.07755），否则容易被指「未引用源头工作」。",
  ],
},
{
  id: "loss", title: "三项损失：box / cls / dfl", group: "F · 训练机制", weight: 2, difficulty: "★★",
  oneLine: "模型到底在优化什么：框要重合且形状像、类别要判对、距离分布要贴合——三项加权求和。",
  why: `检测任务要同时输出「框」和「类别」，是两个不同性质的子问题，用一个损失函数很难兼顾。所以拆成三项：box loss 管位置与形状（用 CIoU，同时考虑重叠面积、中心距离、长宽比）；cls loss 管类别（用 BCE，每个类别独立判断是/不是，天然支持多标签）；dfl loss 管距离分布的形状（用交叉熵）。三项各自有独立的权重系数，可以按任务需要调整侧重。`,
  structure: `<svg viewBox="0 0 820 270" class="fig">
  <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.6;fill:none;marker-end:url(#ah)}</style></defs>
  <rect x="10" y="40" width="180" height="170" rx="10" fill="#fff8e6" stroke="#f0d799"/>
  <text class="ti" x="100" y="64" text-anchor="middle">box_loss</text>
  <text class="lb" x="26" y="90">权重 7.5（最大）</text>
  <text class="lb" x="26" y="112">CIoU + DFL 组合</text>
  <text class="lb" x="26" y="134">管位置与形状</text>
  <text class="lb" x="26" y="156">只在正样本上计算</text>
  <text class="lb" x="26" y="182">权重最高，因为定位</text>
  <text class="lb" x="26" y="200">是检测的硬指标</text>
  <rect x="210" y="40" width="180" height="170" rx="10" fill="#eef4ff" stroke="#c3d4f0"/>
  <text class="ti" x="300" y="64" text-anchor="middle">cls_loss</text>
  <text class="lb" x="226" y="90">权重 0.5（最小）</text>
  <text class="lb" x="226" y="112">BCE（二元交叉熵）</text>
  <text class="lb" x="226" y="134">管类别判断</text>
  <text class="lb" x="226" y="156">正负样本都算</text>
  <text class="lb" x="226" y="182">权重低但覆盖样本多，</text>
  <text class="lb" x="226" y="200">实际梯度贡献并不小</text>
  <rect x="410" y="40" width="180" height="170" rx="10" fill="#eefaf3" stroke="#9dd7b8"/>
  <text class="ti" x="500" y="64" text-anchor="middle">dfl_loss</text>
  <text class="lb" x="426" y="90">权重 1.5</text>
  <text class="lb" x="426" y="112">交叉熵（16 个桶）</text>
  <text class="lb" x="426" y="134">管距离分布形状</text>
  <text class="lb" x="426" y="156">只在正样本上计算</text>
  <text class="lb" x="426" y="182">让分布「尖」在真值附近，</text>
  <text class="lb" x="426" y="200">收敛更稳更快</text>
  <rect x="610" y="76" width="200" height="98" rx="10" fill="#cfeedd" stroke="#8fcdaa"/>
  <text class="ti" x="710" y="106" text-anchor="middle">总损失</text>
  <text class="lb" x="626" y="132">L = 7.5·box + 0.5·cls + 1.5·dfl</text>
  <text class="lb" x="626" y="156">（官方默认，可在 cfg 里改）</text>
  <path class="ar" d="M190,125 H206"/><path class="ar" d="M390,125 H406"/><path class="ar" d="M590,125 H606"/>
  <text class="lb" x="10" y="26">三个子损失各自归一化后加权求和；训练日志里分别打印，便于定位问题</text>
  <text class="lb" x="10" y="244">读日志技巧：box 高 = 定位差（小目标多 / 标注不贴合）；cls 高 = 类别混淆（类间相似 / 标签错）；dfl 高 = 距离分布学不好（尺度跨度过大）</text>
</svg>`,
  steps: [
    { t: "准备监督信号", d: "从 TAL 得到 <code>target_labels</code>、<code>target_bboxes</code>、<code>target_scores</code>、<code>fg_mask</code>。只有 <code>fg_mask=True</code> 的位置参与 box 与 dfl 损失。" },
    { t: "box loss（CIoU）", d: "<code>iou = CIoU(pred_bboxes, target_bboxes)</code>，然后 <code>loss = (1 - iou).sum() / target_scores_sum</code>。分母用分类得分之和而非样本数——<b>这样高质量样本的权重更大</b>。" },
    { t: "dfl loss", d: "把真值距离转成两个相邻桶的软标签，对预测分布做交叉熵，再取 topk 的平均（只算每个目标最靠前的若干候选，抑制离群点）。" },
    { t: "cls loss（BCE）", d: "<code>BCE(pred_scores, target_scores, reduction='none').sum() / target_scores_sum</code>。注意是 <b>sum 而非 mean</b>，再除以 <code>target_scores_sum</code> 归一化——这保证不同图片的目标数不影响损失尺度。" },
    { t: "加权求和", d: "<code>loss = 7.5·box + 0.5·cls + 1.5·dfl</code>（官方 detection 默认值）。" },
    { t: "反向传播", d: "一次 backward 同时更新主干、颈部、头部——三项损失的梯度在共享的卷积层里叠加。" },
  ],
  code: {
    title: "三项损失的官方实现骨架",
    src: "ultralytics/utils/loss.py · class v8DetectionLoss",
    text: `class v8DetectionLoss:
    """YOLOv8 起（含 YOLO11）使用的检测损失。三项加权求和。"""
    def __init__(self, model):
        h = model.args
        self.box, self.cls, self.dfl = h.box, h.cls, h.dfl      # 默认 7.5 / 0.5 / 1.5
        self.bce = nn.BCEWithLogitsLoss(reduction="none")       # !cm 注意 none
        self.assigner = TaskAlignedAssigner(topk=10, ...)       # 标签分配

    def __call__(self, preds, batch):
        loss = torch.zeros(3, device=self.device)               # [box, cls, dfl]
        feats = preds[1] if isinstance(preds, tuple) else preds
        pred_distri, pred_scores = torch.cat([xi.view(bs, self.no, -1)
            for xi in feats], 2).split((self.reg_max * 4, self.nc), 1)

        # ---- 标签分配 ----
        targets = torch.cat((batch["batch_idx"].view(-1, 1),
                             batch["cls"].view(-1, 1), batch["bboxes"]), 1)
        gt_labels, gt_bboxes = targets.split((1, 4), 2)
        mask_gt = gt_bboxes.sum(2, keepdim=True).gt_(0.0)
        _, target_bboxes, target_scores, fg_mask, _ = self.assigner(
            pred_scores.detach().sigmoid(),   # !cm 用 sigmoid 后的得分算对齐度，且 detach
            (pred_bboxes.detach() * stride_tensor).type(gt_bboxes.dtype),
            anchor_points * stride_tensor, gt_labels, gt_bboxes, mask_gt)
        target_scores_sum = max(target_scores.sum(), 1)          # 归一化因子

        # ---- cls loss ----
        loss[1] = self.bce(pred_scores,
                           target_scores.to(pred_scores.dtype)).sum() / target_scores_sum

        # ---- box + dfl loss（只在正样本上算）----
        if fg_mask.sum():
            target_bboxes /= stride_tensor
            loss[0], loss[2] = self.bbox_loss(
                pred_distri, pred_bboxes, anchor_points, target_bboxes,
                target_scores, target_scores_sum, fg_mask)
        loss[0] *= self.hyp.box     # 7.5
        loss[1] *= self.hyp.cls     # 0.5
        loss[2] *= self.hyp.dfl     # 1.5
        return loss.sum() * bs, loss.detach()
        #     ↑ 总损失            ↑ 返回三项分别的值供日志打印`,
  },
  demo: null,
  pitfalls: [
    "<b>cls loss 用 sum 不用 mean。</b>如果用 mean，目标数多的图损失会被稀释，模型偏向学「目标少的场景」。除以 <code>target_scores_sum</code> 才是正确归一化。<b>这是很多复现踩坑的地方。</b>",
    "<b>算对齐度时要用 detach()。</b>否则 TAL 的梯度会回传到「对齐度计算」这条路径上，导致标签分配随训练漂移、不稳定。",
    "<b>权重不该一上来就调。</b>三项权重是官方在 COCO 上扫出来的平衡点。你的数据集若目标特别小，可以适度提高 box 权重（7.5→10）；但改动超过 ±30% 通常会让另外两项失衡，需要同时看曲线。",
  ],
},

/* ==================== G. 训练与工程 ==================== */
{
  id: "nms", title: "NMS 非极大值抑制", group: "G · 训练与工程", weight: 3, difficulty: "★★",
  oneLine: "推理后处理：同一目标常被预测出多个重叠框，NMS 负责「留最好的、删重复的」。",
  why: `TAL 让一个目标由 k=10 个点共同负责，训练时这是好事（梯度更平滑），但推理时这 10 个点会各自输出一个框——同一个物体会出现十个几乎重合的框。NMS 的任务就是把这些重复框合并成一个。算法很简单：按置信度从高到低排序，取最高的留下，然后删掉所有与它 IoU 超过阈值的框，重复直到没有框为止。<b>YOLO11 依然需要 NMS</b>（YOLOv10 和 YOLO26 才是端到端免 NMS）。`,
  structure: `<svg viewBox="0 0 840 360" class="fig">
  <style>.lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}</style>
  <text class="ti" x="10" y="20">输入：同一目标产生 5 个重叠框（已标注置信度）</text>
  <g transform="translate(20,36)">
    <rect x="0" y="0" width="220" height="186" fill="#f8fafc" stroke="#cbd5e1"/>
    <g fill="none" stroke-width="2">
      <rect x="44" y="46" width="106" height="94" stroke="#16a34a"/>
      <rect x="50" y="52" width="106" height="94" stroke="#e08a2e"/>
      <rect x="38" y="50" width="106" height="94" stroke="#e08a2e"/>
      <rect x="48" y="42" width="106" height="94" stroke="#e08a2e"/>
      <rect x="56" y="54" width="100" height="90" stroke="#94a3b8"/>
    </g>
    <text class="lb" x="164" y="68" fill="#15803d">0.91</text>
    <text class="lb" x="170" y="90" fill="#b45309">0.84</text>
    <text class="lb" x="158" y="112" fill="#b45309">0.79</text>
    <text class="lb" x="168" y="134" fill="#b45309">0.72</text>
    <text class="lb" x="174" y="156" fill="#64748b">0.55</text>
  </g>
  <text class="ti" x="272" y="20">算法流程（贪心）</text>
  <text class="lb" x="272" y="48">① 按置信度降序排序 → 全部放进待处理列表</text>
  <text class="lb" x="272" y="70">② 取出第一个（0.91），加入「保留」集合</text>
  <text class="lb" x="272" y="92">③ 计算它与剩下所有框的 IoU</text>
  <text class="lb" x="272" y="114">④ 删掉 IoU &gt; 阈值的（认为是同一目标）</text>
  <text class="lb" x="272" y="136">⑤ 重复 ②~④，直到列表为空</text>
  <text class="lb" x="272" y="174" fill="#b45309">iou 阈值怎么调：</text>
  <text class="lb" x="272" y="196">· 调低（0.5）→ 删得更狠 → 密集场景容易漏检</text>
  <text class="lb" x="272" y="218">· 调高（0.8）→ 删得少 → 同一目标残留多框</text>
  <text class="lb" x="272" y="240">· 默认 0.7；密集小目标建议 0.5~0.6</text>
  <text class="ti" x="620" y="20">输出</text>
  <g transform="translate(620,36)">
    <rect x="0" y="0" width="200" height="186" fill="#f8fafc" stroke="#cbd5e1"/>
    <rect x="46" y="48" width="106" height="94" fill="none" stroke="#16a34a" stroke-width="3"/>
    <text class="lb" x="162" y="70" fill="#15803d">0.91 ✓</text>
    <text class="lb" x="46" y="170" fill="#5b6b80">同一目标只剩一个框</text>
  </g>
  <text class="lb" x="20" y="264">完整推理链路：sigmoid → DFL 解码 → 置信度过滤(conf) → NMS(iou) → top-k(max_det=300)</text>
  <text class="lb" x="20" y="290">两个阈值的位置别混淆：conf 决定「多少分以上才考虑」，iou 决定「多重叠才算重复」。</text>
  <text class="lb" x="20" y="316">业务调参：安防宁误报不漏报 → conf 降到 0.2；盘点宁可少报 → conf 提到 0.5。</text>
  <text class="lb" x="20" y="342">YOLO11 需要 NMS；YOLOv10 / YOLO26 才是端到端免 NMS。这一点常被写错。</text>
</svg>`,
  steps: [
    { t: "输入", d: "解码后的所有框，COCO 上最多 8400 个，每个带 (x1,y1,x2,y2,score,cls)。" },
    { t: "先按 conf 过滤", d: "丢弃 <code>score &lt; conf_thres</code>（默认 0.25）的框。<b>这一步通常能砍掉 95% 以上的框</b>，让 NMS 快很多。" },
    { t: "按类别分组", d: "YOLO 默认对每个类别独立做 NMS（<code>agnostic_nms=False</code>）。这样「人」和「自行车」重叠时不会互相抑制。" },
    { t: "NMS 主体", d: "排序 → 取最高 → 算 IoU → 删重叠 → 循环。注意算的是<b>框之间的 IoU</b>，在同一类别内比较。" },
    { t: "截断", d: "保留最多 <code>max_det=300</code> 个框（可按需调大，密集场景重要）。" },
    { t: "耗时占比", d: "在 8400 个框、conf=0.25 的设置下，NMS 通常占端到端延迟的 <b>3%~10%</b>。密集场景（几百个目标）会显著上升，这时它是优化重点。" },
  ],
  code: {
    title: "两个 NMS 实现：一个生产用、一个理解用",
    src: "自写实现 · 便于理解与部署",
    text: `import cv2
import numpy as np

def nms_opencv(boxes_xywh, scores, iou_thres=0.7):
    """生产用它：OpenCV 是编译过的 C++ 实现，比 Python 循环快得多"""
    idx = cv2.dnn.NMSBoxes(
        bboxes=boxes_xywh.tolist(),
        scores=scores.tolist(),
        score_threshold=0.25,      # 置信度阈值
        nms_threshold=iou_thres,   # IoU 阈值
        top_k=300,                 # 最多保留数
    )
    return np.array(idx).flatten()


def nms_numpy(boxes, scores, iou_thres=0.5):
    """理解算法用它：纯 numpy，逻辑一目了然"""
    order = scores.argsort()[::-1]     # 按分数降序
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)                  # 保留当前最高分
        if order.size == 1:
            break
        rest = order[1:]
        xx1 = np.maximum(boxes[i, 0], boxes[rest, 0])
        yy1 = np.maximum(boxes[i, 1], boxes[rest, 1])
        xx2 = np.minimum(boxes[i, 2], boxes[rest, 2])
        yy2 = np.minimum(boxes[i, 3], boxes[rest, 3])
        inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        area_i = (boxes[i, 2] - boxes[i, 0]) * (boxes[i, 3] - boxes[i, 1])
        area_r = (boxes[rest, 2] - boxes[rest, 0]) * (boxes[rest, 3] - boxes[rest, 1])
        iou = inter / (area_i + area_r - inter + 1e-9)
        order = rest[iou <= iou_thres]   # 只保留不重叠的继续处理
    return keep`,
  },
  demo: "nms",
  pitfalls: [
    "<b>NMS 不可微，所以它只在推理时存在。</b>训练时没有 NMS，这也解释了为什么训练指标（mAP）和实际观感有时不一致——mAP 是在 NMS 之后算的，但网络本身不知道 NMS 的存在。",
    "<b>密集场景是 NMS 的死穴。</b>两个真实目标高度重叠时（比如并排的两个人），NMS 会把其中一个删掉。这是「漏检」的常见结构性原因，也是 Soft-NMS、端到端检测器（DETR/YOLOv10）想解决的问题。",
    "<b>conf 与 iou 要联合调。</b>只降 conf 会带来大量重复框再由 NMS 删；只降 iou 会误删真实目标。经验做法：先固定 iou=0.7 调 conf 到召回满足业务，再微调 iou 控制重复框。",
    "<b>agnostic_nms 慎用。</b>它跨类别抑制，能解决「同一物体被预测成多个类」的问题，但也会误删真正重叠的不同类目标（如人骑车）。",
  ],
},
{
  id: "map", title: "mAP 指标：AP / mAP50 / mAP50-95", group: "G · 训练与工程", weight: 3, difficulty: "★★",
  oneLine: "mAP 是「以召回为横轴、精确率为纵轴的曲线下面积」对所有类别取平均——论文里最该看懂的数字。",
  why: `为什么不能只看「准确率」？因为检测有个阈值问题：把置信度阈值调低，什么都能检出来（召回高但误报多）；调高则只报最确信的（精确高但漏检多）。单一阈值下的准确率无法反映模型全貌。AP 的做法是：把阈值从高到低扫一遍，得到一条「精确率 vs 召回率」的曲线，取曲线下面积。这个面积越大，说明模型在「又想找全、又想找对」这件事上整体越强，与阈值选择无关。`,
  structure: `<svg viewBox="0 0 840 360" class="fig">
  <style>.lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}.ax{stroke:#94a3b8;stroke-width:1.4}</style>
  <text class="ti" x="10" y="18">PR 曲线：横轴 Recall，纵轴 Precision</text>
  <g transform="translate(56,36)">
    <line class="ax" x1="0" y1="220" x2="250" y2="220"/>
    <line class="ax" x1="0" y1="0" x2="0" y2="220"/>
    <text class="lb" x="125" y="242" text-anchor="middle">Recall →</text>
    <text class="lb" x="-46" y="110" transform="rotate(-90,-46,110)" text-anchor="middle">Precision →</text>
    <path d="M0,10 C62,12 124,28 165,66 C196,100 222,164 250,220" fill="none" stroke="#0f9d8f" stroke-width="2.6"/>
    <path d="M0,10 C62,12 124,28 165,66 C196,100 222,164 250,220 L250,220 L0,220 Z" fill="rgba(15,157,143,.13)"/>
    <text class="lb" x="86" y="140" fill="#0b7a70" font-size="12">AP = 曲线下面积（阴影）</text>
    <text class="lb" x="0" y="-8">1.0</text>
    <text class="lb" x="220" y="-8">Recall=1</text>
    <text class="lb" x="-30" y="224">0</text>
  </g>
  <text class="ti" x="340" y="18">AP 的两种算法（会造成数字差异）</text>
  <text class="lb" x="340" y="46" fill="#15803d">▸ 11 点插值（VOC2007 老标准）</text>
  <text class="lb" x="358" y="68">在 recall = 0, 0.1, …, 1.0 共 11 个点上取右侧最大</text>
  <text class="lb" x="358" y="88">precision，再平均</text>
  <text class="lb" x="340" y="118" fill="#0b7a70">▸ 全点插值（VOC2010+ / COCO 标准）</text>
  <text class="lb" x="358" y="140">对每个 recall 变化点都取右侧最大 precision，</text>
  <text class="lb" x="358" y="160">做单调化后算积分面积</text>
  <text class="lb" x="340" y="192" fill="#b45309">▸ COCO 的 mAP50-95（最严格）</text>
  <text class="lb" x="358" y="214">IoU 阈值从 0.50 到 0.95 每隔 0.05 取一次，</text>
  <text class="lb" x="358" y="234">共 10 个阈值，每个算一次 AP 再平均</text>
  <text class="lb" x="358" y="254">→ 对定位精度要求苛刻得多</text>
  <text class="ti" x="660" y="18">读表要点</text>
  <text class="lb" x="660" y="46">mAP50 &gt; mAP50-95</text>
  <text class="lb" x="660" y="68">两者差 15~22 点是常态</text>
  <text class="lb" x="660" y="98">差值突然变大 → 框不准</text>
  <text class="lb" x="660" y="118">（能检到但定位差）</text>
  <text class="lb" x="660" y="148">mAP50 高但 mAP50-95 低</text>
  <text class="lb" x="660" y="168">→ 优先检查标注贴合度</text>
  <text class="lb" x="660" y="198">务必看每类 AP（maps）</text>
  <text class="lb" x="660" y="218">平均值会掩盖差类</text>
  <text class="lb" x="10" y="300">官方口径示例：Ultralytics YOLO11，COCO val2017，imgsz=640，mAP50-95 = 39.5（yolo11n）。</text>
  <text class="lb" x="10" y="326">写论文时必须注明：数据集 / 划分方式 / 输入尺寸 / 评价脚本，否则数字无法比较。</text>
</svg>`,
  steps: [
    { t: "准备", d: "对某个类别，把验证集所有图片的所有预测框收集起来，每个带 (置信度, 是否与某个真值框 IoU ≥ 阈值)。" },
    { t: "排序", d: "按置信度从高到低排序。这就模拟了「从高阈值降到低阈值」的过程。" },
    { t: "累积计算 P 与 R", d: "从前往后逐个累加：<code>TP</code> 累加对的数量，<code>FP</code> 累加错的数量；<code>P = TP/(TP+FP)</code>，<code>R = TP/真值总数</code>。得到一串 (R, P) 点。" },
    { t: "单调化与积分", d: "把 P 序列从后往前取最大值（保证单调不增），然后算曲线下面积 = AP。" },
    { t: "对类别求平均", d: "COCO 80 个类各算一个 AP，取平均 = <b>mAP</b>（COCO 官方就叫 AP，社区习惯叫 mAP50-95）。" },
    { t: "重复 10 次", d: "IoU 阈值取 0.50、0.55、…、0.95，共 10 次，再平均。<b>这就是 mAP50-95 比 mAP50 低很多的原因。</b>" },
  ],
  code: {
    title: "手写 mAP 计算（看懂指标本质）",
    src: "自写实现 · 与 COCO 口径简化版",
    text: `import numpy as np

def compute_ap(recall, precision):
    """全点插值 AP：对 PR 曲线单调化后积分"""
    mrec = np.concatenate(([0.0], recall, [1.0]))
    mpre = np.concatenate(([0.0], precision, [0.0]))
    # 从右往左取最大值，保证 precision 单调不增
    for i in range(mpre.size - 1, 0, -1):
        mpre[i - 1] = max(mpre[i - 1], mpre[i])
    # 找到 recall 变化的位置，逐段积分
    idx = np.where(mrec[1:] != mrec[:-1])[0]
    return np.sum((mrec[idx + 1] - mrec[idx]) * mpre[idx + 1])


def ap_for_class(pred_conf, pred_is_tp, n_gt):
    """pred_conf: 该类别所有预测框的置信度
       pred_is_tp: 对应的是否为 TP（与真值 IoU 达标）
       n_gt: 该类别真值框总数"""
    order = np.argsort(-pred_conf)
    tp = pred_is_tp[order].astype(np.float32)
    fp = 1.0 - tp
    tp_cum, fp_cum = np.cumsum(tp), np.cumsum(fp)
    recall = tp_cum / (n_gt + 1e-9)
    precision = tp_cum / (tp_cum + fp_cum + 1e-9)
    return compute_ap(recall, precision)

# 最终：mAP50-95 = 对 10 个 IoU 阈值 × 所有类别 的 AP 求平均
# COCO 官方用 pycocotools；训练时 ultralytics 自带实现`,
  },
  demo: "map",
  pitfalls: [
    "<b>mAP50 与 mAP50-95 不能混着比。</b>同一模型两者差 15~22 点是正常的。看到「我的 mAP 只有 60」先确认是哪个口径，再看别人报的是哪个。",
    "<b>不同实现的 AP 可能差 1~2 个点。</b>VOC 的 11 点插值 vs 全点插值结果不同；COCO 还有 maxDets（每图最多检测数）等设置。写论文必须注明使用的评价脚本与设置。",
    "<b>验证集划分方式会显著改变 mAP。</b>随机划分通常偏乐观（同一场景的相似图片同时出现在训练与验证集）。按拍摄批次/时间段划分才是诚实的做法。",
    "<b>不要只看平均值。</b>80 类里可能有几类 AP 接近 0，被平均值掩盖。务必检查每类结果。",
  ],
},
{
  id: "scale", title: "复合缩放与 n/s/m/l/x", group: "G · 训练与工程", weight: 3, difficulty: "★★★",
  oneLine: "一个 yaml + 三行缩放系数，自动生成五个尺寸的模型——不需要手写 5 份配置。",
  why: `同一个结构，怎么变宽变深？人工设计五个版本既费时又容易不一致。YOLO 的做法是定义三条缩放系数：depth（重复次数倍率）、width（通道数倍率）、max_channels（通道上限），由框架自动生成。这让「改结构」和「改规模」彻底解耦——你改进结构时只改那份 yaml，五个尺寸自动跟着变。理解这套机制是「自己造模型」的入口。`,
  structure: `<svg viewBox="0 0 840 340" class="fig">
  <style>.lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}.hd{fill:#e3f6f3;stroke:#8fd8cf}</style>
  <text class="ti" x="10" y="18">官方 yolo11.yaml 的 scales 定义</text>
  <g transform="translate(10,32)">
    <rect x="0" y="0" width="384" height="164" rx="8" fill="#111820" stroke="#33404f"/>
    <text x="14" y="26" font-family="monospace" font-size="11.5" fill="#8b98ab"># [depth, width, max_channels]</text>
    <text x="14" y="50" font-family="monospace" font-size="11.5" fill="#7fb8ff">n: [0.50, 0.25, 1024]</text>
    <text x="14" y="72" font-family="monospace" font-size="11.5" fill="#7fb8ff">s: [0.50, 0.50, 1024]</text>
    <text x="14" y="94" font-family="monospace" font-size="11.5" fill="#7fb8ff">m: [0.50, 1.00,  512]</text>
    <text x="14" y="116" font-family="monospace" font-size="11.5" fill="#7fb8ff">l: [1.00, 1.00,  512]</text>
    <text x="14" y="138" font-family="monospace" font-size="11.5" fill="#7fb8ff">x: [1.00, 1.50,  512]</text>
  </g>
  <text class="ti" x="420" y="18">两条转换公式（与官方 parse_model 一致）</text>
  <g transform="translate(420,32)">
    <rect x="0" y="0" width="404" height="86" rx="8" fill="#fff8e6" stroke="#f0d799"/>
    <text class="lb" x="14" y="26" font-weight="700">① 通道：先按 max_channels 截断，再乘 width，最后对齐 8 的倍数</text>
    <text class="lb" x="14" y="50" font-family="monospace">c2 = max(8, int(min(c, max_ch) * width + 4) // 8 * 8)</text>
    <text class="lb" x="14" y="74" fill="#b45309">★ 运算顺序错了，yolo11x 会少一半通道（我实测踩过这个坑）</text>
  </g>
  <g transform="translate(420,132)">
    <rect x="0" y="0" width="404" height="64" rx="8" fill="#e3f6f3" stroke="#8fd8cf"/>
    <text class="lb" x="14" y="26" font-weight="700">② 重复次数：只在 n &gt; 1 时按 depth 缩放</text>
    <text class="lb" x="14" y="50" font-family="monospace">n = max(round(n * depth), 1) if n &gt; 1 else n</text>
  </g>
  <text class="ti" x="10" y="232">实际效果（主干第 8 层 C3k2 [1024, True] 的最终通道）</text>
  <rect x="10" y="244" width="814" height="86" rx="8" class="hd"/>
  <text class="lb" x="26" y="270">yolo11n：min(1024,1024)=1024 → ×0.25 = 256　　yolo11s：×0.50 = 512</text>
  <text class="lb" x="26" y="294">yolo11m：min(1024,512)=512 → ×1.00 = 512　　yolo11x：min(1024,512)=512 → ×1.50 = 768 → 受 max_ch=512 截断？不，公式里先截断后乘，所以是 768</text>
  <text class="lb" x="26" y="318" fill="#b45309">★ 这就是「官方图上标的通道数」在不同尺寸下不一致的根本原因 —— 两张图可能是不同变体。</text>
</svg>`,
  steps: [
    { t: "先看 depth", d: "n/s/m 的 depth 都是 0.5，l/x 是 1.0。所以 <code>C3k2</code> 的 <code>repeats=2</code> 在 n/s/m 上变成 <code>max(round(2×0.5),1)=1</code>，在 l/x 上是 2。<b>模型「更深」就是这么来的。</b>" },
    { t: "注意 n>1 的守卫", d: "<code>C2PSA</code> 的 repeats 也是 2，同样缩放为 1。而 <code>Conv</code> 这类 repeats=1 的层<b>不参与缩放</b>（否则会变成 0）。官方写的是 <code>if n > 1 else n</code>。" },
    { t: "再看 width", d: "n:0.25、s:0.5、m/l:1.0、x:1.5。<code>Conv [64,3,2]</code> 在 n 上是 <code>max(8, int(min(64,1024)×0.25+4)//8×8) = 16</code>；s 上是 32；x 上是 <code>int(64×1.5+4)//8×8 = 96</code>。" },
    { t: "max_channels 的作用", d: "m/l/x 的 max_channels=512，意味着主干最后一层的 1024 会<b>先被截断到 512，再乘 width</b>。对 m/l 结果就是 512；对 x 是 512×1.5=768（后续再对齐）。这是刻意的设计：主干不必那么宽，省下的算力给颈部与头部。" },
    { t: "为什么对齐到 8 的倍数", d: "GPU 的 Tensor Core 与内存对齐都偏好 8/16 的倍数。<code>+4</code> 是四舍五入，保证缩放后不因浮点截断丢精度。" },
    { t: "自己造模型的入口", d: "把 <code>yolo11.yaml</code> 复制成 <code>yolo11-custom.yaml</code>，把 n 的 width 从 0.25 改成 0.20，或把 max_channels 从 1024 降到 768，然后 <code>YOLO('yolo11-custom.yaml')</code>。<b>零 Python 代码，就能得到一个新尺寸的模型做对照实验。</b>" },
  ],
  code: {
    title: "亲手验证缩放公式（并与官方对账）",
    src: "对照 ultralytics/nn/tasks.py · parse_model",
    text: `def make_divisible(c, width, max_channels):
    """官方通道缩放逻辑（注意运算顺序）"""
    c_clamped = min(c, max_channels)                 # ① 先按上限截断
    c2 = int(c_clamped * width + 4) // 8 * 8         # ② 乘 width 并对齐 8 的倍数
    return max(8, c2)

def scale_repeats(n, depth):
    """官方深度增益（n>1 才缩放）"""
    return max(round(n * depth), 1) if n > 1 else n

scales = {
    "n": (0.50, 0.25, 1024),
    "s": (0.50, 0.50, 1024),
    "m": (0.50, 1.00,  512),
    "l": (1.00, 1.00,  512),
    "x": (1.00, 1.50,  512),
}

print("主干第 8 层 C3k2 [1024] 的实际通道：")
for k, (d, w, mc) in scales.items():
    print(f"  yolo11{k}: depth={d} width={w} max_ch={mc}  →  {make_divisible(1024, w, mc)}")
# yolo11n: 256   yolo11s: 512   yolo11m: 512   yolo11l: 512   yolo11x: 768

print("\\nC3k2 的 repeats=2 缩放后：")
for k, (d, w, mc) in scales.items():
    print(f"  yolo11{k}: depth={d}  →  {scale_repeats(2, d)} 个内部 block")`,
  },
  demo: "scale",
  pitfalls: [
    "<b>depth 的缩放有 n&gt;1 守卫。</b>round(2×0.5)=1 没问题，但如果漏了守卫，repeats=1 的层（如 Conv）会被算成 <code>round(1×0.5)=0</code>，得到空模块。",
    "<b>max_channels 的截断在乘 width 之前。</b>顺序颠倒会让 yolo11x 的第 5 层少一半通道，总参数量只剩官方值的一半。我在推导 x 变体时被这条卡了很久。",
    "<b>★ m/l/x 会强制所有 C3k2 的 c3k=True。</b>官方 parse_model 里写 <code>if m is C3k2 and scale in 'mlx': args[3] = True</code>，而 args[3] 正是 c3k 位。这条隐藏规则让 m/l/x 的参数量远大于 n/s。",
    "<b>「官方图上的通道数」要看变体。</b>同一张结构图在不同 width 下数字完全不同。看论文或博客的图时，先确认它标的是哪个尺寸。",
  ],
},
{
  id: "letterbox", title: "letterbox 预处理与坐标映射", group: "G · 训练与工程", weight: 2, difficulty: "★★",
  oneLine: "把任意长宽比的图「等比缩放到 640，空白处填灰」——保证目标不变形，但坐标系变了。",
  why: `网络要求固定输入尺寸（如 640×640）。如果直接把 1920×1080 硬 resize 成 640×640，物体会被横向压扁（长宽比从 1.78 变成 1.0），模型学到的「圆形」在推理时变成了椭圆——分布不一致，精度暴跌。letterbox 的做法是：等比缩放（长边缩到 640），短边用灰条（像素值 114）补齐。这样物体形状不变，只是图上多了边距。代价是坐标要做变换：预测框的坐标是在「填充后的图」上的，还原到原图时必须减去 padding 再除以缩放比。`,
  structure: `<svg viewBox="0 0 840 330" class="fig">
  <defs><marker id="ai" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.6;fill:none;marker-end:url(#ai)}</style></defs>
  <text class="ti" x="10" y="18">原图 1920×1080（长宽比 1.78）</text>
  <g transform="translate(10,30)">
    <rect x="0" y="0" width="220" height="124" fill="#dbeafe" stroke="#93c5fd"/>
    <circle cx="72" cy="62" r="27" fill="none" stroke="#16a34a" stroke-width="2.5"/>
    <text class="lb" x="150" y="112" text-anchor="middle" fill="#1e40af">圆是圆</text>
  </g>
  <path class="ar" d="M240,92 H300"/>
  <text class="lb" x="270" y="82" text-anchor="middle">等比缩放</text>
  <text class="lb" x="270" y="112" text-anchor="middle">×0.333</text>
  <text class="ti" x="316" y="18">错误做法：直接 resize 成 640×640</text>
  <g transform="translate(316,30)">
    <rect x="0" y="0" width="124" height="124" fill="#fee2e2" stroke="#fca5a5"/>
    <ellipse cx="56" cy="62" rx="27" ry="15" fill="none" stroke="#dc2626" stroke-width="2.5"/>
    <text class="lb" x="62" y="112" text-anchor="middle" fill="#b91c1c">圆被压扁成椭圆 ✗</text>
  </g>
  <text class="ti" x="470" y="18">正确做法：letterbox（等比 + 灰边填充）</text>
  <g transform="translate(470,30)">
    <rect x="0" y="0" width="124" height="124" fill="#f1f5f9" stroke="#cbd5e1"/>
    <rect x="0" y="0" width="124" height="38" fill="#727272"/>
    <rect x="0" y="86" width="124" height="38" fill="#727272"/>
    <circle cx="62" cy="62" r="25" fill="none" stroke="#16a34a" stroke-width="2.5"/>
    <text class="lb" x="62" y="16" text-anchor="middle" fill="#fff" font-size="10">填充 114</text>
    <text class="lb" x="62" y="118" text-anchor="middle" fill="#15803d">形状保持 ✓</text>
  </g>
  <text class="ti" x="630" y="18">坐标还原公式</text>
  <g transform="translate(630,30)">
    <rect x="0" y="0" width="200" height="180" rx="8" fill="#fdf1c9" stroke="#e6cf7a"/>
    <text class="lb" x="12" y="26">r = min(640/w, 640/h)</text>
    <text class="lb" x="12" y="50">new_w = round(w × r)</text>
    <text class="lb" x="12" y="74">dw = (640 − new_w) / 2</text>
    <text class="lb" x="12" y="98">（高度同理得 dh）</text>
    <text class="lb" x="12" y="128" fill="#b45309">还原到原图：</text>
    <text class="lb" x="12" y="152">x_orig = (x_net − dw) / r</text>
    <text class="lb" x="12" y="176">y_orig = (y_net − dh) / r</text>
  </g>
  <text class="lb" x="10" y="206">⚠ 这是「部署后精度莫名变差」的头号原因：两端 letterbox 的 padding 值、舍入方式、缩放比算法不一致。</text>
  <text class="lb" x="10" y="230">调试方法：把 PC 端与部署端对同一张图的前处理张量各存成 npy，直接做差。若 max(abs(diff)) &gt; 1，就是前处理不一致。</text>
  <text class="lb" x="10" y="254">训练时也要 letterbox：ultralytics 自动做。若你手动做离线增强，必须保持一致，否则训练与推理分布错位。</text>
  <text class="lb" x="10" y="278">填充值 114 是 ImageNet 均值附近的灰度，不是 0。用 0（纯黑）会让网络把黑边当特征，实测掉点。</text>
  <text class="lb" x="10" y="302">别忘了：网络输出的框是在「填充后 640×640」坐标系上的，必须做上述逆变换才能画回原图。</text>
</svg>`,
  steps: [
    { t: "算缩放比", d: "原图 1920×1080，目标 640：<code>r = min(640/1920, 640/1080) = min(0.333, 0.593) = <b>0.333</b></code>。取小的那个保证长边正好放进 640。" },
    { t: "算缩放后尺寸", d: "<code>new_w = round(1920×0.333) = 640</code>，<code>new_h = round(1080×0.333) = 360</code>。" },
    { t: "算 padding", d: "<code>dw = (640 − 640)/2 = 0</code>，<code>dh = (640 − 360)/2 = <b>140</b></code>。上下各填 140 行灰条。" },
    { t: "归一化", d: "像素值从 [0,255] 除以 255 变到 [0,1]。ultralytics 默认不做 ImageNet 标准化，直接 /255。" },
    { t: "网络推理", d: "得到 640×640 上的预测框坐标。" },
    { t: "坐标还原", d: "<code>x_orig = (x_net − 0) / 0.333</code>，<code>y_orig = (y_net − 140) / 0.333</code>。<b>必须做这一步，否则框会整体偏移。</b>" },
  ],
  code: {
    title: "letterbox 与坐标还原（可直接用）",
    src: "自写实现 · 与 ultralytics 语义一致",
    text: `import cv2
import numpy as np


def letterbox(im, new_shape=(640, 640), color=(114, 114, 114)):
    """等比缩放 + 灰边填充。返回 (图, 缩放比, (dw, dh))"""
    shape = im.shape[:2]                     # 当前 [h, w]
    if isinstance(new_shape, int):
        new_shape = (new_shape, new_shape)
    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
    new_unpad = (int(round(shape[1] * r)), int(round(shape[0] * r)))   # (w, h)
    dw = (new_shape[1] - new_unpad[0]) / 2   # 宽的填充量
    dh = (new_shape[0] - new_unpad[1]) / 2   # 高的填充量
    if shape[::-1] != new_unpad:
        im = cv2.resize(im, new_unpad, interpolation=cv2.INTER_LINEAR)
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    im = cv2.copyMakeBorder(im, top, bottom, left, right,
                            cv2.BORDER_CONSTANT, value=color)
    return im, r, (dw, dh)


def scale_boxes_back(boxes, r, dw_dh, orig_shape):
    """把网络输出的框还原到原图坐标。boxes: (N,4) xyxy（在 letterbox 后的图上）"""
    dw, dh = dw_dh
    boxes[:, [0, 2]] -= dw        # 减掉横向 padding
    boxes[:, [1, 3]] -= dh        # 减掉纵向 padding
    boxes /= r                    # 除以缩放比
    boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, orig_shape[1])
    boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, orig_shape[0])
    return boxes


# ---- 验证：一张 1920×1080 的图 ----
img = np.zeros((1080, 1920, 3), np.uint8)
out, r, pad = letterbox(img, 640)
print("缩放比 r =", round(r, 4))       # 0.3333
print("padding  =", pad)                # (0.0, 140.0)
print("输出尺寸 =", out.shape[:2])       # (640, 640)`,
  },
  demo: "letterbox",
  pitfalls: [
    "<b>填充值必须是 114。</b>这是有意的选择（接近 ImageNet 均值灰度）。用 0 会让网络把黑边当成「暗物体特征」，实测掉点。",
    "<b>舍入方式会影响像素级对齐。</b>官方用 <code>round(dh-0.1)</code> 与 <code>round(dh+0.1)</code> 分别算上下边距，差值可能差 1 像素。<b>两端必须用同一个实现</b>，否则框会有 1~3 像素的系统性偏移。",
    "<b>不要用非居中的 padding。</b>有的实现把灰条全填在右边/下边，训练与推理都用同一套倒也没错，但一旦混用就会整体偏移。统一用居中填充最安全。",
    "<b>换成固定 resize 能提速但会掉点。</b>去掉 letterbox 可让预处理更快（少一次 copyMakeBorder），但长宽比失真会让 mAP 掉 1~3 点。是否值得取决于你的时延预算。",
  ],
},
{
  id: "pipeline", title: "训练全流程时序", group: "G · 训练与工程", weight: 2, difficulty: "★★",
  oneLine: "一个 epoch 里到底发生了什么：数据加载 → 增强 → 前向 → 标签分配 → 三项损失 → 反向 → EMA 更新。",
  why: `很多人训了几个月模型，却说不清「训练时每一轮在做什么」。这导致出问题时只能瞎试。把时序搞清楚，你就能对每个现象定位到具体环节：比如 loss 不降是分配环节还是优化环节？mAP 抖动是增强太强还是学习率问题？这一节把 YOLO11 的一次迭代完整拆开。`,
  structure: `<svg viewBox="0 0 820 460" class="fig">
  <defs><marker id="aj" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.6;fill:none;marker-end:url(#aj)}</style></defs>
  <rect x="14" y="20" width="240" height="54" rx="8" fill="#e7f3ff" stroke="#b9d8f5"/>
  <text class="ti" x="134" y="40" text-anchor="middle">① DataLoader（workers 个进程）</text>
  <text class="lb" x="134" y="62" text-anchor="middle">读图 + 读标签，CPU 并行</text>
  <rect x="14" y="94" width="240" height="80" rx="8" fill="#fbe3c7" stroke="#e8bd85"/>
  <text class="ti" x="134" y="114" text-anchor="middle">② 在线数据增强</text>
  <text class="lb" x="134" y="136" text-anchor="middle">mosaic / mixup / HSV / 翻转</text>
  <text class="lb" x="134" y="156" text-anchor="middle">缩放平移 / copy_paste</text>
  <rect x="14" y="194" width="240" height="54" rx="8" fill="#eef1f5" stroke="#c6d2e0"/>
  <text class="ti" x="134" y="214" text-anchor="middle">③ letterbox + 归一化 + 打包</text>
  <text class="lb" x="134" y="236" text-anchor="middle">→ batch 张量送 GPU</text>
  <rect x="290" y="194" width="240" height="54" rx="8" fill="#cfe6f7" stroke="#93c2e6"/>
  <text class="ti" x="410" y="214" text-anchor="middle">④ 前向传播（主干→颈部→头）</text>
  <text class="lb" x="410" y="236" text-anchor="middle">输出 (B, 144, 8400)</text>
  <rect x="566" y="194" width="240" height="54" rx="8" fill="#e2d3f3" stroke="#b79be0"/>
  <text class="ti" x="686" y="214" text-anchor="middle">⑤ 标签分配 TAL</text>
  <text class="lb" x="686" y="236" text-anchor="middle">生成 targets / scores / fg_mask</text>
  <rect x="566" y="94" width="240" height="80" rx="8" fill="#fdf1c9" stroke="#e6cf7a"/>
  <text class="ti" x="686" y="114" text-anchor="middle">⑥ 三项损失</text>
  <text class="lb" x="686" y="136" text-anchor="middle">box(CIoU+DFL) + cls(BCE)</text>
  <text class="lb" x="686" y="156" text-anchor="middle">加权求和 → 标量</text>
  <rect x="290" y="94" width="240" height="80" rx="8" fill="#f5cfe0" stroke="#dd93b7"/>
  <text class="ti" x="410" y="114" text-anchor="middle">⑦ 反向传播</text>
  <text class="lb" x="410" y="136" text-anchor="middle">梯度回传至主干</text>
  <text class="lb" x="410" y="156" text-anchor="middle">（AMP 混合精度加速）</text>
  <rect x="290" y="20" width="240" height="54" rx="8" fill="#cfeedd" stroke="#8fcdaa"/>
  <text class="ti" x="410" y="40" text-anchor="middle">⑧ 优化器更新权重</text>
  <text class="lb" x="410" y="62" text-anchor="middle">SGD/AdamW + 动量 + 权重衰减</text>
  <rect x="566" y="20" width="240" height="54" rx="8" fill="#e3f6f3" stroke="#8fd8cf"/>
  <text class="ti" x="686" y="40" text-anchor="middle">⑨ EMA 更新</text>
  <text class="lb" x="686" y="62" text-anchor="middle">滑动平均权重（验证用它）</text>
  <path class="ar" d="M134,74 V90"/><path class="ar" d="M134,174 V190"/>
  <path class="ar" d="M254,221 H286"/><path class="ar" d="M530,221 H562"/>
  <path class="ar" d="M686,194 V178"/><path class="ar" d="M566,134 H534"/>
  <path class="ar" d="M410,94 V78"/><path class="ar" d="M530,47 H562"/>
  <rect x="14" y="286" width="792" height="156" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="6 5"/>
  <text class="ti" x="30" y="310">每个 epoch 结束后（on_fit_epoch_end）</text>
  <text class="lb" x="30" y="336">· 在验证集上跑一次前向，算 mAP50 / mAP50-95 / P / R（用 EMA 权重）</text>
  <text class="lb" x="30" y="360">· 写入 results.csv，更新 best.pt（若 mAP50-95 创新高）与 last.pt</text>
  <text class="lb" x="30" y="384">· 学习率按余弦调度衰减（从 lr0 到 lr0 × lrf）</text>
  <text class="lb" x="30" y="408">· 最后 close_mosaic 个 epoch 关闭 mosaic 增强，让模型适应「干净」图像，指标通常在此跳升</text>
  <text class="lb" x="30" y="432" fill="#b45309">★ 理解这一格，你就明白为什么「最后 10 轮 mAP 突然涨」不是 bug 而是设计</text>
</svg>`,
  steps: [
    { t: "① 数据准备（CPU，多进程）", d: "<code>workers=8</code> 意味着 8 个进程并行读图与做增强。这一步常是瓶颈——用 <code>nvidia-smi</code> 看 GPU 利用率低于 70%，通常就是数据加载跟不上。" },
    { t: "② 在线增强", d: "每次取到一个 batch 都现场做随机增强（不是提前存到磁盘）。mosaic 把 4 张图拼成 1 张，等价于「一张图里有 4 个场景」，大幅提升小目标与上下文多样性。" },
    { t: "③ 预处理", d: "letterbox 到 640、像素 /255、通道转成 CHW、拼成 batch 张量搬到 GPU。" },
    { t: "④ 前向", d: "主干 → 颈部 → 检测头，输出 <code>(B, 144, 8400)</code>。<b>这一步和推理时完全一样</b>（除了不计算 NMS）。" },
    { t: "⑤ 标签分配", d: "TAL 根据当前预测（<code>detach()</code> 后）决定哪些点是正样本。<b>注意：分配依赖当前预测，所以每个 epoch 的分配结果都在变</b>——这是动态分配的特征。" },
    { t: "⑥⑦⑧ 损失与更新", d: "三项加权求和成标量，AMP 混合精度下 backward（FP16 算、FP32 存梯度），优化器更新参数。若开了 EMA，还会额外维护一份权重滑动平均。" },
    { t: "⑨ EMA 与验证", d: "EMA 权重 = 0.9999×旧 + 0.0001×新（近似），它比原始权重更平滑、泛化更好。<b>验证与最终导出用的都是 EMA 权重</b>——这解释了一个常见疑惑：「为什么 best.pt 的效果比我训练时看到的更好」。" },
  ],
  code: {
    title: "用回调看清 YOLO11 的每个训练节点",
    src: "ultralytics 回调机制（可直接运行）",
    text: `from ultralytics import YOLO

model = YOLO("yolo11n.pt")


def on_train_start(trainer):
    print("训练开始，共", trainer.epochs, "轮")
    print("优化器:", type(trainer.optimizer).__name__)
    print("batch:", trainer.batch_size, " imgsz:", trainer.args.imgsz)


def on_train_batch_end(trainer):
    # 每个 batch 结束：这里能看到三项 loss 的实时值
    if trainer.tloss is not None:
        pass  # trainer.tloss = [box, cls, dfl]


def on_train_epoch_end(trainer):
    ep = trainer.epoch + 1
    lr = trainer.optimizer.param_groups[0]["lr"]     # 当前学习率
    print(f"[epoch {ep:3d}] lr={lr:.5f} "
          f"box={float(trainer.tloss[0]):.3f} "
          f"cls={float(trainer.tloss[1]):.3f} "
          f"dfl={float(trainer.tloss[2]):.3f}")


def on_fit_epoch_end(trainer):
    m = trainer.metrics                            # 验证指标
    print("  metrics:", {k: round(float(v), 4) for k, v in m.items()})


def on_model_save(trainer):
    print("  ★ 保存了新的 best.pt（mAP50-95 创新高）")


for name, fn in [("on_train_start", on_train_start),
                 ("on_train_batch_end", on_train_batch_end),
                 ("on_train_epoch_end", on_train_epoch_end),
                 ("on_fit_epoch_end", on_fit_epoch_end),
                 ("on_model_save", on_model_save)]:
    model.add_callback(name, fn)

model.train(data="data.yaml", epochs=50, imgsz=640, batch=8, device=0)`,
  },
  demo: "pipeline",
  pitfalls: [
    "<b>验证用的是 EMA 权重，不是当前训练权重。</b>所以你看到的 mAP 曲线比「原始权重」更平滑、也更高。这不是作弊，是标准做法。",
    "<b>标签分配每轮都在变。</b>因为 TAL 依赖当前预测，模型变了分配就变。这意味着「同一个样本在不同 epoch 学到的东西不同」——这是动态分配的好处也是不稳定的来源。",
    "<b>close_mosaic 会让指标跳升。</b>最后 10 轮关闭 mosaic 后，训练分布更接近验证分布，mAP 常有明显提升。看到曲线末端翘起来不要惊慌，那是设计。",
    "<b>GPU 利用率低 ≠ 模型慢。</b>先看数据加载（workers 数量、磁盘 IO、是否开了 cache）。8 个 worker 但数据在机械硬盘上，会成为严重瓶颈。",
  ],
},
{
  id: "deploy", title: "部署与 BN 融合", group: "G · 训练与工程", weight: 2, difficulty: "★★",
  oneLine: "从 .pt 到实际能跑的服务：导出格式选择、BN 折叠，以及「延迟到底花在哪」。",
  why: `训练完的 PyTorch 模型（.pt）不能直接上生产：它依赖 Python 运行时、没有图优化、BN 还是独立一层。部署的本质是「把计算图编译成目标硬件最擅长的形式」。同时要清醒认识到：端到端延迟不等于推理时间——预处理和后处理经常占掉 30% 以上，而它们恰恰最容易被忽略。`,
  structure: `<svg viewBox="0 0 840 380" class="fig">
  <defs><marker id="ak" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.6;fill:none;marker-end:url(#ak)}</style></defs>
  <text class="ti" x="10" y="18">导出链路</text>
  <rect x="10" y="30" width="140" height="46" rx="8" fill="#e7f3ff" stroke="#b9d8f5"/>
  <text class="ti" x="80" y="50" text-anchor="middle">best.pt</text>
  <text class="lb" x="80" y="68" text-anchor="middle">PyTorch 权重</text>
  <rect x="180" y="30" width="150" height="46" rx="8" fill="#e3f6f3" stroke="#8fd8cf"/>
  <text class="ti" x="255" y="50" text-anchor="middle">BN 折叠 + 图优化</text>
  <text class="lb" x="255" y="68" text-anchor="middle">精度无损</text>
  <rect x="360" y="30" width="140" height="46" rx="8" fill="#fdf1c9" stroke="#e6cf7a"/>
  <text class="ti" x="430" y="50" text-anchor="middle">ONNX</text>
  <text class="lb" x="430" y="68" text-anchor="middle">通用交换格式</text>
  <path class="ar" d="M150,53 H176"/><path class="ar" d="M330,53 H356"/>
  <text class="lb" x="530" y="46">→ 再编译到目标硬件：</text>
  <text class="lb" x="530" y="70">TensorRT / OpenVINO / RKNN / NCNN / TFLite</text>
  <text class="ti" x="10" y="116">端到端延迟的真实构成（典型值，随硬件变化）</text>
  <g transform="translate(10,128)">
    <rect x="0" y="0" width="800" height="42" rx="6" fill="#f1f5f9" stroke="#cbd5e1"/>
    <rect x="0" y="0" width="128" height="42" fill="#fbe3c7" stroke="#e8bd85"/>
    <text class="lb" x="64" y="26" text-anchor="middle">采集/解码 16%</text>
    <rect x="128" y="0" width="160" height="42" fill="#dde6fb" stroke="#a9bff0"/>
    <text class="lb" x="208" y="26" text-anchor="middle">预处理 20%</text>
    <rect x="288" y="0" width="320" height="42" fill="#cfe6f7" stroke="#93c2e6"/>
    <text class="lb" x="448" y="26" text-anchor="middle">推理 40%</text>
    <rect x="608" y="0" width="96" height="42" fill="#e2d3f3" stroke="#b79be0"/>
    <text class="lb" x="656" y="26" text-anchor="middle">NMS 12%</text>
    <rect x="704" y="0" width="96" height="42" fill="#cfeedd" stroke="#8fcdaa"/>
    <text class="lb" x="752" y="26" text-anchor="middle">业务 12%</text>
  </g>
  <text class="lb" x="10" y="196" fill="#b45309">★ 推理只占 40%。只优化模型而不管前后处理，端到端最多快 1.6 倍；把预处理搬到 GPU 往往立竿见影。</text>
  <text class="ti" x="10" y="232">BN 折叠的数学（为什么精度无损）</text>
  <g transform="translate(10,246)">
    <rect x="0" y="0" width="400" height="100" rx="8" fill="#fff8e6" stroke="#f0d799"/>
    <text class="lb" x="14" y="26" font-family="monospace">y = γ · (Wx + b − μ) / √(σ² + ε) + β</text>
    <text class="lb" x="14" y="54" font-family="monospace">令 W' = γW / √(σ²+ε)</text>
    <text class="lb" x="14" y="76" font-family="monospace">　 b' = γ(b−μ) / √(σ²+ε) + β</text>
    <text class="lb" x="14" y="96" font-family="monospace">则 y = W'x + b'　← 等价的一次卷积</text>
  </g>
  <g transform="translate(430,246)">
    <rect x="0" y="0" width="380" height="100" rx="8" fill="#e3f6f3" stroke="#8fd8cf"/>
    <text class="lb" x="14" y="26">BN 在推理时是确定的线性变换</text>
    <text class="lb" x="14" y="50">（用的是 running_mean / running_var）</text>
    <text class="lb" x="14" y="76">所以可完全折叠进卷积权重 → 少一层逐元素运算</text>
    <text class="lb" x="14" y="98">速度提升 10%~20%，精度完全不变（数学等价）</text>
  </g>
</svg>`,
  steps: [
    { t: "导出前先融合 BN", d: "ultralytics 的 export 会自动做 <code>model.fuse()</code>。若你手写推理代码，必须自己调用，否则 BN 仍是一层独立计算。" },
    { t: "导出 ONNX", d: "<code>model.export(format='onnx', opset=12, simplify=True)</code>。opset 12 兼容性最好；simplify 消除冗余算子（需要 onnxslim，本机未安装时框架会提示）。" },
    { t: "维度固定", d: "<code>dynamic=False</code> 时输入固定为 640×640，TensorRT 能做得更好的优化。动态 shape 更灵活但更慢。" },
    { t: "编译到目标硬件", d: "NVIDIA → <code>format='engine'</code>（TensorRT，必须在目标机器上编译）；Intel → <code>'openvino'</code>；瑞芯微 → <code>'rknn'</code>；移动端 → <code>'ncnn'</code> / <code>'tflite'</code>。" },
    { t: "量化（可选）", d: "FP16 几乎无损（掉 0~0.3 mAP）；INT8 需要校准集，掉 0.5~2 mAP 但速度可再提 1.5~2 倍。<b>每换一次格式都要回归一遍 mAP</b>。" },
    { t: "别忘了前后处理", d: "把 letterbox 也编译进图（OpenVINO 支持 preprocess 步骤），或用 CUDA kernel 做。NMS 用编译好的实现（TRT 插件 / OpenCV NMSBoxes），不要 Python 循环。" },
  ],
  code: {
    title: "导出与推理时延拆解",
    src: "ultralytics 导出 API",
    text: `from ultralytics import YOLO
import time

model = YOLO("runs/detect/train/weights/best.pt")

# ---- 导出各种格式 ----
model.export(format="onnx",     opset=12, simplify=True, dynamic=False, half=False)
model.export(format="engine",   half=True, workspace=4)      # 需在目标 GPU 上执行
model.export(format="openvino", half=True)                    # Intel CPU / 核显
model.export(format="torchscript")                            # 无额外依赖，最省事

# ---- 官方 benchmark：直接给出各阶段耗时 ----
model.benchmark(data="data.yaml", imgsz=640, half=True)

# ---- 自己拆解端到端延迟 ----
import cv2
from ultralytics.utils.augment import LetterBox

img = cv2.imread("test.jpg")
lb = LetterBox((640, 640), auto=False)

t0 = time.perf_counter()
x = lb(image=img)                                              # 预处理
t1 = time.perf_counter()
out = model.predict(x, verbose=False, conf=0.25, iou=0.7)[0]    # 推理 + 后处理
t2 = time.perf_counter()

r = out.speed                           # ultralytics 自带的分段计时（毫秒）
print(f"预处理  : {(t1-t0)*1000:6.2f} ms")
print(f"推理    : {r['inference']:6.2f} ms   ← 官方口径")
print(f"后处理  : {r['postprocess']:6.2f} ms")
print(f"端到端  : {(t2-t0)*1000:6.2f} ms")
# 对比「推理」与「端到端」，你就能看到前后处理到底占了多少`,
  },
  demo: null,
  pitfalls: [
    "<b>TensorRT engine 与硬件绑定。</b>在 A 机器导出的 engine 拿到 B 机器（GPU 型号/驱动/TensorRT 版本不同）会直接失效。必须在部署机上导出，或严格对齐版本。",
    "<b>量化一定要回归 mAP。</b>INT8 在某些类别上掉点特别多（比如颜色敏感的目标）。必须用真实数据验证，不能只看「平均掉了 1 个点」。",
    "<b>ONNX 不是终点，而是中间格式。</b>直接用 onnxruntime 推理通常比 PyTorch 快 1.5~2 倍，但比 TensorRT 慢 2~3 倍。想榨干性能必须走硬件专用编译器。",
    "<b>融合 BN 后不要继续训练。</b>fuse() 会修改模型结构（BN 层被删），拿融合后的模型继续训练会报错或产生错误结果。融合只用于推理。",
  ],
}
);
