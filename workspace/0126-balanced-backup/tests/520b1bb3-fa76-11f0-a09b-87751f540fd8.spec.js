import { test, expect } from '@playwright/test';

// URL of the page under test (as required)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b1bb3-fa76-11f0-a09b-87751f540fd8.html';

// Page Object Model for the Integration Testing page
class IntegrationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#test-btn');
    this.result = page.locator('#result');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.button.click();
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }

  async isResultEmpty() {
    const text = await this.getResultText();
    return text.trim().length === 0;
  }
}

// Helper to wait until result text starts with expected prefix (either Result or Error)
async function waitForIntegrationOutcome(pageObj, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = (await pageObj.getResultText()).trim();
    if (/^Integration Test (Result|Error):\s*/.test(text)) {
      return text;
    }
    await pageObj.page.waitForTimeout(100);
  }
  // final check to produce helpful error if timed out
  const finalText = (await pageObj.getResultText()).trim();
  throw new Error(`Timed out waiting for integration outcome. Final text: "${finalText}"`);
}

test.describe('Integration Testing Page - FSM validation (520b1bb3-fa76-11f0-a09b-87751f540fd8)', () => {
  // We'll capture console messages and page errors for each test to observe runtime behavior.
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests attach listeners as needed to keep isolation and clear assertions.
  });

  test('S0_Idle: Page initially renders with Run Integration Test button and empty result', async ({ page }) => {
    // Capture console and page errors for observation
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const p = new IntegrationPage(page);
    await p.goto();

    // Verify initial elements exist as evidence of renderPage() entry action for S0_Idle
    await expect(p.heading).toHaveText('Integration Testing');
    await expect(p.button).toBeVisible();
    await expect(p.button).toHaveText('Run Integration Test');

    // result div should be present and empty at initial state
    expect(await p.isResultEmpty()).toBeTruthy();

    // Assert there were no unexpected runtime errors during initial render
    // We observe console messages and page errors and assert none of type 'error' or pageErrors occurred.
    const severeConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severeConsole.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Testing: Clicking Run Integration Test triggers fetch and updates #result (success or error)', async ({ page }) => {
    // Collect console and page errors so we can assert and report them
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const p = new IntegrationPage(page);
    await p.goto();

    // Precondition: idle state
    expect(await p.isResultEmpty()).toBeTruthy();

    // Trigger the RunIntegrationTest event by clicking the button
    await p.clickRun();

    // After click, the FSM transitions to S1_Testing and the page either sets "Integration Test Result: ..." or "Integration Test Error: ..."
    const finalText = await waitForIntegrationOutcome(p, 8000);

    // Validate that the resultDiv text matches either the success or error template
    expect(finalText).toMatch(/^Integration Test (Result|Error):\s*/);

    // Additionally assert that the button remains present (UI still shows button even during/after testing)
    expect(await p.isButtonVisible()).toBeTruthy();

    // Observe console / page errors: if any page errors occurred they should be legitimate JS runtime exceptions; assert none occurred
    // (This test observes runtime errors but does not attempt to inject or patch anything.)
    const severeConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(severeConsole.length).toBe(0);
  });

  test('Edge case: Multiple rapid clicks should still result in a valid Integration Test outcome', async ({ page }) => {
    // Capture console and page errors for observation
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const p = new IntegrationPage(page);
    await p.goto();

    // Click the button multiple times quickly to simulate rapid user interactions
    await Promise.all([
      p.clickRun(),
      p.clickRun(),
      p.clickRun()
    ]);

    // Wait for final text update - whichever last fetch resolves will set the text
    const finalText = await waitForIntegrationOutcome(p, 10000);
    expect(finalText).toMatch(/^Integration Test (Result|Error):\s*/);

    // Ensure there's still only one #result element and one #test-btn element
    await expect(page.locator('#result')).toHaveCount(1);
    await expect(page.locator('#test-btn')).toHaveCount(1);

    // Ensure no uncaught page errors from rapid interaction
    expect(pageErrors.length).toBe(0);
    const severeConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severeConsole.length).toBe(0);
  });

  test('FSM evidence assertions: verify DOM evidence for states and transition actions (presence of button and result text patterns)', async ({ page }) => {
    const p = new IntegrationPage(page);
    await p.goto();

    // Evidence for S0_Idle: button exists in DOM
    await expect(page.locator('button#test-btn')).toBeVisible();

    // Fire transition event
    await p.clickRun();

    // Evidence for S1_Testing: resultDiv updated with expected assignment pattern (either success or error)
    const finalText = await waitForIntegrationOutcome(p, 8000);
    // Check that the resultDiv contains the words used in the FSM evidence strings
    // FSM evidence included: "Integration Test Result: ${data}" and "Integration Test Error: ${error.message}"
    expect(finalText).toMatch(/Integration Test (Result|Error):/);
  });

  test('Observes and reports any unexpected JS runtime errors (pageerror events) while loading and interacting', async ({ page }) => {
    // This test explicitly demonstrates observation of console and page errors.
    // It will fail if any uncaught pageerror occurs (to make runtime errors visible).
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const p = new IntegrationPage(page);
    await p.goto();

    // Interact to possibly trigger runtime errors
    await p.clickRun();

    // Wait for outcome but still assert that no uncaught exceptions were thrown
    await waitForIntegrationOutcome(p, 8000);

    // If there are page errors, fail with the collected information (so they are observed and asserted)
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Provide detailed failure message with the observed errors
      let message = 'Detected runtime errors during page load or interaction:\n';
      if (pageErrors.length > 0) {
        message += `pageerror events (${pageErrors.length}):\n`;
        for (const e of pageErrors) {
          message += ` - ${e.message}\n`;
        }
      }
      if (consoleErrors.length > 0) {
        message += `console.error messages (${consoleErrors.length}):\n`;
        for (const c of consoleErrors) {
          message += ` - ${c}\n`;
        }
      }
      // Fail the test to make these runtime errors explicit
      throw new Error(message);
    }

    // If none, assert explicitly that no errors were recorded
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});