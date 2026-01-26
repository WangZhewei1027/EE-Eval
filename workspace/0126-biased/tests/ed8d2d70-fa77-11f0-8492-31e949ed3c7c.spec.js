import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d2d70-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Heap application
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('#heap-container');
    this.startButton = page.locator("button[onclick='startHeap()']");
    this.resetButton = page.locator("button[onclick='resetHeap()']");
    this.nodeLocator = this.container.locator('.heap-node');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async startHeap() {
    await this.startButton.click();
  }

  async resetHeap() {
    await this.resetButton.click();
  }

  async getNodeCount() {
    return await this.nodeLocator.count();
  }

  async getNodeTexts() {
    const count = await this.getNodeCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.nodeLocator.nth(i).innerText());
    }
    return texts;
  }

  async getNodeTransforms() {
    const count = await this.getNodeCount();
    const transforms = [];
    for (let i = 0; i < count; i++) {
      const style = await this.nodeLocator.nth(i).evaluate((el) => getComputedStyle(el).transform || el.style.transform);
      transforms.push(style);
    }
    return transforms;
  }

  async isHeapContainerEmpty() {
    return (await this.getNodeCount()) === 0;
  }
}

test.describe('Max Heap Visualization - FSM states and transitions', () => {
  // Collect console errors and page errors for each test separately
  test.beforeEach(async ({ page }) => {
    // Ensure a clean environment for each test
    await page.setViewportSize({ width: 900, height: 800 });
  });

  test('Initial Idle state: page renders Start/Reset controls and heap is not displayed', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle) evidence:
    // - Start and Reset buttons exist
    // - heap container exists and initially has no heap nodes rendered
    // - there are no severe console errors on initial load
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Verify Start and Reset controls are present with expected selectors/text
    await expect(heapPage.startButton).toBeVisible();
    await expect(heapPage.resetButton).toBeVisible();
    await expect(heapPage.startButton).toHaveText('Start');
    await expect(heapPage.resetButton).toHaveText('Reset');

    // Heap container exists
    await expect(page.locator('#heap-container')).toBeVisible();

    // At initial load, no .heap-node elements should be present (Idle before Start)
    const empty = await heapPage.isHeapContainerEmpty();
    expect(empty).toBe(true);

    // The FSM initial state's entry_actions included "renderPage()" in the model,
    // but the page does not define renderPage(). We assert that no unexpected
    // console errors occurred during natural page load.
    expect(consoleErrors.length, 'No console errors should be emitted on page load').toBe(0);
    expect(pageErrors.length, 'No page errors should be emitted on page load').toBe(0);
  });

  test('StartHeap event: clicking Start displays the heap nodes (transition S0_Idle -> S1_HeapDisplayed)', async ({ page }) => {
    // This test validates:
    // - clicking the Start button triggers the displayHeap() behavior
    // - heap nodes are created and their text content matches the initial heap values
    // - nodes have transform style applied (visual placement)
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Start the heap visualization
    await heapPage.startHeap();

    // The implementation's initial heap array: [30, 20, 25, 15, 10, 5];
    const expectedValues = ['30', '20', '25', '15', '10', '5'];

    // Wait for nodes to appear (up to any default timeout)
    await expect(heapPage.container.locator('.heap-node')).toHaveCount(expectedValues.length);

    const nodeTexts = await heapPage.getNodeTexts();
    // The order of appended nodes should correspond to heap.forEach order (index order)
    expect(nodeTexts).toEqual(expectedValues);

    // Ensure transform styles were applied (visual placement)
    const transforms = await heapPage.getNodeTransforms();
    transforms.forEach((t) => {
      // transform should contain "translate(" when set via style.transform
      expect(t.toString().toLowerCase().includes('matrix') || t.toString().toLowerCase().includes('translate')).toBeTruthy();
    });

    // No runtime console/page errors expected as displayHeap should be defined and work
    expect(consoleErrors.length, 'No console errors expected after Start').toBe(0);
    expect(pageErrors.length, 'No page errors expected after Start').toBe(0);
  });

  test('ResetHeap event: clicking Reset when heap is displayed resets to initial values (transition S1_HeapDisplayed -> S1_HeapDisplayed)', async ({ page }) => {
    // This test validates:
    // - Reset action sets heap back to initial array and re-displays nodes
    // - Clicking Reset before or after Start behaves consistently
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Start first to ensure heap is displayed
    await heapPage.startHeap();
    await expect(heapPage.nodeLocator).toHaveCount(6);

    // Simulate some user interaction: double-click start quickly (should not break)
    await heapPage.startHeap();

    // Now click Reset to trigger resetHeap()
    await heapPage.resetHeap();

    // After reset, heap should still show the same initial values
    const expectedValues = ['30', '20', '25', '15', '10', '5'];
    await expect(heapPage.nodeLocator).toHaveCount(expectedValues.length);
    const nodeTexts = await heapPage.getNodeTexts();
    expect(nodeTexts).toEqual(expectedValues);

    // No severe errors should have occurred in normal reset flow
    expect(consoleErrors.length, 'No console errors expected after Reset').toBe(0);
    expect(pageErrors.length, 'No page errors expected after Reset').toBe(0);
  });

  test('ResetHeap before Start: clicking Reset when Idle should display the heap (edge case)', async ({ page }) => {
    // This test checks the edge case where Reset is pressed before Start.
    // According to implementation resetHeap() sets the heap array and calls displayHeap(),
    // so Reset should also render the heap even if Start was not pressed first.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Click Reset from the Idle state
    await heapPage.resetHeap();

    const expectedValues = ['30', '20', '25', '15', '10', '5'];
    await expect(heapPage.nodeLocator).toHaveCount(expectedValues.length);
    const nodeTexts = await heapPage.getNodeTexts();
    expect(nodeTexts).toEqual(expectedValues);

    expect(consoleErrors.length, 'No console errors expected after Reset from Idle').toBe(0);
    expect(pageErrors.length, 'No page errors expected after Reset from Idle').toBe(0);
  });

  test('Sanity checks: verify internal expected functions presence/absence and consequences', async ({ page }) => {
    // This test inspects existence of functions referenced in FSM:
    // - displayHeap, startHeap, resetHeap should be defined on window
    // - renderPage is referenced by FSM entry_actions but not defined in the HTML implementation
    // We assert presence/absence and demonstrate that invoking an undefined entry action would raise a ReferenceError.
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Validate functions that should exist
    const hasDisplayHeap = await page.evaluate(() => typeof window.displayHeap === 'function');
    const hasStartHeap = await page.evaluate(() => typeof window.startHeap === 'function');
    const hasResetHeap = await page.evaluate(() => typeof window.resetHeap === 'function');

    expect(hasDisplayHeap).toBe(true);
    expect(hasStartHeap).toBe(true);
    expect(hasResetHeap).toBe(true);

    // The FSM's entry_actions included renderPage(), but this is not implemented in the page.
    // We check that it is undefined and that invoking it would cause a ReferenceError in the page context.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Intentionally invoke renderPage() within the page context and assert a ReferenceError is thrown.
    // We do this in a try/catch because evaluate will reject if the function is not defined.
    let caughtError = null;
    try {
      // This will throw in page context: ReferenceError: renderPage is not defined
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError, 'Calling undefined renderPage() should reject with an error').not.toBeNull();
    // The error message for a missing function typically includes "renderPage is not defined" or similar.
    expect(String(caughtError.message)).toMatch(/renderPage|is not defined/);
  });

  test('Error observation: ensure no unexpected ReferenceError/SyntaxError/TypeError occur during normal flows', async ({ page }) => {
    // This test registers listeners to observe console and page errors while performing normal operations.
    // It ensures the normal use-cases (Start/Reset) do not produce typical runtime errors.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // collect everything categorized as error
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Normal usage: Start then Reset then Start quickly
    await heapPage.startHeap();
    await heapPage.resetHeap();
    await heapPage.startHeap();

    // Allow microtasks to process
    await page.waitForTimeout(100);

    // Assert that none of the captured errors are ReferenceError, SyntaxError, or TypeError
    const combinedErrors = consoleErrors.concat(pageErrors).join('\n');
    const hasProblematicError = /ReferenceError|SyntaxError|TypeError/i.test(combinedErrors);
    expect(hasProblematicError, `No ReferenceError/SyntaxError/TypeError should occur. Collected: ${combinedErrors}`).toBe(false);
  });

  test('Robustness: rapid repeated Start/Reset clicks do not cause uncaught exceptions', async ({ page }) => {
    // This test stresses the controls by clicking Start and Reset rapidly and ensures no pageerrors are emitted.
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Rapid interactions
    for (let i = 0; i < 5; i++) {
      await heapPage.startHeap();
      await heapPage.resetHeap();
    }

    // Give a moment for any asynchronous errors to surface
    await page.waitForTimeout(200);

    // Expect no page errors from the rapid interactions
    expect(pageErrors.length, 'No page errors should be emitted during rapid interactions').toBe(0);
  });
});