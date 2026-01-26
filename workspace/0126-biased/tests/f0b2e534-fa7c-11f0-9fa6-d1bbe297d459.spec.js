import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b2e534-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Greedy Algorithms Interactive Demo (f0b2e534-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Shared variables to capture console and page errors for each test
  let consoleMessages;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    consoleMessages = [];
    consoleErrors = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      consoleErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(BASE_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Basic sanity check that our collectors exist (prevent silent failures)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(consoleErrors)).toBeTruthy();
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('S0_Idle: Page renders with Run Demonstration button and initial instructions', async ({ page }) => {
      // Validate evidence for Idle state: button exists with correct text
      const demoButton = await page.locator('#demo-button');
      await expect(demoButton).toBeVisible();
      await expect(demoButton).toHaveText('Run Demonstration');

      // Validate initial demo-output prompt is present
      const demoOutput = await page.locator('#demo-output');
      await expect(demoOutput).toContainText('Click the button to see the greedy algorithm in action for activity selection.');

      // Verify there were no uncaught page errors during initial load
      expect(consoleErrors.length).toBe(0);

      // Ensure no console.error messages were logged during initial render
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });

    test('S0_Idle: FSM entry action "renderPage()" is not defined on the page (verify absence)', async ({ page }) => {
      // The FSM mentions an entry action renderPage().
      // Verify that the page does not define a global renderPage function.
      const typeOfRenderPage = await page.evaluate(() => typeof window.renderPage);
      expect(typeOfRenderPage).toBe('undefined');

      // Attempt to invoke renderPage() as a global identifier and assert it rejects with a ReferenceError.
      // We call it without catching inside the page to let the error surface as a rejected promise.
      await expect(page.evaluate(() => {
        // Calling an undeclared identifier should throw a ReferenceError in the page context.
        // This promise will reject, which we assert on below.
        // eslint-disable-next-line no-undef
        return renderPage();
      })).rejects.toThrow();
    });
  });

  test.describe('Transition: RunDemonstration (click #demo-button) -> S1_DemonstrationRunning', () => {
    test('S1_DemonstrationRunning: Clicking Run Demonstration updates demo-output with activity selection process', async ({ page }) => {
      const demoOutput = page.locator('#demo-output');
      const demoButton = page.locator('#demo-button');

      // Click the demo button to trigger the inline demonstration logic
      await demoButton.click();

      // After clicking, ensure the demo-output contains expected headings and lists
      await expect(demoOutput.locator('h3')).toHaveText('Activity Selection Process');
      await expect(demoOutput).toContainText('Activities sorted by finish time:');
      await expect(demoOutput).toContainText('Greedy selection steps:');
      await expect(demoOutput).toContainText('Selected activities:');
      await expect(demoOutput).toContainText('Total activities selected:');

      // Validate that sorted activities are listed (sample checks)
      await expect(demoOutput).toContainText('A: 1-4');
      await expect(demoOutput).toContainText('B: 3-5');
      await expect(demoOutput).toContainText('K: 12-16');

      // Verify the greedy selection is correct for the provided dataset:
      // Expected selected activities: A, D, H, K (4 total)
      const selectedText = await demoOutput.evaluate(node => {
        // Find the strong-tagged paragraph that contains "Selected activities:" and return its text node content
        const strong = node.querySelector('strong');
        if (!strong) return '';
        // The strong element text will be "Selected activities:"; return the whole paragraph text
        return strong.parentElement ? strong.parentElement.textContent : strong.textContent;
      });

      expect(selectedText).toContain('Selected activities:');
      expect(selectedText).toContain('A, D, H, K');

      // Verify total count
      await expect(demoOutput).toContainText('Total activities selected: 4');

      // Ensure no uncaught page errors were triggered by running the demonstration
      expect(consoleErrors.length).toBe(0);

      // Ensure there were no console.error messages triggered during the demo (but allow info/debug logs)
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });

    test('Transition robustness: Clicking the Run Demonstration button twice replaces (not duplicates) demo-output and remains stable', async ({ page }) => {
      const demoOutput = page.locator('#demo-output');
      const demoButton = page.locator('#demo-button');

      // First click
      await demoButton.click();
      const firstHtml = await demoOutput.innerHTML();

      // Second click should replace the innerHTML rather than append duplicate content
      await demoButton.click();
      const secondHtml = await demoOutput.innerHTML();

      // The content should be deterministic and equivalent after repeated clicks
      expect(secondHtml).toBe(firstHtml);

      // There should be only one "Selected activities:" occurrence (no duplication)
      const occurrences = (secondHtml.match(/Selected activities:/g) || []).length;
      expect(occurrences).toBe(1);

      // Still no uncaught page errors after repeated invocation
      expect(consoleErrors.length).toBe(0);
    });

    test('FSM exit/onEnter action "runDemonstration()" is not defined as a global function (verify absence and error when invoked)', async ({ page }) => {
      // The FSM mentions runDemonstration() as an entry action for the S1 state.
      // Confirm the page does not define a global runDemonstration function and that direct invocation throws.
      const typeofRun = await page.evaluate(() => typeof window.runDemonstration);
      expect(typeofRun).toBe('undefined');

      // Attempt to invoke runDemonstration() without a try/catch inside the page so that the promise rejects.
      // We expect the promise to be rejected because the identifier is not defined (ReferenceError).
      await expect(page.evaluate(() => {
        // eslint-disable-next-line no-undef
        return runDemonstration();
      })).rejects.toThrow();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Edge: Rapid multiple clicks do not produce uncaught errors and maintain correct selection result', async ({ page }) => {
      const demoOutput = page.locator('#demo-output');
      const demoButton = page.locator('#demo-button');

      // Rapidly click the button several times
      await Promise.all([
        demoButton.click(),
        demoButton.click(),
        demoButton.click()
      ]);

      // After rapid clicks, ensure the selected activities are still deterministic
      await expect(demoOutput).toContainText('Selected activities: A, D, H, K');
      await expect(demoOutput).toContainText('Total activities selected: 4');

      // Validate that no uncaught page errors occurred during rapid interactions
      expect(consoleErrors.length).toBe(0);

      // Validate no console.error messages
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });

    test('Edge: Invoking missing functions via page.evaluate and catching the thrown error (confirm error type)', async ({ page }) => {
      // Explicitly invoke undefined identifier renderPage inside a try/catch in the page context to inspect the thrown error
      const renderPageError = await page.evaluate(() => {
        try {
          // eslint-disable-next-line no-undef
          renderPage();
          return { threw: false };
        } catch (e) {
          return { threw: true, name: e.name, message: e.message };
        }
      });

      expect(renderPageError.threw).toBe(true);
      // In browsers, invoking an undeclared identifier typically throws a ReferenceError
      expect(renderPageError.name).toBeOneOf
        ? expect(renderPageError.name).toBeOneOf(['ReferenceError', 'TypeError'])
        : expect(['ReferenceError', 'TypeError']).toContain(renderPageError.name);

      // Do the same for runDemonstration
      const runDemoError = await page.evaluate(() => {
        try {
          // eslint-disable-next-line no-undef
          runDemonstration();
          return { threw: false };
        } catch (e) {
          return { threw: true, name: e.name, message: e.message };
        }
      });

      expect(runDemoError.threw).toBe(true);
      expect(['ReferenceError', 'TypeError']).toContain(runDemoError.name);
    });

    test('Edge: Ensure DOM evidence from FSM remains present after interactions (button exists, demo-output exists)', async ({ page }) => {
      // Interact once
      await page.locator('#demo-button').click();

      // Ensure the button still exists in the DOM after running the demo
      await expect(page.locator('#demo-button')).toBeVisible();

      // Ensure demo-output exists and contains expected sections
      await expect(page.locator('#demo-output')).toBeVisible();
      await expect(page.locator('#demo-output')).toContainText('Activity Selection Process');
    });
  });

  test.describe('Observability: console and page error reporting', () => {
    test('No unexpected console.error or page errors during full user flow', async ({ page }) => {
      // Run the full flow: load (done in beforeEach), then click
      await page.locator('#demo-button').click();

      // Give a short pause to ensure any asynchronous console errors would appear
      await page.waitForTimeout(100);

      // Assert that no page-level uncaught errors were recorded
      expect(consoleErrors.length).toBe(0);

      // Assert that no console.error messages were emitted
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);

      // Validate at least some informative console messages (if any types like 'log' exist, test remains flexible)
      const infoMessages = consoleMessages.filter(m => m.type === 'log' || m.type === 'info' || m.type === 'debug');
      // It's acceptable if there are zero info messages; we only assert that the console message collector works
      expect(Array.isArray(infoMessages)).toBe(true);
    });
  });
});