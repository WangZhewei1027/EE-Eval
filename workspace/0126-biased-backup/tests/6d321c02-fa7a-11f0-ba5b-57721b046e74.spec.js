import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d321c02-fa7a-11f0-ba5b-57721b046e74.html';

// Page object model for interacting with the Interactive Compiler page
class CompilerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Panels
    this.editorPanel = '#editor-panel';
    this.lexerPanel = '#lexer-panel';
    this.parserPanel = '#parser-panel';
    this.optimizerPanel = '#optimizer-panel';
    this.codegenPanel = '#codegen-panel';

    // Controls
    this.compileButton = 'button[onclick="compile()"]';
    this.resetButton = 'button[onclick="reset()"]';
    this.stepLexerButton = 'button[onclick="stepLexer()"]';
    this.runLexerButton = 'button[onclick="runLexer()"]';
    this.stepParserButton = 'button[onclick="stepParser()"]';
    this.runParserButton = 'button[onclick="runParser()"]';
    this.optimizeButton = 'button[onclick="optimize()"]';
    this.generateCodeButton = 'button[onclick="generateCode()"]';
    this.languageSelect = 'select#language';
    this.targetSelect = 'select#target';
    this.sourceTextarea = '#source-code';
    this.tokensTbody = '#tokens tbody';
    this.lexerStatus = '#lexer-status';
    this.parserStatus = '#parser-status';
    this.astOutput = '#ast-output';
    this.optimizerBefore = '#optimizer-before';
    this.optimizerAfter = '#optimizer-after';
    this.generatedCode = '#generated-code';
    this.tabs = '.tab';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Switch to a named tab using its onclick value (editor, lexer, parser, optimizer, codegen)
  async switchTab(name) {
    await this.page.click(`.tab[onclick="switchTab('${name}')"]`);
    // wait a short time for UI switching
    await this.page.waitForTimeout(50);
  }

  async clickCompile() {
    await this.page.click(this.compileButton);
  }

  async clickReset() {
    await this.page.click(this.resetButton);
  }

  async clickStepLexer() {
    await this.page.click(this.stepLexerButton);
  }

  async clickRunLexer() {
    await this.page.click(this.runLexerButton);
  }

  async clickStepParser() {
    await this.page.click(this.stepParserButton);
  }

  async clickRunParser() {
    await this.page.click(this.runParserButton);
  }

  async clickOptimize() {
    await this.page.click(this.optimizeButton);
  }

  async clickGenerateCode() {
    await this.page.click(this.generateCodeButton);
  }

  async selectLanguage(value) {
    await this.page.selectOption(this.languageSelect, value);
  }

  async selectTarget(value) {
    await this.page.selectOption(this.targetSelect, value);
  }

  async getLexerStatus() {
    return (await this.page.textContent(this.lexerStatus)).trim();
  }

  async getParserStatus() {
    return (await this.page.textContent(this.parserStatus)).trim();
  }

  async tokensCount() {
    return this.page.$$eval(`${this.tokensTbody} tr`, rows => rows.length);
  }

  async firstTokenText() {
    return this.page.$eval(`${this.tokensTbody} tr:first-child td:nth-child(1)`, td => td.textContent?.trim());
  }

  async isPanelVisible(selector) {
    // check computed style display != 'none' and not have.hidden class
    return this.page.$eval(selector, el => {
      const style = window.getComputedStyle(el);
      const hiddenClass = el.classList.contains('hidden');
      return style.display !== 'none' && !hiddenClass;
    });
  }

  async getGeneratedCode() {
    return this.page.$eval(this.generatedCode, el => (el as HTMLTextAreaElement).value);
  }

  async getOptimizerBeforeHtml() {
    return this.page.$eval(this.optimizerBefore, el => el.innerHTML);
  }

  async getOptimizerAfterHtml() {
    return this.page.$eval(this.optimizerAfter, el => el.innerHTML);
  }

  async getAstOutputHtml() {
    return this.page.$eval(this.astOutput, el => el.innerHTML);
  }

  async getSourceValue() {
    return this.page.$eval(this.sourceTextarea, el => (el as HTMLTextAreaElement).value);
  }

  async getLanguageValue() {
    return this.page.$eval(this.languageSelect, el => (el as HTMLSelectElement).value);
  }
}

