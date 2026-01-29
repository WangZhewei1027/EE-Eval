import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b46bd0-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('SDLC Interactive Application - f0b46bd0-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Shared holders for console and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize arrays to capture console messages and page errors
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages (info, log, warning, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught exceptions reported by the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No special teardown required; listeners are tied to the page and cleared automatically.
    // This hook exists to satisfy explicit setup/teardown requirement.
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Initial render shows the demo button and hides the demo output', async ({ page }) => {
      // This test validates the FSM initial state S0_Idle:
      // - renderPage() conceptual entry action should have resulted in the button being present
      // - #demo-output should exist but be hidden (display: none)
      // - No runtime errors should have occurred during page load

      // Verify the demo button exists and has the expected text
      const demoBtn = await page.locator('#demo-btn');
      await expect(demoBtn).toBeVisible();
      await expect(demoBtn).toHaveText('Show SDLC Example Timeline');

      // Verify the demo output element exists in the DOM
      const demoOutput = await page.locator('#demo-output');
      await expect(demoOutput).toBeVisible({ timeout: 100 }).catch(async () => {
        // If Playwright's toBeVisible fails because the element is not visible (expected),
        // we will assert the computed style instead below.
      });

      // Check css display property: should be 'none' initially
      const displayBefore = await page.$eval('#demo-output', (el) => {
        // element may exist but be hidden via inline style
        return window.getComputedStyle(el).getPropertyValue('display');
      });
      expect(displayBefore).toBe('none');

      // Ensure there are no uncaught page errors (ReferenceError, SyntaxError, TypeError)
      const relevantPageErrors = pageErrors.filter((e) => {
        const msg = String(e && e.message ? e.message : e);
        return /ReferenceError|SyntaxError|TypeError/.test(msg);
      });
      expect(relevantPageErrors.length, `Expected no ReferenceError/SyntaxError/TypeError on load, found: ${relevantPageErrors.map(String).join('; ')}`).toBe(0);

      // Also ensure console did not emit error-level messages containing those error names
      const consoleErrors = consoleMessages.filter(c => c.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(c.text));
      expect(consoleErrors.length, `Unexpected console errors on initial load: ${consoleErrors.map(c => c.text).join(' | ')}`).toBe(0);
    });
  });

  test.describe('Transition: ShowExampleTimeline (S0_Idle -> S1_Example_Shown)', () => {
    test('Clicking the demo button displays the SDLC example timeline and updates innerHTML', async ({ page }) => {
      // This test validates the FSM transition triggered by ShowExampleTimeline:
      // - Clicking #demo-btn should set #demo-output.style.display = 'block'
      // - #demo-output.innerHTML should include the Sample SDLC Timeline heading and list items
      // - No runtime ReferenceError/SyntaxError/TypeError should occur as a result of the click

      const demoBtn = page.locator('#demo-btn');
      await expect(demoBtn).toBeVisible();

      // Click the button and wait a short time for DOM update
      await demoBtn.click();

      // After click, output should be displayed (inline style set to 'block')
      const displayAfter = await page.$eval('#demo-output', (el) => {
        return {
          computed: window.getComputedStyle(el).getPropertyValue('display'),
          inline: el.style.display,
        };
      });

      // The expected observable is '#demo-output is displayed'
      expect(displayAfter.computed === 'block' || displayAfter.inline === 'block').toBeTruthy();

      // Validate innerHTML content has expected fragments from the sample timeline
      const inner = await page.$eval('#demo-output', (el) => el.innerHTML);
      expect(inner).toContain('Sample SDLC Timeline');
      expect(inner).toContain('E-commerce Website Development');
      expect(inner).toContain('Planning (2 weeks)');
      expect(inner).toContain('Implementation (8 weeks)');
      expect(inner).toContain('Maintenance (Ongoing)');

      // Ensure no page errors of the specified types occurred due to the click
      const relevantPageErrors = pageErrors.filter((e) => {
        const msg = String(e && e.message ? e.message : e);
        return /ReferenceError|SyntaxError|TypeError/.test(msg);
      });
      expect(relevantPageErrors.length, `Expected no ReferenceError/SyntaxError/TypeError after click, found: ${relevantPageErrors.map(String).join('; ')}`).toBe(0);

      // Ensure console did not record inline errors for the action
      const consoleErrors = consoleMessages.filter(c => c.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(c.text));
      expect(consoleErrors.length, `Unexpected console errors after click: ${consoleErrors.map(c => c.text).join(' | ')}`).toBe(0);
    });

    test('Clicking the demo button multiple times does not duplicate content (idempotent behavior)', async ({ page }) => {
      // Edge case: multiple rapid clicks should not create duplicated nested content.
      // The implementation uses assignment to innerHTML, so repeated clicks should replace,
      // not append, resulting in a single header instance.

      const demoBtn = page.locator('#demo-btn');

      // Perform multiple rapid clicks
      await demoBtn.click();
      await demoBtn.click();
      await demoBtn.click();

      // Read innerHTML once clicks are complete
      const inner = await page.$eval('#demo-output', (el) => el.innerHTML);

      // Count occurrences of the main heading tag introduced by the script
      const headingOccurrences = (inner.match(/<h3[^>]*>[\s\S]*?<\/h3>/gi) || []).length;

      // Expect exactly one <h3> heading introduced (the script uses one <h3>).
      expect(headingOccurrences, 'Expected a single top-level <h3> in #demo-output even after multiple clicks').toBe(1);

      // Confirm the content is still visible
      const display = await page.$eval('#demo-output', (el) => window.getComputedStyle(el).getPropertyValue('display'));
      expect(display).toBe('block');

      // Ensure no runtime errors were produced by repeated interactions
      const relevantPageErrors = pageErrors.filter((e) => {
        const msg = String(e && e.message ? e.message : e);
        return /ReferenceError|SyntaxError|TypeError/.test(msg);
      });
      expect(relevantPageErrors.length).toBe(0);
    });
  });

  test.describe('Visual and DOM integrity checks after transition', () => {
    test('Demo output has expected structural elements and styling once shown', async ({ page }) => {
      // Validate structural and style aspects of the revealed output:
      // - presence of lists and paragraphs described in the sample
      // - background color style applied by page CSS (computed)
      // - ensures the #demo-output remains in the DOM and visible

      // Show the demo content
      await page.locator('#demo-btn').click();

      // Check that there is at least one <ul> and that list items are present
      const ulCount = await page.$$eval('#demo-output ul', (els) => els.length);
      expect(ulCount).toBeGreaterThanOrEqual(1);

      const listItemTexts = await page.$$eval('#demo-output ul li', (lis) => lis.map(l => l.textContent.trim()));
      expect(listItemTexts.some(t => /Planning/i.test(t))).toBeTruthy();
      expect(listItemTexts.some(t => /Implementation/i.test(t))).toBeTruthy();

      // Verify computed background-color of the demo output is set (the CSS sets #f0f0f0)
      const bgColor = await page.$eval('#demo-output', (el) => window.getComputedStyle(el).getPropertyValue('background-color'));
      expect(bgColor.length).toBeGreaterThan(0);

      // Ensure no page errors observed
      const relevantPageErrors = pageErrors.filter((e) => {
        const msg = String(e && e.message ? e.message : e);
        return /ReferenceError|SyntaxError|TypeError/.test(msg);
      });
      expect(relevantPageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and reporting', () => {
    test('Observe console and page errors: assert none of ReferenceError/SyntaxError/TypeError occurred', async ({ page }) => {
      // The test runner requirement is to observe console and page errors and assert about them.
      // Here we explicitly collect and assert that the common JS error types did NOT occur naturally.
      // If any such errors are present, this test will fail and report them.

      // (If further interactions are needed to reveal latent errors, perform a click)
      await page.locator('#demo-btn').click();

      // Consolidate pageErrors and consoleMessages for relevant error types
      const pageErrorMessages = pageErrors.map(e => (e && e.message) ? e.message : String(e));
      const consoleErrorMessages = consoleMessages
        .filter(c => c.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(c.text))
        .map(c => `[${c.type}] ${c.text}`);

      // Combine and filter for the three specific error kinds
      const combined = [...pageErrorMessages, ...consoleErrorMessages].filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));

      // Assert that none of those errors were observed
      expect(combined.length, `Found unexpected runtime errors: ${combined.join(' | ')}`).toBe(0);
    });

    test('Report any console.error messages for debugging purposes (failing the test if any exist)', async ({ page }) => {
      // This test ensures that any console.error messages produce a failing assertion,
      // highlighting unexpected issues surfaced by the application during interaction.

      // Trigger the UI to run its script
      await page.locator('#demo-btn').click();

      // Find console messages of type 'error'
      const errorConsoleEntries = consoleMessages.filter(c => c.type === 'error');

      // If there are error console entries, include them in the assertion message
      expect(errorConsoleEntries.length, `console.error messages detected: ${errorConsoleEntries.map(e => e.text).join(' | ')}`).toBe(0);
    });
  });
});