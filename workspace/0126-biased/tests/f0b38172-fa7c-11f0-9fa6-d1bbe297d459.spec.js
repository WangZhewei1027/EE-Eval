import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b38172-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object for interacting with the demo UI and gathering console/page errors
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
    this._consoleListener = (msg) => {
      const text = msg.text();
      this.consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') this.consoleErrors.push(text);
    };
    this._pageErrorListener = (err) => {
      // pageerror receives an Error object
      this.pageErrors.push(err);
    };
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  async goto() {
    // Navigate and wait for load to ensure scripts execute
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRun() {
    await this.page.click('button.button');
  }

  async getOutputText() {
    return (await this.page.locator('#demoOutput').textContent()) ?? '';
  }

  async evaluate(fn) {
    return this.page.evaluate(fn);
  }

  // Remove listeners to avoid memory leaks between tests
  detachListeners() {
    this.page.removeListener('console', this._consoleListener);
    this.page.removeListener('pageerror', this._pageErrorListener);
  }
}

test.describe('Semaphore Demo (FSM) - f0b38172-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Expected demo texts from the FSM / HTML script
  const demoTexts = [
    'Initial state: Semaphore value = 1 (resource available)',
    'Process A performs wait(): Semaphore value = 0 (resource acquired)',
    'Process B attempts wait(): Blocked (semaphore value = 0)',
    'Process C attempts wait(): Blocked (semaphore value = 0)',
    'Process A performs signal(): Semaphore value = 0 (Process B unblocked)',
    'Process B completes and performs signal(): Semaphore value = 0 (Process C unblocked)',
    'Process C completes and performs signal(): Semaphore value = 1 (resource available)'
  ];

  test.describe('Basic UI and initial state', () => {
    let demo;
    test.beforeEach(async ({ page }) => {
      demo = new DemoPage(page);
      await demo.goto();
    });

    test.afterEach(async () => {
      demo.detachListeners();
    });

    test('Initial Idle state shows button and hint text', async () => {
      // Validate the initial DOM elements: button exists and demoOutput shows prompt
      const button = demo.page.locator('button.button');
      await expect(button).toHaveCount(1);
      const output = await demo.getOutputText();
      // The HTML initial text is explicit; verify it is shown (evidence in FSM S0_Idle)
      expect(output.trim()).toBe('Click the button to start the demonstration...');
      // Ensure the runDemo function is defined (onclick references it)
      const hasRunDemo = await demo.page.evaluate(() => typeof window.runDemo === 'function');
      expect(hasRunDemo).toBe(true);
      // The FSM mentions an entry action renderPage() for Idle; verify it's not defined on window
      // We verify this by checking typeof renderPage is 'undefined' (it was not provided in the HTML)
      const renderPageType = await demo.page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');
    });

    test('Calling the provided runDemo function updates the output text', async () => {
      // Click once and verify transition to Demo Step 0 (S1_DemoStep0)
      await demo.clickRun();
      const text = await demo.getOutputText();
      expect(text.trim()).toBe(demoTexts[0]);

      // Confirm no page errors were emitted during this normal operation
      expect(demo.pageErrors.length).toBe(0);
    });

    test('Calling non-existent renderPage() in page context throws ReferenceError (edge case)', async () => {
      // This test intentionally invokes an undefined function in the page context to assert that a ReferenceError occurs naturally.
      // We do NOT mutate the page or define renderPage; we merely attempt to call it and assert the resulting error.
      let evalError = null;
      try {
        // Calling a function that does not exist should reject the evaluate promise with a ReferenceError from the page
        await demo.evaluate(() => {
          // eslint-disable-next-line no-undef
          renderPage(); // This is intentionally undefined in the page HTML
        });
      } catch (err) {
        evalError = err;
      }
      expect(evalError).not.toBeNull();
      // The thrown error message typically contains 'renderPage is not defined'
      expect(String(evalError.message)).toMatch(/renderPage is not defined|renderPage is not a function/i);
      // Also assert that a pageerror was recorded
      // Note: Some browsers may surface the ReferenceError to the pageerror listener; check for presence but don't require exact length
      const hasRefErrInPageErrors = demo.pageErrors.some(e => /renderPage/.test(String(e.message)));
      // At least one of the mechanisms should have recorded the error: either evaluate rejection or pageerror
      expect(hasRefErrInPageErrors || /renderPage is not defined|renderPage is not a function/i.test(String(evalError.message))).toBeTruthy();
    });
  });

  test.describe('FSM transitions via Run Demonstration button', () => {
    let demo;
    test.beforeEach(async ({ page }) => {
      demo = new DemoPage(page);
      await demo.goto();
    });

    test.afterEach(async () => {
      demo.detachListeners();
    });

    test('Transition sequence: clicking cycles through all defined demo steps and wraps around', async () => {
      // Step through each expected text in order by clicking the button.
      // The first click should show demoTexts[0], then demoTexts[1], ..., demoTexts[6], then wrap to demoTexts[0].
      for (let i = 0; i < demoTexts.length; i++) {
        await demo.clickRun();
        const out = (await demo.getOutputText()).trim();
        expect(out).toBe(demoTexts[i]);
      }

      // One more click should wrap around to the initial demo step (S1 again per FSM transitions)
      await demo.clickRun();
      const wrapped = (await demo.getOutputText()).trim();
      expect(wrapped).toBe(demoTexts[0]);

      // Verify that no TypeError/SyntaxError were thrown during normal operation
      const pageErrorMessages = demo.pageErrors.map(e => String(e.message)).join('\n');
      expect(pageErrorMessages).not.toMatch(/TypeError|SyntaxError/);
    });

    test('Repeated rapid clicks maintain correct cycle behavior (edge case)', async () => {
      // Click many times rapidly and assert the output corresponds to the cycle index
      const clickCount = 15; // more than demoTexts.length to test wrap-around
      for (let i = 0; i < clickCount; i++) {
        await demo.clickRun();
      }
      // After clickCount clicks, the index should be (clickCount - 1) % length because initial page had not started the demo until the first click
      const index = (clickCount - 1) % demoTexts.length;
      const out = (await demo.getOutputText()).trim();
      expect(out).toBe(demoTexts[index]);

      // Ensure no console.error messages were emitted during rapid interaction
      expect(demo.consoleErrors.length).toBe(0);
    });

    test('Direct invocation of runDemo() via evaluate yields identical behavior to clicking', async () => {
      // Call runDemo from page.evaluate to ensure the function exposed by the HTML behaves the same
      // First, reset to a known state by reloading
      await demo.goto();

      // Call runDemo() once via evaluate
      await demo.evaluate(() => {
        // runDemo exists per HTML; invoke it
        window.runDemo();
      });
      const out = (await demo.getOutputText()).trim();
      expect(out).toBe(demoTexts[0]);

      // Call runDemo a few more times and compare to clicks
      await demo.evaluate(() => window.runDemo());
      await demo.evaluate(() => window.runDemo());
      const out2 = (await demo.getOutputText()).trim();
      // After three calls total, the index should be 2 (0-based)
      expect(out2).toBe(demoTexts[2]);
    });
  });

  test.describe('Observability: console and page errors monitoring', () => {
    let demo;
    test.beforeEach(async ({ page }) => {
      demo = new DemoPage(page);
      await demo.goto();
    });

    test.afterEach(async () => {
      demo.detachListeners();
    });

    test('No unexpected console errors or page errors during normal usage', async () => {
      // Perform the full sequence once by clicking the button through all steps
      for (let i = 0; i < demoTexts.length; i++) {
        await demo.clickRun();
      }

      // Assert that no page errors were recorded
      expect(demo.pageErrors.length).toBe(0);

      // Assert that no console.error logs were produced by the page
      expect(demo.consoleErrors.length).toBe(0);

      // Also check that console messages contain the expected UI interactions (if any)
      // While the page does not explicitly console.log the demo texts, ensure we captured console activity if present
      // This assertion is permissive: there may be zero console messages, which is acceptable
      expect(Array.isArray(demo.consoleMessages)).toBe(true);
    });

    test('If runtime errors appear, they are observable and reported by the test', async () => {
      // This test is defensive: we attempt to provoke no changes but assert observability works.
      // We will not trigger page modifications or define global functions.
      // Ensure the listeners are capturing errors by checking their presence on the object.
      expect(typeof demo.page).toBe('object');
      expect(typeof demo.consoleMessages).toBe('object');
      expect(typeof demo.pageErrors).toBe('object');
    });
  });
});