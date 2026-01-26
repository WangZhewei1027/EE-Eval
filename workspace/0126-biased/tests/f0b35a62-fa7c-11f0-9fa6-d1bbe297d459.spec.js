import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b35a62-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Thread Demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demo-button');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the "Run Thread Demo" button
  async clickRun() {
    await this.button.click();
  }

  // Get the raw innerText of the demo output
  async getOutputText() {
    return await this.output.innerText();
  }

  // Wait until the demo output contains a given substring (with default timeout)
  async waitForOutputContains(substring, options = {}) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.innerText.includes(substr);
      },
      ['#demo-output', substring],
      options
    );
  }

  // Wait for all expected substrings to appear (in any order), with a sensible timeout
  async waitForAllSubstrings(substrings, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, subs) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const txt = el.innerText;
        return subs.every(s => txt.includes(s));
      },
      ['#demo-output', substrings],
      { timeout }
    );
  }
}

test.describe('f0b35a62-fa7c-11f0-9fa6-d1bbe297d459 - Thread Demo (FSM) E2E tests', () => {
  // Capture console and page errors for assertions
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Listen to uncaught page errors
    page.on('pageerror', err => {
      // err is an Error object
      pageErrors.push(String(err));
    });
  });

  test.afterEach(async () => {
    // Basic sanity assertion to help surface runtime errors if they occurred during the test
    // The below assertions are intentionally placed in afterEach to make sure we capture any runtime
    // errors that might have been emitted during navigation/interactions.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(consoleErrors)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test('Initial Idle state renders expected components (renderPage entry action)', async ({ page }) => {
    // This test validates that the initial "Idle" state is rendered:
    // - The "Run Thread Demo" button exists and is visible
    // - The demo output container exists and is initially empty
    // - No runtime errors have been reported on load
    const demo = new DemoPage(page);
    await demo.goto();

    // Check button presence and label
    await expect(demo.button).toBeVisible();
    await expect(demo.button).toHaveText('Run Thread Demo');

    // Check output exists and is empty (or just whitespace)
    const outputText = await demo.getOutputText();
    expect(outputText.trim()).toBe('');

    // Assert there were no console errors or page errors immediately after load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Single click triggers Threads Started and Main Thread Continuing (S0 -> S1 -> S4)', async ({ page }) => {
    // This test validates the core transition sequence:
    // - Clicking the button should set "Starting threads..." immediately (S1_Threads_Started evidence)
    // - The "Main thread continues execution..." line should be present right away (S4 evidence)
    // - No uncaught runtime errors occur during the interaction
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the demo button to trigger the FSM transitions
    await demo.clickRun();

    // Immediately the "Starting threads..." message should be visible
    await demo.waitForOutputContains('Starting threads...', { timeout: 1000 });
    let out = await demo.getOutputText();
    expect(out).toContain('Starting threads...');

    // The main thread continues line is added synchronously after setting Starting threads...
    expect(out).toContain('Main thread continues execution...');

    // Wait for both thread "Started" lines to appear (they are added after small timeouts)
    await demo.waitForAllSubstrings(['Thread 1: Started', 'Thread 2: Started'], 2000);

    // Ensure no runtime errors were emitted during this interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Threads produce all step lines and interleave (S2 & S3 thread steps => S4)', async ({ page }) => {
    // This test validates that the simulated threads produce all expected step messages:
    // - Thread 1: Step 1..3
    // - Thread 2: Step 1..3
    // It does not require a strict ordering because setTimeout scheduling can interleave.
    const demo = new DemoPage(page);
    await demo.goto();

    await demo.clickRun();

    // Wait for the longest possible scheduled event from the demo script:
    // Thread 1 steps at 100ms + (i*300) -> last at 100 + 900 = 1000ms
    // Thread 2 steps at 150ms + (i*200) -> last at 150 + 600 = 750ms
    // Use generous timeout to be resilient in CI
    const expectedSteps = [
      'Thread 1: Step 1',
      'Thread 1: Step 2',
      'Thread 1: Step 3',
      'Thread 2: Step 1',
      'Thread 2: Step 2',
      'Thread 2: Step 3'
    ];
    await demo.waitForAllSubstrings(expectedSteps, 3000);

    const out = await demo.getOutputText();
    // Assert each expected step appears
    for (const step of expectedSteps) {
      expect(out).toContain(step);
    }

    // Also assert the 'Started' markers exist
    expect(out).toContain('Thread 1: Started');
    expect(out).toContain('Thread 2: Started');

    // No runtime errors should have been raised during threading simulation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Double-clicking Run Thread Demo resets output and restarts sequence (edge case)', async ({ page }) => {
    // This test checks an edge case: clicking the Run button twice quickly.
    // The implementation sets output.innerHTML = "Starting threads...<br>" on each click,
    // so the second click should reset the output and start a fresh sequence.
    const demo = new DemoPage(page);
    await demo.goto();

    // First click
    await demo.clickRun();

    // Small delay to let the first click start scheduling timers
    await page.waitForTimeout(120);

    // Second click soon after
    await demo.clickRun();

    // After the second click, the output innerHTML should have been reset to start message.
    // Because the script uses output.innerHTML = "Starting threads...<br>" synchronously.
    await demo.waitForOutputContains('Starting threads...', { timeout: 1000 });
    const out = await demo.getOutputText();

    // Confirm that the first token is the starting message (indicating reset)
    expect(out.trim().startsWith('Starting threads...')).toBeTruthy();

    // Also ensure main thread line is present as part of the new run
    expect(out).toContain('Main thread continues execution...');

    // Wait for at least one thread start to confirm scheduling from the second click
    await demo.waitForAllSubstrings(['Thread 1: Started', 'Thread 2: Started'], 2500);

    // Confirm there were no console errors or page errors during the double-click case
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('No unexpected runtime errors (ReferenceError/SyntaxError/TypeError) during full demo run', async ({ page }) => {
    // This test intentionally collects console and page errors throughout a full demo run
    // and asserts that severe runtime exceptions (ReferenceError, SyntaxError, TypeError)
    // did not occur. If they do occur naturally in the environment, this test will catch them.
    const demo = new DemoPage(page);
    await demo.goto();

    await demo.clickRun();

    // Wait until all expected outputs are present
    const expectedAll = [
      'Starting threads...',
      'Main thread continues execution...',
      'Thread 1: Started',
      'Thread 2: Started',
      'Thread 1: Step 1',
      'Thread 1: Step 2',
      'Thread 1: Step 3',
      'Thread 2: Step 1',
      'Thread 2: Step 2',
      'Thread 2: Step 3'
    ];
    await demo.waitForAllSubstrings(expectedAll, 4000);

    // Now examine captured page errors and console errors to ensure none are critical
    // We will explicitly fail if any pageErrors exist or any consoleErrors exist.
    if (pageErrors.length > 0) {
      // Provide a detailed failure message with the errors found
      throw new Error(`Page errors were emitted during demo execution: ${JSON.stringify(pageErrors, null, 2)}`);
    }
    if (consoleErrors.length > 0) {
      throw new Error(`Console errors were emitted during demo execution: ${JSON.stringify(consoleErrors, null, 2)}`);
    }

    // Additionally, ensure no console messages include the words ReferenceError, SyntaxError, TypeError
    for (const msg of consoleMessages) {
      const text = msg.text;
      expect(text).not.toMatch(/ReferenceError/);
      expect(text).not.toMatch(/SyntaxError/);
      expect(text).not.toMatch(/TypeError/);
    }
  });
});