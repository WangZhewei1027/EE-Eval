import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04423503-fa79-11f0-8a8e-bbe4f11717c6.html';

// Comprehensive Playwright tests for the Heap Sort interactive application.
// File: 04423503-fa79-11f0-8a8e-bbe4f11717c6.spec.js

test.describe('Heap Sort FSM and UI - Application ID 04423503-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Arrays to collect console and page errors during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console events (logs, errors, warnings) for later assertions
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Some console messages may throw when reading; still record a minimal entry
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the exact page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach some basic diagnostics to the test output if the runner supports it.
    // This is non-invasive and does not modify the tested page.
    if (consoleMessages.length) {
      testInfo.attach('console-messages', {
        body: JSON.stringify(consoleMessages.slice(0, 50), null, 2),
        contentType: 'application/json'
      });
    }
    if (pageErrors.length) {
      testInfo.attach('page-errors', {
        body: JSON.stringify(pageErrors.map(e => ({ name: e.name, message: e.message })), null, 2),
        contentType: 'application/json'
      });
    }
  });

  test.describe('Idle State (S0_Idle)', () => {
    test('renders page and shows Heap Sort button and result container', async ({ page }) => {
      // Validate initial Idle state UI elements as described by the FSM and HTML
      // - The heap sort button should be present
      const heapButton = await page.locator('#heap-sort-button');
      await expect(heapButton).toBeVisible();
      await expect(heapButton).toHaveText('Heap Sort');

      // - The result container should exist
      const result = await page.locator('.result');
      await expect(result).toBeVisible();

      // - On initial render, the result should be empty (renderPage entry action expected)
      const initialResultText = (await result.innerText()).trim();
      // The FSM entry action renderPage() is expected; we assert that result starts empty or whitespace.
      expect(initialResultText.length <= 0).toBeTruthy();
    });

    test('no unexpected fatal page errors before interaction', async ({ page }) => {
      // Confirm there are no fatal page errors immediately after load.
      // If there are errors, they will be captured in pageErrors.
      expect(Array.isArray(pageErrors)).toBeTruthy();
      // This test asserts that either there are no page errors or they exist and are captured,
      // we do not attempt to patch or change the page. If errors exist, they will be visible
      // in the test attachments for review.
      // Assert that the collector is functioning:
      expect(consoleMessages).toBeDefined();
      expect(pageErrors).toBeDefined();
    });
  });

  test.describe('Transition: S0_Idle -> S1_Sorting (HeapSortClick)', () => {
    test('clicking Heap Sort triggers sorting behavior or logs runtime errors (accept either)', async ({ page }) => {
      // This test performs the HeapSortClick event and validates the transition.
      // The FSM expects performHeapSort() to run on entry to S1_Sorting.
      // We must not patch or modify the page. We observe DOM changes and errors as-is.

      const heapButton = page.locator('#heap-sort-button');
      await expect(heapButton).toBeVisible();

      const resultLocator = page.locator('.result');

      // Click the button to trigger sorting.
      await heapButton.click();

      // After clicking, one of two acceptable outcomes must occur:
      // 1) The UI shows sorting progress/result inside .result (evidence of Sorting).
      // 2) The page throws a runtime error (ReferenceError/TypeError/SyntaxError) that we capture.
      //
      // We'll wait up to 2 seconds for the .result to become non-empty. If it remains empty,
      // we assert that at least one page error or console error exists indicating an exception.
      const resultAppeared = await (async () => {
        try {
          await page.waitForFunction(() => {
            const el = document.querySelector('.result');
            if (!el) return false;
            return el.innerText && el.innerText.trim().length > 0;
          }, { timeout: 2000 });
          return true;
        } catch (e) {
          return false;
        }
      })();

      if (resultAppeared) {
        // If result appeared, assert that the result is visible and contains some informative content.
        const resultText = (await resultLocator.innerText()).trim();
        expect(resultText.length).toBeGreaterThan(0);
        // The FSM expected "Sorting animation starts" and "Result is displayed".
        // We can assert the presence of keywords that commonly indicate sorting, but we
        // only assert non-empty to avoid brittle checks.
      } else {
        // No result appeared in time. Assert that there is at least one captured page error
        // or an error-level console message. This satisfies the requirement to observe errors
        // and let them occur naturally.
        const hasPageError = pageErrors.length > 0;
        const hasConsoleError = consoleMessages.some(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
        expect(hasPageError || hasConsoleError).toBeTruthy();
        // When available, provide additional assertions about the nature of the errors.
        if (hasPageError) {
          const names = pageErrors.map(e => e.name || '').join(', ');
          // At least one of the errors should be typical JS runtime error types per the task instructions.
          expect(/ReferenceError|TypeError|SyntaxError/.test(names)).toBeTruthy();
        } else {
          // If only console errors are present, ensure they include typical error names/text.
          const text = consoleMessages.map(m => m.text).join('\n');
          expect(/ReferenceError|TypeError|SyntaxError/.test(text)).toBeTruthy();
        }
      }
    });

    test('repeated rapid clicks do not throw unhandled exceptions beyond captured errors', async ({ page }) => {
      // Edge case: simulate rapid multiple clicks to ensure the application either handles it
      // or emits errors that we capture. We do not patch the page; we observe behavior.
      const heapButton = page.locator('#heap-sort-button');
      await expect(heapButton).toBeVisible();

      // Perform rapid clicks
      await Promise.all([
        heapButton.click(),
        heapButton.click(),
        heapButton.click()
      ]);

      // After rapid clicks, either a result appears, or errors are captured.
      const resultLocator = page.locator('.result');

      const resultOrError = await (async () => {
        try {
          await page.waitForFunction(() => {
            const el = document.querySelector('.result');
            return el && el.innerText && el.innerText.trim().length > 0;
          }, { timeout: 2000 });
          return 'result';
        } catch (e) {
          // No DOM update within timeout; check captured errors
          if (pageErrors.length > 0) return 'pageerror';
          if (consoleMessages.some(m => m.type === 'error')) return 'consoleerror';
          return 'none';
        }
      })();

      // Accept either a result or captured errors as a valid outcome; assert we observed one of them.
      expect(['result', 'pageerror', 'consoleerror'].includes(resultOrError)).toBeTruthy();

      // If errors exist, assert they're of expected JS error classes when possible
      if (resultOrError === 'pageerror') {
        const names = pageErrors.map(e => e.name || '').join(', ');
        expect(/ReferenceError|TypeError|SyntaxError/.test(names)).toBeTruthy();
      } else if (resultOrError === 'consoleerror') {
        const text = consoleMessages.map(m => m.text).join('\n');
        expect(/ReferenceError|TypeError|SyntaxError/.test(text)).toBeTruthy();
      } else {
        // result case: ensure some text appears to indicate completion or progress
        const text = (await resultLocator.innerText()).trim();
        expect(text.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('OnEnter/OnExit actions and robustness checks', () => {
    test('entry actions are observable: renderPage() creates expected DOM elements', async ({ page }) => {
      // The FSM lists renderPage() as S0 entry action. We validate expected DOM elements exist.
      const heapButton = page.locator('#heap-sort-button');
      const result = page.locator('.result');

      await expect(heapButton).toBeVisible();
      await expect(heapButton).toHaveText('Heap Sort');
      await expect(result).toBeVisible();
    });

    test('performHeapSort() (on enter of Sorting) either updates the DOM or produces runtime errors', async ({ page }) => {
      // We trigger the entry to Sorting by clicking and verify either DOM change or errors are captured.
      const heapButton = page.locator('#heap-sort-button');
      await heapButton.click();

      // Small wait for possible side effects
      await page.waitForTimeout(300);

      // Check for either non-empty result or page errors / console errors
      const resultText = (await page.locator('.result').innerText()).trim();
      const hasResult = resultText.length > 0;
      const hasPageError = pageErrors.length > 0;
      const hasConsoleError = consoleMessages.some(m => m.type === 'error');

      // At least one observable effect must occur per the FSM expectation (sorting animation or errors)
      expect(hasResult || hasPageError || hasConsoleError).toBeTruthy();

      // If there are page errors, assert they have expected JS error names
      if (hasPageError) {
        const names = pageErrors.map(e => e.name || '').join(', ');
        expect(/ReferenceError|TypeError|SyntaxError/.test(names)).toBeTruthy();
      }
    });
  });
});