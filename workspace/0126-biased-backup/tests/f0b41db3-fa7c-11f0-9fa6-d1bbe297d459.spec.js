import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b41db3-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object for interacting with the demo
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async button() {
    return this.page.locator('#demoButton');
  }

  async output() {
    return this.page.locator('#demoOutput');
  }

  async clickSend() {
    await (await this.button()).click();
  }

  async setRequestCount(value) {
    // Use localStorage as the page does; allowed action (does not modify runtime code)
    await this.page.evaluate((v) => {
      localStorage.setItem('requestCount', v);
    }, value);
  }

  async getOutputInnerHTML() {
    return this.page.evaluate(() => document.getElementById('demoOutput').innerHTML);
  }

  async isOutputVisible() {
    // Check computed style to ensure it's displayed
    return this.page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async getOutputText() {
    return this.page.evaluate(() => document.getElementById('demoOutput').innerText);
  }

  async clearLocalStorage() {
    await this.page.evaluate(() => localStorage.removeItem('requestCount'));
  }
}

test.describe('Load Balancing Demo FSM (f0b41db3-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to capture console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Reset captured arrays after each test (done implicitly by reassigning in beforeEach)
  });

  test('S0 Idle: initial render shows demo button and hidden output', async ({ page }) => {
    // Validate initial Idle state (S0_Idle) per FSM: renderPage() on entry.
    const demo = new DemoPage(page);
    await demo.goto();

    // Verify the Send Request button exists and is visible
    const button = await demo.button();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Send Request');

    // Verify the demo output exists but is hidden (display: none)
    const output = await demo.output();
    // The element exists in DOM
    await expect(output).toBeAttached();
    // But initial computed display should be 'none'
    const visible = await demo.isOutputVisible();
    expect(visible).toBe(false);

    // No page errors or console errors should have occurred on initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 on ButtonClick: output is displayed with server info and timestamp', async ({ page }) => {
    // This test validates the ButtonClick event and transition to Request Sent (S1_RequestSent)
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure deterministic rotation: set requestCount to '0' so next request goes to Server 2 (index 1)
    await demo.setRequestCount('0');

    // Click the demo button to trigger the transition
    await demo.clickSend();

    // Output should now be visible (S1 entry action displayOutput())
    const visible = await demo.isOutputVisible();
    expect(visible).toBe(true);

    // Output content should include the phrase 'Request processed at' and a timestamp-like pattern
    const text = await demo.getOutputText();
    expect(text).toContain('Request processed at');

    // Timestamp presence: basic regex match for time-like string (e.g., 1:23:45 PM or 13:23:45)
    const timestampRegex = /\d{1,2}:\d{2}:\d{2}/;
    expect(timestampRegex.test(text)).toBe(true);

    // Because we seeded requestCount = 0, the code increments to 1 and selects Server 2
    expect(text).toContain('Server 2');

    // Verify style.display turned to 'block' in the implementation
    const displayStyle = await page.evaluate(() => {
      const out = document.getElementById('demoOutput');
      return out.style.display;
    });
    expect(displayStyle).toBe('block');

    // Ensure no console errors or page errors during this transition
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Sequential clicks rotate servers in round-robin order', async ({ page }) => {
    // This test validates the round-robin behavior across multiple transitions
    const demo = new DemoPage(page);
    await demo.goto();

    // Reset localStorage to a known starting point: set to '0'
    await demo.setRequestCount('0');

    // Click sequence and expected servers:
    // Click 1 => (0+1)%3 = 1 -> Server 2
    // Click 2 => (1+1)%3 = 2 -> Server 3
    // Click 3 => (2+1)%3 = 0 -> Server 1
    // Click 4 => (0+1)%3 = 1 -> Server 2
    const expectedSequence = ['Server 2', 'Server 3', 'Server 1', 'Server 2'];
    const observed = [];

    for (let i = 0; i < expectedSequence.length; i++) {
      await demo.clickSend();
      // Await a short tick to allow DOM update
      await page.waitForTimeout(50);
      const text = await demo.getOutputText();
      // extract the bold server line (could be anywhere in text)
      const match = text.match(/Server\s\d/);
      observed.push(match ? match[0] : null);
    }

    expect(observed).toEqual(expectedSequence);

    // No unexpected runtime errors during sequential transitions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: non-numeric requestCount in localStorage is handled by page script (graceful degradation)', async ({ page }) => {
    // This test verifies behavior when localStorage.requestCount contains an invalid value (e.g., 'foo')
    const demo = new DemoPage(page);
    await demo.goto();

    // Set an invalid value in localStorage to simulate corrupted state
    await demo.setRequestCount('foo');

    // Click the demo button; the implementation uses parseInt and may produce NaN -> selectedServer undefined
    await demo.clickSend();

    // Output should still be displayed (the script sets display = 'block' before calculations)
    const visible = await demo.isOutputVisible();
    expect(visible).toBe(true);

    // The output may contain 'undefined' for the server if the script computes a NaN index
    const text = await demo.getOutputText();

    // Accept either a valid server name (if environment handles parse differently) OR the literal 'undefined'
    const containsServer = /Server\s[1-3]/.test(text);
    const containsUndefined = /undefined/.test(text);

    expect(containsServer || containsUndefined).toBe(true);

    // Verify the page did not throw unhandled exceptions (script handled the situation without bubbling)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Output DOM structure contains expected HTML fragments after a request', async ({ page }) => {
    // This test validates the innerHTML structure produced on S1 entry (presence of <p><strong>... and styled server line)
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure deterministic server selection
    await demo.setRequestCount('1'); // will increment to 2 -> Server 3
    await demo.clickSend();

    // Inspect innerHTML to confirm formatting lines included in FSM evidence
    const innerHTML = await demo.getOutputInnerHTML();

    // Validate that innerHTML contains a <p><strong>Request processed at ...</strong></p> fragment
    expect(innerHTML).toMatch(/<p>\s*<strong>Request processed at .*<\/strong><\/p>/);

    // Validate that the bold colored server line exists (inline style is used in implementation)
    expect(innerHTML).toMatch(/<p style="[^"]*font-weight: bold;[^"]*color: #[0-9a-fA-F]+;">\s*Server \d\s*<\/p>/);

    // Confirm no runtime errors were emitted while building the innerHTML
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});