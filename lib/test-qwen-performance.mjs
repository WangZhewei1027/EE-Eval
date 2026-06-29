#!/usr/bin/env node
import "dotenv/config";

// 测试 Qwen API 的响应时间和输出
async function testQwenPerformance() {
  const endpoint =
    "https://lgcrae6t7194vp8o.us-east-1.aws.endpoints.huggingface.cloud";

  const testCases = [
    {
      name: "简单测试 (max_tokens=100)",
      inputs: "Hello, how are you?",
      max_tokens: 100,
    },
    {
      name: "中等复杂度 (max_tokens=500)",
      inputs: "Generate a simple HTML page with a button",
      max_tokens: 500,
    },
    {
      name: "复杂测试 (max_tokens=2000) - Dijkstra's Algorithm",
      inputs: `<|im_start|>system
Generate a single HTML file with JavaScript demonstrating the user-given concept. Only respond in a single HTML file.<|im_end|>
<|im_start|>user
Dijkstra's Algorithm<|im_end|>
<|im_start|>assistant
`,
      max_tokens: 2000,
    },
  ];

  for (const testCase of testCases) {
    console.log("\n" + "=".repeat(70));
    console.log(`测试: ${testCase.name}`);
    console.log("=".repeat(70));

    const startTime = Date.now();

    try {
      console.log("发送请求...");
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          inputs: testCase.inputs,
          parameters: {
            max_new_tokens: testCase.max_tokens,
            temperature: 0.7,
            return_full_text: false,
            do_sample: true,
            top_p: 0.9,
            repetition_penalty: 1.1,
          },
        }),
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`响应时间: ${elapsed}秒`);
      console.log(`状态码: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ 错误: ${errorText}`);
        continue;
      }

      const result = await response.json();
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (Array.isArray(result) && result[0]) {
        const generatedText = result[0].generated_text;
        console.log(`✅ 成功! 总耗时: ${totalTime}秒`);
        console.log(`生成长度: ${generatedText.length} 字符`);
        console.log(`前200字符: ${generatedText.substring(0, 200)}...`);
      } else {
        console.log(`⚠️  意外的响应格式:`, result);
      }
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`❌ 失败 (${elapsed}秒):`, error.message);
    }
  }

  console.log("\n" + "=".repeat(70));
}

testQwenPerformance();
