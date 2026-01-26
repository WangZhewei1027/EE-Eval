import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cc9aa3-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo controls and assertions
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoBtn = page.locator('#demoBtn');
    this.demoOutput = page.locator('#demoOutput');
  }

  // Navigate to the app and wait for essential elements
  async goto() {
    await this.page.goto(APP_URL);
    await expect(this.demoBtn).toBeVisible();
    await expect(this.demoOutput).toBeAttached();
  }

  // Click the primary demo toggle button
  async clickDemoBtn() {
    await this.demoBtn.click();
  }

  // Return true if demoOutput currently has the 'hidden' attribute (element is hidden)
  async isDemoOutputHidden() {
    const attr = await this.demoOutput.getAttribute('hidden');
    return attr !== null;
  }

  // Get the button's visible text
  async getDemoBtnText() {
    return (await this.demoBtn.textContent())?.trim() ?? '';
  }

  // Get the demoOutput's text content
  async getDemoOutputText() {
    return (await this.demoOutput.textContent()) ?? '';
  }

  // Convenience: assert demoOutput visible via Playwright's built-in matcher
  async expectDemoVisible() {
    await expect(this.demoOutput).toBeVisible();
  }

  // Convenience: assert demoOutput hidden via Playwright's built-in matcher
  async expectDemoHidden() {
    await expect(this.demoOutput).toBeHidden();
  }
}

