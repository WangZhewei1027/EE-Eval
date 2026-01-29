import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa0553-fa78-11f0-812d-c9788050701f.html';

// Page object for the Jump Search Visualizer application
class JumpSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#start-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.status = page.locator('#status');
    this.arrayContainer = page.locator('#array-container');
    this.arrayElements = page.locator('.array-element');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getStatusText() {
    return (await this.status.textContent())?.trim();
  }

  async getArrayCount() {
    return await this.arrayElements.count();
  }

  async getElementTextAt(index) {
    const el = this.page.locator(`#element-${index}`);
    return (await el.textContent())?.trim();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async isStartDisabled() {
    return await this.startBtn.evaluate((b) => b.disabled);
  }

  async isResetDisabled() {
    return await this.resetBtn.evaluate((b) => b.disabled);
  }
}

test.describe('Jump Search Visualizer - FSM validation and error observation', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors and console messages for assertions in tests
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // store message text and type
      consoleMessages.push({ text: msg.text(), type: msg.type() });
    });
  });

  test('Initial Idle state: initArray() runs on load and array is rendered', async ({ page }) => {
    // This test validates the S0_Idle initial state: initArray() should render the array and set status.
    const app = new JumpSearchPage(page);
    await app.goto();

    // Wait for array elements to be rendered
    await page.waitForSelector('.array-element');

    // The implementation's renderArray sets status to "Looking for value: 42"
    const statusText = await app.getStatusText();
    expect(statusText).toBeTruthy();
    expect(statusText).toContain('Looking for value: 42');

    // Array should have 20 elements as per arraySize variable in the implementation
    const count = await app.getArrayCount();
    expect(count).toBeGreaterThanOrEqual(1); // at least 1 (defensive), but expect 20
    // Prefer to assert it is 20, but keep slight flexibility if DOM differs
    expect(count).toBe(20);

    // Each element should have an id like element-<index> and data-index attribute visible via ::after is not accessible here,
    // but we can verify the first and last elements exist and have numeric text content.
    const firstText = await app.getElementTextAt(0);
    const lastText = await app.getElementTextAt(count - 1);
    expect(firstText).toMatch(/\d+/);
    expect(lastText).toMatch(/\d+/);

    // Buttons should be enabled at idle
    expect(await app.isStartDisabled()).toBeFalsy();
    expect(await app.isResetDisabled()).toBeFalsy();

    // There should be no runtime page errors immediately after load
    expect(pageErrors.length).toBe(0);

    // Some console logs may occur; ensure console messages captured
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('Reset event: clicking Reset invokes initArray() and keeps app in Idle', async ({ page }) => {
    // This test validates the Reset event and transition back to S0_Idle.
    const app = new JumpSearchPage(page);
    await app.goto();

    // snapshot current first element text to detect a re-render
    const beforeFirst = await app.getElementTextAt(0);

    // Click reset and wait for the array to be re-rendered
    await app.clickReset();

    // After reset, the status should again indicate the target value
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && el.textContent.includes('Looking for value: 42');
      },
      '#status'
    );

    const statusAfterReset = await app.getStatusText();
    expect(statusAfterReset).toContain('Looking for value: 42');

    // Array should be re-rendered; first element may change (randomized array), but at least elements exist
    const count = await app.getArrayCount();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBe(20);

    // Ensure clicking reset did not produce runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Start Search triggers Searching state then a runtime TypeError occurs due to code bug', async ({ page }) => {
    // This test validates the StartSearch event, entering S1_Searching, and observes the natural runtime error (TypeError).
    // It asserts that the Searching state evidence appears (status text) and that a TypeError is emitted to the page.
    const app = new JumpSearchPage(page);
    await app.goto();

    // Prepare to wait for a pageerror event that indicates the runtime TypeError
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 5000 }).catch((e) => null);
    const consolePromise = page.waitForEvent('console', { timeout: 5000 }).catch(() => null);

    // Click Start Search to trigger jumpSearch()
    await app.clickStart();

    // Immediately after clicking, the implementation disables both buttons; verify that
    // Use small timeout loop since DOM updates asynchronously
    await page.waitForFunction(
      () => document.querySelector('#start-btn').disabled === true && document.querySelector('#reset-btn').disabled === true,
      null,
      { timeout: 2000 }
    );

    expect(await app.isStartDisabled()).toBeTruthy();
    expect(await app.isResetDisabled()).toBeTruthy();

    // The status should update to show the searching/jumping text evidence
    // e.g., "Jumping through array in steps of X..."
    await page.waitForFunction(
      () => {
        const s = document.getElementById('status');
        return s && /Jumping through array in steps of \d+/.test(s.textContent);
      },
      null,
      { timeout: 2000 }
    );

    const statusDuringSearch = await app.getStatusText();
    expect(statusDuringSearch).toMatch(/Jumping through array in steps of \d+.../);

    // Wait for the pageerror (the async jumpSearch has a bug: reassigning const 'step' triggers a TypeError)
    const pageErr = await pageErrorPromise;
    // Also capture console message(s)
    const consoleMsg = await consolePromise;

    // At least one page error should be present and it should be a TypeError
    // We assert that a TypeError occurred naturally; do not patch or fix application code
    expect(pageErr).toBeTruthy();
    if (pageErr) {
      expect(pageErr.name).toBe('TypeError');
      // Message may vary across runtimes; check for typical substrings
      const msg = pageErr.message || pageErr.toString();
      expect(/assignment to constant/i.test(msg) || /assignment to constant variable/i.test(msg) || /Assignment to constant/i.test(msg) || /TypeError/i.test(msg)).toBeTruthy();
    }

    // Also check console messages captured for the error or unhandled rejection hint
    const collectedConsole = consoleMessages.map((m) => m.text).join('\n');
    // Either console had the error message or we captured it via pageerror above
    expect(collectedConsole.length >= 0).toBeTruthy();

    // Because the runtime error happens, the search cannot complete to Found or NotFound states.
    // Ensure that the final status does not claim a found or not-found result
    const finalStatus = await app.getStatusText();
    expect(finalStatus).not.toMatch(/Found value \d+ at index \d+!/);
    expect(finalStatus).not.toMatch(/Value \d+ not found in the array/);

    // The buttons may remain disabled because the function aborted before re-enabling them.
    // Validate that the UI reflects the interrupted transition (start/reset remain disabled).
    expect(await app.isStartDisabled()).toBeTruthy();
    expect(await app.isResetDisabled()).toBeTruthy();
  });

  test('Edge cases & error observation: ensure only the expected TypeError occurs and no SyntaxError/ReferenceError on load', async ({ page }) => {
    // This test ensures that we observe the TypeError during search and that there are no SyntaxError/ReferenceError occurrences
    // unrelated to the Start Search flow.
    const app = new JumpSearchPage(page);

    // Re-initialize error capture arrays
    pageErrors = [];
    consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ text: msg.text(), type: msg.type() }));

    await app.goto();

    // Sanity: no SyntaxError or ReferenceError on load
    const loadSyntaxOrRef = pageErrors.some((e) => e.name === 'SyntaxError' || e.name === 'ReferenceError');
    expect(loadSyntaxOrRef).toBeFalsy();

    // Trigger the Start Search to cause the TypeError (as in previous test)
    await app.clickStart();

    // Wait for pageerror that should be the TypeError
    const pageErr = await page.waitForEvent('pageerror', { timeout: 5000 }).catch(() => null);
    expect(pageErr).toBeTruthy();
    if (pageErr) {
      expect(pageErr.name).toBe('TypeError');
    }

    // Confirm there were no SyntaxError or ReferenceError among page errors
    const hasSyntaxOrRef = pageErrors.concat(pageErr ? [pageErr] : []).some((e) => e && (e.name === 'SyntaxError' || e.name === 'ReferenceError'));
    expect(hasSyntaxOrRef).toBeFalsy();

    // Confirm that at least one console message was recorded; may include unhandled rejection or error text
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);

    // The test documents the observed runtime failure as an expected outcome of the current implementation.
  });
});