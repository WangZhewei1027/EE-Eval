import { test, expect } from '@playwright/test';

// Test file: d831d030-fa7b-11f0-b314-ad8654ee5de8.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/d831d030-fa7b-11f0-b314-ad8654ee5de8.html

// Page object for the demo page to keep tests organized and readable.
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d831d030-fa7b-11f0-b314-ad8654ee5de8.html';
    this.selectors = {
      demoBtn: '#demoBtn',
      demoOutput: '#demoOutput',
      arrayVis: '.array-vis',
    };
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async demoButton() {
    return await this.page.$(this.selectors.demoBtn);
  }

  async demoOutput() {
    return await this.page.$(this.selectors.demoOutput);
  }

  async clickDemo(options = {}) {
    // Prefer normal click; test code will decide whether to force clicks
    return await this.page.click(this.selectors.demoBtn, options);
  }

  async getDemoOutputText() {
    const out = await this.demoOutput();
    if (!out) return null;
    return await out.textContent();
  }

  async getDemoOutputStyleDisplay() {
    const out = await this.demoOutput();
    if (!out) return null;
    return await out.evaluate((el) => el.style.display);
  }

  async getDemoButtonDisabled() {
    const btn = await this.demoButton();
    if (!btn) return null;
    return await btn.evaluate((b) => b.disabled);
  }

  async getDemoButtonOpacity() {
    const btn = await this.demoButton();
    if (!btn) return null;
    return await btn.evaluate((b) => b.style.opacity || '');
  }

  async getDemoButtonAriaControls() {
    const btn = await this.demoButton();
    if (!btn) return null;
    return await btn.getAttribute('aria-controls');
  }

  async getDemoOutputAttributes() {
    const out = await this.demoOutput();
    if (!out) return null;
    const role = await out.getAttribute('role');
    const ariaLive = await out.getAttribute('aria-live');
    return { role, ariaLive };
  }
}

