import { test, expect } from '@playwright/test';

// Test page URL (served externally as specified)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad1291-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Interpreter visualization
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.interpretBtn = '#interpretBtn';
    this.resetBtn = '#resetBtn';
    this.rootNode = '#rootNode';
    this.resultDisplay = '#resultDisplay';
    this.outputText = '#outputText';
    this.parseTree = '#parseTree';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickInterpret() {
    await this.page.click(this.interpretBtn);
  }

  async clickReset() {
    await this.page.click(this.resetBtn);
  }

  async hoverRoot() {
    await this.page.hover(this.rootNode);
  }

  async dispatchLeave() {
    // dispatch a mouseleave event on root node
    await this.page.dispatchEvent(this.rootNode, 'mouseleave');
  }

  async getRootText() {
    return this.page.locator(this.rootNode).textContent();
  }

  async isResultShown() {
    // check presence of 'show' class on resultDisplay
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.classList.contains('show') : false;
    }, this.resultDisplay);
  }

  async getOutputText() {
    return this.page.locator(this.outputText).textContent();
  }

  async countParseTreeBranches() {
    return this.page.locator(`${this.parseTree} .branch`).count();
  }

  async countParseTreeTerminals() {
    return this.page.locator(`${this.parseTree} .terminal`).count();
  }

  async getRootInlineTransform() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.style.transform : '';
    }, this.rootNode);
  }

  async getRootInlineBackground() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.style.backgroundColor : '';
    }, this.rootNode);
  }
}

