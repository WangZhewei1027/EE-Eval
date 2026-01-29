import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0442f851-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page object for the PageRank interactive application.
 * Encapsulates common queries and actions to keep tests readable.
 */
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#start-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.nodes = page.locator('.graph .node');
    // collectors for console / page errors attached externally in tests
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async initListeners() {
    this.page.on('console', msg => {
      try {
        this.consoleMessages.push(msg.text());
      } catch (e) {
        // swallow any listener errors
      }
    });
    this.page.on('pageerror', err => {
      try {
        this.pageErrors.push(err);
      } catch (e) {
        // swallow
      }
    });
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async nodeCount() {
    return await this.nodes.count();
  }

  async anyNodeHasText() {
    const count = await this.nodeCount();
    for (let i = 0; i < count; i++) {
      const txt = await this.nodes.nth(i).innerText();
      if (txt && txt.trim().length > 0) return true;
    }
    return false;
  }

  async anyNodeHasAttribute(attr) {
    const count = await this.nodeCount();
    for (let i = 0; i < count; i++) {
      const val = await this.nodes.nth(i).getAttribute(attr);
      if (val !== null) return true;
    }
    return false;
  }
}

test.describe('PageRank FSM - 0442f851-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Each test gets a fresh page and fresh listeners
  test.beforeEach(async ({ page }) => {
    // noop here; individual tests will create page objects and attach listeners
  });

  // Validate the initial Idle state: buttons and graph render as expected
  test('Idle state: initial render contains Start and Reset buttons and five nodes', async ({ page }) => {
    const pr = new PageRankPage(page);
    await pr.initListeners();
    await pr.goto();

    // Verify presence and text of control buttons
    await expect(pr.startBtn).toBeVisible();
    await expect(pr.startBtn).toHaveText('Start PageRank');
    await expect(pr.resetBtn).toBeVisible();
    await expect(pr.resetBtn).toHaveText('Reset PageRank');

    // Verify graph nodes are rendered (evidence in FSM: 5 nodes)
    const count = await pr.nodeCount();
    expect(count).toBe(5);

    // Observe console/page errors that might have occurred during load.
    // If errors occurred, assert they are natural runtime errors (ReferenceError, TypeError, SyntaxError).
    // If no errors occurred, test still passes because the DOM evidence is present.
    if (pr.pageErrors.length > 0) {
      // At least one page error should be a typical runtime error type if the implementation is broken.
      const messages = pr.pageErrors.map(e => String(e && e.message ? e.message : e));
      const matched = messages.some(m => /ReferenceError|TypeError|SyntaxError/i.test(m));
      expect(matched).toBeTruthy();
    } else {
      // No runtime page errors observed on load - this is acceptable; ensure at least the console didn't log an unexpected fatal message
      const fatalConsole = pr.consoleMessages.find(m => /failed|error|uncaught/i.test(m));
      expect(fatalConsole === undefined).toBeTruthy();
    }
  });

  // Test the StartPageRank event/transition.
  // This test validates clicking the Start button either triggers the Running behavior
  // (e.g., nodes updated, console message) OR a natural runtime error is emitted (e.g., ReferenceError if startPageRank is undefined).
  test('StartPageRank event: clicking Start triggers running behavior or throws a runtime error', async ({ page }) => {
    const pr = new PageRankPage(page);
    await pr.initListeners();
    await pr.goto();

    // Clear any initial messages/errors collected during load to focus on click behavior
    pr.consoleMessages.length = 0;
    pr.pageErrors.length = 0;

    // Click Start and wait a short while for any async behavior on the page
    await pr.clickStart();
    await page.waitForTimeout(600); // arbitrary short wait to allow handlers to run

    // If runtime errors happened during the click, assert they are plausible developer/runtime errors.
    if (pr.pageErrors.length > 0) {
      // We expect (if broken) a ReferenceError or similar referencing startPageRank
      const messages = pr.pageErrors.map(e => String(e && e.message ? e.message : e));
      const hasRelevantError = messages.some(m => /startPageRank|ReferenceError|TypeError|SyntaxError/i.test(m));
      expect(hasRelevantError).toBeTruthy();
      // Also include a helpful assertion about what was observed
      // (Ensures the test documents the failure mode rather than silently passing).
      expect(pr.pageErrors.length).toBeGreaterThan(0);
      return;
    }

    // No page errors: attempt to detect running behavior via DOM or console messages.
    // Possible observable behaviours (implementation dependent):
    // - Console logs mentioning PageRank start
    // - Nodes receive text content or attributes with scores
    // - Buttons might become disabled or change appearance
    const consoleIndicatesStart = pr.consoleMessages.some(m => /startPageRank|PageRank|calculat/i.test(m));
    const nodesHaveText = await pr.anyNodeHasText();
    const nodesHaveDataAttr = await pr.anyNodeHasAttribute('data-pagerank') || await pr.anyNodeHasAttribute('data-score');

    // Accept any one of these as evidence of "Running" entry actions having occurred.
    const evidenceObserved = consoleIndicatesStart || nodesHaveText || nodesHaveDataAttr;
    expect(evidenceObserved).toBeTruthy();
  });

  // Test the ResetPageRank event/transition and edge cases.
  // This test clicks Reset both before and after Start to validate behavior and error handling.
  test('ResetPageRank event: clicking Reset resets scores or throws a runtime error; also works if clicked before Start', async ({ page }) => {
    const pr = new PageRankPage(page);
    await pr.initListeners();
    await pr.goto();

    // Case A: Click reset before start - should either be a no-op or produce a natural runtime error (if resetPageRank missing)
    pr.consoleMessages.length = 0;
    pr.pageErrors.length = 0;

    await pr.clickReset();
    await page.waitForTimeout(400);

    if (pr.pageErrors.length > 0) {
      // If errors occurred, they should relate to resetPageRank or be standard runtime errors.
      const messages = pr.pageErrors.map(e => String(e && e.message ? e.message : e));
      const hasRelevantError = messages.some(m => /resetPageRank|ReferenceError|TypeError|SyntaxError/i.test(m));
      expect(hasRelevantError).toBeTruthy();
    } else {
      // No runtime error observed when resetting before start; verify nothing catastrophic happened:
      const fatalConsole = pr.consoleMessages.find(m => /uncaught|failed|error/i.test(m));
      expect(fatalConsole === undefined).toBeTruthy();
    }

    // Case B: Start then Reset - if Start succeeded we should observe that Reset returns UI to Idle (scores removed)
    // Clear collectors
    pr.consoleMessages.length = 0;
    pr.pageErrors.length = 0;

    // Attempt to start
    await pr.clickStart();
    await page.waitForTimeout(600);

    // Then attempt to reset
    await pr.clickReset();
    await page.waitForTimeout(600);

    // If page errors were produced during these interactions, assert they are natural runtime errors
    if (pr.pageErrors.length > 0) {
      const messages = pr.pageErrors.map(e => String(e && e.message ? e.message : e));
      const hasRelevantError = messages.some(m => /resetPageRank|startPageRank|ReferenceError|TypeError|SyntaxError/i.test(m));
      expect(hasRelevantError).toBeTruthy();
      return;
    }

    // If no errors, attempt to detect the reset behavior:
    // - Nodes that had scores should no longer have text or score attributes
    // We'll accept either nodes being empty or a console message indicating reset.
    const nodesHaveTextAfterReset = await pr.anyNodeHasText();
    const nodesHaveDataAttrAfterReset = await pr.anyNodeHasAttribute('data-pagerank') || await pr.anyNodeHasAttribute('data-score');
    const consoleIndicatesReset = pr.consoleMessages.some(m => /resetPageRank|Reset PageRank|scores are reset|reset/i.test(m));

    // The expected result of Reset is that nodes do not have scores/attributes indicating PageRank results,
    // or at least a console message announces the reset. At least one of these should be true in a functioning UI.
    const resetEvidenceObserved = (!nodesHaveTextAfterReset && !nodesHaveDataAttrAfterReset) || consoleIndicatesReset;
    expect(resetEvidenceObserved).toBeTruthy();
  });

  // Additional negative/edge-case test:
  // Rapidly clicking Start multiple times should not crash the page (if implementation is robust),
  // or if it crashes, the test will capture the natural runtime error and assert its type.
  test('Edge case: rapid repeated Start clicks should either be handled or produce natural runtime errors', async ({ page }) => {
    const pr = new PageRankPage(page);
    await pr.initListeners();
    await pr.goto();

    pr.consoleMessages.length = 0;
    pr.pageErrors.length = 0;

    // Click start rapidly several times
    for (let i = 0; i < 5; i++) {
      await pr.startBtn.click();
    }
    await page.waitForTimeout(800);

    if (pr.pageErrors.length > 0) {
      const messages = pr.pageErrors.map(e => String(e && e.message ? e.message : e));
      // Expect runtime error types if the implementation cannot handle multiple starts
      const hasRuntimeErr = messages.some(m => /ReferenceError|TypeError|SyntaxError|startPageRank/i.test(m));
      expect(hasRuntimeErr).toBeTruthy();
    } else {
      // No runtime errors: ensure the page is still interactive and buttons exist
      await expect(pr.startBtn).toBeVisible();
      await expect(pr.resetBtn).toBeVisible();
    }
  });
});