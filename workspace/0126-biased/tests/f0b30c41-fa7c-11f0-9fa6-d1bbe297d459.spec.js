import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b30c41-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Branch and Bound demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButtonSelector = "button[onclick='runDemo()']";
    this.outputSelector = '#demo-output';
  }

  async waitForLoad() {
    // Ensure basic elements are present
    await this.page.waitForSelector('h1');
    await this.page.waitForSelector(this.runButtonSelector);
    await this.page.waitForSelector(this.outputSelector);
  }

  async getRunButton() {
    return this.page.locator(this.runButtonSelector);
  }

  async clickRunButton() {
    await this.page.click(this.runButtonSelector);
  }

  async getOutputElement() {
    return this.page.locator(this.outputSelector);
  }

  async getOutputDisplayStyle() {
    // Return computed style.display
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).display;
    }, this.outputSelector);
  }

  async getOutputStyleAttribute() {
    return this.page.getAttribute(this.outputSelector, 'style');
  }

  async getOutputInnerHTML() {
    return this.page.$eval(this.outputSelector, (el) => el.innerHTML);
  }

  async isFunctionDefined(functionName) {
    return this.page.evaluate((name) => {
      return typeof window[name] === 'function';
    }, functionName);
  }

  // Attempt to call a global function within the page and return structured result.
  // This captures thrown exceptions without letting them become unhandled in the page.
  async tryCallFunction(functionName) {
    return this.page.evaluate((name) => {
      try {
        // Attempt to call the function; if it doesn't exist this will throw.
        // We intentionally do not modify or create globals here.
        // We catch errors and return a description of what happened.
        const fn = window[name];
        if (typeof fn !== 'function') {
          // Simulate the natural ReferenceError message shape by throwing,
          // but we catch and return error information instead of letting it bubble.
          throw new ReferenceError(name + ' is not defined');
        }
        // If it exists, call it and indicate success.
        fn();
        return { called: true, error: null };
      } catch (err) {
        return { called: false, errorName: err && err.name, errorMessage: err && (err.message || String(err)) };
      }
    }, functionName);
  }
}

