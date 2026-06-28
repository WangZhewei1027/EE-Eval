import { promises as fs } from "fs";
import process from "node:process";
import { runWorkflow } from "./workflow.mjs";

// 读取模型列表 - 使用绝对路径解决导入问题
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const modelListPath = join(__dirname, "..", "model-list.json");
const modelListData = await fs.readFile(modelListPath, "utf-8");
const modelList = JSON.parse(modelListData);

// saveResult 函数已被 workflow.mjs 中的 saveWorkflowResults 替代
// 保留此函数以兼容旧代码
export async function saveResult(data, workspace, taskId = null, options = {}) {
  console.warn("saveResult 已废弃，请使用 workflow.mjs 中的 runWorkflow");
  return null;
}

export async function processTask(task, options = {}) {
  const {
    showProgress = false,
    taskId = null,
    enableFSM = true,
    enableTests = false,
  } = options;
  const { workspace, model, question, system, topic, models } = task;

  // 使用新的工作流引擎
  const result = await runWorkflow(
    {
      question,
      workspace,
      model,
      topic,
      systemPrompt: system,
      models: {
        html: model,
        fsm: models?.fsmAgent || model,
        playwright: models?.testAgent || model,
      },
    },
    {
      showProgress,
      enableFSM,
      enableTests,
      taskId,
    },
  );

  if (result.success) {
    return {
      success: true,
      resultId: result.resultId,
      url: result.htmlUrl,
      hasFSM: !!result.fsmData,
      fsmData: result.fsmData,
      hasTest: !!result.testCode,
      testFileName: result.testFileName,
    };
  } else {
    return {
      success: false,
      error: result.error,
      resultId: result.resultId,
    };
  }
}

export { modelList };
