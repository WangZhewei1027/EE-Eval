import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83579b2-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the DFS demo page to encapsulate common actions and selectors.
class DfsDemoPage {
  constructor(page) {
    this.page = page;
    this.button = page.locator('#toggleDemo');
    this.demoBlock = page.locator('#demoBlock');
    this.demoTrace = page.locator('#demoTrace');
  }

  // Navigate to the application page and ensure basic elements are attached.
  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the main interactive elements are present in the DOM.
    await expect(this.button).toBeVisible();
    await expect(this.demoBlock).toBeAttached();
    await expect(this.demoTrace).toBeAttached();
  }

  // Click the toggle button (single click).
  async clickToggle() {
    await this.button.click();
  }

  // Return the current computed display style of the demo block (e.g., 'none' or 'block').
  async demoDisplay() {
    return await this.demoBlock.evaluate(node => window.getComputedStyle(node).display);
  }

  // Return the value of aria-expanded on the toggle button.
  async buttonAriaExpanded() {
    return await this.button.getAttribute('aria-expanded');
  }

  // Return the value of aria-hidden on the demo block.
  async demoAriaHidden() {
    return await this.demoBlock.getAttribute('aria-hidden');
  }

  // Return the trace text content as currently in the DOM.
  async traceText() {
    return await this.demoTrace.textContent();
  }
}

