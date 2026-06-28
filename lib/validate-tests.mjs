#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 验证并修复测试文件中的语法错误
 * 用法: node validate-tests.mjs <workspace-path>
 * 示例: node validate-tests.mjs workspace/11-08-0003
 */

/**
 * 使用 Node.js 检查文件是否有语法错误
 */
async function checkSyntaxErrors(filePath) {
  try {
    // 使用 node --check 来验证语法
    await execAsync(`node --check "${filePath}"`);
    return null;
  } catch (error) {
    return {
      message: error.message,
      stderr: error.stderr,
    };
  }
}

function validateAndFixTestFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  let fixed = content;
  let hasChanges = false;
  const errors = [];

  // 检测1: 重复声明的变量
  const lines = content.split("\n");
  const declaredVars = new Map(); // 变量名 -> 行号数组

  lines.forEach((line, index) => {
    const constMatch = line.match(/^\s*const\s+(\w+)\s*=/);
    const letMatch = line.match(/^\s*let\s+(\w+)\s*=/);
    const varMatch = constMatch || letMatch;

    if (varMatch) {
      const varName = varMatch[1];
      if (!declaredVars.has(varName)) {
        declaredVars.set(varName, []);
      }
      declaredVars.get(varName).push(index + 1);
    }
  });

  // 找出重复声明的变量
  for (const [varName, lineNumbers] of declaredVars.entries()) {
    if (lineNumbers.length > 1) {
      errors.push({
        type: "duplicate-declaration",
        variable: varName,
        lines: lineNumbers,
      });

      // 修复：重命名后续的声明
      let renameCount = 1;
      for (let i = 1; i < lineNumbers.length; i++) {
        const lineIndex = lineNumbers[i] - 1;
        const newVarName = `${varName}${renameCount}`;

        // 替换该行的声明
        lines[lineIndex] = lines[lineIndex].replace(
          new RegExp(`\\b${varName}\\b`, "g"),
          newVarName
        );

        renameCount++;
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    fixed = lines.join("\n");
  }

  // 检测3: TypeScript类型断言 (as any, as string等) - 这在.js文件中是非法的
  lines.forEach((line, index) => {
    if (line.includes(" as any") || line.includes(" as ")) {
      const asMatch = line.match(
        /\s+as\s+(any|string|number|boolean|object)\b/
      );
      if (asMatch) {
        errors.push({
          type: "typescript-type-assertion",
          line: index + 1,
          match: asMatch[0],
        });

        // 修复：移除类型断言
        lines[index] = line.replace(
          /\s+as\s+(any|string|number|boolean|object)\b/g,
          ""
        );
        hasChanges = true;
      }
    }
  });

  if (hasChanges) {
    fixed = lines.join("\n");
  }

  // 检测4: 错误的expect参数 - toContain不接受第二个参数
  lines.forEach((line, index) => {
    const toContainMatch = line.match(/\.toContain\([^)]+,\s*\{[^}]+\}\s*\)/);
    if (toContainMatch) {
      errors.push({
        type: "invalid-toContain-params",
        line: index + 1,
      });

      // 修复：移除第二个参数
      lines[index] = line.replace(
        /\.toContain\(([^,]+),\s*\{[^}]+\}\s*\)/g,
        ".toContain($1)"
      );
      hasChanges = true;
    }
  });

  if (hasChanges) {
    fixed = lines.join("\n");
  }

  // 检测5: async/await 语法错误 - 例如 (await (await ...))
  lines.forEach((line, index) => {
    const doubleAwaitMatch = line.match(/\(await\s+\(await/);
    if (doubleAwaitMatch) {
      errors.push({
        type: "double-await-parentheses",
        line: index + 1,
      });

      // 修复：简化为单个await
      lines[index] = line.replace(
        /\(await\s+\(await\s+([^)]+)\)\.([^)]+)\(\)\)/g,
        "await $1.$2()"
      );
      hasChanges = true;
    }

    // 修复：await playBtn.first(.innerText()) - 缺少对象
    const brokenFirstMatch = line.match(/await\s+(\w+)\.first\(\./);
    if (brokenFirstMatch) {
      errors.push({
        type: "broken-first-call",
        line: index + 1,
      });

      // 修复：await playBtn.first().innerText()
      lines[index] = line.replace(
        /await\s+(\w+)\.first\(\./g,
        "await $1.first()."
      );
      hasChanges = true;
    }
  });

  if (hasChanges) {
    fixed = lines.join("\n");
  }

  // 检测6: 函数参数中的TypeScript类型注解 - (s: HTMLInputElement), (text: string)
  lines.forEach((line, index) => {
    const paramTypeMatch = line.match(/\((\w+):\s*\w+\)/);
    if (paramTypeMatch && !line.includes("test(") && !line.includes("test.")) {
      errors.push({
        type: "typescript-param-type",
        line: index + 1,
      });

      // 修复：移除参数类型注解
      lines[index] = line.replace(/\((\w+):\s*[\w.]+\)/g, "($1)");
      hasChanges = true;
    }
  });

  if (hasChanges) {
    fixed = lines.join("\n");
  }

  // 检测7: test().timeout() 和 test().catch() - 这些不是有效的Playwright API
  lines.forEach((line, index) => {
    if (line.match(/^\s*\}\)\.timeout\(/)) {
      errors.push({
        type: "invalid-test-timeout",
        line: index + 1,
      });

      // 修复：移除 .timeout() 调用，使用全局配置
      lines[index] = line.replace(/\)\.timeout\(\d+\);/, ");");
      hasChanges = true;
    }

    if (line.match(/^\s*\}\)\.catch\(/)) {
      errors.push({
        type: "invalid-test-catch",
        line: index + 1,
      });

      // 修复：移除 .catch() 调用
      lines[index] = line.replace(/\)\.catch\([^{]+\{/, ");");
      hasChanges = true;
    }
  });

  if (hasChanges) {
    fixed = lines.join("\n");
  }

  // 检测2: 缺少右括号 - 改进版
  // 逐行检查每个 expect().toBe() 调用
  lines.forEach((line, index) => {
    const toBeMatch = line.match(/\.toBe\(/);
    if (toBeMatch) {
      const lineAfterToBe = line.substring(line.indexOf(".toBe("));
      const openCount = (lineAfterToBe.match(/\(/g) || []).length;
      const closeCount = (lineAfterToBe.match(/\)/g) || []).length;

      if (openCount > closeCount) {
        errors.push({
          type: "unmatched-parentheses-line",
          line: index + 1,
          open: openCount,
          close: closeCount,
        });

        // 修复：在分号前添加缺少的括号
        lines[index] = line.replace(/;(\s*\/\/.*)?$/, ")$1");
        hasChanges = true;
      }
    }
  });

  if (hasChanges) {
    fixed = lines.join("\n");
  }

  return { fixed, hasChanges, errors };
}

async function validateWorkspace(workspacePath) {
  const testsDir = path.join(workspacePath, "tests");

  if (!fs.existsSync(testsDir)) {
    console.error(`❌ 测试目录不存在: ${testsDir}`);
    process.exit(1);
  }

  const testFiles = fs
    .readdirSync(testsDir)
    .filter((f) => f.endsWith(".spec.js"));

  console.log(`📝 发现 ${testFiles.length} 个测试文件\n`);

  let fixedCount = 0;
  let errorCount = 0;
  let renamedCount = 0;
  const invalidFiles = [];

  for (const file of testFiles) {
    const filePath = path.join(testsDir, file);
    const result = validateAndFixTestFile(filePath);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  ${file}:`);
      result.errors.forEach((error) => {
        if (error.type === "duplicate-declaration") {
          console.log(
            `   - 重复声明变量 '${error.variable}' (行 ${error.lines.join(
              ", "
            )})`
          );
        } else if (error.type === "unmatched-parentheses") {
          console.log(
            `   - 括号不匹配 (开: ${error.open}, 闭: ${error.close})`
          );
        } else if (error.type === "typescript-type-assertion") {
          console.log(
            `   - TypeScript 类型断言 (行 ${error.line}): ${error.match}`
          );
        } else if (error.type === "invalid-toContain-params") {
          console.log(`   - 错误的 toContain 参数 (行 ${error.line})`);
        } else if (error.type === "double-await-parentheses") {
          console.log(`   - 双重 await 括号错误 (行 ${error.line})`);
        } else if (error.type === "broken-first-call") {
          console.log(`   - 错误的 first() 调用 (行 ${error.line})`);
        } else if (error.type === "typescript-param-type") {
          console.log(`   - TypeScript 参数类型注解 (行 ${error.line})`);
        } else if (error.type === "invalid-test-timeout") {
          console.log(`   - 无效的 test().timeout() (行 ${error.line})`);
        } else if (error.type === "invalid-test-catch") {
          console.log(`   - 无效的 test().catch() (行 ${error.line})`);
        }
      });

      errorCount++;

      if (result.hasChanges) {
        fs.writeFileSync(filePath, result.fixed, "utf8");
        console.log(`   ✅ 已自动修复`);
        fixedCount++;
        
        // 修复后检查是否还有语法错误
        const syntaxError = await checkSyntaxErrors(filePath);
        if (syntaxError) {
          console.log(`   ⚠️  修复后仍有语法错误，重命名为 .invalid`);
          const invalidPath = filePath + ".invalid";
          fs.renameSync(filePath, invalidPath);
          invalidFiles.push(file);
          renamedCount++;
        }
      } else {
        console.log(`   ❌ 无法自动修复，重命名为 .invalid`);
        const invalidPath = filePath + ".invalid";
        fs.renameSync(filePath, invalidPath);
        invalidFiles.push(file);
        renamedCount++;
      }
    } else {
      // 即使没有检测到特定错误，也检查语法
      const syntaxError = await checkSyntaxErrors(filePath);
      if (syntaxError) {
        console.log(`\n⚠️  ${file}:`);
        console.log(`   - 语法错误，重命名为 .invalid`);
        errorCount++;
        const invalidPath = filePath + ".invalid";
        fs.renameSync(filePath, invalidPath);
        invalidFiles.push(file);
        renamedCount++;
      }
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 验证完成:`);
  console.log(`   总文件数: ${testFiles.length}`);
  console.log(`   有错误: ${errorCount}`);
  console.log(`   已修复: ${fixedCount}`);
  console.log(`   重命名为 .invalid: ${renamedCount}`);

  if (invalidFiles.length > 0) {
    console.log(`\n⚠️  以下文件已重命名为 .invalid (Playwright 会自动跳过):`);
    invalidFiles.forEach((file) => {
      console.log(`   - ${file}`);
    });
  }

  console.log(`\n✅ 可以安全运行测试了！`);
}

// 主程序
const workspacePath = process.argv[2];

if (!workspacePath) {
  console.error("用法: node validate-tests.mjs <workspace-path>");
  console.error("示例: node validate-tests.mjs workspace/11-08-0003");
  process.exit(1);
}

validateWorkspace(workspacePath);
