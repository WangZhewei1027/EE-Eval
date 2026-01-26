import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83a0d90-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page Object for the Compiler demo page.
 * Encapsulates interactions and collects console/page errors for assertions.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for later assertions.
    this.page.on('console', (msg) => {
      // capture text and type (log, error, warning, etc.)
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // pageerror is an Error object from the page (uncaught exceptions)
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the main stage text and button are rendered.
    await this.page.waitForSelector('#stageText');
    await this.page.waitForSelector('#nextBtn');
  }

  async getStageText() {
    return (await this.page.locator('#stageText').innerText()).trim();
  }

  async getButtonText() {
    return (await this.page.locator('#nextBtn').innerText()).trim();
  }

  async clickNext() {
    await this.page.locator('#nextBtn').click();
  }

  // utility to click and wait until expected substring appears in stageText
  async clickNextAndExpectStageSubstring(substring) {
    const stageLocator = this.page.locator('#stageText');
    // remember previous content so we can wait for a change
    const prev = await stageLocator.innerText();
    await this.clickNext();
    // wait until stage text contains substring (gives time for DOM update)
    await expect(stageLocator).toContainText(substring, { timeout: 2000 });
    // return new text
    return (await stageLocator.innerText()).trim();
  }
}

test.describe('Compiler — Comprehensive Explanation demo (FSM validation)', () => {
  let demo;

  // Every test gets a fresh page and DemoPage instance
  test.beforeEach(async ({ page }) => {
    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async ({ page }) => {
    // Helpful debugging: if there were page errors, attach them to the test output.
    if (demo.pageErrors.length > 0) {
      // Print to Node console for runner logs
      // Do NOT alter page runtime; just surface the errors.
      // eslint-disable-next-line no-console
      console.error(`[PageErrors] (${demo.pageErrors.length})`, demo.pageErrors.map(e => String(e)));
    }
    if (demo.consoleMessages.some(m => m.type === 'error')) {
      // eslint-disable-next-line no-console
      console.error('[ConsoleErrors]', demo.consoleMessages.filter(m => m.type === 'error'));
    }
    // optionally close page (Playwright handles fixtures automatically)
    await page.close();
  });

  test('Initial state (S0_Idle) is rendered correctly', async () => {
    // This test validates S0_Idle entry action effect: initial content is shown.
    // S0 evidence: "Step 0: Source code available. Click the button to see tokens."
    const stageText = await demo.getStageText();
    expect(stageText).toContain('Step 0: Source code available. Click the button to see tokens.');
    // The control button must exist and have the configured label initially.
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Show next compilation stage');

    // The stage container should be aria-live polite to announce updates to assistive tech.
    const ariaLive = await demo.page.getAttribute('#stageContainer', 'aria-live');
    expect(ariaLive).toBe('polite');

    // No runtime errors should have occurred while loading the initial page.
    expect(demo.pageErrors.length).toBe(0);
    // No console 'error' messages expected on load.
    expect(demo.consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
  });

  test('Transitions through all compilation stages (S0 -> S1 -> ... -> S6)', async () => {
    // This test validates each transition defined in the FSM by clicking the single button
    // and asserting the displayed textual snapshot corresponds to each phase.

    // Transition 1: S0_Idle -> S1_Tokens
    let text = await demo.clickNextAndExpectStageSubstring('Tokens (lexical analysis):');
    expect(text).toContain('KEYWORD(int)'); // evidence of tokens output

    // Transition 2: S1_Tokens -> S2_AST
    text = await demo.clickNextAndExpectStageSubstring('AST (simplified):');
    expect(text).toContain('FunctionDecl(name: main');

    // Transition 3: S2_AST -> S3_Semantic_Analysis
    text = await demo.clickNextAndExpectStageSubstring('Semantic Analysis (annotations):');
    expect(text).toContain('Symbol table');

    // Transition 4: S3_Semantic_Analysis -> S4_IR
    text = await demo.clickNextAndExpectStageSubstring('Intermediate Representation (three-address code):');
    expect(text).toContain('t1 = 1');

    // Transition 5: S4_IR -> S5_Optimized_IR
    text = await demo.clickNextAndExpectStageSubstring('Optimized IR (simple constant propagation and copy propagation):');
    expect(text).toContain('a = 1');

    // Transition 6: S5_Optimized_IR -> S6_Assembly
    text = await demo.clickNextAndExpectStageSubstring('Target-like assembly (conceptual stack-based or register-like):');
    expect(text).toContain('mov r0, #1');

    // When at the final stage the button label should change to indicate restart.
    const finalBtnText = await demo.getButtonText();
    expect(finalBtnText).toBe('Done — restart');

    // Ensure no uncaught page errors occurred during the sequence.
    expect(demo.pageErrors.length).toBe(0);
    // And no console-level errors were emitted during the sequence.
    expect(demo.consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
  });

  test('Final stage cycles back to initial state on extra click (S6 -> S0)', async () => {
    // Drive to final state first.
    await demo.clickNextAndExpectStageSubstring('Tokens (lexical analysis):'); // 1
    await demo.clickNextAndExpectStageSubstring('AST (simplified):'); // 2
    await demo.clickNextAndExpectStageSubstring('Semantic Analysis (annotations):'); // 3
    await demo.clickNextAndExpectStageSubstring('Intermediate Representation (three-address code):'); // 4
    await demo.clickNextAndExpectStageSubstring('Optimized IR (simple constant propagation and copy propagation):'); // 5
    await demo.clickNextAndExpectStageSubstring('Target-like assembly (conceptual stack-based or register-like):'); // 6

    // At S6, button reads 'Done — restart'
    expect(await demo.getButtonText()).toBe('Done — restart');

    // Click once more to trigger the transition back to S0_Idle.
    await demo.clickNextAndExpectStageSubstring('Step 0: Source code available. Click the button to see tokens.');
    expect(await demo.getButtonText()).toBe('Show next compilation stage');

    // Confirm we are indeed back to the original S0 text.
    const resetText = await demo.getStageText();
    expect(resetText).toContain('Step 0: Source code available. Click the button to see tokens.');

    // No runtime exceptions on reset.
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
  });

  test('Robustness: rapid repeated clicks cycle through states without throwing', async () => {
    // This test simulates a user clicking the button rapidly multiple times.
    // The implementation uses a simple counter; ensure rapid interactions don't crash the page.

    const clickCount = 12; // more than one full cycle (6 stages) to exercise wrap-around
    const stageLocator = demo.page.locator('#stageText');

    // Record initial text to detect change(s).
    const initial = await stageLocator.innerText();

    for (let i = 0; i < clickCount; i++) {
      await demo.page.locator('#nextBtn').click();
      // allow tiny pause for DOM to update
      await demo.page.waitForTimeout(60);
    }

    // After multiple cycles the app should be responsive and still show some valid stage content.
    const finalText = (await stageLocator.innerText()).trim();
    expect(finalText.length).toBeGreaterThan(0);

    // finalText should be one of the known outputs: either Step 0 or contain one of the phase identifiers.
    const knownMarkers = [
      'Step 0: Source code available',
      'Tokens (lexical analysis):',
      'AST (simplified):',
      'Semantic Analysis (annotations):',
      'Intermediate Representation (three-address code):',
      'Optimized IR (simple constant propagation and copy propagation):',
      'Target-like assembly (conceptual stack-based or register-like):'
    ];
    const matchesKnown = knownMarkers.some(marker => finalText.includes(marker));
    expect(matchesKnown).toBe(true);

    // Ensure no uncaught exceptions or console errors happened during the rapid clicks.
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
  });

  test('UI and accessibility checks: control existence and semantics', async () => {
    // Validate presence of the interactive controls and some accessibility attributes.

    // Button exists and has id nextBtn
    const btn = demo.page.locator('#nextBtn');
    await expect(btn).toBeVisible();
    // Button should be a native button element (role "button" implied)
    expect(await demo.page.evaluate(() => document.getElementById('nextBtn') instanceof HTMLButtonElement)).toBe(true);

    // The stage container should be announced politely (aria-live was validated earlier).
    const container = demo.page.locator('#stageContainer');
    await expect(container).toHaveAttribute('aria-live', 'polite');

    // The stage area should be visible and use monospace content (CSS not directly testable easily,
    // but we can assert that the #stageText element exists and contains text).
    const stageText = await demo.getStageText();
    expect(stageText.length).toBeGreaterThan(10);

    // No runtime exceptions triggered by simple queries.
    expect(demo.pageErrors.length).toBe(0);
  });

  test('Detect unexpected runtime errors emitted to console or as page errors (assert none)', async () => {
    // This test explicitly inspects collected console messages and page errors
    // to ensure the environment ran without uncaught ReferenceError/TypeError/SyntaxError.
    // The test will fail if such errors were observed during navigation/interactions.

    // We will perform a small interaction to ensure events are captured: click once.
    await demo.clickNextAndExpectStageSubstring('Tokens (lexical analysis):');

    // Check collected page errors
    const pageErrors = demo.pageErrors.map(e => String(e));
    const consoleErrors = demo.consoleMessages.filter(m => m.type === 'error').map(m => m.text);

    // If any page errors exist, report them in test output and fail the assertion.
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });
});