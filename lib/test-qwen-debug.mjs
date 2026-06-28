import "dotenv/config";

async function testQwenAPI() {
  console.log("=".repeat(70));
  console.log("Qwen API 连接测试");
  console.log("=".repeat(70));

  // 检查环境变量
  console.log("\n1. 检查环境变量:");
  console.log(
    "   HF_TOKEN:",
    process.env.HF_TOKEN
      ? `✓ 已设置 (${process.env.HF_TOKEN.substring(0, 10)}...)`
      : "✗ 未设置"
  );

  const endpoint =
    "https://lgcrae6t7194vp8o.us-east-1.aws.endpoints.huggingface.cloud";
  console.log("\n2. 测试端点:", endpoint);

  const requestData = {
    inputs: "Can you please let us know more details about your ",
    parameters: {
      max_new_tokens: 100,
    },
  };

  console.log("\n3. 请求数据:");
  console.log(JSON.stringify(requestData, null, 2));

  try {
    console.log("\n4. 发送请求...");
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(requestData),
    });

    console.log("\n5. 响应信息:");
    console.log("   状态码:", response.status);
    console.log("   状态文本:", response.statusText);
    console.log("   Content-Type:", response.headers.get("content-type"));

    const responseText = await response.text();
    console.log("\n6. 响应内容:");
    console.log("   长度:", responseText.length, "字节");
    console.log("   内容预览:", responseText.substring(0, 500));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    const result = JSON.parse(responseText);
    console.log("\n7. ✅ 成功! 解析后的结果:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log("\n7. ❌ 失败!");
    console.error("   错误类型:", error.name);
    console.error("   错误信息:", error.message);

    if (error.cause) {
      console.error("   错误原因:", error.cause);
    }

    console.error("\n完整错误:");
    console.error(error);
  }

  console.log("\n" + "=".repeat(70));
}

testQwenAPI();