test.describe('Depth-First Search (DFS) demo — FSM states & transitions', () => {
  let pageErrors = [];
  let consoleErrors = [];

  // Attach listeners and navigate before each test. Reset collected errors each time.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught exceptions on the page.
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages of type 'error' for diagnostics.
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  // After each test, assert that no unexpected JS runtime errors were emitted.
  test.afterEach(async () => {
    // Fail the test if any uncaught page errors occurred.
    if (pageErrors.length > 0) {
      // Re-throw the first error to surface the stack in Playwright output.
      throw pageErrors[0];
    }
    // Also assert that no console-level errors were logged.
    expect(consoleErrors, 'No console error messages should be emitted during tests').toEqual([]);
  });

  test('Initial Idle state (S0_Idle) renders correctly', async ({ page }) => {
    // This test validates the Idle state entry (renderPage()) and initial DOM evidence.
    const demo = new DfsDemoPage(page);
    await demo.goto();

    // The toggle button should exist and start with aria-expanded="false".
    await expect(demo.button).toBeVisible();
    const ariaExpanded = await demo.buttonAriaExpanded();
    expect(ariaExpanded).toBe('false');

    // The demo block should be hidden initially (display: none) and aria-hidden="true".
    const display = await demo.demoDisplay();
    expect(display).toBe('none');
    const ariaHidden = await demo.demoAriaHidden();
    expect(ariaHidden).toBe('true');

    // The trace area should contain the placeholder text from the HTML before toggling.
    const traceText = await demo.traceText();
    expect(traceText).toContain('[Trace hidden — click the button above to show or hide this block.]');

    // No runtime errors should have been recorded by the listeners (checked in afterEach).
  });

  test('Click Toggle -> S1_DemoVisible: demo block becomes visible & trace is populated', async ({ page }) => {
    // This test validates the transition from Idle to Demo Visible when the toggle button is clicked.
    const demo = new DfsDemoPage(page);
    await demo.goto();

    // Click the toggle to show the demo (transition S0_Idle -> S1_DemoVisible).
    await demo.clickToggle();

    // The demo block should now be visible and its computed display style should be 'block'.
    await expect.poll(async () => await demo.demoDisplay(), { timeout: 2000 }).toBe('block');

    // Accessibility attributes should reflect the visible state.
    const ariaExpandedAfter = await demo.buttonAriaExpanded();
    expect(ariaExpandedAfter).toBe('true');
    const ariaHiddenAfter = await demo.demoAriaHidden();
    expect(ariaHiddenAfter).toBe('false');

    // The trace area should be updated to contain the compact trace string set by the script.
    const traceText = await demo.traceText();
    expect(traceText).toContain('DFS Compact Trace for the sample graph:');
    expect(traceText).toContain('Final times: d/f -> A:1/12');

    // Confirm the toggle button retains the expected class etc.
    await expect(demo.button).toHaveClass(/demo-toggle/);
  });

  test('Click Toggle again -> S2_DemoHidden: demo block hides and attributes toggle back', async ({ page }) => {
    // This test validates S1_DemoVisible -> S2_DemoHidden transition and return to Idle-like hidden state.
    const demo = new DfsDemoPage(page);
    await demo.goto();

    // Show first
    await demo.clickToggle();
    await expect.poll(async () => await demo.demoDisplay(), { timeout: 2000 }).toBe('block');

    // Now click to hide
    await demo.clickToggle();

    // After hiding, computed display should be 'none' again.
    await expect.poll(async () => await demo.demoDisplay(), { timeout: 2000 }).toBe('none');

    // aria attributes should have been toggled back.
    const ariaExpanded = await demo.buttonAriaExpanded();
    expect(ariaExpanded).toBe('false');
    const ariaHidden = await demo.demoAriaHidden();
    expect(ariaHidden).toBe('true');

    // Even when hidden, the trace text may persist in DOM; check that the DOM contains the compact trace that was previously set.
    // Because the demo was shown then hidden, trace text should contain the compact trace content (unless the implementation cleared it).
    const traceText = await demo.traceText();
    // The placeholder may have been replaced by the compact trace text earlier; accept either placeholder or compact trace.
    expect(
      traceText.includes('[Trace hidden — click the button above to show or hide this block.]') ||
      traceText.includes('DFS Compact Trace for the sample graph:')
    ).toBe(true);
  });

  test('Repeated and rapid toggles: transitions remain consistent (S2 <-> S1)', async ({ page }) => {
    // This test exercises multiple ToggleDemo events in quick succession and verifies final state and attributes.
    const demo = new DfsDemoPage(page);
    await demo.goto();

    // Define a sequence of clicks and expected states after each click.
    // Start state: hidden (S0 / S2). After odd number of clicks -> visible (S1). After even -> hidden (S2).
    const clicks = 5; // odd => final expected visible
    for (let i = 0; i < clicks; i++) {
      // Small pause between clicks to simulate rapid human toggling but allow event queue processing.
      await demo.clickToggle();
      // Allow microtask processing
      await page.waitForTimeout(50);
    }

    // Final expected: visible since we clicked 5 times starting from hidden.
    const finalDisplay = await demo.demoDisplay();
    expect(finalDisplay).toBe('block');
    expect(await demo.buttonAriaExpanded()).toBe('true');
    expect(await demo.demoAriaHidden()).toBe('false');

    // Now click one more time to return to hidden and verify.
    await demo.clickToggle();
    await expect.poll(async () => await demo.demoDisplay(), { timeout: 2000 }).toBe('none');
    expect(await demo.buttonAriaExpanded()).toBe('false');
    expect(await demo.demoAriaHidden()).toBe('true');
  });

  test('Edge cases: clicking when DOM attributes are already set and idempotence', async ({ page }) => {
    // This test validates idempotence and robustness: repeated clicks and verifying attributes remain consistent.
    const demo = new DfsDemoPage(page);
    await demo.goto();

    // Manually click to show, then click again to hide, then click again to show.
    await demo.clickToggle(); // show
    await expect.poll(async () => await demo.demoDisplay(), { timeout: 2000 }).toBe('block');
    const traceWhenVisible = await demo.traceText();
    expect(traceWhenVisible).toContain('DFS Compact Trace for the sample graph:');

    await demo.clickToggle(); // hide
    await expect.poll(async () => await demo.demoDisplay(), { timeout: 2000 }).toBe('none');

    // Click again to show; trace should be (re)populated again (implementation sets text only when showing).
    await demo.clickToggle(); // show again
    await expect.poll(async () => await demo.demoDisplay(), { timeout: 2000 }).toBe('block');
    const traceAfterReShow = await demo.traceText();
    expect(traceAfterReShow).toContain('DFS Compact Trace for the sample graph:');

    // The trace content should be consistent between shows (or at least contain key summary lines).
    expect(traceAfterReShow).toContain('Final times: d/f -> A:1/12');
  });

  test('Observe console and page errors (assert none of ReferenceError/SyntaxError/TypeError occurred)', async ({ page }) => {
    // This test intentionally loads the page and asserts that no fatal JS runtime errors occurred.
    // It also demonstrates observing console and page-level exceptions.
    const demo = new DfsDemoPage(page);
    await demo.goto();

    // No interactions are required; listeners were attached in beforeEach.
    // Wait briefly to let any potential deferred errors surface.
    await page.waitForTimeout(200);

    // pageErrors and consoleErrors are asserted in afterEach, but we make explicit checks here:
    // Ensure there are no page errors of common types (ReferenceError, SyntaxError, TypeError).
    const errorNames = pageErrors.map(e => (e && e.name) || '');
    const forbidden = ['ReferenceError', 'SyntaxError', 'TypeError'];
    for (const f of forbidden) {
      expect(errorNames.includes(f), `No ${f} should be present`).toBe(false);
    }

    // Also ensure console errors array is empty.
    expect(consoleErrors.length).toBe(0);
  });
});