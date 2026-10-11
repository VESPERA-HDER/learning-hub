/* ============================================================================
 * 我的学习基地 · 站点数据（这个文件就是给你改的！）
 * ----------------------------------------------------------------------------
 * 改这里的内容，保存后刷新页面即可生效。
 * 注意：如果你在网页的「编辑模式」里改过内容，网页里的修改优先级更高
 *       （它存在浏览器 localStorage 里）；想让本文件重新生效，
 *       在网页编辑模式里点「↺ 恢复默认」即可。
 *
 * 字段说明：
 *   site       站点基本信息（名字会显示在导航栏和浏览器标签页上）
 *   hero       首页大标题区域
 *   github     你的 GitHub 用户名和本项目的仓库名（开源后填，用于页面上的链接）
 *   branches[] 学习分支卡片：
 *     icon     一个 emoji 图标
 *     name     分支名称
 *     desc     一句话简介
 *     status   状态：todo 待开始 / doing 进行中 / done 已完成
 *     link     点击「进入分支」跳转的地址（站内用相对路径，站外用 https:// 完整网址）
 *     tag      卡片右下角的小标签（类似 GitHub 的语言标签）
 *     progressKey  特殊功能：填 'yolo11' 会自动显示 YOLO 课程的打卡进度条，其他分支留空 ""
 *   milestones[] 学习足迹时间线：date 日期 / text 内容
 *   quickLinks[]   快速入口：icon / name / desc / link
 * ==========================================================================*/

window.HUB_DEFAULT_DATA = {

  site: {
    title: '我的学习基地',
    subtitle: '个人学习门户 · 持续记录中',
  },

  hero: {
    title: '把每个方向，都学到底。',
    desc: '这里是我的个人学习主站。每一个研究方向是一个分支，点进去就是对应的学习站。本站代码已按开源项目组织，将来会发布到 GitHub Pages。',
  },

  github: {
    user: 'VESPERA-HDER',         // GitHub 用户名（2026-10 已开源）
    repo: 'learning-hub',         // 仓库：github.com/VESPERA-HDER/learning-hub
  },

  branches: [
    {
      icon: '👁️',
      name: 'YOLO11 机器视觉',
      desc: '四阶段课程：环境与数据 → 训练调参 → 模块级架构深挖 → 评估部署。内含 23 个模块精读、张量流追踪和课程打卡。',
      status: 'doing',
      link: './yolo11-atlas/index.html',
      tag: '课程 · CV',
      progressKey: 'yolo11',
    },
    {
      icon: '📝',
      name: '毕业课题',
      desc: '课题方向待定中——需要先回答：数据类型是显微细胞 / 无人机航拍 / 工业表面 / 其他？',
      status: 'todo',
      link: '',
      tag: '研究',
      progressKey: '',
    },
    {
      icon: '🔤',
      name: '英语与文献阅读',
      desc: '配合「沉浸式翻译」插件看 YouTube 教程、读英文文档，逐步过渡到直接读原文。',
      status: 'todo',
      link: '',
      tag: '语言',
      progressKey: '',
    },
  ],

  milestones: [
    { date: '2026-10', text: '阶段一完成：conda 环境 + GPU 版 PyTorch + COCO128 走通 + 数据集准备' },
    { date: '2026-10-10', text: '装好「沉浸式翻译」插件，YouTube 双语字幕学习路线打通' },
    { date: '2026-10-10', text: '个人学习基地网站上线，开始按分支管理学习' },
  ],

  quickLinks: [
    { icon: '🗺️', name: 'YOLO11 学习站', desc: '课程路线 + 模块图鉴', link: './yolo11-atlas/index.html' },
    { icon: '📺', name: '视频：YOLO11 总览', desc: 'YouTube · 配双语字幕看', link: 'https://www.youtube.com/watch?v=-JXwa-WlkU8' },
    { icon: '📺', name: '视频：VisDrone 训练实战', desc: 'YouTube · 阶段二预演', link: 'https://www.youtube.com/watch?v=9ymyH4H1fG4' },
    { icon: '📖', name: 'Ultralytics 官方文档', desc: '版本参数以它为准', link: 'https://docs.ultralytics.com/' },
    { icon: '🌐', name: '沉浸式翻译官网', desc: '插件使用教程', link: 'https://immersivetranslate.com/zh-Hans/' },
  ],
};
