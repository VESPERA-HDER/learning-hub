#!/usr/bin/env python3
"""把主站和 YOLO 子站各自打包成「单个 html 文件」，输出到 dist/。
用法：python3 tools/build-single-file.py
生成：
  dist/学习基地-单文件.html      —— 主站（已把 CSS/JS/数据全部内联）
  dist/YOLO学习站-单文件.html    —— YOLO 子站（内联 5 个 JS）
两个文件放在同一文件夹时，主站里的「进入 YOLO 学习站」可以互相跳转。
"""
import re, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)

def inline_scripts(html: str, base: pathlib.Path) -> str:
    def repl(m):
        src = m.group(1)
        f = base / src
        if not f.exists():
            sys.exit(f'找不到 JS 文件: {f}')
        code = f.read_text(encoding='utf-8')
        if '</script' in code.lower():
            sys.exit(f'{f.name} 里含 </script>，无法安全内联')
        return '<script>\n' + code + '\n</script>'
    return re.sub(r'<script src="([^"]+)"></script>', repl, html)

# ---------- 主站 ----------
hub = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'assets/css/style.css').read_text(encoding='utf-8')
hub = hub.replace('<link rel="stylesheet" href="./assets/css/style.css">',
                  '<style>\n' + css + '\n</style>')
hub = inline_scripts(hub, ROOT)
hub = hub.replace('./yolo11-atlas/index.html', './YOLO学习站-单文件.html')
# 单文件版不注册 Service Worker（file:// 下本来就会跳过，保险起见移除）
hub = re.sub(r'<script>\s*/\* 注册 Service Worker.*?</script>', '', hub, flags=re.S)
(DIST / '学习基地-单文件.html').write_text(hub, encoding='utf-8')

# ---------- YOLO 子站 ----------
atlas = (ROOT / 'yolo11-atlas/index.html').read_text(encoding='utf-8')
atlas = inline_scripts(atlas, ROOT / 'yolo11-atlas')
(DIST / 'YOLO学习站-单文件.html').write_text(atlas, encoding='utf-8')

for f in sorted(DIST.iterdir()):
    print(f'{f.name}  {f.stat().st_size / 1024:.0f} KB')
print('完成 → dist/')
