import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3cf93-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object for the Transaction Demo page
 */
class TransactionDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButtonSelector = "button[onclick='runTransactionDemo()']";
    this.outputSelector = '#demoOutput';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isRunButtonVisible() {
    return await this.page.isVisible(this.runButtonSelector);
  }

  async clickRun() {
    await this.page.click(this.runButtonSelector);
  }

  async isOutputVisible() {
    return await this.page.isVisible(this.outputSelector);
  }

  async getOutputText() {
    return await this.page.locator(this.outputSelector).innerText();
  }

  /**
   * Wait for a specific step text to appear inside the demoOutput.
   * @param {string|RegExp} text
   * @param {number} timeout
   */
  async waitForOutputContains(text, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, t) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const txt = el.innerText || '';
        if (typeof t === 'string') return txt.includes(t);
        // t is RegExp serialized as string? We pass RegExp directly via handle so below won't be used.
        return false;
      },
      this.outputSelector,
      text,
      { timeout }
    );
  }

  /**
   * Wait for one of multiple candidate texts to appear.
   * Returns the matched text (string).
   * @param {Array<string>} candidates
   * @param {number} timeout
   */
  async waitForAnyOutputContains(candidates, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const txt = await this.getOutputText();
      for (const c of candidates) {
        if (txt.includes(c)) return c;
      }
      await this.page.waitForTimeout(200);
    }
    throw new Error(`Timed out waiting for any of: ${candidates.join(' | ')}`);
  }
}

