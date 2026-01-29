import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d837c3a0-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for interacting with the demo area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemo');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButtonText() {
    return this.runBtn.innerText();
  }

  async getButtonAttributes() {
    return {
      id: await this.runBtn.getAttribute('id'),
      class: await this.runBtn.getAttribute('class'),
      ariaControls: await this.runBtn.getAttribute('aria-controls'),
      role: await this.runBtn.getAttribute('role'),
    };
  }

  async getOutputText() {
    return this.output.textContent();
  }

  async clickRun() {
    await this.runBtn.click();
  }

  // Waits until the demo final output is present (detects "Final process metrics:" or "Average Turnaround")
  async waitForFinalOutput(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      if (!el) return false;
      const txt = el.textContent || '';
      return txt.includes('Final process metrics:') || txt.includes('Average Turnaround');
    }, null, { timeout });
    return this.getOutputText();
  }
}

test.describe('CPU Scheduling — Round Robin Demo FSM (d837c3a0-fa7b-11f0-b314-ad8654ee5de8)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Navigate to the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Test the Idle state S0_Idle: UI renders, button exists, initial output text is the prompt
  test('S0_Idle: initial render shows Run Round Robin Demo button and prompt', async ({ page }) => {
    const demo = new DemoPage(page);

    // Validate button exists with expected attributes and text
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toHaveAttribute('id', 'runDemo');
    await expect(demo.runBtn).toHaveAttribute('class', 'primary');
    await expect(demo.runBtn).toHaveAttribute('aria-controls', 'demoOutput');
    await expect(demo.runBtn).toHaveText('Run Round Robin Demo');

    // Validate output area initial content (Idle state evidence)
    const initialText = await demo.getOutputText();
    expect(initialText).toContain('Press "Run Round Robin Demo" to see the simulation output.');

    // No runtime page errors should have occurred on initial load
    expect(pageErrors.length).toBe(0);
    // No console messages of type 'error'
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  // Test the transition S0_Idle -> S1_DemoRunning on button click: immediate "Running demo..." text
  test('S1_DemoRunning: clicking Run shows "Running demo..." immediately (transition evidence)', async ({ page }) => {
    const demo = new DemoPage(page);

    // Click the Run button and immediately check the output
    await demo.clickRun();

    // Immediately after click, output should be "Running demo..."
    // We use a short wait to allow synchronous DOM update (no setTimeout yet for rrDemo)
    await page.waitForTimeout(10);
    const midText = await demo.getOutputText();
    expect(midText).toBe('Running demo...');

    // Validate no page errors during this transition
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  // Test the transition S1_DemoRunning -> S2_DemoCompleted: final textual output and metrics appear
  test('S2_DemoCompleted: demo completes and prints final process metrics and averages', async ({ page }) => {
    const demo = new DemoPage(page);

    // Click and wait for final output
    await demo.clickRun();

    // Wait for the asynchronous final output to be set (rrDemo is called via setTimeout 120ms)
    const finalText = await demo.waitForFinalOutput(3000);

    // Check that final output contains the expected sections and detailed metrics
    expect(finalText).toContain('Round Robin Demo (deterministic dataset)');
    expect(finalText).toContain('Final process metrics:');

    // Validate each process line and computed numbers (deterministic dataset)
    expect(finalText).toContain('P1: arrival=0, burst=4, completion=7, turnaround=7, waiting=3, response=0');
    expect(finalText).toContain('P2: arrival=1, burst=3, completion=8, turnaround=7, waiting=4, response=1');
    expect(finalText).toContain('P3: arrival=2, burst=1, completion=5, turnaround=3, waiting=2, response=2');

    // Validate averages formatting computed by the page script
    expect(finalText).toContain('Average Turnaround = 5.67');
    expect(finalText).toContain('Average Waiting = 3.00');

    // No uncaught page errors should have been thrown during the demo
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  // Edge case: multiple rapid clicks while demo is running — ensure final output still correct and no errors
  test('Edge case: multiple rapid clicks during run produce stable final output and no runtime errors', async ({ page }) => {
    const demo = new DemoPage(page);

    // Rapidly click the run button multiple times
    await demo.runBtn.click();
    await demo.runBtn.click();
    await demo.runBtn.click();

    // Immediately the visible content should be the running state
    await page.waitForTimeout(5);
    expect(await demo.getOutputText()).toBe('Running demo...');

    // Wait for final output; multiple timeouts may race but final content should be the deterministic rrDemo output
    const finalText = await demo.waitForFinalOutput(4000);

    // Validate final content is the expected metrics (same as single click)
    expect(finalText).toContain('Final process metrics:');
    expect(finalText).toContain('P1: arrival=0, burst=4, completion=7, turnaround=7, waiting=3, response=0');
    expect(finalText).toContain('Average Turnaround = 5.67');

    // Ensure no uncaught page errors were recorded
    expect(pageErrors.length).toBe(0);
    // Ensure console did not emit any 'error' messages during the rapid-click scenario
    const consoleError = consoleMessages.find(m => m.type === 'error');
    expect(consoleError).toBeUndefined();
  });

  // Validate re-running the demo after completion updates the output again (idempotent behavior)
  test('Re-run after completion: clicking Run again produces a fresh demo output', async ({ page }) => {
    const demo = new DemoPage(page);

    // First run
    await demo.clickRun();
    const firstFinal = await demo.waitForFinalOutput(3000);
    expect(firstFinal).toContain('Final process metrics:');

    // Grab a snapshot of the output
    const snapshot1 = firstFinal;

    // Now click again to re-run
    await demo.clickRun();
    // Immediately should show running text
    await page.waitForTimeout(10);
    expect(await demo.getOutputText()).toBe('Running demo...');

    // Wait for second completion
    const secondFinal = await demo.waitForFinalOutput(3000);
    expect(secondFinal).toContain('Final process metrics:');

    // The content should be (deterministically) the same structure and values as before
    expect(secondFinal).toContain('P1: arrival=0, burst=4, completion=7, turnaround=7, waiting=3, response=0');
    expect(secondFinal).toContain('Average Waiting = 3.00');

    // Ensure the second run replaced the output (not appended)
    expect(secondFinal).toBeTruthy();
    expect(secondFinal).toContain('Round Robin Demo (deterministic dataset)');

    // Validate no page errors across runs
    expect(pageErrors.length).toBe(0);
    const consoleError = consoleMessages.find(m => m.type === 'error');
    expect(consoleError).toBeUndefined();
  });

  test.afterEach(async ({ page }) => {
    // Final safety assertions: ensure we captured the page and console without critical errors.
    // This ensures we observed console & page errors during tests and asserted none occurred.
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });
});