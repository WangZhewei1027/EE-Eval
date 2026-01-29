import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d833cc01-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the demo portion of the app
class BPlusDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      showDemoBtn: '#showDemo',
      demoContainer: '#demo',
      demoSteps: '#demo .step',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    const btn = await this.page.waitForSelector(this.selectors.showDemoBtn, { state: 'attached' });
    return btn.textContent();
  }

  async clickToggle() {
    await this.page.click(this.selectors.showDemoBtn);
  }

  async isDemoDisplayed() {
    // Use computed style to match what users see
    return this.page.$eval(this.selectors.demoContainer, (el) => {
      return getComputedStyle(el).display !== 'none';
    });
  }

  async getDemoDisplayValue() {
    return this.page.$eval(this.selectors.demoContainer, (el) => getComputedStyle(el).display);
  }

  async getDemoAriaHidden() {
    return this.page.$eval(this.selectors.demoContainer, (el) => el.getAttribute('aria-hidden'));
  }

  async getDemoStepsText() {
    return this.page.$$eval(this.selectors.demoSteps, (nodes) => nodes.map(n => n.textContent.trim()));
  }

  async waitForDemoVisible() {
    await this.page.waitForSelector(this.selectors.demoContainer, { state: 'visible' });
  }

  async waitForDemoHidden() {
    await this.page.waitForSelector(this.selectors.demoContainer, { state: 'hidden' });
  }
}

