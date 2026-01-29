import { test, expect } from '@playwright/test';

// Test file for Application ID: 63b25fb2-fa74-11f0-bb9a-db7e6ecdeeaa
// Serves at: http://127.0.0.1:5500/workspace/0126-balanced/html/63b25fb2-fa74-11f0-bb9a-db7e6ecdeeaa.html
// Filename requirement: 63b25fb2-fa74-11f0-bb9a-db7e6ecdeeaa.spec.js

// Page object encapsulating elements and interactions for the demo page.
class SpaceComplexityPage {
  constructor(page) {
    this.page = page;
    this.btnIterative = page.locator('#btnIterative');
    this.btnArray = page.locator('#btnArray');
    this.outputIterative = page.locator('#outputIterative');
    this.outputArray = page.locator('#outputArray');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/63b25fb2-fa74-11f0-bb9a-db7e6ecdeeaa.html', { waitUntil: 'load' });
  }

  async clickIterative() {
    await this.btnIterative.click();
  }

  async clickArray() {
    await this.btnArray.click();
  }

  async getIterativeText() {
    return (await this.outputIterative.textContent()) ?? '';
  }

  async getArrayText() {
    return (await this.outputArray.textContent()) ?? '';
  }
}

test.describe('Space Complexity Demo - FSM states and transitions', () => {
  // Array to collect console errors and page errors for each test run.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Sanity check: ensure no uncaught errors occurred during the test.
    // This asserts that the page ran without runtime console errors or uncaught exceptions.
    // If the application produces runtime errors, these assertions will fail and surface them.
    expect(consoleErrors, 'No console.error messages should be emitted during the test').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should be emitted during the test').toEqual([]);
  });

  test('Initial Idle state renders correctly with controls present', async ({ page }) => {
    // Validate Idle state: buttons and output divs present and empty.
    const app = new SpaceComplexityPage(page);
    await app.goto();

    // Ensure the two action buttons exist and have expected labels.
    await expect(app.btnIterative).toHaveCount(1);
    await expect(app.btnArray).toHaveCount(1);
    await expect(app.btnIterative).toHaveText('Run iterativeSum(1000000)');
    await expect(app.btnArray).toHaveText('Run arraySum(1000000)');

    // Outputs should be initially empty (Idle state's evidence).
    expect(await app.getIterativeText(), 'outputIterative should be empty in Idle state').toBe('');
    expect(await app.getArrayText(), 'outputArray should be empty in Idle state').toBe('');
  });

  test('Run iterativeSum: transitions to Calculating and then back to Idle with correct result and O(1) message', async ({ page }) => {
    // This test validates:
    // - On click, outputIterative shows "Calculating..." (onEnter / transition start)
    // - After processing, outputIterative shows the computed result and the O(1) space complexity message (onExit)
    const app1 = new SpaceComplexityPage(page);
    await app.goto();

    // Click to trigger iterative calculation (RunIterativeSum event)
    await app.clickIterative();

    // Immediately after click, the page should indicate it's calculating.
    await expect(app.outputIterative).toHaveText(/Calculating\.\.\./, { timeout: 2000 });

    // Wait for the result to appear - the implementation uses setTimeout(..., 100)
    await expect(app.outputIterative).toHaveText(/Result:\s*\d+/, { timeout: 10000 });

    // Verify full expected messages are present
    const iterativeText = await app.getIterativeText();
    expect(iterativeText).toContain('Result:');
    expect(iterativeText).toContain('Memory used: Constant amount');
    expect(iterativeText).toContain('(Space Complexity: O(1))');

    // Verify numeric correctness for sum 1..1e6 -> n*(n+1)/2
    const n = 1000000;
    const expected = (n * (n + 1)) / 2; // 500000500000
    expect(iterativeText).toContain(String(expected));

    // Clicking again should repeat the transition and produce the same final state/text.
    await app.clickIterative();
    await expect(app.outputIterative).toHaveText(/Calculating\.\.\./, { timeout: 2000 });
    await expect(app.outputIterative).toHaveText(/Result:\s*\d+/, { timeout: 10000 });
    const iterativeText2 = await app.getIterativeText();
    expect(iterativeText2).toContain(String(expected));
    expect(iterativeText2).toContain('(Space Complexity: O(1))');
  }, 20000); // increase timeout for heavy computation just in case

  test('Run arraySum: transitions to Calculating and then back to Idle with correct result and O(n) message', async ({ page }) => {
    // This test validates:
    // - On click, outputArray shows "Calculating..." (onEnter)
    // - After processing, outputArray shows the computed result and the O(n) space complexity message (onExit)
    const app2 = new SpaceComplexityPage(page);
    await app.goto();

    // Click to trigger array-based calculation (RunArraySum event)
    await app.clickArray();

    // Immediately should show Calculating...
    await expect(app.outputArray).toHaveText(/Calculating\.\.\./, { timeout: 2000 });

    // Wait for the final result text to appear (array creation and reduce may take time)
    await expect(app.outputArray).toHaveText(/Result:\s*\d+/, { timeout: 20000 });

    const arrayText = await app.getArrayText();
    expect(arrayText).toContain('Result:');
    expect(arrayText).toContain('Memory used: Array of length 1000000 created.');
    expect(arrayText).toContain('(Space Complexity: O(n))');

    // Verify numeric correctness for sum 1..1e6
    const n1 = 1000000;
    const expected1 = (n * (n + 1)) / 2;
    expect(arrayText).toContain(String(expected));
  }, 60000); // arraySum can be more heavy; increase timeout

  test('Edge case: rapid repeated clicks on arraySum should not cause uncaught exceptions and final state remains valid', async ({ page }) => {
    // This test attempts to reproduce potential race or memory issues by clicking multiple times rapidly.
    // It asserts that no uncaught exceptions occur and final output contains expected result/message.
    const app3 = new SpaceComplexityPage(page);
    await app.goto();

    // Rapidly trigger the array-based calculation multiple times.
    // Do not await intermediate results — this simulates quick repeated user interaction.
    await Promise.all([
      app.clickArray(),
      app.clickArray(),
      app.clickArray(),
      app.clickArray()
    ]);

    // Expect at least one "Calculating..." appearance quickly.
    await expect(app.outputArray).toHaveText(/Calculating\.\.\./, { timeout: 3000 });

    // Eventually expect a valid final result (the implementation will overwrite outputs).
    await expect(app.outputArray).toHaveText(/Result:\s*\d+/, { timeout: 60000 });

    const finalText = await app.getArrayText();
    expect(finalText).toContain('Memory used: Array of length 1000000 created.');
    const n2 = 1000000;
    const expected2 = (n * (n + 1)) / 2;
    expect(finalText).toContain(String(expected));
  }, 120000);

  test('Validation of FSM expected observables: both onEnter "Calculating..." and onExit result messages for both flows', async ({ page }) => {
    // This combined test validates the FSM's declared observables for both transitions.
    const app4 = new SpaceComplexityPage(page);
    await app.goto();

    // Iterative path observables
    await app.clickIterative();
    await expect(app.outputIterative).toHaveText(/Calculating\.\.\./, { timeout: 2000 });
    await expect(app.outputIterative).toHaveText(/Result:\s*\d+/, { timeout: 10000 });
    const itText = await app.getIterativeText();
    expect(itText).toContain('(Space Complexity: O(1))');

    // Array path observables
    await app.clickArray();
    await expect(app.outputArray).toHaveText(/Calculating\.\.\./, { timeout: 2000 });
    await expect(app.outputArray).toHaveText(/Result:\s*\d+/, { timeout: 20000 });
    const arrText = await app.getArrayText();
    expect(arrText).toContain('(Space Complexity: O(n))');
  }, 60000);
});