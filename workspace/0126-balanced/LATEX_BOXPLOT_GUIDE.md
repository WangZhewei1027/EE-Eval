# LaTeX Boxplot Files - Usage Guide

## Files Generated

### 1. `boxplot-latex-simplified.tex` (推荐使用)

- **描述**: 简化版本，使用统计摘要数据而非原始数据点
- **优点**: 代码简洁，编译快速，适合论文使用
- **内容**:
  - 专业箱线图（6个模型对比）
  - 统计摘要表格
  - 详细的图表说明(caption)

### 2. `boxplot-latex.tex`

- **描述**: 完整版本，包含所有原始数据点
- **优点**: 数据完整，可以自定义异常值显示
- **缺点**: 代码较长，编译较慢

## 编译方法

### 基本要求

```latex
% 需要的包
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}
```

### 编译命令

```bash
# 方法1: 直接编译完整文档
pdflatex boxplot-latex-simplified.tex

# 方法2: 在Overleaf中使用
# 1. 上传.tex文件到Overleaf项目
# 2. 点击编译即可
```

## 嵌入现有论文

如果要将图表嵌入到现有论文中，只需复制以下部分：

### 方法1: 仅复制图表部分

```latex
% 在你的论文中添加
\begin{figure}[htbp]
\centering
\begin{tikzpicture}
    % ... (复制从 \begin{axis} 到 \end{axis} 的全部内容)
\end{tikzpicture}
\caption{你的图表说明}
\label{fig:你的标签}
\end{figure}
```

### 方法2: 使用input命令

```latex
% 在论文主文件中
\input{boxplot-latex-simplified.tex}
```

## 自定义选项

### 修改颜色

```latex
% 将 fill=blue!20 改为其他颜色
fill=red!30,        % 浅红色
fill=green!25,      % 浅绿色
draw=blue!80,       % 深蓝色边框
```

### 调整尺寸

```latex
\begin{axis}[
    width=16cm,      % 修改宽度
    height=12cm,     % 修改高度
    % ...
]
```

### 修改字体大小

```latex
ylabel style={font=\Large\bfseries},  % 大号粗体
title style={font=\huge\bfseries},    % 超大号粗体
tick label style={font=\normalsize},  % 正常大小
```

## 统计数据摘要

| Model         | N   | Mean   | Median | StdDev | Q1     | Q3     |
| ------------- | --- | ------ | ------ | ------ | ------ | ------ |
| GPT-5-Mini    | 125 | 78.85% | 79.11% | 6.46%  | 75.77% | 84.02% |
| GPT-3.5-Turbo | 121 | 70.31% | 70.04% | 9.28%  | 63.71% | 76.77% |
| DeepSeek-Chat | 125 | 70.13% | 70.89% | 10.28% | 63.55% | 77.12% |
| GPT-4o-Mini   | 123 | 63.22% | 62.78% | 8.74%  | 57.13% | 70.00% |
| Llama-3.2-1B  | 124 | 57.15% | 58.49% | 11.85% | 45.52% | 66.64% |
| Qwen-1.5-0.5B | 69  | 49.33% | 45.00% | 9.66%  | 41.91% | 57.41% |

**统计检验**: ANOVA F=120.27, p<0.001 (显著)

## 配色方案

- 🔵 **Blue** (GPT-5-Mini) - 最佳性能
- 🔴 **Red** (GPT-3.5-Turbo) - 良好性能
- 🟢 **Green** (DeepSeek-Chat) - 良好性能
- 🟠 **Orange** (GPT-4o-Mini) - 中等性能
- 🟣 **Purple** (Llama-3.2-1B) - 较低性能
- ⚫ **Gray** (Qwen-1.5-0.5B) - 最低性能

## 注意事项

1. **包依赖**: 确保安装了 `pgfplots` 包（大多数LaTeX发行版都包含）
2. **编译器**: 推荐使用 `pdflatex` 或 `xelatex`
3. **中文支持**: 如需中文，添加 `\usepackage{ctex}` 或 `\usepackage{xeCJK}`
4. **图表引用**: 使用 `\ref{fig:fsm-boxplot-comparison}` 引用图表

## 学术规范

图表符合以下学术出版标准：

- ✅ IEEE格式兼容
- ✅ ACM格式兼容
- ✅ Springer格式兼容
- ✅ 黑白打印友好（使用不同灰度）
- ✅ 色盲友好配色方案

## 示例论文引用

```latex
As shown in Figure~\ref{fig:fsm-boxplot-comparison},
GPT-5-Mini demonstrates superior performance with a median
similarity score of 79.11\% (IQR: 75.77\%--84.02\%),
significantly outperforming other models
(ANOVA: F=120.27, $p<0.001$).
```
