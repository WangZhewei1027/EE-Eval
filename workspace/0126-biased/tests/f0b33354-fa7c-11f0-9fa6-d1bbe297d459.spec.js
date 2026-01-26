import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b33354-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  demoButton() {
    return this.page.locator('#demo-button');
  }

  demoOutput() {
    return this.page.locator('#demo-output');
  }

  async clickDemoButton() {
    await this.demoButton().click();
  }

  async isOutputVisible() {
    // Use computed style to determine visibility more reliably than attribute alone
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo-output');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }

  async getOutputInnerHTML() {
    return await this.page.locator('#demo-output').innerHTML();
  }

  async countOutputHeadings() {
    return await this.page.locator('#demo-output h3').count();
  }
}

test.describe('FSM: Understanding P vs NP - interactive demo', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {DemoPage} */
  let demo;
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Collect console messages and page errors for assertions
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') consoleErrors.push(entry);
    });

    page.on('pageerror', err => {
      // pageerror receives an Error object
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    demo = new DemoPage(page);
  });

  test.afterEach(async () => {
    // cleanup page
    await page.close();
  });

  test('Idle state: initial render shows demo button and hidden output', async () => {
    // Validate the "Idle" state entry conditions described in the FSM
    // 1. The demo button must be present and have correct label
    await expect(demo.demoButton()).toBeVisible({ timeout: 2000 });
    await expect(demo.demoButton()).toHaveText('Show Verification vs. Solving');

    // 2. The demo output element should exist and be hidden initially
    const outputLocator = demo.demoOutput();
    await expect(outputLocator).toHaveCount(1);
    // Check inline style or computed style indicates hidden
    const isVisible = await demo.isOutputVisible();
    expect(isVisible).toBe(false);

    // 3. Verify that any FSM-declared entry action functions (renderPage) are NOT present on the window.
    // The FSM listed renderPage() as an entry action for Idle, but the HTML does not define such a function.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // 4. Ensure no page runtime errors have occurred by now
    expect(pageErrors.length).toBe(0);

    // 5. Ensure no console.error messages were emitted during initial load
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: clicking demo button reveals demo output (S0_Idle -> S1_DemoOutputVisible)', async () => {
    // This validates the ButtonClick event and the transition to Demo Output Visible
    // Click the button and wait for output to become visible
    await demo.clickDemoButton();

    // Use the POM method to check visibility via computed style
    await expect(async () => {
      const visible = await demo.isOutputVisible();
      if (!visible) throw new Error('demo-output not visible yet');
    }).not.toThrow();

    // Check that inner HTML contains expected sections from the implementation
    const inner = await demo.getOutputInnerHTML();
    expect(inner).toContain('Verification:');
    expect(inner).toContain('Solving:');
    expect(inner).toContain('Key Insight:');

    // The implementation sets output.style.display = 'block', assert that via computed style
    const displayStyle = await page.evaluate(() => {
      const el = document.getElementById('demo-output');
      return el ? el.style.display : null;
    });
    // Since the script sets el.style.display = 'block', the inline style should be 'block'
    expect(displayStyle).toBe('block');

    // Validate the FSM's asserted evidence that output.innerHTML is set
    expect(inner.trim().length).toBeGreaterThan(0);

    // Ensure no uncaught page errors or console.error messages occurred during click
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotence: repeated clicks do not duplicate content or create errors', async () => {
    // Click multiple times and confirm output content remains consistent (not appended repeatedly)
    await demo.clickDemoButton();
    const firstCount = await demo.countOutputHeadings();
    expect(firstCount).toBe(2); // Expect two h3: Verification and Solving

    // Click again
    await demo.clickDemoButton();
    const secondCount = await demo.countOutputHeadings();
    // Implementation uses innerHTML = `...` so it replaces content, still should be 2
    expect(secondCount).toBe(2);

    // Ensure innerHTML is identical between clicks (sanity check)
    const htmlAfterFirst = await demo.getOutputInnerHTML();
    await demo.clickDemoButton();
    const htmlAfterSecond = await demo.getOutputInnerHTML();
    expect(htmlAfterSecond).toBe(htmlAfterFirst);

    // No errors should have been emitted
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Verify FSM-declared helper displayDemoOutput() is not required for behavior', async () => {
    // FSM lists displayDemoOutput() as an entry action for the demo-visible state.
    // The page does not define such a function; verify it's absent, but the click still works.
    const hasDisplayDemoOutput = await page.evaluate(() => typeof window.displayDemoOutput !== 'undefined');
    expect(hasDisplayDemoOutput).toBe(false);

    // Confirm clicking the button still reveals content (ensures page uses inline handler instead)
    await demo.clickDemoButton();
    expect(await demo.isOutputVisible()).toBe(true);
    expect((await demo.getOutputInnerHTML()).length).toBeGreaterThan(0);

    // Confirm no page errors emitted
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking a non-existent selector should result in Playwright error (expect rejection)', async () => {
    // This test intentionally attempts to click a missing element to validate error handling scenario.
    // Playwright should throw if attempting to click an element that doesn't exist.
    await expect(page.click('#this-element-does-not-exist', { timeout: 1000 })).rejects.toThrow();
  });

  test('Console and page error observations: collect and assert no runtime ReferenceError/SyntaxError/TypeError occurred', async () => {
    // At this point (initial load), we expect no runtime errors like ReferenceError/SyntaxError/TypeError
    // Validate recorded page errors array is empty
    expect(pageErrors.length).toBe(0);

    // Ensure no console messages of type 'error' or containing typical engine error names
    const engineErrorNames = ['ReferenceError', 'TypeError', 'SyntaxError', 'RangeError', 'URIError', 'EvalError'];
    const foundEngineErrors = consoleMessages.filter(m => {
      if (m.type !== 'error') return false;
      return engineErrorNames.some(name => m.text.includes(name));
    });
    expect(foundEngineErrors.length).toBe(0);

    // As an additional check, ensure console did not emit obvious 'Uncaught' phrases
    const uncaught = consoleMessages.filter(m => /uncaught/i.test(m.text));
    expect(uncaught.length).toBe(0);
  });
});