import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8cb840-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the Deque Visualization app.
 * Encapsulates common interactions and queries against the page under test.
 */
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addButton = page.locator('#addButton');
    this.deque = page.locator('#deque');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getNodeCount() {
    return await this.page.locator('#deque .node').count();
  }

  async getNodeTexts() {
    return await this.page.$$eval('#deque .node', nodes => nodes.map(n => n.textContent));
  }

  async clickAdd(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.addButton.click();
    }
  }

  async getInlineTransform() {
    // Returns the inline style transform (e.g. 'scale(1.05)' or 'scale(1)' or '')
    return await this.page.evaluate(() => {
      const el = document.getElementById('deque');
      return el ? el.style.transform : null;
    });
  }

  async getComputedTransform() {
    // Returns computed transform matrix string (e.g. 'matrix(1.05, 0, 0, 1.05, 0, 0)' or 'none')
    return await this.page.evaluate(() => {
      const el = document.getElementById('deque');
      return el ? window.getComputedStyle(el).transform : null;
    });
  }

  // Wait until inline transform equals expected or timeout
  async waitForInlineTransform(expected, timeout = 1000) {
    await this.page.waitForFunction(
      (exp) => {
        const el = document.getElementById('deque');
        return el && el.style.transform === exp;
      },
      expected,
      { timeout }
    );
  }
}

test.describe('Deque Visualization - FSM validation', () => {
  // Collect console messages and page errors for each test to assert on them later.
  test.beforeEach(async ({ page }) => {
    // Avoid swallowing errors: let them happen naturally but record them.
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', msg => {
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      page._pageErrors.push(err);
    });
  });

  test('Initial state (S0_Idle): page loads with deque and Add Node button, initial nodes 1..5 present', async ({ page }) => {
    // Arrange
    const dq = new DequePage(page);
    await dq.goto();

    // Assert: Add button is visible and has correct text
    await expect(page.locator('#addButton')).toBeVisible();
    await expect(page.locator('#addButton')).toHaveText('Add Node');

    // Assert: deque element exists
    await expect(page.locator('#deque')).toBeVisible();

    // Assert: initial nodes count is 5 and their texts are 1..5 in order
    const count = await dq.getNodeCount();
    expect(count).toBe(5);

    const texts = await dq.getNodeTexts();
    expect(texts).toEqual(['1', '2', '3', '4', '5']);

    // Assert: initial transform is identity (computed style 'none' or matrix identity)
    const computed = await dq.getComputedTransform();
    // computed could be 'none' or 'matrix(1, 0, 0, 1, 0, 0)'
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(computed);

    // No runtime page errors or console errors should have occurred during load
    expect(page._pageErrors.length).toBe(0);
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('AddNode_Click transition (S0_Idle -> S1_NodeAdded): clicking adds a node and triggers temporary scale transform', async ({ page }) => {
    // This test validates the transition defined in the FSM:
    // - a new node element is appended with incremented count text
    // - deque.style.transform is set to 'scale(1.05)' then reset to 'scale(1)' after ~300ms

    const dq = new DequePage(page);
    await dq.goto();

    // Precondition: initial nodes are 5
    expect(await dq.getNodeCount()).toBe(5);

    // Act: click the Add Node button once
    await dq.clickAdd(1);

    // Immediately after click: a new node should be appended (count 6)
    expect(await dq.getNodeCount()).toBe(6);
    const textsAfter = await dq.getNodeTexts();
    expect(textsAfter[textsAfter.length - 1]).toBe('6');

    // Immediately after click, inline transform should be 'scale(1.05)'
    // The script sets deque.style.transform = 'scale(1.05)' synchronously on click
    const inlineAfterClick = await dq.getInlineTransform();
    expect(inlineAfterClick).toBe('scale(1.05)');

    // Wait a bit longer than the 300ms timeout in the app to allow it to reset
    await page.waitForTimeout(350);

    // After timeout, inline transform should have been set to 'scale(1)'
    const inlineAfterTimeout = await dq.getInlineTransform();
    expect(inlineAfterTimeout).toBe('scale(1)');

    // Also verify computed style transform corresponds to a scale(1) (matrix identity)
    const computedAfter = await dq.getComputedTransform();
    // Because the inline transform is 'scale(1)' computed transform may be the identity matrix
    expect(['matrix(1, 0, 0, 1, 0, 0)', 'none']).toContain(computedAfter);

    // Ensure no page errors or console errors happened during the interaction
    expect(page._pageErrors.length).toBe(0);
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Multiple rapid clicks: nodes append in order and transforms resolve correctly', async ({ page }) => {
    // This test checks behavior under quick repeated Add Node clicks (edge case)
    const dq = new DequePage(page);
    await dq.goto();

    // Precondition: 5 nodes
    expect(await dq.getNodeCount()).toBe(5);

    // Act: click Add Node 3 times rapidly
    await dq.clickAdd(3);

    // Immediately after clicks, expect 8 nodes total
    expect(await dq.getNodeCount()).toBe(8);

    // Validate the appended node texts are 6,7,8 in that order at the end
    const texts = await dq.getNodeTexts();
    const appended = texts.slice(-3);
    expect(appended).toEqual(['6', '7', '8']);

    // The script triggers a scale to 1.05 on each click; after all timeouts (300ms) expire,
    // the final inline transform should be set to 'scale(1)'. Wait sufficiently long.
    await page.waitForTimeout(600);

    const finalInline = await dq.getInlineTransform();
    expect(finalInline).toBe('scale(1)');

    // Compute transform and ensure identity
    const finalComputed = await dq.getComputedTransform();
    expect(['matrix(1, 0, 0, 1, 0, 0)', 'none']).toContain(finalComputed);

    // No runtime errors should have occurred
    expect(page._pageErrors.length).toBe(0);
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Sequential adds continue incrementing count and preserve order (additional transition checks)', async ({ page }) => {
    // This validates continued use: add another node and check the numbering continues.
    const dq = new DequePage(page);
    await dq.goto();

    // Add two nodes sequentially with small waits between to emulate typical user interaction.
    await dq.clickAdd(1);
    await page.waitForTimeout(100); // small pause; the script's transform timeout is independent
    await dq.clickAdd(1);

    // Wait for the transform reset from the last action
    await page.waitForTimeout(400);

    // Expect nodes to be 7 now (5 initial + 2)
    expect(await dq.getNodeCount()).toBe(7);

    const texts = await dq.getNodeTexts();
    expect(texts.slice(-2)).toEqual(['6', '7']);

    // Ensure transform ended up back to scale(1)
    const inline = await dq.getInlineTransform();
    expect(inline).toBe('scale(1)');

    // No page errors or console errors
    expect(page._pageErrors.length).toBe(0);
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console messages and page errors during load and interactions', async ({ page }) => {
    // This test purposely inspects recorded console and page errors arrays and asserts behavior.
    const dq = new DequePage(page);
    await dq.goto();

    // Perform several interactions
    await dq.clickAdd(2);
    await page.waitForTimeout(400);

    // We do not expect runtime exceptions in the page as the HTML/JS is valid.
    // Assert that no 'pageerror' events were emitted.
    expect(page._pageErrors.length).toBe(0);

    // Assert that there were no console messages of type 'error'
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // But record what console messages were observed for debugging purposes (non-failing)
    // We assert at least that we captured the console array as a valid JS array.
    expect(Array.isArray(page._consoleMessages)).toBe(true);
  });
});