import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";
import "dotenv/config";

// 配置OpenAI客户端 - 使用与add-core相同的配置
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

/**
 * 视觉评估器 - 分析HTML应用的截图和交互流程
 */
class VisualEvaluator {
  constructor() {
    this.workspacePath = "./workspace";
  }

  /**
   * 评估指定HTML文件的视觉质量和交互流程
   * @param {string} workspace - 工作空间名称
   * @param {string} htmlFileName - HTML文件名（不含扩展名）
   * @returns {Promise<Object>} 评估结果
   */
  async evaluateHtmlFile(workspace, htmlFileName) {
    console.log(`🔍 开始评估: ${workspace}/${htmlFileName}`);

    try {
      // 1. 获取截图文件列表
      const screenshots = await this.getScreenshots(workspace, htmlFileName);
      if (screenshots.length === 0) {
        throw new Error("未找到截图文件");
      }

      // 2. 分类截图
      const categorizedScreenshots = this.categorizeScreenshots(screenshots);

      // 3. 读取HTML内容获取应用信息
      const htmlContent = await this.getHtmlContent(workspace, htmlFileName);
      const appInfo = this.extractAppInfo(htmlContent);

      // 4. 生成AI评估
      const evaluation = await this.generateAIEvaluation(
        categorizedScreenshots,
        appInfo,
        workspace,
        htmlFileName
      );

      // 5. 保存评估结果
      await this.saveEvaluation(workspace, htmlFileName, evaluation);

      console.log(`✅ 评估完成: ${workspace}/${htmlFileName}`);
      return evaluation;
    } catch (error) {
      console.error(`❌ 评估失败: ${workspace}/${htmlFileName}`, error);
      throw error;
    }
  }

  /**
   * 获取截图文件列表
   */
  async getScreenshots(workspace, htmlFileName) {
    const screenshotsDir = path.join(
      this.workspacePath,
      workspace,
      "visuals",
      htmlFileName
    );

    try {
      const files = await fs.readdir(screenshotsDir);
      return files
        .filter((file) => file.endsWith(".png"))
        .map((file) => ({
          filename: file,
          path: path.join(screenshotsDir, file),
          relativePath: `./workspace/${workspace}/visuals/${htmlFileName}/${file}`,
        }))
        .sort((a, b) => a.filename.localeCompare(b.filename));
    } catch (error) {
      console.warn(`⚠️ 无法读取截图目录: ${screenshotsDir}`);
      return [];
    }
  }

  /**
   * 分类截图
   */
  categorizeScreenshots(screenshots) {
    const categories = {
      initial: [],
      complete: [],
      interaction: [],
      error: [],
      all: screenshots,
    };

    screenshots.forEach((screenshot) => {
      const filename = screenshot.filename.toLowerCase();

      if (filename.includes("initial") || filename.includes("empty")) {
        categories.initial.push(screenshot);
      } else if (filename.includes("complete") || filename.includes("final")) {
        categories.complete.push(screenshot);
      } else if (filename.includes("error") || filename.includes("alert")) {
        categories.error.push(screenshot);
      } else {
        categories.interaction.push(screenshot);
      }
    });

    return categories;
  }

  /**
   * 读取HTML内容
   */
  async getHtmlContent(workspace, htmlFileName) {
    const htmlPath = path.join(
      this.workspacePath,
      workspace,
      "html",
      `${htmlFileName}.html`
    );

    try {
      return await fs.readFile(htmlPath, "utf-8");
    } catch (error) {
      console.warn(`⚠️ 无法读取HTML文件: ${htmlPath}`);
      return "";
    }
  }

