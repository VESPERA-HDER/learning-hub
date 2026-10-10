# 我的学习基地 (Learning Hub)

个人学习门户静态站。每个研究方向是一个「分支」，点进去是对应的学习子站。
目前包含分支：**YOLO11 机器视觉**（四阶段课程 + 23 个模块精读图鉴）。

纯 HTML/CSS/JS，零构建、零依赖，双击 `index.html` 即可离线使用，也可直接部署到 GitHub Pages。

## 功能

- **学习分支**：GitHub 仓库卡片式分支管理（状态 / 简介 / 链接 / 进度条）
- **学习热力图**：GitHub 贡献图风格，打开本站或 YOLO 子站自动记录当天活动
- **学习足迹**：里程碑时间线
- **课程进度联动**：自动读取 YOLO11 子站的打卡进度并显示百分比
- **今日备忘**：随手记，自动保存
- **网页内编辑模式**：点「✏️ 编辑模式」即可在页面上改文字、增删分支和足迹，
  支持导出 / 导入 JSON 备份、一键恢复默认
- **深色 / 浅色主题**，跟随系统，可手动切换

## 目录结构

```
learning-hub/
├── index.html            # 门户主页
├── assets/
│   ├── css/style.css     # 全部样式
│   └── js/app.js         # 全部交互逻辑
├── data/
│   └── hub-data.js       # ★ 站点内容数据（主要编辑这个文件）
├── yolo11-atlas/         # 分支子站：YOLO11 学习站
└── README.md
```

## 如何编辑内容

两种方式，任选：

1. **网页编辑模式**（改完存在浏览器 localStorage，优先级更高）：
   打开主页 → 右上角「✏️ 编辑模式」→ 直接在页面上修改 → 「✓ 完成」。
2. **编辑数据文件**（会随 git 提交，开源后别人看到的就是它）：
   编辑 `data/hub-data.js`，里面有逐行中文注释。保存后刷新页面即可。
   若网页编辑模式里有改动覆盖了它，在编辑模式里点「↺ 恢复默认」即可让文件重新生效。

## 部署到 GitHub Pages

```bash
git init
git add .
git commit -m "init: my learning hub"
git branch -M main
git remote add origin https://github.com/<你的用户名>/learning-hub.git
git push -u origin main
```

然后在仓库 Settings → Pages → Source 选 `main` 分支根目录，等 1 分钟，
网站就在 `https://<你的用户名>.github.io/learning-hub/` 上线了。

上线后记得把 `data/hub-data.js` 里 `github.user` 和 `github.repo` 改成你的真实信息。

## 隐私说明

- 网页编辑模式的修改、备忘录、热力图数据都存在访问者自己浏览器的
  localStorage 里，**不会**随仓库分发，也不会上传到任何服务器。
- 随仓库公开的内容只有 `data/hub-data.js` 和各静态页面本身。

## License

代码：MIT（见 LICENSE）。学习内容（笔记、课程文字）版权归原作者所有。
YOLO11 子站内容基于 Ultralytics 官方文档整理，Ultralytics YOLO11 采用
AGPL-3.0 / Enterprise 双许可，商业使用请注意。
