import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3daf2d0-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the Interpreter demo app
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.vars = page.locator('#vars');
    this.expr = page.locator('#expr');
    this.evalBtn = page.locator('#evalBtn');
    this.exampleBtn = page.locator('#exampleBtn');
    this.ast = page.locator('#ast');
    this.trace = page.locator('#trace');
    this.resultArea = page.locator('#resultArea');
    this.message = page.locator('#message');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickEvaluate() {
    await this.evalBtn.click();
  }

  async clickExample() {
    await this.exampleBtn.click();
  }

  async setExpr(value) {
    await this.expr.fill(value);
  }

  async setVars(value) {
    await this.vars.fill(value);
  }

  async getMessageHtml() {
    return await this.message.innerHTML();
  }

  async getMessageText() {
    return await this.message.textContent();
  }

  async getTraceText() {
    return await this.trace.textContent();
  }

  async getResultBadge() {
    return this.resultArea.locator('.result-badge');
  }

  async getAstNodes() {
    return this.ast.locator('.node');
  }

  // Wait until an evaluation result badge appears in the result area (root evaluation)
  async waitForResultBadge(timeout = 2000) {
    await this.page.waitForSelector('#resultArea .result-badge', { timeout });
  }

  // Convenience: perform evaluation and wait for badge or message update
  async evaluateAndWait() {
    const promise = Promise.race([
      this.page.waitForSelector('#resultArea .result-badge', { timeout: 2000 }).catch(()=>null),
      this.page.waitForSelector('#message .error', { timeout: 2000 }).catch(()=>null)
    ]);
    await this.evalBtn.click();
    await promise;
  }
}