  /**
   * 提取应用信息
   */
  extractAppInfo(htmlContent) {
    const info = {
      title: "",
      description: "",
      fsmConfig: null,
      interactionElements: [],
    };

    // 提取标题
    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
    if (titleMatch) {
      info.title = titleMatch[1];
    }

    // 提取FSM配置
    const fsmMatch = htmlContent.match(
      /<script[^>]*type=['"]application\/json['"][^>]*>([\s\S]*?)<\/script>/
    );
    if (fsmMatch) {
      try {
        info.fsmConfig = JSON.parse(fsmMatch[1]);
      } catch (error) {
        console.warn("⚠️ FSM配置解析失败");
      }
    }

    // 提取交互元素
    const buttonMatches =
      htmlContent.match(/<button[^>]*>([^<]*)<\/button>/g) || [];
    const inputMatches = htmlContent.match(/<input[^>]*>/g) || [];

    info.interactionElements = [
      ...buttonMatches.map((btn) => btn.replace(/<[^>]*>/g, "").trim()),
      ...inputMatches.map(() => "input field"),
    ];

    return info;
  }

  /**
   * 生成AI评估
   */
  async generateAIEvaluation(screenshots, appInfo, workspace, htmlFileName) {
    console.log(`📋 准备评估: 共${screenshots.all.length}张截图`);

    if (screenshots.all.length === 0) {
      throw new Error("没有找到截图文件");
    }

    // 智能选择截图：优先选择initial和complete状态的截图
    const selectedScreenshots = [];

    // 1. 选择所有包含"initial"的截图
    const initialScreenshots = screenshots.all.filter((screenshot) =>
      screenshot.filename.toLowerCase().includes("initial")
    );

    // 2. 选择所有包含"complete"的截图
    const completeScreenshots = screenshots.all.filter((screenshot) =>
      screenshot.filename.toLowerCase().includes("complete")
    );

    console.log(`� 找到 ${initialScreenshots.length} 张初始状态截图`);
    console.log(`🔍 找到 ${completeScreenshots.length} 张完成状态截图`);

    // 3. 优先添加initial截图（最多2张）
    if (initialScreenshots.length > 0) {
      const selectedInitial = initialScreenshots.slice(0, 2);
      selectedScreenshots.push(...selectedInitial);
      selectedInitial.forEach((s) => {
        console.log(`📸 选择初始状态截图: ${s.filename}`);
      });
    }

    // 4. 添加complete截图（最多2张）
    if (completeScreenshots.length > 0) {
      const selectedComplete = completeScreenshots.slice(0, 2);
      selectedScreenshots.push(...selectedComplete);
      selectedComplete.forEach((s) => {
        console.log(`📸 选择完成状态截图: ${s.filename}`);
      });
    }

    // 5. 如果没有找到initial或complete，回退到原有逻辑
    if (selectedScreenshots.length === 0) {
      console.log(`⚠️ 未找到initial或complete截图，使用备选方案`);

      // 使用原有的分类截图逻辑作为备选
      if (screenshots.initial.length > 0) {
        selectedScreenshots.push(screenshots.initial[0]);
        console.log(
          `📸 备选：使用分类的初始状态截图: ${screenshots.initial[0].filename}`
        );
      }

      if (screenshots.complete.length > 0) {
        selectedScreenshots.push(screenshots.complete[0]);
        console.log(
          `📸 备选：使用分类的完成状态截图: ${screenshots.complete[0].filename}`
        );
      } else if (screenshots.interaction.length > 0) {
        selectedScreenshots.push(screenshots.interaction[0]);
        console.log(
          `📸 备选：使用交互过程截图: ${screenshots.interaction[0].filename}`
        );
      }
    }

    // 6. 最后的保底措施：如果还是没有截图，使用第一张
    if (selectedScreenshots.length === 0) {
      selectedScreenshots.push(screenshots.all[0]);
      console.log(`📸 保底：使用第一张截图: ${screenshots.all[0].filename}`);
    }

    console.log(`📸 总共选择了 ${selectedScreenshots.length} 张截图进行评估`);

    // 读取选中的图片
    const imageDataUris = [];
    for (const screenshot of selectedScreenshots) {
      try {
        const imageBuffer = await fs.readFile(screenshot.path);
        const base64Image = imageBuffer.toString("base64");
        const imageDataUri = `data:image/png;base64,${base64Image}`;
        imageDataUris.push({
          filename: screenshot.filename,
          dataUri: imageDataUri,
        });
        console.log(
          `✅ 图片 ${screenshot.filename} 已转换为base64，长度: ${imageDataUri.length}`
        );
      } catch (error) {
        console.warn(`⚠️ 无法读取图片 ${screenshot.path}: ${error.message}`);
      }
    }

    if (imageDataUris.length === 0) {
      throw new Error("无法读取任何图片文件");
    } // 优化的评估提示
    const screenshotsList = imageDataUris.map((img) => img.filename).join(", ");
    const prompt = `请分析这些HTML交互应用的截图，并给出评估：

应用信息：
- 标题: ${appInfo.title || "未知"}
- 截图文件: ${screenshotsList}
- 截图数量: ${imageDataUris.length} 张

请从以下维度评估(每项1-10分)：
1. 布局质量：页面元素排列是否合理，视觉层次是否清晰
2. 内容丰富度：信息展示是否完整，功能是否实用
3. 交互逻辑：界面是否直观易用，状态变化是否清晰

通过对比多张截图，特别关注：
- 初始状态与完成状态的对比
- 交互过程中的状态转换
- 用户体验的连贯性

请返回JSON格式：
{
  "overall_score": 总体评分(1-10),
  "layout_quality": 布局质量评分(1-10),
  "content_richness": 内容丰富度评分(1-10), 
  "interaction_logic": 交互逻辑评分(1-10),
  "analysis": "详细分析文本，包括多张截图的对比观察"
}`;

    try {
      console.log("📤 发送API请求...");

      // 构建输入内容，包含文本和多张图片
      const inputContent = [{ type: "input_text", text: prompt }];

      // 添加所有选中的图片
      for (const imageData of imageDataUris) {
        inputContent.push({
          type: "input_image",
          image_url: imageData.dataUri,
        });
      }

      const input = [
        {
          role: "user",
          content: inputContent,
        },
      ];

      const response = await client.responses.create({
        model: "gpt-4o-mini",
        input: input,
      });

      console.log(`✅ API调用成功`);

      // 解析响应（使用与test-image-understanding相同的方法）
      let aiAnalysis = "";
      if (Array.isArray(response.output)) {
        for (const out of response.output) {
          if (out.content && Array.isArray(out.content)) {
            for (const c of out.content) {
              if (c.type === "output_text" && c.text) {
                aiAnalysis += c.text + "\n";
              }
            }
          }
        }
      }

      aiAnalysis = aiAnalysis.trim();

      if (!aiAnalysis) {
        throw new Error("API没有返回文本内容");
      }

      console.log(`✅ 成功提取文本输出，长度: ${aiAnalysis.length}`);
      console.log(`📝 API响应内容预览: ${aiAnalysis.substring(0, 200)}...`);

      // 解析AI返回的JSON
      let evaluationResult;
      try {
        // 尝试提取JSON部分
        const jsonMatch = aiAnalysis.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          evaluationResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("响应中没有找到JSON格式");
        }
      } catch (parseError) {
        console.log(`⚠️ JSON解析失败，使用默认结构: ${parseError.message}`);
        // 如果解析失败，创建默认结构
        evaluationResult = {
          overall_score: 7.0,
          layout_quality: 7.0,
          content_richness: 7.0,
          interaction_logic: 7.0,
          analysis: aiAnalysis,
          parse_error: parseError.message,
        };
      }

      // 添加元数据
      evaluationResult.metadata = {
        workspace,
        htmlFileName,
        evaluatedAt: new Date().toISOString(),
        screenshotsUsed: imageDataUris.map((img) => img.filename),
        totalScreenshots: screenshots.all.length,
        appTitle: appInfo.title,
        hasFSM: !!appInfo.fsmConfig,
        interactionElements: appInfo.interactionElements.length,
      };

      console.log(
        `🎉 评估完成，总分: ${evaluationResult.overall_score}，使用了 ${imageDataUris.length} 张截图`
      );
      return evaluationResult;
    } catch (error) {
      console.error("❌ AI评估失败:", error);

      // 返回错误状态的评估
      return {
        overall_score: 0,
        layout_quality: 0,
        content_richness: 0,
        interaction_logic: 0,
        analysis: `评估失败: ${error.message}`,
        error: error.message,
        metadata: {
          workspace,
          htmlFileName,
          evaluatedAt: new Date().toISOString(),
          screenshotsUsed: imageDataUris.map((img) => img.filename),
          totalScreenshots: screenshots.all.length,
          appTitle: appInfo.title,
          hasFSM: !!appInfo.fsmConfig,
          interactionElements: appInfo.interactionElements.length,
        },
      };
    }
  }

