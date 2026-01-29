import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b29711-fa7c-11f0-9fa6-d1bbe297d459.html';

class DemoPage {
  /**
   * Page object for the Floyd-Warshall demo interactions.
   * Encapsulates operations and queries for the #demo element and toggle button.
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick="toggleDemo()"]';
    this.demoSelector = '#demo';
  }

  // Click the toggle button
  async clickToggle() {
    await this.page.click(this.buttonSelector);
  }

  // Returns the inline style.display value (string) for the demo element
  async demoInlineDisplay() {
    return await this.page.$eval(this.demoSelector, el => el.style.display);
  }

  // Returns the computed style.display value for the demo element
  async demoComputedDisplay() {
    return await this.page.$eval(this.demoSelector, el => getComputedStyle(el).display);
  }

  // Returns whether demo is visible based on computed style
  async isDemoVisible() {
    const display = await this.demoComputedDisplay();
    return display === 'block';
  }

  // Returns inner text of the demo container
  async demoText() {
    return await this.page.$eval(this.demoSelector, el => el.innerText);
  }

  // Returns whether the toggle button exists and its onclick attribute value
  async toggleButtonOnclickAttr() {
    const btn = await this.page.$(this.buttonSelector);
    if (!btn) return null;
    return await btn.getAttribute('onclick');
  }
}

test.describe('Floyd-Warshall Demo - FSM states and transitions', () => {
  // Keep logs and errors collected per test run for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Observe unhandled page errors (runtime exceptions)
    page.on('pageerror', err => {
      // capture Error object / message
      pageErrors.push(err);
    });

    // Navigate to the application page (load exactly as-is)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown modifications to the application; listeners are bound to the page fixture which is disposed by Playwright.
    // Provide a small sanity check for captured logs - done in individual tests as needed.
  });

  test('Initial state (S0_Idle): demo is hidden and toggle button is present', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) of the FSM:
    // - The demo element exists and is initially hidden.
    // - The toggle button exists and has the expected onclick handler attribute.
    // - No runtime page errors occurred during initial render.

    const demoPage = new DemoPage(page);

    // Ensure toggle button exists and has onclick attribute exactly 'toggleDemo()'
    const onclickAttr = await demoPage.toggleButtonOnclickAttr();
    expect(onclickAttr).toBe('toggleDemo()');

    // The demo element should be present
    const demoHandle = await page.$(demoPage.demoSelector);
    expect(demoHandle).not.toBeNull();

    // Inline style initially (because CSS sets it via stylesheet) should be empty string
    const inlineDisplay = await demoPage.demoInlineDisplay();
    expect(inlineDisplay === '' || inlineDisplay === undefined).toBeTruthy();

    // Computed style should be 'none' (hidden)
    const computedDisplay = await demoPage.demoComputedDisplay();
    expect(computedDisplay).toBe('none');

    // There should be no runtime page errors on initial load
    expect(pageErrors.length).toBe(0);

    // There should be no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoVisible: clicking toggle shows the demo', async ({ page }) => {
    // This test validates the transition from Idle to DemoVisible (S0 -> S1):
    // - Clicking the button sets demo.style.display to 'block'.
    // - Computed display becomes 'block'.
    // - The demo content is present (verifies that entry action of showing demo yields visible content).
    // - No runtime errors are introduced by the click.

    const demoPage = new DemoPage(page);

    // Click the toggle button once (should show the demo)
    await demoPage.clickToggle();

    // Inline style should now be 'block' because toggleDemo sets inline style.display = 'block'
    const inlineDisplay = await demoPage.demoInlineDisplay();
    expect(inlineDisplay).toBe('block');

    // Computed style should also be 'block'
    const computedDisplay = await demoPage.demoComputedDisplay();
    expect(computedDisplay).toBe('block');

    // Ensure the demo contains the expected header text indicating the demonstration content
    const demoText = await demoPage.demoText();
    expect(demoText).toContain('Simple Demonstration');

    // Confirm no runtime errors or console errors occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_DemoVisible -> S2_DemoHidden -> S1_DemoVisible: toggling twice hides then shows again', async ({ page }) => {
    // This test validates two transitions in sequence:
    // - From DemoVisible to DemoHidden (first click after visible)
    // - From DemoHidden back to DemoVisible (next click)
    // It ensures the FSM transitions behave correctly and inline styles reflect entry_actions.

    const demoPage = new DemoPage(page);

    // Ensure starting from Idle: click to show first
    await demoPage.clickToggle();

    // Confirm visible
    expect(await demoPage.demoComputedDisplay()).toBe('block');
    expect(await demoPage.demoInlineDisplay()).toBe('block');

    // Click to hide (S1 -> S2)
    await demoPage.clickToggle();

    // After hiding, inline style should be 'none' and computed style 'none'
    expect(await demoPage.demoInlineDisplay()).toBe('none');
    expect(await demoPage.demoComputedDisplay()).toBe('none');

    // Click again to show (S2 -> S1)
    await demoPage.clickToggle();

    // Confirm visible again
    expect(await demoPage.demoInlineDisplay()).toBe('block');
    expect(await demoPage.demoComputedDisplay()).toBe('block');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid toggling (edge case): successive clicks alternate visibility predictably', async ({ page }) => {
    // This test triggers multiple rapid toggles to ensure the toggle logic remains deterministic
    // and no exceptions are thrown under repeated interaction.

    const demoPage = new DemoPage(page);

    // Number of rapid toggles
    const toggles = 7;
    // Track expected state: start from Idle (hidden -> visible on first click)
    let expectedVisible = false;

    for (let i = 0; i < toggles; i++) {
      await demoPage.clickToggle();
      // Toggle expected
      expectedVisible = !expectedVisible;

      // Check computed visibility
      const visible = await demoPage.isDemoVisible();
      expect(visible).toBe(expectedVisible);

      // Also verify inline style corresponds to last action ('block' when visible, 'none' when hidden)
      const inline = await demoPage.demoInlineDisplay();
      if (expectedVisible) {
        expect(inline).toBe('block');
      } else {
        expect(inline).toBe('none');
      }
    }

    // Confirm no runtime page errors or console errors after rapid toggling
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Direct invocation of toggleDemo function via page.evaluate toggles demo and does not throw', async ({ page }) => {
    // This test calls the global toggleDemo function directly in the page context to validate:
    // - The function exists and runs without throwing.
    // - It changes the demo inline style as expected.
    // Note: We do not modify or patch the function; we call it as-is.

    const demoPage = new DemoPage(page);

    // Ensure the function exists on the window object and is callable
    const hasToggle = await page.evaluate(() => typeof window.toggleDemo === 'function');
    expect(hasToggle).toBe(true);

    // Call toggleDemo via evaluate and assert it does not throw (if it threw, pageerror would be emitted)
    await page.evaluate(() => {
      // call the function; any exception would be surfaced as a pageerror caught by the listener
      window.toggleDemo();
    });

    // After invocation, inline style should be 'block'
    expect(await demoPage.demoInlineDisplay()).toBe('block');
    expect(await demoPage.demoComputedDisplay()).toBe('block');

    // Now call it again to hide
    await page.evaluate(() => window.toggleDemo());
    expect(await demoPage.demoInlineDisplay()).toBe('none');
    expect(await demoPage.demoComputedDisplay()).toBe('none');

    // Assert no runtime page errors (i.e., evaluate did not trigger exceptions)
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM integrity and content checks (sanity): matrix and headings remain present', async ({ page }) => {
    // While focusing on the FSM states, we also ensure the static content that should be present
    // in the page remains intact. This acts as a guard against accidental runtime errors impacting DOM.

    // Check main header
    const header = await page.$('h1');
    expect(header).not.toBeNull();
    const headerText = await header.innerText();
    expect(headerText).toMatch(/Floyd-Warshall Algorithm/i);

    // Ensure at least one matrix table exists (used in examples)
    const matrix = await page.$('table.matrix');
    expect(matrix).not.toBeNull();

    // Ensure conclusion section exists
    const conclusion = await page.$('h2:has-text("Conclusion")');
    expect(conclusion).not.toBeNull();

    // No runtime errors observed
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('No unexpected console errors or uncaught exceptions across full scenario', async ({ page }) => {
    // This test runs through a typical user flow and finally asserts there were no console errors
    // or uncaught exceptions during the scenario.

    const demoPage = new DemoPage(page);

    // Typical flow: initial -> show -> hide -> show -> show (extra)
    await demoPage.clickToggle(); // show
    await demoPage.clickToggle(); // hide
    await demoPage.clickToggle(); // show
    await demoPage.clickToggle(); // hide
    await demoPage.clickToggle(); // show

    // Final expected visible
    expect(await demoPage.demoComputedDisplay()).toBe('block');

    // Ensure console did not record any error-level messages and no page errors
    const errorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(errorMessages.length).toBe(0, `Found console.error messages: ${errorMessages.join(' | ')}`);
    expect(pageErrors.length).toBe(0);
  });
});