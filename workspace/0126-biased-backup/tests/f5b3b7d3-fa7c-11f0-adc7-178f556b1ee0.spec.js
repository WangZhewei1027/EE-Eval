import { test, expect } from '@playwright/test';

// URL of the HTML implementation to test
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b3b7d3-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for interacting with the Runtime Environment page
class RuntimePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Returns the run demo button element handle
  async runDemoButton() {
    return this.page.locator('#run-demo-btn');
  }

  // Clicks the Run Demo button
  async clickRunDemo() {
    await (await this.runDemoButton()).click();
  }

  // Evaluates and returns the runtimeEnvironment object from the page context
  async getRuntimeEnvironment() {
    return this.page.evaluate(() => {
      // Accessing window.runtimeEnvironment directly; if undefined this returns undefined
      return window.runtimeEnvironment;
    });
  }
}

// Helper to wait for a console message of a specific type and optional text matcher
async function waitForConsoleMessage(page, predicate, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      page.removeListener('console', onConsole);
      reject(new Error('Timed out waiting for console message'));
    }, timeout);

    function onConsole(msg) {
      try {
        if (predicate(msg)) {
          clearTimeout(timer);
          page.removeListener('console', onConsole);
          resolve(msg);
        }
      } catch (e) {
        // ignore predicate errors
      }
    }

    page.on('console', onConsole);
  });
}

