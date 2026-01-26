import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9591a1-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the Stack app to encapsulate interactions and queries
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array} consoleLogs
   * @param {Array} pageErrors
   */
  constructor(page, consoleLogs, pageErrors) {
    this.page = page;
    this.consoleLogs = consoleLogs;
    this.pageErrors = pageErrors;
    this.stackSelector = '#stack';
    this.blockSelector = '#stack .block';
    this.pushSelector = '#push';
    this.popSelector = '#pop';
    this.infoSelector = '.info-note';
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the Push button and wait for the push animation + re-render to complete
  async push() {
    const before = await this.getBlockCount();
    await this.page.click(this.pushSelector);
    // The app uses setTimeout 850ms to re-render after push, so wait slightly longer
    await this.page.waitForTimeout(900);
    // Ensure the DOM eventually reflects an increased block count (if not at MAX_BLOCKS)
    await this.page.waitForFunction(
      (sel, expected) => document.querySelectorAll(sel).length === expected,
      {},
      this.blockSelector,
      Math.max(before, before + 1) // it will be either the same (if MAX reached) or +1
    ).catch(() => {
      // swallow: we'll assert counts externally; waiting is best-effort to let animations settle
    });
  }

  // Click the Pop button and wait for the pop animation + re-render to complete
  async pop() {
    const before = await this.getBlockCount();
    await this.page.click(this.popSelector);
    // The app uses setTimeout 700ms to pop, so wait slightly longer
    await this.page.waitForTimeout(800);
    // Wait for DOM to settle: expect count to be before-1 or same if it was empty
    await this.page.waitForFunction(
      (sel, expectedMax) => document.querySelectorAll(sel).length <= expectedMax,
      {},
      this.blockSelector,
      Math.max(0, before)
    ).catch(() => {});
  }

  // Get the textual labels of all blocks in DOM order (bottom -> top)
  async getBlockTexts() {
    return await this.page.$$eval(this.blockSelector, (els) =>
      Array.from(els).map((e) => (e.textContent || '').trim())
    );
  }

  // Get the number of blocks
  async getBlockCount() {
    return await this.page.$$eval(this.blockSelector, (els) => els.length);
  }

  // Get the top block text (last child in DOM is top)
  async getTopBlockText() {
    const texts = await this.getBlockTexts();
    return texts.length ? texts[texts.length - 1] : null;
  }

  // Get the info note text (accessibility spied announcements)
  async getInfoText() {
    return (await this.page.locator(this.infoSelector).textContent())?.trim();
  }

  // Query attributes for accessibility verification
  async getStackAttributes() {
    const el = this.page.locator(this.stackSelector);
    return {
      role: await el.getAttribute('role'),
      ariaLive: await el.getAttribute('aria-live'),
      ariaAtomic: await el.getAttribute('aria-atomic'),
      ariaRelevant: await el.getAttribute('aria-relevant'),
      tabIndex: await el.getAttribute('tabindex'),
    };
  }

  async getButtonAttributes(selector) {
    const el = this.page.locator(selector);
    return {
      title: await el.getAttribute('title'),
      ariaDescribedBy: await el.getAttribute('aria-describedby'),
      text: (await el.textContent())?.trim(),
    };
  }

  // Utility: return captured console logs and page errors
  getConsoleLogs() {
    return this.consoleLogs;
  }
  getPageErrors() {
    return this.pageErrors;
  }
}

