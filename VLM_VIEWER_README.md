# 🎨 VLM Viewer - 使用指南

一个美观的 Web UI 界面，用于查看和浏览 VLM 评估结果。

## 🚀 快速开始

### 方法 1: 使用 HTTP 服务器（推荐）

```bash
# 在项目根目录启动 HTTP 服务器
npx http-server -p 8080

# 然后在浏览器打开
http://localhost:8080/vlm-viewer.html?workspace=0126-balanced
```

### 方法 2: 使用现有 API 服务器

```bash
# 启动项目的 API 服务器
node api.mjs

# 然后在浏览器打开
http://localhost:3000/vlm-viewer.html?workspace=0126-balanced
```

### 方法 3: 直接在浏览器打开

```bash
# Windows
start vlm-viewer.html

# macOS
open vlm-viewer.html

# Linux
xdg-open vlm-viewer.html
```

**注意**: 直接打开需要输入 workspace 名称。

## 📁 URL 参数

```
vlm-viewer.html?workspace=<workspace-name>
```

**示例**:

- `vlm-viewer.html?workspace=0126-balanced`
- `vlm-viewer.html?workspace=0126-biased`
- `vlm-viewer.html?workspace=batch-1207`

## ✨ 功能特性

### 📊 统计概览

- 总评估数量
- 平均视觉质量分数
- 平均教学质量分数
- 工作空间名称

### 🔍 搜索和过滤

- **搜索框**: 按文件名搜索
- **排序选项**:
  - 按文件名排序（默认）
  - 按视觉质量降序
  - 按教学质量降序

### 📱 卡片展示

每个卡片显示：

- 📸 截图预览
- 📊 视觉质量分数（0-5）
- 🎓 教学质量分数（0-5）
- 📈 进度条可视化
- 📝 分析摘要

### 🖼️ 详情模态框

点击卡片查看完整详情：

- 🌐 完整 HTML 页面预览（iframe）
- 📊 详细评分
- 📝 完整分析文本
  - 视觉质量分析
  - 教学质量分析

### ⌨️ 键盘快捷键

- `ESC` - 关闭模态框

## 🎨 界面截图说明

### 主界面

```
╔═══════════════════════════════════════════╗
║  VLM Evaluation Viewer                    ║
║  Visual Quality & Educational Quality     ║
╠═══════════════════════════════════════════╣
║  [450]        [3.82]       [2.95]  [...]  ║
║  Total      Avg Visual  Avg Edu  Workspace║
╠═══════════════════════════════════════════╣
║  [🔍 Search...]  [Sort: Filename ▼]       ║
╠═══════════════════════════════════════════╣
║  ┌──────┐  ┌──────┐  ┌──────┐            ║
║  │ IMG  │  │ IMG  │  │ IMG  │  ...       ║
║  │ 4.5  │  │ 3.0  │  │ 4.2  │            ║
║  └──────┘  └──────┘  └──────┘            ║
╚═══════════════════════════════════════════╝
```

### 详情模态框

```
╔═══════════════════════════════════════════╗
║                                      [×]  ║
║  ┌─────────────────────────────────────┐ ║
║  │                                     │ ║
║  │    HTML Page Preview (iframe)      │ ║
║  │                                     │ ║
║  └─────────────────────────────────────┘ ║
║                                           ║
║  Visual Quality: 4.5  Educational: 3.0   ║
║                                           ║
║  📊 Visual Analysis:                      ║
║  The layout is clean and well-organized..║
║                                           ║
║  🎓 Educational Analysis:                 ║
║  The visualization shows a data structure║
╚═══════════════════════════════════════════╝
```

## 📂 文件结构要求

UI 需要以下文件结构才能正常工作：

```
workspace/
  └── 0126-balanced/
      ├── html/                          # HTML 文件
      │   ├── 63afa090-xxx.html
      │   └── ...
      ├── visuals/                       # 截图
      │   ├── 63afa090-xxx.png
      │   └── ...
      └── visual-results/                # VLM 评估结果
          ├── 63afa090-xxx.json
          ├── ...
          └── _summary.json              # 必需！
```

## 🎯 完整工作流程

```bash
# 1. 生成 HTML（如果还没有）
node batch-workflow.mjs -c 200 --html-model "gpt-4o-mini" \
  --fsm-model "gpt-4o-mini" --playwright-model "gpt-5-mini" \
  -w "0126-balanced" -q "./question-list.json"

# 2. 批量截图
node capture-screenshots.mjs workspace/0126-balanced --workers 8

# 3. VLM 评估
node vlm-evaluation.mjs -c 100 --vlm-model "gpt-4o-mini" -w "0126-balanced"

# 4. 启动服务器查看结果
npx http-server -p 8080

# 5. 在浏览器打开
# http://localhost:8080/vlm-viewer.html?workspace=0126-balanced
```

