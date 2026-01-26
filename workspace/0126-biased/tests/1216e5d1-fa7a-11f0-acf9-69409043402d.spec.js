import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1216e5d1-fa7a-11f0-acf9-69409043402d.html';

// Page object for the Compiler Interactive Demonstration
class CompilerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Element selectors
    this.selectors = {
      sourceCode: '#sourceCode',
      frontendSelect: '#frontendSelect',
      enableComments: '#enableComments',
      maxTokenLength: '#maxTokenLength',
      showTokens: '#showTokens',
      runLex: '#runLex',
      lexOutput: '#lexOutput',
      parserType: '#parserType',
      showParseTree: '#showParseTree',
      runParse: '#runParse',
      parseOutput: '#parseOutput',
      enableTypeCheck: '#enableTypeCheck',
      showSemantic: '#showSemantic',
      runSemantic: '#runSemantic',
      semanticOutput: '#semanticOutput',
      irLevel: '#irLevel',
      showIR: '#showIR',
      runIR: '#runIR',
      irOutput: '#irOutput',
      optConstFold: '#optConstFold',
      optDeadCode: '#optDeadCode',
      optCopyProp: '#optCopyProp',
      runOptimize: '#runOptimize',
      optOutput: '#optOutput',
      codeGenTarget: '#codeGenTarget',
      runCodeGen: '#runCodeGen',
      codeGenOutput: '#codeGenOutput',
      resetAll: '#resetAll',
      stepAll: '#stepAll',
      autoStepDelay: '#autoStepDelay',
      showLog: '#showLog',
      logOutput: '#logOutput',
      logTokens: '#logTokens',
      logParseSteps: '#logParseSteps',
      logSemanticSteps: '#logSemanticSteps',
      logIROptimize: '#logIROptimize',
      logCodeGen: '#logCodeGen'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  async getValue(selector) {
    return this.page.locator(selector).evaluate((el) => el.value);
  }

  async isDisabled(selector) {
    return this.page.locator(selector).evaluate((el) => el.disabled === true);
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async fill(selector, value) {
    await this.page.fill(selector, value);
  }

  async check(selector) {
    const el = this.page.locator(selector);
    if (!(await el.isChecked())) await el.check();
  }

  async uncheck(selector) {
    const el = this.page.locator(selector);
    if (await el.isChecked()) await el.uncheck();
  }

  async selectOption(selector, value) {
    await this.page.selectOption(selector, value);
  }

  async setNumberInput(selector, value) {
    await this.page.fill(selector, String(value));
  }
}

test.describe('Compiler Explorer - Interactive Demonstration (FSM validation)', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    dialogs = [];

    // Collect page errors and console messages for assertions / diagnostics
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });
    page.on('console', (msg) => {
      consoleMessages.push({type: msg.type(), text: msg.text()});
    });
    page.on('dialog', async (dialog) => {
      // Capture dialogs (alerts) and accept them - tests will assert message content
      dialogs.push(dialog.message());
      await dialog.accept();
    });
  });

  test.afterEach(async () => {
    // nothing to tear down globally here - page context is reset by Playwright runner test isolation
  });

  test('Initial UI state: verifies Idle (S0_Idle) state and controls are present and disabled appropriately', async ({ page }) => {
    // Validate initial rendered UI and disabled buttons per FSM initial state
    const app = new CompilerPage(page);
    await app.goto();

    // The Idle state's entry_action mentions renderPage(). We cannot inject or call anything.
    // We observe the DOM was rendered and initial controls exist.
    await expect(page.locator(app.selectors.sourceCode)).toBeVisible();
    await expect(page.locator(app.selectors.runLex)).toBeVisible();

    // Buttons that require prior phases should be disabled at start
    expect(await app.isDisabled(app.selectors.runParse)).toBe(true);
    expect(await app.isDisabled(app.selectors.runSemantic)).toBe(true);
    expect(await app.isDisabled(app.selectors.runIR)).toBe(true);
    expect(await app.isDisabled(app.selectors.runOptimize)).toBe(true);
    expect(await app.isDisabled(app.selectors.runCodeGen)).toBe(true);

    // Check presence and default value of maxTokenLength input
    const maxTokenLength = await app.getValue(app.selectors.maxTokenLength);
    expect(Number(maxTokenLength)).toBe(20);

    // No runtime errors should have been thrown during load
    expect(pageErrors).toEqual([]);
  });

  test.describe('Lexical Analysis and Parsing (S1 -> S2)', () => {
    test('Run lexical analysis enables parsing and displays tokens (RunLexicalAnalysis event)', async ({ page }) => {
      // This test validates the transition S0_Idle -> S1_LexicalAnalysis and enabling of parsing
      const app = new CompilerPage(page);
      await app.goto();

      // Ensure lex output area exists and contains text after running lex
      await app.click(app.selectors.runLex);

      // After lexing, runParse should become enabled
      await expect(page.locator(app.selectors.runParse)).toBeEnabled();

      // lexOutput should contain token lines (showTokens checkbox default is checked)
      const lexOut = await app.getText(app.selectors.lexOutput);
      expect(lexOut.length).toBeGreaterThan(0);
      // Expect at least one known token type present such as LET or IDENT or NUMBER
      expect(/LET|IDENT|NUMBER|PRINT/.test(lexOut)).toBe(true);
    });

    test('Attempt to parse without lex triggers alert (edge case)', async ({ page }) => {
      // This validates that parsing cannot occur before lexical analysis (alert path)
      const app = new CompilerPage(page);
      await app.goto();

      // Ensure we reset everything
      await app.click(app.selectors.resetAll);

      // Click runParse while no tokens present - handler will alert
      await app.click(app.selectors.runParse);

      // We expect an alert dialog with the appropriate message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1]).toContain('Please run lexical analysis first.');
    });

    test('Parsing (topdown) produces a parse tree and enables semantic analysis', async ({ page }) => {
      // This test exercises the transition S1_LexicalAnalysis -> S2_Parsing
      const app = new CompilerPage(page);
      await app.goto();

      // First perform lexical analysis
      await app.click(app.selectors.runLex);

      // Ensure parser type is topdown
      await app.selectOption(app.selectors.parserType, 'topdown');

      // Run parse
      await app.click(app.selectors.runParse);

      // parseOutput should now have parse tree text or a success message
      const parseOut = await app.getText(app.selectors.parseOutput);
      expect(parseOut.length).toBeGreaterThan(0);
      // Tree representation begins with 'Program' as implemented by simpleTreeString
      expect(parseOut).toContain('Program');

      // Now semantic button should be enabled or disabled depending on parse result. For success it should be enabled.
      expect(await app.isDisabled(app.selectors.runSemantic)).toBe(false);
    });
  });

  test.describe('Semantic Analysis, IR, Optimization, and Code Generation (S3 -> S6)', () => {
    test('Semantic analysis detects issues and passes on correct program (RunSemanticAnalysis)', async ({ page }) => {
      // Validate S2_Parsing -> S3_SemanticAnalysis transition and messages
      const app = new CompilerPage(page);
      await app.goto();

      // Ensure default source is valid (the page includes a valid program)
      await app.click(app.selectors.runLex);
      await app.click(app.selectors.runParse);

      // Run semantic analysis
      await app.click(app.selectors.runSemantic);

      const semOut = await app.getText(app.selectors.semanticOutput);
      // Default options have enableTypeCheck checked; since the sample program declares variables, expect pass message
      expect(semOut).toContain('Semantic analysis passed without errors.');
    });

    test('IR generation (threeaddr) produces 3-address code and enables optimization', async ({ page }) => {
      // Validate S3_SemanticAnalysis -> S4_IRGeneration transition
      const app = new CompilerPage(page);
      await app.goto();

      await app.click(app.selectors.runLex);
      await app.click(app.selectors.runParse);
      await app.click(app.selectors.runSemantic);

      // Select 3-address code IR level
      await app.selectOption(app.selectors.irLevel, 'threeaddr');

      // Generate IR
      await app.click(app.selectors.runIR);

      // IR output should contain lines with 'print' or assignments
      const irOut = await app.getText(app.selectors.irOutput);
      expect(irOut.length).toBeGreaterThan(0);
      expect(/print|=/.test(irOut)).toBe(true);

      // Optimize button should now be enabled since IR exists
      expect(await app.isDisabled(app.selectors.runOptimize)).toBe(false);
    });

    test('Optimizations apply transformations and produce logs when enabled (RunOptimization)', async ({ page }) => {
      // Validate S4_IRGeneration -> S5_Optimization transition and opt flags
      const app = new CompilerPage(page);
      await app.goto();

      await app.click(app.selectors.runLex);
      await app.click(app.selectors.runParse);
      await app.click(app.selectors.runSemantic);
      await app.selectOption(app.selectors.irLevel, 'threeaddr');
      await app.click(app.selectors.runIR);

      // Enable optimization options for demonstrable effects
      await app.check(app.selectors.optConstFold);
      await app.check(app.selectors.optDeadCode);
      await app.check(app.selectors.optCopyProp);

      await app.click(app.selectors.runOptimize);

      const optOut = await app.getText(app.selectors.optOutput);
      expect(optOut.length).toBeGreaterThan(0);
      // Expect logs about optimizations to appear when options chosen (function returns logs)
      expect(/Logs:/.test(optOut) || /fold|Eliminating|Applying/i.test(optOut)).toBe(true);

      // After optimization, code generation should be enabled
      expect(await app.isDisabled(app.selectors.runCodeGen)).toBe(false);
    });

    test('Code generation emits JavaScript or pseudo-assembly (RunCodeGeneration)', async ({ page }) => {
      // Validate S5_Optimization -> S6_CodeGeneration transition
      const app = new CompilerPage(page);
      await app.goto();

      // Run through pipeline to get IR
      await app.click(app.selectors.runLex);
      await app.click(app.selectors.runParse);
      await app.click(app.selectors.runSemantic);
      await app.selectOption(app.selectors.irLevel, 'threeaddr');
      await app.click(app.selectors.runIR);

      // Ensure at least IR exists; do not require optimizedIr - codegen can use ir
      await app.selectOption(app.selectors.codeGenTarget, 'js');
      await app.click(app.selectors.runCodeGen);

      const codeOut = await app.getText(app.selectors.codeGenOutput);
      expect(codeOut.length).toBeGreaterThan(0);
      // For JS target, we expect console.log lines or let assignments
      expect(/console\.log|let /.test(codeOut)).toBe(true);

      // Also test pseudoasm target produces ASM-like lines
      await app.selectOption(app.selectors.codeGenTarget, 'pseudoasm');
      // If runCodeGen is enabled we can run again
      await app.click(app.selectors.runCodeGen);
      const asmOut = await app.getText(app.selectors.codeGenOutput);
      expect(/LOAD|STORE|PRINT|MOV/.test(asmOut)).toBe(true);
    });

    test('Reset All clears outputs and disables downstream buttons (ResetAll event)', async ({ page }) => {
      // Validates the ResetAll transition staying in S0_Idle
      const app = new CompilerPage(page);
      await app.goto();

      // Run a few phases
      await app.click(app.selectors.runLex);
      await app.click(app.selectors.runParse);
      await app.click(app.selectors.runSemantic);

      // Now reset everything
      await app.click(app.selectors.resetAll);

      // Outputs should be cleared
      const lexOut = await app.getText(app.selectors.lexOutput);
      const parseOut = await app.getText(app.selectors.parseOutput);
      const semOut = await app.getText(app.selectors.semanticOutput);
      expect(lexOut).toBe('');
      expect(parseOut).toBe('');
      expect(semOut).toBe('');

      // Buttons requiring previous phases should be disabled again
      expect(await app.isDisabled(app.selectors.runParse)).toBe(true);
      expect(await app.isDisabled(app.selectors.runSemantic)).toBe(true);
      expect(await app.isDisabled(app.selectors.runIR)).toBe(true);
      expect(await app.isDisabled(app.selectors.runOptimize)).toBe(true);
      expect(await app.isDisabled(app.selectors.runCodeGen)).toBe(true);
    });
  });

  test.describe('Full pipeline runner and error cases', () => {
    test('Run Full Compile Pipeline (StepAll) completes end-to-end asynchronously', async ({ page }) => {
      // Validate StepAll event runs entire pipeline (S0 -> S1 -> S2 -> ... S6) with auto-step delay
      const app = new CompilerPage(page);
      await app.goto();

      // Set very small delay to speed up test
      await app.setNumberInput(app.selectors.autoStepDelay, 10);

      // Ensure we want codegen in JS to detect console.log output
      await app.selectOption(app.selectors.codeGenTarget, 'js');

      // Trigger stepAll - this starts an async pipeline inside the page
      await app.click(app.selectors.stepAll);

      // Wait until codeGenOutput has a non-empty value indicating completion of pipeline
      await page.waitForFunction((sel) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim().length > 0;
      }, app.selectors.codeGenOutput, { timeout: 5000 });

      const codeOut = await app.getText(app.selectors.codeGenOutput);
      expect(codeOut.length).toBeGreaterThan(0);
      // For JS target expect console.log or JS lines
      expect(/console\.log|let /.test(codeOut)).toBe(true);
    });

    test('Semantic analysis reports undeclared variable (edge case)', async ({ page }) => {
      // This test constructs a source with an undeclared identifier and ensures semantic analysis raises error
      const app = new CompilerPage(page);
      await app.goto();

      // Replace source content with a program that tries to print an undeclared variable
      await app.fill(app.selectors.sourceCode, 'print(a);');

      // Run pipeline up to semantic analysis
      await app.click(app.selectors.runLex);
      await app.click(app.selectors.runParse);
      await app.click(app.selectors.runSemantic);

      // semanticOutput should contain an undeclared variable error
      const semOut = await app.getText(app.selectors.semanticOutput);
      expect(semOut).toContain("Undeclared variable");
    });
  });

  test('Logging and diagnostics (ShowLogs event) reflect user-selected logging flags', async ({ page }) => {
    // Validate that logs are collected when log checkboxes are enabled and showLog displays them
    const app = new CompilerPage(page);
    await app.goto();

    // Enable token logging and parse logging
    await app.check(app.selectors.logTokens);
    await app.check(app.selectors.logParseSteps);

    // Run lex and parse to produce logs
    await app.click(app.selectors.runLex);
    await app.click(app.selectors.runParse);

    // Click show log to populate logOutput
    await app.click(app.selectors.showLog);

    const logOut = await app.getText(app.selectors.logOutput);
    // Because we enabled specific logs, there should be entries
    expect(logOut.length).toBeGreaterThan(0);
    // Logs should contain markers for the lex or parse entries upper-cased by implementation
    expect(/\[LEX\]|\[PARSE\]|Parsing/.test(logOut) || /Parsing|Tokenized/.test(logOut)).toBe(true);
  });

  test('Observes runtime console messages and page errors (diagnostic)', async ({ page }) => {
    // Final diagnostic test asserting there are no unexpected runtime errors emitted by the page when exercising the app
    const app = new CompilerPage(page);
    await app.goto();

    // Perform a variety of interactions to surface potential runtime exceptions
    await app.click(app.selectors.runLex);
    await app.click(app.selectors.runParse);
    await app.click(app.selectors.runSemantic);
    await app.selectOption(app.selectors.irLevel, 'threeaddr');
    await app.click(app.selectors.runIR);
    await app.check(app.selectors.optConstFold);
    await app.click(app.selectors.runOptimize);
    await app.selectOption(app.selectors.codeGenTarget, 'js');
    await app.click(app.selectors.runCodeGen);
    await app.click(app.selectors.resetAll);

    // Collect console messages during these interactions - ensure there are no page errors (uncaught exceptions)
    // The test expectation is that no uncaught exceptions were thrown during normal operations
    expect(pageErrors).toEqual([]);
    // We still assert that console messages were emitted (info/debug logs) and are an array
    expect(Array.isArray(consoleMessages)).toBe(true);
    // Some console messages may be present, ensure at least it is defined (no crash)
    // If no console messages are present that's also acceptable, so no strict assertion on length
  });
});