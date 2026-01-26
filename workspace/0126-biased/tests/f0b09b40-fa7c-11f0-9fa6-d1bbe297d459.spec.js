import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b09b40-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Comprehensive Guide to Arrays - FSM and Demo E2E', () => {
  // Shared collectors for console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (including errors) emitted by the page
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect unhandled page errors/exceptions (ReferenceError, TypeError, etc.)
    page.on('pageerror', error => {
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach console and page error summaries to test output for debugging
    if (consoleMessages.length > 0) {
      testInfo.attach('console-messages', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json',
      });
    }
    if (pageErrors.length > 0) {
      testInfo.attach('page-errors', {
        body: JSON.stringify(pageErrors, null, 2),
        contentType: 'application/json',
      });
    }
  });

  test.describe('State: S0_Idle (Initial Page)', () => {
    test('Initial render shows Run Array Demo button and empty demo output (Idle state)', async ({ page }) => {
      // This test validates the Idle state described in the FSM:
      // - The "Run Array Demo" button should be present
      // - The demo output container should be present and initially empty
      // - The FSM declared an entry action "renderPage()" which is not implemented in the HTML; assert its absence

      // Verify the Run Array Demo button exists and is visible
      const runButton = page.locator("button[onclick='runArrayDemo()']");
      await expect(runButton).toBeVisible();
      await expect(runButton).toHaveText('Run Array Demo');

      // Verify the demo output container exists
      const demoOutput = page.locator('#demo-output');
      await expect(demoOutput).toBeVisible();

      // It should be empty initially (no child paragraphs)
      const paragraphs = demoOutput.locator('p');
      await expect(paragraphs).toHaveCount(0);

      // The FSM's S0 entry action mentions renderPage().
      // Ensure that renderPage is not defined on the page (we do not modify page globals).
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'function');
      // Expect 'renderPage' to be undefined because the HTML does not define it.
      expect(hasRenderPage).toBe(true);

      // There should be no uncaught page errors just from loading the Idle state
      expect(pageErrors.length).toBe(0);
      // There should be no console errors on load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('State: S1_DemoRunning (After running demo)', () => {
    test('Clicking Run Array Demo triggers runArrayDemo and displays all expected outputs', async ({ page }) => {
      // This test validates the transition S0_Idle -> S1_DemoRunning:
      // - runArrayDemo exists and is callable
      // - Clicking the button executes the demo and populates demo-output with expected entries:
      //   Original array, Element at index 2, After push('Elderberry'), After removing index 1, Index of 'Cherry'

      // Verify runArrayDemo function exists on the page
      const hasRunArrayDemoFn = await page.evaluate(() => typeof window.runArrayDemo === 'function');
      expect(hasRunArrayDemoFn).toBe(true);

      // Click the Run Array Demo button
      const runButton = page.locator("button[onclick='runArrayDemo()']");
      await runButton.click();

      // Wait for paragraphs to appear in the demo output
      const demoOutput = page.locator('#demo-output');
      await demoOutput.waitFor({ state: 'attached' });
      const paragraphs = demoOutput.locator('p');
      // The demo appends 5 paragraphs representing the expected observables
      await expect(paragraphs).toHaveCount(5);

      // Capture the text content for detailed assertions
      const texts = await paragraphs.allTextContents();

      // Assert each expected observable is present in order with the expected content
      expect(texts[0]).toContain('Original array: [Apple, Banana, Cherry, Date]');
      expect(texts[1]).toContain('Element at index 2: Cherry');
      expect(texts[2]).toContain("After push('Elderberry'): [Apple, Banana, Cherry, Date, Elderberry]");
      expect(texts[3]).toContain('After removing index 1: [Apple, Cherry, Date, Elderberry]');
      // After removal, indexOf('Cherry') should be 1
      expect(texts[4]).toContain("Index of 'Cherry': 1");

      // Ensure no page errors were thrown during the demo run
      expect(pageErrors.length).toBe(0);

      // Ensure no console errors were emitted during the demo run
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Running the demo multiple times resets output and remains deterministic', async ({ page }) => {
      // This test validates idempotency/behavior on repeated Run Array Demo clicks:
      // - Each click should reset demo output (innerHTML = '') then append the same 5 entries.
      // - After multiple runs, the output should reflect exactly one run (no duplicate accumulations).

      const runButton = page.locator("button[onclick='runArrayDemo()']");
      const demoOutput = page.locator('#demo-output');

      // First run
      await runButton.click();
      await demoOutput.waitFor({ state: 'attached' });
      const paragraphsFirstRun = demoOutput.locator('p');
      await expect(paragraphsFirstRun).toHaveCount(5);
      const textsFirstRun = await paragraphsFirstRun.allTextContents();

      // Validate first run content (basic spot check)
      expect(textsFirstRun[0]).toContain('Original array: [Apple, Banana, Cherry, Date]');

      // Second run - should clear and re-render (still 5 paragraphs)
      await runButton.click();
      const paragraphsSecondRun = demoOutput.locator('p');
      await expect(paragraphsSecondRun).toHaveCount(5);
      const textsSecondRun = await paragraphsSecondRun.allTextContents();

      // The outputs of the two runs should be identical strings (deterministic behavior)
      expect(textsSecondRun).toEqual(textsFirstRun);

      // Rapid multiple runs (3 more times) to ensure consistent behavior and no memory leak / accumulating nodes
      for (let i = 0; i < 3; i++) {
        await runButton.click();
        await expect(demoOutput.locator('p')).toHaveCount(5);
      }

      // Final sanity: ensure content still matches expected pattern
      const finalTexts = await demoOutput.locator('p').allTextContents();
      expect(finalTexts[1]).toContain('Element at index 2: Cherry');
    });

    test('Edge-case introspection: ensure no unexpected runtime ReferenceError/TypeError/SyntaxError occurred', async ({ page }) => {
      // This test explicitly inspects collected pageErrors and console errors for
      // ReferenceError, TypeError, SyntaxError and fails if any are present.
      //
      // It also demonstrates observing console messages (useful for diagnosing issues).

      // Trigger the demo to maximize exercised code paths
      await page.locator("button[onclick='runArrayDemo()']").click();
      await page.locator('#demo-output').locator('p').first().waitFor();

      // Check collected page errors
      const criticalErrors = pageErrors.filter(e =>
        ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name)
      );

      // Assert that none of these critical errors were thrown
      expect(criticalErrors.length).toBe(0);

      // Also assert there were no console messages of type 'error' produced during the test
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('FSM conformance checks and miscellaneous assertions', () => {
    test('FSM transition existence: clicking the trigger selector moves from Idle to DemoRunning (observable via DOM changes)', async ({ page }) => {
      // This test asserts the presence of the event trigger element described in the FSM,
      // performs the event, and verifies the transition observable effects (DOM changes).

      // Ensure the FSM-declared trigger selector exists on the page
      const triggerSelector = "button[onclick='runArrayDemo()']";
      const trigger = page.locator(triggerSelector);
      await expect(trigger).toHaveCount(1);

      // Before transition: demo-output should be empty
      await expect(page.locator('#demo-output').locator('p')).toHaveCount(0);

      // Trigger the event: click the button
      await trigger.click();

      // After transition: demo-output should contain evidence text that the transition occurred
      const demoOutput = page.locator('#demo-output');
      await expect(demoOutput.locator('p')).toHaveCount(5);
      const combinedText = await demoOutput.textContent();
      expect(combinedText).toContain('Original array');
      expect(combinedText).toContain('After push(\'Elderberry\')');
      expect(combinedText).toContain("Index of 'Cherry': 1");
    });

    test('Verify DOM structure and content types remain stable (no unexpected mutations)', async ({ page }) => {
      // Sanity check: confirm button attributes, text, and output container properties
      const runButton = page.locator("button[onclick='runArrayDemo()']");
      await expect(runButton).toBeVisible();
      await expect(runButton).toHaveAttribute('onclick', 'runArrayDemo()');
      await expect(runButton).toHaveText('Run Array Demo');

      const demoOutput = page.locator('#demo-output');
      await expect(demoOutput).toBeVisible();
      // Ensure demo-output has a min-height style as defined in CSS (presence check, not value exactness)
      const minHeightStyle = await page.evaluate(() => {
        const el = document.getElementById('demo-output');
        return window.getComputedStyle(el).minHeight;
      });
      // The CSS specified min-height: 50px; the computed value should include 'px' and be non-empty
      expect(typeof minHeightStyle).toBe('string');
      expect(minHeightStyle.length).toBeGreaterThan(0);
    });
  });
});