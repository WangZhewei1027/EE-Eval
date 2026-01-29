#!/usr/bin/env node

/**
 * 批量截图工具 - 对指定工作空间的所有HTML文件进行截图
 *
 * 使用方法:
 *   node capture-screenshots.mjs <workspace-path>
 *
 * 示例:
 *   node capture-screenshots.mjs workspace/0126-balanced
 *   node capture-screenshots.mjs workspace/vlm-test
 *
 * 功能:
 *   - 自动扫描 workspace/<name>/html 下的所有 .html 文件
 *   - 每个HTML文件截取一张完整页面截图
 *   - 截图保存到 workspace/<name>/visuals/ 目录
 *   - 截图文件名与HTML文件名相同（不含.html扩展名）
 *   - 支持多worker并发执行，提升效率
 */

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 解析命令行参数
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   📸 批量截图工具                              ║
╠════════════════════════════════════════════════════════════════╣
║  使用方法:                                                     ║
║    node capture-screenshots.mjs <workspace-path>               ║
║                                                                ║
║  示例:                                                         ║
║    node capture-screenshots.mjs workspace/0126-balanced        ║
║    node capture-screenshots.mjs workspace/vlm-test             ║
║                                                                ║
║  选项:                                                         ║
║    --workers <N>    设置并发worker数量 (默认: 6)               ║
║    --headed         显示浏览器窗口 (默认: 无头模式)             ║
╚════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

// 解析参数
let workspacePath = args[0];
let workers = 6; // 默认6个worker并发
let headed = false;

// 处理可选参数
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--workers" && args[i + 1]) {
    workers = parseInt(args[i + 1]);
    i++; // 跳过下一个参数
  } else if (args[i] === "--headed") {
    headed = true;
  }
}

// 规范化路径（移除末尾的斜杠）
workspacePath = workspacePath.replace(/[\/\\]+$/, "");

console.log(`🚀 开始批量截图...`);
console.log(`📁 工作空间: ${workspacePath}`);
console.log(`⚙️  并发数量: ${workers} workers`);
console.log(`🎨 浏览器模式: ${headed ? "显示窗口" : "无头模式"}`);

// 验证工作空间路径
const htmlDir = path.join(__dirname, workspacePath, "html");
const visualsDir = path.join(__dirname, workspacePath, "visuals");

try {
  await fs.access(htmlDir);
  console.log(`✅ HTML目录存在: ${htmlDir}`);
} catch (error) {
  console.error(`❌ HTML目录不存在: ${htmlDir}`);
  console.error(`   请确认工作空间路径是否正确`);
  process.exit(1);
}

// 确保visuals目录存在
try {
  await fs.mkdir(visualsDir, { recursive: true });
  console.log(`✅ 截图目录已创建: ${visualsDir}`);
} catch (error) {
  console.error(`❌ 无法创建截图目录: ${error.message}`);
  process.exit(1);
}

// 统计HTML文件数量
try {
  const files = await fs.readdir(htmlDir);
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  console.log(`📊 发现 ${htmlFiles.length} 个HTML文件待处理`);

  if (htmlFiles.length === 0) {
    console.log(`⚠️  没有找到HTML文件，退出`);
    process.exit(0);
  }
} catch (error) {
  console.error(`❌ 读取HTML目录失败: ${error.message}`);
  process.exit(1);
}

console.log(`\n${"=".repeat(70)}\n`);

// 构建Playwright命令
const playwrightArgs = [
  "playwright",
  "test",
  "capture-screenshots.spec.js",
  `--workers=${workers}`,
];

if (headed) {
  playwrightArgs.push("--headed");
}

// 设置环境变量传递工作空间路径
const env = {
  ...process.env,
  SCREENSHOT_WORKSPACE: workspacePath,
};

console.log(`🎬 执行命令: npx ${playwrightArgs.join(" ")}`);
console.log();

// 运行Playwright测试
const playwrightProcess = spawn("npx", playwrightArgs, {
  cwd: __dirname,
  stdio: "inherit",
  shell: true,
  env: env,
});

playwrightProcess.on("close", (code) => {
  console.log(`\n${"=".repeat(70)}\n`);

  if (code === 0) {
    console.log(`🎉 截图完成！`);
    console.log(`📸 截图保存在: ${visualsDir}`);
    console.log(`\n✨ 所有截图已成功生成`);
  } else {
    console.error(`❌ 进程退出，代码: ${code}`);
    console.error(`   部分截图可能失败，请查看上方日志`);
    process.exit(code);
  }
});

playwrightProcess.on("error", (error) => {
  console.error(`❌ 进程执行错误:`, error);
  process.exit(1);
});
