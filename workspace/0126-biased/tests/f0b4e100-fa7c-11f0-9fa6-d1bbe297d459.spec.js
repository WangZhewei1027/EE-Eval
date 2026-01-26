import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b4e100-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demonstration page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demo-button');
    this.demoOutput = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async isDemoButtonVisible() {
    return await this.demoButton.isVisible();
  }

  async isDemoOutputVisible() {
    // Use computed style to inspect display, as the app toggles display property
    const display = await this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      return el ? window.getComputedStyle(el).display : null;
    });
    return display !== 'none';
  }

  async clickDemoButton() {
    await this.demoButton.click();
  }

  async getOutputHTML() {
    return await this.demoOutput.innerHTML();
  }

  async countElements(selector) {
    return await this.page.locator(selector).count();
  }
}

test.describe('f0b4e100-fa7c-11f0-9fa6-d1bbe297d459 - Dynamic Typing Demo FSM', () => {
  // Arrays to collect any console errors and page errors emitted during tests
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset arrays for each test
    pageErrors = [];
    consoleErrors = [];

    // Observe page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Capture the Error instance and message
      pageErrors.push(err);
    });

    // Observe console messages; pay attention to console.error
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    // Navigate to the page exactly as-is (do not modify page)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Small pause to allow any asynchronous errors to surface
    await page.waitForTimeout(50);
    // Keep handlers attached only for the duration of the test run
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
  });

  test('Initial state (S0_Idle) renders correctly: demo button present, demo output hidden', async ({ page }) => {
    const demo = new DemoPage(page);

    // Validate Idle state's evidence: demo button exists and is visible
    await expect(demo.demoButton).toBeVisible();
    expect(await demo.isDemoButtonVisible()).toBe(true);

    // Validate demo output is initially hidden per component attributes (display: none)
    const outputVisible = await demo.isDemoOutputVisible();
    expect(outputVisible).toBe(false);

    // The #demo-output should be empty initially
    const initialHTML = await demo.getOutputHTML();
    expect(initialHTML.trim()).toBe('');

    // Assert that no runtime page errors of critical types occurred on load
    // We assert there are zero page errors and zero console.error messages.
    // If there were ReferenceError/SyntaxError/TypeError they would appear here naturally.
    expect(pageErrors.length, 'No uncaught page errors should be present on initial load').toBe(0);
    expect(consoleErrors.length, 'No console.error messages should be present on initial load').toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning on DemoButtonClick shows demonstration output', async ({ page }) => {
    const demo = new DemoPage(page);

    // Click the demo button to trigger the demonstration (event: DemoButtonClick)
    await demo.clickDemoButton();

    // Wait for output to be visible (entry action showDemoOutput sets display:block)
    await expect(demo.demoOutput).toBeVisible();

    // Verify that the demonstration header is present
    const outputHTML = await demo.getOutputHTML();
    expect(outputHTML).toContain('Dynamic Typing Demonstration');

    // Verify evidence of the demonstration paragraphs and types
    // First assignment: number
    expect(outputHTML).toContain('First assignment: 42 (type: number)');

    // Second assignment: string
    expect(outputHTML).toContain('Second assignment: "Now I\'m a string" (type: string)');

    // Third assignment: object (JSON stringified)
    expect(outputHTML).toContain('"name":"Object"');
    expect(outputHTML).toContain('(type: object)');

    // Fourth assignment: array (typeof array is "object" in JS and content joined)
    expect(outputHTML).toContain('Fourth assignment: [1, 2, 3] (type: object)');

    // Final note present
    expect(outputHTML).toContain('Note how the same variable holds values of different types at different times.');

    // Ensure only one H3 header is present (the script resets innerHTML first)
    const h3Count = await demo.countElements('#demo-output h3');
    expect(h3Count).toBe(1);

    // Ensure exact number of paragraphs expected (4 assignment paragraphs + 1 note = 5)
    const pCount = await demo.countElements('#demo-output p');
    expect(pCount).toBe(5);

    // Assert no uncaught critical errors occurred during the transition and rendering
    // Letting any ReferenceError/SyntaxError/TypeError surface naturally would populate pageErrors or consoleErrors
    expect(pageErrors.length, 'No uncaught page errors should be present after running demo').toBe(0);
    expect(consoleErrors.length, 'No console.error messages should be present after running demo').toBe(0);
  });

  test('Clicking the demo button multiple times resets output and avoids duplication', async ({ page }) => {
    const demo = new DemoPage(page);

    // Click once
    await demo.clickDemoButton();
    await expect(demo.demoOutput).toBeVisible();

    // Capture HTML after first click
    const htmlAfterFirst = await demo.getOutputHTML();

    // Click again - implementation sets innerHTML = '<h3>...' again and then appends,
    // so the resulting content should be effectively the same structure (not appended infinitely)
    await demo.clickDemoButton();
    await expect(demo.demoOutput).toBeVisible();

    const htmlAfterSecond = await demo.getOutputHTML();

    // The header should still only occur once and paragraph count should remain 5
    const h3Count = await demo.countElements('#demo-output h3');
    expect(h3Count).toBe(1);

    const pCount = await demo.countElements('#demo-output p');
    expect(pCount).toBe(5);

    // The inner HTML after the second click should contain the same essential pieces as after the first click.
    // It may differ in whitespace, but must contain the same key substrings.
    const expectedSubstrings = [
      'Dynamic Typing Demonstration',
      'First assignment: 42 (type: number)',
      'Second assignment: "Now I\'m a string" (type: string)',
      '"name":"Object"',
      'Fourth assignment: [1, 2, 3] (type: object)'
    ];

    for (const s of expectedSubstrings) {
      expect(htmlAfterSecond).toContain(s);
    }

    // Ensure that the re-render did not cause uncaught exceptions
    expect(pageErrors.length, 'No uncaught page errors after repeated clicks').toBe(0);
    expect(consoleErrors.length, 'No console.error messages after repeated clicks').toBe(0);
  });

  test('Rapid multiple clicks: robustness and no runtime errors', async ({ page }) => {
    const demo = new DemoPage(page);

    // Rapidly trigger clicks several times to simulate edge case
    for (let i = 0; i < 6; i++) {
      // not awaiting page navigation; clicking quickly
      await demo.clickDemoButton();
    }

    // Wait briefly to allow any asynchronous JS to run
    await page.waitForTimeout(100);

    // The demo output should be visible and stable
    await expect(demo.demoOutput).toBeVisible();

    // Validate that the core content appears (header + 4 assignment paragraphs + note)
    const outputHTML = await demo.getOutputHTML();
    expect(outputHTML).toContain('Dynamic Typing Demonstration');
    expect(outputHTML).toContain('First assignment: 42 (type: number)');
    expect(outputHTML).toContain('Second assignment: "Now I\'m a string" (type: string)');
    expect(outputHTML).toContain('"name":"Object"');
    expect(outputHTML).toContain('Fourth assignment: [1, 2, 3] (type: object)');

    // Check there's a single header and expected paragraph count (5)
    expect(await demo.countElements('#demo-output h3')).toBe(1);
    expect(await demo.countElements('#demo-output p')).toBe(5);

    // Assert no uncaught ReferenceError/SyntaxError/TypeError occurred during rapid interactions
    // If any such errors occurred, they would be present in pageErrors or consoleErrors arrays
    const severePageErrors = pageErrors.filter(e => {
      if (!e || !e.name) return false;
      return e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError';
    });
    // Expect zero severe errors
    expect(severePageErrors.length, 'No ReferenceError/SyntaxError/TypeError should be thrown during rapid clicks').toBe(0);
    // Also assert console.error didn't log an error
    expect(consoleErrors.length, 'No console.error messages should be produced during rapid clicks').toBe(0);
  });

  test('Monitor console and page errors explicitly: assert no critical runtime errors were emitted', async ({ page }) => {
    // This test focuses purely on observing the runtime for errors when loading and operating the demo

    const demo = new DemoPage(page);

    // Interact with the demo to exercise scripts
    await demo.clickDemoButton();
    await page.waitForTimeout(50);

    // Collect textual representations of console errors and page errors for diagnostic assertions
    const consoleTexts = consoleErrors.map(c => c.text());
    const pageErrorNames = pageErrors.map(e => (e && e.name) ? `${e.name}: ${e.message}` : String(e));

    // Assert there are no console.error messages
    expect(consoleErrors.length, `Expected no console.error messages. Captured: ${consoleTexts.join(' | ')}`).toBe(0);

    // Assert there are no uncaught page errors like ReferenceError/SyntaxError/TypeError
    const problematic = pageErrors.filter(e => {
      if (!e || !e.name) return false;
      return ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name);
    });
    expect(problematic.length, `Expected no ReferenceError/SyntaxError/TypeError. Captured: ${pageErrorNames.join(' | ')}`).toBe(0);
  });
});