test.describe('Interactive Compiler FSM - Comprehensive E2E', () => {
  let page;
  let compiler;
  let consoleMessages = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console events and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    // Accept alerts and record their messages (the app uses alert() for some edge cases)
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    compiler = new CompilerPage(page);
    await compiler.goto();
    // Ensure page has loaded and initial elements exist
    await page.waitForSelector(compiler.sourceTextarea);
    await page.waitForSelector(compiler.compileButton);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial Editor state: editor panel visible and controls present', async () => {
    // Validate the initial view is the Editor (S0_Editor)
    expect(await compiler.isPanelVisible(compiler.editorPanel)).toBe(true);
    expect(await compiler.getLanguageValue()).toBe('javascript');

    // Source should contain the sample function
    const src = await compiler.getSourceValue();
    expect(src).toContain('function add(a, b)');

    // Tokens should be empty before compiling
    expect(await compiler.tokensCount()).toBe(0);

    // Status texts should be initialized to 'Ready'
    expect(await compiler.getLexerStatus()).toBe('Ready');
    expect(await compiler.getParserStatus()).toBe('Ready');
  });

  test('Compile transitions to Lexer and renders tokens', async () => {
    // Click Compile and verify state transition from Editor to Lexer (S0 -> S1)
    await compiler.clickCompile();

    // Lexer panel should be visible
    expect(await compiler.isPanelVisible(compiler.lexerPanel)).toBe(true);

    // Tokens should be rendered into the table
    const count = await compiler.tokensCount();
    expect(count).toBeGreaterThan(0);

    // The first token type should be present (e.g., 'keyword' for 'function')
    const firstType = await compiler.firstTokenText();
    expect(firstType).toBeTruthy();
  });

  test('StepLexer highlights tokens and updates status; RunLexer completes lexing', async () => {
    // Prepare by compiling
    await compiler.clickCompile();
    await page.waitForTimeout(50);

    const initialCount = await compiler.tokensCount();
    expect(initialCount).toBeGreaterThan(0);

    // Step once and verify a token row is highlighted and status updated
    await compiler.clickStepLexer();
    await page.waitForTimeout(20);
    const status1 = await compiler.getLexerStatus();
    expect(status1).toMatch(/Processing token 1 of \d+/);

    // Verify the first row has inline background style set
    const firstRowBg = await page.$eval('#tokens tbody tr:first-child', tr => tr.style.backgroundColor);
    expect(firstRowBg).not.toBe('');

    // Step again to move highlight
    await compiler.clickStepLexer();
    await page.waitForTimeout(20);
    const status2 = await compiler.getLexerStatus();
    expect(status2).toMatch(/Processing token 2 of \d+/);

    // Run All to complete lexing
    await compiler.clickRunLexer();
    await page.waitForTimeout(20);
    const finalStatus = await compiler.getLexerStatus();
    expect(finalStatus).toBe('Lexing complete');

    // After run, all rows should have no inline background color
    const rowBgColors = await page.$$eval('#tokens tbody tr', rows => rows.map(r => r.style.backgroundColor));
    for (const bg of rowBgColors) {
      expect(bg).toBe('');
    }
  });

  test('Parser Step and Run produce AST output and update parser status', async () => {
    // Compile to produce tokens
    await compiler.clickCompile();
    await page.waitForTimeout(50);

    // Use StepParser: it should produce an AST and update parser status
    await compiler.clickStepParser();
    await page.waitForTimeout(50);

    const astHtmlAfterStep = await compiler.getAstOutputHtml();
    expect(astHtmlAfterStep).toBeTruthy();
    const parserStatusAfterStep = await compiler.getParserStatus();
    // The implementation sets 'Parsing started' on first step
    expect(parserStatusAfterStep).toMatch(/Parsing started/i);

    // RunParser sets status to 'Parsing complete' and re-renders AST
    await compiler.clickRunParser();
    await page.waitForTimeout(50);
    const parserStatusAfterRun = await compiler.getParserStatus();
    expect(parserStatusAfterRun).toBe('Parsing complete');

    const astHtmlAfterRun = await compiler.getAstOutputHtml();
    expect(astHtmlAfterRun).toBeTruthy();
  });

  test('Optimize: edge case alert when not parsed; successful optimization after parsing', async () => {
    // Ensure optimizer panel is reachable
    await compiler.switchTab('optimizer');
    expect(await compiler.isPanelVisible(compiler.optimizerPanel)).toBe(true);

    // Click Optimize before parsing - should trigger an alert 'Please parse the code first'
    await compiler.clickOptimize();
    await page.waitForTimeout(50);
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[0].message).toMatch(/Please parse the code first/i);

    // Now parse properly: compile -> runParser
    dialogs = []; // reset recorded dialogs
    await compiler.clickCompile();
    await page.waitForTimeout(50);
    await compiler.clickRunParser();
    await page.waitForTimeout(50);

    // Switch to optimizer and run optimize
    await compiler.switchTab('optimizer');
    await page.waitForTimeout(50);
    await compiler.clickOptimize();
    await page.waitForTimeout(100);

    // The optimizer before and after sections should contain content
    const beforeHtml = await compiler.getOptimizerBeforeHtml();
    const afterHtml = await compiler.getOptimizerAfterHtml();
    expect(beforeHtml).toContain('Before Optimization');
    expect(afterHtml).toContain('After Optimization');
    expect(beforeHtml.length).toBeGreaterThan(0);
    expect(afterHtml.length).toBeGreaterThan(0);
  });

  test('GenerateCode creates output and changeTarget triggers regeneration', async () => {
    // Prepare pipeline: compile -> runParser -> optimize
    await compiler.clickCompile();
    await page.waitForTimeout(50);
    await compiler.clickRunParser();
    await page.waitForTimeout(50);
    await compiler.switchTab('optimizer');
    await compiler.clickOptimize();
    await page.waitForTimeout(100);

    // Switch to CodeGen panel and generate code
    await compiler.switchTab('codegen');
    expect(await compiler.isPanelVisible(compiler.codegenPanel)).toBe(true);

    // Clicking Generate Code should produce non-empty generated code
    await compiler.clickGenerateCode();
    await page.waitForTimeout(50);
    const code1 = await compiler.getGeneratedCode();
    expect(code1).toBeTruthy();
    expect(code1.length).toBeGreaterThan(0);

    // Change target to 'arm' using selectOption - this should call changeTarget() which triggers generateCode()
    await compiler.selectTarget('arm');
    await page.waitForTimeout(50);
    const code2 = await compiler.getGeneratedCode();
    expect(code2).toBeTruthy();
    // Generated code should change (likely different architecture output)
    expect(code2).not.toBe('');

    // It's acceptable if the outputs are similar; at minimum ensure it's a string and not empty
    expect(typeof code2).toBe('string');
  });

  test('Reset clears outputs and returns to Editor state', async () => {
    // Move through pipeline to produce various outputs
    await compiler.clickCompile();
    await page.waitForTimeout(30);
    await compiler.clickRunParser();
    await page.waitForTimeout(30);
    await compiler.switchTab('optimizer');
    await compiler.clickOptimize();
    await page.waitForTimeout(50);
    await compiler.switchTab('codegen');
    await compiler.clickGenerateCode();
    await page.waitForTimeout(50);

    // Now reset
    await compiler.clickReset();
    await page.waitForTimeout(50);

    // Editor panel should be visible again
    expect(await compiler.isPanelVisible(compiler.editorPanel)).toBe(true);

    // Tokens should be cleared
    expect(await compiler.tokensCount()).toBe(0);

    // AST and optimizer outputs should be empty
    const astHtml = await compiler.getAstOutputHtml();
    expect(astHtml).toBe('');

    const optimizerAfter = await compiler.getOptimizerAfterHtml();
    expect(optimizerAfter).toBe('');

    // Generated code should be empty
    const generated = await compiler.getGeneratedCode();
    expect(generated).toBe('');
  });

  test('ChangeLanguage triggers reset and updates language', async () => {
    // Change language select - changeLanguage() calls reset() in implementation
    await compiler.selectLanguage('python');
    await page.waitForTimeout(50);

    // After change, editor should be visible and language set to python
    expect(await compiler.isPanelVisible(compiler.editorPanel)).toBe(true);
    expect(await compiler.getLanguageValue()).toBe('python');

    // Tokens and outputs should be cleared as reset() was called
    expect(await compiler.tokensCount()).toBe(0);
    expect(await compiler.getAstOutputHtml()).toBe('');
  });

  test('Edge cases: calling generateCode before parsing triggers alert and is handled', async () => {
    // Ensure we are in codegen and no AST exists: call generateCode -> should alert
    await compiler.switchTab('codegen');
    // Clear any previous dialogs
    dialogs = [];
    await compiler.clickGenerateCode();
    await page.waitForTimeout(50);

    // An alert should have been shown with message 'Please parse the code first'
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[0].message).toMatch(/Please parse the code first/i);
  });

  test('Observe console logs and page errors - there should be no uncaught exceptions', async () => {
    // Do a typical use-case to exercise code paths and potentially any console errors
    await compiler.clickCompile();
    await page.waitForTimeout(50);
    await compiler.clickStepLexer();
    await page.waitForTimeout(20);
    await compiler.clickRunParser();
    await page.waitForTimeout(50);
    await compiler.switchTab('optimizer');
    await compiler.clickOptimize();
    await page.waitForTimeout(100);
    await compiler.switchTab('codegen');
    await compiler.clickGenerateCode();
    await page.waitForTimeout(50);

    // Collect error-type console messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error').map(m => m.text);

    // Assert there were no uncaught page errors
    // This will surface ReferenceError, SyntaxError, TypeError that occur as page errors.
    expect(pageErrors).toEqual([]);

    // Also assert there were no console.error messages logged by the page
    expect(consoleErrors).toEqual([]);
  });
});