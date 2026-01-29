import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c993b20-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the Deadlock Visualization page.
 * Encapsulates selectors and common assertions/actions.
 */
class DeadlockPage {
  constructor(page) {
    this.page = page;
    this.toggleSelector = '#toggleDeadlockBtn';
    this.infoSelector = '#infoText';
    this.deadlockPathSelector = '.deadlock-path';
    this.holdPathSelector = 'path.hold';
    this.requestPathSelector = 'path.request';
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('load');
  }

  async getToggleButton() {
    return this.page.locator(this.toggleSelector);
  }

  async getInfoElement() {
    return this.page.locator(this.infoSelector);
  }

  async deadlockPathsCount() {
    return this.page.locator(this.deadlockPathSelector).count();
  }

  async getDeadlockPathOpacities() {
    return this.page.$$eval(this.deadlockPathSelector, (els) =>
      els.map(el => el.style.opacity || getComputedStyle(el).opacity)
    );
  }

  async isInfoDeadlockActive() {
    return this.page.$eval(this.infoSelector, el => el.classList.contains('deadlock-active'));
  }

  async getInfoInnerHTML() {
    return this.page.$eval(this.infoSelector, el => el.innerHTML);
  }

  async getToggleAriaPressed() {
    return this.page.$eval(this.toggleSelector, el => el.getAttribute('aria-pressed'));
  }

  async getToggleText() {
    return this.page.$eval(this.toggleSelector, el => el.textContent.trim());
  }

  async clickToggle() {
    await this.page.click(this.toggleSelector);
  }

  async getHoldRequestCounts() {
    const hold = await this.page.locator(this.holdPathSelector).count();
    const req = await this.page.locator(this.requestPathSelector).count();
    return { hold, req };
  }
}

