import { test, expect } from '@playwright/test';

// Test file: d837eab2-fa7b-11f0-b314-ad8654ee5de8.spec.js
// Target URL (served externally): http://127.0.0.1:5500/workspace/0126-biased/html/d837eab2-fa7b-11f0-b314-ad8654ee5de8.html

// Page object for the demo area
class MonitorDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemo');
    this.output = page.locator('#demoOutput');
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async clickRunDemo() {
    await this.runButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async waitForOutputContains(substring, timeout = 2000) {
    await expect.poll(async () => {
      const t = await this.getOutputText();
      return t.includes(substring);
    }, { timeout }).toBeTruthy();
  }
}

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d837eab2-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Monitor — FSM & demo behavior (d837eab2-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors) emitted by the page
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In the unlikely event msg.text() throws, capture that fact
        consoleMessages.push({ type: 'unknown', text: `<<console.text() threw: ${String(e)}>>` });
      }
    });

    // Capture uncaught page errors (e.g., ReferenceError, TypeError, SyntaxError at runtime)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // nothing to tear down beyond the built-in Playwright fixtures
  });

  test('Initial Idle state: page renders the Run demo button and initial output text', async ({ page }) => {
    // This test validates the S0_Idle state as described in the FSM:
    // - The page should render the #runDemo button
    // - The demo output region should show the initial prompt text
    // - No runtime page errors should have been thrown during load
    const demo = new MonitorDemoPage(page);

    // Button should be visible and enabled
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toBeEnabled();

    // Output region should contain the initial instructional text
    const initialText = await demo.getOutputText();
    expect(initialText).toContain('Click the button to show the step-by-step traces.');

    // Verify important accessibility attributes and role (as part of DOM correctness)
    const outputEl = page.locator('#demoOutput');
    await expect(outputEl).toHaveAttribute('aria-live', 'polite');
    await expect(outputEl).toHaveAttribute('role', 'region');

    // Assert there were no uncaught page errors during initial render
    expect(pageErrors.length, `Expected no page errors but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Assert console did not emit error-level messages during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'assert');
    expect(consoleErrors.length, `Unexpected console error/assert messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Transition: clicking RunDemo moves to DemoRunning and writes expected trace lines', async ({ page }) => {
    // This test validates the RunDemoClick event and the S0 -> S1 transition:
    // - Clicking #runDemo should clear the output and append the deterministic trace lines
    // - Output should contain key Hoare and Mesa explanatory lines
    // - No runtime exceptions should be produced by clicking
    const demo = new MonitorDemoPage(page);

    // Click the demo button to trigger runDemo()
    await demo.clickRunDemo();

    // Wait for a known line that indicates the demo ran
    await demo.waitForOutputContains('Scenario: Monitor with a single condition CV. Two threads: A (inside monitor) and B (waiting on CV).');

    // Check for presence of both Hoare and Mesa headings/text in the output
    const outputText = await demo.getOutputText();
    expect(outputText).toContain('--- Hoare-style monitor (signal-and-wait) ---');
    expect(outputText).toContain('--- Mesa-style monitor (signal-and-continue) ---');
    expect(outputText).toContain('End of demonstration.');

    // The demo's first action is clearOut(), so the initial "Click the button..." string should not remain
    expect(outputText).not.toContain('Click the button to show the step-by-step traces.');

    // Verify again that no page errors occurred during the click and demo generation
    expect(pageErrors.length, `Expected no page errors after clicking, but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Verify the console did not emit error-level messages while handling the click
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'assert');
    expect(consoleErrors.length, `Console showed error/assert messages after click: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Repeated clicks should clear and re-render the demonstration (no duplication / no exceptions)', async ({ page }) => {
    // This test validates that repeated RunDemoClick events:
    // - Each click invokes clearOut() and re-renders the deterministic trace
    // - Rapid multiple clicks do not cause runtime exceptions
    // - The final output corresponds to a single complete demonstration (i.e., no cumulative duplicates)
    const demo = new MonitorDemoPage(page);

    // Perform two clicks in quick succession
    await demo.clickRunDemo();
    await demo.clickRunDemo();

    // Ensure output shows the expected final content
    await demo.waitForOutputContains('End of demonstration.');

    const outputText = await demo.getOutputText();

    // The initial hint text should not be present
    expect(outputText).not.toContain('Click the button to show the step-by-step traces.');

    // Ensure the output includes the two major sections and the final recommendation line
    expect(outputText).toContain('Key point (Hoare): signal transfers the monitor lock immediately to a waiting thread. Signaler yields and the waiter proceeds right away.');
    expect(outputText).toContain('Practical recommendation: under Mesa semantics always write');
    expect(outputText).toContain('while (!predicate) cv.wait();');

    // Ensure that the output does not contain repeated concatenations of the entire demo.
    // Since the implementation clears before appending, we should see 'End of demonstration.' exactly once.
    const occurrences = (outputText.match(/End of demonstration\./g) || []).length;
    expect(occurrences, `Expected a single 'End of demonstration.' line, found ${occurrences}`).toBe(1);

    // Verify no page errors and no console error messages occurred during repeated clicks
    expect(pageErrors.length, `Page errors during repeated clicks: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'assert');
    expect(consoleErrors.length, `Console errors during repeated clicks: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Edge case: multiple rapid clicks do not produce uncaught exceptions and final DOM remains stable', async ({ page }) => {
    // This test stresses the click event by issuing multiple rapid clicks and ensures:
    // - No uncaught exceptions are produced
    // - The final output is a coherent, complete demonstration
    // - The output element remains present and accessible
    const demo = new MonitorDemoPage(page);

    // Rapidly trigger runDemo multiple times
    for (let i = 0; i < 6; i++) {
      // do not await between clicks to simulate rapid user interaction
      demo.runButton.click().catch(() => {});
    }

    // Wait for expected content to stabilize
    await demo.waitForOutputContains('End of demonstration.', 3000);

    const outputText = await demo.getOutputText();

    // Final DOM checks
    await expect(page.locator('#demoOutput')).toBeVisible();
    expect(outputText.length).toBeGreaterThan(20);
    expect(outputText).toContain('--- Mesa-style monitor (signal-and-continue) ---');

    // Confirm no uncaught exceptions were emitted as pageerror events
    expect(pageErrors.length, `Found page errors after rapid clicks: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Confirm console had no error-level entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'assert');
    expect(consoleErrors.length, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Observability: capture console messages and page errors (explicit check of captured arrays)', async ({ page }) => {
    // This test demonstrates observability: we expose the collected console messages and page errors
    // and assert that the runtime executed without emitting errors of interest.
    const demo = new MonitorDemoPage(page);

    // Make sure to exercise the demo once so that any runtime errors that occur during execution are captured
    await demo.clickRunDemo();
    await demo.waitForOutputContains('End of demonstration.');

    // The test's purpose: assert we have captured console events and that none of them are errors
    // (If the application had runtime exceptions they'd be present in pageErrors or consoleMessages of type 'error')
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // Fail if any pageerror exists
    if (pageErrors.length > 0) {
      // Provide detailed information for diagnosis in the assertion message
      const details = pageErrors.map(e => String(e)).join(' || ');
      throw new Error(`Unexpected pageerror events detected: ${details}`);
    }

    // Fail if any console.error or assert-level messages were recorded
    const errorLevelConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'assert');
    if (errorLevelConsole.length > 0) {
      throw new Error(`Unexpected console error/assert messages recorded: ${JSON.stringify(errorLevelConsole)}`);
    }

    // Provide a positive sanity check that some console activity may have occurred (optional)
    // Many pages may not write to console; we only require that no errors are present.
    expect(errorLevelConsole.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});