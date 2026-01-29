import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b40d61-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Static Typing Demonstration (FSM) - 63b40d61-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  // Containers for console and page errors observed during each test run
  let consoleErrors = [];
  let pageErrors = [];

  // Page object pattern encapsulating common interactions and queries
  class StaticTypingPage {
    constructor(page) {
      this.page = page;
      this.button = page.locator('button[onclick="runTypeCheck()"]');
      this.output = page.locator('#output');
    }

    async goto() {
      await this.page.goto(APP_URL, { waitUntil: 'load' });
    }

    async clickRunButton() {
      await this.button.click();
    }

    async getButtonText() {
      return this.button.textContent();
    }

    async getButtonOnClickAttr() {
      return this.button.getAttribute('onclick');
    }

    async getOutputText() {
      // Evaluate textContent directly to preserve newlines exactly
      return this.page.locator('#output').evaluate((el) => el.textContent || '');
    }

    async runTypeCheckTypeOnWindow() {
      return this.page.evaluate(() => typeof runTypeCheck);
    }

    async renderPageTypeOnWindow() {
      return this.page.evaluate(() => typeof renderPage);
    }

    async outputHasClass(cls) {
      return this.output.evaluate((el, cls) => el.classList.contains(cls), cls);
    }
  }

  // Setup listeners and navigate to the app before each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error' (e.g., runtime exceptions logged to console)
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location(),
          });
        }
      } catch (e) {
        // If introspecting the message throws, record a generic entry
        consoleErrors.push({ text: 'console inspection failed', detail: String(e) });
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    const sut = new StaticTypingPage(page);
    await sut.goto();
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach a summary of console/page errors to the test output for diagnostics if any occurred.
    if (consoleErrors.length || pageErrors.length) {
      testInfo.attachments = testInfo.attachments || [];
      testInfo.attachments.push({
        name: 'console-and-page-errors',
        body: JSON.stringify({ consoleErrors, pageErrors }, null, 2),
        contentType: 'application/json',
      });
    }
  });

  test.describe('State S0_Idle (Initial rendering) - expectations and invariants', () => {
    test('Initial Idle state: button is present, has correct attributes, and output is empty', async ({ page }) => {
      // This test validates the S0_Idle entry state as described by the FSM:
      // - The "Run Static Type Check Simulation" button should be rendered.
      // - The output div should be present but empty initially.
      // - The page should not have thrown runtime errors during load.
      const sut = new StaticTypingPage(page);

      // Button should be visible and have the expected label
      await expect(sut.button).toBeVisible();
      const buttonText = (await sut.getButtonText())?.trim();
      expect(buttonText).toBe('Run Static Type Check Simulation');

      // The button should have the inline onclick attribute that triggers runTypeCheck()
      const onclickAttr = await sut.getButtonOnClickAttr();
      expect(onclickAttr).toBe('runTypeCheck()');

      // The output element should exist and be empty on initial load
      const initialOutputText = await sut.getOutputText();
      expect(initialOutputText).toBe('', 'Expected output to be empty on initial load (Idle state)');

      // The output element should have the "output" class as per implementation
      const hasOutputClass = await sut.outputHasClass('output');
      expect(hasOutputClass).toBe(true);

      // Verify the runTypeCheck function is present on the window (the page defines it)
      const runTypeCheckType = await sut.runTypeCheckTypeOnWindow();
      expect(runTypeCheckType).toBe('function');

      // The FSM initial state's entry_actions referenced a `renderPage()` function.
      // The HTML implementation does not provide renderPage; verify that it is undefined.
      const renderPageType = await sut.renderPageTypeOnWindow();
      expect(renderPageType).toBe('undefined');

      // Ensure there were no console errors or uncaught page errors during load
      expect(consoleErrors.length, 'No console.error messages expected on load').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors expected on load').toBe(0);
    });
  });

  test.describe('Transition RunTypeCheck -> S1_Checking (user event and output)', () => {
    test('Clicking the Run button transitions to Checking and populates output with expected results', async ({ page }) => {
      // This test validates the RunTypeCheck event and the transition to S1_Checking:
      // - Clicking the button should invoke runTypeCheck().
      // - The output should contain four lines representing checks (2 OK, 2 Error).
      // - The output content should exactly match the expected joined-lines string.

      const sut = new StaticTypingPage(page);

      // Prepare expected output exactly as the implementation produces it
      const expectedLines = [
        'Variable "name" has correct type "string".',
        'Variable "age" has correct type "number".',
        'Error: Variable "name" expected to be type "string" but got "number".',
        'Error: Variable "age" expected to be type "number" but got "string".',
      ];
      const expectedOutput = expectedLines.join('\n');

      // Trigger the transition by clicking the button
      await sut.clickRunButton();

      // Wait for the output to be non-empty and then assert exact content
      await expect(sut.output).not.toBeEmpty({ timeout: 2000 });
      const actualOutput = await sut.getOutputText();
      expect(actualOutput).toBe(expectedOutput);

      // Ensure the output contains the expected number of newline separators (3 newlines for 4 lines)
      const newlineCount = (actualOutput.match(/\n/g) || []).length;
      expect(newlineCount).toBe(3);

      // No runtime errors should have occurred during the run (if the implementation is correct)
      expect(consoleErrors.length, 'No console.error messages expected during runTypeCheck execution').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors expected during runTypeCheck execution').toBe(0);
    });

    test('Repeated and rapid clicks do not produce duplicated or accumulating output beyond the expected run', async ({ page }) => {
      // Edge case: clicking the button multiple times quickly should not append indefinitely
      // because the implementation clears output.textContent at the start of runTypeCheck().
      const sut = new StaticTypingPage(page);

      const expectedLines = [
        'Variable "name" has correct type "string".',
        'Variable "age" has correct type "number".',
        'Error: Variable "name" expected to be type "string" but got "number".',
        'Error: Variable "age" expected to be type "number" but got "string".',
      ];
      const expectedOutput = expectedLines.join('\n');

      // Perform rapid clicks
      await Promise.all([
        sut.clickRunButton(),
        sut.clickRunButton(),
        sut.clickRunButton(),
      ]);

      // Wait for output and verify that it matches the expected exactly (no duplicates)
      await expect(sut.output).not.toBeEmpty({ timeout: 2000 });
      const afterRapidClicks = await sut.getOutputText();
      expect(afterRapidClicks).toBe(expectedOutput);

      // Click again after a short pause to ensure output is cleared and re-populated identically
      await page.waitForTimeout(100);
      await sut.clickRunButton();
      const afterSecondRun = await sut.getOutputText();
      expect(afterSecondRun).toBe(expectedOutput);

      // Confirm still no console or page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Verifies the DOM update string is created using join (evidence of tests.join("\\n"))', async ({ page }) => {
      // The FSM evidence shows output.textContent = tests.join("\n");
      // We validate that the output contains newline separators as a single joined string rather than e.g. multiple appended nodes.
      const sut = new StaticTypingPage(page);

      await sut.clickRunButton();
      const outputText = await sut.getOutputText();

      // Check for the presence of the exact joined newline pattern between the expected lines.
      expect(outputText.includes('\n')).toBe(true);
      const parts = outputText.split('\n');
      expect(parts.length).toBe(4);

      // Validate the order of the parts reflects the tests array order (correct -> correct -> error -> error)
      expect(parts[0]).toContain('has correct type "string"');
      expect(parts[1]).toContain('has correct type "number"');
      expect(parts[2]).toContain('expected to be type "string" but got "number"');
      expect(parts[3]).toContain('expected to be type "number" but got "string"');

      // Still no runtime errors expected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and FSM action verification', () => {
    test('Confirm whether missing FSM entry action renderPage() exists and report errors if any runtime exceptions occurred', async ({ page }) => {
      // This test explicitly checks for the presence of the FSM-declared entry action `renderPage()`.
      // Per the instructions, we must observe console logs and page errors and let any runtime exceptions happen naturally.
      const sut = new StaticTypingPage(page);

      // Verify renderPage is not defined on the page (the HTML does not implement it)
      const renderPageType = await sut.renderPageTypeOnWindow();
      expect(renderPageType).toBe('undefined');

      // Confirm runTypeCheck is defined and callable (without invoking it here)
      const runTypeCheckType = await sut.runTypeCheckTypeOnWindow();
      expect(runTypeCheckType).toBe('function');

      // If any console or page errors occurred (e.g., due to missing calls to renderPage if it had been invoked),
      // they are captured in consoleErrors and pageErrors. We assert their counts to be zero for this implementation.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});