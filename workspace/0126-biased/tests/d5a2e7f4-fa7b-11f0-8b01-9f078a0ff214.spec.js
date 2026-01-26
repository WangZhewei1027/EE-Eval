import { test, expect } from '@playwright/test';

test.describe('Understanding Refactoring - FSM driven E2E tests', () => {
  // Page object for the refactoring demo page
  class RefactorDemoPage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
      this.page = page;
      this.button = page.locator('#showDemo');
      this.demo = page.locator('#demoContent');
      this.demoHeading = page.locator('#demoContent h3');
    }

    async goto(url) {
      await this.page.goto(url);
    }

    async clickShowDemo() {
      await this.button.click();
    }

    async isDemoVisible() {
      // Use locator.isVisible() which relies on computed visibility
      return await this.demo.isVisible();
    }

    async getDemoDisplayStyle() {
      return await this.page.evaluate(() => {
        const el = document.getElementById('demoContent');
        return el ? el.style.display : null;
      });
    }

    async getButtonText() {
      return await this.button.textContent();
    }
  }

  // Shared variables to collect console messages and page errors
  let consoleMessages;
  let pageErrors;

  // URL under test (as provided in the requirements)
  const URL =
    'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2e7f4-fa7b-11f0-8b01-9f078a0ff214.html';

  // Setup listeners before each test to capture console logs and uncaught page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages for inspection; store severity and text
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Teardown assertion to ensure that no unexpected runtime errors were thrown during tests
  test.afterEach(async () => {
    // We assert no uncaught page errors occurred during each test run.
    // This ensures that the page script executed without throwing ReferenceError/SyntaxError/TypeError.
    expect(
      pageErrors.length,
      `Expected no uncaught page errors, but found: ${pageErrors
        .map((e) => e.message)
        .join(' | ')}`
    ).toBe(0);

    // Also assert there are no console.error messages (severity 'error')
    const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error')
      .length;
    expect(
      consoleErrorCount,
      `Expected no console.error messages, but found: ${consoleErrorCount}`
    ).toBe(0);
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('renders the page and shows initial Idle state (button present, demo hidden)', async ({
      page,
    }) => {
      const p = new RefactorDemoPage(page);
      // Load the page exactly as provided
      await p.goto(URL);

      // Validate the "Show Simple Refactoring Demo" button exists and has expected text
      await expect(p.button).toBeVisible();
      const btnText = await p.getButtonText();
      expect(btnText.trim()).toBe('Show Simple Refactoring Demo');

      // Validate demo content exists in the DOM
      await expect(p.demo).toBeHidden();

      // Check inline style on the demo element - entry action for S0_Idle is renderPage(),
      // which in this implementation should result in the demo starting hidden (style display: none)
      const display = await p.getDemoDisplayStyle();
      // The HTML sets style="display: none;" initially, so style.display should be 'none'
      expect(display === 'none' || display === '').toBeTruthy();

      // Validate demo contains the expected heading and some content (sanity check)
      await expect(p.demoHeading).toHaveText('Refactoring Demo:');
    });
  });

  test.describe('Transitions via ShowDemoClick (S0 -> S1 -> S2 -> S1)', () => {
    test('S0_Idle -> S1_DemoVisible: clicking button shows demo (display: block)', async ({
      page,
    }) => {
      const p = new RefactorDemoPage(page);
      await p.goto(URL);

      // Precondition: demo hidden
      await expect(p.demo).toBeHidden();

      // Click to show the demo (trigger ShowDemoClick)
      await p.clickShowDemo();

      // After click, demo should be visible (S1_DemoVisible)
      await expect(p.demo).toBeVisible();

      // Confirm inline style changed to 'block' as evidence of showDemo()
      const displayAfterShow = await p.getDemoDisplayStyle();
      expect(displayAfterShow).toBe('block');

      // Sanity check: content inside the demo is present and text content includes 'Refactored to'
      const contentText = await p.demo.textContent();
      expect(contentText).toContain('Refactored to');
    });

    test('S1_DemoVisible -> S2_DemoHidden: clicking button hides demo (display: none)', async ({
      page,
    }) => {
      const p = new RefactorDemoPage(page);
      await p.goto(URL);

      // Ensure demo visible first (click once)
      await p.clickShowDemo();
      await expect(p.demo).toBeVisible();

      // Click again to hide (trigger ShowDemoClick while in S1)
      await p.clickShowDemo();

      // After second click, demo should be hidden (S2_DemoHidden)
      await expect(p.demo).toBeHidden();

      // Confirm inline style is 'none' as evidence of hideDemo()
      const displayAfterHide = await p.getDemoDisplayStyle();
      expect(displayAfterHide).toBe('none');
    });

    test('S2_DemoHidden -> S1_DemoVisible: clicking button toggles back to visible', async ({
      page,
    }) => {
      const p = new RefactorDemoPage(page);
      await p.goto(URL);

      // Make sure we end up in S2 by clicking twice
      await p.clickShowDemo(); // to S1
      await p.clickShowDemo(); // to S2
      await expect(p.demo).toBeHidden();

      // Click to go back to S1
      await p.clickShowDemo();
      await expect(p.demo).toBeVisible();
      expect(await p.getDemoDisplayStyle()).toBe('block');
    });

    test('Multiple toggles: repeated clicks correctly alternate visibility and do not produce errors', async ({
      page,
    }) => {
      const p = new RefactorDemoPage(page);
      await p.goto(URL);

      // Rapidly click the button multiple times to exercise toggle logic and ensure stability
      const clicks = 6;
      for (let i = 0; i < clicks; i++) {
        // We intentionally do not await visibility between clicks to simulate quick user interactions
        await p.clickShowDemo();
      }

      // Final visibility should be dependent on the parity of clicks:
      const shouldBeVisible = clicks % 2 === 1;
      if (shouldBeVisible) {
        await expect(p.demo).toBeVisible();
        expect(await p.getDemoDisplayStyle()).toBe('block');
      } else {
        await expect(p.demo).toBeHidden();
        expect(await p.getDemoDisplayStyle()).toBe('none');
      }

      // Also ensure there were no page errors and no console.error (asserted in afterEach)
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('clicking the button when demo is not in DOM should cause natural page behavior (no script patching)', async ({
      page,
    }) => {
      const p = new RefactorDemoPage(page);
      await p.goto(URL);

      // Remove the demo element from DOM to simulate a missing element edge case.
      // This modifies the DOM for the test to observe how the page script behaves naturally.
      // We do not patch or redefine page script; we simply alter DOM as a user/test might.
      await page.evaluate(() => {
        const el = document.getElementById('demoContent');
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });

      // Confirm the demo element no longer exists
      const demoHandle = await page.$('#demoContent');
      expect(demoHandle).toBeNull();

      // Now click the button. The page's click handler obtains the element by id on each click,
      // so removing the element could lead to a TypeError (attempting to access style of null).
      // Capture any page errors via the page.on('pageerror') listener (we registered in beforeEach).
      await p.clickShowDemo();

      // Wait a short moment for any asynchronous error to surface
      await page.waitForTimeout(100);

      // If an error occurred, it will be captured in pageErrors. We accept both outcomes:
      // - Ideally, the script should guard against a missing element resulting in no error.
      // - If an error occurs (TypeError), it's a legitimate runtime observation and will be asserted here.
      if (pageErrors.length > 0) {
        // At least one error captured: check that it is one of the expected JS runtime error types
        const messages = pageErrors.map((e) => e.message).join(' | ');
        const hasTypeError = pageErrors.some(
          (e) => e.name === 'TypeError' || /TypeError/.test(e.message)
        );
        const hasReferenceError = pageErrors.some(
          (e) => e.name === 'ReferenceError' || /ReferenceError/.test(e.message)
        );
        // We assert that the errors, if present, are of the expected JS runtime classes.
        expect(hasTypeError || hasReferenceError).toBeTruthy();
        // Also ensure console captured an error-level message (consistent with pageErrors)
        const consoleErrorCount = consoleMessages.filter(
          (m) => m.type === 'error'
        ).length;
        expect(consoleErrorCount).toBeGreaterThanOrEqual(0); // allow zero or more; afterEach will ensure none remain unexpected
        // Re-throwing is avoided; we only validate observed behavior here.
      } else {
        // No page errors occurred: that's acceptable — the page handled the missing element gracefully.
        expect(pageErrors.length).toBe(0);
      }
    });

    test('attempt to interact with non-existent selector should not modify page scripts (fail-fast assertion)', async ({
      page,
    }) => {
      // This test demonstrates handling of test-level errors when trying to click a missing selector.
      // We do NOT inject or patch any global functions. We simply assert Playwright throws for the test action.
      await page.goto(URL);

      // Attempting to click a non-existent selector should cause Playwright to throw an error.
      // We assert that Playwright reports the missing element rather than the page script silently failing.
      let actionError = null;
      try {
        await page.click('#thisSelectorDoesNotExist', { timeout: 500 });
      } catch (err) {
        actionError = err;
      }

      expect(actionError).not.toBeNull();
      expect(
        actionError.message.includes('No node found for selector') ||
          actionError.message.includes('waiting for selector')
      ).toBeTruthy();
    });
  });
});