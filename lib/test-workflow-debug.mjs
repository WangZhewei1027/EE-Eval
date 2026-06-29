#!/usr/bin/env node
import "dotenv/config";
import { callAIStream } from "./ai-api.mjs";

async function testWorkflow() {
  console.log("测试完整的 HTML 生成工作流...\n");

  const model = "Qwen1.5-0.5B-Chat";
  const userPrompt = "Array";
  const systemPrompt =
    "Generate a single HTML file with JavaScript demonstrating the user-given concept. Only respond in a single HTML file.";

  console.log("配置:");
  console.log("  模型:", model);
  console.log("  问题:", userPrompt);
  console.log("");

  try {
    console.log("开始调用 API...");
    const stream = await callAIStream(model, userPrompt, systemPrompt);

    console.log("✓ 流创建成功，开始接收内容...\n");

    let fullContent = "";
    let chunkCount = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullContent += content;
        chunkCount++;
        process.stdout.write(content);
      }
    }

    console.log("\n\n" + "=".repeat(70));
    console.log("✅ 成功!");
    console.log("  接收到", chunkCount, "个数据块");
    console.log("  总长度:", fullContent.length, "字符");
    console.log("  前100字符:", fullContent.substring(0, 100));
    console.log("=".repeat(70));
  } catch (error) {
    console.log("\n" + "=".repeat(70));
    console.error("❌ 失败!");
    console.error("  错误类型:", error.name);
    console.error("  错误信息:", error.message);
    console.error("  错误代码:", error.code);

    if (error.cause) {
      console.error("  错误原因:", error.cause);
    }

    if (error.response) {
      console.error("  API 响应:", {
        status: error.response.status,
        statusText: error.response.statusText,
      });
    }

    console.error("\n完整错误对象:");
    console.error(error);

    console.error("\n堆栈跟踪:");
    console.error(error.stack);
    console.log("=".repeat(70));
    process.exit(1);
  }
}

testWorkflow();
