import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370b1b0-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the demo page
class AdjListDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#show-adjlist-btn');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // wait for the button to be attached so tests can proceed deterministically
    await expect(this.button).toBeVisible();
  }

  async clickShowButton() {
    await this.button.click();
  }

  async isButtonDisabled() {
    return this.button.isDisabled();
  }

  async getButtonAriaLabel() {
    return this.button.getAttribute('aria-label');
  }

  async isOutputVisible() {
    return this.output.isVisible();
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async getOutputComputedDisplay() {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).display;
    }, '#demo-output');
  }

  async getOutputAriaLive() {
    return this.output.getAttribute('aria-live');
  }
}

test.describe('Adjacency List Demo - FSM validation (a370b1b0-ffc4-11f0-821c-7d25bc609266)', () => {
  // Capture console messages and page errors per test to assert on them
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // record console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // record uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Basic initial state tests (S0_Idle)
  test.describe('Initial state: S0_Idle (rendered page)', () => {
    test('Initial render: button present, output hidden, helper functions exist', async ({ page }) => {
      // This test validates the entry state S0_Idle:
      // - The page renders with the "Show Adjacency List Demo" button
      // - The demo output is present but hidden (display: none)
      // - JavaScript helper functions used by the demo exist on window
      const demo = new AdjListDemoPage(page);
      await demo.goto();

      // Button visibility and attributes
      await expect(demo.button).toBeVisible();
      const ariaLabel = await demo.getButtonAriaLabel();
      expect(ariaLabel).toBe('Show adjacency list demo');

      // Button should be enabled in the idle state
      expect(await demo.isButtonDisabled()).toBe(false);

      // Output should exist but be hidden initially
      await expect(demo.output).toHaveCount(1);
      const computedDisplay = await demo.getOutputComputedDisplay();
      expect(computedDisplay === 'none' || computedDisplay === 'inline' || computedDisplay === 'block').toBeTruthy();
      // Specifically the HTML sets style="display:none;" initially so expect 'none'
      expect(computedDisplay).toBe('none');

      // aria-live attribute for accessibility
      expect(await demo.getOutputAriaLive()).toBe('polite');

      // Verify the demo helper functions are present on the page (do not modify them)
      // We assert that these functions exist so the subsequent interaction will call them naturally.
      const funcsExist = await page.evaluate(() => {
        return {
          buildAdjList: typeof window.buildAdjList === 'function',
          formatAdjList: typeof window.formatAdjList === 'function',
          graphEdgesExists: Array.isArray(window.graphEdges) && window.graphEdges.length > 0,
        };
      });
      expect(funcsExist.buildAdjList).toBe(true);
      expect(funcsExist.formatAdjList).toBe(true);
      expect(funcsExist.graphEdgesExists).toBe(true);

      // No uncaught page errors should have occurred during initial load
      expect(pageErrors).toHaveLength(0);

      // No console messages of type 'error' were emitted
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });
  });

  // Transition tests for ShowAdjListDemo (S0 -> S1)
  test.describe('Transition: ShowAdjListDemo (S0_Idle -> S1_AdjListDisplayed)', () => {
    test('Clicking the button displays the adjacency list and disables the button', async ({ page }) => {
      // This test validates the transition triggered by the user clicking #show-adjlist-btn:
      // - The adjacency list is computed and displayed in #demo-output
      // - The button becomes disabled after the action (single-use)
      const demo = new AdjListDemoPage(page);
      await demo.goto();

      // Click the button to trigger the transition
      await demo.clickShowButton();

      // The output should become visible
      await expect(demo.output).toBeVisible({ timeout: 2000 });

      // Verify the content matches the expected formatted adjacency list
      // The implementation produces lines with a trailing newline per entry.
      const expectedText =
        '0: 1, 4\n' +
        '1: 0, 2, 3, 4\n' +
        '2: 1, 3\n' +
        '3: 1, 2, 4\n' +
        '4: 0, 1, 3\n';
      const actualText = (await demo.getOutputText())?.trimEnd() + '\n'; // normalize possible missing trailing newline
      expect(actualText).toBe(expectedText);

      // The button should be disabled as the page disables it after a single use
      expect(await demo.isButtonDisabled()).toBe(true);

      // Re-check that computed style is not 'none' anymore (i.e., visible)
      const computedDisplayAfter = await demo.getOutputComputedDisplay();
      expect(computedDisplayAfter).not.toBe('none');

      // Confirm no uncaught page errors occurred during the click/transition
      expect(pageErrors).toHaveLength(0);

      // Confirm no console errors were emitted during the click
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });

    test('Clicking the already-disabled button should not re-run the demo (edge case)', async ({ page }) => {
      // This test validates the FSM exit action (button disabled) protects against re-trigger
      // and checks the behavior when trying to interact with a disabled control.
      const demo = new AdjListDemoPage(page);
      await demo.goto();

      // Trigger once to disable
      await demo.clickShowButton();
      await expect(demo.output).toBeVisible();

      // Ensure button is disabled
      expect(await demo.isButtonDisabled()).toBe(true);

      // Attempting to click a disabled button via locator.click() should fail (Playwright will wait and time out)
      // We assert that trying to click the disabled control rejects/throws.
      // Use a short timeout to avoid long waits.
      const locator = page.locator('#show-adjlist-btn');
      await expect(locator.isDisabled()).resolves.toBe(true);

      // Attempt to click and expect the action to be rejected / throw due to disabled element
      // Note: This verifies that the page enforces single-use through disabling and that Playwright surfaces that.
      await expect(locator.click({ timeout: 1000 })).rejects.toThrow();

      // No new page errors or console errors should have been produced by the failed attempt
      expect(pageErrors).toHaveLength(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });
  });

  // Additional unit-like checks for helper functions and edge behavior (without modifying page)
  test.describe('Helper function behavior and edge cases (pure JS usage on the page)', () => {
    test('formatAdjList should handle empty adjacency lists gracefully', async ({ page }) => {
      // This test calls formatAdjList in the page context with an empty array to validate its robustness.
      await page.goto(BASE_URL);

      // Call formatAdjList([]) in page context and expect an empty string result
      const result = await page.evaluate(() => {
        // call the existing function naturally; do not modify or patch it
        return window.formatAdjList([]);
      });

      expect(result).toBe('');
      // Confirm no page errors from evaluation
      // (pageErrors was set in beforeEach)
      expect(pageErrors).toHaveLength(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });

    test('buildAdjList with zero vertices returns an empty array (edge case)', async ({ page }) => {
      await page.goto(BASE_URL);

      const result = await page.evaluate(() => {
        // Call the existing buildAdjList with 0 vertices
        return window.buildAdjList(0, []);
      });

      // Expect an empty array
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);

      expect(pageErrors).toHaveLength(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });
  });

  // Final sanity test to ensure no unexpected runtime errors were emitted during the full interaction flow
  test('Full interaction flow emits no uncaught exceptions or console errors', async ({ page }) => {
    const demo = new AdjListDemoPage(page);
    await demo.goto();

    // Perform the full interaction
    await demo.clickShowButton();
    await expect(demo.output).toBeVisible();

    // Sanity: expected text lines are present
    const output = await demo.getOutputText();
    expect(output).toContain('0: 1, 4');
    expect(output).toContain('4: 0, 1, 3');

    // Assert there were no uncaught page errors across this test
    expect(pageErrors).toHaveLength(0);

    // Assert that console did not emit errors (but allow informational logs)
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors).toHaveLength(0);
  });
});