// Test suite covering FSM states, transitions, edge cases, dom changes, and monitoring console/page errors
test.describe('Stack Visualization - FSM states and transitions', () => {
  // Per-test arrays to collect console and page errors
  let consoleLogs = [];
  let pageErrors = [];
  /** @type {StackPage} */
  let stack;

  test.beforeEach(async ({ page }) => {
    consoleLogs = [];
    pageErrors = [];

    // Capture console messages for observation
    page.on('console', (msg) => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      // store the error message and stack
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    // Initialize the page object and navigate
    stack = new StackPage(page, consoleLogs, pageErrors);
    await stack.goto();
  });

  test.afterEach(async () => {
    // After each test, assert that there were no uncaught runtime page errors (TypeError/ReferenceError/SyntaxError)
    // If any errors occurred, include them in the failure message for easier debugging.
    if (pageErrors.length > 0) {
      const details = pageErrors.map((e, i) => `#${i + 1} ${e.message}\n${e.stack}`).join('\n\n');
      // Fail the test explicitly with the collected errors so they are visible in CI logs
      throw new Error(`Uncaught page errors detected:\n\n${details}`);
    }

    // Also assert that no console.error messages were emitted during the test run.
    const consoleErrors = consoleLogs.filter((c) => c.type === 'error' || c.type === 'warning');
    if (consoleErrors.length > 0) {
      const details = consoleErrors.map((c, i) => `#${i + 1} [${c.type}] ${c.text}`).join('\n');
      throw new Error(`Console errors/warnings detected:\n\n${details}`);
    }
  });

  // Validate initial rendering corresponds to S0_Initial
  test('S0_Initial: initial render should show 3 sample blocks and proper ARIA attributes', async () => {
    // This test validates:
    // - The initial state renders exactly 3 blocks (#1, #2, #3)
    // - The stack container has appropriate ARIA attributes per the FSM components
    // - The info note displays the initial prompt

    // Verify block count and labels
    const count = await stack.getBlockCount();
    expect(count).toBe(3);

    const texts = await stack.getBlockTexts();
    expect(texts).toEqual(['#1', '#2', '#3']); // bottom -> top

    // Verify ARIA attributes on the stack container
    const attrs = await stack.getStackAttributes();
    expect(attrs.role).toBe('list');
    expect(attrs.ariaLive).toBe('polite');
    expect(attrs.ariaAtomic).toBe('true');
    // aria-relevant in HTML is "additions removals"
    expect(attrs.ariaRelevant).toBe('additions removals');
    expect(attrs.tabIndex).toBe('0');

    // Verify info note initial text (provided by static HTML)
    const info = await stack.getInfoText();
    expect(info).toContain("Click 'Push' to add a new block to the stack.");
  });

  // Validate pushing from initial state transitions to S1_ElementPushed
  test('S0 -> S1 PushButtonClicked: clicking Push adds a new block and announces the push', async () => {
    // This test validates:
    // - Clicking push increases block count by one (unless already at MAX_BLOCKS)
    // - New top block has expected label (#4)
    // - Info note announces the pushed element

    const before = await stack.getBlockCount();
    expect(before).toBe(3);

    await stack.push();

    const after = await stack.getBlockCount();
    expect(after).toBe(4);

    const top = await stack.getTopBlockText();
    expect(top).toBe('#4');

    const info = await stack.getInfoText();
    // The app calls speakInfo('Pushed ' + (stackData[stackData.length-1] || 'element'));
    expect(info).toContain('Pushed');
    // Confirm the announcement mentions the new top element when push succeeds
    expect(info).toContain('#4');
  });

  // Validate multiple pushes until MAX_BLOCKS and ensure further pushes do not exceed the limit
  test('S1_ElementPushed repeated PushButtonClicked: respect MAX_BLOCKS and do not exceed 5 blocks', async () => {
    // This test validates:
    // - Pushing repeatedly will eventually reach the MAX_BLOCKS limit of 5
    // - Further pushes beyond MAX_BLOCKS do not increase DOM block count
    // - The info note still updates but DOM remains bounded

    // Starting from initial 3, push twice to reach 5
    await stack.push(); // -> #4
    await stack.push(); // -> #5

    const countAtMax = await stack.getBlockCount();
    expect(countAtMax).toBe(5);

    // Attempt to push beyond MAX_BLOCKS
    await stack.push(); // should not increase beyond 5
    const countAfterExtraPush = await stack.getBlockCount();
    expect(countAfterExtraPush).toBe(5);

    // The info note will still contain 'Pushed' text, confirm it references the current top (#5)
    const info = await stack.getInfoText();
    expect(info).toContain('Pushed');
    expect(info).toContain('#5');
  });

  // Validate popping transitions S1 -> S2 and repeated pops S2 -> S2
  test('S1 -> S2 PopButtonClicked: clicking Pop removes the top element and announces it; handle repeated pops until empty', async () => {
    // This test validates:
    // - Pop removes top element and the DOM count decreases
    // - The info note announces which element was popped
    // - Repeated pops can bring the stack to empty and further pops are handled gracefully

    // First, ensure stack has 5 elements by pushing if necessary
    let count = await stack.getBlockCount();
    while (count < 5) {
      await stack.push();
      count = await stack.getBlockCount();
    }
    expect(count).toBe(5);

    // Pop once: should remove #5
    await stack.pop();
    let afterPopCount = await stack.getBlockCount();
    expect(afterPopCount).toBe(4);

    let topText = await stack.getTopBlockText();
    expect(topText).toBe('#4');

    // The app announces 'Popped ' + stackData[stackData.length-1] (before pop),
    // so the info should contain '#5'
    let info = await stack.getInfoText();
    expect(info).toContain('Popped');
    expect(info).toContain('#5');

    // Pop repeatedly to empty
    await stack.pop(); // remove #4
    await stack.pop(); // remove #3
    await stack.pop(); // remove #2
    let finalCount = await stack.getBlockCount();
    expect(finalCount).toBe(1);
    // Top should be '#1'
    expect(await stack.getTopBlockText()).toBe('#1');

    // Pop last remaining item
    await stack.pop();
    expect(await stack.getBlockCount()).toBe(0);

    // Now attempt to pop from empty stack -> should not crash and should update info note with 'Stack is empty'
    await stack.pop();
    // Info note for empty pop path contains 'Stack is empty, cannot pop'
    info = await stack.getInfoText();
    expect(info).toContain('Stack is empty');

    // Confirm the DOM remains empty
    expect(await stack.getBlockCount()).toBe(0);
  });

  // Validate components' attributes and roles (component extraction)
  test('Component attributes: Push & Pop buttons and stack container have expected attributes per FSM components', async () => {
    // This test validates:
    // - Buttons exist with correct text and attributes (title, aria-describedby)
    // - Stack container attributes as expected (role/list semantics)

    const pushAttrs = await stack.getButtonAttributes('#push');
    expect(pushAttrs.text).toBe('Push');
    expect(pushAttrs.title).toBe('Push a new element onto the stack');
    expect(pushAttrs.ariaDescribedBy).toBe('infoPush');

    const popAttrs = await stack.getButtonAttributes('#pop');
    expect(popAttrs.text).toBe('Pop');
    expect(popAttrs.title).toBe('Pop the top element off the stack');
    expect(popAttrs.ariaDescribedBy).toBe('infoPop');

    const stackAttrs = await stack.getStackAttributes();
    expect(stackAttrs.role).toBe('list');
    expect(stackAttrs.ariaLive).toBe('polite');
  });

  // Observe console logs and page errors: this test ensures no uncaught runtime errors occurred during normal interactions
  test('Observability: console and page errors are monitored and none should be present after interactions', async () => {
    // This test validates:
    // - We captured console messages and page errors
    // - No uncaught page errors or console.error/warning messages are present

    // Perform a few interactions to exercise code paths
    await stack.push(); // push #4
    await stack.pop();  // pop #4
    await stack.push(); // push #4 again

    // Give time for any asynchronous runtime errors to surface
    await stack.page.waitForTimeout(300);

    // Inspect collected logs
    const logs = stack.getConsoleLogs();
    const errors = stack.getPageErrors();

    // We expect no uncaught page errors (the afterEach will also enforce this)
    expect(errors.length).toBe(0);

    // Also assert that there are no console errors or warnings
    const errWarnings = logs.filter((l) => l.type === 'error' || l.type === 'warning');
    expect(errWarnings.length).toBe(0);
  });
});