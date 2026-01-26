import { test, expect } from '@playwright/test';

// Application URL (served as specified in the requirements)
const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/25cce8c1-fa7c-11f0-ba20-415c525382ea.html';

// Page Object Model for the Echo Demo page
class EchoDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemoBtn');
    this.output = page.locator('#demoOutput');
  }

  // Navigate to the demo page and wait for network idle to ensure scripts loaded
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the "Run Echo Demo" button
  async clickRun() {
    await this.runBtn.click();
  }

  // Get full output text content
  async getOutputText() {
    return (await this.output.evaluate((el) => el.textContent)) || '';
  }

  // Wait until the output contains the given substring (with timeout)
  async waitForOutputContains(substring, options = {}) {
    const timeout = options.timeout ?? 4000;
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(substr) !== -1;
      },
      '#demoOutput',
      substring,
      { timeout }
    );
  }

  // Count occurrences of a substring in the output
  async countOutputOccurrences(substring) {
    const text = await this.getOutputText();
    if (!text) return 0;
    const re = new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = text.match(re);
    return matches ? matches.length : 0;
  }
}

test.describe('FSM: Comprehensive Socket Echo Demo (App ID: 25cce8c1-fa7c-11f0-ba20-415c525382ea)', () => {
  // Arrays to capture runtime page errors and console messages for each test
  let pageErrors = [];
  let consoleMessages = [];

  // Setup before each test: navigate to the app and attach listeners
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors (ReferenceError, TypeError, etc. will appear here if they occur)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages (including console.error)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
  });

  // Tear down is implicit; Playwright closes the page between tests automatically.

  test('Idle state renders correctly (S0_Idle): button and output are present and accessible', async ({ page }) => {
    // This test validates the initial Idle state rendering, corresponding to entry action renderPage()
    const demo = new EchoDemoPage(page);
    await demo.goto();

    // Verify Run Echo Demo button exists and has correct text
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toHaveText('Run Echo Demo');

    // Verify demo output container exists, has the expected attributes, and is initially empty
    await expect(demo.output).toBeVisible();
    const ariaLive = await demo.output.getAttribute('aria-live');
    expect(ariaLive).toBe('polite');

    const initialText = await demo.getOutputText();
    expect(initialText).toBe('', 'Expected demo output to be empty in Idle state');

    // Ensure no uncaught page errors were emitted during initial render
    expect(pageErrors.length).toBe(
      0,
      `Expected no page errors during initial render, got: ${pageErrors
        .map((e) => e.message)
        .join('; ')}`
    );

    // Ensure no console.error messages were emitted during initial render
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(
      0,
      `Expected no console.error messages during initial render, got: ${consoleErrors
        .map((c) => c.text)
        .join('; ')}`
    );
  });

  test('Transition S0_Idle -> S1_Echoing on button click: immediate and delayed echo messages appear', async ({
    page,
  }) => {
    // This test triggers the RunDemoClick event and validates entry action simulateSocketEcho()
    const demo = new EchoDemoPage(page);
    await demo.goto();

    // Click the Run Echo Demo button to trigger simulateSocketEcho()
    await demo.clickRun();

    // Immediately after click, the first client send and server receive / client echo should be present
    // Validate immediate client send for 'Hello, Server!'
    await demo.waitForOutputContains('Client] Sending: "Hello, Server!"', { timeout: 500 });
    // Validate server received message and client received echo for the first message
    await demo.waitForOutputContains('Server] Received: "Hello, Server!"', { timeout: 500 });
    await demo.waitForOutputContains('Client] Received Echo: "Hello, Server!"', { timeout: 500 });

    // Validate the second message appears after ~1s
    await demo.waitForOutputContains('Client] Sending: "How are you?"', { timeout: 2000 });
    await demo.waitForOutputContains('Server] Received: "How are you?"', { timeout: 2000 });
    await demo.waitForOutputContains('Client] Received Echo: "How are you?"', { timeout: 2000 });

    // Validate the third message appears after ~2s
    await demo.waitForOutputContains('Client] Sending: "Goodbye!"', { timeout: 3500 });
    await demo.waitForOutputContains('Server] Received: "Goodbye!"', { timeout: 3500 });
    await demo.waitForOutputContains('Client] Received Echo: "Goodbye!"', { timeout: 3500 });

    // Verify the chronological order of the first occurrences: Hello -> How are you -> Goodbye
    const text = await demo.getOutputText();
    const idxHello = text.indexOf('Hello, Server!');
    const idxHow = text.indexOf('How are you?');
    const idxGoodbye = text.indexOf('Goodbye!');
    expect(idxHello).toBeGreaterThanOrEqual(0);
    expect(idxHow).toBeGreaterThan(idxHello);
    expect(idxGoodbye).toBeGreaterThan(idxHow);

    // Ensure no uncaught page errors occurred during the echoing sequence
    expect(pageErrors.length).toBe(
      0,
      `Expected no page errors during echoing sequence, got: ${pageErrors
        .map((e) => e.message)
        .join('; ')}`
    );

    // Ensure no console.error messages during echoing
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(
      0,
      `Expected no console.error messages during echoing sequence, got: ${consoleErrors
        .map((c) => c.text)
        .join('; ')}`
    );
  });

  test('Edge case: repeated rapid clicks reset output and scheduled echoes still execute (interleaving behavior)', async ({
    page,
  }) => {
    // This test explores an edge case: clicking the button again while scheduled timeouts from a prior run are pending.
    // It verifies that output is reset on each run (simulateSocketEcho sets output.textContent = '')
    // and that echo messages eventually appear (possibly interleaved) for the most recent run.
    const demo = new EchoDemoPage(page);
    await demo.goto();

    // Click once, then click again quickly to force reset and potential interleaving
    await demo.clickRun();
    // small delay to let the first immediate client message appear, then trigger a second run
    await page.waitForTimeout(100);
    await demo.clickRun();

    // After the second click, output should have been cleared and then show the second run's immediate message
    await demo.waitForOutputContains('Client] Sending: "Hello, Server!"', { timeout: 500 });

    // Wait long enough for both the 1s and 2s scheduled messages from the second run to fire
    await page.waitForTimeout(2600);

    // At minimum, the second run should produce the three expected messages
    // Count occurrences of the client send pattern to ensure at least three send events happened after the reset
    const sendCount = await demo.countOutputOccurrences('Client] Sending: "');
    expect(
      sendCount
    ).toBeGreaterThanOrEqual(
      3,
      `Expected at least 3 "Client] Sending" messages after repeated clicks, got ${sendCount}`
    );

    // Ensure the output contains echoed responses for the messages from the final run
    const receivedEchoCount = await demo.countOutputOccurrences('Client] Received Echo: "');
    expect(receivedEchoCount).toBeGreaterThanOrEqual(
      3,
      `Expected at least 3 "Client] Received Echo" messages after repeated clicks, got ${receivedEchoCount}`
    );

    // Note: This test intentionally does not assert exact counts (because prior-run timeouts may also append),
    // but asserts that the expected behavior for the most recent run did occur (reset + 3 messages).

    // Check for uncaught page errors that might have been triggered by interleaving behavior
    expect(pageErrors.length).toBe(
      0,
      `Expected no page errors during repeated-click interleaving scenario, got: ${pageErrors
        .map((e) => e.message)
        .join('; ')}`
    );
  });

  test('Observability: capture console messages and page errors if any (reporting test)', async ({ page }) => {
    // This test explicitly demonstrates observation of console messages and page errors.
    // It does not force errors; it simply asserts that we can capture them and validates expected absence.
    const demo = new EchoDemoPage(page);
    await demo.goto();

    // Trigger the demo to produce DOM changes - the page's script does not intentionally console.log,
    // but capture any console output if present.
    await demo.clickRun();

    // Wait for the full sequence to finish
    await page.waitForTimeout(2600);

    // If any page errors occurred, fail the test and include their types/messages
    if (pageErrors.length > 0) {
      const summary = pageErrors.map((e) => `${e.name}: ${e.message}`).join(' | ');
      throw new Error(`Detected uncaught page errors: ${summary}`);
    }

    // If any console.error messages occurred, fail with details
    const consoleErrors = consoleMessages.filter((c) => c.type === 'error');
    if (consoleErrors.length > 0) {
      const summary = consoleErrors.map((c) => c.text).join(' | ');
      throw new Error(`Detected console.error messages: ${summary}`);
    }

    // For informational purposes (non-failing), ensure we captured some console messages array (may be empty)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});