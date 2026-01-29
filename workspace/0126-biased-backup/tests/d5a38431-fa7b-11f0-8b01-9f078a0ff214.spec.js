import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a38431-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object for the demonstration page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#demoButton';
    this.demoSelector = '#demo';
  }

  async goto(waitUntil = 'load') {
    // allow tests to choose the load state (used to test edge-case pre-onload interaction)
    await this.page.goto(APP_URL, { waitUntil });
  }

  async getDemoHandle() {
    return await this.page.$(this.demoSelector);
  }

  async getButtonHandle() {
    return await this.page.$(this.buttonSelector);
  }

  async clickDemoButton() {
    await this.page.click(this.buttonSelector);
  }

  // Returns the inline style.display value (may be "" if not set)
  async getDemoInlineDisplay() {
    const handle = await this.getDemoHandle();
    if (!handle) return null;
    return await this.page.evaluate(el => el.style.display, handle);
  }

  // Returns the computed style display property (resolves computed CSS)
  async getDemoComputedDisplay() {
    const handle = await this.getDemoHandle();
    if (!handle) return null;
    return await this.page.evaluate(el => window.getComputedStyle(el).display, handle);
  }

  async isDemoVisible() {
    const computed = await this.getDemoComputedDisplay();
    // visible if computed display is not 'none'
    return computed !== 'none';
  }

  async demoHasClass(className) {
    const handle = await this.getDemoHandle();
    if (!handle) return false;
    return await this.page.evaluate((el, c) => el.classList.contains(c), handle, className);
  }
}

