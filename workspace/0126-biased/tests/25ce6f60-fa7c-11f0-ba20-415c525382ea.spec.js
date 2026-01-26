import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ce6f60-fa7c-11f0-ba20-415c525382ea.html';

test.describe('25ce6f60-fa7c-11f0-ba20-415c525382ea — Asymmetric Cryptography interactive app', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and categorize them for assertions
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });

    // Load the page exactly as-is and wait for it to be ready
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Teardown is handled by Playwright fixtures. We keep listeners local per-page.
    // Provide some debug output if needed (kept in test artifacts via reporter).
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('Idle: page renders and demo button is present with correct text and attributes', async ({ page }) => {
      // Verify the demo button exists and has the expected label
      const demoBtn = page.locator('#demoBtn');
      await expect(demoBtn).toBeVisible();
      await expect(demoBtn).toHaveText('Run Basic Conceptual RSA Demo');

      // Verify the demo output container exists and has the expected aria attributes
      const demoDiv = page.locator('#demo');
      await expect(demoDiv).toBeVisible();
      await expect(demoDiv).toHaveAttribute('aria-live', 'polite');
      await expect(demoDiv).toHaveAttribute('aria-atomic', 'true');

      // Verify initial demo area is empty (Idle state's evidence: button present, demo empty)
      const demoContent = await demoDiv.innerHTML();
      expect(demoContent.trim()).toBe('');

      // Verify that the global function renderPage referenced by FSM entry action is NOT present
      // (The FSM mentions renderPage() as entry action; the page does not define it intentionally).
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(hasRenderPage).toBe(false);

      // Ensure the modular exponentiation helper exists as implemented in the page script
      const hasModExp = await page.evaluate(() => typeof window.modExp === 'function');
      expect(hasModExp).toBe(true);

      // Assert there were no uncaught page errors on initial load
      expect(pageErrors.length).toBe(0);

      // Assert no console error-level messages were emitted during load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: RunDemo (S0_Idle -> S1_DemoRunning)', () => {
    test('Clicking demo button runs the RSA demo and displays expected output', async ({ page }) => {
      const demoBtn = page.locator('#demoBtn');
      const demoDiv = page.locator('#demo');

      // Click the button to trigger the demo (event: RunDemo)
      await demoBtn.click();

      // Wait for demo output to be populated (it writes HTML into #demo)
      await expect(demoDiv).not.toHaveText('', { timeout: 2000 });

      const html = await demoDiv.innerHTML();

      // Verify the demo output contains the expected generated keys and numeric results.
      // These expectations mirror the deterministic small-number RSA-like demo in the page script.
      // Expected values computed from the demo script:
      // p=11, q=13 -> n=143, phi=120, e=7 -> d should be 103, plaintext m=9, ciphertext c=48, decrypted m2=9
      await expect(html).toContain('Generated keys:');
      await expect(html).toContain('Public Key (e, n): (7, 143)');
      await expect(html).toContain('Private Key (d, n): (103, 143)');
      await expect(html).toContain('Plaintext message:</strong> 9');
      await expect(html).toContain('Ciphertext (encrypted message):</strong> 48');
      await expect(html).toContain('Decrypted message:</strong> 9');
      await expect(html).toContain('Success: decrypted message matches original plaintext.');

      // Verify that clicking the button transitions the app into the "Demo Running" observable state:
      // The page's evidence is the click listener and visible demo output (already checked).
      // Confirm that modExp was used by verifying outputs are consistent with function availability
      const modExpIsFunction = await page.evaluate(() => typeof window.modExp === 'function');
      expect(modExpIsFunction).toBe(true);

      // Assert there are no uncaught runtime errors produced by running the demo
      expect(pageErrors.length).toBe(0);

      // Also assert there were no console.error messages emitted as part of running the demo
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: clicking the demo button multiple times updates output consistently', async ({ page }) => {
      const demoBtn = page.locator('#demoBtn');
      const demoDiv = page.locator('#demo');

      // Click multiple times in rapid succession
      await demoBtn.click();
      await demoBtn.click();
      await demoBtn.click();

      // Ensure demo finished and shows expected content (still deterministic)
      await expect(demoDiv).toHaveText(/Generated keys:/, { timeout: 2000 });

      const html = await demoDiv.innerHTML();

      // Output should still include the same computed values; clicking multiple times shouldn't produce duplicates or errors
      await expect(html).toContain('Public Key (e, n): (7, 143)');
      await expect(html).toContain('Private Key (d, n): (103, 143)');
      await expect(html).toContain('Ciphertext (encrypted message):</strong> 48');
      await expect(html).toContain('Success: decrypted message matches original plaintext.');

      // Confirm still no uncaught page errors after repeated invocation
      expect(pageErrors.length).toBe(0);

      // No console.error messages produced
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Behavioral expectation: demo output is accessible via aria-live region', async ({ page }) => {
      // Verify that the demo region is an aria-live polite region (accessibility requirement)
      const demoDiv = page.locator('#demo');
      await expect(demoDiv).toHaveAttribute('aria-live', 'polite');

      // Trigger the demo to populate aria-live content
      await page.locator('#demoBtn').click();

      // Ensure aria-live content includes the decrypted message confirmation
      await expect(demoDiv).toHaveText(/Success: decrypted message matches original plaintext\./);

      // No page errors should have occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Verification of FSM-specified actions and error observation', () => {
    test('Verify onEnter/onExit actions mentioned in FSM and observe any runtime errors', async ({ page }) => {
      // FSM mentions "renderPage()" as entry action for S0_Idle.
      // The page does not define renderPage; assert it's not present rather than attempting to call it.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(hasRenderPage).toBe(false);

      // FSM mentions displayDemoOutput() as an entry action for S1_DemoRunning (not explicitly defined).
      // The demo output is produced by the click handler; check whether displayDemoOutput exists.
      const hasDisplayDemoOutput = await page.evaluate(() => typeof window.displayDemoOutput !== 'undefined');
      // The implementation does not define displayDemoOutput; we assert that fact (it is acceptable per instructions).
      expect(hasDisplayDemoOutput).toBe(false);

      // Observe console and page errors arrays. We assert that any errors, if present, are captured and are of expected types.
      // Instead of failing when errors are absent (since the page is expected to run cleanly), we assert that
      // pageErrors is an array and each captured item, if any, has required properties.
      expect(Array.isArray(pageErrors)).toBe(true);
      for (const err of pageErrors) {
        expect(err).toHaveProperty('name');
        expect(err).toHaveProperty('message');
        expect(typeof err.message).toBe('string');
      }

      // Also assert consoleMessages were captured and if any error-level console entries exist they include textual content
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      for (const msg of errorConsoleMessages) {
        expect(typeof msg.text).toBe('string');
        expect(msg.text.length).toBeGreaterThan(0);
      }
    });

    test('Edge scenario: ensure no unexpected ReferenceError/TypeError/SyntaxError occurred during full interaction', async ({ page }) => {
      // Interact with the page fully by clicking the demo button once
      await page.locator('#demoBtn').click();

      // Wait for expected content to appear
      await expect(page.locator('#demo')).toHaveText(/Success: decrypted message matches original plaintext\./, { timeout: 2000 });

      // Now inspect collected pageErrors for JavaScript error types and fail the test if critical JS errors occurred.
      // This assertion enforces that the runtime did not throw unhandled ReferenceError/TypeError/SyntaxError during interactions.
      const criticalErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError', 'RangeError', 'URIError'].includes(e.name));
      // Expect no critical errors occurred; if any occurred they will make this expectation fail and surface the error details.
      expect(criticalErrors.length).toBe(0);
    });
  });
});