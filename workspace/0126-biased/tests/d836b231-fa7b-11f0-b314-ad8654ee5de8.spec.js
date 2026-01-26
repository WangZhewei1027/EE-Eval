import { test, expect } from '@playwright/test';

// Test page constants
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d836b231-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the Backtracking demo page
class BacktrackingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      toggleBtn: '#toggleTrace',
      trace: '#trace',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getToggleButton() {
    return this.page.locator(this.selectors.toggleBtn);
  }

  async getTrace() {
    return this.page.locator(this.selectors.trace);
  }

  // Click the toggle button and wait a microtask to allow DOM updates
  async clickToggle() {
    await this.getToggleButton().click();
    // wait for any microtask DOM updates triggered by the click handler
    await this.page.waitForTimeout(20);
  }

  // Return computed display style of the trace element
  async isTraceVisible() {
    const disp = await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).display;
    }, this.selectors.trace);
    return disp !== 'none' && disp !== null;
  }

  async getToggleText() {
    return await this.getToggleButton().innerText();
  }

  async getAriaExpanded() {
    return await this.getToggleButton().getAttribute('aria-expanded');
  }

  async getTraceText() {
    return await this.getTrace().innerText();
  }
}

test.describe('Backtracking — 4-Queens Trace Toggle (FSM validation)', () => {
  // Capture console messages and page errors per test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, assert there were no uncaught page errors.
    // This observes the environment without modifying it and fails if runtime errors occurred.
    expect(pageErrors, `Expected no page errors, but got: ${pageErrors.map(e => String(e)).join('\n')}`).toHaveLength(0);

    // Also assert there are no console errors (console.error)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'assert' || m.type === 'warning');
    expect(consoleErrors, `Expected no console errors/warnings, but found: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
  });

  // Validate initial Idle state (S0_Idle)
  test('Initial state (S0_Idle): button rendered; trace hidden; attributes correct', async ({ page }) => {
    const app = new BacktrackingPage(page);
    // Navigate to the page as-is
    await app.goto();

    // The toggle button should be present and match the extracted component
    const btn = await app.getToggleButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveClass(/demo/);
    // Text content should match FSM evidence for initial Idle
    await expect(btn).toHaveText('Show 4-Queens Trace');
    // aria-expanded initial value should be "false"
    expect(await app.getAriaExpanded()).toBe('false');

    // trace element exists and should be hidden (display: none)
    const traceEl = await app.getTrace();
    await expect(traceEl).toBeVisible(); // element exists in DOM; visibility here is 'visible' in locator terms, but display can be none
    // Confirm computed style display === 'none'
    const computedDisplay = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return window.getComputedStyle(el).display;
    }, '#trace');
    expect(computedDisplay).toBe('none');

    // Verify that there is no global renderPage function present (FSM mentions renderPage() as an entry action).
    // We do not modify the app — we only observe. This asserts whether that entry action exists.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // The implementation provided does not define renderPage; assert accordingly.
    expect(hasRenderPage).toBe(false);
  });

  // Transition S0_Idle -> S1_TraceVisible on ToggleTrace
  test('Transition: ToggleTrace shows trace (S0_Idle -> S1_TraceVisible)', async ({ page }) => {
    const app = new BacktrackingPage(page);
    await app.goto();

    // Click toggle to show the trace
    await app.clickToggle();

    // After clicking, trace should be visible (display: block)
    const isVisible = await app.isTraceVisible();
    expect(isVisible).toBe(true);

    // Button text should update to "Hide 4-Queens Trace"
    expect(await app.getToggleText()).toBe('Hide 4-Queens Trace');

    // aria-expanded should be "true"
    expect(await app.getAriaExpanded()).toBe('true');

    // The trace content should include known text fragments from the static trace
    const traceText = await app.getTraceText();
    expect(traceText).toContain('Start with empty board');
    expect(traceText).toContain('Solution found');
  });

  // Transition S1_TraceVisible -> S2_TraceHidden on ToggleTrace
  test('Transition: ToggleTrace hides trace (S1_TraceVisible -> S2_TraceHidden)', async ({ page }) => {
    const app = new BacktrackingPage(page);
    await app.goto();

    // Make it visible first
    await app.clickToggle();
    expect(await app.isTraceVisible()).toBe(true);

    // Now click again to hide
    await app.clickToggle();

    // Trace should be hidden (display: none)
    const disp = await page.evaluate((sel) => window.getComputedStyle(document.querySelector(sel)).display, '#trace');
    expect(disp).toBe('none');

    // Button text should revert to "Show 4-Queens Trace"
    expect(await app.getToggleText()).toBe('Show 4-Queens Trace');

    // aria-expanded should be "false"
    expect(await app.getAriaExpanded()).toBe('false');
  });

  // Transition S2_TraceHidden -> S1_TraceVisible on ToggleTrace (toggle back)
  test('Transition: ToggleTrace toggles repeatedly and maintains correct state', async ({ page }) => {
    const app = new BacktrackingPage(page);
    await app.goto();

    // Sequence of toggles and expected states
    const steps = [
      { click: true, expectedVisible: true, expectedText: 'Hide 4-Queens Trace', expectedAria: 'true' },
      { click: true, expectedVisible: false, expectedText: 'Show 4-Queens Trace', expectedAria: 'false' },
      { click: true, expectedVisible: true, expectedText: 'Hide 4-Queens Trace', expectedAria: 'true' },
      { click: true, expectedVisible: false, expectedText: 'Show 4-Queens Trace', expectedAria: 'false' },
    ];

    for (const [index, step] of steps.entries()) {
      if (step.click) {
        await app.clickToggle();
      }
      const visible = await app.isTraceVisible();
      expect(visible).toBe(step.expectedVisible, `Step ${index}: expected visibility ${step.expectedVisible}`);
      expect(await app.getToggleText()).toBe(step.expectedText);
      expect(await app.getAriaExpanded()).toBe(step.expectedAria);
    }
  });

  // Edge case: rapid consecutive clicks (simulate double-click or multiple quick toggles)
  test('Edge case: rapid consecutive clicks should toggle state deterministically', async ({ page }) => {
    const app = new BacktrackingPage(page);
    await app.goto();

    // Perform rapid clicks
    const btn = await app.getToggleButton();
    await Promise.all([
      btn.click(),
      btn.click(),
      btn.click(),
      btn.click(),
    ]);

    // Wait a moment for all handler invocations to complete
    await page.waitForTimeout(50);

    // After four toggles starting from hidden -> expected to be hidden again (even number of toggles)
    const isVisible = await app.isTraceVisible();
    expect(isVisible).toBe(false);

    // Button and aria should reflect hidden state
    expect(await app.getToggleText()).toBe('Show 4-Queens Trace');
    expect(await app.getAriaExpanded()).toBe('false');
  });

  // Validate accessibility attributes and content when visible
  test('Accessibility & live-region: trace is in DOM and has aria-live; aria-expanded toggles correctly', async ({ page }) => {
    const app = new BacktrackingPage(page);
    await app.goto();

    // The trace div should have aria-live="polite"
    const traceHasAriaLive = await page.evaluate(() => {
      const el = document.getElementById('trace');
      return el && el.getAttribute('aria-live') === 'polite';
    });
    expect(traceHasAriaLive).toBe(true);

    // Toggle to visible and verify aria-expanded on the button and that the trace contains expected content
    await app.clickToggle();
    expect(await app.getAriaExpanded()).toBe('true');
    const traceSnippet = await app.getTraceText();
    expect(traceSnippet.length).toBeGreaterThan(50); // Sanity check that the trace text is non-trivial
    expect(traceSnippet).toMatch(/4-Queens|Solution found/);
  });

  // Error scenario observations (verify there are no runtime ReferenceError/TypeError/SyntaxError)
  test('Runtime: observe console and page errors (no uncaught exceptions expected in this implementation)', async ({ page }) => {
    const app = new BacktrackingPage(page);
    await app.goto();

    // Interact lightly
    await app.clickToggle();
    await app.clickToggle();

    // We rely on afterEach to assert there were no page errors or console errors.
    // This test documents that the page should not produce ReferenceError/TypeError/SyntaxError during normal use.
    // No explicit assertions here beyond presence checks done in afterEach.
  });
});