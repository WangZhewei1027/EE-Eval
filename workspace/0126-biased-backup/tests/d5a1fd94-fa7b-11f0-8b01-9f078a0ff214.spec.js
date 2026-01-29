import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1fd94-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page object for the Context Switching demo page.
 * Encapsulates selectors and common interactions.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = "button[onclick='toggleDemo()']";
    this.demoSelector = '#demo';
  }

  async goto() {
    await this.page.goto(URL);
  }

  async clickToggle() {
    await this.page.click(this.buttonSelector);
  }

  async getInlineDisplay() {
    // element.style.display (inline style)
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.style.display : null;
    }, this.demoSelector);
  }

  async getComputedDisplay() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).display;
    }, this.demoSelector);
  }

  async buttonExists() {
    return await this.page.$(this.buttonSelector) !== null;
  }

  async getButtonText() {
    const el = await this.page.$(this.buttonSelector);
    if (!el) return null;
    return await el.innerText();
  }

  async hasOnclickAttribute() {
    return await this.page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (!btn) return null;
      return btn.getAttribute('onclick');
    }, this.buttonSelector);
  }

  async typeofGlobal(fnName) {
    return await this.page.evaluate((name) => {
      // Access the global property safely
      // return typeof window[name] === 'function' ? 'function' : typeof window[name];
      const val = window[name];
      return typeof val;
    }, fnName);
  }
}

