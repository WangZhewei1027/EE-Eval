# 修复 LaTeX "boxplot prepared" 错误

## 问题原因

箱线图需要加载 `pgfplots` 包的 **`statistics` 库**。

## 解决方案

### 在paper.tex的preamble中添加这3行

在你的 `paper.tex` 文件的 **导言区**（preamble，`\documentclass` 和 `\begin{document}` 之间）添加：

```latex
% 在 \documentclass{...} 之后，\begin{document} 之前添加

% ========== 添加以下三行（缺一不可）==========
\usepackage{pgfplots}
\usepgfplotslibrary{statistics}  % 关键：boxplot prepared 需要这个库
\pgfplotsset{compat=1.18}
% ===========================================
```

### 完整示例

```latex
\documentclass[conference]{IEEEtran}  % 或者你使用的其他文档类

% 其他包
\usepackage{graphicx}
\usepackage{amsmath}
% ... 你的其他包

% ========== 箱线图必需的包 ==========
\usepackage{pgfplots}
\usepgfplotslibrary{statistics}
\pgfplotsset{compat=1.18}
% ===================================

% ===== 添加这两行 =====
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}
% ======================

\begin{document}

% 你的论文内容
% ...

% 在需要的位置插入图表
\input{boxplot-ready-to-use.tex}

\end{document}
```

### 方法2：如果使用Overleaf

1. 打开你的 `paper.tex` 文件
2. 找到 `\documentclass` 命令
3. 在 `\begin{document}` **之前** 添加：
   ```latex
   \usepackage{pgfplots}
   \pgfplotsset{compat=1.18}
   ```
4. 重新编译（Recompile）

### 方法3：最小化依赖（如果仍有问题）

如果你的LaTeX发行版较老，可能需要更新兼容性版本：

```latex
\usepackage{pgfplots}
\pgfplotsset{compat=1.16}  % 使用较低版本
```

## 验证是否成功

编译后，如果看到类似以下内容，说明成功了：

- 没有 "axis undefined" 错误
- 图表正常显示
- PDF中可以看到箱线图

## 如果还有问题

### 检查清单：

1. ✅ 确认 `\usepackage{pgfplots}` 在 `\begin{document}` **之前**
2. ✅ 确认没有拼写错误（pgfplots，不是pgfplot）
3. ✅ 确认使用的是 pdflatex 或 xelatex 编译器
4. ✅ 如果使用MiKTeX，可能需要安装 pgfplots 包

### 常见错误

❌ **错误位置**:

```latex
\begin{document}
\usepackage{pgfplots}  % 错误！这里太晚了
```

✅ **正确位置**:

```latex
\usepackage{pgfplots}  % 正确！在\begin{document}之前
\begin{document}
```

## 需要帮助？

如果以上方法都不行，请检查：

1. 你的LaTeX发行版版本（TeXLive, MiKTeX等）
2. 是否可以编译其他包含 pgfplots 的文档
3. 查看完整的错误日志（.log文件）
