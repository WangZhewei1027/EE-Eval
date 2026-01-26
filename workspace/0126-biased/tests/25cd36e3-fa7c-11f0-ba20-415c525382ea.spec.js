import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cd36e3-fa7c-11f0-ba20-415c525382ea.html';

// Page object for the Refactoring Demo application
class RefactorDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#toggleDemo');
    this.demo = page.locator('#demo-container');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for main elements to be present in DOM
    await expect(this.button).toBeVisible({ timeout: 2000 });
    await expect(this.demo).toBeAttached();
  }

  async clickToggle() {
    await this.button.click();
  }

  async buttonText() {
    return (await this.button.textContent())?.trim();
  }

  // Reads the inline style.display property of the demo element (not computed style)
  async demoInlineDisplay() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demo-container');
      // Return exact inline style string for display (may be '' if not set)
      return demo ? demo.style.display : null;
    });
  }

  // Returns computed display (useful to check actual visibility)
  async demoComputedDisplay() {
    return await this.page.evaluate(() => {
      const demo = document.getElementById('demo-container');
      if (!demo) return null;
      return window.getComputedStyle(demo).display;
    });
  }

  async setDemoInlineDisplay(value) {
    await this.page.evaluate((v) => {
      const demo = document.getElementById('demo-container');
      if (demo) demo.style.display = v;
    }, value);
  }

  async hasGlobalRenderPage() {
    return await this.page.evaluate(() => {
      // Check whether renderPage is defined in global scope
      return typeof window.renderPage !== 'undefined';
    });
  }
}

// Collects console and page errors for assertions
function attachLogCapture(page) {
  const consoleMsgs = [];
  const pageErrors = [];

  const consoleListener = (msg) => {
    // capture message type and text
    consoleMsgs.push({
      type: msg.type(),
      text: msg.text(),
    });
  };

  const pageErrorListener = (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
    });
  };

  page.on('console', consoleListener);
  page.on('pageerror', pageErrorListener);

  return {
    consoleMsgs,
    pageErrors,
    dispose: () => {
      page.off('console', consoleListener);
      page.off('pageerror', pageErrorListener);
    },
  };
}

