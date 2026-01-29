import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0441e6e2-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object to encapsulate interactions with the Heap page
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this.page.on('console', (msg) => {
      // Flatten console arguments into a single string if necessary
      try {
        const text = msg.text();
        this.consoleMessages.push(text);
      } catch (e) {
        // best-effort capture
        this.consoleMessages.push(String(msg));
      }
    });

    this.page.on('pageerror', (err) => {
      // err is an Error object: capture message + stack for inspection
      this.pageErrors.push(err);
    });
  }

  async goto() {
    // Navigate and wait for load; handlers are already registered in constructor
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('load');
    // Give any scripts a short time to run and potentially emit console/page errors
    await this.page.waitForTimeout(200);
  }

  // Controls
  heapifyUpButton() {
    return this.page.locator('.controls .button:nth-child(1)');
  }

  heapifyDownButton() {
    return this.page.locator('.controls .button:nth-child(2)');
  }

  title() {
    return this.page.locator('.title');
  }

  heapNodes() {
    return this.page.locator('.heap-node');
  }

  heapStructures() {
    return this.page.locator('.heap-structure');
  }

  // Convenience: click Heapify Up and allow handlers/timeouts to settle
  async clickHeapifyUp() {
    await this.heapifyUpButton().click();
    // allow potential scripts/handlers to run and emit console/page errors
    await this.page.waitForTimeout(200);
  }

  // Convenience: click Heapify Down and allow handlers/timeouts to settle
  async clickHeapifyDown() {
    await this.heapifyDownButton().click();
    // allow potential scripts/handlers to run and emit console/page errors
    await this.page.waitForTimeout(200);
  }

  // Access captured diagnostics
  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Heap (Max) FSM interactions - 0441e6e2-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Shared HeapPage instance per test
  test.beforeEach(async ({ page }, testInfo) => {
    // nothing here; each test will construct its own HeapPage
  });

  // Test the initial Idle state (S0_Idle) rendering & entry action evidence
  test('Initial Idle state renders controls and heap structure (renderPage onEnter evidence)', async ({ page }) => {
    // This test validates:
    // - The page renders the title, two controls, and the heap nodes (Idle state)
    // - The "renderPage" entry action should either log to console or produce an error if missing.
    const heap = new HeapPage(page);
    await heap.goto();

    // Assert title text
    await expect(heap.title()).toHaveText('Heap (Max)');

    // Assert two control buttons exist with expected text
    await expect(heap.heapifyUpButton()).toBeVisible();
    await expect(heap.heapifyDownButton()).toBeVisible();
    await expect(heap.heapifyUpButton()).toHaveText('Heapify Up');
    await expect(heap.heapifyDownButton()).toHaveText('Heapify Down');

    // Assert heap structure: there should be 3 heap-structure rows and 9 heap nodes as per HTML
    await expect(heap.heapStructures()).toHaveCount(3);
    await expect(heap.heapNodes()).toHaveCount(9);

    // Verify evidence of renderPage entry action:
    // The application may either log "renderPage" or call a function that does not exist and raise a page error.
    const consoleMsgs = heap.getConsoleMessages();
    const pageErrors = heap.getPageErrors();

    // Check for console evidence first
    const hasRenderLog = consoleMsgs.some((m) => /renderPage/i.test(m));

    // If no explicit renderPage console output, we expect that trying to call renderPage (if broken) produced an error.
    if (!hasRenderLog) {
      // We assert that at least one page error of common JS failure types occurred.
      // This follows the instruction to observe and assert runtime errors if they happen.
      const matchingError = pageErrors.find((e) =>
        /ReferenceError|TypeError|SyntaxError/i.test(String(e && e.message))
      );
      expect(matchingError, `Expected either a renderPage console log or a JS error on load. Console: ${JSON.stringify(consoleMsgs)}, Errors: ${JSON.stringify(pageErrors.map(e => e && e.message))}`).toBeTruthy();
    } else {
      // If renderPage log exists, make a gentle assertion that it appears in the console messages
      expect(hasRenderLog).toBeTruthy();
    }
  });

  // Test transition: Heapify Up (S0_Idle -> S1_Heapified_Up)
  test('Heapify Up button click triggers Heapified Up transition (performHeapifyUp evidence)', async ({ page }) => {
    // This test validates:
    // - Clicking the Heapify Up control triggers the intended transition
    // - Evidence of the action is observed in console logs or page errors
    const heap = new HeapPage(page);
    await heap.goto();

    // Click the Heapify Up button
    await heap.clickHeapifyUp();

    // After click, inspect console messages and page errors for evidence.
    const consoleMsgs = heap.getConsoleMessages();
    const pageErrors = heap.getPageErrors();

    // Looking for a console message like "Heapify Up button clicked" or similar
    const hasHeapifyUpLog = consoleMsgs.some((m) => /heapify up/i.test(m) || /heapifyup/i.test(m) || /Heapify Up button clicked/i.test(m));

    if (!hasHeapifyUpLog) {
      // If no log, we expect that a runtime error may have occurred as per the instruction to observe errors.
      const matchingError = pageErrors.find((e) =>
        /ReferenceError|TypeError|SyntaxError/i.test(String(e && e.message))
      );
      expect(matchingError, `Expected either a Heapify Up console log or a JS error after clicking Heapify Up. Console: ${JSON.stringify(consoleMsgs)}, Errors: ${JSON.stringify(pageErrors.map(e => e && e.message))}`).toBeTruthy();
    } else {
      expect(hasHeapifyUpLog).toBeTruthy();
    }

    // DOM expectations for the transition:
    // The FSM evidence mentions "Heap structure updated to reflect heapify up".
    // The provided HTML does not include explicit data to validate numeric heap order, so at minimum
    // verify the heap node elements are still present and no elements were unexpectedly removed.
    await expect(heap.heapNodes()).toHaveCount(9);
  });

  // Test transition: Heapify Down (S0_Idle -> S2_Heapified_Down)
  test('Heapify Down button click triggers Heapified Down transition (performHeapifyDown evidence)', async ({ page }) => {
    // This test validates:
    // - Clicking the Heapify Down control triggers the intended transition
    // - Evidence of the action is observed in console logs or page errors
    const heap = new HeapPage(page);
    await heap.goto();

    // Click the Heapify Down button
    await heap.clickHeapifyDown();

    // Inspect console messages and page errors for evidence.
    const consoleMsgs = heap.getConsoleMessages();
    const pageErrors = heap.getPageErrors();

    const hasHeapifyDownLog = consoleMsgs.some((m) => /heapify down/i.test(m) || /heapifydown/i.test(m) || /Heapify Down button clicked/i.test(m));

    if (!hasHeapifyDownLog) {
      // If no console evidence, assert that a runtime error occurred consistent with letting errors happen naturally.
      const matchingError = pageErrors.find((e) =>
        /ReferenceError|TypeError|SyntaxError/i.test(String(e && e.message))
      );
      expect(matchingError, `Expected either a Heapify Down console log or a JS error after clicking Heapify Down. Console: ${JSON.stringify(consoleMsgs)}, Errors: ${JSON.stringify(pageErrors.map(e => e && e.message))}`).toBeTruthy();
    } else {
      expect(hasHeapifyDownLog).toBeTruthy();
    }

    // Verify heap nodes remain present (no destructive DOM change expected)
    await expect(heap.heapNodes()).toHaveCount(9);
  });

  // Edge case: Rapid double-clicks and repeated interactions should not cause unhandled exceptions beyond those we expect at load
  test('Edge cases: rapid repeated clicks and error observation', async ({ page }) => {
    // This test validates:
    // - Rapid interaction with controls (double/triple clicks) is handled (or any errors are observed)
    // - We capture and assert that runtime errors (ReferenceError/TypeError/SyntaxError) occur if present
    const heap = new HeapPage(page);
    await heap.goto();

    // Rapidly click Heapify Up several times
    await Promise.all([
      heap.heapifyUpButton().click(),
      heap.heapifyUpButton().click(),
      heap.heapifyUpButton().click()
    ]);
    // Allow handlers to run
    await page.waitForTimeout(200);

    // Rapidly click Heapify Down several times
    await Promise.all([
      heap.heapifyDownButton().click(),
      heap.heapifyDownButton().click(),
      heap.heapifyDownButton().click()
    ]);
    await page.waitForTimeout(200);

    // Collect diagnostics
    const consoleMsgs = heap.getConsoleMessages();
    const pageErrors = heap.getPageErrors();

    // There are two acceptable outcomes per instructions:
    // 1) The app logs expected messages about heapify operations (preferred)
    // 2) The app throws JS runtime errors (we must observe and assert them)
    const hasHeapifyLogs = consoleMsgs.some((m) => /heapify up/i.test(m) || /heapify down/i.test(m) || /Heapify Up/i.test(m) || /Heapify Down/i.test(m));

    if (!hasHeapifyLogs) {
      // Ensure we have observed at least one JS runtime error matching expected patterns
      const matchingError = pageErrors.find((e) =>
        /ReferenceError|TypeError|SyntaxError/i.test(String(e && e.message))
      );
      expect(matchingError, `Expected heapify logs or JS runtime errors after rapid clicks. Console: ${JSON.stringify(consoleMsgs)}, Errors: ${JSON.stringify(pageErrors.map(e => e && e.message))}`).toBeTruthy();
    } else {
      // If logs exist, sanity-check that logs mention one of the expected actions
      expect(hasHeapifyLogs).toBeTruthy();
    }

    // Final sanity: ensure heap nodes still exist
    await expect(heap.heapNodes()).toHaveCount(9);
  });

  // Dedicated test to assert that at least one JS runtime error of the expected types occurred
  // as per the instruction to let such errors happen and assert them.
  test('Runtime error observation: expect a ReferenceError/TypeError/SyntaxError to have occurred', async ({ page }) => {
    // This test is explicitly checking for JS runtime errors emitted while loading/interacting.
    const heap = new HeapPage(page);
    await heap.goto();

    // Try to provoke additional errors by clicking both buttons once each
    // (If errors already occurred on load, they will be captured; otherwise clicks may trigger them.)
    await heap.clickHeapifyUp();
    await heap.clickHeapifyDown();

    // If no errors are captured yet, wait a short time to allow delayed errors to occur
    if (heap.getPageErrors().length === 0) {
      // Wait for a potential pageerror event (short timeout)
      try {
        const err = await page.waitForEvent('pageerror', { timeout: 1500 });
        // push into our HeapPage captured errors (handlers already do this), but ensure present
        expect(err).toBeTruthy();
      } catch (e) {
        // No pageerror emitted during this short window: make a failing assertion because the specification
        // requires we observe and assert runtime errors as part of this exercise.
        const diagnostics = {
          console: heap.getConsoleMessages(),
          errors: heap.getPageErrors().map((er) => er && er.message)
        };
        throw new Error(`Expected a runtime JS error (ReferenceError, TypeError, or SyntaxError) to occur but none were observed. Diagnostics: ${JSON.stringify(diagnostics)}`);
      }
    }

    // Final assertion: at least one captured page error matches one of the expected error classes
    const found = heap.getPageErrors().find((e) => /ReferenceError|TypeError|SyntaxError/i.test(String(e && e.message)));
    expect(found, `Expected at least one ReferenceError/TypeError/SyntaxError. Observed errors: ${JSON.stringify(heap.getPageErrors().map(e => e && e.message))}`).toBeTruthy();
  });
});