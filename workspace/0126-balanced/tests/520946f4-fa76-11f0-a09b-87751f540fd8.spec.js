import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520946f4-fa76-11f0-a09b-87751f540fd8.html';

// Page Object Model for the Kruskal app
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generate-kmp-btn');
    this.runBtn = page.locator('#run-kmp-btn');
    this.graphDiv = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async graphHtml() {
    return await this.graphDiv.innerHTML();
  }

  async isGenerateVisible() {
    return await this.generateBtn.isVisible();
  }

  async isRunVisible() {
    return await this.runBtn.isVisible();
  }
}

test.describe('Kruskal\'s Algorithm Interactive - FSM validation', () => {
  let pageErrors;
  let consoleErrors;
  let consoleMessages;

  // Setup: navigate to page and attach listeners to capture console and page errors
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect page runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console messages and separately console errors
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the app for each test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach debug info to the test report if available
    // (Playwright will automatically show assertions; this is just extra context)
    if (pageErrors.length > 0) {
      testInfo.attach('pageErrors', { body: JSON.stringify(pageErrors.map(e => ({ message: e.message, stack: e.stack })), null, 2), contentType: 'application/json' });
    }
    if (consoleErrors.length > 0) {
      testInfo.attach('consoleErrors', { body: JSON.stringify(consoleErrors, null, 2), contentType: 'application/json' });
    }
    if (consoleMessages.length > 0) {
      testInfo.attach('consoleMessages', { body: JSON.stringify(consoleMessages, null, 2), contentType: 'application/json' });
    }
  });

  test('Idle state (S0_Idle): Page loads with controls present and graph empty', async ({ page }) => {
    // Validate initial (Idle) state: buttons exist and graph is empty, no runtime errors on load
    const app = new KruskalPage(page);

    // Buttons should be visible on initial render
    expect(await app.isGenerateVisible()).toBe(true);
    expect(await app.isRunVisible()).toBe(true);

    // Graph div should be present and initially empty
    const graphHtml = await app.graphHtml();
    expect(graphHtml).toBe(''); // FSM evidence shows an empty #graph initially

    // No page errors should have occurred just from loading the page
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 (GenerateGraph): Clicking Generate Graph triggers generation and runtime error is observed', async ({ page }) => {
    // This test validates the GenerateGraph event/transition.
    // According to the implementation, clicking the button runs generateGraph(),
    // but the implementation contains bugs that produce runtime errors.
    const app = new KruskalPage(page);

    // Ensure preconditions
    expect(await app.isGenerateVisible()).toBe(true);

    // Click the Generate Graph button and wait briefly for any page error to be emitted.
    // We intentionally allow and assert on runtime errors (ReferenceError/TypeError) rather than fixing them.
    const errorPromise = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);

    await app.clickGenerate();

    const pageError = await errorPromise;

    // We expect a runtime error to occur due to the buggy implementation.
    expect(pageError).not.toBeNull();
    expect(typeof pageError.message).toBe('string');
    expect(pageError.message.length).toBeGreaterThan(0);

    // The graph should not have valid generated rows due to the error.
    const html = await app.graphHtml();
    // Either empty or not containing expected <tr> entries
    expect(html.includes('<tr>')).toBe(false);

    // Also ensure that at least one console error or page error was captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Transition S1 -> S2 (RunAlgorithm): Clicking Run Kruskal\'s Algorithm triggers ReferenceError (runKMP undefined)', async ({ page }) => {
    // This test validates the RunAlgorithm event/transition.
    // The implementation adds a click listener for runKMP but no runKMP function is defined,
    // so clicking should raise a ReferenceError for runKMP.
    const app = new KruskalPage(page);

    // Ensure preconditions
    expect(await app.isRunVisible()).toBe(true);

    const errorPromise = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);

    await app.clickRun();

    const pageError = await errorPromise;

    // We expect a ReferenceError due to missing runKMP function.
    expect(pageError).not.toBeNull();
    const msg = pageError.message.toLowerCase();

    // Assert that the message references runkmp or 'not defined' (browser differences)
    expect(msg.includes('runkmp') || msg.includes('not defined') || msg.includes('is not defined')).toBe(true);

    // Also assert we recorded at least one page error in the capture
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('End-to-end: Click Generate then Run -> both runtime errors captured and graph not correctly rendered', async ({ page }) => {
    // This test performs both transitions in sequence to simulate the full FSM flow.
    const app = new KruskalPage(page);

    // Click generate and expect an error (as per buggy implementation)
    const genErrorPromise = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    await app.clickGenerate();
    const genError = await genErrorPromise;
    expect(genError).not.toBeNull();

    // After a failed generation, clicking run should also raise an error (missing runKMP)
    const runErrorPromise = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    await app.clickRun();
    const runError = await runErrorPromise;
    expect(runError).not.toBeNull();

    // Both errors should be present in our collected pageErrors array
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);

    // Graph content remains invalid / not the expected MST table rows
    const html = await app.graphHtml();
    expect(html.includes('<tr>')).toBe(false);
  });

  test('Edge cases: Multiple rapid clicks on Generate Graph produce runtime errors (robustness test)', async ({ page }) => {
    // Rapidly click the generate button multiple times and ensure at least one error occurs.
    const app = new KruskalPage(page);

    // Start multiple clicks without awaiting errors individually
    const clickCount = 3;
    const waitForError = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    for (let i = 0; i < clickCount; i++) {
      // Fire-and-forget clicks
      void app.clickGenerate();
    }
    const firstError = await waitForError;
    expect(firstError).not.toBeNull();

    // We expect at least one page error captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Verify onEnter/onExit action existence: renderPage() not defined on window (FSM mentions renderPage)', async ({ page }) => {
    // FSM mentions an entry action renderPage() for the Idle state.
    // Verify whether renderPage exists on the page (we expect it NOT to exist in the provided implementation).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Also validate presence/absence of other functions referenced in the HTML:
    const generateGraphType = await page.evaluate(() => typeof window.generateGraph);
    const kruskalType = await page.evaluate(() => typeof window.kruskalAlgorithm);
    const generateMSTType = await page.evaluate(() => typeof window.generateMST);
    const runKMPType = await page.evaluate(() => typeof window.runKMP);

    // Implementation DOES define generateGraph, kruskalAlgorithm and generateMST
    expect(generateGraphType === 'function' || generateGraphType === 'object').toBe(true);
    expect(kruskalType === 'function' || kruskalType === 'object').toBe(true);
    expect(generateMSTType === 'function' || generateMSTType === 'object').toBe(true);

    // runKMP is expected to be undefined (missing function referenced in event listener)
    expect(runKMPType).toBe('undefined');
  });
});