test.describe('Deadlock Concept — Visualized (FSM states & transitions)', () => {
  // Collect console error messages and page errors per test to assert there are none
  let consoleErrors;
  let pageErrors;
  let page;
  let dp;

  test.beforeEach(async ({ browser }) => {
    // New context and page per test ensures isolation
    const context = await browser.newContext();
    page = await context.newPage();

    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and page errors. We capture them for assertions below.
    page.on('console', msg => {
      // capture console.error messages specifically for clarity
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', err => {
      // Uncaught exceptions on the page
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });

    dp = new DeadlockPage(page);
    await dp.goto();
  });

  test.afterEach(async () => {
    // Assert no unexpected page errors (ReferenceError/SyntaxError/TypeError)
    // and no console.error messages were emitted during the test.
    // This validates that the app runs without uncaught exceptions on load / interaction.
    // We log any found errors to provide debugging context in test output.
    if (pageErrors.length > 0) {
      // If there are page errors, include them in the assertion failure message
      const messages = pageErrors.map(e => e.message).join('\n---\n');
      throw new Error(`Page errors were detected:\n${messages}`);
    }
    if (consoleErrors.length > 0) {
      const messages = consoleErrors.map(e => e.text).join('\n---\n');
      throw new Error(`Console.error messages were detected:\n${messages}`);
    }
    // close the page's context by closing the page (context will be disposed with page)
    await page.close();
  });

  test('Initial state S0_Idle: deadlock highlight hidden and UI reflects idle entry action', async () => {
    // This test validates the S0_Idle state's entry action setDeadlockVisible(false)
    // and checks initial DOM attributes and styles (opacity, aria-pressed, button text, info text/class).

    // Expect the toggle button exists and is not pressed initially
    const toggle = await dp.getToggleButton();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Button text should indicate the action to "Show Deadlock Cycle"
    await expect(toggle).toHaveText('Show Deadlock Cycle');

    // All deadlock overlay paths should exist and be hidden (opacity 0)
    const deadlockCount = await dp.deadlockPathsCount();
    // Implementation shows 8 deadlock overlay paths. Validate at least they are present.
    await expect(deadlockCount).toBeGreaterThanOrEqual(8);

    const opacities = await dp.getDeadlockPathOpacities();
    // All opacities should resolve to '0' (hidden). If computed value differs (e.g., '0' vs ''), we handle that.
    for (const opacity of opacities) {
      // opacity may be '' if not explicitly set, but the script calls setDeadlockVisible(false) on load,
      // which sets inline style.opacity = '0'. We assert it's falsy or explicitly '0' or '0px' not typical.
      expect(opacity === '' || opacity === '0' || opacity === '0.0' || parseFloat(opacity) === 0).toBeTruthy();
    }

    // Info text should NOT have the 'deadlock-active' class and should contain the explanatory paragraphs
    const infoHasClass = await dp.isInfoDeadlockActive();
    expect(infoHasClass).toBeFalsy();

    const infoHTML = await dp.getInfoInnerHTML();
    expect(infoHTML).toContain('This diagram illustrates the concept of <strong>deadlock</strong>');
    expect(infoHTML).toContain('When each process waits for a resource held by another');
  });

  test('Transition S0 -> S1 on ToggleDeadlock: click shows deadlock highlight and updates DOM', async () => {
    // Validate that clicking the toggle button transitions the app into the Deadlock Visible state (S1)
    // and that setDeadlockVisible(true) entry action applied: opacities, aria-pressed, text, and info class/content.

    // Precondition: ensure initial idle state
    await expect(await dp.getToggleAriaPressed()).toBe('false');

    // Click the toggle to show deadlock cycle
    await dp.clickToggle();

    // After click, aria-pressed should be true
    await expect(await dp.getToggleAriaPressed()).toBe('true');

    // Button text should change to "Hide Deadlock Cycle"
    await expect(await dp.getToggleText()).toBe('Hide Deadlock Cycle');

    // Info text should have deadlock-active class and contain the highlighted message
    await expect(await dp.isInfoDeadlockActive()).toBeTruthy();
    const infoHTML = await dp.getInfoInnerHTML();
    expect(infoHTML).toContain('Deadlock Cycle Highlighted');
    expect(infoHTML).toContain('forming a cyclic wait');

    // Deadlock overlay paths inline style opacity should now be '1' (visible)
    const opacities = await dp.getDeadlockPathOpacities();
    for (const opacity of opacities) {
      // Expect visible - opacity should be '1' or parseFloat(opacity) > 0
      expect(parseFloat(opacity)).toBeGreaterThan(0);
    }

    // Verify that core hold/request edges still exist (sanity check)
    const { hold, req } = await dp.getHoldRequestCounts();
    expect(hold).toBeGreaterThanOrEqual(4);
    expect(req).toBeGreaterThanOrEqual(4);
  });

  test('Transition S1 -> S0 on ToggleDeadlock: clicking again hides highlight and restores idle state', async () => {
    // Validate toggling twice returns to initial Idle state (S0) and that onExit/onEnter actions reflect setDeadlockVisible(false).

    // Click once to show
    await dp.clickToggle();
    await expect(await dp.getToggleAriaPressed()).toBe('true');

    // Click again to hide
    await dp.clickToggle();

    // Expect aria-pressed back to false and button label restored
    await expect(await dp.getToggleAriaPressed()).toBe('false');
    await expect(await dp.getToggleText()).toBe('Show Deadlock Cycle');

    // Deadlock overlay opacities should be back to 0 (hidden)
    const opacities = await dp.getDeadlockPathOpacities();
    for (const opacity of opacities) {
      expect(parseFloat(opacity)).toBeLessThanOrEqual(0);
    }

    // Info text should no longer have the deadlock-active class and should contain explanatory paragraph again
    await expect(await dp.isInfoDeadlockActive()).toBeFalsy();
    const infoHTML = await dp.getInfoInnerHTML();
    expect(infoHTML).toContain('This diagram illustrates the concept of <strong>deadlock</strong>');
  });

  test('Edge case: rapid double-click toggles twice and results in original state (idempotency)', async () => {
    // Simulate a rapid double click on the toggle button.
    // The expected behavior is that two clicks toggle twice, returning to original state.

    // Capture initial state
    const initialAria = await dp.getToggleAriaPressed();
    const initialText = await dp.getToggleText();

    // Perform two rapid clicks
    // Using two consecutive click() calls to emulate rapid user interaction.
    await dp.clickToggle();
    await dp.clickToggle();

    // After two toggles, expect to be back to initial state
    expect(await dp.getToggleAriaPressed()).toBe(initialAria);
    expect(await dp.getToggleText()).toBe(initialText);

    // Also ensure deadlock overlay opacities reflect the initial (hidden) state
    const opacities = await dp.getDeadlockPathOpacities();
    for (const opacity of opacities) {
      expect(parseFloat(opacity)).toBeLessThanOrEqual(0);
    }
  });

  test('Accessibility & attributes: aria-controls points to info text and toggling updates aria-pressed semantics', async () => {
    // Validate ARIA attributes and relationships per the FSM components description.

    const toggle = await dp.getToggleButton();
    // aria-controls should reference the infoText element
    await expect(toggle).toHaveAttribute('aria-controls', 'infoText');

    // Ensure the info element exists and has aria-live and aria-atomic as described in HTML
    const info = await dp.getInfoElement();
    await expect(info).toBeVisible();
    await expect(info).toHaveAttribute('aria-live', 'polite');
    await expect(info).toHaveAttribute('aria-atomic', 'true');

    // Toggle once and ensure aria-pressed becomes "true"
    await dp.clickToggle();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Toggle again and ensure aria-pressed becomes "false"
    await dp.clickToggle();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('Sanity check: number of deadlock overlay paths equals expected design count and have correct class', async () => {
    // Ensure the DOM contains the expected number of deadlock overlay paths (implementation shows 8)
    const count = await dp.deadlockPathsCount();
    expect(count).toBe(8);

    // Verify each deadlock overlay has the 'deadlock-path' class and is an SVG path element
    const selectors = await page.$$eval('.deadlock-path', els =>
      els.map(el => ({
        tag: el.tagName,
        classes: Array.from(el.classList)
      }))
    );
    for (const s of selectors) {
      expect(s.tag).toBe('path'.toUpperCase());
      expect(s.classes).toContain('deadlock-path');
    }
  });

  test('No runtime ReferenceError / SyntaxError / TypeError: page loads without uncaught exceptions', async () => {
    // This test intentionally asserts that no uncaught exceptions of core types occurred during load.
    // The beforeEach/afterEach will surface any page errors; here we explicitly make assertions about the arrays.
    // (This test will fail if any such errors were emitted, helping surface regressions.)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});