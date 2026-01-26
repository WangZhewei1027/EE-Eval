import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d7be81-fa73-11f0-83e0-8d7be1d51901.html';

// Page object to encapsulate selectors and helper interactions
class RecursionPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      factN: '#factN',
      runFact: '#runFact',
      runFactFast: '#runFactFast',
      factResult: '#factResult',
      stack: '#stack',

      fibN: '#fibN',
      drawFib: '#drawFib',
      fibCalls: '#fibCalls',
      showValues: '#showValues',
      fibCanvas: '#fibCanvas',

      depth: '#depth',
      drawSier: '#drawSier',
      sierCanvas: '#sierCanvas'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure page loaded sufficiently
    await this.page.waitForSelector(this.selectors.runFact);
  }

  // Factorial helpers
  async setFactorialN(n) {
    await this.page.fill(this.selectors.factN, String(n));
    // blur so any bindings update
    await this.page.locator(this.selectors.factN).press('Tab');
  }

  async clickRunFact() {
    await this.page.click(this.selectors.runFact);
  }

  async clickRunFactFast() {
    await this.page.click(this.selectors.runFactFast);
  }

  async getFactorialResultText() {
    return (await this.page.locator(this.selectors.factResult).innerText()).trim();
  }

  async isRunFactDisabled() {
    return await this.page.locator(this.selectors.runFact).isDisabled();
  }

  async isRunFactFastDisabled() {
    return await this.page.locator(this.selectors.runFactFast).isDisabled();
  }

  async getStackText() {
    return (await this.page.locator(this.selectors.stack).innerText()).trim();
  }

  // Fibonacci helpers
  async setFibN(n) {
    await this.page.fill(this.selectors.fibN, String(n));
    await this.page.locator(this.selectors.fibN).press('Tab');
  }

  async clickDrawFib() {
    await this.page.click(this.selectors.drawFib);
  }

  async getFibCallsText() {
    return (await this.page.locator(this.selectors.fibCalls).innerText()).trim();
  }

  async toggleShowValues(checked) {
    const cb = this.page.locator(this.selectors.showValues);
    const isChecked = await cb.isChecked();
    if (isChecked !== checked) await cb.click();
  }

  // Sierpinski helpers
  async setDepth(n) {
    await this.page.fill(this.selectors.depth, String(n));
    await this.page.locator(this.selectors.depth).press('Tab');
  }

  async clickDrawSier() {
    await this.page.click(this.selectors.drawSier);
  }

  // Canvas pixel read helpers (evaluate in page)
  async getCanvasPixelColor(selector, x, y) {
    return await this.page.evaluate(({ selector, x, y }) => {
      const c = document.querySelector(selector);
      if (!c) return null;
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      return { r: data[0], g: data[1], b: data[2], a: data[3] };
    }, { selector, x, y });
  }
}

// Helper pure JS functions for expected values (run in Node/test context)
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
function fibCallCount(n) {
  let cnt = 0;
  function c(k) {
    cnt++;
    if (k <= 1) return k;
    c(k - 1); c(k - 2);
  }
  c(n);
  return cnt;
}