test.describe('Refactoring Demo FSM - 25cd36e3-fa7c-11f0-ba20-415c525382ea', () => {
  // Provide fresh capture for each test
  test.beforeEach(async ({ page }) => {
    // noop - actual setup done inside tests using attachLogCapture & page object
  });

  test.afterEach(async ({ page }) => {
    // noop
  });

  test('S0_Idle initial state: button exists, text correct, demo hidden (entry action verification)', async ({ page }) => {
    // This test validates the initial Idle state evidence:
    // - The toggle button exists with text "Show Refactoring Demo"
    // - The demo container has inline style display set to 'none' (hidden)
    // - Check for the presence (or absence) of the declared onEnter action function renderPage()
    // - Capture console and page errors during load and assert none were thrown

    const logs = attachLogCapture(page);
    const app = new RefactorDemoPage(page);

    await app.goto();

    // Assert button text matches FSM component evidence
    const btnText = await app.buttonText();
    expect(btnText).toBe('Show Refactoring Demo');

    // Assert demo inline display is exactly "none" as in HTML attribute
    const demoInline = await app.demoInlineDisplay();
    expect(demoInline).toBe('none');

    // Computed display should be "none" indicating it's not visible
    const demoComputed = await app.demoComputedDisplay();
    expect(demoComputed).toBe('none');

    // FSM entry action mentions renderPage(); verify whether the function exists or not (we must not patch)
    // We assert that renderPage is not present on window (the implementation does not define it),
    // ensuring we observe the real environment rather than adding a stub.
    const hasRenderPage = await app.hasGlobalRenderPage();
    expect(hasRenderPage).toBe(false);

    // No uncaught page errors should be emitted during a correct page load
    expect(logs.pageErrors).toEqual([]);
    // No console.error or console.assert failure messages
    const errors = logs.consoleMsgs.filter(m => m.type === 'error');
    expect(errors).toEqual([]);

    logs.dispose();
  });

  test('Transition S0_Idle -> S1_DemoVisible: clicking shows demo and updates button text', async ({ page }) => {
    // This test validates the first transition:
    // - From Idle, clicking the toggle shows the demo (style.display = 'block')
    // - Button text updates to "Hide Refactoring Demo"
    // - No page errors are produced during the interaction

    const logs = attachLogCapture(page);
    const app = new RefactorDemoPage(page);

    await app.goto();

    // Precondition check: confirm initial idle state
    expect(await app.demoInlineDisplay()).toBe('none');
    expect(await app.buttonText()).toBe('Show Refactoring Demo');

    // Trigger the ToggleDemo event
    await app.clickToggle();

    // After click, the inline style should be 'block' according to FSM evidence
    const afterInline = await app.demoInlineDisplay();
    expect(afterInline).toBe('block');

    // Computed style should be 'block' showing element visible
    const afterComputed = await app.demoComputedDisplay();
    expect(afterComputed).toBe('block');

    // Button text should have changed to Hide...
    expect(await app.buttonText()).toBe('Hide Refactoring Demo');

    // Validate no uncaught page errors during this transition
    expect(logs.pageErrors).toEqual([]);
    const consoleErrors = logs.consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);

    logs.dispose();
  });

  test('Transition S1_DemoVisible -> S2_DemoHidden: clicking hides demo and restores button text', async ({ page }) => {
    // This test validates toggling from visible back to hidden:
    // - Ensure the demo is visible, then click to hide
    // - Verify demo.style.display becomes 'none' and button text returns to "Show Refactoring Demo"

    const logs = attachLogCapture(page);
    const app = new RefactorDemoPage(page);

    await app.goto();

    // Make demo visible first (S0 -> S1)
    await app.clickToggle();
    expect(await app.demoInlineDisplay()).toBe('block');
    expect(await app.buttonText()).toBe('Hide Refactoring Demo');

    // Now click to trigger S1 -> S2
    await app.clickToggle();

    // After second click, inline should return to 'none'
    expect(await app.demoInlineDisplay()).toBe('none');

    // Computed display should also be 'none'
    expect(await app.demoComputedDisplay()).toBe('none');

    // Button text restored
    expect(await app.buttonText()).toBe('Show Refactoring Demo');

    // No unexpected errors
    expect(logs.pageErrors).toEqual([]);
    const consoleErrors = logs.consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);

    logs.dispose();
  });

  test('Transition S2_DemoHidden -> S1_DemoVisible: clicking when hidden shows again (cycle)', async ({ page }) => {
    // This test validates a full toggle cycle: hidden -> visible -> hidden -> visible
    // It asserts the FSM cyclic behavior: S0 -> S1 -> S2 -> S1 again

    const logs = attachLogCapture(page);
    const app = new RefactorDemoPage(page);

    await app.goto();

    // Cycle 1: show
    await app.clickToggle();
    expect(await app.demoInlineDisplay()).toBe('block');
    expect(await app.buttonText()).toBe('Hide Refactoring Demo');

    // Cycle 2: hide
    await app.clickToggle();
    expect(await app.demoInlineDisplay()).toBe('none');
    expect(await app.buttonText()).toBe('Show Refactoring Demo');

    // Cycle 3: show again (S2 -> S1)
    await app.clickToggle();
    expect(await app.demoInlineDisplay()).toBe('block');
    expect(await app.buttonText()).toBe('Hide Refactoring Demo');

    // Validate no uncaught errors across the interactions
    expect(logs.pageErrors).toEqual([]);
    const consoleErrors = logs.consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);

    logs.dispose();
  });

  test('Edge case: non-standard inline display -> click result follows code path', async ({ page }) => {
    // This test covers an edge case where the inline style.display is not 'none' nor 'block'
    // - Set demo.style.display to an empty string (''), which means demo.style.display === '' (not 'none')
    // - Clicking should then go to the else branch and set display to 'none' and button to Show...
    // This ensures the branch condition (demo.style.display === 'none') is respected.

    const logs = attachLogCapture(page);
    const app = new RefactorDemoPage(page);

    await app.goto();

    // Force a non-standard inline display value (empty string)
    await app.setDemoInlineDisplay('');
    expect(await app.demoInlineDisplay()).toBe('');

    // Click the toggle - the code checks strictly for 'none', so this should be treated as "not none" and go to else -> hide
    await app.clickToggle();

    // After clicking, inline display should be set to 'none' and button text to 'Show Refactoring Demo'
    expect(await app.demoInlineDisplay()).toBe('none');
    expect(await app.buttonText()).toBe('Show Refactoring Demo');

    // No uncaught page errors
    expect(logs.pageErrors).toEqual([]);
    const consoleErrors = logs.consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);

    logs.dispose();
  });

  test('Edge case: rapid toggles (multiple quick clicks) maintain consistent state without runtime errors', async ({ page }) => {
    // This test emulates a user rapidly clicking the toggle button multiple times
    // It ensures state toggles deterministically for each click and no runtime exceptions occur.

    const logs = attachLogCapture(page);
    const app = new RefactorDemoPage(page);

    await app.goto();

    // Rapid clicks - simulate 5 quick toggles
    for (let i = 0; i < 5; i++) {
      await app.clickToggle();
      // short pause to allow DOM update
      await page.waitForTimeout(50);
    }

    // After 5 clicks (odd number), state should be opposite of initial: visible ('block')
    const inline = await app.demoInlineDisplay();
    // The code sets to 'block' when it was 'none', and 'none' otherwise. Starting 'none' => odd clicks -> 'block'.
    expect(inline).toBe('block');
    // Button should read Hide...
    expect(await app.buttonText()).toBe('Hide Refactoring Demo');

    // Ensure no uncaught page errors were recorded
    expect(logs.pageErrors).toEqual([]);
    const consoleErrors = logs.consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);

    logs.dispose();
  });

  test('Sanity checks: DOM structure and accessibility of expected selectors', async ({ page }) => {
    // Validate existence of required DOM elements referenced by FSM and HTML implementation.
    const logs = attachLogCapture(page);
    const app = new RefactorDemoPage(page);

    await app.goto();

    // Ensure the toggle button has the expected id and is a button element
    const tagName = await page.evaluate(() => {
      const b = document.getElementById('toggleDemo');
      return b ? b.tagName.toLowerCase() : null;
    });
    expect(tagName).toBe('button');

    // Ensure the demo container exists and contains both "Original Code" and "Refactored Code" text snippets
    const demoContainsOriginal = await page.locator('#demo-container').locator('text=Original Code').count();
    const demoContainsRefactored = await page.locator('#demo-container').locator('text=Refactored Code').count();
    expect(demoContainsOriginal).toBeGreaterThanOrEqual(1);
    expect(demoContainsRefactored).toBeGreaterThanOrEqual(1);

    // Validate that the example code blocks are present
    const codeBlocks = await page.locator('#demo-container pre').count();
    expect(codeBlocks).toBeGreaterThanOrEqual(2);

    // No uncaught page errors
    expect(logs.pageErrors).toEqual([]);
    logs.dispose();
  });
});