test.describe('Interpreter Pattern — Demo (Boolean Expression Language) FSM tests', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages and uncaught page errors to assert runtime stability
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Navigate to the demo page before each test
    const ip = new InterpreterPage(page);
    await ip.goto();
    // after navigation, allow the demo's initial setTimeout auto-evaluation to occur
    // tests will explicitly wait when needed
  });

  test.afterEach(async () => {
    // After each test we will assert that there were no uncaught runtime errors recorded by the page.
    // The app handles errors and shows them in the UI, so uncaught console/page errors are unexpected.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Initial Idle -> Evaluating transition on load (auto-eval) displays AST and root result', async ({ page }) => {
    // This test validates the FSM initial Idle state entry action (clearOutputs),
    // followed by the evidence-setTimeout which triggers an EvaluateClick and moves to Evaluating.
    const ip = new InterpreterPage(page);

    // Wait for the auto-evaluation to complete by waiting for a result badge
    await ip.waitForResultBadge(3000);

    // Verify AST nodes were rendered
    const nodeCount = await ip.getAstNodes().count();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    // Verify result area shows a badge and is either true or false text
    const badge = ip.getResultBadge();
    await expect(badge).toBeVisible();
    const badgeText = await badge.textContent();
    expect(badgeText).toMatch(/^(true|false|True|False)$/i);

    // Verify trace was updated (not the initial "No evaluation yet.")
    const traceText = await ip.getTraceText();
    expect(traceText).not.toBeNull();
    expect(traceText.length).toBeGreaterThan(0);
    expect(traceText).not.toContain('No evaluation yet.');

    // Verify message indicates root evaluation
    const messageHtml = await ip.getMessageHtml();
    expect(messageHtml).toContain('Root expression evaluated');
  });

  test('EvaluateClick with empty expression transitions to Error state', async ({ page }) => {
    // This test validates the guard in S1_Evaluating -> S3_Error: empty expression should show an error UI.
    const ip = new InterpreterPage(page);

    // Ensure expression is empty
    await ip.setExpr('');
    // Click Evaluate and wait briefly for UI update
    await ip.clickEvaluate();

    // Expect an error message in messageEl with correct text
    const messageHtml = await ip.getMessageHtml();
    expect(messageHtml).toContain('Expression is empty.');

    // The AST and result should remain cleared due to clearOutputs() called before evaluation
    const astHtml = await ip.ast.innerHTML();
    expect(astHtml.trim()).toBe('');

    const resultHtml = await ip.resultArea.innerHTML();
    expect(resultHtml.trim()).toBe('');

    // Trace should be reset to the idle text
    const traceText = await ip.getTraceText();
    expect(traceText).toContain('No evaluation yet.');
  });

  test('ExampleClick loads example variables and expression and clears outputs', async ({ page }) => {
    // This test validates S1_Evaluating -> S2_ExampleLoaded via ExampleClick,
    // and that clearOutputs() is invoked (clearing AST, trace, result, message).
    const ip = new InterpreterPage(page);

    // Modify values to ensure the example load actually changes them
    await ip.setVars('X = true\nY = false');
    await ip.setExpr('X OR Y');

    // Click Load Examples
    await ip.clickExample();

    // After clicking, vars and expr should be non-empty and likely different from what we set
    const varsValue = await ip.vars.inputValue();
    const exprValue = await ip.expr.inputValue();
    expect(varsValue.trim().length).toBeGreaterThan(0);
    expect(exprValue.trim().length).toBeGreaterThan(0);

    // Outputs should be cleared
    const astHtml = await ip.ast.innerHTML();
    expect(astHtml.trim()).toBe('');

    const resultHtml = await ip.resultArea.innerHTML();
    expect(resultHtml.trim()).toBe('');

    const messageHtml = await ip.getMessageHtml();
    // After load examples the app clears outputs and doesn't set a message; message should be empty
    expect(messageHtml.trim()).toBe('');

    const traceText = await ip.getTraceText();
    expect(traceText).toContain('No evaluation yet.');
  });

  test('Clicking an AST node evaluates subnode and updates trace/result/message', async ({ page }) => {
    // This test validates the NodeClick event: clicking a .node should evaluate that AST node,
    // update the interpretation trace, show a focused result badge, and show a message about the evaluated node.
    const ip = new InterpreterPage(page);

    // Ensure a full evaluation exists first (root eval) so AST nodes are present
    await ip.waitForResultBadge(3000);

    // Get first AST node and click it
    const nodes = ip.getAstNodes();
    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);
    const firstNode = nodes.nth(0);

    // Click the node
    await firstNode.click();

    // After clicking, the trace area should be updated (not empty)
    const traceText = await ip.getTraceText();
    expect(traceText.trim().length).toBeGreaterThan(0);

    // Result area should show a badge (true/false)
    const badge = ip.getResultBadge();
    await expect(badge).toBeVisible();
    const badgeText = await badge.textContent();
    expect(badgeText).toMatch(/^(true|false|True|False)$/i);

    // Message area should indicate the evaluated node
    const messageText = await ip.getMessageText();
    expect(messageText).toContain('Evaluated node');
  });

  test('Invalid variable line produces parse error message (edge case)', async ({ page }) => {
    // This test checks error handling for invalid variable lines: it should present a UI error.
    const ip = new InterpreterPage(page);

    // Provide an invalid variable specification
    await ip.setVars('INVALID LINE WITHOUT EQUALS');

    // Ensure expression references something valid so tokenization/parsing proceeds
    await ip.setExpr('A');

    // Click evaluate
    await ip.clickEvaluate();

    // The UI should display an error about invalid variable line
    const messageHtml = await ip.getMessageHtml();
    expect(messageHtml).toContain('Invalid variable line');

    // Ensure trace and result remain cleared
    const traceText = await ip.getTraceText();
    // Depending on code path, trace may be empty string or "No evaluation yet."
    expect(traceText === '' || traceText.includes('No evaluation yet.')).toBeTruthy();
    const resultHtml = await ip.resultArea.innerHTML();
    expect(resultHtml.trim()).toBe('');
  });

  test('Unknown variable during evaluation shows error message from Context.get', async ({ page }) => {
    // This test triggers an exception during interpretation due to referencing an unknown variable.
    const ip = new InterpreterPage(page);

    // Set expression to a variable that is not defined in vars (defaults contain A,B,C).
    await ip.setExpr('UNDECLARED_VAR');

    // Ensure vars do not contain that variable
    await ip.setVars('A = true\nB = false\nC = true');

    // Click evaluate
    await ip.clickEvaluate();

    // The UI should catch the thrown Error and display it in messageEl with .error wrapper
    const messageHtml = await ip.getMessageHtml();
    expect(messageHtml).toContain('Unknown variable');

    // Also trace may be empty (since evaluation failed)
    const traceText = await ip.getTraceText();
    // traceText might contain lines pushed before error or be empty; ensure not to throw
    expect(typeof traceText === 'string').toBeTruthy();
  });
});