  /**
   * 生成评估提示词
   */
  generateEvaluationPrompt(screenshots, appInfo) {
    return `你是一个专业的UI/UX评估专家。请分析以下HTML交互应用的截图，并从以下维度进行评估：

应用信息：
- 标题: ${appInfo.title || "未知"}
- FSM配置: ${appInfo.fsmConfig ? "是" : "否"}
- 交互元素: ${appInfo.interactionElements.join(", ") || "无"}

截图分类：
- 初始状态截图: ${screenshots.initial.length} 张
- 完成状态截图: ${screenshots.complete.length} 张  
- 交互过程截图: ${screenshots.interaction.length} 张
- 错误状态截图: ${screenshots.error.length} 张
- 总计: ${screenshots.all.length} 张

请从以下维度评估(每项1-10分)：

1. **布局质量 (layout_quality)**：
   - 页面元素排列的合理性
   - 视觉层次和对比度
   - 响应式设计和空间利用
   - 色彩搭配和视觉美观

2. **内容丰富度 (content_richness)**：
   - 信息展示的完整性
   - 交互元素的多样性
   - 功能的实用性和教育价值
   - 用户引导和说明的充分性

3. **交互逻辑 (interaction_logic)**：
   - 操作流程的连贯性和逻辑性
   - 状态转换的清晰度
   - 用户反馈的及时性
   - 错误处理的合理性

请返回以下JSON格式的评估结果：

{
  "overall_score": 总体评分(1-10),
  "layout_quality": 布局质量评分(1-10),
  "content_richness": 内容丰富度评分(1-10), 
  "interaction_logic": 交互逻辑评分(1-10),
  "analysis": "详细分析文本，包括优点、缺点和改进建议",
  "strengths": ["优点1", "优点2", "优点3"],
  "weaknesses": ["缺点1", "缺点2"],
  "recommendations": ["建议1", "建议2", "建议3"]
}

请仔细观察截图中的细节，特别关注：
- 初始状态的布局完整性
- 交互过程中的状态变化
- 完成状态的信息展示
- 整体用户体验的流畅性`;
  }