test.describe('B+ Tree Demo - FSM behavior and runtime observation', () => {
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  // Setup per-test: create fresh collectors and navigate
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // 'pageerror' captures unhandled exceptions on the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    // Navigate to the application as-is (DO NOT modify page)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Helpful debug when tests fail: print console and page errors to the test log
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured console errors:', consoleErrors);
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors);
    }
  });

  test('Initial state (S0_Idle) is rendered correctly with no runtime errors', async ({ page }) => {
    // This test validates the Idle entry state (renderPage()) and inspects runtime errors
    const demo = new BPlusDemoPage(page);

    // Verify button exists and has initial text
    const btn = await page.waitForSelector('#showDemo', { state: 'attached' });
    expect(btn).toBeTruthy();
    const btnText = await btn.textContent();
    expect(btnText.trim()).toBe('Show a simple step-by-step insertion demonstration');

    // Verify demo container exists but is hidden and aria-hidden="true"
    const demoEl = await page.waitForSelector('#demo', { state: 'attached' });
    const display = await demoEl.evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('none');
    const ariaHidden = await demoEl.getAttribute('aria-hidden');
    // The HTML sets aria-hidden="true" initially
    expect(ariaHidden).toBe('true');

    // Ensure the Idle state's expected evidence exists in the DOM (button is present)
    const buttonHtml = await page.$eval('#showDemo', (el) => el.outerHTML);
    expect(buttonHtml).toContain('Show a simple step-by-step insertion demonstration');

    // Assert that no page runtime errors or console errors have been emitted so far
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // Also ensure demo text content is present (but hidden)
    const steps = await demo.getDemoStepsText();
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0]).toContain('Initial:');
  });

  test('Transition S0_Idle -> S1_DemoVisible when clicking the toggle button', async ({ page }) => {
    // Validates the ShowDemoClick event transitions the app to Demo Visible
    const demo = new BPlusDemoPage(page);

    // Precondition checks
    expect(await demo.getButtonText()).toBe('Show a simple step-by-step insertion demonstration');
    expect(await demo.getDemoDisplayValue()).toBe('none');
    expect(await demo.getDemoAriaHidden()).toBe('true');

    // Click the toggle button to show demo
    await demo.clickToggle();

    // After click, demo should be visible (display: block) and aria-hidden = "false"
    await demo.waitForDemoVisible();
    const display = await demo.getDemoDisplayValue();
    expect(display).toBe('block');
    const ariaHidden = await demo.getDemoAriaHidden();
    expect(ariaHidden).toBe('false');

    // Button text should change to "Hide the insertion demonstration"
    const btnText = await demo.getButtonText();
    expect(btnText.trim()).toBe('Hide the insertion demonstration');

    // The demo steps should still be present and in order (sanity check for DOM content)
    const steps = await demo.getDemoStepsText();
    expect(steps.join(' ')).toContain('Insert 10');
    expect(steps.join(' ')).toContain('Final leaves');

    // Confirm no console or page errors occurred during the transition
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_DemoVisible -> S0_Idle when clicking the toggle button again', async ({ page }) => {
    // Validates toggling back hides the demo and restores original button text
    const demo = new BPlusDemoPage(page);

    // Show the demo first
    await demo.clickToggle();
    await demo.waitForDemoVisible();

    // Now click again to hide
    await demo.clickToggle();
    await demo.waitForDemoHidden();

    // After hiding, display should be 'none' and aria-hidden back to 'true'
    const display = await demo.getDemoDisplayValue();
    expect(display).toBe('none');
    const ariaHidden = await demo.getDemoAriaHidden();
    expect(ariaHidden).toBe('true');

    // And the button text should be the original show text
    const btnText = await demo.getButtonText();
    expect(btnText.trim()).toBe('Show a simple step-by-step insertion demonstration');

    // Confirm no console or page errors occurred during toggling back
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid multiple toggles maintain deterministic final state and produce no errors', async ({ page }) => {
    // Edge case: rapid clicking should still flip the shown flag predictably
    const demo = new BPlusDemoPage(page);

    // Get initial state
    const initialDisplay = await demo.getDemoDisplayValue();
    const initialAria = await demo.getDemoAriaHidden();

    // Perform an odd number of quick clicks (5) — final state should be toggled relative to initial
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      // We deliberately do not await any animation; just click quickly
      await page.click('#showDemo');
    }

    // Determine expected final state: toggled if clicks odd
    const shouldBeVisible = clicks % 2 === 1 ? initialDisplay === 'none' : initialDisplay !== 'none';

    // Small wait to settle DOM
    await page.waitForTimeout(50);

    const finalDisplay = await demo.getDemoDisplayValue();
    const finalAria = await demo.getDemoAriaHidden();
    if (shouldBeVisible) {
      expect(finalDisplay).toBe('block');
      expect(finalAria).toBe('false');
    } else {
      expect(finalDisplay).toBe('none');
      expect(finalAria).toBe('true');
    }

    // Button text should match final state
    const btnText = await demo.getButtonText();
    if (shouldBeVisible) {
      expect(btnText.trim()).toBe('Hide the insertion demonstration');
    } else {
      expect(btnText.trim()).toBe('Show a simple step-by-step insertion demonstration');
    }

    // Ensure no console or page errors were emitted during rapid interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('DOM evidence and accessibility attributes persist across state transitions', async ({ page }) => {
    // This test validates the FSM evidence strings and accessibility attributes on enter/exit
    const demo = new BPlusDemoPage(page);

    // Verify evidence present in DOM that corresponds to the FSM's expectations
    const buttonOuter = await page.$eval('#showDemo', (el) => el.outerHTML);
    expect(buttonOuter).toContain('id="showDemo"');
    expect(buttonOuter).toContain('Show a simple step-by-step insertion demonstration');

    // Show the demo
    await demo.clickToggle();
    await demo.waitForDemoVisible();

    // Evidence for S1_DemoVisible: inline style or attribute must reflect visible state
    const styleAttr = await page.$eval('#demo', (el) => el.getAttribute('style'));
    expect(styleAttr).toMatch(/display:\s*block/);

    // Also ensure aria-hidden was set to "false"
    const ariaHidden = await demo.getDemoAriaHidden();
    expect(ariaHidden).toBe('false');

    // Now hide again and assert style and button text return to idle evidence
    await demo.clickToggle();
    await demo.waitForDemoHidden();

    const styleAttrAfter = await page.$eval('#demo', (el) => el.getAttribute('style'));
    expect(styleAttrAfter).toMatch(/display:\s*none/);

    const btnTextAfter = await demo.getButtonText();
    expect(btnTextAfter.trim()).toBe('Show a simple step-by-step insertion demonstration');

    // Confirm no runtime errors were introduced while manipulating evidence attributes
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observe and assert console/page errors capture behavior (should be none for this static demo)', async ({ page }) => {
    // This test explicitly asserts the runtime produces no unhandled exceptions or console errors.
    // Per instructions: observe console logs and page errors; let any ReferenceError/SyntaxError/TypeError happen naturally
    // and assert what was observed. For this page we expect none.

    // Small interaction to ensure any lazy-run code or event handlers execute
    await page.click('#showDemo');
    await page.click('#showDemo'); // toggle twice to exercise handler

    // Wait a tick for any async errors to surface
    await page.waitForTimeout(50);

    // Assert that no console error messages or page errors were captured
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // Additionally assert we did capture some console messages (optional informational)
    // There may be no console.log calls in this app; we don't assert consoleMessages length here,
    // only that errors arrays are empty (we observed and captured the runtime).
  });
});