# WeChat Publisher Pro 🚀

一款专为年轻人打造的 **赛博朋克风格** Markdown 转公众号文章排版工具。

![Cyberpunk Style](https://img.shields.io/badge/Style-Cyberpunk-00f5d4)
![Tech Stack](https://img.shields.io/badge/React-18-61dafb)
![Vite](https://img.shields.io/badge/Vite-Latest-646cff)

## ✨ 特性

### 🎨 视觉设计
- **赛博朋克深色主题** - 霓虹渐变 + 毛玻璃效果
- **动态背景网格** - 科技感十足的动画背景
- **发光球体装饰** - 流动的渐变光晕效果
- **毛玻璃卡片** - 现代感十足的玻璃拟态设计

### 📱 功能特性
- ✍️ **Markdown 编辑** - 支持 GitHub Flavored Markdown
- 📱 **iPhone 15 Pro 预览** - 真实手机模拟器
- 📋 **一键复制 HTML** - 带内联样式的公众号兼容代码
- 👁️ **代码查看器** - 弹窗展示生成的 HTML
- 🖼️ **封面管理** - 拖拽上传，实时预览
- 🌙 **深色界面** - 护眼的深色编辑器

### 🎯 交互体验
- 流畅的动画过渡
- 霓虹发光按钮效果
- 悬停状态反馈
- 移动端完美适配

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

访问 http://localhost:5173 即可使用。

## 📝 使用指南

### 1. 编辑文章
左侧编辑器输入 Markdown，支持：
- `# 标题` - 多级标题（带装饰样式）
- `**粗体**`、`*斜体*` - 文字强调
- `> 引用` - 绿色边框引用块
- \`\`\`代码\`\`\` - 深色代码块
- `- 列表` / `1. 列表` - 列表项
- `| 表格 |` - 数据表格
- `![图片](url)` - 图文混排

### 2. 设置文章信息
- **标题** - 文章主标题（自动提取）
- **公众号名称** - 显示在预览头部
- **作者** - 文章作者
- **封面** - 建议 900×500 比例
- **摘要** - 文章摘要（自动提取）

### 3. 预览效果
- iPhone 15 Pro 真实尺寸模拟
- 微信导航栏 + 状态栏
- 封面大图带渐变遮罩
- 公众号信息卡片

### 4. 导出 HTML
**方式一：一键复制**
1. 点击顶部「一键复制」按钮
2. 粘贴到公众号编辑器

**方式二：查看代码**
1. 点击「查看HTML」按钮
2. 弹窗显示完整代码
3. 点击复制或手动选择

## 🎨 设计风格

### 配色方案
```css
主色：#00f5d4（霓虹青）
副色：#7b2cbf（赛博紫）
强调：#ff006e（荧光粉）
背景：#0a0a0f（深邃黑）
```

### 视觉元素
- 渐变文字效果
- 霓虹发光阴影
- 毛玻璃模糊背景
- 网格动画背景
- 圆角现代设计

## 🛠️ 技术栈

- **React 18** - 现代 UI 框架
- **TypeScript** - 类型安全
- **Vite** - 极速构建工具
- **react-markdown** - Markdown 解析
- **remark-gfm** - GitHub 风格 Markdown
- **Lucide React** - 精美图标库

## 📁 项目结构

```
web/
├── src/
│   ├── App.tsx              # 主应用组件
│   ├── App.css              # 主样式（赛博朋克主题）
│   ├── wechat-styles.css    # 微信预览样式
│   ├── main.tsx             # 应用入口
│   └── index.css            # 全局样式 + 变量
├── index.html
├── vite.config.ts
└── package.json
```

## 🔧 配置说明

### API 代理
开发时 API 请求自动代理到 `http://localhost:8080`：

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

### 自定义主题色
在 `src/index.css` 中修改 CSS 变量：

```css
:root {
  --primary: #00f5d4;    /* 主色调 */
  --secondary: #7b2cbf;  /* 副色调 */
  --accent: #ff006e;     /* 强调色 */
}
```

## 📱 响应式适配

- **桌面端**：双栏布局，实时预览
- **平板端**：自适应缩放
- **手机端**：单栏切换，完整功能

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 许可证

MIT License © 2024 WeChat Publisher Pro