  /**
   * 准备图片数据用于AI分析 - 使用正确的API格式
   */
  async prepareImageData(screenshots) {
    const imageData = [];

    // 选择关键截图进行分析（避免过多图片）
    const keyScreenshots = [
      ...screenshots.initial.slice(0, 2), // 最多2张初始状态
      ...screenshots.interaction.slice(0, 8), // 最多8张交互过程
      ...screenshots.complete.slice(0, 2), // 最多2张完成状态
      ...screenshots.error.slice(0, 1), // 最多1张错误状态
    ];

    for (const screenshot of keyScreenshots) {
      try {
        const imageBuffer = await fs.readFile(screenshot.path);
        const base64Image = imageBuffer.toString("base64");

        // 使用正确的API图片格式（参考analyze-visual.mjs）
        imageData.push({
          type: "input_image",
          image_url: `data:image/png;base64,${base64Image}`,
        });
      } catch (error) {
        console.warn(`⚠️ 无法读取图片: ${screenshot.path}`);
      }
    }

    return imageData;
  }

  /**
   * 保存评估结果
   */
  async saveEvaluation(workspace, htmlFileName, evaluation) {
    const evaluationDir = path.join(this.workspacePath, workspace, "data");
    const evaluationPath = path.join(
      evaluationDir,
      `${htmlFileName}_evaluation.json`
    );

    try {
      // 确保目录存在
      await fs.mkdir(evaluationDir, { recursive: true });

      // 保存评估结果
      await fs.writeFile(
        evaluationPath,
        JSON.stringify(evaluation, null, 2),
        "utf-8"
      );

      console.log(`💾 评估结果已保存: ${evaluationPath}`);
    } catch (error) {
      console.error(`❌ 保存评估结果失败:`, error);
      throw error;
    }
  }

  /**
   * 批量评估工作空间中的所有HTML文件
   */
  async evaluateWorkspace(workspace) {
    console.log(`🚀 开始批量评估工作空间: ${workspace}`);

    try {
      const htmlDir = path.join(this.workspacePath, workspace, "html");
      const htmlFiles = await fs.readdir(htmlDir);

      const results = [];

      for (const file of htmlFiles) {
        if (file.endsWith(".html")) {
          const htmlFileName = file.replace(".html", "");
          try {
            const evaluation = await this.evaluateHtmlFile(
              workspace,
              htmlFileName
            );
            results.push({
              file: htmlFileName,
              status: "success",
              evaluation,
            });
          } catch (error) {
            results.push({
              file: htmlFileName,
              status: "error",
              error: error.message,
            });
          }
        }
      }

      console.log(`✅ 批量评估完成: ${results.length} 个文件`);
      return results;
    } catch (error) {
      console.error(`❌ 批量评估失败:`, error);
      throw error;
    }
  }
}

// 命令行使用
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  console.log("🚀 启动visual-evaluator...");

  const evaluator = new VisualEvaluator();

  const args = process.argv.slice(2);
  console.log("📝 命令行参数:", args);

  if (args.length < 1) {
    console.log(`
使用方法:
  node visual-evaluator.mjs <workspace> [htmlFileName]
  
示例:
  node visual-evaluator.mjs vlm-test                           # 评估整个工作空间
  node visual-evaluator.mjs vlm-test 65f023a0-b408-11f0...    # 评估单个文件
`);
    process.exit(1);
  }

  const workspace = args[0];
  const htmlFileName = args[1];

  console.log(`🎯 工作空间: ${workspace}`);
  console.log(`📄 HTML文件: ${htmlFileName || "(批量评估)"}`);

  (async () => {
    try {
      if (htmlFileName) {
        // 评估单个文件
        console.log(`🚀 开始评估: ${workspace}/${htmlFileName}`);
        const result = await evaluator.evaluateHtmlFile(
          workspace,
          htmlFileName
        );
        console.log("📊 评估结果:", JSON.stringify(result, null, 2));
      } else {
        // 评估整个工作空间
        console.log(`🚀 开始批量评估工作空间: ${workspace}`);
        const results = await evaluator.evaluateWorkspace(workspace);
        console.log("📊 批量评估结果:", JSON.stringify(results, null, 2));
      }
    } catch (error) {
      console.error("💥 执行失败:", error.message);
      console.error("详细错误:", error);
      process.exit(1);
    }
  })();
}

export default VisualEvaluator;
