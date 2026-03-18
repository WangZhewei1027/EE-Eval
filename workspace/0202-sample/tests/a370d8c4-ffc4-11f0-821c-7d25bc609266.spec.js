import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370d8c4-ffc4-11f0-821c-7d25bc609266.html';

/**
 * Page Object for the Counting Sort demo page.
 * Encapsulates common interactions and element locators.
 */
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async getOutputText() {
    // Return raw textContent (preserve newlines)
    return this.page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      return el ? el.textContent : null;
    });
  }

  async isRunButtonVisible() {
    return this.runBtn.isVisible();
  }

  async getRunButtonText() {
    return this.runBtn.innerText();
  }

  async getOutputAriaLive() {
    return this.output.getAttribute('aria-live');
  }
}

test.describe('Counting Sort Demo - FSM states and transitions', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test('S0_Idle: initial render shows Run button and empty demo output', async ({ page }) => {
    const demo = new CountingSortPage(page);
    // Load the page exactly as-is (do not modify the environment)
    await demo.goto();

    // Validate that the Run button exists and has the expected text (evidence for S0_Idle)
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toHaveText('Run Counting Sort Demo');

    // Validate demoOutput element exists and starts empty (S0_Idle evidence)
    const initialText = await demo.getOutputText();
    // Trim to avoid failing on incidental whitespace
    expect(initialText !== null).toBeTruthy();
    expect(initialText.trim()).toBe('');

    // Check ARIA attribute as per components evidence
    const ariaLive = await demo.getOutputAriaLive();
    expect(ariaLive).toBe('polite');

    // Assert there were no page errors and no console.error messages on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S0 -> S1 (RunDemo): clicking Run shows running message immediately', async ({ page }) => {
    const demo = new CountingSortPage(page);
    await demo.goto();

    // Click the Run button (triggers the RunDemo event/transition)
    await demo.clickRun();

    // Immediately after click, the script sets the running message synchronously.
    // Validate S1_DemoRunning entry action evidence: 'Running Counting Sort demonstration...'
    await expect(demo.output).toContainText('Running Counting Sort demonstration...');

    // Validate that the visual indicator (text content) includes the expected phrase
    const midText = await demo.getOutputText();
    expect(midText).toContain('Running Counting Sort demonstration...');

    // Confirm no runtime errors observed so far
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1 -> S2 (DemoCompleted): after simulated demo completes, sorted output is shown', async ({ page }) => {
    const demo = new CountingSortPage(page);
    await demo.goto();

    // Run the demo
    await demo.clickRun();

    // Wait for the final output to appear. The page uses setTimeout 250ms before writing the demo result.
    // We'll wait for an element text that contains 'Sorted output array:' which denotes S2_DemoCompleted.
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Sorted output array:');
    }, { timeout: 3000 });

    // Validate the output includes the expected sorted array and step headings (S2_DemoCompleted evidence)
    const finalText = await demo.getOutputText();
    expect(finalText).toContain('Sorted output array:');
    expect(finalText).toContain('[1, 2, 2, 3, 3, 4, 8]');

    // Also check for some intermediate steps present in the final output (sanity)
    expect(finalText).toContain('Original array:');
    expect(finalText).toContain('Step 1: Initialize count array');
    expect(finalText).toContain('Step 4: Place elements into output array');

    // Confirm no runtime errors were emitted during demo completion
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking Run multiple times while demo is running should still produce a valid final output and not throw errors', async ({ page }) => {
    const demo = new CountingSortPage(page);
    await demo.goto();

    // Click first time
    await demo.clickRun();

    // Shortly after, click again while first run is in progress to simulate user double-clicking
    await page.waitForTimeout(100);
    await demo.clickRun();

    // Wait for final output to appear after the last click
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Sorted output array:');
    }, { timeout: 4000 });

    const finalText = await demo.getOutputText();

    // Final result should still be the correct sorted output
    expect(finalText).toContain('Sorted output array:');
    expect(finalText).toContain('[1, 2, 2, 3, 3, 4, 8]');

    // Ensure the output doesn't contain obvious corruption (e.g., "undefined" or "NaN")
    expect(finalText).not.toContain('undefined');
    expect(finalText).not.toContain('NaN');

    // Observe console and page errors - assert none occurred
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Behavioral assertions and FSM evidence: validate onEnter/onExit observable effects where possible', async ({ page }) => {
    const demo = new CountingSortPage(page);
    await demo.goto();

    // S0 onEnter: renderPage() - we can only verify the evidence (button exists + title present)
    await expect(page.locator('h1')).toContainText('Counting Sort: A Thorough Explanation and Educational Guide');
    await expect(demo.runBtn).toBeVisible();

    // Trigger transition S0 -> S1
    await demo.clickRun();

    // Validate S1 entry action displayDemoOutput(): presence of "Running Counting Sort demonstration..."
    await expect(demo.output).toContainText('Running Counting Sort demonstration...');

    // Validate that S1 -> S2 on completion triggers showSortedOutput() by waiting for sorted lines
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Sorted output array:');
    }, { timeout: 3000 });

    const finalText = await demo.getOutputText();
    expect(finalText).toContain('Sorted output array:');
    expect(finalText).toContain('[1, 2, 2, 3, 3, 4, 8]');

    // Final check: still no JavaScript runtime errors captured
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.afterEach(async ({}, testInfo) => {
    // If there were any page errors or console errors, fail with diagnostics for easier debugging.
    // We still assert none in each test; here we add extra diagnostics if something slipped through.
    if (pageErrors && pageErrors.length > 0) {
      // Attach pageErrors to the test output for debugging
      testInfo.attachments = testInfo.attachments || [];
      testInfo.attachments.push({
        name: 'page-errors',
        body: pageErrors.join('\n'),
        contentType: 'text/plain'
      });
    }
    if (consoleMessages && consoleMessages.length > 0) {
      const errMsgs = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
      if (errMsgs.length > 0) {
        testInfo.attachments = testInfo.attachments || [];
        testInfo.attachments.push({
          name: 'console-errors',
          body: errMsgs.join('\n'),
          contentType: 'text/plain'
        });
      }
    }
  });
});