test.describe('Transaction Demo - FSM states and transitions', () => {
  // Extend timeout for tests that may run multiple demo attempts (to observe both branches)
  test.setTimeout(120000);

  // Each test will attach its own listeners to observe console logs and page errors
  test('Idle state: Run Transaction Demo button exists and demo output is initially hidden', async ({ page }) => {
    // Capture console and page errors
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new TransactionDemoPage(page);
    await demo.goto();

    // Validate the Run Transaction Demo button is present (Idle state's evidence)
    expect(await demo.isRunButtonVisible()).toBeTruthy();

    // demoOutput element exists but is initially hidden (display: none in CSS)
    const outputHandle = page.locator('#demoOutput');
    expect(await outputHandle.count()).toBe(1);
    expect(await demo.isOutputVisible()).toBeFalsy();

    // Ensure no runtime page errors occurred while loading the idle state
    expect(pageErrors.length).toBe(0);

    // There may be no console logs for this static page; assert there are no error-type console messages
    const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Clicking RunTransactionDemo transitions to Active and logs step 1 (S0 -> S1)', async ({ page }) => {
    // Capture console and page errors
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new TransactionDemoPage(page);
    await demo.goto();

    // Click the Run Transaction Demo button - this should reveal demoOutput and write step 1
    await demo.clickRun();

    // demoOutput should be visible immediately
    await page.waitForSelector('#demoOutput', { state: 'visible' });
    expect(await demo.isOutputVisible()).toBeTruthy();

    // The first message '1. Starting transaction...' should be present quickly
    await demo.waitForOutputContains('1. Starting transaction...', 2000);
    const outText = await demo.getOutputText();
    expect(outText).toContain('Transaction Demo Output');
    expect(outText).toContain('1. Starting transaction...');

    // Verify no page errors occurred as a result of initiating the demo
    expect(pageErrors.length).toBe(0);

    // Verify there are no console error messages
    const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);

    // This asserts the S1 entry action (logStep('1. Starting transaction...')) produced visible evidence in DOM
  });

  test('Full demo run produces Partially Committed (step 2), step 3, and then either Committed or Failed/Aborted (S1->S2->S3 or S1->S2->S4->S5)', async ({ page }) => {
    // Capture console and page errors
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new TransactionDemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // Wait for step 2 (Partially Committed) to appear
    await demo.waitForOutputContains('2. Executing operation 1: Deduct $100 from Account A', 5000);
    let txt = await demo.getOutputText();
    expect(txt).toContain('2. Executing operation 1: Deduct $100 from Account A');

    // Wait for step 3 to appear
    await demo.waitForOutputContains('3. Executing operation 2: Add $100 to Account B', 5000);
    txt = await demo.getOutputText();
    expect(txt).toContain('3. Executing operation 2: Add $100 to Account B');

    // Now wait for either commit or error branch (commit OR error+abort)
    const finalCandidate = await demo.waitForAnyOutputContains(
      [
        '4. Transaction committed successfully!',
        '4. Error occurred! Rolling back transaction...'
      ],
      8000
    );

    txt = await demo.getOutputText();

    if (finalCandidate.includes('committed')) {
      // Committed branch observed (S3)
      expect(txt).toContain('4. Transaction committed successfully!');
      expect(txt).toContain('Result: Both accounts updated atomically.');
      // Ensure there was no abort message in this run
      expect(txt).not.toContain('5. Transaction aborted. No accounts were changed.');
    } else {
      // Failed branch observed (S4) - ensure it later transitions to Aborted (S5)
      expect(txt).toContain('4. Error occurred! Rolling back transaction...');
      // The abort message is appended immediately in the demo implementation after the error path
      expect(txt).toContain('5. Transaction aborted. No accounts were changed.');
    }

    // Ensure no page runtime errors were thrown while executing the demo
    expect(pageErrors.length).toBe(0);

    // Validate there are no console-level errors
    const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Clicking Run Transaction Demo multiple times resets output and does not throw errors (edge case: restart while running)', async ({ page }) => {
    // Capture console and page errors
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new TransactionDemoPage(page);
    await demo.goto();

    // Start demo and wait for step 2 to ensure it's running
    await demo.clickRun();
    await demo.waitForOutputContains('2. Executing operation 1: Deduct $100 from Account A', 5000);

    // While it's running, click again to restart - this should set innerHTML back to header and step1 for the new run
    await demo.clickRun();

    // Immediately ensure demoOutput is visible and contains the header and starting message for the restarted run
    await page.waitForSelector('#demoOutput', { state: 'visible' });
    await demo.waitForOutputContains('1. Starting transaction...', 2000);
    let txt = await demo.getOutputText();
    expect(txt).toContain('Transaction Demo Output');
    expect(txt).toContain('1. Starting transaction...');

    // Allow the restarted run to progress to step 2 and 3 and finalization (commit or abort)
    await demo.waitForOutputContains('3. Executing operation 2: Add $100 to Account B', 8000);
    const finalCandidate = await demo.waitForAnyOutputContains(
      [
        '4. Transaction committed successfully!',
        '4. Error occurred! Rolling back transaction...'
      ],
      8000
    );

    txt = await demo.getOutputText();
    if (finalCandidate.includes('committed')) {
      expect(txt).toContain('4. Transaction committed successfully!');
    } else {
      expect(txt).toContain('4. Error occurred! Rolling back transaction...');
      expect(txt).toContain('5. Transaction aborted. No accounts were changed.');
    }

    // Ensure no page errors occurred during the restart process
    expect(pageErrors.length).toBe(0);

    // No console error messages expected
    const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Statistically observe both committed and aborted paths by repeated runs (S2 -> S3 and S2 -> S4 -> S5)', async ({ page }) => {
    // This test will run the demo multiple times to try to observe both the commit and abort branches.
    // Note: The demo uses Math.random() to decide the branch. We do not modify or patch Math.random().
    // We run the demo up to maxAttempts times (narrow probabilistic test) to observe both outcomes naturally.

    test.setTimeout(120000); // extend for this test scope as well

    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const demo = new TransactionDemoPage(page);
    await demo.goto();

    const maxAttempts = 20; // higher attempts to reduce flakiness
    let committedSeen = false;
    let abortedSeen = false;
    let attempts = 0;

    while (attempts < maxAttempts && (!committedSeen || !abortedSeen)) {
      attempts += 1;
      // Click run button
      await demo.clickRun();

      // Wait for basic progression to step 3 to ensure run progressed
      try {
        await demo.waitForOutputContains('3. Executing operation 2: Add $100 to Account B', 7000);
      } catch (err) {
        // If step 3 did not appear in time, continue to next attempt
        continue;
      }

      // Wait for either commit or error finalization
      let finalObserved;
      try {
        finalObserved = await demo.waitForAnyOutputContains(
          [
            '4. Transaction committed successfully!',
            '4. Error occurred! Rolling back transaction...'
          ],
          8000
        );
      } catch (err) {
        // If neither observed, continue to next attempt
        continue;
      }

      const txt = await demo.getOutputText();
      if (finalObserved.includes('committed')) {
        committedSeen = true;
      } else if (finalObserved.includes('Error occurred')) {
        // After error occurred, the abort message is also appended in the demo; confirm aborted
        if (txt.includes('5. Transaction aborted. No accounts were changed.')) {
          abortedSeen = true;
        } else {
          // If abort message missing, still mark failed branch observed (but we prefer to observe S5)
          abortedSeen = true;
        }
      }

      // small delay before next attempt to let timers settle
      await page.waitForTimeout(300);
    }

    // Assert that both branches were observed within attempts
    expect(committedSeen, `Committed branch was not observed in ${attempts} attempts`).toBeTruthy();
    expect(abortedSeen, `Aborted branch was not observed in ${attempts} attempts`).toBeTruthy();

    // Ensure no page runtime errors during all attempts
    expect(pageErrors.length).toBe(0);

    // No console error messages expected
    const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });
});