test.describe('Runtime Environment - FSM states and transitions', () => {
  // We'll collect console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // Nothing to patch; tests must observe runtime behavior as-is
    // Navigate to the page under test for each test
    await page.goto(APP_URL);
  });

  test('S0_Idle: Initial render - button exists and program executed on load', async ({ page }) => {
    // This test validates the Idle state: DOM evidence and entry actions (where applicable)
    const runtimePage = new RuntimePage(page);

    // Ensure the Run Demo button exists and has the expected text
    const btn = await runtimePage.runDemoButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run Demo');

    // The page's script runs program() on load; verify runtimeEnvironment exists
    const runtime = await runtimePage.getRuntimeEnvironment();
    // runtimeEnvironment should be present and have expected basic properties
    expect(runtime).toBeTruthy();
    expect(runtime).toHaveProperty('memory', 1024);
    expect(runtime).toHaveProperty('files');
    expect(Array.isArray(runtime.files)).toBe(true);
    expect(runtime).toHaveProperty('io');
    expect(runtime.io).toHaveProperty('server', 'http://example.com');
    expect(runtime.io).toHaveProperty('client', 'http://localhost:8080');

    // The program() pushes a new file object synchronously before the fetch:
    // Verify that files array contains an object with the expected fields
    const foundNewFile = runtime.files.some(
      f => typeof f === 'object' && f.name === 'new_file.txt' && f.content === 'Hello, World!'
    );
    expect(foundNewFile).toBe(true);

    // The fetch in program() is asynchronous and its rejection (if any) will be caught and logged via console.error.
    // Wait briefly for any console.error to appear as a result of the fetch failing (network/CORS etc).
    // We do not modify the page or patch fetch; we observe the runtime behavior.
    let fetchErrorMsg = null;
    try {
      const msg = await waitForConsoleMessage(
        page,
        m => m.type() === 'error' && /fetch|Failed to fetch|NetworkError|TypeError/i.test(m.text()),
        4000
      );
      fetchErrorMsg = msg.text();
    } catch (e) {
      // It's possible no console.error arrived within the timeout (environment-specific).
      // We will assert below that fetchErrorMsg is either a string (error occurred) or null (no error observed).
    }

    // Assert that either an error occurred and was logged, OR no error was observed (both are acceptable
    // since network behavior can vary across environments). However, to follow the requirement of observing
    // runtime errors naturally, prefer to at least assert that if a console.error exists it contains an Error-like message.
    if (fetchErrorMsg) {
      expect(typeof fetchErrorMsg).toBe('string');
      expect(fetchErrorMsg.length).toBeGreaterThan(0);
    } else {
      // No error observed within timeout; ensure page did not produce an uncaught exception
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      // allow a short pause to capture potential uncaught errors
      await page.waitForTimeout(200);
      expect(pageErrors.length).toBe(0);
    }
  });

  test('S1_DemoRunning: Clicking "Run Demo" triggers console logs for runtime details (transition S0 -> S1)', async ({ page }) => {
    // This test validates the transition triggered by clicking the Run Demo button.
    const runtimePage = new RuntimePage(page);

    // Collect console messages for the click action
    const messages = [];
    page.on('console', msg => {
      // store both type and text for verification
      messages.push({ type: msg.type(), text: msg.text() });
    });

    // Click the Run Demo button to fire the event handler that logs runtime environment details
    await runtimePage.clickRunDemo();

    // Wait for the specific console.log messages that constitute the S1 entry actions.
    // The implementation logs:
    // console.log('Runtime Environment:', runtimeEnvironment);
    // console.log('Available Memory:', runtimeEnvironment.memory);
    // console.log('Available Files:', runtimeEnvironment.files);
    // console.log('IO Server:', runtimeEnvironment.io.server);
    // console.log('IO Client:', runtimeEnvironment.io.client);
    //
    // We'll wait for one of those messages and then assert that the rest are present in the collected messages.
    try {
      await waitForConsoleMessage(
        page,
        m => m.type() === 'log' && /Runtime Environment:/.test(m.text()),
        3000
      );
    } catch (e) {
      // If the primary 'Runtime Environment:' log didn't appear in time, still proceed to assert what we have
    }

    // Give a small delay to allow all logs to be emitted
    await page.waitForTimeout(200);

    // Extract texts of log messages for easier assertions
    const logTexts = messages.filter(m => m.type === 'log').map(m => m.text);

    // Assert that each expected log line was emitted at least once
    const expectedPatterns = [
      /Runtime Environment:/,
      /Available Memory:/,
      /Available Files:/,
      /IO Server:/,
      /IO Client:/
    ];

    for (const pattern of expectedPatterns) {
      const found = logTexts.some(t => pattern.test(t));
      expect(found, `Expected console.log matching ${pattern} to be emitted`).toBe(true);
    }

    // Additionally, verify the values logged match the runtimeEnvironment accessible via page context
    const runtime = await runtimePage.getRuntimeEnvironment();
    expect(runtime).toBeTruthy();

    // Confirm that the runtime memory logged equals the runtimeEnvironment.memory
    // (We cannot read back the exact console output arguments except the combined string; thus we verify consistency in-window)
    expect(runtime.memory).toBe(1024);
    expect(runtime.io.server).toBe('http://example.com');
    expect(runtime.io.client).toBe('http://localhost:8080');

    // Clicking the button should not mutate the runtime.files array in the current implementation (the click handler only logs).
    const filesAfterClick = runtime.files;
    const foundNewFile = filesAfterClick.some(
      f => typeof f === 'object' && f.name === 'new_file.txt' && f.content === 'Hello, World!'
    );
    expect(foundNewFile).toBe(true);

    // Edge case: clicking multiple times should produce additional logs but not throw errors.
    // Clear collected messages and click twice more to assert logs are produced again.
    messages.length = 0;
    await runtimePage.clickRunDemo();
    await runtimePage.clickRunDemo();
    await page.waitForTimeout(200);

    const repeatedLogCount = messages.filter(m => m.type === 'log' && /Runtime Environment:/.test(m.text)).length;
    expect(repeatedLogCount).toBeGreaterThanOrEqual(2);
  });

  test('Edge cases and error observation: ensure fetch error (if any) logged and no uncaught exceptions', async ({ page }) => {
    // This test focuses on observing runtime errors happening naturally (no patching).
    // It asserts that any handled fetch/network error is logged via console.error, and there are no uncaught page errors.

    const runtimePage = new RuntimePage(page);

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    // The fetch is initiated on load; give time for the fetch to complete/fail and be logged
    // Also click the button to exercise more code paths that log information
    await runtimePage.clickRunDemo();

    // Wait up to 4 seconds for any console.error to appear
    try {
      await waitForConsoleMessage(
        page,
        m => m.type() === 'error',
        4000
      );
    } catch (e) {
      // No console.error observed within timeout; that's acceptable but we record the absence
    }

    // Allow a short grace period for uncaught page errors to appear
    await page.waitForTimeout(200);

    // Assert there were no uncaught page errors (runtime exceptions not caught by page scripts)
    expect(pageErrors.length).toBe(0);

    // If console error messages exist, assert they look like network/fetch related errors or other runtime logs
    if (consoleErrors.length > 0) {
      const hasFetchRelated = consoleErrors.some(text =>
        /fetch|Failed to fetch|NetworkError|TypeError|Failed to load resource|error/i.test(text)
      );
      // At least one of the errors should resemble a fetch/network error given the PUT to an external server
      expect(hasFetchRelated).toBe(true);
    } else {
      // If no console.error, that's acceptable in some environments; still ensure the page did not throw uncaught exceptions
      expect(pageErrors.length).toBe(0);
    }
  });
});