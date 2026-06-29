import { test } from "@playwright/test";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从环境变量获取工作空间路径
const WORKSPACE_PATH =
  process.env.SCREENSHOT_WORKSPACE || "workspace/0126-balanced";
const HTML_FOLDER = path.join(__dirname, WORKSPACE_PATH, "html");
const VISUALS_FOLDER = path.join(__dirname, WORKSPACE_PATH, "visuals");

console.log(`🎯 工作空间: ${WORKSPACE_PATH}`);
console.log(`📁 HTML目录: ${HTML_FOLDER}`);
console.log(`📸 截图目录: ${VISUALS_FOLDER}`);

// 确保目录存在
async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

// 获取HTML文件路径（转换为 file:// URL）
function getHtmlFilePath(htmlFilePath) {
  return `file:///${htmlFilePath.replace(/\\/g, "/")}`;
}

// 获取所有HTML文件
let htmlFiles = [];
try {
  const files = await fs.readdir(HTML_FOLDER);
  htmlFiles = files.filter((file) => file.endsWith(".html"));
  console.log(`✅ 发现 ${htmlFiles.length} 个HTML文件`);
} catch (error) {
  console.error(`❌ 无法读取HTML目录: ${HTML_FOLDER}`, error);
  process.exit(1);
}

// 确保截图目录存在
await ensureDirectory(VISUALS_FOLDER);

// 为每个HTML文件创建一个测试
htmlFiles.forEach((htmlFile, index) => {
  test(`截图 [${index + 1}/${htmlFiles.length}]: ${htmlFile}`, async ({
    page,
  }) => {
    const htmlFileName = path.basename(htmlFile, ".html");
    const htmlFilePath = path.join(HTML_FOLDER, htmlFile);

    try {
      console.log(`\n📸 [${index + 1}/${htmlFiles.length}] 处理: ${htmlFile}`);

      // 设置页面超时
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(15000);

      // 导航到HTML文件
      const htmlUrl = getHtmlFilePath(htmlFilePath);
      await page.goto(htmlUrl, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });

      // 等待页面稳定
      await page.waitForTimeout(1500);

      // 截图保存到 visuals 文件夹，直接用 html 文件名
      const screenshotPath = path.join(VISUALS_FOLDER, `${htmlFileName}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: "png",
        timeout: 5000,
      });

      console.log(`  ✅ 成功保存: ${screenshotPath}`);
    } catch (error) {
      console.error(`  ❌ 错误: ${error.message}`);
      throw error; // 抛出错误以便 Playwright 记录失败
    }
  });
});

// 如果没有HTML文件，创建一个空测试
if (htmlFiles.length === 0) {
  test("没有找到HTML文件", async () => {
    console.log("⚠️ 未找到任何HTML文件");
  });
}
