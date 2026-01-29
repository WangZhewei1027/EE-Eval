import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b15e90-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Comprehensive Guide to Hash Maps (Application f0b15e90-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to capture runtime console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate to the page before each test.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with type and text for later assertions
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If anything unexpected happens while reading console messages, record a placeholder
        consoleMessages.push({ type: 'unknown', text: String(e) });
      }
    });

    // Capture uncaught exceptions and other page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Load the application as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Clear listeners to avoid cross-test leakage
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('State S0_Idle (Initial Idle State) validations', () => {
    test('Idle state UI elements exist and global functions presence/absence check', async ({ page }) => {
      // This test validates:
      // - The Run Hash Map Demonstration button is present and has the expected onclick attribute
      // - The demoOutput container exists and is initially empty
      // - The runDemo function (expected to exist from the script) is defined on the page
      // - The renderPage function (declared in FSM entry actions) is NOT defined in the implementation
      // - No console "error" messages or page errors were emitted during initial load

      // Button presence and attributes
      const button = await page.waitForSelector("button[onclick='runDemo()']");
      expect(button).not.toBeNull();
      const buttonText = await button.textContent();
      expect(buttonText).toContain('Run Hash Map Demonstration');

      // demoOutput exists and is initially empty (no meaningful inner text)
      const demoOutput = await page.waitForSelector('#demoOutput');
      const demoText = (await demoOutput.textContent()).trim();
      // Allow whitespace-only initial content; should be empty for the initial state
      expect(demoText).toBe('');

      // Check global function runDemo exists and is callable (function type)
      const runDemoType = await page.evaluate(() => typeof window.runDemo);
      expect(runDemoType).toBe('function');

      // The FSM's S0 entry action mentions renderPage() but the implementation does NOT provide it.
      // Verify that renderPage is undefined on the page.
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // During normal load, we expect no console errors or page errors.
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: RunDemo (S0_Idle -> S1_DemoRunning)', () => {
    test('Clicking the Run Demo button displays internal structure, lookups, and collisions', async ({ page }) => {
      // This test validates the FSM transition triggered by clicking the Run Demo button:
      // - After click, #demoOutput contains headings and expected textual outputs describing the hash map
      // - The internal structure lists buckets and shows "Array size: 5"
      // - Lookup examples show values for 'apple' and 'kiwi' and "mango" as undefined
      // - Collision example text and explicit hashes for 'banana' and 'kiwi' are present

      // Click the button to trigger the runDemo() function
      const runButton = await page.waitForSelector("button[onclick='runDemo()']");
      await runButton.click();

      // Wait for expected heading from runDemo output
      const internalHeading = await page.waitForSelector('#demoOutput h3:text("Hash Map Internal Structure")', { timeout: 2000 }).catch(() => null);
      // Some browsers may not match :text pseudo selector; fallback to ensure the heading exists by checking text content
      if (!internalHeading) {
        // Wait for any text in demoOutput to appear
        await page.waitForFunction(() => {
          const el = document.getElementById('demoOutput');
          return el && el.textContent && el.textContent.includes('Hash Map Internal Structure');
        }, { timeout: 2000 });
      }

      // Ensure demoOutput contains expected phrases
      const demoContent = await page.locator('#demoOutput').innerText();

      // Check for Internal Structure heading and array size
      expect(demoContent).toContain('Hash Map Internal Structure');
      expect(demoContent).toContain('Array size: 5');

      // Check bucket listings (there should be Bucket 0 .. Bucket 4 lines)
      // We assert presence of at least "Bucket 0", "Bucket 1", etc.
      for (let i = 0; i < 5; i++) {
        expect(demoContent).toMatch(new RegExp(`Bucket\\s+${i}:`, 'i'));
      }

      // Lookup examples must include value outputs for 'apple' and 'kiwi', and 'mango' as undefined
      expect(demoContent).toContain("Value for 'apple': 5");
      expect(demoContent).toContain("Value for 'kiwi': 4");
      // The implementation prints 'undefined' for mango, but it does so via `... || 'undefined'`
      expect(demoContent).toContain("Value for 'mango': undefined");

      // Collision Example content and numeric hashes for banana and kiwi should be present
      expect(demoContent).toContain('Collision Example');
      // Check that hashes are shown as "Hash of "banana": <number>" and "Hash of "kiwi": <number>"
      expect(demoContent).toMatch(/Hash of "banana":\s*\d+/);
      expect(demoContent).toMatch(/Hash of "kiwi":\s*\d+/);

      // Verify that clicking again resets output (no duplicate content)
      await runButton.click();
      // Wait a short moment for script to run again
      await page.waitForTimeout(100);
      const demoContentAfterSecondClick = await page.locator('#demoOutput').innerText();
      // There should still only be one "Hash Map Internal Structure" header occurrence
      const occurrences = (demoContentAfterSecondClick.match(/Hash Map Internal Structure/g) || []).length;
      expect(occurrences).toBe(1);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Invoking missing renderPage() should raise a ReferenceError in the page context', async ({ page }) => {
      // This test intentionally attempts to call renderPage() (mentioned by FSM entry_actions)
      // Since renderPage is not implemented in the page, this should cause a ReferenceError.
      // We assert that the evaluate() promise rejects with an error that references renderPage or ReferenceError,
      // and that a pageerror event is emitted containing a similar message.

      // Attempt to invoke renderPage inside the page context and expect rejection
      // We wrap in expect(...).rejects to assert the ReferenceError/undefined function behavior.
      await expect(page.evaluate(() => {
        // Intentionally call undefined function to reproduce missing-entry-action behavior
        // NOTE: We do not define any globals; we call the function as-is to allow the runtime to throw naturally.
        return (renderPage()); // eslint-disable-line no-undef
      })).rejects.toThrow(/renderPage|ReferenceError|is not defined/);

      // Allow a slight delay for the pageerror handler to capture the error if emitted asynchronously
      await page.waitForTimeout(100);

      // There should be at least one page error captured mentioning renderPage or ReferenceError
      const matchedPageErrors = pageErrors.filter(msg => /renderPage|ReferenceError|is not defined/i.test(msg));
      expect(matchedPageErrors.length).toBeGreaterThanOrEqual(1);
    });

    test('Calling runDemo() programmatically should execute without throwing and populate output', async ({ page }) => {
      // This test calls the existing runDemo function from the page context (programmatic invocation)
      // and asserts that it does not throw and results in expected content in #demoOutput.

      // Ensure runDemo exists
      const exists = await page.evaluate(() => typeof window.runDemo === 'function');
      expect(exists).toBe(true);

      // Programmatically call runDemo() and ensure it returns undefined (no throw)
      await expect(page.evaluate(() => {
        // runDemo produces DOM side-effects and returns undefined; ensure it runs
        return window.runDemo();
      })).resolves.toBeUndefined();

      // Ensure demoOutput now contains expected lookup lines
      await page.waitForFunction(() => {
        const el = document.getElementById('demoOutput');
        return el && el.textContent && el.textContent.includes("Value for 'apple': 5");
      }, { timeout: 2000 });

      const demoText = await page.locator('#demoOutput').innerText();
      expect(demoText).toContain("Value for 'apple': 5");
      expect(demoText).toContain("Value for 'kiwi': 4");
    });
  });

  test.describe('Console and page error monitoring (overall smoke checks)', () => {
    test('No unexpected console errors or uncaught exceptions during normal interactions', async ({ page }) => {
      // This test ensures that normal operations (loading and clicking runDemo) do not emit unexpected console errors.
      // Note: The prior test intentionally triggered a ReferenceError; this test assumes a fresh page load (beforeEach).
      // Click runDemo and assert no console error messages or pageerrors occurred during the click execution.

      // Click the Run Demo button
      const runButton = await page.waitForSelector("button[onclick='runDemo()']");
      await runButton.click();

      // Wait for expected output to appear
      await page.waitForFunction(() => {
        const el = document.getElementById('demoOutput');
        return el && el.textContent && el.textContent.includes('Hash Map Internal Structure');
      }, { timeout: 2000 });

      // Give a short time for any async console messages to arrive
      await page.waitForTimeout(100);

      // Gather any console messages of type 'error' and any pageErrors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');

      // For a correct runtime, there should be no console 'error' messages and no uncaught page errors
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});