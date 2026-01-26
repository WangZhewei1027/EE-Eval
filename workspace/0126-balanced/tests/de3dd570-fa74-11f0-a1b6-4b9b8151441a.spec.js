import { test, expect } from '@playwright/test';

// Test suite for "Dynamic Typing Demonstration" interactive application
// Application URL (served externally by test harness):
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dd570-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object encapsulates selectors and helper actions for the demo page
class DynamicTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.example1Btn = page.locator("button[onclick='example1()']");
    this.example2Btn = page.locator("button[onclick='example2()']");
    this.example3Btn = page.locator("button[onclick='example3()']");
    this.example4Btn = page.locator("button[onclick='example4()']");
    this.output1 = page.locator('#output1');
    this.output2 = page.locator('#output2');
    this.output3 = page.locator('#output3');
    this.output4 = page.locator('#output4');
  }

  // Click the specified example button and wait for its output to appear
  async runExample(buttonLocator, outputLocator, expectedLines = 1) {
    // Ensure button is visible and enabled
    await expect(buttonLocator).toBeVisible();
    await buttonLocator.click();
    // Wait for output div to contain at least expectedLines child <div> entries
    await this.page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.querySelectorAll('div').length >= expected;
      },
      outputLocator.locator('').selector,
      expectedLines
    );
  }

  // Utility to set raw HTML into an output (to test clearing behavior)
  async setOutputHtml(outputLocator, html) {
    await this.page.evaluate(
      (selector, content) => { document.querySelector(selector).innerHTML = content; },
      outputLocator.locator('').selector,
      html
    );
  }

  // Read text content concatenated from child divs inside an output
  async readOutputText(outputLocator) {
    return await this.page.evaluate(selector => {
      const el = document.querySelector(selector);
      if (!el) return '';
      return Array.from(el.querySelectorAll('div')).map(d => d.textContent).join('\n');
    }, outputLocator.locator('').selector);
  }

  // Count number of child div messages inside output
  async outputMessageCount(outputLocator) {
    return await this.page.evaluate(selector => {
      const el = document.querySelector(selector);
      if (!el) return 0;
      return el.querySelectorAll('div').length;
    }, outputLocator.locator('').selector);
  }
}

