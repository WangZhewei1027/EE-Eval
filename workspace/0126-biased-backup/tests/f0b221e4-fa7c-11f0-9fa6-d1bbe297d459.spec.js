import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b221e4-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Linear Search Demo page
class LinearSearchDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demoButton');
    this.output = page.locator('#demoOutput');
  }

  // Navigate to the app page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the "Start Demonstration" button
  async clickStart() {
    await this.demoButton.click();
  }

  // Get raw output innerText
  async getOutputText() {
    return (await this.output.innerText()).trim();
  }

  // Get raw output innerHTML
  async getOutputHTML() {
    return (await this.output.evaluate((el) => el.innerHTML)).trim();
  }

  // Wait until the output includes the given substring (with timeout)
  async waitForOutputIncludes(substring, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.innerText.includes(substr);
      },
      this.output.selector,
      substring,
      { timeout }
    );
  }

  // Count occurrences of a substring in the output HTML
  async countOutputOccurrences(substring) {
    const html = await this.getOutputHTML();
    if (!html) return 0;
    return (html.match(new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }

  // Get concatenated text content of all <script> tags on the page
  async getAllScriptText() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\n');
    });
  }
}

test.describe('Linear Search Demo FSM Tests - f0b221e4-fa7c-11f0-9fa6-d1bbe297d459', () => {
  let page;
  let demo;
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];
  let listeners = [];

  // Setup: create page object, navigate, and hook console/pageerror listeners
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    demo = new LinearSearchDemoPage(page);

    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors
    const onConsole = (msg) => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') consoleErrors.push(entry);
    };
    page.on('console', onConsole);
    listeners.push(() => page.off('console', onConsole));

    // Capture uncaught page errors
    const onPageError = (err) => {
      pageErrors.push(err.message || String(err));
    };
    page.on('pageerror', onPageError);
    listeners.push(() => page.off('pageerror', onPageError));

    await demo.goto();
  });

  // Teardown: remove listeners and close page
  test.afterEach(async () => {
    // remove listeners
    for (const off of listeners) {
      try { off(); } catch (e) { /* ignore */ }
    }
    listeners = [];
    if (page && !page.isClosed()) await page.close();
  });

  test('Idle state (S0_Idle): page renders Start Demonstration button', async () => {
    // This validates the Idle state rendering: presence of the demo button
    await expect(demo.demoButton).toBeVisible();
    await expect(demo.demoButton).toHaveText('Start Demonstration');

    // The demo output should be initially empty
    const initialText = await demo.getOutputText();
    expect(initialText === '' || initialText === undefined).toBeTruthy();

    // No console errors or uncaught page errors should have occurred on initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 (StartDemonstration): clicking Start shows "Starting linear search..." and first check', async () => {
    // Click the Start Demonstration button to trigger Searching state
    await demo.clickStart();

    // Immediately the code sets the output to 'Starting linear search...'
    await demo.waitForOutputIncludes('Starting linear search...', 2000);
    const outputAfterStart = await demo.getOutputText();
    expect(outputAfterStart).toContain('Starting linear search...');

    // The first check (index 0) is scheduled with setTimeout(..., 0) in displayStep(0)
    // Wait for the "Checking index 0" message to appear
    await demo.waitForOutputIncludes('Checking index 0', 3000);
    expect(await demo.getOutputText()).toContain('Checking index 0');

    // After index 0 check, because arr[0] !== target, we should see not-a-match message
    await demo.waitForOutputIncludes('Not a match, moving to next element', 4000);
    expect(await demo.getOutputText()).toContain('Not a match, moving to next element');

    // Ensure no runtime errors happened while transitioning to searching
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Searching (S1) continues through elements and reaches Found state (S2_Found) at index 3', async () => {
    // Start the demonstration
    await demo.clickStart();

    // Wait for the Found message; target 7 is at index 3 in the array provided in the demo
    await demo.waitForOutputIncludes('Found target at index 3', 10000);

    const output = await demo.getOutputText();
    expect(output).toContain('Found target at index 3');

    // Confirm that the sequence of "Checking index X" messages includes 0..3
    expect(output).toContain('Checking index 0');
    expect(output).toContain('Checking index 1');
    expect(output).toContain('Checking index 2');
    expect(output).toContain('Checking index 3');

    // Ensure final found message is properly appended (evidence of S2 entry action)
    expect(output.match(/Found target at index 3/g).length).toBeGreaterThanOrEqual(1);

    // No console or uncaught errors should have been produced during the full search
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('ContinueSearching transition: multiple clicks and repeated demonstrations append output without throwing errors', async () => {
    // Click twice rapidly to create overlapping demonstrations
    await demo.clickStart();
    await demo.clickStart();

    // The page will append "Starting linear search..." twice; wait for at least two occurrences
    await demo.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return (el.innerHTML.match(/Starting linear search.../g) || []).length >= 2;
      },
      demo.output.selector,
      { timeout: 5000 }
    );

    const countStarts = await demo.countOutputOccurrences('Starting linear search...');
    expect(countStarts).toBeGreaterThanOrEqual(2);

    // Ensure at least one Found message appears (one of the runs should complete)
    await demo.waitForOutputIncludes('Found target at index 3', 10000);
    expect(await demo.getOutputText()).toContain('Found target at index 3');

    // Confirm that "Not a match, moving to next element" appears at least as part of the continuing searches
    expect(await demo.getOutputText()).toContain('Not a match, moving to next element');

    // Validate there are still no console errors or page errors after rapid interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S3_NotFound evidence exists in source code even if not reachable in default demo', async () => {
    // The demo's JS should contain the not-found branch text: "Reached end of array without finding the target."
    const scriptsText = await demo.getAllScriptText();

    // Validate presence of the event listener registration evidence
    expect(scriptsText).toContain("getElementById('demoButton').addEventListener('click' || \"getElementById('demoButton').addEventListener('click'");

    // Validate NotFound branch snippet exists in script (verifies implementation for S3_NotFound exists)
    expect(scriptsText).toContain('Reached end of array without finding the target.');

    // Validate displayStep recursion evidence (ContinueSearching transition)
    expect(scriptsText).toContain('displayStep(index + 1)'.replace(/'/g, "'") || 'displayStep(index + 1)');

    // No runtime errors from source inspection/loading
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: many rapid clicks do not cause uncaught exceptions (robustness)', async () => {
    // Click the button several times rapidly to stress the scheduling and recursion
    for (let i = 0; i < 5; i++) {
      await demo.clickStart();
    }

    // Wait until at least one run completes with Found message
    await demo.waitForOutputIncludes('Found target at index 3', 12000);

    // Validate that multiple "Starting linear search..." occurrences are present
    const startsCount = await demo.countOutputOccurrences('Starting linear search...');
    expect(startsCount).toBeGreaterThanOrEqual(5);

    // Ensure no uncaught exceptions or console errors occurred even under stress
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});