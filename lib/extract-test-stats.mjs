#!/usr/bin/env node
import fs from "fs";
import path from "path";

/**
 * 从 test-results/results.json 提取测试统计信息并写入 data.json
 * 为每个 UUID 单独统计测试结果
 * 用法: node extract-test-stats.mjs <workspace-path>
 * 示例: node extract-test-stats.mjs workspace/11-08-0001
 */

function extractUUIDFromFile(filePath) {
  // 从文件路径中提取 UUID
  // 例如: "workspace/11-08-0001/tests/d2fd5660-bca1-11f0-9c8f-15ad551aaf30-interactive-application.spec.js"
  const match = filePath.match(
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i
  );
  return match ? match[1] : null;
}

function extractTestStats(workspacePath) {
  const resultsPath = path.join(workspacePath, "test-results", "results.json");
  const dataPath = path.join(workspacePath, "data", "data.json");

  // 检查 results.json 是否存在
  if (!fs.existsSync(resultsPath)) {
    console.error(`❌ 未找到测试结果文件: ${resultsPath}`);
    process.exit(1);
  }

  // 读取测试结果
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));

  // 按 UUID 统计测试结果
  const uuidStats = {};

  // 递归遍历套件的函数
  function processSuite(suite, uuid) {
    if (!uuid) {
      uuid = extractUUIDFromFile(suite.file);
    }

    if (!uuid) return;

    if (!uuidStats[uuid]) {
      uuidStats[uuid] = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        tests: [],
      };
    }

    // 处理当前套件的规格
    suite.specs?.forEach((spec) => {
      spec.tests?.forEach((test) => {
        uuidStats[uuid].total++;
        uuidStats[uuid].tests.push({
          title: spec.title,
          status: test.status,
        });

        if (test.status === "expected") {
          uuidStats[uuid].passed++;
        } else if (test.status === "unexpected") {
          uuidStats[uuid].failed++;
        } else if (test.status === "skipped") {
          uuidStats[uuid].skipped++;
        }
      });
    });

    // 递归处理嵌套套件
    suite.suites?.forEach((subSuite) => {
      processSuite(subSuite, uuid);
    });
  }

  // 遍历所有顶层测试套件
  results.suites?.forEach((suite) => {
    processSuite(suite, null);
  });

  // 全局统计
  const stats = results.stats || {};
  const globalStats = {
    total:
      (stats.expected || 0) + (stats.unexpected || 0) + (stats.skipped || 0),
    passed: stats.expected || 0,
    failed: stats.unexpected || 0,
    skipped: stats.skipped || 0,
    flaky: stats.flaky || 0,
    duration: stats.duration || 0,
    startTime: stats.startTime || null,
    timestamp: new Date().toISOString(),
  };

  // 计算全局得分
  globalStats.score =
    globalStats.total > 0 ? globalStats.passed / globalStats.total : 0;

  console.log("📊 全局测试统计:");
  console.log(`   总计: ${globalStats.total}`);
  console.log(`   ✅ 成功: ${globalStats.passed}`);
  console.log(`   ❌ 失败: ${globalStats.failed}`);
  console.log(`   ⏭️  跳过: ${globalStats.skipped}`);
  console.log(`   🔄 不稳定: ${globalStats.flaky}`);
  console.log(
    `   📊 得分: ${(globalStats.score * 100).toFixed(2)}% (${
      globalStats.passed
    }/${globalStats.total})`
  );
  console.log(`   ⏱️  耗时: ${(globalStats.duration / 1000).toFixed(2)}s`);

  console.log("\n📊 各 UUID 测试统计:");
  Object.entries(uuidStats).forEach(([uuid, stat]) => {
    const score =
      stat.total > 0 ? ((stat.passed / stat.total) * 100).toFixed(2) : "0.00";
    console.log(`\n   UUID: ${uuid}`);
    console.log(
      `   总计: ${stat.total} | ✅ ${stat.passed} | ❌ ${stat.failed} | ⏭️ ${stat.skipped} | 📊 ${score}% (${stat.passed}/${stat.total})`
    );
  });

  // 确保 data 目录存在
  const dataDir = path.dirname(dataPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 读取现有的 data.json（如果存在）
  let existingData = {};
  if (fs.existsSync(dataPath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    } catch (error) {
      console.warn(`⚠️  无法读取现有的 data.json，将创建新文件`);
    }
  }

  // 更新每个 UUID 对应的数据
  Object.entries(uuidStats).forEach(([uuid, stat]) => {
    // 查找对应的数据项（遍历所有键，包括数字键）
    const dataKey = Object.keys(existingData).find(
      (key) => existingData[key]?.id === uuid
    );

    if (dataKey) {
      // 只添加 testStats 字段，不改变其他数据
      existingData[dataKey].testStats = {
        total: stat.total,
        passed: stat.passed,
        failed: stat.failed,
        skipped: stat.skipped,
        score: stat.total > 0 ? stat.passed / stat.total : 0,
        timestamp: new Date().toISOString(),
      };
    }
  });

  // 只在全局级别添加统计信息（不改变数组/对象结构）
  existingData.globalTestStats = globalStats;
  existingData.lastUpdated = new Date().toISOString();

  // 写入 data.json
  fs.writeFileSync(dataPath, JSON.stringify(existingData, null, 2), "utf8");
  console.log(`\n✅ 统计信息已写入: ${dataPath}`);
}

// 主程序
const workspacePath = process.argv[2];

if (!workspacePath) {
  console.error("用法: node extract-test-stats.mjs <workspace-path>");
  console.error("示例: node extract-test-stats.mjs workspace/11-08-0001");
  process.exit(1);
}

extractTestStats(workspacePath);