test.describe('Branch and Bound Demo - FSM behavior and UI validation', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      // Store type and text for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for core elements to be present
    const demo = new DemoPage(page);
    await demo.waitForLoad();
  });

  test.afterEach(async ({ page }) => {
    // explicit teardown can be done here if needed
    // But Playwright will close page/context automatically per its runner config.
  });

  test('Initial state (S0_Idle) - UI elements and Idle state verification', async ({ page }) => {
    // This test validates the Idle state described in the FSM:
    // - The "Run Demonstration" button is present
    // - The demo output (#demo-output) is initially hidden
    // - The FSM's S0 entry_action renderPage() is not present on the page (function missing)
    // - There are no console errors emitted during initial load

    const demo = new DemoPage(page);

    // Assert the Run Demonstration button exists and has correct text content
    const runBtn = await demo.getRunButton();
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run Demonstration');

    // Assert demo output exists but is hidden (display: none)
    const outputEl = await demo.getOutputElement();
    await expect(outputEl).toBeVisible({ timeout: 100 }).catch(() => {
      // The element exists but may be hidden; ensure it is present in DOM
    });
    const computedDisplay = await demo.getOutputDisplayStyle();
    expect(computedDisplay === 'none' || computedDisplay === 'block').toBeTruthy();
    // Per implementation it should be 'none' initially
    expect(computedDisplay).toBe('none');

    // Also check the inline style attribute initially indicates display: none; the HTML shows style is not set inline,
    // but the CSS rule sets display: none. We allow either an empty style attribute or absence.
    const styleAttr = await demo.getOutputStyleAttribute();
    // style attribute may be null or an empty string initially
    expect(typeof styleAttr === 'string' || styleAttr === null).toBeTruthy();

    // Verify that renderPage() is not defined on the window (FSM listed it as an entry action but it's not implemented)
    const renderPageDefined = await demo.isFunctionDefined('renderPage');
    expect(renderPageDefined).toBe(false);

    // Verify that runDemo is defined but not yet executed (we will check execution in other tests)
    const runDemoDefined = await demo.isFunctionDefined('runDemo');
    expect(runDemoDefined).toBe(true);

    // Confirm there were no unhandled page errors during load
    expect(pageErrors.length).toBe(0);

    // Confirm console did not emit error-level messages on load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition: RunDemo event triggers DemoRunning state (S1_DemoRunning) and updates DOM', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_DemoRunning when clicking the button:
    // - Clicking the Run Demonstration button invokes runDemo()
    // - #demo-output becomes visible (style.display = 'block')
    // - #demo-output innerHTML is updated to include demonstration content
    // - No unhandled exceptions (pageerror) occur during the transition

    const demo = new DemoPage(page);

    // Ensure runDemo is defined before the click
    const runDemoDefined = await demo.isFunctionDefined('runDemo');
    expect(runDemoDefined).toBe(true);

    // Click the Run Demonstration button to trigger the demo
    await demo.clickRunButton();

    // After click, the demo output should be visible (display block by inline style set in runDemo)
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && window.getComputedStyle(el).display === 'block';
    }, demo.outputSelector);

    const displayAfter = await demo.getOutputDisplayStyle();
    expect(displayAfter).toBe('block');

    // The inline style attribute should include 'display: block'
    const styleAttrAfter = await demo.getOutputStyleAttribute();
    expect(styleAttrAfter && styleAttrAfter.includes('display: block')).toBeTruthy();

    // The innerHTML should include the demonstration heading and some content evidence
    const inner = await demo.getOutputInnerHTML();
    expect(inner).toContain('Branch and Bound Demonstration (0/1 Knapsack)');
    expect(inner).toContain('Final Solution');
    expect(inner).toContain('value=26'); // evidence from the implementation

    // Ensure clicking did not produce unhandled page errors
    expect(pageErrors.length).toBe(0);

    // Ensure console did not record error-level messages during this interaction
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Idempotence and repeated interactions - clicking Run Demonstration multiple times', async ({ page }) => {
    // This test checks edge-case behavior when the user triggers the demo multiple times:
    // - The innerHTML should be overwritten (not appended) when clicking repeatedly
    // - The content should remain consistent across multiple invocations
    // - No console errors or page errors should appear

    const demo = new DemoPage(page);

    // Click once and capture innerHTML
    await demo.clickRunButton();
    // Wait for display to be block
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && window.getComputedStyle(el).display === 'block';
    }, demo.outputSelector);

    const innerAfterFirst = await demo.getOutputInnerHTML();

    // Click a second time
    await demo.clickRunButton();

    // Allow a short tick for DOM update
    await page.waitForTimeout(50);

    const innerAfterSecond = await demo.getOutputInnerHTML();

    // The implementation sets innerHTML directly; repeated clicks should result in the same content,
    // not cumulative duplication. Assert equality.
    expect(innerAfterSecond).toBe(innerAfterFirst);

    // No page errors emitted
    expect(pageErrors.length).toBe(0);

    // No console error messages produced
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('FSM onEnter/onExit verification: S1 entry action runDemo() evidence and S0 entry action absence', async ({ page }) => {
    // Validate the FSM-specified entry actions:
    // - S1_DemoRunning entry action is runDemo(): clicking button runs it and updates DOM (already tested),
    //   here we verify the evidence: display style and innerHTML were changed by runDemo()
    // - S0_Idle entry action was listed as renderPage() in FSM but does not exist on the page:
    //   verify that attempting to call renderPage results in a ReferenceError captured inside the page context

    const demo = new DemoPage(page);

    // Ensure we are starting in Idle: output hidden
    const initialDisplay = await demo.getOutputDisplayStyle();
    expect(initialDisplay).toBe('none');

    // Attempting to call renderPage() should produce an error; capture it in-page without causing an unhandled error.
    const renderPageCall = await demo.tryCallFunction('renderPage');
    // We expect renderPage is not defined, so called=false and errorName contains 'ReferenceError'
    expect(renderPageCall.called).toBe(false);
    // Depending on engine, errorName may be 'ReferenceError' and message will mention 'renderPage'
    expect(renderPageCall.errorName).toBe('ReferenceError');
    expect(renderPageCall.errorMessage).toContain('renderPage');

    // Now trigger runDemo (S1 entry action) to show evidence it executed
    await demo.clickRunButton();

    // Confirm output shown and content updated as evidence runDemo executed
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && window.getComputedStyle(el).display === 'block' && el.innerHTML.includes('Branch and Bound Demonstration');
    }, demo.outputSelector);

    const styleAttrAfter = await demo.getOutputStyleAttribute();
    expect(styleAttrAfter && styleAttrAfter.includes('display: block')).toBeTruthy();

    const inner = await demo.getOutputInnerHTML();
    expect(inner).toContain('Step 1:');
    expect(inner).toContain('Final Solution:');

    // Ensure no unhandled errors were emitted to the page (we captured the renderPage call safely)
    expect(pageErrors.length).toBe(0);
  });

  test('Monitoring console and page errors over full scenario: load -> click -> repeated click', async ({ page }) => {
    // This test aggregates behavior and asserts that normal usage does not produce console errors or unhandled exceptions.
    // It verifies that the app behaves robustly under repeated usage.

    const demo = new DemoPage(page);

    // Start: record initial counts
    const initialPageErrorsCount = pageErrors.length;
    const initialConsoleErrorsCount = consoleMessages.filter(m => m.type === 'error').length;

    // Perform interactions
    await demo.clickRunButton();
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && window.getComputedStyle(el).display === 'block';
    }, demo.outputSelector);

    await demo.clickRunButton(); // second click

    // Small wait to ensure any asynchronous page errors (if they were to occur) are emitted
    await page.waitForTimeout(100);

    // Verify no new page errors / console errors have accumulated
    expect(pageErrors.length).toBe(initialPageErrorsCount);
    const currentConsoleErrorsCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(currentConsoleErrorsCount).toBe(initialConsoleErrorsCount);
  });
});