test.describe('Arrays interactive demo - FSM and UI validation', () => {

  // Basic smoke test: page loads without runtime errors (no pageerror events),
  // and initial DOM matches Idle (S0_Idle) expectations.
  test('Initial state (S0_Idle): button present, output hidden, accessibility attributes', async ({ page }) => {
    // Capture console errors and page errors to assert no runtime issues on load.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Verify the demo button exists and is in the expected Idle state
    const btn = await demo.demoButton();
    expect(btn).not.toBeNull();
    expect(await demo.getDemoButtonAriaControls()).toBe('demoOutput');

    // Verify the demoOutput element exists and is initially hidden (display:none inline style)
    const out = await demo.demoOutput();
    expect(out).not.toBeNull();
    const display = await demo.getDemoOutputStyleDisplay();
    expect(display).toBe('none');

    // Button should not be disabled at idle.
    const disabled = await demo.getDemoButtonDisabled();
    expect(disabled).toBe(false);

    // Accessibility attributes check for the output region (evidence in FSM/components)
    const attrs = await demo.getDemoOutputAttributes();
    expect(attrs).not.toBeNull();
    expect(attrs.role).toBe('region');
    expect(attrs.ariaLive).toBe('polite');

    // There should be no console errors or page errors on initial load.
    // If there are, include them in the assertion message to help debugging.
    expect(consoleErrors.length, `Console errors on load: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors on load: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  // Test the main transition: clicking the button (ButtonClick) moves from S0_Idle -> S1_DemoRunning
  // Verifies onEnter actions: output displayed, button disabled, opacity changed, text content populated.
  test('Transition ButtonClick: clicking Run demonstration shows demo output and disables button (S1_DemoRunning)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Click the demo button to trigger the demonstration.
    await demo.clickDemo();

    // After clicking: the button should be disabled (evidence in FSM: btn.disabled = true;)
    const disabled = await demo.getDemoButtonDisabled();
    expect(disabled).toBe(true);

    // And the inline style for demoOutput should be set to 'block'.
    const display = await demo.getDemoOutputStyleDisplay();
    expect(display).toBe('block');

    // The button's inline style opacity should be set to 0.8 by the script
    const opacity = await demo.getDemoButtonOpacity();
    // Some browsers may stringify 0.8 as '0.8'; ensure numeric-ish equality is considered.
    expect(opacity === '0.8' || opacity === '0.80' || opacity === '0.800' || opacity === '0.8;').toBe(true);

    // The demoOutput should contain the precomputed demonstration text for linear and binary search
    const text = (await demo.getDemoOutputText()) || '';
    expect(text).toContain('Linear Search Demonstration');
    expect(text).toContain('Binary Search Demonstration');
    expect(text).toContain('Match found at index'); // result line from binary or linear
    expect(text).toContain('Iteration 1'); // evidence of binary search iterations lines

    // Check that the output includes the sorted array and target markers for binary search
    expect(text).toContain('Sorted array: [0,1,3,4,6,8,9]');
    expect(text).toContain('Target: 6');

    // No runtime errors should have been emitted during the click/demo generation.
    expect(consoleErrors.length, `Console errors during demo run: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors during demo run: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  // Edge case and idempotence test: clicking again should have no effect (single-use guard).
  // FSM evidence: if(used) return; used = true;
  test('Idempotence: subsequent clicks do not modify output (single-use guard)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // First click to produce output
    await demo.clickDemo();
    const firstText = (await demo.getDemoOutputText()) || '';
    expect(firstText.length).toBeGreaterThan(0);

    // Attempt to click again. The UI disables the button; use force:true to simulate a second interaction attempt.
    // The underlying handler checks `used` and should return early, so text should NOT change.
    try {
      await demo.clickDemo({ force: true, timeout: 1000 });
    } catch (err) {
      // Playwright may complain about clicking a disabled element; ignore that as long as behavior remains idempotent.
    }

    const secondText = (await demo.getDemoOutputText()) || '';

    // The text must remain identical (no duplication or new appended output)
    expect(secondText).toBe(firstText);

    // Additionally, verify that the demo text appears only once; for example "Linear Search Demonstration" should only occur once.
    const occurrencesLinear = (firstText.match(/Linear Search Demonstration/g) || []).length;
    expect(occurrencesLinear).toBe(1);

    // Ensure no runtime exceptions occurred while trying a second click.
    expect(consoleErrors.length, `Console errors during idempotence check: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors during idempotence check: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  // Accessibility and evidence tests beyond core transitions:
  // - Verify that the demoOutput element reports role and aria-live (evidence)
  // - Verify the button has the aria-controls attribute linking to the output region
  test('Accessibility evidence: aria attributes and DOM evidence present', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Button should advertise aria-controls referencing the output container
    const ariaControls = await demo.getDemoButtonAriaControls();
    expect(ariaControls).toBe('demoOutput');

    // Check the output container attributes match the expected evidence
    const attrs = await demo.getDemoOutputAttributes();
    expect(attrs.role).toBe('region');
    expect(attrs.ariaLive).toBe('polite');

    // No runtime errors or console errors should be present
    expect(consoleErrors.length, `Console errors in accessibility check: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors in accessibility check: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

  // Negative/robustness test: ensure that repeatedly trying to interact (rapid clicks) doesn't throw errors
  // and that the application remains in a consistent state after such attempts.
  test('Robustness: rapid click attempts do not cause runtime exceptions and state remains consistent', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Rapidly attempt to click the button multiple times.
    // The first click should run the demo; subsequent attempts should be guarded by `used`.
    // Use a loop with try/catch to tolerate Playwright click errors on disabled elements.
    for (let i = 0; i < 5; i++) {
      try {
        // Force only for subsequent iterations to attempt to provoke edge behavior without changing internals.
        await demo.clickDemo(i === 0 ? {} : { force: true, timeout: 500 });
      } catch (e) {
        // ignore, we are testing robustness to exceptions in the click attempt itself
      }
    }

    // Verify final state is DemoRunning: output visible and button disabled
    expect(await demo.getDemoOutputStyleDisplay()).toBe('block');
    expect(await demo.getDemoButtonDisabled()).toBe(true);

    // Check demo text includes expected markers and is not duplicated beyond reason.
    const text = (await demo.getDemoOutputText()) || '';
    expect(text).toContain('Linear Search Demonstration');
    expect(text).toContain('Binary Search Demonstration');

    // There should be no JS runtime errors captured by pageerror; console errors should be none.
    expect(consoleErrors.length, `Console errors during rapid clicks: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors during rapid clicks: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });

});