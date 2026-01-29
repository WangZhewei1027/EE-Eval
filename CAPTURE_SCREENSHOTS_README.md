# 📸 批量截图工具

快速为工作空间中的所有 HTML 文件生成截图的 Playwright 工具。

## 🚀 快速开始

### 基础用法

```bash
node capture-screenshots.mjs workspace/0126-balanced
```

### 高级用法

```bash
# 使用8个worker并发处理（更快）
node capture-screenshots.mjs workspace/0126-balanced --workers 8

# 显示浏览器窗口（调试模式）
node capture-screenshots.mjs workspace/0126-balanced --headed

# 组合使用 (别打开窗口不然会爆！！)
node capture-screenshots.mjs workspace/0126-balanced --workers 12 --headed
```

## 📁 文件结构

```
workspace/
  └── 0126-balanced/
      ├── html/                    # 输入：HTML文件
      │   ├── 63afa090-xxx.html
      │   ├── 324c0030-xxx.html
      │   └── ...
      └── visuals/                 # 输出：截图文件
          ├── 63afa090-xxx.png
          ├── 324c0030-xxx.png
          └── ...
```

## ⚙️ 配置选项

| 选项            | 说明           | 默认值   |
| --------------- | -------------- | -------- |
| `--workers <N>` | 并发worker数量 | 6        |
| `--headed`      | 显示浏览器窗口 | 无头模式 |

## 📊 性能优化

- **默认并发**: 6个worker同时处理
- **推荐配置**:
  - 小批量（<50个文件）: `--workers 6`
  - 中批量（50-200个文件）: `--workers 8`
  - 大批量（>200个文件）: `--workers 12`

## 🔍 工作原理

1. **扫描**: 读取 `workspace/[name]/html/` 目录下的所有 `.html` 文件
2. **截图**: 为每个 HTML 文件生成完整页面截图
3. **保存**: 截图直接保存到 `workspace/[name]/visuals/` 目录
4. **命名**: 截图文件名与 HTML 文件名相同（去掉 `.html` 后缀）

## ✨ 特性

- ✅ 支持多worker并发执行
- ✅ 完整页面截图（fullPage）
- ✅ 自动等待页面加载完成
- ✅ 错误处理和详细日志
- ✅ 进度显示
- ✅ 截图直接保存到根目录（无子文件夹）

## 📝 示例输出

```
🚀 开始批量截图...
📁 工作空间: workspace/0126-balanced
⚙️  并发数量: 6 workers
🎨 浏览器模式: 无头模式
✅ HTML目录存在: d:\...\workspace\0126-balanced\html
✅ 截图目录已创建: d:\...\workspace\0126-balanced\visuals
📊 发现 150 个HTML文件待处理

======================================================================

🎬 执行命令: npx playwright test capture-screenshots.spec.js --workers=6

Running 150 tests using 6 workers
  ✓  截图 [1/150]: 324c0030-fa73-11f0-a9d0-d7a1991987c6.html (2.3s)
  ✓  截图 [2/150]: 324c4e50-fa73-11f0-a9d0-d7a1991987c6.html (1.8s)
  ...

======================================================================

🎉 截图完成！
📸 截图保存在: d:\...\workspace\0126-balanced\visuals
✨ 所有截图已成功生成
```

## 🛠️ 故障排除

### 问题：HTML目录不存在

**错误信息**: `❌ HTML目录不存在`

**解决方法**:

- 检查工作空间路径是否正确
- 确保路径中包含 `html` 子目录
- 使用相对路径，如 `workspace/0126-balanced`

### 问题：部分截图失败

**可能原因**:

- HTML文件加载超时
- 页面包含复杂动画或大量资源

**解决方法**:

- 减少并发worker数量（如 `--workers 2`）
- 使用 `--headed` 模式观察失败原因

### 问题：速度太慢

**优化建议**:

- 增加worker数量（如 `--workers 12`）
- 检查是否有过大的HTML文件
- 关闭其他占用CPU的程序

## 📦 依赖

- Node.js (v16+)
- @playwright/test
- Chromium浏览器（Playwright自动安装）

## 💡 提示

- 截图质量: PNG格式，完整页面
- 视口大小: 1920x1080（在 playwright.config.js 中配置）
- 超时设置: 15秒页面加载 + 5秒截图
- 截图命名: 与HTML文件名完全一致（不含.html）