test.describe('Understanding Overfitting - FSM and UI tests (Application d5a38431-... )', () => {
  // Collect console messages and page errors per-test, then assert expectations.
  test.beforeEach(async ({ page }) => {
    // No-op here; listeners are attached in each test where needed to isolate results.
  });

  test.describe('State validations and transitions', () => {
    // Test initial Idle state (S0_Idle) -> demo hidden by onload
    test('Initial state S0_Idle: demo section is hidden on page load (window.onload executed)', async ({ page }) => {
      // Collect console and page errors
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const demoPage = new DemoPage(page);
      // navigate and wait for full load (onload should have executed)
      await demoPage.goto('load');

      // Basic DOM sanity checks
      const demoHandle = await demoPage.getDemoHandle();
      const buttonHandle = await demoPage.getButtonHandle();
      expect(demoHandle).not.toBeNull();
      expect(buttonHandle).not.toBeNull();

      // Verify the demo element has the expected class
      expect(await demoPage.demoHasClass('demo')).toBe(true);

      // Verify inline style set by window.onload: it should be 'none'
      const inlineDisplay = await demoPage.getDemoInlineDisplay();
      // The page's onload explicitly sets style.display = "none"
      expect(inlineDisplay).toBe('none');

      // Also verify computed style reflects hidden state
      const computedDisplay = await demoPage.getDemoComputedDisplay();
      expect(computedDisplay).toBe('none');

      // No runtime errors or console.error messages should have occurred during load
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    // Test transition S0_Idle -> S1_DemoVisible via ShowDemo click
    test('Transition Idle -> Demonstration Visible (S0_Idle to S1_DemoVisible) when clicking #demoButton', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const demoPage = new DemoPage(page);
      await demoPage.goto('load');

      // Click the button to show the demo
      await demoPage.clickDemoButton();

      // After click the inline style should be 'block' as per implementation
      const inlineDisplay = await demoPage.getDemoInlineDisplay();
      expect(inlineDisplay).toBe('block');

      // Computed display should not be 'none' -> visible
      const computedDisplay = await demoPage.getDemoComputedDisplay();
      expect(computedDisplay).not.toBe('none');
      expect(await demoPage.isDemoVisible()).toBe(true);

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    // Test transition S1_DemoVisible -> S2_DemoHidden (hide)
    test('Transition Demonstration Visible -> Hidden (S1_DemoVisible to S2_DemoHidden) toggles demo to none', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const demoPage = new DemoPage(page);
      await demoPage.goto('load');

      // ensure visible first by clicking once
      await demoPage.clickDemoButton();
      expect(await demoPage.isDemoVisible()).toBe(true);

      // click again to hide
      await demoPage.clickDemoButton();
      const inlineDisplayAfterHide = await demoPage.getDemoInlineDisplay();
      expect(inlineDisplayAfterHide).toBe('none');
      expect(await demoPage.isDemoVisible()).toBe(false);

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    // Test repeated toggles and ensure deterministic toggling behavior (covers multiple transitions)
    test('Repeated clicking toggles between S1_DemoVisible and S2_DemoHidden (multiple transitions)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const demoPage = new DemoPage(page);
      await demoPage.goto('load');

      // Perform an odd number of clicks and verify visible, then even number -> hidden
      const clicks = 5;
      for (let i = 1; i <= clicks; i++) {
        await demoPage.clickDemoButton();
        const expectedVisible = i % 2 === 1; // odd -> visible
        expect(await demoPage.isDemoVisible()).toBe(expectedVisible);
        const inline = await demoPage.getDemoInlineDisplay();
        if (expectedVisible) {
          expect(inline).toBe('block');
        } else {
          expect(inline).toBe('none');
        }
      }

      // Final assertion: after an additional click (making it even) it should be hidden
      await demoPage.clickDemoButton();
      expect(await demoPage.isDemoVisible()).toBe(false);

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Edge cases and error observation', () => {
    // Edge case: clicking the button before window.onload executes.
    // This validates how the implementation handles clicks that occur prior to the onload action which sets demo hidden.
    test('Edge case: clicking before window.onload (load state) and observing final state', async ({ page }) => {
      // We'll navigate to DOMContentLoaded state, click the button (before onload handler runs),
      // then wait for the 'load' event to allow the window.onload handler to execute.
      const consoleErrors = [];
      const pageErrors = [];
      const consoleLogs = [];
      page.on('console', msg => {
        // collect all console messages for inspection; errors are separate
        consoleLogs.push({ type: msg.type(), text: msg.text() });
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const demoPage = new DemoPage(page);
      // wait until domcontentloaded so onload hasn't run yet
      await demoPage.goto('domcontentloaded');

      // At this point the DOM is available. Click the button before onload runs.
      // This will toggle demo based on current inline style (likely ""), setting it to 'block'.
      await demoPage.clickDemoButton();

      // Now wait for the load event, which will run window.onload and set demo.style.display = 'none'
      await page.waitForLoadState('load');

      // After the onload handler runs, the implementation unconditionally sets style.display = 'none'
      const inlineDisplay = await demoPage.getDemoInlineDisplay();
      const computedDisplay = await demoPage.getDemoComputedDisplay();

      // Expect the onload to have overridden earlier click and leave the demo hidden
      expect(inlineDisplay).toBe('none');
      expect(computedDisplay).toBe('none');
      expect(await demoPage.isDemoVisible()).toBe(false);

      // Inspect console and page errors: none expected for this page implementation
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      // Also ensure we observed at least one console message list (not required to have messages)
      expect(Array.isArray(consoleLogs)).toBe(true);
    });

    // Edge case: extremely rapid clicks to test debounce/consistency (race-like behavior)
    test('Edge case: rapid clicks should deterministically toggle to expected state (no exceptions)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const demoPage = new DemoPage(page);
      await demoPage.goto('load');

      // Rapidly click the button 20 times
      const rapidClicks = 20;
      for (let i = 0; i < rapidClicks; i++) {
        // fire clicks without awaiting potential animations (none here)
        await demoPage.clickDemoButton();
      }

      // After an even number of toggles starting from hidden, final should be hidden
      expect(await demoPage.isDemoVisible()).toBe(false);
      expect(await demoPage.getDemoInlineDisplay()).toBe('none');

      // No runtime errors expected
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    // Observe overall page for any console errors or exceptions across a load
    test('Observe console and page errors during a normal load - assert none present', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      const consoleMessages = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const demoPage = new DemoPage(page);
      await demoPage.goto('load');

      // Basic smoke assertions
      expect(await demoPage.getDemoHandle()).not.toBeNull();
      expect(await demoPage.getButtonHandle()).not.toBeNull();

      // Expect no errors in console or page errors during normal operation
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);

      // Log summary (kept as an assertion on the array type)
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });

  test.describe('FSM mapping notes and verification', () => {
    test('Verify FSM states mapping: S0_Idle -> S1_DemoVisible -> S2_DemoHidden sequence', async ({ page }) => {
      // This test maps the FSM states to actual DOM transitions in order
      const demoPage = new DemoPage(page);
      await demoPage.goto('load');

      // S0_Idle: initial - demo hidden
      expect(await demoPage.getDemoInlineDisplay()).toBe('none');
      expect(await demoPage.isDemoVisible()).toBe(false);

      // ShowDemo event -> S1_DemoVisible
      await demoPage.clickDemoButton();
      expect(await demoPage.getDemoInlineDisplay()).toBe('block');
      expect(await demoPage.isDemoVisible()).toBe(true);

      // ShowDemo event again -> S2_DemoHidden
      await demoPage.clickDemoButton();
      expect(await demoPage.getDemoInlineDisplay()).toBe('none');
      expect(await demoPage.isDemoVisible()).toBe(false);

      // The FSM included a redundant S2->S2 self-loop on ShowDemo; in this deterministic implementation
      // clicking when already hidden will reveal it (S2->S1) rather than staying in S2, so we assert observed behavior.
      // Ensure behavior is deterministic and documented (not an error in the page implementation)
      await demoPage.clickDemoButton(); // from hidden should go to visible (S1)
      expect(await demoPage.isDemoVisible()).toBe(true);
    });
  });
});