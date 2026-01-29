import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8344130-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo page to encapsulate interactions and queries
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#showDemo');
    this.demo = page.locator('#demo');
    // collectors for runtime issues
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Initialize listeners for console and page errors
  async attachErrorHandlers() {
    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      this.consoleMessages.push({ type, text });
      if (type === 'error') {
        this.consoleErrors.push(text);
      }
    });
    this.page.on('pageerror', (err) => {
      // pageerror receives Error objects
      this.pageErrors.push(err && err.message ? err.message : String(err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a small amount in case the inline script attaches handlers after load
    await this.page.waitForTimeout(50);
  }

  async getButtonText() {
    return (await this.button.textContent())?.trim();
  }

  async isDemoHiddenByClass() {
    // check class attribute contains 'hidden'
    const cls = await this.demo.getAttribute('class');
    return cls ? cls.split(/\s+/).includes('hidden') : false;
  }

  async isDemoHiddenByVisibility() {
    // Playwright's isHidden checks for display:none, visibility:hidden, or detached
    return await this.demo.isHidden();
  }

  async getDemoAriaHidden() {
    const a = await this.demo.getAttribute('aria-hidden');
    return a;
  }

  async clickToggle() {
    await this.button.click();
  }

  // convenience: toggle n times quickly
  async clickTimes(n, delayMs = 0) {
    for (let i = 0; i < n; i++) {
      await this.button.click();
      if (delayMs) await this.page.waitForTimeout(delayMs);
    }
  }
}

test.describe('Suffix Tree Demo — FSM state and transitions (d8344130-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Shared page object across tests
  let demoPage;

  test.beforeEach(async ({ page }) => {
    demoPage = new DemoPage(page);
    await demoPage.attachErrorHandlers();
    await demoPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // ensure page is closed by Playwright fixtures, but clear listeners arrays for memory
    demoPage.consoleMessages = [];
    demoPage.consoleErrors = [];
    demoPage.pageErrors = [];
    // small pause to allow any late runtime errors to surface
    await page.waitForTimeout(20);
  });

  test('Initial state S0_Idle: button present and demo hidden (entry actions observed)', async () => {
    // This test validates the Idle state as specified in the FSM:
    // - The page renders the button with exact initial label
    // - The demo area exists but is hidden (class "hidden" and aria-hidden="true")
    // - No runtime page errors or console errors occurred during initial render

    // Button should exist and have the exact expected label
    await expect(demoPage.button).toBeVisible();
    const btnText = await demoPage.getButtonText();
    expect(btnText).toBe('Show demonstration: search "ana" in "banana$"');

    // Demo container should exist in DOM and be hidden both by class and by visibility
    await expect(demoPage.demo).toBeAttached();
    const hiddenByClass = await demoPage.isDemoHiddenByClass();
    expect(hiddenByClass).toBe(true);

    const hiddenByVisibility = await demoPage.isDemoHiddenByVisibility();
    expect(hiddenByVisibility).toBe(true);

    // aria-hidden attribute should reflect the hidden state
    const ariaHidden = await demoPage.getDemoAriaHidden();
    expect(ariaHidden).toBe('true');

    // The FSM's S0 entry_actions implied "renderPage()": we validate that initial markup matches evidence
    // (button markup and demo markup presence are asserted above)
    // Validate no uncaught page errors or console error messages occurred during load
    expect(demoPage.pageErrors, 'No uncaught page errors should be present on initial render').toHaveLength(0);
    expect(demoPage.consoleErrors, 'No console.error messages should be present on initial render').toHaveLength(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible on ShowDemo click: demo becomes visible and button text updates', async () => {
    // Validate the event ShowDemo (click on #showDemo) triggers the expected transition:
    // - demo.classList.toggle('hidden') makes demo visible
    // - aria-hidden attribute is updated to "false"
    // - button text changes to "Hide demonstration"

    // Precondition: initial state is hidden
    expect(await demoPage.isDemoHiddenByVisibility()).toBe(true);

    // Click the button once to show the demo
    await demoPage.clickToggle();

    // Demo should now be visible in the UI
    await expect(demoPage.demo).toBeVisible();
    expect(await demoPage.isDemoHiddenByClass()).toBe(false);

    // aria-hidden should be updated to the string "false"
    expect(await demoPage.getDemoAriaHidden()).toBe('false');

    // Button text should change to "Hide demonstration"
    const btnTextAfter = await demoPage.getButtonText();
    expect(btnTextAfter).toBe('Hide demonstration');

    // Verify some content inside the demo is present to ensure the revealed area is the intended one
    await expect(demoPage.demo.locator('h3')).toContainText('Demonstration: pattern search of "ana" in "banana$"');
    // The textual result is displayed including occurrences; check that expected leaf-list numbers are present
    await expect(demoPage.demo.locator('.leaf-list')).toHaveCount(2);
    const leafTexts = await demoPage.demo.locator('.leaf-list').allTextContents();
    // ensure at least one of them contains "1" and "3" as described in the explanation (order may vary)
    expect(leafTexts.join(' ')).toContain('1');
    expect(leafTexts.join(' ')).toContain('3');

    // Ensure no runtime page errors or console errors appeared by performing the action
    expect(demoPage.pageErrors, 'No page errors after toggling demo visible').toHaveLength(0);
    expect(demoPage.consoleErrors, 'No console.error messages after toggling demo visible').toHaveLength(0);
  });

  test('Transition S1_DemoVisible -> S0_Idle on ShowDemo click (toggle back): demo hides and button label restored', async () => {
    // Start from visible state by clicking once
    await demoPage.clickToggle();
    await expect(demoPage.demo).toBeVisible();

    // Now click again to hide (transition back)
    await demoPage.clickToggle();

    // Demo should be hidden and aria-hidden should be "true"
    await expect(demoPage.demo).not.toBeVisible();
    expect(await demoPage.isDemoHiddenByClass()).toBe(true);
    expect(await demoPage.getDemoAriaHidden()).toBe('true');

    // Button text should be restored to the original "Show demonstration: search "ana" in "banana$""
    const btnTextAfter = await demoPage.getButtonText();
    expect(btnTextAfter).toBe('Show demonstration: search "ana" in "banana$"');

    // Ensure no runtime page errors or console errors appeared during toggling back
    expect(demoPage.pageErrors).toHaveLength(0);
    expect(demoPage.consoleErrors).toHaveLength(0);
  });

  test('Edge case: Rapid successive clicks produce consistent toggling behavior (odd = visible, even = hidden)', async () => {
    // Perform a rapid sequence of clicks and validate final state corresponds to parity of clicks
    // Click 3 times -> should be visible (odd)
    await demoPage.clickTimes(3);
    expect(await demoPage.isDemoHiddenByVisibility()).toBe(false);
    expect(await demoPage.getDemoAriaHidden()).toBe('false');
    expect(await demoPage.getButtonText()).toBe('Hide demonstration');

    // Click 1 time (total 4) -> should be hidden (even)
    await demoPage.clickTimes(1);
    expect(await demoPage.isDemoHiddenByVisibility()).toBe(true);
    expect(await demoPage.getDemoAriaHidden()).toBe('true');
    expect(await demoPage.getButtonText()).toBe('Show demonstration: search "ana" in "banana$"');

    // Click 10 times quickly (even) -> should remain hidden
    await demoPage.clickTimes(10);
    expect(await demoPage.isDemoHiddenByVisibility()).toBe(true);

    // Click 11 times (odd) -> visible
    await demoPage.clickTimes(11);
    expect(await demoPage.isDemoHiddenByVisibility()).toBe(false);

    // Ensure no page errors or console errors occurred during rapid interactions
    expect(demoPage.pageErrors).toHaveLength(0);
    expect(demoPage.consoleErrors).toHaveLength(0);
  });

  test('DOM integrity after many toggles: demo element remains attached and button never becomes detached', async () => {
    // Toggle many times and ensure elements remain in DOM and attributes remain consistent
    for (let i = 0; i < 15; i++) {
      await demoPage.clickToggle();
      // Ensure elements are still attached
      await expect(demoPage.button).toBeAttached();
      await expect(demoPage.demo).toBeAttached();

      // The aria-hidden value must reflect the visible/hidden class
      const aria = await demoPage.getDemoAriaHidden();
      const hiddenByClass = await demoPage.isDemoHiddenByClass();
      expect(String(hiddenByClass)).toBe(aria === 'true' ? 'true' : 'false');
    }

    // Final sanity checks
    expect(demoPage.pageErrors).toHaveLength(0);
    expect(demoPage.consoleErrors).toHaveLength(0);
  });

  test('Observability: capture console + page errors during interactions (assert none exist)', async () => {
    // This test explicitly collects console messages and page errors while exercising the toggle
    // and asserts that no unexpected runtime errors (ReferenceError, SyntaxError, TypeError, etc.)
    // were emitted by the page.
    await demoPage.clickToggle();
    await demoPage.clickToggle();
    await demoPage.clickToggle();

    // Small wait to allow any asynchronous errors to surface
    await demoPage.page.waitForTimeout(50);

    // Provide helpful diagnostic output if failures occur (Playwright will show the arrays)
    expect(demoPage.pageErrors, `Expected no page runtime errors, saw: ${JSON.stringify(demoPage.pageErrors)}`).toHaveLength(0);
    expect(demoPage.consoleErrors, `Expected no console.error messages, saw: ${JSON.stringify(demoPage.consoleErrors)}`).toHaveLength(0);

    // Additionally verify that console messages (if any) are informational (not errors)
    const errorTypeMsgs = demoPage.consoleMessages.filter(m => m.type === 'error');
    expect(errorTypeMsgs).toHaveLength(0);
  });
});