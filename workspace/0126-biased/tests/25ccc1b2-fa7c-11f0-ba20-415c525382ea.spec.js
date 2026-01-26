import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ccc1b2-fa7c-11f0-ba20-415c525382ea.html';

// Page object for the demo page to encapsulate interactions and queries
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoBtn = page.locator('#demo-btn');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickDemo() {
    await this.demoBtn.click();
  }

  async getButtonText() {
    return this.demoBtn.textContent();
  }

  async isButtonDisabled() {
    return this.demoBtn.isDisabled();
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async getOutputAriaLive() {
    return this.output.getAttribute('aria-live');
  }
}

// Expected content produced by the demo button (copied from the page script)
const EXPECTED_ROUNDS = [
  'RTT 1: cwnd = 1 (start, slow start)',
  'RTT 2: cwnd = 2 (slow start, doubles)',
  'RTT 3: cwnd = 4 (slow start, doubles)',
  'RTT 4: cwnd = 8 (slow start, doubles)',
  'RTT 5: cwnd = 16 (hits ssthresh, enter congestion avoidance)',
  'RTT 6: cwnd = 17 (linear increase by 1 segment)',
  'RTT 7: cwnd = 18 (linear increase)',
  'RTT 8: Packet loss detected (timeout)',
  ' → ssthresh = cwnd / 2 = 9',
  ' → cwnd reset to 1 (slow start)',
  'RTT 9: cwnd = 2 (slow start)',
  'RTT 10: cwnd = 4 (slow start)',
  'RTT 11: cwnd = 8 (slow start)',
  'RTT 12: cwnd = 9 (hits ssthresh, congestion avoidance)',
  '… and so on.'
].join('\n');