test.describe('Dynamic Typing Demonstration - FSM states and transitions', () => {
  // Arrays to collect runtime console errors and page exceptions for assertions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing special to teardown beyond Playwright's automatic cleanup
  });

  test('Initial Idle state: page renders buttons and output containers (S0_Idle)', async ({ page }) => {
    // Validate presence of all four example buttons and output containers.
    const p = new DynamicTypingPage(page);

    // Buttons should be visible
    await expect(p.example1Btn).toBeVisible();
    await expect(p.example2Btn).toBeVisible();
    await expect(p.example3Btn).toBeVisible();
    await expect(p.example4Btn).toBeVisible();

    // Output divs should be present and empty initially
    await expect(p.output1).toBeVisible();
    await expect(p.output2).toBeVisible();
    await expect(p.output3).toBeVisible();
    await expect(p.output4).toBeVisible();

    expect(await p.outputMessageCount(p.output1)).toBe(0);
    expect(await p.outputMessageCount(p.output2)).toBe(0);
    expect(await p.outputMessageCount(p.output3)).toBe(0);
    expect(await p.outputMessageCount(p.output4)).toBe(0);

    // Verify there are no uncaught runtime errors on initial load.
    // The FSM mentioned an entry action "renderPage()" but the page's implementation
    // does not call a global renderPage function. We assert that no ReferenceError
    // was thrown on load (i.e., renderPage was not invoked by the page).
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Run Example 1 transitions to Example1 Running (S1_Example1_Running) and displays type changes', async ({ page }) => {
    // This test validates:
    // - Clicking Run Example 1 clears output1 and writes three lines reflecting type changes.
    // - The specific values and typeof results are present.
    const p = new DynamicTypingPage(page);

    // Pre-fill output1 to ensure example1 clears existing content (exit/entry expectations)
    await p.setOutputHtml(p.output1, '<div>OLD_CONTENT</div>');
    let preCount = await p.outputMessageCount(p.output1);
    expect(preCount).toBeGreaterThanOrEqual(1);

    // Run Example 1
    await p.runExample(p.example1Btn, p.output1, 3);

    // After running, ensure old content is gone and three messages are present
    const count = await p.outputMessageCount(p.output1);
    expect(count).toBe(3);

    const text = await p.readOutputText(p.output1);
    // Validate expected pieces of text are present
    expect(text).toContain('Initial value: 42');
    expect(text).toContain('type: number');
    expect(text).toContain('After reassignment: Hello');
    expect(text).toContain('After another reassignment: true');

    // No uncaught page errors should have occurred during the interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Run Example 2 transitions to Example2 Running (S2_Example2_Running) and demonstrates type coercion', async ({ page }) => {
    // This test validates Example 2 shows string concatenation and numeric subtraction results.
    const p = new DynamicTypingPage(page);

    await p.runExample(p.example2Btn, p.output2, 2);

    const count = await p.outputMessageCount(p.output2);
    expect(count).toBe(2);

    const text = await p.readOutputText(p.output2);
    expect(text).toContain('"5" + 2 = 52');
    expect(text).toContain('type: string');
    expect(text).toContain('"5" - 2 = 3');
    expect(text).toContain('type: number');

    // No uncaught runtime errors during Example 2 execution
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Run Example 3 transitions to Example3 Running (S3_Example3_Running) and reports typeof changes', async ({ page }) => {
    // This test validates Example 3 logs types: number -> string -> object
    const p = new DynamicTypingPage(page);

    await p.runExample(p.example3Btn, p.output3, 3);

    const text = await p.readOutputText(p.output3);
    expect(text).toContain('Initial type: number');
    expect(text).toContain('After reassignment, type: string');
    // Objects show typeof 'object' in JavaScript
    expect(text).toContain('After another reassignment, type: object');

    // No uncaught runtime errors during Example 3 execution
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Run Example 4 transitions to Example4 Running (S4_Example4_Running) and compares equality operators', async ({ page }) => {
    // This test validates Example 4 shows loose vs strict equality results for given examples
    const p = new DynamicTypingPage(page);

    await p.runExample(p.example4Btn, p.output4, 4);

    const text = await p.readOutputText(p.output4);
    expect(text).toContain('"5" == 5: true');
    expect(text).toContain('"5" === 5: false');
    expect(text).toContain('0 == false: true');
    expect(text).toContain('0 === false: false');

    // No uncaught runtime errors during Example 4 execution
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking the same example button repeatedly clears previous output before each run', async ({ page }) => {
    // This test validates that running the same example twice does not append results,
    // because each example clears its output at the start of execution.
    const p = new DynamicTypingPage(page);

    // Run example1 twice in quick succession
    await p.runExample(p.example1Btn, p.output1, 3);
    const firstRunText = await p.readOutputText(p.output1);
    expect(firstRunText).toContain('Initial value: 42');

    // Click again; since example1 clears innerHTML, after second click only the second run messages should be present
    await p.runExample(p.example1Btn, p.output1, 3);
    const secondRunText = await p.readOutputText(p.output1);
    expect(secondRunText).toContain('Initial value: 42');
    // Ensure the content length is consistent with a single run (3 lines)
    const count = await p.outputMessageCount(p.output1);
    expect(count).toBe(3);

    // No page errors during repeated runs
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: triggering all examples quickly ensures each output area is independent', async ({ page }) => {
    // This test validates running all examples in quick succession results in each output area populated correctly
    const p = new DynamicTypingPage(page);

    // Click all four buttons without awaiting individual completion to simulate fast user interactions
    await Promise.all([
      p.example1Btn.click(),
      p.example2Btn.click(),
      p.example3Btn.click(),
      p.example4Btn.click()
    ]);

    // Wait until each output has its expected minimum lines
    await p.page.waitForFunction(() => {
      const o1 = document.querySelector('#output1');
      const o2 = document.querySelector('#output2');
      const o3 = document.querySelector('#output3');
      const o4 = document.querySelector('#output4');
      if (!o1 || !o2 || !o3 || !o4) return false;
      return o1.querySelectorAll('div').length >= 3 &&
             o2.querySelectorAll('div').length >= 2 &&
             o3.querySelectorAll('div').length >= 3 &&
             o4.querySelectorAll('div').length >= 4;
    });

    // Validate independence and correctness of outputs
    const t1 = await p.readOutputText(p.output1);
    const t2 = await p.readOutputText(p.output2);
    const t3 = await p.readOutputText(p.output3);
    const t4 = await p.readOutputText(p.output4);

    expect(t1).toContain('Initial value: 42');
    expect(t2).toContain('"5" + 2 = 52');
    expect(t3).toContain('Initial type: number');
    expect(t4).toContain('"5" == 5: true');

    // No uncaught runtime errors across rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Negative scenario: ensure no ReferenceError / SyntaxError / TypeError occurred during full test run', async ({ page }) => {
    // This final check aggregates any page errors or console errors captured during the page lifecycle.
    // It asserts that there were no uncaught JavaScript runtime errors such as ReferenceError, SyntaxError, or TypeError.
    // (We captured these on pageerror and console.error during beforeEach.)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});