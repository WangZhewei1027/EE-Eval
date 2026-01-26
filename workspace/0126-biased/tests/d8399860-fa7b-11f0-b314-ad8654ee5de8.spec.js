import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8399860-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleSelector = '#toggleDemo';
    this.demoSelector = '#demo';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main container to be visible to ensure page has rendered
    await this.page.waitForSelector('.container');
  }

  async getButton() {
    return this.page.locator(this.toggleSelector);
  }

  async getDemo() {
    return this.page.locator(this.demoSelector);
  }

  async clickToggle() {
    await this.page.click(this.toggleSelector);
  }

  async buttonText() {
    return (await this.getButton().innerText()).trim();
  }

  async buttonAriaExpanded() {
    return await this.getButton().getAttribute('aria-expanded');
  }

  async demoAriaHidden() {
    return await this.getDemo().getAttribute('aria-hidden');
  }

  // Returns the computed display style (e.g., 'none' or 'block')
  async demoComputedDisplay() {
    return await this.page.$eval(this.demoSelector, (el) => {
      return window.getComputedStyle(el).display;
    });
  }

  async demoContainsText(substring) {
    const text = await this.getDemo().innerText();
    return text.includes(substring);
  }
}

test.describe('Comprehensive tests for Git commit graph demo (Application d8399860...)', () => {
  // Collect console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // Attach listeners so we can assert presence/absence of runtime errors and console errors
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // store the console message's type and text for inspection
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      page.context()._pageErrors.push(err);
    });
  });

  // cleanup references (not strictly necessary but keeps context tidy)
  test.afterEach(async ({ page }) => {
    page.removeAllListeners();
  });

  test('Initial state (S0_Idle) - button and demo are present and demo is hidden', async ({ page }) => {
    // This test validates the S0_Idle evidence:
    // - toggle button exists with aria-expanded="false" and expected label
    // - demo area exists with aria-hidden="true" and is visually hidden (display:none)
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Title / render verification (corresponds to renderPage() entry action in FSM S0)
    await expect(page).toHaveTitle(/Comprehensive Guide to Git/);

    const btn = await demoPage.getButton();
    await expect(btn).toBeVisible();
    // Check initial button label
    const btnText = await demoPage.buttonText();
    expect(btnText).toBe('Show Commit Graph Example');

    // Check aria-expanded initial state
    const ariaExpanded = await demoPage.buttonAriaExpanded();
    expect(ariaExpanded).toBe('false');

    // Demo container should exist
    const demo = await demoPage.getDemo();
    await expect(demo).toBeVisible(); // element exists in DOM; CSS may hide it visually
    // Confirm aria-hidden is true
    const ariaHidden = await demoPage.demoAriaHidden();
    expect(ariaHidden).toBe('true');

    // Computed display should be 'none' (CSS hides it)
    const computed = await demoPage.demoComputedDisplay();
    expect(computed).toBe('none');

    // Assert there are no runtime page errors (ReferenceError, SyntaxError, TypeError, etc.)
    const pageErrors = page.context()._pageErrors;
    expect(pageErrors.length, `Expected zero page errors but found ${pageErrors.length}`).toBe(0);

    // Assert no console errors were emitted
    const consoleErrors = page.context()._consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, `Expected zero console errors but found ${consoleErrors.length}`).toBe(0);
  });

  test('Toggle to visible (S1_DemoVisible) - clicking shows demo and updates attributes', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_DemoVisible via ToggleDemo:
    // - clicking the toggle displays the demo (display:block), aria-hidden="false"
    // - button text changes to Hide..., aria-expanded="true"
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click to show
    await demoPage.clickToggle();

    // Button text should change
    const btnTextAfter = await demoPage.buttonText();
    expect(btnTextAfter).toBe('Hide Commit Graph Example');

    // aria-expanded should update
    const ariaExpandedAfter = await demoPage.buttonAriaExpanded();
    expect(ariaExpandedAfter).toBe('true');

    // demo aria-hidden should be false
    const ariaHiddenAfter = await demoPage.demoAriaHidden();
    expect(ariaHiddenAfter).toBe('false');

    // computed display should be not 'none' (CSS sets to 'block' in script)
    const computed = await demoPage.demoComputedDisplay();
    // Accept 'block' or other values that indicate visible; ensure it's not 'none'
    expect(computed).not.toBe('none');

    // Check that demo content contains expected ASCII snippet indicative of commit graph
    const containsGraph = await demoPage.demoContainsText('A---B---C---D');
    expect(containsGraph).toBe(true);

    // Assert no runtime errors produced during toggle
    const pageErrors = page.context()._pageErrors;
    expect(pageErrors.length).toBe(0);

    const consoleErrors = page.context()._consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Toggle to hidden (S2_DemoHidden) - clicking twice hides demo and restores attributes', async ({ page }) => {
    // This test validates the transitions:
    // S0_Idle -> S1_DemoVisible -> S2_DemoHidden via two toggles
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Click to show, then click to hide
    await demoPage.clickToggle();
    // ensure visible first
    expect(await demoPage.demoAriaHidden()).toBe('false');

    await demoPage.clickToggle();

    // After second click, button text should revert
    const btnText = await demoPage.buttonText();
    expect(btnText).toBe('Show Commit Graph Example');

    // aria-expanded should revert to false
    const ariaExpanded = await demoPage.buttonAriaExpanded();
    expect(ariaExpanded).toBe('false');

    // demo aria-hidden should be true again
    const ariaHidden = await demoPage.demoAriaHidden();
    expect(ariaHidden).toBe('true');

    // computed display should be 'none'
    const computed = await demoPage.demoComputedDisplay();
    expect(computed).toBe('none');

    // Assert no runtime errors occurred during toggles
    const pageErrors = page.context()._pageErrors;
    expect(pageErrors.length).toBe(0);

    const consoleErrors = page.context()._consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Repeated rapid toggles are stable and maintain attribute invariants', async ({ page }) => {
    // This test performs multiple rapid toggles to exercise the toggle logic and ensure no inconsistent state is left
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Rapidly click the toggle 5 times
    for (let i = 0; i < 5; i++) {
      await demoPage.clickToggle();
    }

    // After 5 clicks (odd), the demo should be visible
    const expectedVisible = true;
    const ariaHidden = await demoPage.demoAriaHidden();
    const computed = await demoPage.demoComputedDisplay();
    const isVisible = ariaHidden === 'false' && computed !== 'none';

    expect(isVisible).toBe(expectedVisible);

    // Button aria-expanded should be 'true' and text should be 'Hide ...'
    const ariaExpanded = await demoPage.buttonAriaExpanded();
    expect(ariaExpanded).toBe('true');
    const btnText = await demoPage.buttonText();
    expect(btnText).toBe('Hide Commit Graph Example');

    // No runtime errors should have been emitted
    expect(page.context()._pageErrors.length).toBe(0);
    expect(page.context()._consoleMessages.filter((m) => m.type === 'error').length).toBe(0);
  });

  test('Edge case: clicking a non-existent selector should surface an error from Playwright', async ({ page }) => {
    // This test intentionally attempts an invalid operation to assert how errors are surfaced.
    // It verifies that attempting to click a missing selector will throw an error from Playwright.
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Attempt to click a non-existent element and assert that Playwright rejects the action.
    // Note: This validates error propagation from the environment, not the page script.
    let caught = null;
    try {
      await page.click('#this-selector-does-not-exist', { timeout: 500 });
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    // The error should indicate that the element was not found
    expect(String(caught)).toMatch(/No node found|waiting for selector|could not find/gi);
  });

  test('Observability: log all console messages and page errors (for debugging and verification)', async ({ page }) => {
    // This test collects console and page errors and asserts expectations about them.
    // It does not mutate the page; it simply inspects the collected logs.
    const demoPage = new DemoPage(page);
    await demoPage.goto();

    // Perform a known action that should not produce console errors
    await demoPage.clickToggle();
    await demoPage.clickToggle();

    // Wait a tick to ensure any async errors would be reported
    await page.waitForTimeout(100);

    // Gather recorded messages from context
    const consoleMessages = page.context()._consoleMessages || [];
    const pageErrors = page.context()._pageErrors || [];

    // For this application we expect no runtime JS errors (no ReferenceError/SyntaxError/TypeError)
    // If any appear, fail the test and print them for diagnostics.
    if (pageErrors.length > 0) {
      // Provide detailed assertion failure with error messages
      const errorTexts = pageErrors.map((e) => (e && e.stack) ? e.stack : String(e)).join('\n\n---\n\n');
      throw new Error(`Unexpected page errors detected:\n${errorTexts}`);
    }

    // Also ensure no console messages at error level
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error');
    if (consoleErrorMessages.length > 0) {
      const msgs = consoleErrorMessages.map((m) => m.text).join('\n');
      throw new Error(`Unexpected console error messages detected:\n${msgs}`);
    }

    // For completeness, ensure that there is at least some informational console activity or none,
    // but we do not assert presence of logs that don't exist. This test's main purpose is to observe.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
  });
});