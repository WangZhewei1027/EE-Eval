import { test, expect } from '@playwright/test';

// Test file for Application ID: 25c96651-fa7c-11f0-ba20-415c525382ea
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/25c96651-fa7c-11f0-ba20-415c525382ea.html
// Filename requirement: 25c96651-fa7c-11f0-ba20-415c525382ea.spec.js

// Page Object Model for the Min Heap demo page
class HeapDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c96651-fa7c-11f0-ba20-415c525382ea.html';
    this.buttonSelector = '#demoButton';
    this.outputSelector = '#demoOutput';
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async waitForLoad() {
    await Promise.all([
      this.page.waitForSelector(this.buttonSelector, { state: 'visible' }),
      this.page.waitForSelector(this.outputSelector, { state: 'attached' })
    ]);
  }

  async demoButton() {
    return this.page.locator(this.buttonSelector);
  }

  async demoOutput() {
    return this.page.locator(this.outputSelector);
  }

  async clickDemo() {
    await (await this.demoButton()).click();
  }

  async getOutputText() {
    // use textContent to preserve formatting/newlines as the page sets textContent
    return await this.page.locator(this.outputSelector).evaluate((el) => el.textContent || '');
  }
}

test.describe('Understanding Min Heap - FSM and UI tests', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      const type = msg.type(); // log, error, warning, info, etc.
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Capture uncaught exceptions and other page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No special teardown needed; Playwright closes pages automatically
  });

  test.describe('FSM States: Idle and Demo Running', () => {
    test('Idle state: page renders and shows the demo button and empty output (entry action renderPage())', async ({ page }) => {
      // This test validates the S0_Idle state as defined in the FSM:
      // - The page should render and expose the demo button (#demoButton)
      // - The demo output (#demoOutput) should be present and initially empty
      const heapPage = new HeapDemoPage(page);
      await heapPage.goto();
      await heapPage.waitForLoad();

      const demoButton = await heapPage.demoButton();
      await expect(demoButton).toBeVisible();
      await expect(demoButton).toHaveAttribute('aria-label', 'Run heap insertion demonstration');
      await expect(demoButton).toHaveText('Show Min Heap Insertions');

      const output = await heapPage.demoOutput();
      await expect(output).toBeVisible();

      const text = await heapPage.getOutputText();
      // Initially the demo output should be empty (no demo has run yet)
      expect(text.trim()).toBe('', 'Expected demo output to be empty on initial render (Idle state).');

      // Also verify aria-live attribute is present for the demo output (accessibility)
      await expect(output).toHaveAttribute('aria-live', 'polite');
    });

    test('Transition: clicking the demo button runs the heap insertion demo and updates output (S0 -> S1)', async ({ page }) => {
      // This test validates the ShowMinHeapInsertions event and the S1_DemoRunning state:
      // - Clicking #demoButton triggers the demo
      // - The output updates with the expected sequence after each insertion
      const heapPage = new HeapDemoPage(page);
      await heapPage.goto();
      await heapPage.waitForLoad();

      // Click the demo button to trigger the transition S0_Idle -> S1_DemoRunning
      await heapPage.clickDemo();

      // After clicking, the demoOutput should contain the insertion trace.
      // The implementation performs a deterministic sequence of insertions:
      // insertions = [20, 15, 30, 5, 10, 40, 3]
      // Expected intermediate arrays (as strings) after each insertion:
      const expectedLines = [
        'After inserting 20: [20]',
        'After inserting 15: [15, 20]',
        'After inserting 30: [15, 20, 30]',
        'After inserting 5: [5, 15, 30, 20]',
        'After inserting 10: [5, 10, 30, 20, 15]',
        'After inserting 40: [5, 10, 30, 20, 15, 40]',
        'After inserting 3: [3, 10, 5, 20, 15, 40, 30]'
      ];

      // Wait for output to be updated and then get content
      await page.waitForTimeout(100); // small wait to let the click handler finish writing the output
      const content = await heapPage.getOutputText();

      // Ensure the final content contains each expected line in order
      let lastIndex = -1;
      for (const line of expectedLines) {
        const idx = content.indexOf(line);
        expect(idx).toBeGreaterThan(-1, `Expected output to contain line: "${line}"`);
        // Ensure ordering: each next line must appear after previous
        expect(idx).toBeGreaterThan(lastIndex, `Expected line "${line}" to appear after previous lines.`);
        lastIndex = idx;
      }

      // Also verify the final explanatory sentence is present
      expect(content).toContain('Observe how the smallest element always moves towards the front (root) to maintain the min heap property.');

      // Clicking the button demonstrates that the event listener documented in the FSM is present and invoked.
    });

    test('Edge case: multiple clicks re-run the demo and do not append cumulatively (idempotent run)', async ({ page }) => {
      // This test validates behavior under repeated event triggers:
      // Clicking the demo button multiple times should re-generate the same output (since implementation replaces output.textContent)
      const heapPage = new HeapDemoPage(page);
      await heapPage.goto();
      await heapPage.waitForLoad();

      // First run
      await heapPage.clickDemo();
      await page.waitForTimeout(100);
      const firstRun = await heapPage.getOutputText();

      // Second run: should replace the output with the same content (not append)
      await heapPage.clickDemo();
      await page.waitForTimeout(100);
      const secondRun = await heapPage.getOutputText();

      expect(secondRun).toBe(firstRun, 'Expected repeated demo runs to produce identical output (no cumulative appending).');

      // As a sanity check, ensure the output contains the initial insertion line and final heap state
      expect(secondRun).toContain('After inserting 20: [20]');
      expect(secondRun).toContain('After inserting 3: [3, 10, 5, 20, 15, 40, 30]');
    });
  });

  test.describe('Console and Error Observability', () => {
    test('Page should not emit console.error or uncaught page exceptions during a normal demo run', async ({ page }) => {
      // This test observes console messages and page errors while interacting with the app
      const heapPage = new HeapDemoPage(page);
      await heapPage.goto();
      await heapPage.waitForLoad();

      // Run the demo to surface any potential runtime issues
      await heapPage.clickDemo();

      // Allow some time for console messages or page errors to be emitted
      await page.waitForTimeout(200);

      // Gather console messages captured in beforeEach hook
      // We expect no console errors and no page errors for this well-formed demo
      // However, the test asserts the actual observed arrays (zero-length expected here)
      // If any errors do exist they will cause the test to fail and will be included in test output.
      // This adheres to the testing instruction to observe and assert actual console/page errors.

      // Inspect the captured console messages for 'error' types
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');

      expect(errorConsoleMessages.length).toBe(0, `Expected no console.error messages, found: ${JSON.stringify(errorConsoleMessages, null, 2)}`);
      expect(pageErrors.length).toBe(0, `Expected no uncaught page errors, found: ${pageErrors.map(e => String(e)).join('; ')}`);
    });

    test('Record any console.warn or console.log entries for debugging visibility', async ({ page }) => {
      // This test primarily demonstrates that console messages are being observed.
      // It does not fail on logs or warnings, but it asserts that logs or warnings (if any) are accessible.
      const heapPage = new HeapDemoPage(page);
      await heapPage.goto();
      await heapPage.waitForLoad();

      // Trigger the demo
      await heapPage.clickDemo();
      await page.waitForTimeout(100);

      // We expect to capture at least the normal console logs (if the page logged anything).
      // Since the demo may not log, this assertion is tolerant: we simply assert the capture mechanism works.
      // If there are any console messages captured, verify they have the expected structure.
      for (const msg of consoleMessages) {
        expect(msg).toHaveProperty('type');
        expect(msg).toHaveProperty('text');
      }
    });
  });

  test.describe('Behavioral and Accessibility Assertions', () => {
    test('Accessibility: demo button has descriptive aria-label and demo output uses aria-live for polite updates', async ({ page }) => {
      // Validate accessibility-related attributes that map to the FSM component descriptions
      const heapPage = new HeapDemoPage(page);
      await heapPage.goto();
      await heapPage.waitForLoad();

      const button = await heapPage.demoButton();
      await expect(button).toHaveAttribute('aria-label', 'Run heap insertion demonstration');

      const output = await heapPage.demoOutput();
      await expect(output).toHaveAttribute('aria-live', 'polite');
    });

    test('Behavioral: clicking demo button demonstrates heapifyUp correctness via expected array states', async ({ page }) => {
      // Another verification focusing on correctness of heapifyUp numeric results as rendered
      const heapPage = new HeapDemoPage(page);
      await heapPage.goto();
      await heapPage.waitForLoad();

      await heapPage.clickDemo();
      await page.waitForTimeout(100);
      const content = await heapPage.getOutputText();

      // Quick sanity checks: root should be smallest after all insertions
      // The final array in the output should include the prefix "After inserting 3:" followed by the final array
      const finalMarker = 'After inserting 3:';
      const idx = content.indexOf(finalMarker);
      expect(idx).toBeGreaterThan(-1, `Expected output to contain a final marker "${finalMarker}".`);

      // Extract the array substring for the final state if possible, and assert the leading element is '3'
      const finalLineMatch = content.match(/After inserting 3:\s*(\[[^\]]+\])/);
      if (finalLineMatch) {
        const finalArrayText = finalLineMatch[1]; // e.g. "[3, 10, 5, 20, 15, 40, 30]"
        expect(finalArrayText.startsWith('[3')).toBeTruthy();
      } else {
        // If parsing failed, still ensure the textual final state mentions the expected root value '3'
        expect(content).toContain('[3');
      }
    });
  });
});