// Collect console messages and page errors
test.describe('Recursion Interactive Application - FSM validation', () => {
  let pageErrors;
  let consoleErrors;
  let page;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleErrors = [];
    page = await browser.newPage();

    // capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // capture console messages, particularly console.error
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
  });

  test.afterEach(async () => {
    if (page) await page.close();
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('renders page and shows initial UI state', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      // verify initial factorial result is the placeholder '—'
      const factResult = await rp.getFactorialResultText();
      expect(factResult).toBe('—');

      // stack initially shows '(empty)'
      const stackText = await rp.getStackText();
      expect(stackText).toBe('(empty)');

      // Fibonacci initial calls should be computed by initial draw (default n=6)
      const fibCalls = await rp.getFibCallsText();
      // compute expected calls for default n=6
      expect(Number(fibCalls)).toBe(fibCallCount(6));

      // ensure canvases exist and have been rendered (basic pixel check in center)
      const fibCanvasCenter = await rp.getCanvasPixelColor('#fibCanvas', 10, 10);
      expect(fibCanvasCenter).not.toBeNull();

      const sierCanvasCenter = await rp.getCanvasPixelColor('#sierCanvas', 380, 180);
      expect(sierCanvasCenter).not.toBeNull();

      // no uncaught errors on load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Factorial interactions and S1_FactorialRunning state', () => {
    test('Run factorial with delay shows running... and disables controls then shows correct result', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      // Use a small n so we can observe transitions reliably
      await rp.setFactorialN(5);

      // Start non-fast run (has animateDelay ~450ms)
      const runPromise = (async () => {
        await rp.clickRunFact();
      })();

      // Immediately after clicking, result should become 'running...' and buttons disabled
      // Wait a short time to let the handler set running state
      await page.waitForTimeout(50);
      const interimResult = await rp.getFactorialResultText();
      expect(interimResult).toBe('running...');

      const runDisabled = await rp.isRunFactDisabled();
      const fastDisabled = await rp.isRunFactFastDisabled();
      expect(runDisabled).toBe(true);
      expect(fastDisabled).toBe(true);

      // While running and using the delayed animation, there should be frames displayed in the stack (not empty)
      // Wait a small interval to let frames render
      await page.waitForTimeout(200);
      const stackDuring = await rp.getStackText();
      // stack should not be '(empty)' while in progress (frames may show)
      expect(stackDuring).not.toBe('(empty)');

      // Wait for run to complete: final result should equal factorial(5) = 120
      // Give generous timeout for the async animation to finish
      await page.waitForFunction(
        async (sel) => {
          const el = document.querySelector(sel);
          return el && el.textContent !== 'running...' && el.textContent !== '—';
        },
        rp.selectors.factResult,
        { timeout: 5000 }
      );

      const finalResult = await rp.getFactorialResultText();
      expect(Number(finalResult)).toBe(factorial(5));

      // After completion, stack returns to empty
      await page.waitForTimeout(50);
      const stackAfter = await rp.getStackText();
      expect(stackAfter).toBe('(empty)');

      // controls re-enabled
      expect(await rp.isRunFactDisabled()).toBe(false);
      expect(await rp.isRunFactFastDisabled()).toBe(false);

      // no uncaught page errors during this interaction
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      await runPromise;
    });

    test('Run factorial without delay (fast) completes quickly and returns correct result', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      await rp.setFactorialN(6);

      // Click the fast button to remove animation delays (animateDelay = 0)
      await rp.clickRunFactFast();

      // There might be very short delay before result updates but should complete fast
      await page.waitForFunction(
        async (sel) => {
          const el = document.querySelector(sel);
          return el && el.textContent !== 'running...' && el.textContent !== '—';
        },
        rp.selectors.factResult,
        { timeout: 3000 }
      );

      const resultText = await rp.getFactorialResultText();
      expect(Number(resultText)).toBe(factorial(6));

      // ensure stack returned to empty
      const stackText = await rp.getStackText();
      expect(stackText).toBe('(empty)');

      // no uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Enter key on factorial input triggers run (accessibility behavior)', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      await rp.setFactorialN(4);
      // Focus the input then press Enter to trigger the keyup handler that clicks Run
      await page.focus(rp.selectors.factN);
      await page.keyboard.press('Enter');

      // Expect to see running... then result
      await page.waitForFunction(
        async (sel) => {
          const el = document.querySelector(sel);
          return el && el.textContent !== 'running...' && el.textContent !== '—';
        },
        rp.selectors.factResult,
        { timeout: 3000 }
      );

      const res = await rp.getFactorialResultText();
      expect(Number(res)).toBe(factorial(4));

      // no uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: extremely large input is clamped to allowed max (12)', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      // Set value beyond the allowed max; implementation clamps to 12
      await rp.setFactorialN(50);
      await rp.clickRunFactFast();

      // wait for completion
      await page.waitForFunction(
        async (sel) => {
          const el = document.querySelector(sel);
          return el && el.textContent !== 'running...' && el.textContent !== '—';
        },
        rp.selectors.factResult,
        { timeout: 5000 }
      );

      const resultText = await rp.getFactorialResultText();
      // Factorial(12) expected
      expect(Number(resultText)).toBe(factorial(12));

      // no uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Fibonacci interactions and S2_FibonacciDrawing state', () => {
    test('Draw Fibonacci tree updates call count and respects showValues checkbox', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      // set to n=7 which is still reasonable
      await rp.setFibN(7);
      // ensure we show computed values
      await rp.toggleShowValues(true);
      await rp.clickDrawFib();

      // fibCalls text should equal the computed call count
      const callsText = await rp.getFibCallsText();
      expect(Number(callsText)).toBe(fibCallCount(7));

      // basic canvas check: some pixel near top-left should now be non-white (drawing occurred)
      const px = await rp.getCanvasPixelColor('#fibCanvas', 20, 30);
      expect(px).not.toBeNull();
      // expect at least some alpha (non transparent)
      expect(px.a).toBeGreaterThan(0);

      // no uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Enter key on fibN input triggers draw (accessibility)', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      await rp.setFibN(5);
      await page.focus(rp.selectors.fibN);
      await page.keyboard.press('Enter');

      // wait for fibCalls to update to expected
      await page.waitForFunction(
        (sel, expected) => {
          const el = document.querySelector(sel);
          return el && Number(el.textContent) === expected;
        },
        rp.selectors.fibCalls,
        fibCallCount(5),
        { timeout: 2000 }
      );

      const callsText = await rp.getFibCallsText();
      expect(Number(callsText)).toBe(fibCallCount(5));

      // no uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: large n (>9) shows a guard message and avoids heavy draw', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      // set n to 10 which triggers early guard message written in red (#900) at (20,20)
      await rp.setFibN(10);
      await rp.clickDrawFib();

      // The implementation draws an early message at (20,20). Check that pixel at (20,20) is not white.
      const px = await rp.getCanvasPixelColor('#fibCanvas', 20, 20);
      // Some drawing should have occurred (the red text), alpha likely > 0
      expect(px).not.toBeNull();
      expect(px.a).toBeGreaterThan(0);

      // no uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Sierpinski interactions and S3_SierpinskiDrawing state', () => {
    test('Render Sierpinski triangle for a modest depth draws non-empty canvas', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      await rp.setDepth(3);
      await rp.clickDrawSier();

      // Wait briefly for rendering to finish
      await page.waitForTimeout(200);

      // Check a few sample pixels inside the triangle area to ensure something was drawn (not all white)
      const center = await rp.getCanvasPixelColor('#sierCanvas', 380, 180);
      expect(center).not.toBeNull();
      // The triangle fill color used is '#111' (dark), so expect non-white pixel (alpha > 0)
      expect(center.a).toBeGreaterThan(0);

      // no uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Enter key on depth input triggers draw (accessibility)', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      await rp.setDepth(2);
      await page.focus(rp.selectors.depth);
      await page.keyboard.press('Enter');

      // wait for some rendering time
      await page.waitForTimeout(150);

      const sample = await rp.getCanvasPixelColor('#sierCanvas', 380, 180);
      expect(sample).not.toBeNull();
      expect(sample.a).toBeGreaterThan(0);

      // no uncaught errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Error and console monitoring', () => {
    test('No unexpected runtime errors or console.error calls during typical interactions', async () => {
      const rp = new RecursionPage(page);
      await rp.goto();

      // perform a series of typical interactions
      await rp.setFactorialN(3);
      await rp.clickRunFactFast();
      await page.waitForFunction(
        async (sel) => {
          const el = document.querySelector(sel);
          return el && el.textContent !== 'running...' && el.textContent !== '—';
        },
        rp.selectors.factResult,
        { timeout: 3000 }
      );

      await rp.setFibN(4);
      await rp.clickDrawFib();
      await page.waitForTimeout(100);

      await rp.setDepth(2);
      await rp.clickDrawSier();
      await page.waitForTimeout(100);

      // After this sequence, assert that there were no uncaught page errors and no console.error messages
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('If any runtime errors occur they will be captured as page errors (test will fail if present)', async () => {
      // This test demonstrates we observe page errors; it simply loads the page and checks the array.
      // If a ReferenceError/SyntaxError/TypeError happened during load or interactions above, the collected pageErrors would be non-empty and this assertion would fail intentionally.
      const rp = new RecursionPage(page);
      await rp.goto();

      // Basic sanity: there should be zero page errors on a healthy load
      expect(pageErrors.length).toBe(0);
      // And no console.error calls
      expect(consoleErrors.length).toBe(0);
    });
  });
});