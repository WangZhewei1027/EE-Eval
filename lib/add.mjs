#!/usr/bin/env node
/**
 * Add.mjs - 交互式 HTML 可视化生成工具
 *
 * 工作流：HTML Agent → FSM Agent → Playwright Agent
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import process from "node:process";
import { processTask, modelList } from "./add-core.mjs";

// ==================== 工具函数 ====================

/**
 * 创建命令行输入接口
 */
async function userInput(query) {
  const rl = createInterface({ input, output });
  try {
    return await rl.question(query);
  } finally {
    rl.close();
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║  Add.mjs - 交互式 HTML 可视化生成工具                                  ║
╚════════════════════════════════════════════════════════════════════════╝

使用方法: node add.mjs [选项]

基本选项:
  -w, --workspace <name>    工作空间名称 (默认: default)
  -m, --model <model>       统一模型名称或编号 (默认: 交互式选择)
  -q, --question <text>     问题/需求描述
  -t, --topic <text>        主题名称 (用于 FSM 和文件命名)
  -s, --system <text>       自定义系统提示词
  -h, --help               显示此帮助信息

模型选择选项:
  --html-model <model>      HTML Agent 专用模型
  --fsm-model <model>       FSM Agent 专用模型 
  --test-model <model>      Playwright Agent 专用模型

工作流选项:
  --no-fsm                 禁用 FSM 生成 (默认启用)
  --enable-tests           启用 Playwright 测试生成 (默认禁用)

═══════════════════════════════════════════════════════════════════════

📋 工作流说明:

  1. HTML Agent: 生成交互式 HTML 可视化
  2. FSM Agent: 分析 HTML 并生成有限状态机定义 (可选)
  3. Playwright Agent: 基于 FSM 生成端到端测试 (可选)

═══════════════════════════════════════════════════════════════════════

📝 使用示例:

  1. 快速生成 HTML:
     node add.mjs -w "test" -m 1 -q "创建冒泡排序可视化"

  2. 生成 HTML + FSM:
     node add.mjs -q "创建二叉搜索树" -t "BST"

  3. 生成完整套件 (HTML + FSM + 测试):
     node add.mjs -q "创建快速排序" -t "Quick Sort" --enable-tests

  4. 仅生成 HTML，不生成 FSM:
     node add.mjs -q "创建一个计算器" --no-fsm

  5. 三个Agent使用不同模型:
     node add.mjs -q "算法可视化" --html-model gpt-4o --fsm-model claude-3-5-sonnet-20241022 --test-model gpt-4o-mini

  6. 交互式模式:
     node add.mjs

═══════════════════════════════════════════════════════════════════════

🤖 可用模型:
${modelList.map((model, index) => `  ${index + 1}. ${model}`).join("\n")}

═══════════════════════════════════════════════════════════════════════
`);
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    workspace: null,
    model: null,
    htmlModel: null,
    fsmModel: null,
    testModel: null,
    question: null,
    system: null,
    topic: null,
    enableFSM: true,
    enableTests: true,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--workspace":
      case "-w":
        parsed.workspace = args[++i];
        break;
      case "--model":
      case "-m":
        parsed.model = args[++i];
        break;
      case "--html-model":
        parsed.htmlModel = args[++i];
        break;
      case "--fsm-model":
        parsed.fsmModel = args[++i];
        break;
      case "--test-model":
        parsed.testModel = args[++i];
        break;
      case "--question":
      case "-q":
        parsed.question = args[++i];
        break;
      case "--system":
      case "-s":
        parsed.system = args[++i];
        break;
      case "--topic":
      case "-t":
        parsed.topic = args[++i];
        break;
      case "--no-fsm":
        parsed.enableFSM = false;
        break;
      case "--enable-tests":
        parsed.enableTests = true;
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      default:
        if (!arg.startsWith("--") && !arg.startsWith("-") && !parsed.question) {
          parsed.question = arg;
        }
        break;
    }
  }

  return parsed;
}

/**
 * 选择模型
 */
async function selectModel(preSelectedModel = null, agentName = "Agent") {
  if (preSelectedModel) {
    const modelNumber = parseInt(preSelectedModel);
    if (
      !isNaN(modelNumber) &&
      modelNumber >= 1 &&
      modelNumber <= modelList.length
    ) {
      const selectedModel = modelList[modelNumber - 1];
      console.log(`✓ ${agentName} 已选择模型: ${selectedModel}`);
      return selectedModel;
    }

    if (modelList.includes(preSelectedModel)) {
      console.log(`✓ ${agentName} 已选择模型: ${preSelectedModel}`);
      return preSelectedModel;
    }

    console.log(
      `⚠️  未找到模型 "${preSelectedModel}"，将为 ${agentName} 显示选择列表\n`,
    );
  }

  console.log(`\n🤖 为 ${agentName} 选择模型：`);
  modelList.forEach((model, index) => {
    console.log(`  ${index + 1}. ${model}`);
  });
  console.log("");

  while (true) {
    const input = await userInput(
      `请为 ${agentName} 选择模型 (1-${modelList.length}): `,
    );
    const choice = parseInt(input.trim());

    if (isNaN(choice) || choice < 1 || choice > modelList.length) {
      console.log(`❌ 无效选择，请输入 1 到 ${modelList.length} 之间的数字\n`);
      continue;
    }

    const selectedModel = modelList[choice - 1];
    console.log(`✓ ${agentName} 已选择模型: ${selectedModel}\n`);
    return selectedModel;
  }
}

/**
 * 收集用户输入参数
 */
async function collectInputs(args) {
  const inputs = {};

  // 工作空间
  if (args.workspace) {
    inputs.workspace = args.workspace;
    console.log(`✓ 工作空间: ${inputs.workspace}`);
  } else {
    inputs.workspace = await userInput("📁 请输入工作空间名称: ");
  }

  // 模型配置
  if (args.htmlModel || args.fsmModel || args.testModel) {
    // 如果指定了任何单独的模型，则分别配置
    console.log("🔧 配置各Agent模型:");

    inputs.htmlModel = args.htmlModel
      ? await selectModel(args.htmlModel, "HTML Agent")
      : await selectModel(args.model, "HTML Agent");

    if (args.enableFSM) {
      inputs.fsmModel = args.fsmModel
        ? await selectModel(args.fsmModel, "FSM Agent")
        : await selectModel(args.model, "FSM Agent");
    }

    if (args.enableTests) {
      inputs.testModel = args.testModel
        ? await selectModel(args.testModel, "Playwright Agent")
        : await selectModel(args.model, "Playwright Agent");
    }
  } else {
    // 使用统一模型
    const unifiedModel = await selectModel(args.model, "所有Agent");
    inputs.htmlModel = unifiedModel;
    inputs.fsmModel = unifiedModel;
    inputs.testModel = unifiedModel;
  }

  // 问题/需求描述
  if (args.question) {
    inputs.question = args.question;
    console.log(`✓ 问题: ${inputs.question}`);
  } else {
    inputs.question = await userInput("💬 请输入问题/需求描述: ");
  }

  // 主题（可选，用于 FSM）
  if (args.topic) {
    inputs.topic = args.topic;
    console.log(`✓ 主题: ${inputs.topic}`);
  } else {
    const topicInput = await userInput("📝 请输入主题名称 (可选，回车跳过): ");
    inputs.topic = topicInput.trim() || null;
  }

  // 系统提示词
  if (args.system) {
    inputs.system = args.system;
    console.log(`✓ 使用自定义系统提示`);
  } else {
    const systemInput = await userInput(
      "⚙️  系统提示词 (可选，回车使用默认): ",
    );
    inputs.system = systemInput.trim() || null;
    if (inputs.system) {
      console.log(`✓ 使用自定义系统提示`);
    }
  }

  // FSM 和测试选项
  inputs.enableFSM = args.enableFSM;
  inputs.enableTests = args.enableTests;

  return inputs;
}

/**
 * 显示配置摘要
 */
function showConfiguration(inputs) {
  console.log("\n" + "═".repeat(70));
  console.log("📋 配置摘要");
  console.log("═".repeat(70));
  console.log(`工作空间: ${inputs.workspace}`);

  // 显示模型配置
  console.log(`HTML Agent 模型: ${inputs.htmlModel}`);
  if (inputs.enableFSM) {
    console.log(`FSM Agent 模型: ${inputs.fsmModel}`);
  }
  if (inputs.enableTests) {
    console.log(`Playwright Agent 模型: ${inputs.testModel}`);
  }

  if (inputs.topic) {
    console.log(`主题: ${inputs.topic}`);
  }
  console.log(
    `问题: ${inputs.question.substring(0, 50)}${
      inputs.question.length > 50 ? "..." : ""
    }`,
  );
  console.log(`FSM 生成: ${inputs.enableFSM ? "✓ 启用" : "✗ 禁用"}`);
  console.log(`测试生成: ${inputs.enableTests ? "✓ 启用" : "✗ 禁用"}`);
  console.log("═".repeat(70) + "\n");
}

// ==================== 主流程 ====================

/**
 * 执行工作流
 */
async function runWorkflow(inputs) {
  const task = {
    workspace: inputs.workspace,
    model: inputs.htmlModel, // 主模型使用HTML Agent模型
    question: inputs.question,
    system: inputs.system,
    topic: inputs.topic,
    models: {
      fsmAgent: inputs.fsmModel,
      testAgent: inputs.testModel,
    },
  };

  console.log("🚀 开始执行工作流 (HTML → FSM → Test)...\n");

  const result = await processTask(task, {
    showProgress: true,
    enableFSM: inputs.enableFSM,
    enableTests: inputs.enableTests,
  });

  if (result.success) {
    console.log("\n" + "═".repeat(70));
    console.log("✅ 生成成功！");
    console.log("═".repeat(70));
    if (result.hasFSM) {
      console.log("✓ HTML 文件已生成 (包含 FSM)");
    } else {
      console.log("✓ HTML 文件已生成");
    }
    if (inputs.enableTests && result.testPath) {
      console.log(`✓ 测试文件: ${result.testPath}`);
    }
    console.log("\n🌐 打开以下链接查看效果:");
    console.log(`   ${result.url}`);
    console.log("═".repeat(70) + "\n");
  } else {
    console.error("\n❌ 任务执行失败:", result.error);
    throw new Error(result.error);
  }

  return result;
}

/**
 * 主函数
 */
async function main() {
  try {
    const args = parseArgs();

    if (args.help) {
      showHelp();
      return;
    }

    // 收集输入
    const inputs = await collectInputs(args);

    // 显示配置
    showConfiguration(inputs);

    // 执行工作流
    await runWorkflow(inputs);
  } catch (err) {
    console.error("\n❌ 执行过程中出现错误:");
    console.error(err.message);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// 执行主函数
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
