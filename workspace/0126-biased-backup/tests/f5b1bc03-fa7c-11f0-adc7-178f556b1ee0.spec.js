import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b1bc03-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page Object for the Two Pointers demo page.
 * Encapsulates basic interactions and queries to keep tests readable.
 */
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async demoButton() {
    return this.page.locator('#two-pointers-demo');
  }

  async clickDemoButton() {
    await (await this.demoButton()).click();
  }

  async getHeaderText() {
    return this.page.locator('h1').innerText();
  }

  async getAllParagraphsText() {
    return this.page.locator('.container p').allInnerTexts();
  }

  async preContents() {
    return this.page.locator('pre').allInnerTexts();
  }
}

test.describe('Application f5b1bc03-fa7c-11f0-adc7-178f556b1ee0 - Two Pointers FSM tests', () => {
  // Containers for captured runtime diagnostics per test
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate before each test so we capture page errors/console from load time
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      // Capture text and type (log, error, warn, etc.)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', err => {
      // Push the Error object for later assertions
      pageErrors.push(err);
    });

    const twoPointers = new TwoPointersPage(page);
    await twoPointers.goto();
  });

  test.afterEach(async () => {
    // noop - hooks are present for clarity/teardown extension if needed
  });

  test.describe('Idle State (S0_Idle) - initial rendering', () => {
    test('renders the page and shows the Run Two Pointers Example button', async ({ page }) => {
      // Validate initial DOM elements and content are present (Idle state's evidence)
      const twoPointers = new TwoPointersPage(page);

      // The button should exist and be visible with correct text
      const btn = await twoPointers.demoButton();
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText('Run Two Pointers Example');

      // Basic content checks: header and paragraphs exist
      const header = await twoPointers.getHeaderText();
      expect(header).toBe('Two Pointers');

      const paragraphs = await twoPointers.getAllParagraphsText();
      // There should be multiple descriptive paragraphs about the concept
      expect(paragraphs.length).toBeGreaterThanOrEqual(5);

      // The page includes <pre> blocks showing algorithm snippets (evidence)
      const pres = await twoPointers.preContents();
      expect(pres.length).toBeGreaterThanOrEqual(2);
      // Pre blocks should contain the words 'binarySearch' and 'mergeSort' as visible text examples
      const joinedPres = pres.join('\n');
      expect(joinedPres.includes('binarySearch')).toBeTruthy();
      expect(joinedPres.includes('mergeSort')).toBeTruthy();
    });

    test('page load triggers a runtime ReferenceError because binarySearch is invoked but not defined', async ({ page }) => {
      // This application intentionally attempts to call binarySearch() from a script block,
      // but the function is only shown inside <pre> tags (not executed), so a ReferenceError
      // is expected and must be observed (per test instructions to not patch or fix the page).
      // We assert that the pageerror event fired and that its message references binarySearch.
      // Wait briefly to ensure pageerror events have fired
      await page.waitForTimeout(200);

      // There should be at least one page error captured
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Find an error message referencing binarySearch and being a ReferenceError (or includes 'not defined')
      const matching = pageErrors.find(err => {
        const msg = String(err && err.message);
        return msg.includes('binarySearch') || /is not defined/.test(msg) || /ReferenceError/.test(msg);
      });
      expect(matching).toBeTruthy();

      // Ensure that no successful "Target ... found" console logs were emitted during page load,
      // because the ReferenceError would prevent the runtime console.log for the demo from executing.
      const foundLog = consoleMessages.find(m => /Target\s+7\s+found/i.test(m.text) || /found at position/i.test(m.text));
      expect(foundLog).toBeUndefined();
    });
  });

  test.describe('Event: RunDemo (click #two-pointers-demo) and Transition to S1_DemoRunning', () => {
    test('clicking the demo button does not crash the test runner but does not produce the expected success log (no binarySearch implementation)', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);

      // Capture counts before interaction
      const initialPageErrorsCount = pageErrors.length;
      const initialConsoleCount = consoleMessages.length;

      // Click the demo button (FSM expects this to trigger runBinarySearch() and produce a console.log)
      // In the current implementation there is no click handler attached, but we must exercise the event.
      await twoPointers.clickDemoButton();

      // Give the page a moment to produce any new logs or errors that might result from the click
      await page.waitForTimeout(200);

      // Verify button still present (no transition in DOM to a different UI state occurred)
      const btn = await twoPointers.demoButton();
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText('Run Two Pointers Example');

      // Confirm no new pageerror was produced by the click (the main ReferenceError occurred during load)
      expect(pageErrors.length).toBe(initialPageErrorsCount);

      // Confirm that the expected FSM observable (console.log Target ... found at position ...) did NOT occur,
      // since binarySearch is not defined and therefore could not run.
      const newConsoleMessages = consoleMessages.slice(initialConsoleCount);
      const successMsg = newConsoleMessages.find(m => /Target\s+7\s+found/i.test(m.text) || /found at position/i.test(m.text));
      expect(successMsg).toBeUndefined();
    });

    test('multiple clicks do not attach a handler or create additional runtime errors', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);

      const beforeErrors = pageErrors.length;

      // Click the button multiple times rapidly to test edge case behavior
      await twoPointers.clickDemoButton();
      await twoPointers.clickDemoButton();
      await twoPointers.clickDemoButton();

      // Small wait to allow any asynchronous errors to surface
      await page.waitForTimeout(300);

      // No new page errors should have been added by clicking (they occurred at load time)
      expect(pageErrors.length).toBe(beforeErrors);

      // Button should remain present and active in the DOM
      const btn = await twoPointers.demoButton();
      await expect(btn).toBeVisible();
    });
  });

  test.describe('FSM expectations and negative assertions', () => {
    test('FSM transition expected observable (console.log of found result) is absent and appropriate error evidence exists', async ({ page }) => {
      // This test ties back to the FSM: transitioning from S0_Idle to S1_DemoRunning expects a binarySearch
      // run and a console.log of the result. Given the page implementation, we must assert that this observable
      // did not appear and that the page error evidence referencing binarySearch exists.
      await page.waitForTimeout(200);

      // Assert that no console log shows "Target 7 found at position" or similar
      const successLog = consoleMessages.find(m => /Target\s+7\s+found/i.test(m.text) || /found at position/i.test(m.text));
      expect(successLog).toBeUndefined();

      // Assert that pageErrors includes a ReferenceError or message indicating binarySearch is not defined
      const binarySearchError = pageErrors.find(err => {
        const msg = String(err && err.message);
        return msg.includes('binarySearch') || /is not defined/.test(msg) || /ReferenceError/.test(msg);
      });
      expect(binarySearchError).toBeTruthy();

      // Check that the error stack/message contains the script location (best-effort check)
      // We allow either a simple message or a full stack; presence of the message above is primary.
      expect(String(binarySearchError.message).length).toBeGreaterThan(0);
    });
  });

  test.describe('Content integrity and resilience', () => {
    test('page textual content remains intact after interactions', async ({ page }) => {
      const twoPointers = new TwoPointersPage(page);

      // Ensure base content exists
      const header = await twoPointers.getHeaderText();
      expect(header).toBe('Two Pointers');

      const paras = await twoPointers.getAllParagraphsText();
      expect(paras.some(p => p.includes('Two Pointers is a programming concept'))).toBeTruthy();

      // Click the demo button and assert content unchanged
      await twoPointers.clickDemoButton();
      await page.waitForTimeout(100);
      const headerAfter = await twoPointers.getHeaderText();
      expect(headerAfter).toBe('Two Pointers');

      const parasAfter = await twoPointers.getAllParagraphsText();
      expect(parasAfter.length).toBe(paras.length);
    });
  });
});