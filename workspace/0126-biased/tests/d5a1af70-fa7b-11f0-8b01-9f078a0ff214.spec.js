import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1af70-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object encapsulating interactions and queries for the demo page
class GreedyPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.demo = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the basic elements we expect to be present in the DOM
    await this.button.waitFor({ state: 'visible', timeout: 2000 });
    await this.demo.waitFor({ state: 'attached', timeout: 2000 });
  }

  async clickDemo() {
    await this.button.click();
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async isDemoHidden() {
    return await this.demo.evaluate((el) => el.classList.contains('hidden'));
  }

  async isDemoVisible() {
    // Visible if not hidden and computed style not display: none
    const hasHiddenClass = await this.demo.evaluate((el) => el.classList.contains('hidden'));
    if (!hasHiddenClass) {
      const display = await this.demo.evaluate((el) => {
        return window.getComputedStyle(el).getPropertyValue('display');
      });
      return display !== 'none';
    }
    return false;
  }
}

test.describe('Greedy Algorithms demo - FSM states and transitions', () => {
  // Attach listeners for console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will set up its own listeners as needed.
  });

  // Test initial S0_Idle state: button visible and demo hidden
  test('S0_Idle: on page load the demo button is present and demo content is hidden', async ({ page }) => {
    // Track console errors and page errors for this test
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const greedy = new GreedyPage(page);
    await greedy.goto();

    // Validate button exists and text matches expected label
    await expect(greedy.button).toBeVisible();
    const text = await greedy.getButtonText();
    expect(text && text.trim()).toBe('Show Coin Change Example');

    // Validate demo div exists and is hidden (has class 'hidden')
    const hidden = await greedy.isDemoHidden();
    expect(hidden).toBe(true);

    // Ensure no unexpected page errors or console errors occurred during load
    expect(pageErrors.length, 'no page errors during initial load').toBe(0);
    expect(consoleErrors.length, 'no console.error messages during initial load').toBe(0);
  });

  // Test transition S0 -> S1: clicking the button shows the demo
  test('ShowExample event: clicking the demo button toggles demo visible (S0 -> S1)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const greedy = new GreedyPage(page);
    await greedy.goto();

    // Click to show demo
    await greedy.clickDemo();

    // After click, demo should be visible (not have .hidden and computed display not none)
    const visible = await greedy.isDemoVisible();
    expect(visible).toBe(true);

    // Ensure no page errors or console errors triggered by the click
    expect(pageErrors.length, 'no page errors after show click').toBe(0);
    expect(consoleErrors.length, 'no console.error messages after show click').toBe(0);
  });

  // Test transition S1 -> S0: clicking again hides the demo
  test('ShowExample event: clicking the demo button again hides the demo (S1 -> S0)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const greedy = new GreedyPage(page);
    await greedy.goto();

    // Toggle twice: show then hide
    await greedy.clickDemo(); // show
    expect(await greedy.isDemoVisible()).toBe(true);
    await greedy.clickDemo(); // hide
    expect(await greedy.isDemoHidden()).toBe(true);

    // Confirm no runtime errors occurred during toggling
    expect(pageErrors.length, 'no page errors after toggling twice').toBe(0);
    expect(consoleErrors.length, 'no console.error messages after toggling twice').toBe(0);
  });

  // Edge case: rapid multiple clicks and parity check
  test('Edge case: rapid clicks toggle visibility parity correctly', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const greedy = new GreedyPage(page);
    await greedy.goto();

    // Click 3 times quickly - resulting visibility should be same as 1 click (odd number)
    await greedy.button.click({ clickCount: 1 });
    await greedy.button.click({ clickCount: 1 });
    await greedy.button.click({ clickCount: 1 });

    expect(await greedy.isDemoVisible()).toBe(true);

    // Click one more time (4th click) to return to hidden
    await greedy.button.click();
    expect(await greedy.isDemoHidden()).toBe(true);

    // Ensure no page errors occurred during rapid interaction
    expect(pageErrors.length, 'no page errors during rapid clicks').toBe(0);
    expect(consoleErrors.length, 'no console.error during rapid clicks').toBe(0);
  });

  // Verify onEnter action renderPage() mentioned in FSM — the implementation does not define renderPage.
  // We intentionally attempt to invoke renderPage in the page context to verify that it is not defined
  // and that calling it produces a ReferenceError in the page environment (this validates the FSM's
  // declared entry action is not implemented in the delivered HTML/JS).
  test('FSM entry action renderPage() should not be defined in the page and calling it results in ReferenceError', async ({ page }) => {
    // Collect pageerrors emitted as a result of attempting to call the undefined function
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const greedy = new GreedyPage(page);
    await greedy.goto();

    // Attempt to call renderPage() in the page context. This is intentionally done to observe the natural
    // ReferenceError (we do not patch or define renderPage).
    let thrown;
    try {
      // This will run in the page context and should throw because renderPage is not defined.
      await page.evaluate(() => {
        // Directly call the function expected by the FSM entry action
        // Intentionally not guarded by typeof to provoke a ReferenceError as per the test requirements.
        renderPage();
      });
    } catch (err) {
      thrown = err;
    }

    // We expect an error was thrown and it references renderPage being undefined.
    expect(thrown, 'calling renderPage should throw').toBeTruthy();
    // The error message in Chromium typically contains "renderPage is not defined" or ReferenceError;
    // assert the message mentions renderPage so we are confident it failed for the expected reason.
    expect(String(thrown.message)).toContain('renderPage');

    // Also verify a pageerror event was emitted containing the ReferenceError
    // Note: pageerror occurrences depend on the runtime; we at least expect one such error recorded.
    expect(pageErrors.length > 0, 'pageerror should have been emitted for calling undefined renderPage').toBe(true);
    const matched = pageErrors.some((e) => String(e.message).includes('renderPage'));
    expect(matched, 'at least one pageerror message should mention renderPage').toBe(true);
  });

  // Validate that normal operations do not produce console.error traces (sanity check)
  test('Sanity: normal interactions do not log unexpected console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const greedy = new GreedyPage(page);
    await greedy.goto();

    // Perform a sequence of normal interactions
    await greedy.clickDemo(); // show
    await greedy.clickDemo(); // hide
    await greedy.clickDemo(); // show

    // After normal interactions, there should be no console.error messages
    expect(consoleErrors.length, 'no console.error during normal interactions').toBe(0);
  });
});