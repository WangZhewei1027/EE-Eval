import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c854e0-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo app
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#appendBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async isButtonVisible() {
    return this.button.isVisible();
  }

  async isButtonEnabled() {
    return this.button.isEnabled();
  }

  async clickAppend() {
    await this.button.click();
  }

  // Click append and wait until Size line updates to expectedSize
  async clickAppendAndWaitForSize(expectedSize, timeout = 2000) {
    await Promise.all([
      this.button.click(),
      this.page.waitForFunction(
        (selector, size) => {
          const el = document.querySelector(selector);
          if (!el) return false;
          return el.textContent.includes(`Size: ${size}`);
        },
        this.output.selector,
        expectedSize,
        { timeout }
      )
    ]);
  }

  async getOutputText() {
    return (await this.output.innerText()).trim();
  }

  async getOutputLines() {
    const txt = await this.getOutputText();
    return txt.split('\n').map(l => l.trim()).filter(Boolean);
  }

  async isButtonDisabled() {
    return !(await this.isButtonEnabled());
  }
}

test.describe('Dynamic Arrays Demo - FSM based end-to-end tests', () => {
  // Collect console and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors
    page.on('console', msg => {
      const type = msg.type(); // e.g., 'log', 'error'
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', err => {
      // err is an Error object representing an unhandled exception in the page
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    // Navigate to the page under test
    const demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // no-op here, but place left for explicit teardown if needed
  });

  test('S0 Idle: initial render has button and initial demo output (renderPage entry)', async ({ page }) => {
    // Validate initial state S0_Idle UI and no runtime errors at load
    const demo = new DemoPage(page);

    // The button should be present, visible and enabled
    await expect(demo.button).toBeVisible();
    await expect(demo.button).toHaveText('Append Next Number');
    await expect(demo.button).toBeEnabled();

    // The demo output should display the initial array, size and capacity
    const text = await demo.getOutputText();

    // Check the key lines exist in the initial rendering
    expect(text).toContain('Array contents: []');
    expect(text).toContain('Size: 0');
    expect(text).toContain('Capacity: 0');

    // Ensure no page errors or console 'error' level messages during initial render
    // (We observe console and page errors per the instructions.)
    // If any runtime errors occurred they will be captured by pageErrors or consoleErrors.
    expect(pageErrors.length, 'no uncaught page errors on load').toBe(0);
    expect(consoleErrors.length, 'no console.error messages on load').toBe(0);
  });

  test('Transition S0 -> S1 and subsequent S1 self-transitions: appending numbers updates contents/size/capacity', async ({ page }) => {
    const demo = new DemoPage(page);

    // 1) First click: expect Array contents: [1], Size:1, Capacity:1
    await demo.clickAppendAndWaitForSize(1);
    let out = await demo.getOutputText();
    expect(out).toContain('Array contents: [1]');
    expect(out).toContain('Size: 1');
    expect(out).toContain('Capacity: 1');

    // 2) Second click: expect [1, 2], Size:2, Capacity:2
    await demo.clickAppendAndWaitForSize(2);
    out = await demo.getOutputText();
    expect(out).toContain('Array contents: [1, 2]');
    expect(out).toContain('Size: 2');
    expect(out).toContain('Capacity: 2');

    // 3) Third click: expect [1, 2, 3], Size:3, Capacity:4 (resize to 4)
    await demo.clickAppendAndWaitForSize(3);
    out = await demo.getOutputText();
    expect(out).toContain('Array contents: [1, 2, 3]');
    expect(out).toContain('Size: 3');
    expect(out).toContain('Capacity: 4');

    // 5) Click to reach size 5 (triggers resize from 4->8 on the 5th insertion)
    await demo.clickAppendAndWaitForSize(4);
    await demo.clickAppendAndWaitForSize(5);
    out = await demo.getOutputText();
    expect(out).toContain('Size: 5');
    expect(out).toContain('Capacity: 8');

    // 10) Click up to size 10 (capacity should be 16 after resizing at 9th insertion)
    // we are currently at size 5, do 5 more clicks
    for (let expected = 6; expected <= 10; expected++) {
      await demo.clickAppendAndWaitForSize(expected);
    }
    out = await demo.getOutputText();
    // verify content includes numbers 1..10, size 10 and capacity 16
    expect(out).toContain('Size: 10');
    expect(out).toContain('Capacity: 16');
    // simple content check for start and end of the array string
    expect(out).toContain('Array contents: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]');

    // ensure no unexpected runtime errors during active appending
    // We still have access to captured page errors and console errors via event handlers defined in beforeEach
    // (They would have been pushed to pageErrors/consoleErrors arrays)
    // Access them via page.evaluate? No. We assert they remain empty by re-checking the Playwright captured arrays.
    // Note: The arrays are in the closure; they were filled by page.on listeners earlier.
    expect(pageErrors.length, 'no uncaught page errors during appending').toBe(0);
    expect(consoleErrors.length, 'no console.error messages during appending').toBe(0);
  });

  test('Transition S1 -> S2 MaxReached: after exceeding max number displays reached message and disables button; further clicks do nothing', async ({ page }) => {
    const demo = new DemoPage(page);

    // Click 20 times to insert numbers 1..20.
    // We will wait for sizes progressively to ensure deterministic behavior.
    for (let expected = 1; expected <= 20; expected++) {
      await demo.clickAppendAndWaitForSize(expected);
    }

    // After 20 inserts, nextNum becomes 21 internally. The message is shown when next click happens (nextNum > maxNum).
    // Click once more to trigger the MaxReached transition/path.
    await demo.clickAppend(); // this click should trigger the "Reached maximum demonstration number (20)." branch

    // Wait for the message to appear in the output area - it appends a new paragraph separated by blank lines
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      if (!el) return false;
      return el.textContent.includes('Reached maximum demonstration number (20).');
    }, demo.output.selector);

    const out = await demo.getOutputText();
    expect(out).toContain('Reached maximum demonstration number (20).');

    // Button should be disabled after reaching max
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBe(true);

    // Attempt to click the disabled button (should do nothing). We'll try to click and then confirm the message isn't appended a second time.
    // Because the button is disabled, Playwright's click will still attempt but the DOM won't change; we guard by checking number of occurrences of the message.
    const occurrencesBefore = (out.match(/Reached maximum demonstration number \(20\)\./g) || []).length;
    // Try clicking programmatically (it may throw if element disabled; wrap in try/catch)
    try {
      await demo.clickAppend();
    } catch (e) {
      // ignore click errors (browser may prevent click on disabled)
    }

    // Short wait and re-evaluate output
    await page.waitForTimeout(200);
    const outAfter = await demo.getOutputText();
    const occurrencesAfter = (outAfter.match(/Reached maximum demonstration number \(20\)\./g) || []).length;
    // The message should not have been added again
    expect(occurrencesAfter).toBe(occurrencesBefore);

    // Validate no unexpected runtime errors at MaxReached stage
    expect(pageErrors.length, 'no uncaught page errors at max reached').toBe(0);
    expect(consoleErrors.length, 'no console.error messages at max reached').toBe(0);
  });

  test('Edge cases: rapid clicks and idempotency after disabled - ensure no JS exceptions thrown', async ({ page }) => {
    const demo = new DemoPage(page);

    // Rapidly click the append button 5 times in quick succession
    // Use Promise.all to issue clicks without awaiting output updates to simulate rapid user input
    const clickPromises = [];
    for (let i = 0; i < 5; i++) {
      clickPromises.push(demo.button.click().catch(e => e));
    }
    // Wait for all click attempts to complete
    await Promise.all(clickPromises);

    // After a short pause, ensure the output has a consistent state (size should be 5)
    await page.waitForFunction((selector) => {
      const el = document.querySelector(selector);
      return el && /Size:\s*5/.test(el.textContent);
    }, demo.output.selector, { timeout: 2000 });

    const out = await demo.getOutputText();
    expect(out).toContain('Size: 5');

    // Ensure no page errors or console errors despite rapid clicking
    expect(pageErrors.length, 'no uncaught page errors after rapid clicks').toBe(0);
    expect(consoleErrors.length, 'no console.error messages after rapid clicks').toBe(0);

    // Now artificially drive to max and ensure idempotent behavior after disabled:
    // click the button enough times to reach 20 and then trigger max logic
    // Determine current size by reading output
    const sizeMatch = out.match(/Size:\s*(\d+)/);
    let currentSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
    // Click to reach size 20
    for (let expected = currentSize + 1; expected <= 20; expected++) {
      await demo.clickAppendAndWaitForSize(expected, 3000);
    }
    // Trigger the max reached message
    await demo.clickAppend();
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.textContent.includes('Reached maximum demonstration number (20).');
    }, demo.output.selector);

    // Confirm the button is disabled and further rapid clicks do not throw or alter output
    expect(await demo.isButtonDisabled()).toBe(true);

    const before = await demo.getOutputText();
    // Attempt several rapid clicks now (should be no-ops)
    const clickAttempts = [];
    for (let i = 0; i < 3; i++) {
      clickAttempts.push(demo.button.click().catch(e => e));
    }
    await Promise.all(clickAttempts);
    await page.waitForTimeout(200);

    const after = await demo.getOutputText();
    expect(after).toBe(before);

    // Final assertion: still no uncaught errors in page or console
    expect(pageErrors.length, 'no uncaught page errors after disabled rapid clicks').toBe(0);
    expect(consoleErrors.length, 'no console.error messages after disabled rapid clicks').toBe(0);
  });
});