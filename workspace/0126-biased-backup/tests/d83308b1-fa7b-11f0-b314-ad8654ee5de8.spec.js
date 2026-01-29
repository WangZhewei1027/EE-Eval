import { test, expect } from '@playwright/test';

// Test file: d83308b1-fa7b-11f0-b314-ad8654ee5de8.spec.js
// Application URL (served by test harness):
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83308b1-fa7b-11f0-b314-ad8654ee5de8.html';

/**
 * Page object for the simple demo page.
 * Encapsulates common interactions and queries so tests are readable and maintainable.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    this.consoleErrors = [];
    this._consoleListener = this._consoleListener.bind(this);
    this._pageErrorListener = this._pageErrorListener.bind(this);
  }

  // Attach listeners to collect console messages and page errors
  async attachObservers() {
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  // Remove listeners
  async detachObservers() {
    this.page.off('console', this._consoleListener);
    this.page.off('pageerror', this._pageErrorListener);
  }

  _consoleListener(msg) {
    const entry = { type: msg.type(), text: msg.text() };
    this.consoleMessages.push(entry);
    if (msg.type() === 'error') this.consoleErrors.push(entry);
  }

  _pageErrorListener(error) {
    // pageerror is typically an Error object
    this.pageErrors.push(error);
  }

  // Navigate to the app URL and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure content is present
    await expect(this.page.locator('text=Hash Table — A Comprehensive Explanation')).toBeVisible();
  }

  // Returns the run demo button handle
  runButton() {
    return this.page.locator('#runDemo');
  }

  // Clicks the run demo button
  async clickRunDemo() {
    await this.runButton().click();
  }

  // Retrieves the demo text content
  async getDemoText() {
    return (await this.page.locator('#demoText').textContent()) || '';
  }

  // Utility to clear recorded console/page error arrays
  clearObservations() {
    this.consoleMessages = [];
    this.pageErrors = [];
    this.consoleErrors = [];
  }
}

test.describe('Hash Table — Comprehensive Explanation (interactive demo) — FSM validation', () => {
  // Shared demo page instance per test
  let demo;

  test.beforeEach(async ({ page }) => {
    demo = new DemoPage(page);
    await demo.attachObservers();
    await demo.goto();
  });

  test.afterEach(async () => {
    // Detach observers to avoid leaking listeners across tests
    await demo.detachObservers();
  });

  test('S0_Idle: Page renders initial Idle state with Run small demonstration button', async () => {
    // Verify initial UI elements for the Idle state are present per FSM evidence
    const button = demo.runButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Run small demonstration');

    // The demo output area should show the initial instructional text
    const demoText = await demo.getDemoText();
    await expect(demoText).toContain('Click "Run small demonstration" to show a compact insertion trace.');

    // No runtime errors should have occurred during initial render
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  test('S1_DemoRunning: Clicking Run demonstration transitions to Demo Running and shows output', async () => {
    // Ensure button exists and click it to trigger transition S0 -> S1
    await expect(demo.runButton()).toBeVisible();

    // Clear prior observations, then click
    demo.clearObservations();
    await demo.clickRunDemo();

    // After clicking, the demoText content should be updated with deterministic demonstration output
    const updatedText = await demo.getDemoText();

    // Validate main pieces of the demonstration output are present
    await expect(updatedText).toContain('Demonstration: keys = [18, 41, 22, 44, 59, 32, 31]');
    await expect(updatedText).toContain('Hash function: h(k) = k mod 7');
    await expect(updatedText).toContain('Separate chaining insertion trace:');
    await expect(updatedText).toContain('Open addressing (linear probing) insertion trace:');
    await expect(updatedText).toContain('Final table indices 0..6:');

    // Verify that the on-click handler did not produce uncaught exceptions
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  test('Transition: clicking the Run button multiple times re-runs demonstration and updates output consistently', async () => {
    // Click the run button twice rapidly and ensure output updates each time and no errors occur
    demo.clearObservations();

    // First click
    await demo.clickRunDemo();
    const firstRun = await demo.getDemoText();
    await expect(firstRun).toContain('Demonstration: keys = [18, 41, 22, 44, 59, 32, 31]');

    // Second click
    await demo.clickRunDemo();
    const secondRun = await demo.getDemoText();
    await expect(secondRun).toContain('Demonstration: keys = [18, 41, 22, 44, 59, 32, 31]');

    // The content should be deterministic and not empty
    expect(secondRun.length).toBeGreaterThan(50);

    // Ensure no page errors or console-level errors accumulated
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid repeated clicks do not crash the page or produce unhandled exceptions', async ({ page }) => {
    // Stress test: click the button rapidly in a loop
    demo.clearObservations();

    // Perform a burst of clicks
    const clicks = 10;
    for (let i = 0; i < clicks; i++) {
      await demo.clickRunDemo();
    }

    // After burst, ensure demo output is still well-formed and not truncated
    const text = await demo.getDemoText();
    await expect(text).toContain('Final table indices 0..6:');
    expect(text.length).toBeGreaterThan(50);

    // Observe any page errors or console error messages
    // We expect no uncaught exceptions or console errors for this limited demo
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  test('DOM evidence and expectations per FSM: elements referenced in FSM exist and are interactive', async () => {
    // FSM evidence expects the button HTML and that an event listener is attached.
    // We verify the button is present and is clickable (listener is inferred by observing changed DOM after click).
    const button = demo.runButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('id', 'runDemo');
    await expect(button).toHaveText('Run small demonstration');

    // Click to confirm event listener runs and updates the DOM
    demo.clearObservations();
    await button.click();
    const demoText = await demo.getDemoText();
    await expect(demoText).toContain('Separate chaining insertion trace:');

    // No unexpected runtime exceptions
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  test('Verification of textual output content structure (chaining and linear probing sections)', async () => {
    // Click and inspect structure/phrasing to assert the demonstration contains expected subsections
    demo.clearObservations();
    await demo.clickRunDemo();
    const text = await demo.getDemoText();

    // The chaining section should list buckets and show collisions for bucket 4 and 3
    await expect(text).toContain('bucket 4');
    await expect(text).toContain('bucket 3');
    await expect(text).toContain('[18, 32]');
    await expect(text).toContain('[59, 31]');

    // The linear probing section should mention probes and show final arrangement including '31' at index 0
    await expect(text).toContain('placed at index');
    await expect(text).toContain('Final table indices 0..6:');
    await expect(text).toContain('31');

    // Ensure no errors were logged to console
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  test('Sanity check: page does not emit ReferenceError / SyntaxError / TypeError during normal operation', async () => {
    // This test specifically observes console and page errors and asserts none of the common runtime error types occurred.
    // Click demo once to execute demo script path.
    demo.clearObservations();
    await demo.clickRunDemo();

    // Inspect captured page errors for common JS error types
    const errorTypes = demo.pageErrors.map(e => e.name || '').filter(Boolean);
    const hasRef = errorTypes.includes('ReferenceError');
    const hasSyntax = errorTypes.includes('SyntaxError');
    const hasType = errorTypes.includes('TypeError');

    // We assert that none of these critical errors happened during our interactions.
    expect(hasRef).toBeFalsy();
    expect(hasSyntax).toBeFalsy();
    expect(hasType).toBeFalsy();

    // Also ensure that console-level 'error' messages are absent
    const consoleErrorTexts = demo.consoleErrors.map(e => e.text);
    // If any console errors are present, fail: provide their texts for easier debugging
    expect(consoleErrorTexts.length).toBe(0);
  });

  test('Accessibility and focusability check for the Run button (basic a11y smoke test)', async () => {
    // Ensure the button is focusable and can be invoked via keyboard (Enter)
    const btn = demo.runButton();
    await btn.focus();
    await expect(btn).toBeFocused();

    // Press Enter to activate the button
    await demo.page.keyboard.press('Enter');

    // Confirm the demo text updated on keyboard activation as well
    const text = await demo.getDemoText();
    await expect(text).toContain('Demonstration: keys = [18, 41, 22, 44, 59, 32, 31]');

    // No runtime errors during keyboard activation
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });
});