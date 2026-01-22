import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7185df60-d362-11f0-85a0-d3271c47ca09.html';

/**
 * Page object representing the Queue demo page.
 * Encapsulates common selectors and actions to keep tests readable.
 */
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.header = page.locator('h1');
    this.queue = page.locator('.queue');
    this.buttons = page.locator('button');
    this.inputs = page.locator('input, textarea, select');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeaderText() {
    return this.header.innerText();
  }

  async isQueueVisible() {
    return this.queue.isVisible();
  }

  async countButtons() {
    return this.buttons.count();
  }

  async countInputs() {
    return this.inputs.count();
  }
}

test.describe('Queue Interactive Application (FSM: Idle)', () => {
  // collectors for console / page errors / failed requests
  let consoleMessages;
  let consoleErrors;
  let pageErrors;
  let failedRequests;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    failedRequests = [];

    // Capture all console.* messages
    page.on('console', msg => {
      const text = `${msg.type()}: ${msg.text()}`;
      consoleMessages.push(text);
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push(text);
      }
    });

    // Capture runtime errors (uncaught exceptions on the page)
    page.on('pageerror', err => {
      // err is an Error instance from the page context
      pageErrors.push(err && err.message ? String(err.message) : String(err));
    });

    // Capture failing network requests (e.g., missing script.js)
    page.on('requestfailed', request => {
      failedRequests.push(request);
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure page is closed in teardown to avoid leaking contexts between tests
    try {
      await page.close();
    } catch (e) {
      // ignore if already closed
    }
  });

  test('Idle state: Page renders header and queue element (renderPage entry)', async ({ page }) => {
    // This test validates the Idle state rendering evidence from the FSM:
    // - <h1>Queue</h1> is present
    // - <div class="queue"></div> is present
    //
    // It also observes console/page errors that may result from the declared entry action
    // renderPage() (which might be invoked by a missing/erroneous external script).
    const qp = new QueuePage(page);

    // Navigate to the application and wait for load
    await qp.goto();

    // Verify header text exists and matches expected evidence
    await expect(qp.header).toBeVisible();
    const headerText = await qp.getHeaderText();
    expect(headerText.trim()).toBe('Queue');

    // Verify the visual queue element exists and is visible
    await expect(qp.queue).toBeVisible();
    // Basic checks on the queue element: ensure width/height are non-zero (rendered)
    const box = await qp.queue.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);

    // There are no transitions/events in the FSM: assert there are no interactive controls
    const buttonCount = await qp.countButtons();
    const inputCount = await qp.countInputs();
    expect(buttonCount).toBe(0);
    expect(inputCount).toBe(0);

    // At this point we also expect that the application attempted any entry actions mentioned by the FSM.
    // The HTML references an external script ("script.js") which may be missing or may try to call renderPage().
    // Per the test runner instruction, we must observe console logs and page errors and assert that these errors occur.
    //
    // Accept any of these indicators as evidence that the entry action or script loading had an observable issue:
    // - a page error (uncaught exception) was recorded (e.g., ReferenceError: renderPage is not defined)
    // - a console error/warning mentioning script.js or "Failed to load resource" etc.
    // - a failed network request for script.js
    //
    // We intentionally do not modify the page or repair missing resources; we only observe and assert.
    const sawPageErrors = pageErrors.length > 0;
    const sawConsoleErrorsAboutScript = consoleErrors.some(m => /script\.js|renderPage|Failed to load resource|404|ERR_/i.test(m));
    const sawFailedScriptRequest = failedRequests.some(r => {
      try {
        return r.url().endsWith('/script.js') || r.url().includes('script.js');
      } catch {
        return false;
      }
    });

    // Log the captured diagnostic data to help debugging in CI logs
    // (These are plain side-effect console logs to make diagnosing failures easier)
    // eslint-disable-next-line no-console
    console.log('Captured console messages:', consoleMessages.slice(0, 20));
    // eslint-disable-next-line no-console
    console.log('Captured page errors:', pageErrors);
    // eslint-disable-next-line no-console
    console.log('Failed requests:', failedRequests.map(r => ({ url: r.url(), failure: r.failure() })));

    // Assert that at least one of the error indicators was observed.
    // This matches the requirement to let ReferenceError/SyntaxError/TypeError happen naturally and assert they occur.
    expect(sawPageErrors || sawConsoleErrorsAboutScript || sawFailedScriptRequest).toBe(true);
  });

  test('Entry action renderPage() should surface a ReferenceError when missing (edge-case check)', async ({ page }) => {
    // This test specifically looks for a ReferenceError mentioning "renderPage" in uncaught page errors.
    // It's an edge-case validation: if the external script attempted to call renderPage() and the function is undefined,
    // a ReferenceError should be observed. We do not alter the page to inject renderPage; we only observe.
    const qp = new QueuePage(page);
    await qp.goto();

    // Wait a short time to allow any async errors to surface
    await page.waitForTimeout(200); // small delay to capture errors that happen during page load

    // Check whether any page error mentions "renderPage"
    const renderPageError = pageErrors.find(msg => /renderPage/i.test(msg));
    if (renderPageError) {
      // We saw a page error referencing renderPage; assert that it looks like a ReferenceError message
      expect(/referenceerror/i.test(renderPageError)).toBe(true);
    } else {
      // If there was no explicit page error mentioning renderPage, assert that something failed to load (script.js)
      const failedScript = failedRequests.find(r => {
        try {
          return r.url().endsWith('/script.js') || r.url().includes('script.js');
        } catch {
          return false;
        }
      });
      const consoleMentionsScript = consoleMessages.some(m => /script\.js|Failed to load resource|404|ERR_/i.test(m));
      expect(Boolean(failedScript || consoleMentionsScript)).toBe(true);
    }
  });

  test('No transitions/events in FSM: user interactions do not change state (no interactive controls)', async ({ page }) => {
    // This test validates the FSM claim that there are no events/transitions by asserting
    // that interacting (clicks, input) does not cause new errors or DOM changes.
    const qp = new QueuePage(page);
    await qp.goto();

    // Capture initial snapshot of h1 and queue HTML
    const initialHeader = await qp.getHeaderText();
    const initialQueueHTML = await qp.queue.evaluate(el => el.innerHTML);

    // Try clicking on the queue element (should be safe; no transition expected)
    await qp.queue.click();

    // Try a double click and context click to simulate interactions
    await qp.queue.dblclick();
    await qp.queue.click({ button: 'right' });

    // Wait briefly for any potential side effects
    await page.waitForTimeout(100);

    // Ensure no new runtime errors appeared as a result of interactions
    // (We expect any pre-existing errors to already have been captured; ensure no new pageErrors were appended)
    // Note: We cannot easily know which errors are "new", but we can assert that pageErrors is defined (it is) and that interactions didn't crash the page.
    // At minimum, assert the header and queue structure remain unchanged.
    const afterHeader = await qp.getHeaderText();
    const afterQueueHTML = await qp.queue.evaluate(el => el.innerHTML);

    expect(afterHeader).toBe(initialHeader);
    expect(afterQueueHTML).toBe(initialQueueHTML);

    // Also assert that there are no interactive controls that could cause transitions
    const buttonCount = await qp.countButtons();
    expect(buttonCount).toBe(0);
  });

  test('Reload and navigation error observation (edge case): reloading should produce same observable errors', async ({ page }) => {
    // This test reloads the page to ensure that the same missing scripts/errors are reproducible on reload.
    const qp = new QueuePage(page);
    await qp.goto();

    // Clear previously collected diagnostics
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    failedRequests = [];

    // Perform a reload
    await page.reload({ waitUntil: 'load' });

    // Give time for any network failures or runtime errors to appear
    await page.waitForTimeout(200);

    // At least one of the previously expected error indicators should be present after reload
    const sawAnyError = pageErrors.length > 0 || consoleErrors.length > 0 || failedRequests.length > 0;

    // Log diagnostics
    // eslint-disable-next-line no-console
    console.log('Post-reload console messages:', consoleMessages.slice(0, 20));
    // eslint-disable-next-line no-console
    console.log('Post-reload page errors:', pageErrors);
    // eslint-disable-next-line no-console
    console.log('Post-reload failed requests:', failedRequests.map(r => ({ url: r.url(), failure: r.failure() })));

    expect(sawAnyError).toBe(true);
  });
});