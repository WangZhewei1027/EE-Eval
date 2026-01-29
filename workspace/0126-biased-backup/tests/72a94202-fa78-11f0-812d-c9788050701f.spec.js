import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a94202-fa78-11f0-812d-c9788050701f.html';

// Page Object for interacting with the Heap visualization page
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertBtn = page.locator('#insert-btn');
    this.extractBtn = page.locator('#extract-btn');
    this.status = page.locator('#status');
    this.heapContainer = page.locator('#heap-container');
    this.nodeLocator = page.locator('.node');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for initial render to complete (script does renderHeap and initial transitions)
    await this.page.waitForTimeout(600); // small delay to allow initial animation scheduling
  }

  async clickInsert() {
    await this.insertBtn.click();
  }

  async clickExtract() {
    await this.extractBtn.click();
  }

  async nodeCount() {
    return await this.nodeLocator.count();
  }

  async statusText() {
    return (await this.status.textContent())?.trim() ?? '';
  }

  async rootText() {
    // the root is the first .node in DOM order representing root
    const root = this.page.locator('.node').first();
    return (await root.textContent())?.trim() ?? null;
  }

  async isRootHighlighted() {
    const root = this.page.locator('.node').first();
    return await root.evaluate(node => node.classList.contains('highlight'));
  }

  async hasInsertAnimation() {
    return await this.page.locator('.node.insert-animation').count() > 0;
  }

  async hasExtractAnimation() {
    return await this.page.locator('.node.extract-animation').count() > 0;
  }

  async waitForStatusContains(substring, timeout = 2000) {
    await expect(this.status).toHaveText(new RegExp(substring), { timeout });
  }

  async waitForStatusRegex(regex, timeout = 2000) {
    await expect(this.status).toHaveText(regex, { timeout });
  }

  // Call an already-existing function defined on the page (renderHeap)
  // This invokes global renderHeap if present; we do not define or modify it.
  async callRenderHeap() {
    await this.page.evaluate(() => {
      if (typeof renderHeap === 'function') {
        renderHeap();
      }
    });
  }
}

