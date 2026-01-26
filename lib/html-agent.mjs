import "dotenv/config";
import process from "node:process";
import { callAIStream } from "./ai-api.mjs";

/**
 * HTML 生成 Agent
 * 负责根据用户需求生成交互式 HTML 可视化
 * @param {string} model - 模型名称
 * @param {string} userPrompt - 用户提示
 * @param {string} systemPrompt - 系统提示（可选）
 * @param {object} options - 配置选项
 * @param {boolean} options.showProgress - 是否显示进度
 * @param {string} options.taskId - 任务 ID
 * @returns {Promise<object>} 包含生成结果的对象
 */
export async function generateHTML(
  model,
  userPrompt,
  systemPrompt = null,
  options = {},
) {
  const { showProgress = false, taskId = null } = options;

  // const defaultSystemPrompt =
  //   "Generate a single HTML file with JavaScript demonstrating the user-given concept. Only respond in a single HTML file.";

  // 使用流式输出
  const stream = await callAIStream(model, userPrompt, systemPrompt);

  let fullContent = "";

  if (showProgress) {
    console.log(`\n[${taskId || "HTML"}] 开始生成内容...\n`);
  }

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      fullContent += content;
      // 只在显示进度时输出到控制台
      if (showProgress) {
        process.stdout.write(content);
      }
    }
  }

  if (showProgress) {
    console.log(`\n\n[${taskId || "HTML"}] 生成完成！\n`);
  }

  const assistantMessage = {
    role: "assistant",
    content: fullContent,
  };

  if (!assistantMessage?.content) {
    throw new Error("No content generated from streaming response.");
  }

  return extractHTMLContent(assistantMessage.content);
}

/**
 * 从 AI 响应中提取 HTML 内容
 */
export function extractHTMLContent(rawContent) {
  const htmlMatch = rawContent.match(/<html[\s\S]*?<\/html>/i);
  return htmlMatch ? htmlMatch[0] : rawContent;
}