## 🎨 设计特色

### 美观的渐变背景

- 紫色渐变主题
- 现代化卡片设计

### 响应式布局

- 自适应网格系统
- 移动端友好

### 流畅动画

- 卡片悬停效果
- 平滑过渡
- 进度条动画

### 直观的评分可视化

- 分数 + 进度条
- 颜色渐变指示
- 清晰的标签

## 🛠️ 故障排除

### 问题 1: 页面加载失败

**错误**: "Error loading data"

**解决方案**:

1. 确认 workspace 名称正确
2. 确认 `visual-results/_summary.json` 存在
3. 使用 HTTP 服务器而不是直接打开文件

### 问题 2: 图片不显示

**原因**: 浏览器 CORS 限制

**解决方案**:

```bash
# 使用 HTTP 服务器
npx http-server -p 8080 --cors
```

### 问题 3: HTML 预览不显示

**原因**: iframe 加载问题

**解决方案**:

1. 确认 HTML 文件存在于 `workspace/<name>/html/` 目录
2. 使用 HTTP 服务器
3. 检查浏览器控制台错误

### 问题 4: 没有数据显示

**检查清单**:

- ✅ VLM 评估已完成
- ✅ `_summary.json` 文件存在
- ✅ 个别评估 JSON 文件存在
- ✅ 使用正确的 workspace 参数

## 💡 高级技巧

### 1. 比较多个 workspace

在不同浏览器标签页打开：

```
Tab 1: vlm-viewer.html?workspace=0126-balanced
Tab 2: vlm-viewer.html?workspace=0126-biased
```

### 2. 快速筛选

使用搜索功能快速定位特定文件：

```
Search: "63afa"     → 只显示匹配的文件
Search: "fa73"      → 按 ID 部分搜索
```

### 3. 找到最佳/最差案例

使用排序按钮：

- 点击 "Visual ↓" - 找到视觉质量最高的
- 点击 "Educational ↓" - 找到教学质量最高的
- 滚动到底部查看最低分

### 4. 导出截图

右键点击卡片中的图片 → "另存为"

## 📊 数据分析建议

### 识别模式

1. **高视觉质量 + 低教学质量**
   - 可能：设计漂亮但缺乏教学内容
   - 证明：视觉不等于教学效果

2. **低视觉质量 + 高教学质量**
   - 可能：内容丰富但设计简陋
   - 证明：教学价值不依赖视觉

3. **两者都高**
   - 最佳案例
   - 可作为参考标准

4. **两者都低**
   - 需要改进的案例

### 对比交互测试

将 VLM 评分与 Playwright 测试结果对比：

1. 打开 VLM Viewer 查看视觉评分
2. 打开主项目 Viewer (`viewer-react.html`) 查看测试通过率
3. 寻找差异：
   - 高 VLM 分数但低测试通过率 → 视觉好但交互差
   - 低 VLM 分数但高测试通过率 → 功能正确但视觉差

## 🚀 性能优化

对于大量数据（>500 个评估）：

1. **延迟加载图片**
   - 浏览器会自动延迟加载屏幕外图片

2. **虚拟滚动**（未实现）
   - 如需处理 1000+ 项，考虑添加虚拟滚动库

3. **缓存**
   - 浏览器会自动缓存已加载的图片和 JSON

## 🔗 相关文件

- `vlm-evaluation.mjs` - VLM 评估脚本
- `capture-screenshots.mjs` - 截图捕获脚本
- `VLM_EVALUATION_README.md` - VLM 评估文档
- `CAPTURE_SCREENSHOTS_README.md` - 截图捕获文档

## 📝 技术栈

- 纯 HTML/CSS/JavaScript
- 无外部依赖
- 现代 ES6+ 语法
- Fetch API
- CSS Grid & Flexbox
- CSS 动画

## 🎓 研究应用

这个查看器特别适合：

1. **论文插图**
   - 截图展示评估结果
   - 展示评分分布

2. **案例研究**
   - 挑选典型案例
   - 对比分析

3. **演示展示**
   - 实时展示评估结果
   - 互动探索数据

4. **质量审查**
   - 快速浏览所有结果
   - 识别异常值

完美适配您的研究目标：**证明纯视觉评估的局限性！** 🎯