test.describe('Max Heap Visualization - FSM compliance and DOM behavior', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {HeapPage} */
  let heapPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Each test gets a fresh context to isolate console/pageerror listeners
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages and uncaught page errors so tests can assert on them
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // store messages for later assertions; do not modify runtime
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', err => {
      // capture uncaught exceptions from the page
      pageErrors.push(err);
    });

    heapPage = new HeapPage(page);
    await heapPage.goto();
  });

  test.afterEach(async () => {
    // If there were any page errors we include them in the test output by failing with details.
    // But tests below also explicitly assert that there are no unexpected errors.
    // Close page context
    await page.context().close();
  });

  test.describe('Initial rendering and visual state (S1_HeapWithElements)', () => {
    test('Initial page should render heap with elements and show S1 evidence', async () => {
      // This validates the onEnter(renderHeap) produced a non-empty heap visual representation.
      // Expect status to indicate current heap size and root value as per FSM evidence for S1.
      await expect(heapPage.status).toHaveText(/^Current heap size: \d+\. Root value: \d+/, { timeout: 2000 });

      const count = await heapPage.nodeCount();
      // The HTML implementation inserts 5 initial random elements on load. Ensure at least 1 node is present.
      expect(count).toBeGreaterThanOrEqual(1);

      // Root should be visually highlighted as per renderHeap implementation
      expect(await heapPage.isRootHighlighted()).toBe(true);

      // Assert no uncaught page errors or console errors of critical types happened during load
      expect(pageErrors.length, `Page had unexpected errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Console had unexpected error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    });
  });

  test.describe('InsertRandomValue event and transitions (S0->S1, S1->S1)', () => {
    test('Clicking Insert Random Value increases heap size and updates status (S1->S1)', async () => {
      // Record initial node count and root
      const initialCount = await heapPage.nodeCount();
      const initialRoot = await heapPage.rootText();

      // Click insert
      await heapPage.clickInsert();

      // Immediately after clicking, the function should set status to "Inserted value: ..." synchronously
      await heapPage.waitForStatusRegex(/^Inserted value: \d+\. Current heap size: \d+\. Root value: \d+/, 2000);

      // New node should be present (count increased by 1)
      const newCount = await heapPage.nodeCount();
      expect(newCount).toBe(initialCount + 1);

      // Insert animation is applied to the newly-added node briefly
      // Check that insert-animation appears at least transiently
      const hadInsertAnimation = await heapPage.hasInsertAnimation();
      expect(hadInsertAnimation).toBe(true);

      // After the animation timeout (1s in implementation + small buffer), the insert-animation class should be removed
      await page.waitForTimeout(1200);
      const stillHasInsertAnimation = await heapPage.hasInsertAnimation();
      expect(stillHasInsertAnimation).toBe(false);

      // Root value should be present and status root value should be a number
      const statusText = await heapPage.statusText();
      expect(statusText).toMatch(/Root value: \d+/);

      // No page-level uncaught errors or console error messages
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Inserting repeatedly until heap is full triggers heap-full status (edge case)', async () => {
      // Determine how many inserts required to reach max visualization limit (15)
      // We read current DOM node count and insert until 15 then attempt one extra to trigger full-case status
      let current = await heapPage.nodeCount();
      const target = 15;
      const toInsert = Math.max(0, target - current);

      for (let i = 0; i < toInsert; i++) {
        await heapPage.clickInsert();
        // Wait for insert to complete
        await heapPage.waitForStatusRegex(/^Inserted value: \d+\. Current heap size: \d+\. Root value: \d+/, 2000);
        // small gap to allow DOM changes
        await page.waitForTimeout(50);
      }

      // Now heap should be at max (or very close). Attempt one more insert to provoke the "Heap is full" branch.
      await heapPage.clickInsert();

      // The implementation sets status text directly when insert fails due to max size.
      // Wait for the specific full message (exact text in implementation).
      await expect(heapPage.status).toHaveText('Heap is full (maximum size reached for visualization)', { timeout: 2000 });

      // Validate node count did not exceed the max size
      const finalCount = await heapPage.nodeCount();
      expect(finalCount).toBeLessThanOrEqual(15);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('ExtractMax event and transitions (S1->S1 and S1->S0)', () => {
    test('Clicking Extract Max animates root and decreases heap size (S1->S1)', async () => {
      const initialCount = await heapPage.nodeCount();
      expect(initialCount).toBeGreaterThan(0);

      // Capture current root text to compare later if necessary
      const initialRoot = await heapPage.rootText();

      // Click extract - animation happens, then after ~1s heap is re-rendered and status updated
      await heapPage.clickExtract();

      // Immediately after click the root should have extract-animation class
      // Give a tiny delay to allow class to be added
      await page.waitForTimeout(50);
      const hasExtractAnim = await heapPage.hasExtractAnimation();
      expect(hasExtractAnim).toBe(true);

      // Wait for the status to reflect extraction outcome
      await heapPage.waitForStatusRegex(/^Extracted max value: \d+\. Current heap size: \d+\./, 2000);

      // Node count should decrease by 1 (unless heap size was 1 and became 0)
      const afterCount = await heapPage.nodeCount();
      expect(afterCount).toBe(initialCount - 1);

      // After animation timeout classes should be cleaned up
      await page.waitForTimeout(200); // a short wait to ensure DOM stabilizes
      const stillExtractAnim = await heapPage.hasExtractAnimation();
      expect(stillExtractAnim).toBe(false);

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Extracting until empty results in S0 evidence and "Nothing to extract" edge-case behavior', async () => {
      // First, extract repeatedly until the heap is empty.
      // We'll iteratively click extract until node count becomes 0 (or safety limit)
      let safety = 30; // avoid infinite loops in case of unexpected behavior
      let count = await heapPage.nodeCount();
      while (count > 0 && safety-- > 0) {
        await heapPage.clickExtract();
        // Wait for the extraction status to appear (or "Heap is empty. Nothing to extract." in some branches)
        await heapPage.waitForStatusRegex(/^Extracted max value: \d+\. Current heap size: \d+\.|Heap is empty\. Nothing to extract\./, 2000);
        // wait a bit for DOM to re-render
        await page.waitForTimeout(200);
        count = await heapPage.nodeCount();
      }

      // At this point heap should be empty in DOM
      expect(count).toBe(0);

      // The FSM expects that renderHeap() (on entering S0) sets the status to the specific message:
      // 'Heap is empty. Click "Insert Random Value" to add elements.'
      // The extract flow overwrote renderHeap's message; to validate S0 evidence we invoke the existing renderHeap function
      // defined by the page (we are not modifying/patching it, only invoking it).
      await heapPage.callRenderHeap();
      await expect(heapPage.status).toHaveText('Heap is empty. Click "Insert Random Value" to add elements.', { timeout: 1000 });

      // Edge case: clicking extract when already empty should set 'Heap is empty. Nothing to extract.'
      await heapPage.clickExtract();
      await expect(heapPage.status).toHaveText('Heap is empty. Nothing to extract.', { timeout: 1000 });

      // Now insert to transition back to S1 from S0 and verify insertion works from empty state
      await heapPage.clickInsert();
      await heapPage.waitForStatusRegex(/^Inserted value: \d+\. Current heap size: \d+\. Root value: \d+/, 2000);
      const postInsertCount = await heapPage.nodeCount();
      expect(postInsertCount).toBeGreaterThan(0);

      // No uncaught errors during the whole sequence
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Instrumentation: Console and runtime error observation', () => {
    test('No unexpected ReferenceError/SyntaxError/TypeError or other uncaught page errors occurred', async () => {
      // This test explicitly inspects collected console messages and page errors and ensures
      // there are no uncaught exceptions of the critical categories.
      // We allow benign console logs but disallow console.error and page errors.

      // Inspect collected page errors
      if (pageErrors.length > 0) {
        // Fail with detailed error messages included
        const messages = pageErrors.map(e => (e && e.message) ? e.message : String(e)).join(' | ');
        throw new Error(`Unexpected page errors were thrown: ${messages}`);
      }

      // Inspect console error messages for critical JS error patterns
      const consoleErrorMessages = consoleMessages
        .filter(m => m.type === 'error')
        .map(m => m.text);

      // Check that none of the console error messages look like ReferenceError/SyntaxError/TypeError
      const problematic = consoleErrorMessages.filter(text =>
        /ReferenceError|SyntaxError|TypeError/.test(text)
      );
      if (problematic.length > 0) {
        throw new Error('Found console errors indicative of runtime JS errors: ' + problematic.join(' | '));
      }

      // As an extra assertion, ensure there are no console.error messages at all (implementation should not emit them)
      expect(consoleErrorMessages.length, `Unexpected console.error messages: ${consoleErrorMessages.join(' | ')}`).toBe(0);
    });
  });
});