test.describe('Congestion Control Demo FSM tests (Application: 25ccc1b2-fa7c-11f0-ba20-415c525382ea)', () => {
  // We'll capture console messages and page errors for each test so we can assert no unexpected runtime errors occur.
  let consoleErrors = [];
  let pageErrors = [];
  let allConsoleMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    allConsoleMessages = [];

    // Capture console messages (info, log, warn, error)
    page.on('console', (msg) => {
      allConsoleMessages.push({ text: msg.text(), type: msg.type(), location: msg.location() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test, assert that there were no uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    // This validates the environment loaded cleanly and no unexpected runtime exceptions occurred.
    // We allow the page to produce normal informational console logs, but treat console.error and pageerror as failures.
    expect(pageErrors, 'No uncaught page errors should occur').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should be emitted').toHaveLength(0);
  });

  test('Initial Idle state renders correctly (S0_Idle)', async ({ page }) => {
    // This test validates the S0_Idle state: the page should render the demo button and an empty output area.
    const demo = new DemoPage(page);

    // Verify the demo button exists and has the expected label from the FSM and HTML
    await expect(demo.demoBtn).toBeVisible();
    const btnText = await demo.getButtonText();
    expect(btnText.trim()).toBe('Show Congestion Window Evolution');

    // The button should be enabled in the Idle state
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBeFalsy();

    // The output pre element should exist, be empty initially, and have the aria-live attribute set
    await expect(demo.output).toBeVisible();
    const outputText = await demo.getOutputText();
    // TextContent may be null or empty string initially; ensure it's empty-ish
    expect(outputText === null || outputText.trim() === '').toBeTruthy();

    const ariaLive = await demo.getOutputAriaLive();
    expect(ariaLive).toBe('polite');

    // Ensure the DOM contains evidence snippets expected by the FSM
    // (presence of elements is sufficient evidence in this end-to-end test)
    const demoBtnExists = await page.$('#demo-btn');
    const demoOutputExists = await page.$('#demo-output');
    expect(demoBtnExists).not.toBeNull();
    expect(demoOutputExists).not.toBeNull();
  });

  test('Clicking the demo button transitions to Demonstration Shown (S1_DemoShown) and performs entry actions', async ({ page }) => {
    // This test validates the ShowDemo event and the transition S0_Idle -> S1_DemoShown:
    // - output.textContent should be set to the rounds joined with newlines
    // - demoBtn.disabled should become true
    // - demoBtn.textContent should become "Demonstration shown"
    const demo = new DemoPage(page);

    // Click the button to trigger the transition
    await demo.clickDemo();

    // The output should exactly match the expected multiline content
    // Wait for the output to be populated
    await expect(demo.output).toHaveText(EXPECTED_ROUNDS);

    const outputText = await demo.getOutputText();
    expect(outputText).toBe(EXPECTED_ROUNDS);

    // The button should be disabled and text changed
    const btnDisabled = await demo.isButtonDisabled();
    expect(btnDisabled).toBeTruthy();

    const btnTextAfter = (await demo.getButtonText())?.trim();
    expect(btnTextAfter).toBe('Demonstration shown');

    // Additional check: output area retains whitespace and newline formatting (pre element)
    // We already matched the assembled string; re-check that the first and last lines are present
    expect(outputText.split('\n')[0]).toContain('RTT 1: cwnd = 1');
    expect(outputText.split('\n').slice(-1)[0]).toContain('… and so on.');
  });

  test('Clicking multiple times or attempting to interact after demonstration shown does not change the output', async ({ page }) => {
    // This test exercises an edge case: ensure that after the transition the UI is stable and further interactions do not alter state.
    const demo = new DemoPage(page);

    // Rapidly click the button twice (second click should be ignored because the button becomes disabled by the handler)
    await Promise.all([
      demo.demoBtn.click(), // first click
      // attempt a quick second click - Playwright will throw if element disabled mid-action; catch and ignore
      (async () => {
        try {
          await demo.demoBtn.click();
        } catch (e) {
          // If click fails because the button becomes disabled, that's acceptable — we record nothing here.
        }
      })()
    ]);

    // Confirm output equals expected
    await expect(demo.output).toHaveText(EXPECTED_ROUNDS);

    // Try to programmatically click via evaluate (simulates attempted DOM click even if disabled).
    // Per instructions, we must not patch or redefine functions; we simply attempt the click to ensure nothing unexpected happens.
    // Because the button is disabled, the event listener should not fire again.
    const beforeText = await demo.getOutputText();
    await page.evaluate(() => {
      const btn = document.getElementById('demo-btn');
      if (btn) {
        // Attempt a click via DOM API — if disabled, browsers ignore clicks on disabled buttons
        try {
          btn.click();
        } catch (e) {
          // Let any errors surface naturally — but do not modify the environment
        }
      }
    });
    const afterText = await demo.getOutputText();
    expect(afterText).toBe(beforeText);
  });

  test('Visual and accessibility attributes are present and consistent after transition', async ({ page }) => {
    // Confirm that visual feedback expected by the FSM exists:
    // - demo-output has monospace styling (we check computed font-family contains 'mono' or 'Consolas' etc.)
    // - demo-output has min-height applied (ensures UI didn't collapse)
    const demo = new DemoPage(page);

    await demo.clickDemo();

    // Check aria-live remains set to polite
    const ariaLive = await demo.getOutputAriaLive();
    expect(ariaLive).toBe('polite');

    // Inspect computed styles for some visual indicators (non-invasive checks)
    const fontFamily = await page.evaluate(() => {
      const out = document.getElementById('demo-output');
      return out ? window.getComputedStyle(out).fontFamily : null;
    });
    expect(fontFamily).toBeTruthy();
    // At least ensure that font family contains a monospace hint or known monospace family from the CSS
    expect(/monospace|Consolas|Courier/i.test(fontFamily)).toBeTruthy();

    const minHeight = await page.evaluate(() => {
      const out = document.getElementById('demo-output');
      return out ? window.getComputedStyle(out).minHeight : null;
    });
    expect(minHeight).toBeTruthy();
    // min-height should not be 0 (CSS sets min-height: 120px)
    expect(parseFloat(minHeight)).toBeGreaterThan(0);
  });

  test('No runtime ReferenceError / SyntaxError / TypeError occurred during interaction (observability)', async ({ page }) => {
    // This test explicitly checks that there are no uncaught exceptions of the kinds specified in the instructions.
    // We have been capturing pageErrors and consoleErrors in beforeEach; here we assert their absence and, if present, expose details.
    const demo = new DemoPage(page);

    // Perform the transition to exercise the inline script
    await demo.clickDemo();

    // After performing interactions, ensure our captured arrays are empty.
    // (The afterEach hook will also assert emptiness; this test provides clearer failure messages if something went wrong.)
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // If there are errors, produce a helpful message with captured logs to aid debugging.
      const errMessages = pageErrors.map((e) => e.stack || String(e)).concat(consoleErrors);
      // Fail with detailed info
      expect(errMessages, 'No page errors (ReferenceError, SyntaxError, TypeError, etc.) should have occurred').toHaveLength(0);
    }

    // Additionally, verify that no console message explicitly contains "ReferenceError", "TypeError", or "SyntaxError".
    const problematicConsole = allConsoleMessages.filter(m =>
      /ReferenceError|TypeError|SyntaxError/.test(m.text)
    );
    expect(problematicConsole, 'No console messages mentioning ReferenceError/TypeError/SyntaxError').toHaveLength(0);
  });

  test('FSM evidence present: event handler was attached in the page source (heuristic via invocation)', async ({ page }) => {
    // Heuristic test: ensure that clicking the button triggers the expected observable behavior (output change).
    // This demonstrates that the event handler demoBtn.addEventListener('click', ...) exists and functions.
    const demo = new DemoPage(page);

    // Initially empty
    const initial = await demo.getOutputText();
    expect(initial === null || initial.trim() === '').toBeTruthy();

    // Click and assert change
    await demo.clickDemo();
    await expect(demo.output).toHaveText(EXPECTED_ROUNDS);
  });
});