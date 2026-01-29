import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1acb0-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the B-Tree demo page
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    this.page.on('pageerror', (err) => {
      // pageerror is an Error object (unhandled exceptions)
      this.pageErrors.push(err);
    });
  }

  // Navigate to the application
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Start the demonstration by clicking the button
  async startDemonstration() {
    await this.page.click('#demoButton');
  }

  // Return the count of step paragraphs currently rendered in #demoOutput
  async getStepCount() {
    return await this.page.locator('#demoOutput p').count();
  }

  // Return the array of texts for steps
  async getStepsText() {
    const count = await this.getStepCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.page.locator('#demoOutput p').nth(i).innerText());
    }
    return texts;
  }

  // Wait until at least `n` steps are present (with a timeout)
  async waitForSteps(n, timeout = 15000) {
    await this.page.waitForFunction(
      (n) => document.querySelectorAll('#demoOutput p').length >= n,
      n,
      { timeout }
    );
  }
}

test.describe('B-Tree FSM: Idle -> Demonstrating', () => {
  // Basic smoke test for initial Idle state
  test('Initial Idle state renders Start Demonstration button and empty output', async ({ page }) => {
    // Create page object which also collects console & page errors
    const bpage = new BTreePage(page);
    // Navigate to the app
    await bpage.goto();

    // Validate that the Start Demonstration button exists and has expected text
    const button = page.locator('#demoButton');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Start Demonstration');

    // Validate that demoOutput exists and is initially empty (no <p> steps)
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();
    const initialStepCount = await bpage.getStepCount();
    expect(initialStepCount).toBe(0);

    // Verify that no uncaught page errors were emitted during initial render
    // (we capture pageErrors in the page object)
    expect(bpage.pageErrors.length).toBe(0);

    // Verify no console error messages like ReferenceError/SyntaxError/TypeError were produced
    const consoleErrors = bpage.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate the primary transition: clicking the button starts the demonstration
  test('Clicking Start Demonstration transitions to Demonstrating and displays steps over time', async ({ page }) => {
    const bpage = new BTreePage(page);
    await bpage.goto();

    // Start the demonstration
    // This is the FSM event "StartDemonstration" triggered by click on #demoButton
    await bpage.startDemonstration();

    // After click, the script appends step <p> elements at 1.5s intervals.
    // Wait for at least the first step to appear.
    await page.waitForSelector('#demoOutput p', { timeout: 5000 });
    let countAfterFirst = await bpage.getStepCount();
    expect(countAfterFirst).toBeGreaterThanOrEqual(1);

    // Validate the text content of the first step contains the expected phrase
    const firstStepText = await page.locator('#demoOutput p').first().innerText();
    expect(firstStepText).toContain('Starting with an empty B-Tree');

    // Wait for a few more steps to be appended to ensure the interval is running
    // Wait until at least 3 steps are present (should be within ~3s)
    await bpage.waitForSteps(3, 10000);
    const countAfterThree = await bpage.getStepCount();
    expect(countAfterThree).toBeGreaterThanOrEqual(3);

    // Validate that subsequent step content matches expected insertion steps
    const steps = await bpage.getStepsText();
    // At least one of the steps should mention "Inserting 10" or "Inserting 20"
    const foundInsertion = steps.some(s => s.includes('Inserting 10') || s.includes('Inserting 20'));
    expect(foundInsertion).toBeTruthy();

    // Ensure no uncaught page errors occurred during the demo initiation
    expect(bpage.pageErrors.length).toBe(0);
    // Ensure no console error messages were emitted while demo running
    const consoleErrors = bpage.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test clicking multiple times (edge-case) and ensure no runtime errors occur
  test('Multiple rapid clicks do not throw runtime exceptions and continue displaying steps', async ({ page }) => {
    const bpage = new BTreePage(page);
    await bpage.goto();

    // Rapidly click the demo button twice to create multiple intervals (edge case)
    await bpage.startDemonstration();
    await bpage.startDemonstration();

    // Wait for at least 4 steps to ensure multiple intervals don't block progression
    await bpage.waitForSteps(4, 12000);
    const steps = await bpage.getStepsText();
    expect(steps.length).toBeGreaterThanOrEqual(4);

    // Ensure all rendered steps have the "Step" prefix as inserted by the script
    for (const stepText of steps) {
      expect(stepText).toMatch(/^Step \d+:/);
    }

    // Validate no page errors were recorded
    expect(bpage.pageErrors.length).toBe(0);

    // Validate no console error messages (type 'error') were emitted
    const consoleErrors = bpage.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});

test.describe('Edge cases and error observations', () => {
  test('Attempting to interact with a non-existent element throws an actionable Playwright error', async ({ page }) => {
    const bpage = new BTreePage(page);
    await bpage.goto();

    // This is intentionally trying to interact with a missing element to assert the framework surface of errors.
    // We expect Playwright to reject the click promise because the selector does not match any element.
    await expect(page.click('#nonExistentButton')).rejects.toThrow();

    // Ensure that this user interaction attempt did not create uncaught errors inside the page itself
    expect(bpage.pageErrors.length).toBe(0);
  });

  test('Observe console and runtime errors if any appear naturally (assert none for this implementation)', async ({ page }) => {
    const bpage = new BTreePage(page);
    await bpage.goto();

    // Start demo to exercise scripts that could surface issues
    await bpage.startDemonstration();

    // Wait for at least one step to ensure script executed
    await page.waitForSelector('#demoOutput p', { timeout: 6000 });

    // Collect any page errors encountered
    // The FSM/implementation provided contains inline script; we assert that it executed without throwing
    // We do not patch or modify runtime - we only observe and assert.
    expect(bpage.pageErrors.length).toBe(0);

    // Inspect console messages for severe runtime errors (like ReferenceError, SyntaxError, TypeError).
    const severeErrors = bpage.consoleMessages.filter(m => m.type === 'error' &&
      /ReferenceError|SyntaxError|TypeError/.test(m.text));
    // For this provided implementation, none of these errors are expected; assert zero occurrences.
    expect(severeErrors.length).toBe(0);
  });
});