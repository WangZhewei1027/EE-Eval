import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83811c1-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('Paging — FSM interactive demo (d83811c1-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Collect console messages and page errors for each test to assert runtime health.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including console.error)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // no-op cleanup placeholder (Playwright handles context/page cleanup)
  });

  test.describe('State S0_Idle (initial state) validations', () => {
    test('S0_Idle: Run demo button exists and demo output is initially hidden', async ({ page }) => {
      // Validate the Run demonstration button is present with expected attributes
      const runBtn = page.locator('#runDemo');
      await expect(runBtn).toBeVisible();
      await expect(runBtn).toHaveText('Run small demo (fixed example)');
      await expect(runBtn).toHaveAttribute('class', /btn/);
      await expect(runBtn).toHaveAttribute('aria-label', 'Run demonstration');

      // Validate the demo output area exists and is hidden initially (display:none)
      const out = page.locator('#demoOutput');
      await expect(out).toBeHidden();

      // The demoOutput should expose aria-live="polite" per implementation
      await expect(out).toHaveAttribute('aria-live', 'polite');

      // Verify there were no runtime exceptions on page load
      expect(pageErrors.length, 'No pageerror events on initial load').toBe(0);
      // Also assert no console error messages were produced
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages on initial load').toBe(0);
    });
  });

  test.describe('Transition: RunDemo (S0_Idle -> S1_DemoRunning)', () => {
    test('Clicking Run demonstration reveals demo output and shows traces for FIFO, LRU, Optimal', async ({ page }) => {
      const runBtn = page.locator('#runDemo');
      const out = page.locator('#demoOutput');

      // Sanity checks before clicking: button visible, output hidden
      await expect(runBtn).toBeVisible();
      await expect(out).toBeHidden();

      // Click the button to trigger the demo (transition event)
      await runBtn.click();

      // After click the output should become visible (entry action: runDemo -> out.style.display = "block")
      await expect(out).toBeVisible();

      // Computed style should have display 'block'
      const display = await page.evaluate(() => getComputedStyle(document.getElementById('demoOutput')).display);
      expect(display, 'demoOutput computed display should be block after running demo').toBe('block');

      // The demo text should contain traces for FIFO, LRU, and Optimal algorithms
      const text = await out.textContent();
      expect(text, 'demo output should contain FIFO label').toContain('FIFO');
      expect(text, 'demo output should contain LRU label').toContain('LRU');
      expect(text, 'demo output should contain Optimal label').toContain('Optimal');

      // The demo produces a summary with expected page-fault numbers for this fixed reference string
      // Expected based on implementation: FIFO: 10, LRU: 9, Optimal: 7
      expect(text).toContain('FIFO faults: 10');
      expect(text).toContain('LRU faults:  9') || expect(text).toContain('LRU faults: 9'); // allow spacing differences
      expect(text).toContain('Optimal:     7') || expect(text).toContain('Optimal:     7');

      // It also prints the reference string header and frame count
      expect(text).toContain('Reference string: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2]');
      expect(text).toContain('Frames available: 3');

      // The implementation attempts to move focus to the output: verify active element is the demo output (if focus was applied)
      const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
      // activeId may not equal 'demoOutput' in all environments but if focus was applied, it should be 'demoOutput'
      if (activeId) {
        // If focus was moved, ensure it's the output element
        expect(['demoOutput', null, undefined]).toContain(activeId);
      }

      // Confirm no uncaught exceptions were thrown during the click/runDemo
      expect(pageErrors.length, 'No uncaught page errors after running demo').toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages after running demo').toBe(0);
    });

    test('RunDemo is idempotent: subsequent clicks do not rerun demo (listener was registered once)', async ({ page }) => {
      const runBtn = page.locator('#runDemo');
      const out = page.locator('#demoOutput');

      // Click once to run the demo
      await runBtn.click();
      await expect(out).toBeVisible();
      const firstText = await out.textContent();

      // Click again - in the implementation the listener is registered with {once:true}, so nothing should change
      // We attempt multiple activations (click and keyboard) to validate the "run once" behavior and ensure stability.
      await runBtn.click(); // second click
      // Wait briefly to allow any potential (unexpected) changes
      await page.waitForTimeout(200);

      // Capture text after second click
      const afterSecondClickText = await out.textContent();
      expect(afterSecondClickText, 'Output should remain unchanged after second click').toBe(firstText);

      // Try keyboard activation as an alternate user action
      await page.focus('#runDemo');
      await page.keyboard.press('Enter');
      // Wait briefly
      await page.waitForTimeout(200);
      const afterKeyboardAttemptText = await out.textContent();
      expect(afterKeyboardAttemptText, 'Output should remain unchanged after Enter key activation attempt').toBe(firstText);

      // No errors must have occurred during redundant activations
      expect(pageErrors.length, 'No pageerror events during repeated/keyboard activations').toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages during repeated/keyboard activations').toBe(0);
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('Multiple quick clicks do not cause unhandled exceptions or duplicate content', async ({ page }) => {
      const runBtn = page.locator('#runDemo');
      const out = page.locator('#demoOutput');

      // Simulate a rapid sequence of clicks
      // (The event listener uses {once:true}, so only the first should have effect; ensure no errors)
      await Promise.all([
        runBtn.click(),
        runBtn.click(),
        runBtn.click()
      ]);

      // Wait a bit for any asynchronous activity (the demo is synchronous, but we keep a small wait to be safe)
      await page.waitForTimeout(150);

      // Verify the output is visible and contains expected summary lines
      await expect(out).toBeVisible();
      const text = await out.textContent();
      expect(text).toContain('FIFO faults: 10');
      expect(text).toContain('LRU faults:  9') || expect(text).toContain('LRU faults: 9');
      expect(text).toContain('Optimal:     7') || expect(text).toContain('Optimal:     7');

      // Check for no page errors or console.error messages
      expect(pageErrors.length, 'No page errors after rapid clicks').toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages after rapid clicks').toBe(0);
    });

    test('Demo output formatting contains expected trace header and step lines', async ({ page }) => {
      const runBtn = page.locator('#runDemo');
      const out = page.locator('#demoOutput');

      await runBtn.click();
      await expect(out).toBeVisible();

      const text = await out.textContent();

      // Validate trace header exists
      expect(text).toContain('Step  Page    Frames (left-to-right)');

      // Validate that at least one step line is present and shows either (HIT) or (FAULT)
      // We'll assert that the output contains "(FAULT)" or "(HIT)" substrings somewhere in text
      const hasHitOrFault = text.includes('(HIT)') || text.includes('(FAULT)');
      expect(hasHitOrFault, 'Trace output should contain (HIT) or (FAULT) annotations').toBeTruthy();

      // Confirm no runtime exceptions emitted
      expect(pageErrors.length, 'No page errors when inspecting trace formatting').toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages when inspecting trace formatting').toBe(0);
    });
  });
});