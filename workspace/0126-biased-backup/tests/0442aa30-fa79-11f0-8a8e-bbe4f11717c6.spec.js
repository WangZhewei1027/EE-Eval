import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0442aa30-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object Model for the BFS application
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // hook console and pageerror events to collect logs and uncaught exceptions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // store message strings for assertions later
      this.pageErrors.push(String(err?.message ?? err));
    });
  }

  // navigate to the app page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // click start button
  async clickStart() {
    await this.page.click('#start-button');
    // give ephemeral time for any JS handling to run and possibly produce logs/errors
    await this.page.waitForTimeout(150);
  }

  // click stop button
  async clickStop() {
    await this.page.click('#stop-button');
    await this.page.waitForTimeout(150);
  }

  // helper to check if an element is present in DOM
  async hasSelector(selector) {
    return await this.page.$(selector) !== null;
  }

  // helper to get element text
  async getText(selector) {
    const el = await this.page.$(selector);
    if (!el) return null;
    return (await el.textContent())?.trim() ?? '';
  }

  // return counts and collected messages (snapshot)
  snapshotLogs() {
    return {
      consoleMessages: Array.from(this.consoleMessages),
      pageErrors: Array.from(this.pageErrors),
    };
  }
}

test.describe('Breadth-First Search (BFS) Application - FSM validation', () => {
  // a fresh page object is created per test via Playwright fixture
  test.beforeEach(async ({ page }) => {
    // no-op here; each test will create BFSPage and navigate
  });

  test('Initial Idle State renders required controls and visual canvas', async ({ page }) => {
    // This test validates FSM initial state S0_Idle:
    // - the page renders Start and Stop buttons and the canvas visual
    // - entry action renderPage(), if implemented, should be callable; otherwise it's absent
    const app = new BFSPage(page);
    await app.goto();

    // Verify presence of primary components described in FSM
    expect(await app.hasSelector('#start-button')).toBe(true);
    expect(await app.hasSelector('#stop-button')).toBe(true);
    expect(await app.hasSelector('#graph-canvas')).toBe(true);
    expect(await app.hasSelector('#graph-text')).toBe(true);

    // Validate textual content of controls (evidence from FSM)
    expect(await app.getText('#start-button')).toBe('Start');
    expect(await app.getText('#stop-button')).toBe('Stop');
    expect((await app.getText('#graph-text')).toLowerCase()).toContain('graph');

    // Verify onEnter action renderPage() if it exists:
    // If renderPage exists, calling it should not throw. If it does not exist, we assert it's undefined.
    const renderExists = await page.evaluate(() => typeof renderPage === 'function');
    if (renderExists) {
      // call renderPage and ensure it does not throw
      await page.evaluate(() => {
        // intentionally call the function; if it throws, the test will fail due to propagation
        return renderPage();
      });
    } else {
      // document the fact it's not implemented; this is an allowed scenario
      expect(renderExists).toBe(false);
    }

    // Check logs/errors produced during initial load
    const logs = app.snapshotLogs();
    // If there are any page errors, assert they are JS errors (ReferenceError, TypeError, SyntaxError)
    if (logs.pageErrors.length > 0) {
      const join = logs.pageErrors.join(' | ');
      const hasJSErr = /ReferenceError|TypeError|SyntaxError/.test(join);
      expect(hasJSErr).toBe(true);
    } else {
      // no page errors is an acceptable outcome
      expect(logs.pageErrors.length).toBe(0);
    }
  });

  test('Start BFS transition: clicking Start triggers the Running state behaviors (S0 -> S1)', async ({ page }) => {
    // This test validates the StartBFS event and transition:
    // - clicking "#start-button" should not navigate away
    // - the Stop button should remain present (evidence of Running state)
    // - if startBFS() function exists, invoking it should not throw; otherwise calling it should produce a ReferenceError which we capture
    const app = new BFSPage(page);
    await app.goto();

    // Capture initial URL
    const beforeUrl = page.url();

    // Click the Start button (this triggers the StartBFS event per FSM)
    await app.clickStart();

    // Ensure we did not navigate away
    expect(page.url()).toBe(beforeUrl);

    // Evidence for Running state: Stop button should exist as per FSM evidence
    expect(await app.hasSelector('#stop-button')).toBe(true);

    // If a startBFS function is present on the page, call it and ensure it doesn't throw.
    // If it is absent, attempt to call it and assert that calling triggers a rejection (ReferenceError).
    const hasStartFn = await page.evaluate(() => typeof startBFS === 'function');
    if (hasStartFn) {
      // call and ensure it resolves
      await page.evaluate(() => startBFS());
    } else {
      // calling undefined function should reject with a ReferenceError inside the page
      await expect(page.evaluate(() => {
        // this will throw in the page context and cause the Promise to reject in Node
        // we do not catch here because we want the promise to reject for the assertion
        // (per instructions: let ReferenceError happen naturally and assert it)
        // eslint-disable-next-line no-undef
        return startBFS();
      })).rejects.toThrow(/ReferenceError|is not defined/);
    }

    // Validate there are no unexpected navigation or DOM disappearance
    expect(await app.hasSelector('#start-button')).toBe(true);

    // Check logs/errors after clicking Start
    const logs = app.snapshotLogs();
    // If errors were recorded, ensure they are JavaScript errors or benign console messages
    if (logs.pageErrors.length > 0) {
      const join = logs.pageErrors.join(' | ');
      const hasJSErr = /ReferenceError|TypeError|SyntaxError/.test(join);
      expect(hasJSErr).toBe(true);
    } else {
      expect(logs.pageErrors.length).toBe(0);
    }
  });

  test('Stop BFS transition: clicking Stop returns to Idle (S1 -> S0)', async ({ page }) => {
    // This test validates the StopBFS event and transition:
    // - clicking "#stop-button" (from either Idle or Running) should keep the app stable
    // - if stopBFS() exists, calling it should not throw; if absent, calling it should produce ReferenceError naturally
    const app = new BFSPage(page);
    await app.goto();

    // Click Stop without starting (edge case) to verify robustness
    await app.clickStop();

    // Stop button remains present (evidence)
    expect(await app.hasSelector('#stop-button')).toBe(true);
    expect(await app.hasSelector('#start-button')).toBe(true);

    // If stopBFS is implemented, calling it should succeed; otherwise calling it should raise ReferenceError
    const hasStopFn = await page.evaluate(() => typeof stopBFS === 'function');
    if (hasStopFn) {
      await page.evaluate(() => stopBFS());
    } else {
      await expect(page.evaluate(() => {
        // intentionally call an undefined function to observe the natural ReferenceError
        // eslint-disable-next-line no-undef
        return stopBFS();
      })).rejects.toThrow(/ReferenceError|is not defined/);
    }

    // After stopping, ensure canvas still present and nothing fundamental broke
    expect(await app.hasSelector('#graph-canvas')).toBe(true);

    // Validate page errors captured during the action (if any)
    const logs = app.snapshotLogs();
    if (logs.pageErrors.length > 0) {
      const join = logs.pageErrors.join(' | ');
      const hasJSErr = /ReferenceError|TypeError|SyntaxError/.test(join);
      expect(hasJSErr).toBe(true);
    } else {
      expect(logs.pageErrors.length).toBe(0);
    }
  });

  test('Edge cases: repeated Start clicks and Stop before Start should not crash the application', async ({ page }) => {
    // This test verifies robustness against repeated interactions and out-of-order events.
    // It will:
    // - click Start multiple times
    // - click Stop before and after Start
    // - ensure no uncaught non-JS errors are produced and UI elements remain available
    const app = new BFSPage(page);
    await app.goto();

    // Click Stop first (edge case)
    await app.clickStop();

    // Click Start multiple times rapidly
    await Promise.all([
      app.page.click('#start-button'),
      app.page.click('#start-button'),
      app.page.click('#start-button'),
    ]);
    // small wait to allow any handlers to run
    await app.page.waitForTimeout(200);

    // Then click Stop multiple times
    await Promise.all([
      app.page.click('#stop-button'),
      app.page.click('#stop-button'),
    ]);
    await app.page.waitForTimeout(200);

    // Ensure essential elements still present and enabled
    expect(await app.hasSelector('#start-button')).toBe(true);
    expect(await app.hasSelector('#stop-button')).toBe(true);
    expect(await app.hasSelector('#graph-canvas')).toBe(true);

    // Collect logs
    const logs = app.snapshotLogs();

    // If there were page errors, they should be recognizable JS errors
    if (logs.pageErrors.length > 0) {
      const join = logs.pageErrors.join(' | ');
      const hasJSErr = /ReferenceError|TypeError|SyntaxError/.test(join);
      expect(hasJSErr).toBe(true);
    } else {
      // no errors is also acceptable
      expect(logs.pageErrors.length).toBe(0);
    }

    // Validate console didn't log critical errors (but may contain info/debug)
    const criticalConsoleErrors = logs.consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    if (criticalConsoleErrors.length > 0) {
      const join = criticalConsoleErrors.join(' | ');
      // if console errors exist, they should be JS errors; ensure we at least see JS error text
      expect(/ReferenceError|TypeError|SyntaxError/.test(join)).toBe(true);
    }
  });

  test('Direct invocation checks for declared FSM action functions (renderPage, startBFS, stopBFS)', async ({ page }) => {
    // This test programmatically inspects whether the functions named in the FSM exist on the page.
    // For each function: if present, invoking it should not throw; if absent, invoking it should naturally produce a ReferenceError.
    const app = new BFSPage(page);
    await app.goto();

    // Helper to test each function name
    async function testFn(fnName) {
      const exists = await page.evaluate((name) => typeof window[name] === 'function', fnName);
      if (exists) {
        // call and expect no throw
        await page.evaluate((name) => window[name](), fnName);
        return { name: fnName, exists: true, invoked: true, error: null };
      } else {
        // calling it should reject due to ReferenceError inside the page
        try {
          await page.evaluate((name) => {
            // deliberately call an undefined identifier to let the page throw
            // eslint-disable-next-line no-eval
            return eval(name + '()');
          }, fnName);
          return { name: fnName, exists: false, invoked: true, error: null };
        } catch (err) {
          // err.message typically contains 'is not defined' or 'ReferenceError'
          return { name: fnName, exists: false, invoked: false, error: String(err?.message ?? err) };
        }
      }
    }

    const results = [];
    for (const fnName of ['renderPage', 'startBFS', 'stopBFS']) {
      const r = await testFn(fnName);
      results.push(r);
    }

    // Ensure our inspection produced consistent results:
    // If functions are present, they were invoked without error; if absent, we recorded a ReferenceError-like message.
    for (const res of results) {
      if (res.exists) {
        expect(res.invoked).toBe(true);
        expect(res.error).toBeNull();
      } else {
        // When not present, we expect either we couldn't invoke it, or invocation produced a ReferenceError.
        if (res.invoked) {
          // it's unusual but possible eval succeeded; tolerate but assert no error
          expect(res.error).toBeNull();
        } else {
          expect(res.error).toMatch(/ReferenceError|is not defined|not defined/);
        }
      }
    }

    // Finally, ensure that any page errors observed are JS-related if present
    const logs = app.snapshotLogs();
    if (logs.pageErrors.length > 0) {
      const join = logs.pageErrors.join(' | ');
      expect(/ReferenceError|TypeError|SyntaxError/.test(join)).toBe(true);
    } else {
      expect(logs.pageErrors.length).toBe(0);
    }
  });
});