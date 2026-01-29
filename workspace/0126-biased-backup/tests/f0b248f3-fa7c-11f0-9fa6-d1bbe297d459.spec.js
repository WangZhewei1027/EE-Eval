import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b248f3-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object for the Exponential Search demo page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.button');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.button.click();
  }

  async getOutputText() {
    return await this.output.innerText();
  }

  async getOutputHTML() {
    return await this.output.innerHTML();
  }

  async waitForHeader(timeout = 2000) {
    // The demo inserts an <h3> at start of runDemo, wait for it to appear
    return await this.page.waitForSelector('#demoOutput h3', { timeout });
  }

  async foundMessageLocator() {
    return this.page.locator('#demoOutput p', { hasText: 'Found target 23 at index' });
  }
}

test.describe('Exponential Search Interactive Demo - FSM Validation', () => {
  // Collect console messages and page errors for assertions.
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

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('State S0_Idle (Initial State)', () => {
    test('S0_Idle: page renders with Run Demonstration button and placeholder output', async ({ page }) => {
      // This test validates the initial Idle state described in the FSM:
      // - The Run Demonstration button exists and has the expected attributes.
      // - The demo output container displays the placeholder text.
      const demo = new DemoPage(page);
      await demo.goto();

      // Button should be visible and have the expected text
      await expect(demo.button).toBeVisible();
      await expect(demo.button).toHaveText('Run Demonstration');

      // Verify the onclick attribute evidence exists as per FSM
      const onclickAttr = await demo.button.getAttribute('onclick');
      // The implementation sets onclick="runDemo()"
      await expect(onclickAttr).toBe('runDemo()');

      // The demo output should contain the initial placeholder text
      await expect(demo.output).toBeVisible();
      const outputText = await demo.getOutputText();
      await expect(outputText).toContain('Demonstration output will appear here...');

      // Ensure no unexpected runtime errors occurred while loading the Idle state
      // (e.g., missing renderPage() being invoked by the environment)
      // We assert that there were no page errors captured so far.
      await expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition RunDemo: S0_Idle -> S1_DemoRunning', () => {
    test('Clicking Run Demonstration transitions to Demo Running and shows step-by-step output', async ({ page }) => {
      // This test validates the event RunDemo and the S1_DemoRunning state:
      // - Clicking the button triggers the runDemo() implementation
      // - The #demoOutput is updated with Phase 1 and Phase 2 information
      // - The final "Found target 23 at index 5!" message appears with the expected styling
      const demo = new DemoPage(page);
      await demo.goto();

      // Click the button to trigger the demo (this is the FSM event)
      await demo.clickRun();

      // Wait for the demo to start (it inserts an <h3> right away)
      await demo.waitForHeader(2000);

      // The output should mention the array and the target
      const html = await demo.getOutputHTML();
      expect(html).toContain('Searching for 23 in');
      expect(html).toContain('2, 5, 8, 12, 16, 23, 38, 56, 72, 91');

      // Confirm Phase 1 messages are present: at least one "Checking index" line
      expect(html).toMatch(/Checking index \d+/);

      // Confirm Phase 2 message indicating the binary search range
      expect(html).toContain('Performing binary search between indices 4 and 8');

      // Confirm final found message is present
      const foundLocator = await demo.foundMessageLocator();
      await expect(foundLocator).toHaveCount(1);

      // Verify inline style attributes of the found message (color green & bold)
      const foundHandle = await foundLocator.first().elementHandle();
      const style = await page.evaluate((el) => {
        return {
          color: el.style.color || window.getComputedStyle(el).color,
          fontWeight: el.style.fontWeight || window.getComputedStyle(el).fontWeight,
          text: el.innerText,
        };
      }, foundHandle);
      // The implementation sets style="color: green; font-weight: bold;"
      expect(style.text).toMatch(/Found target 23 at index 5!/);
      // Color computed might be "green" or "rgb(...)", ensure 'green' is part or computed returns rgb for green
      expect(style.color).toMatch(/green|rgb\(/i);
      expect(style.fontWeight === 'bold' || style.fontWeight === '700' || style.fontWeight === '700').toBeTruthy();

      // Ensure no page errors were thrown during the demo
      await expect(pageErrors.length).toBe(0);

      // Also ensure console did not log any uncaught exceptions (error type)
      const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
      expect(consoleErrorCount).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking the Run Demonstration button multiple times behaves deterministically and does not produce errors', async ({ page }) => {
      // This test covers an edge case: repeated triggering of the transition.
      // It ensures repeated invocations of runDemo() re-render the demoOutput cleanly
      // and do not cause uncaught exceptions or inconsistent DOM states.
      const demo = new DemoPage(page);
      await demo.goto();

      // First run
      await demo.clickRun();
      await demo.waitForHeader(2000);
      const firstRunHtml = await demo.getOutputHTML();
      expect(firstRunHtml).toContain('Found target 23 at index 5!');

      // Capture snapshot of console and page errors so far
      const errorsBefore = [...pageErrors];
      const consoleBefore = [...consoleMessages];

      // Click again quickly to re-run; runDemo replaces innerHTML at start
      await demo.clickRun();

      // Wait again for header -- it should appear promptly
      await demo.waitForHeader(2000);
      const secondRunHtml = await demo.getOutputHTML();
      expect(secondRunHtml).toContain('Found target 23 at index 5!');

      // Verify that the DOM was reset (the first line is <h3> introduced anew)
      // Ensuring that content is similar but not duplicated (innerHTML starts with <h3>)
      expect(secondRunHtml.trim().startsWith('<h3>')).toBeTruthy();

      // There should be no additional page errors introduced by the second click
      expect(pageErrors.length).toBe(errorsBefore.length);

      // No new console errors introduced
      const errorCountNow = consoleMessages.filter((m) => m.type === 'error').length;
      const errorCountBefore = consoleBefore.filter((m) => m.type === 'error').length;
      expect(errorCountNow).toBe(errorCountBefore);
    });

    test('Verify that missing FSM-defined entry action renderPage() does not throw an unexpected ReferenceError at load', async ({ page }) => {
      // FSM mentions an entry action renderPage() for S0_Idle; the actual HTML does not define it.
      // We must "observe console logs and page errors" and assert what occurred naturally.
      // The page as-served should not throw because nothing calls renderPage().
      const demo = new DemoPage(page);
      await demo.goto();

      // Wait briefly to allow any potential errors to surface
      await page.waitForTimeout(200);

      // Check captured page errors for ReferenceError mentioning renderPage
      const refErrors = pageErrors.filter((err) =>
        String(err).includes('ReferenceError') && String(err).includes('renderPage')
      );

      // The correct behavior given the page is unmodified is that no such ReferenceError occurs.
      // Assert that renderPage was not called implicitly by the environment (no ReferenceError)
      expect(refErrors.length).toBe(0);

      // Also assert we have zero page errors in general for the initial load
      expect(pageErrors.length).toBe(0);

      // And assert console did not have 'renderPage is not defined' messages
      const consoleRenderPage = consoleMessages.filter((m) =>
        m.text.includes('renderPage') && /not defined|ReferenceError/i.test(m.text)
      );
      expect(consoleRenderPage.length).toBe(0);
    });

    test('Verify that the demo handles non-existing target gracefully (manually simulate by altering DOM and clicking) - without patching code', async ({ page }) => {
      // Edge case: The UI and JS are fixed and search target is hardcoded to 23.
      // We must NOT modify functions or globals. However, we can simulate user-visible effects:
      // Since we cannot change runDemo code, verify that when target not present cannot be triggered.
      // Instead, we assert that the code path for "not found" is present in source and could execute.
      // We will check that the demo's script contains the 'Target not found in the array' string,
      // indicating the implementation handles not found scenario. We only read DOM/script, no patching.
      const demo = new DemoPage(page);
      await demo.goto();

      // The 'not found' path appends '<p>Target not found in the array</p>' in runDemo.
      // Ensure that this exact phrase appears somewhere in the page source or scripts.
      const pageContent = await page.content();
      expect(pageContent).toContain('Target not found in the array');

      // Because the actual demo uses a target that exists (23), the 'not found' message won't appear
      // during normal runs; we therefore only assert existence of the code branch in the page,
      // not that it executed. This verifies presence of error-handling logic without modifying runtime.
    });
  });

  test.afterEach(async ({ page }) => {
    // Final sanity check after each test: assert there are no uncaught exceptions
    // captured in pageErrors (if there are any, include them in the assertion message).
    if (pageErrors.length > 0) {
      // Provide the errors to help debugging but still fail the test
      const detailed = pageErrors.map((e) => String(e)).join('\n---\n');
      // Use a Playwright expectation to fail with context
      expect(pageErrors.length, `Unexpected page errors:\n${detailed}`).toBe(0);
    }

    // Also ensure console had no 'error' type messages
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    if (consoleErrors.length > 0) {
      const details = consoleErrors.map((c) => c.text).join('\n---\n');
      expect(consoleErrors.length, `Console errors were logged:\n${details}`).toBe(0);
    }
  });
});