test.describe('HTTPS Simple Demonstration - FSM states and transitions', () => {
  // Collect console and page errors for each test to inspect and assert
  let consoleMessages = [];
  let pageErrors = [];
  let consoleListener;
  let pageErrorListener;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (all types) and store them for assertions
    consoleListener = (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    };
    page.on('console', consoleListener);

    // Capture uncaught exceptions on the page
    pageErrorListener = (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    };
    page.on('pageerror', pageErrorListener);
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leaking between tests
    try {
      page.off('console', consoleListener);
      page.off('pageerror', pageErrorListener);
    } catch (e) {
      // In case the page has been closed already - ignore
    }
  });

  test('S0_Idle initial state: button present and demo output hidden with expected attributes', async ({ page }) => {
    // This test validates the initial FSM state S0_Idle according to the FSM evidence:
    // - #demoBtn exists and reads "Show Simple Demonstration"
    // - #demoOutput exists, has class demo-output, and is initially hidden with ARIA attributes.
    const demo = new DemoPage(page);
    await demo.goto();

    // Validate button text and aria-label
    await expect(demo.demoBtn).toBeVisible();
    expect(await demo.getDemoBtnText()).toBe('Show Simple Demonstration');
    expect(await demo.demoBtn.getAttribute('aria-label')).toBe('Show simple HTTPS handshake demonstration');

    // Validate demoOutput is present and hidden initially
    await demo.expectDemoHidden();
    expect(await demo.demoOutput.getAttribute('class')).toContain('demo-output');
    expect(await demo.demoOutput.getAttribute('role')).toBe('region');
    expect(await demo.demoOutput.getAttribute('aria-live')).toBe('polite');
    expect(await demo.demoOutput.getAttribute('aria-atomic')).toBe('true');

    // The demoOutput should be empty at start (text length 0 or only whitespace)
    const initialText = await demo.getDemoOutputText();
    expect(initialText.trim()).toBe('');

    // Assert there are no uncaught page errors and no console errors emitted during initial load.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Transition ShowDemo: clicking button reveals demo and updates button text (S0_Idle -> S1_DemoVisible)', async ({ page }) => {
    // This test validates the ShowDemo event/transition:
    // - clicking #demoBtn removes hidden from #demoOutput (onEnter actions)
    // - demoOutput textContent is set to the handshake demonstration content
    // - #demoBtn text changes to 'Hide Simple Demonstration'
    const demo = new DemoPage(page);
    await demo.goto();

    // Trigger the ShowDemo event
    await demo.clickDemoBtn();

    // Verify observables for S1_DemoVisible
    await demo.expectDemoVisible();
    const btnText = await demo.getDemoBtnText();
    expect(btnText).toBe('Hide Simple Demonstration');

    const demoText = await demo.getDemoOutputText();
    // Check core expected strings from the demo content
    expect(demoText).toContain('=== Simple HTTPS Handshake Demonstration ===');
    expect(demoText).toContain('ClientHello');
    expect(demoText).toContain('ServerHello');
    expect(demoText).toContain('Server Certificate');
    expect(demoText).toContain('Key Exchange');

    // Ensure ARIA attributes are preserved and output lives in the correct region
    expect(await demo.demoOutput.getAttribute('role')).toBe('region');
    expect(await demo.demoOutput.getAttribute('aria-live')).toBe('polite');

    // Assert that no unexpected page errors were thrown during the show transition
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Transition HideDemo: clicking button when visible hides demo and restores button text (S1_DemoVisible -> S0_Idle)', async ({ page }) => {
    // Validates the HideDemo event/transition:
    // - clicking #demoBtn when visible should set hidden attribute and restore button text
    const demo = new DemoPage(page);
    await demo.goto();

    // Show first to reach S1_DemoVisible
    await demo.clickDemoBtn();
    await demo.expectDemoVisible();

    // Click again to hide (trigger HideDemo)
    await demo.clickDemoBtn();

    // Verify return to S0_Idle
    await demo.expectDemoHidden();
    expect(await demo.getDemoBtnText()).toBe('Show Simple Demonstration');

    // The content may still exist but must be hidden; ensure hidden attribute present
    expect(await demo.demoOutput.getAttribute('hidden')).not.toBeNull();

    // Assert no uncaught errors during hide transition
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: rapid multiple clicks toggle reliably and do not produce runtime errors', async ({ page }) => {
    // This test simulates rapid user interaction and verifies the FSM remains consistent
    // and no runtime errors occur from rapid successive transitions.
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform a sequence of rapid clicks
    const clickCount = 7; // odd number to end up in visible state
    for (let i = 0; i < clickCount; i++) {
      // Rapidly click without waiting for animations (the app has no animations)
      await demo.clickDemoBtn();
    }

    // After odd number of clicks, the demo should be visible
    await demo.expectDemoVisible();
    expect(await demo.getDemoBtnText()).toBe('Hide Simple Demonstration');

    // Now do an even number more to return to hidden
    for (let i = 0; i < 2; i++) {
      await demo.clickDemoBtn();
    }

    // After two more clicks (odd+2 = odd+even -> odd still? Actually 7+2 = 9 odd),
    // but to exercise both, check both possible outcomes: ensure toggling works and element is a valid DOM node
    // Click once more to make it even (hidden)
    await demo.clickDemoBtn();

    // Now should be hidden (we toggled an extra time)
    await demo.expectDemoHidden();
    expect(await demo.getDemoBtnText()).toBe('Show Simple Demonstration');

    // Ensure no console errors or uncaught page errors happened during rapid clicks
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('DOM integrity: attributes and content persist correctly after multiple state transitions', async ({ page }) => {
    // This test validates that attributes described as "entry_actions" in FSM (removeAttribute, set text)
    // and component attributes persist or restore correctly across transitions.
    const demo = new DemoPage(page);
    await demo.goto();

    // Show
    await demo.clickDemoBtn();
    await demo.expectDemoVisible();
    expect(await demo.demoOutput.getAttribute('role')).toBe('region');
    expect(await demo.demoBtn.getAttribute('aria-label')).toBe('Show simple HTTPS handshake demonstration');
    // Content should be non-empty
    expect((await demo.getDemoOutputText()).trim().length).toBeGreaterThan(0);

    // Hide
    await demo.clickDemoBtn();
    await demo.expectDemoHidden();
    // Content remains present in DOM (but hidden) - confirm by reading it
    expect((await demo.getDemoOutputText()).trim().length).toBeGreaterThan(0);

    // Show again and confirm onEnter actions executed again
    await demo.clickDemoBtn();
    await demo.expectDemoVisible();
    expect(await demo.getDemoBtnText()).toBe('Hide Simple Demonstration');
    expect((await demo.getDemoOutputText()).includes('=== Simple HTTPS Handshake Demonstration ===')).toBe(true);

    // Final check: no page errors were raised in the process
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Observability: log and error capturing works; assert there are no runtime errors in this page (sanity)', async ({ page }) => {
    // This test is focused on ensuring we observed and collected console messages and page errors
    // during normal operation. It acts as a sentinel to ensure we did not suppress runtime errors.
    const demo = new DemoPage(page);
    await demo.goto();

    // Interact a bit
    await demo.clickDemoBtn();
    await demo.clickDemoBtn();

    // Allow microtasks to settle
    await page.waitForTimeout(100);

    // Inspect collected messages - there should be no console.error messages, but capture the full list for debugging
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      // If any console errors occurred, fail the test and include the error texts for easier debugging
      const combined = errors.map(e => e.text).join('\n---\n');
      throw new Error('Console errors were emitted by the page:\n' + combined);
    }

    // Also ensure no uncaught page errors
    if (pageErrors.length > 0) {
      const combined = pageErrors.map(e => e.message + '\n' + (e.stack || '')).join('\n---\n');
      throw new Error('Uncaught page errors were emitted:\n' + combined);
    }

    // If we reach here, no runtime exceptions or console errors were observed
    expect(errors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});