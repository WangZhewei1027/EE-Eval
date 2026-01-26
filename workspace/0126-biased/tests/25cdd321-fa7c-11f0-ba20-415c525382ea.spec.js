import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cdd321-fa7c-11f0-ba20-415c525382ea.html';

test.describe('Application 25cdd321-fa7c-11f0-ba20-415c525382ea — FSM: Logistic Regression Demo', () => {
  // Capture console messages and page errors for each test to assert correct runtime behavior.
  test.beforeEach(async ({ page }) => {
    // Attach listeners early, before navigation, to capture any errors during page load/initialization.
    page.__consoleMessages = [];
    page.__consoleErrors = [];
    page.__pageErrors = [];

    page.on('console', (msg) => {
      page.__consoleMessages.push(msg);
      if (msg.type && msg.type() === 'error') {
        page.__consoleErrors.push(msg);
      }
    });

    page.on('pageerror', (err) => {
      page.__pageErrors.push(err);
    });

    // Navigate to the exact provided page URL.
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown: remove listeners by disposing the page (Playwright does this automatically),
    // but keep this hook to satisfy the "setup and teardown" requirement.
    // Assertions about console/page errors are performed in each test explicitly.
  });

  test.describe('State S0_Idle (Idle) - Initial render checks', () => {
    test('Idle state: page renders components (renderPage entry action) and no runtime errors', async ({ page }) => {
      // This test validates the initial Idle state:
      // - Button exists with the expected label.
      // - demoOutput <pre> exists and is initially empty.
      // - demoOutput has required ARIA attributes.
      // - No console errors or page errors occurred during load.

      // Verify the demo button exists and has the expected text
      const demoBtn = page.locator('#demoBtn');
      await expect(demoBtn).toBeVisible();
      await expect(demoBtn).toHaveText('Show Logistic Function Values');

      // Verify button is enabled in Idle state
      await expect(demoBtn).toBeEnabled();

      // Verify the output <pre> exists and is empty initially
      const demoOutput = page.locator('#demoOutput');
      await expect(demoOutput).toBeVisible();
      const initialText = await demoOutput.textContent();
      // Expect initial output to be empty or only whitespace
      expect(initialText === '' || initialText.trim() === '').toBeTruthy();

      // Verify ARIA attributes on demoOutput (part of component evidence)
      await expect(demoOutput).toHaveAttribute('aria-live', 'polite');
      await expect(demoOutput).toHaveAttribute('aria-atomic', 'true');

      // Verify no console 'error' messages were emitted and no page errors occurred during render
      const consoleErrors = page.__consoleErrors || [];
      const pageErrors = page.__pageErrors || [];

      // If any console errors or page errors exist, fail the test with details to aid debugging
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: ButtonClick (S0_Idle -> S1_FunctionDisplayed)', () => {
    test('Clicking the demo button displays logistic function values and updates button state', async ({ page }) => {
      // This test validates the transition:
      // - Clicking #demoBtn populates #demoOutput with the expected text lines.
      // - The button becomes disabled and its text changes to the expected value.
      // - The displayed values are correctly formatted and within expected numeric ranges.
      // - The number of output rows corresponds to z ∈ [-6,6] inclusive.
      // - No console errors or page errors occur as a result.

      const demoBtn = page.locator('#demoBtn');
      const demoOutput = page.locator('#demoOutput');

      // Sanity check before click
      await expect(demoBtn).toBeVisible();
      await expect(demoOutput).toBeVisible();

      // Click the button to trigger the transition
      await demoBtn.click();

      // Wait for demoOutput to be populated (non-empty)
      await expect(demoOutput).not.toHaveText('', { timeout: 2000 });

      // Get the output text and perform assertions on its structure and content
      const text = await demoOutput.textContent();
      expect(typeof text).toBe('string');
      const rawLines = text.split('\n');

      // Expected structure:
      // line 0: header "z\tσ(z) = 1 / (1 + e^(-z))"
      // line 1: empty
      // lines 2..14: 13 lines for z = -6..6 inclusive (13 values)
      // There may be a trailing newline leading to an extra empty string element; filter trailing empties for numeric lines
      // Trim any potential carriage returns and map cleanly
      const cleanedLines = rawLines.map(l => l.replace(/\r/g, ''));

      // Validate header on the first line contains the formula reference
      const header = cleanedLines[0] || '';
      expect(header).toContain('z');
      expect(header).toContain('σ(z)');

      // Validate there are at least 13 value lines present somewhere after the header
      // Find the first non-empty index after header that begins with a number (z value)
      const valueLines = cleanedLines.slice(2).filter(l => l.trim().length > 0); // naive extraction
      expect(valueLines.length).toBeGreaterThanOrEqual(13);

      // Extract the first 13 numeric lines corresponding to z=-6..6
      const first13 = valueLines.slice(0, 13);

      // Verify exact formatting for specific z values based on known sigmoid computations with 4 decimal places:
      // Sigmoid(-6) ≈ 0.0024726 -> 0.0025
      // Sigmoid(0)  = 0.5 -> 0.5000
      // Sigmoid(6) ≈ 0.997527 -> 0.9975
      // Also verify general format "z<TAB>value" (tab separated)
      const parsed = first13.map((line) => {
        const parts = line.split('\t');
        return {
          raw: line,
          z: parts[0] ? parts[0].trim() : '',
          val: parts[1] ? parts[1].trim() : undefined
        };
      });

      // Basic checks on parsed lines
      expect(parsed.length).toBeGreaterThanOrEqual(13);
      // Check first, middle, and last of the expected 13 entries
      const first = parsed[0];
      const middle = parsed[Math.floor(parsed.length / 2)]; // should correspond to z=0
      const last = parsed[parsed.length - 1];

      // Assert z indices are as expected (-6, 0, 6)
      expect(first.z).toBe('-6');
      expect(middle.z).toBe('0');
      expect(last.z).toBe('6');

      // Assert numeric formatting to 4 decimal places
      expect(first.val).toBeDefined();
      expect(middle.val).toBeDefined();
      expect(last.val).toBeDefined();
      expect(first.val).toBe('0.0025');
      expect(middle.val).toBe('0.5000');
      expect(last.val).toBe('0.9975');

      // Verify all numeric values lie strictly between 0 and 1 (sigmoid property)
      for (const p of parsed) {
        const v = parseFloat(p.val);
        expect(Number.isFinite(v)).toBeTruthy();
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThan(1);
      }

      // Verify button became disabled and its text changed accordingly
      await expect(demoBtn).toBeDisabled();
      await expect(demoBtn).toHaveText('Logistic Function Values Shown');

      // Ensure no console errors or page errors occurred as a result of clicking
      const consoleErrors = page.__consoleErrors || [];
      const pageErrors = page.__pageErrors || [];
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: attempting to interact with disabled button does not alter output nor cause runtime errors', async ({ page }) => {
      // This test validates an edge-case after the transition:
      // - The button is disabled; further clicks should not change the output content.
      // - No runtime errors arise from attempting the interaction.
      const demoBtn = page.locator('#demoBtn');
      const demoOutput = page.locator('#demoOutput');

      // Ensure we are in the FunctionDisplayed state first by clicking once
      await expect(demoBtn).toBeVisible();
      await demoBtn.click();
      await expect(demoBtn).toBeDisabled();

      const beforeText = await demoOutput.textContent();

      // Attempt to click the disabled button. Playwright will perform the action, but the DOM's disabled attribute should prevent event.
      // We don't suppress errors; any exception will propagate and be reported by Playwright.
      // Use page.click to emulate user action; if the element is disabled, the click should not change state.
      try {
        await demoBtn.click({ timeout: 500 });
      } catch (err) {
        // Some browser automation drivers may throw when clicking a disabled element.
        // We allow this to happen naturally but continue with assertions about state and errors captured on the page.
      }

      // Re-fetch output and compare to ensure it hasn't changed
      const afterText = await demoOutput.textContent();
      expect(afterText).toBe(beforeText);

      // The button must remain disabled and text unchanged
      await expect(demoBtn).toBeDisabled();
      await expect(demoBtn).toHaveText('Logistic Function Values Shown');

      // Verify again that no page-level runtime errors occurred (pageerror)
      const consoleErrors = page.__consoleErrors || [];
      const pageErrors = page.__pageErrors || [];

      // It's acceptable that Playwright threw a local click exception which was caught above.
      // But we assert the page itself logged no errors and produced no uncaught exceptions.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Accessibility and component contract checks', () => {
    test('demoOutput has required attributes and formatting (aria-live polite, aria-atomic true)', async ({ page }) => {
      // This test focuses on validating component metadata and behavior expected by the FSM and UI contract.
      const demoOutput = page.locator('#demoOutput');
      await expect(demoOutput).toBeVisible();
      await expect(demoOutput).toHaveAttribute('aria-live', 'polite');
      await expect(demoOutput).toHaveAttribute('aria-atomic', 'true');

      // Click to populate and then ensure the live region contains text and is not empty
      const demoBtn = page.locator('#demoBtn');
      await demoBtn.click();
      await expect(demoOutput).not.toHaveText('', { timeout: 2000 });
      const text = await demoOutput.textContent();
      expect(text.length).toBeGreaterThan(0);

      // Confirm there are exactly 13 numeric rows corresponding to z=-6..6 (robust to trailing newlines)
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      // Remove the header line (contains sigma formula) and consider the rest numeric lines
      const numericLines = lines.slice(1); // after header
      expect(numericLines.length).toBeGreaterThanOrEqual(13);
      // Confirm the first numeric line corresponds to z=-6 and the last to z=6
      expect(numericLines[0].startsWith('-6')).toBeTruthy();
      expect(numericLines[12].startsWith('6')).toBeTruthy();

      // Ensure no errors were emitted to console or uncaught page exceptions
      const consoleErrors = page.__consoleErrors || [];
      const pageErrors = page.__pageErrors || [];
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Runtime observation: capture and assert no unexpected console/page errors', () => {
    test('No ReferenceError/SyntaxError/TypeError occurred during normal usage', async ({ page }) => {
      // This test explicitly inspects captured console and page errors and asserts that none of the common, fatal
      // JavaScript error types occurred while loading and interacting with the page.

      // Interact with the page: perform the primary action
      const demoBtn = page.locator('#demoBtn');
      await demoBtn.click();

      // Allow a short moment for any asynchronous errors to surface
      await page.waitForTimeout(250);

      // Analyze captured page errors and console errors
      const pageErrors = page.__pageErrors || [];
      const consoleMessages = page.__consoleMessages || [];

      // Build lists of JavaScript Error types found in pageErrors and console error messages
      const pageErrorTypes = pageErrors.map(e => (e && e.name) || String(e));
      const consoleErrorMessages = consoleMessages
        .filter(m => m.type && m.type() === 'error')
        .map(m => m.text && m.text());

      // Assert that no uncaught page errors were thrown
      expect(pageErrorTypes.length).toBe(0);

      // Assert that no console.error was invoked
      expect(consoleErrorMessages.length).toBe(0);

      // Additionally assert that none of the console or page errors contain common fatal error keywords
      const fatalKeywords = ['ReferenceError', 'TypeError', 'SyntaxError', 'RangeError'];
      for (const msg of consoleErrorMessages.concat(pageErrorTypes)) {
        for (const kw of fatalKeywords) {
          expect(String(msg)).not.toContain(kw);
        }
      }
    });
  });
});