test.describe('Context Switching Demo - FSM states and transitions', () => {
  // Arrays to collect console errors and uncaught page errors during a test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });
  });

  test.afterEach(async () => {
    // No global teardown required beyond the per-test listeners cleaning up automatically.
  });

  test('Initial state (S0_Idle): page loads and demo is hidden', async ({ page }) => {
    // Validate initial Idle state: demo hidden, button present
    const demo = new DemoPage(page);
    await demo.goto();

    // Verify button exists and has expected text
    expect(await demo.buttonExists()).toBe(true);
    expect(await demo.getButtonText()).toContain('Show Context Switching Demonstration');

    // The inline style should be empty string initially (no inline style set in HTML)
    // but computed style should be 'none' because CSS sets display: none;
    const inlineDisplay = await demo.getInlineDisplay();
    const computedDisplay = await demo.getComputedDisplay();

    // Inline style is expected to be '' (empty) or null if not present - the implementation leaves it ''
    expect(inlineDisplay === '' || inlineDisplay === null).toBeTruthy();
    expect(computedDisplay).toBe('none');

    // Verify onclick attribute is present on the button
    const onclickAttr = await demo.hasOnclickAttribute();
    expect(onclickAttr).toBe('toggleDemo()');

    // Ensure the toggleDemo function is defined globally
    expect(await demo.typeofGlobal('toggleDemo')).toBe('function');

    // FSM mentioned entry action renderPage(); verify that renderPage is not present on the global scope
    // We check this to validate the implementation vs FSM description (do not modify page).
    expect(await demo.typeofGlobal('renderPage')).not.toBe('function');

    // Also verify that showDemo and hideDemo (mentioned in FSM) are not defined as global functions
    expect(await demo.typeofGlobal('showDemo')).not.toBe('function');
    expect(await demo.typeofGlobal('hideDemo')).not.toBe('function');

    // Assert that no console errors or page errors occurred during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible: clicking the toggle shows the demo', async ({ page }) => {
    // Validate that clicking the button when demo is hidden displays the demo
    const demo = new DemoPage(page);
    await demo.goto();

    // Precondition: computed should be 'none'
    expect(await demo.getComputedDisplay()).toBe('none');

    // Click to toggle
    await demo.clickToggle();

    // After click, inline style should be 'block' and computed 'block'
    const inlineAfter = await demo.getInlineDisplay();
    const computedAfter = await demo.getComputedDisplay();

    expect(inlineAfter).toBe('block');
    expect(computedAfter).toBe('block');

    // No errors from this interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_DemoVisible -> S2_DemoHidden: clicking again hides the demo', async ({ page }) => {
    // Validate visible -> hidden transition on second click
    const demo = new DemoPage(page);
    await demo.goto();

    // First click: show
    await demo.clickToggle();
    expect(await demo.getComputedDisplay()).toBe('block');

    // Second click: hide
    await demo.clickToggle();

    // After second click, inline style should be 'none' (the script sets style.display = 'none')
    const inlineAfter = await demo.getInlineDisplay();
    const computedAfter = await demo.getComputedDisplay();

    expect(inlineAfter).toBe('none');
    expect(computedAfter).toBe('none');

    // No errors produced
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S2_DemoHidden -> S1_DemoVisible: clicking from hidden shows demo again', async ({ page }) => {
    // Validate hidden -> visible transition after being hidden
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure hidden initial, then show, then hide, then show again
    expect(await demo.getComputedDisplay()).toBe('none');

    await demo.clickToggle(); // show
    expect(await demo.getComputedDisplay()).toBe('block');

    await demo.clickToggle(); // hide
    expect(await demo.getComputedDisplay()).toBe('none');

    await demo.clickToggle(); // show again
    expect(await demo.getComputedDisplay()).toBe('block');

    // No console or page errors after this sequence
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks toggle consistent final state (even/odd behavior)', async ({ page }) => {
    // Rapidly click the toggle button multiple times and verify final visibility matches parity of clicks
    const demo = new DemoPage(page);
    await demo.goto();

    const clicks = 7; // odd number -> final should be visible
    for (let i = 0; i < clicks; i++) {
      // use evaluate to click quickly in the page context to reduce roundtrip overhead
      await page.evaluate((sel) => {
        const btn = document.querySelector(sel);
        if (btn) btn.click();
      }, demo.buttonSelector);
    }

    // After odd clicks, expect visible
    expect(await demo.getComputedDisplay()).toBe('block');

    // Now do one more click to make it even -> hidden
    await demo.clickToggle();
    expect(await demo.getComputedDisplay()).toBe('none');

    // Confirm no console or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Direct invocation of toggleDemo() behaves same as clicking (sanity check)', async ({ page }) => {
    // Call the global toggleDemo function directly from the page and validate behavior.
    // This checks the actual function defined in the page script, without patching it.
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure starting hidden
    expect(await demo.getComputedDisplay()).toBe('none');

    // Call toggleDemo directly
    await page.evaluate(() => {
      // Intentionally call the existing function; do NOT define or override it.
      window.toggleDemo();
    });

    // Now expect visible
    expect(await demo.getComputedDisplay()).toBe('block');

    // Call again to hide
    await page.evaluate(() => {
      window.toggleDemo();
    });

    expect(await demo.getComputedDisplay()).toBe('none');

    // Confirm there were no runtime exceptions captured during direct invocation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture any console errors or uncaught exceptions during interactions', async ({ page }) => {
    // This test explicitly demonstrates observation of console and page errors.
    // It will fail if any console 'error' messages or page 'pageerror' events were emitted.
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform a few interactions
    await demo.clickToggle();
    await demo.clickToggle();
    await demo.clickToggle();

    // At the end assert that there were no console errors or uncaught page errors.
    // If the page had errors (ReferenceError, TypeError, etc.), they will be present in these arrays.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry/exit verification: confirm FSM-described helper functions are not present and not invoked', async ({ page }) => {
    // The FSM description mentions entry actions like renderPage(), showDemo(), hideDemo().
    // The implementation does not define those functions. We assert they are not present.
    // This verifies differences between the FSM specification and the actual implementation.
    const demo = new DemoPage(page);
    await demo.goto();

    expect(await demo.typeofGlobal('renderPage')).not.toBe('function');
    expect(await demo.typeofGlobal('showDemo')).not.toBe('function');
    expect(await demo.typeofGlobal('hideDemo')).not.toBe('function');

    // We also assert that the actual used function toggleDemo is defined and works (smoke)
    expect(await demo.typeofGlobal('toggleDemo')).toBe('function');

    // No errors observed
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});