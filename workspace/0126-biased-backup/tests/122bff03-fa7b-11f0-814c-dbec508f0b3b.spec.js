import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bff03-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Kruskal demo page
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      m: '#m',
      e: '#e',
      k: '#k',
      kruskalButton: '#kruskal-button',
      runButton: '#run-button',
      output: '#kruskal-output',
      inputContainer: '#input-container',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickRun() {
    await this.page.click(this.selectors.runButton);
  }

  async clickKruskal() {
    await this.page.click(this.selectors.kruskalButton);
  }

  async getOutputText() {
    return await this.page.$eval(this.selectors.output, (el) => el.innerHTML);
  }

  async getInputValues() {
    return {
      m: await this.page.$eval(this.selectors.m, (el) => el.value),
      e: await this.page.$eval(this.selectors.e, (el) => el.value),
      k: await this.page.$eval(this.selectors.k, (el) => el.value),
    };
  }

  async isRunDefined() {
    return await this.page.evaluate(() => typeof run === 'function');
  }

  async isRenderPageDefined() {
    return await this.page.evaluate(() => typeof renderPage !== 'undefined');
  }
}

test.describe('Kruskal Algorithm Interactive App (FSM tests)', () => {
  // Collect console/error messages for each test so we can assert on them
  let consoleErrors;
  let consoleWarnings;
  let consoleLogs;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];
    consoleLogs = [];
    pageErrors = [];

    // Observe console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleErrors.push(text);
      else if (type === 'warning') consoleWarnings.push(text);
      else consoleLogs.push({ type, text });
    });

    // Observe uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // Capture the stack/message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    const demo = new KruskalPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // nothing to teardown globally — page closed by Playwright test runner
  });

  test('S0_Idle: Initial Idle state renders inputs, buttons, and output container', async ({ page }) => {
    // This test validates presence of UI elements that indicate the Idle state (S0_Idle)
    const demo = new KruskalPage(page);

    // Validate inputs and their default values
    const inputs = await demo.getInputValues();
    expect(inputs.m).toBe('3'); // maximum edges default value
    expect(inputs.e).toBe('0'); // minimum edges default value
    expect(inputs.k).toBe('4'); // number of edges default value

    // Validate buttons exist
    await expect(page.locator(demo.selectors.kruskalButton)).toBeVisible();
    await expect(page.locator(demo.selectors.runButton)).toBeVisible();

    // Validate output container exists and is initially empty
    const outputText = await demo.getOutputText();
    // The implementation joins an empty array with '\n' => empty string
    expect(outputText).toBe('');

    // The FSM mentions an entry action renderPage(); the implementation does not define renderPage.
    // We assert that renderPage is not defined on the page (we do not modify the page).
    const renderPageDefined = await demo.isRenderPageDefined();
    expect(renderPageDefined).toBe(false);

    // Ensure no page errors were emitted during initial render
    expect(pageErrors).toEqual([]);
    // Ensure no console.error messages came from the page at load
    // We allow other console logs/warnings but assert no console errors.
    // This verifies the page loaded with no runtime errors.
    expect(consoleErrors).toEqual([]);
  });

  test('S0 -> S1 transition via RunClick: clicking Run triggers run() and updates output', async ({ page }) => {
    // This test validates the RunClick event and the transition to S1_Running.
    const demo = new KruskalPage(page);

    // run() should be defined in the page script
    const runDefined = await demo.isRunDefined();
    expect(runDefined).toBe(true);

    // Click the Run button to trigger the transition
    await demo.clickRun();

    // Give the page a small moment to process (no async in page code, but safe)
    await page.waitForTimeout(50);

    // After running, the output should reflect the result of kruskal() => with no edges, it's empty
    const outputAfterRun = await demo.getOutputText();
    expect(outputAfterRun).toBe(''); // expects empty string given no edges added

    // Confirm no unexpected runtime errors occurred during the run transition
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('S0 -> S1 transition via KruskalClick: clicking Kruskal button triggers run() and updates output', async ({ page }) => {
    // This test validates that the Kruskal's Algorithm button triggers run() via its click handler.
    const demo = new KruskalPage(page);

    // Ensure the kruskal button is present
    await expect(page.locator(demo.selectors.kruskalButton)).toBeVisible();

    // Click the Kruskal button which has an arrow function that calls run()
    await demo.clickKruskal();

    // Wait briefly to allow any synchronous DOM updates
    await page.waitForTimeout(50);

    // Expect the output to be empty string (no edges were added)
    const output = await demo.getOutputText();
    expect(output).toBe('');

    // Again, ensure no page-level exceptions or console errors were emitted as a result
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: multiple sequential clicks on Run and Kruskal produce stable behavior with no errors', async ({ page }) => {
    // This test simulates repeated user interaction to ensure stability (idempotence) of run()
    const demo = new KruskalPage(page);

    // Click run multiple times
    for (let i = 0; i < 3; i++) {
      await demo.clickRun();
      await page.waitForTimeout(20);
    }

    // Click kruskal multiple times
    for (let i = 0; i < 2; i++) {
      await demo.clickKruskal();
      await page.waitForTimeout(20);
    }

    // Output remains empty as there are no edges
    const out = await demo.getOutputText();
    expect(out).toBe('');

    // No runtime errors were produced during rapid interaction
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: removing the Run button from the DOM does not prevent Kruskal button from invoking run()', async ({ page }) => {
    // This test ensures the kruskal-button's click handler calls run() directly and does not depend on the run-button
    const demo = new KruskalPage(page);

    // Remove the run button from the DOM
    await page.evaluate(() => {
      const btn = document.getElementById('run-button');
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    });

    // Ensure run-button is no longer in the DOM
    const runButtonCount = await page.$$eval('#run-button', (els) => els.length);
    expect(runButtonCount).toBe(0);

    // But the kruskal-button should still be present and wired to run()
    await demo.clickKruskal();
    await page.waitForTimeout(20);

    // Output should remain empty (no edges) but the click should have executed without error
    const outputText = await demo.getOutputText();
    expect(outputText).toBe('');

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Sanity check: verify kruskal() algorithm is present and returns array for no edges', async ({ page }) => {
    // This test directly invokes kruskal() in the page context to assert behavior of the implemented algorithm
    // We do this without modifying any global functions/definitions.
    const result = await page.evaluate(() => {
      // kruskal is defined in the page; call it and capture the returned value
      try {
        if (typeof kruskal === 'function') {
          return { ok: true, typeofResult: Array.isArray(kruskal()) ? 'array' : typeof kruskal() };
        } else {
          return { ok: false, reason: 'kruskal-not-defined' };
        }
      } catch (err) {
        return { ok: false, reason: String(err) };
      }
    });

    // The kruskal function should exist and return an array (empty) when no edges are present
    expect(result.ok).toBe(true);
    expect(result.typeofResult).toBe('array');

    // No page errors triggered by direct invocation
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Behavioral assertion: there is no global renderPage function and no attempt to call it (no ReferenceError)', async ({ page }) => {
    // The FSM mentions renderPage() as an entry action for S0_Idle, but the implementation does not provide it.
    // This test asserts that the page does not throw a ReferenceError related to renderPage on load.
    // We have been collecting pageErrors on load in beforeEach; assert that none mention 'renderPage'
    const renderPageErrors = pageErrors.filter((m) => m.includes('renderPage'));
    expect(renderPageErrors.length).toBe(0);

    // Also explicitly assert renderPage is undefined on the page (we are not injecting or defining it)
    const renderPageExists = await page.evaluate(() => typeof renderPage !== 'undefined');
    expect(renderPageExists).toBe(false);
  });
});