import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83b4611-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemo');
    this.output = page.locator('#demoOutput');
  }

  // Wait for the page's main interactive elements to be visible
  async waitForReady() {
    await expect(this.runButton).toBeVisible();
    await expect(this.output).toBeVisible();
  }

  // Click the demo button once
  async clickRun() {
    await this.runButton.click();
  }

  // Click the demo button multiple times in rapid succession
  async clickRunMultiple(times = 3) {
    for (let i = 0; i < times; i++) {
      await this.runButton.click();
    }
  }

  // Get the current output textContent
  async getOutputText() {
    return await this.output.textContent();
  }

  // Build the expected output text from the deterministic example in the page script
  buildExpectedOutput() {
    // These are the deterministic values from the worked example
    const x = [1.0, 2.0];
    const z1 = [-0.3, 1.1];
    const a1 = [Math.max(0, z1[0]), Math.max(0, z1[1])];
    const z2 = -1.27;
    const yhat = z2;

    const fmt = v => (Math.round(v * 1000) / 1000).toFixed(3);

    let text = '';
    text += 'Input x: [' + x.map(fmt).join(', ') + ']\n\n';
    text += 'Hidden pre-activations z1:\n';
    text += '  z1[0] = ' + fmt(z1[0]) + '\n';
    text += '  z1[1] = ' + fmt(z1[1]) + '\n\n';
    text += 'Hidden activations a1 (ReLU):\n';
    text += '  a1[0] = ' + fmt(a1[0]) + '\n';
    text += '  a1[1] = ' + fmt(a1[1]) + '\n\n';
    text += 'Output pre-activation z2:\n';
    text += '  z2 = ' + fmt(z2) + '\n\n';
    text += 'Output y_hat (identity):\n';
    text += '  y_hat = ' + fmt(yhat) + '\n';

    return text;
  }
}

test.describe('FSM validation for d83b4611-fa7b-11f0-b314-ad8654ee5de8 (Neural Networks demo)', () => {
  // We will capture console messages and page errors for each test run to validate that no runtime errors occur.
  test.beforeEach(async ({ page }) => {
    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test('S0_Idle: Initial render shows the "Run forward pass demo" button and initial output text', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry action renderPage().
    // It asserts the presence of the button and that the output placeholder text matches the FSM evidence.
    const demo = new DemoPage(page);

    // Ensure interactive elements are present
    await demo.waitForReady();

    // Validate the button exists and has the expected label text
    await expect(demo.runButton).toHaveText('Run forward pass demo');

    // Validate the initial output text matches the textual evidence from the FSM
    const initialOutput = await demo.getOutputText();
    await expect(initialOutput).toBe('Output will appear here after clicking the button.');
  });

  test('RunDemoClick transition: clicking the button triggers forward pass (S1_DemoRunning) and updates output correctly', async ({ page }) => {
    // This test validates the transition triggered by the RunDemoClick event.
    // It asserts that computeForwardPass() (the S1 entry action) runs and produces the deterministic formatted output.
    const demo = new DemoPage(page);

    // Capture console errors and page errors that might occur during the click/compute
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    await demo.waitForReady();

    // Click the demo button to trigger the forward pass
    await demo.clickRun();

    // Wait for the output to update from the placeholder to the computed text
    const expected = demo.buildExpectedOutput();

    // Retry waiting for the expected text to appear (the script updates synchronously but this ensures stability)
    await expect(demo.output).toHaveText(expected, { timeout: 2000 });

    // Verify the output exactly matches the deterministic formatted forward pass
    const outputText = await demo.getOutputText();
    expect(outputText).toBe(expected);

    // Assert that there were no console "error" messages or page errors during the computation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1_DemoRunning idempotency and robustness: multiple rapid clicks produce stable, identical outputs and no runtime errors', async ({ page }) => {
    // This test validates edge cases: rapid repeated RunDemoClick events and idempotency of the result.
    // It also monitors console and page errors when the button is clicked multiple times quickly.
    const demo = new DemoPage(page);

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    await demo.waitForReady();

    // Perform multiple rapid clicks (simulate a user mashing the button)
    await demo.clickRunMultiple(5);

    // The output should be equal to the deterministic computed output (unchanged across clicks)
    const expected = demo.buildExpectedOutput();
    await expect(demo.output).toHaveText(expected, { timeout: 2000 });

    // Validate final output equality
    const finalText = await demo.getOutputText();
    expect(finalText).toBe(expected);

    // Confirm no runtime errors occurred as a result of rapid clicks
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM evidence validation: button click listener exists implicitly (click causes side-effect), and S0->S1 transition observable', async ({ page }) => {
    // This test verifies the presence of the event handler indirectly:
    // - before clicking, output shows the idle evidence string;
    // - after clicking, output changes to computed evidence string.
    // This demonstrates the transition from S0_Idle to S1_DemoRunning as described in the FSM.
    const demo = new DemoPage(page);

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await demo.waitForReady();

    // Confirm initial evidence text
    const before = await demo.getOutputText();
    expect(before).toBe('Output will appear here after clicking the button.');

    // Click the run button to trigger transition
    await demo.clickRun();

    // After click, confirm evidence of S1 (demo output)
    const expected = demo.buildExpectedOutput();
    await expect(demo.output).toHaveText(expected, { timeout: 2000 });

    // Assert no page-level exceptions happened during this transition
    expect(pageErrors.length).toBe(0);
  });

  test('Negative/Edge scenario: ensure clicking does not throw (no uncaught exceptions) and output remains DOM text (not HTML)', async ({ page }) => {
    // This test asserts that the demo's output is set via textContent (no injected HTML), and that no uncaught exceptions occur.
    const demo = new DemoPage(page);

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await demo.waitForReady();

    // Click the demo button
    await demo.clickRun();

    // Confirm no uncaught exceptions occurred
    expect(pageErrors.length).toBe(0);

    // Confirm the demo output element contains plain text (textContent equals innerText here)
    const textContent = await demo.getOutputText();
    const innerText = await page.locator('#demoOutput').innerText();
    expect(textContent).toBe(innerText);

    // Ensure that the output is not empty and contains the expected y_hat line
    expect(textContent).toContain('y_hat = -1.270');
  });
});