// Shared utilities for capturing console and page errors
function attachErrorCollectors(page, collectors) {
  collectors.consoleErrors = [];
  collectors.pageErrors = [];

  page.on('console', (msg) => {
    // capture console messages of severity 'error'
    if (msg.type() === 'error') {
      collectors.consoleErrors.push({
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  page.on('pageerror', (err) => {
    collectors.pageErrors.push(err);
  });
}

// Group tests
test.describe('Linguistic Interpreter Visualization (FSM validation)', () => {
  // Increase timeout for slower environments (timers used in app)
  test.setTimeout(30_000);

  test.beforeEach(async ({ page }) => {
    // Nothing here; each test will create its own InterpreterPage and navigate.
  });

  // Verify initial state S0_Idle and onEnter action createParseTree()
  test('Initial state (S0_Idle): parse tree created, root node default, result hidden', async ({ page }) => {
    const collectors = {};
    attachErrorCollectors(page, collectors);

    const app = new InterpreterPage(page);
    await app.goto();

    // Validate parse tree children created by createParseTree()
    const branchCount = await app.countParseTreeBranches();
    const terminalCount = await app.countParseTreeTerminals();

    // Expect at least two branches and two terminals as implemented
    expect(branchCount).toBeGreaterThanOrEqual(2);
    expect(terminalCount).toBeGreaterThanOrEqual(2);

    // Root node should show 'EXP' as initial text
    const rootText = (await app.getRootText())?.trim();
    expect(rootText).toBe('EXP');

    // Result display should NOT have the 'show' class initially
    const shown = await app.isResultShown();
    expect(shown).toBe(false);

    // Assert no runtime page errors or console errors were emitted during load
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  // Validate InterpretExpression event and transitions S0 -> S1 -> S2
  test('Interpret Expression: root shows processing indicator and then result is displayed (S0 -> S1 -> S2)', async ({ page }) => {
    const collectors = {};
    attachErrorCollectors(page, collectors);

    const app = new InterpreterPage(page);
    await app.goto();

    // Click interpret to trigger interpretExpression() (S0 -> S1)
    await app.clickInterpret();

    // Immediately after click we expect the root text to change to '...'
    const processingText = (await app.getRootText())?.trim();
    expect(processingText).toBe('...');

    // The inline background color should have been set (processing color),
    // so inline style should not be empty at this point.
    const bgInline = await app.getRootInlineBackground();
    expect(bgInline).not.toBe('');

    // Wait for the interpretExpression timer to complete (internal 1000ms)
    await page.waitForTimeout(1200);

    // After processing, outputText should contain the interpreted expression for the first item
    const output = (await app.getOutputText())?.trim();
    expect(output).toContain('Hello World');
    expect(output).toContain('Hola Mundo');

    // Result display should have become visible (class 'show' added) -> S2_ResultDisplayed
    const shown = await app.isResultShown();
    expect(shown).toBe(true);

    // Root node should have returned to 'EXP'
    const rootTextAfter = (await app.getRootText())?.trim();
    expect(rootTextAfter).toBe('EXP');

    // No uncaught errors expected during interaction
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  // Validate ResetVisualization event: S2 -> S0
  test('Reset: hides result display and resets root node (S2 -> S0)', async ({ page }) => {
    const collectors = {};
    attachErrorCollectors(page, collectors);

    const app = new InterpreterPage(page);
    await app.goto();

    // First interpret to show result
    await app.clickInterpret();
    await page.waitForTimeout(1200);
    expect(await app.isResultShown()).toBe(true);

    // Click reset to trigger resetVisualization()
    await app.clickReset();

    // Immediately after reset, resultDisplay should no longer have 'show'
    expect(await app.isResultShown()).toBe(false);

    // Root node text should be 'EXP' and style reset inline to var(--primary) (inline style present)
    const rootText = (await app.getRootText())?.trim();
    expect(rootText).toBe('EXP');

    // No uncaught errors expected
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  // Validate mouseenter/mouseleave on root node (S0 idle intra-state transitions)
  test('Root node hover animations on mouseenter and mouseleave (MouseEnterRootNode / MouseLeaveRootNode)', async ({ page }) => {
    const collectors = {};
    attachErrorCollectors(page, collectors);

    const app = new InterpreterPage(page);
    await app.goto();

    // Hover root node to trigger mouseenter handler - this sets inline transform
    await app.hoverRoot();

    // Inline transform should reflect the hovered state
    const hoverTransform = await app.getRootInlineTransform();
    // The implementation sets: 'scale(1.1) rotate(5deg)'
    expect(hoverTransform).toBeTruthy();
    expect(hoverTransform).toContain('scale(1.1)');
    expect(hoverTransform).toContain('rotate(5deg)');

    // Dispatch mouseleave to trigger mouseleave handler
    await app.dispatchLeave();

    // After leaving, inline transform should be reset to 'scale(1) rotate(0deg)'
    const leaveTransform = await app.getRootInlineTransform();
    expect(leaveTransform).toBe('scale(1) rotate(0deg)');

    // No uncaught errors expected
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  // Edge case: Rapid consecutive Interpret clicks should cycle expressions (multiple timers)
  test('Rapid consecutive Interpret clicks cycles to next expression (timer behavior / race condition)', async ({ page }) => {
    const collectors = {};
    attachErrorCollectors(page, collectors);

    const app = new InterpreterPage(page);
    await app.goto();

    // Click interpret twice quickly to queue two timers
    await app.clickInterpret();
    // small delay to simulate rapid second click
    await page.waitForTimeout(100);
    await app.clickInterpret();

    // Wait enough time for both timers to have fired sequentially (first at ~1s, second at ~1.1s)
    await page.waitForTimeout(1600);

    // Final output should reflect the second expression (Good morning -> Buenos días)
    const finalOutput = (await app.getOutputText())?.trim();
    expect(finalOutput).toContain('Good morning');
    expect(finalOutput).toContain('Buenos días');

    // Result should be visible
    expect(await app.isResultShown()).toBe(true);

    // No uncaught errors expected
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  // Edge case: Reset immediately after Interpret (demonstrates timers are not cancelled)
  test('Reset immediately after Interpret hides result but pending timer can re-display (demonstrate edge-case)', async ({ page }) => {
    const collectors = {};
    attachErrorCollectors(page, collectors);

    const app = new InterpreterPage(page);
    await app.goto();

    // Trigger interpret, then immediately reset
    await app.clickInterpret();
    await page.waitForTimeout(50); // tiny delay to ensure handler fired
    await app.clickReset();

    // Immediately after reset, result should be hidden
    expect(await app.isResultShown()).toBe(false);

    // However, because interpretExpression uses a timeout and reset doesn't cancel it,
    // after a short wait the result may become visible again. We assert this behavior to validate edge-case.
    await page.waitForTimeout(1200);
    const becameVisible = await app.isResultShown();

    // We accept both behaviors but we assert specifically that the implementation currently allows the result to show again.
    // This documents the observed behavior: the pending timer will re-add 'show'.
    expect(becameVisible).toBe(true);

    // No uncaught errors expected
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  // Observability test: collect console and page errors if any appear during normal usage
  test('Observability: capture console and runtime errors during typical interactions', async ({ page }) => {
    const collectors = {};
    attachErrorCollectors(page, collectors);

    const app = new InterpreterPage(page);
    await app.goto();

    // Perform typical interactions
    await app.clickInterpret();
    await page.waitForTimeout(1200);
    await app.clickReset();
    await app.hoverRoot();
    await app.dispatchLeave();

    // Allow any asynchronous page errors to surface
    await page.waitForTimeout(200);

    // Assert there were zero page errors and zero console.error messages
    // If any ReferenceError, SyntaxError, TypeError, or other unhandled exceptions occurred,
    // they would be present in collectors.pageErrors or collectors.consoleErrors.
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });
});