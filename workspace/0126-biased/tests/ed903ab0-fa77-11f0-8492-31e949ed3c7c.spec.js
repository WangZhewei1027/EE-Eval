import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed903ab0-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the Decision Trees Visualization page.
 * Encapsulates selectors and common interactions.
 */
class DecisionTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.containerSelector = '.container';
    this.titleSelector = 'h1';
    this.descriptionSelector = '.description';
    this.treeContainerSelector = '.tree-container';
    this.nodeSelector = '.node';
    this.buttonSelector = '.button';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getTitleText() {
    return this.page.textContent(this.titleSelector);
  }

  async getDescriptionText() {
    return this.page.textContent(this.descriptionSelector);
  }

  async getNodeCount() {
    return this.page.locator(this.nodeSelector).count();
  }

  async getButtonText() {
    return this.page.textContent(this.buttonSelector);
  }

  async getButtonOnclickAttr() {
    return this.page.getAttribute(this.buttonSelector, 'onclick');
  }

  async clickLearnMore() {
    // Use click and wait for dialog event externally (caller should await dialog)
    await this.page.click(this.buttonSelector);
  }

  async boundingBoxesOfNodes() {
    const nodes = this.page.locator(this.nodeSelector);
    const count = await nodes.count();
    const boxes = [];
    for (let i = 0; i < count; i++) {
      const handle = await nodes.nth(i);
      const box = await handle.boundingBox();
      boxes.push(box);
    }
    return boxes;
  }

  async getTreeContainerHtml() {
    return this.page.innerHTML(this.treeContainerSelector);
  }
}

test.describe('Beautiful Decision Trees Visualization - FSM Tests (ed903ab0-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Arrays to capture console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      // Collect text to help debugging if needed
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      // store error object for assertions
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // small sanity: ensure page is still reachable after interactions
    await expect(page).toHaveURL(/127\.0\.0\.1/);
  });

  test('S0_Idle - Initial render: elements, layout, and attributes are present', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) evidence:
    // - Page title and description render
    // - Tree container and 7 nodes exist
    // - Learn More button exists with the expected onclick attribute
    const dt = new DecisionTreePage(page);

    // Verify title and description text are present
    const title = await dt.getTitleText();
    expect(title).toBeTruthy();
    expect(title.trim()).toContain('Decision Trees');

    const desc = await dt.getDescriptionText();
    expect(desc).toBeTruthy();
    expect(desc.trim()).toContain('Observe the beauty of decision-making');

    // Verify tree container and nodes
    const nodeCount = await dt.getNodeCount();
    // The HTML lists 7 nodes: Root, Left, Right, and 4 grandchildren
    expect(nodeCount).toBe(7);

    // Verify button exists and has the expected text and onclick attribute
    const btnText = (await dt.getButtonText()).trim();
    expect(btnText).toBe('Learn More');

    const onclickAttr = await dt.getButtonOnclickAttr();
    // The FSM evidence expects: alert('This is an informative visualization of Decision Trees!')
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert('This is an informative visualization of Decision Trees!')");

    // Verify no unexpected page errors occurred during load
    expect(pageErrors).toEqual([]);
    // There may be no console messages or some; at least ensure capturing works
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Transition LearnMore_Click -> S1_AlertDisplayed: clicking Learn More triggers an alert dialog', async ({ page }) => {
    // This test validates the event and transition:
    // - Clicking the .button should create an alert with the expected message
    const dt = new DecisionTreePage(page);

    // Prepare to capture the dialog
    const expectedMessage = "This is an informative visualization of Decision Trees!";

    // Start waiting for the dialog before clicking to avoid race condition
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click(dt.buttonSelector),
    ]);

    // Validate dialog properties (type and message)
    expect(dialog).toBeTruthy();
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe(expectedMessage);

    // Accept the alert to continue
    await dialog.accept();

    // After accepting, ensure page dom stays intact (button still present)
    const btnTextAfter = await dt.getButtonText();
    expect(btnTextAfter.trim()).toBe('Learn More');

    // Ensure no unexpected page errors were emitted
    expect(pageErrors).toEqual([]);
  });

  test('Verify entry action renderPage() is not defined and causes ReferenceError when invoked (onEnter verification)', async ({ page }) => {
    // The FSM lists an entry action "renderPage()". The HTML/JS does not implement it.
    // According to the testing rules we must let ReferenceError happen naturally and assert it occurs.
    // We will call renderPage() via page.evaluate and assert the thrown error is a ReferenceError.
    let caughtError = null;
    try {
      // Attempt to call the missing function in page context
      await page.evaluate(() => {
        // Intentionally call a function that is not defined on the page
        // This should throw a ReferenceError in the page context and be surfaced by Playwright.
        // We do NOT define renderPage anywhere; this is to validate the FSM's entry action expectation.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      caughtError = err;
    }

    // The evaluate should have thrown; assert that an error was caught
    expect(caughtError).toBeTruthy();
    // The message should indicate a ReferenceError or include the function name
    const msg = String(caughtError.message || caughtError);
    expect(msg).toMatch(/renderPage|ReferenceError/);

    // Additionally, a pageerror event is expected to have been emitted for the ReferenceError
    // Confirm that at least one pageError was captured and its message matches
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const found = pageErrors.some((errObj) => {
      const text = String(errObj.message || errObj);
      return /renderPage|ReferenceError/.test(text);
    });
    expect(found).toBe(true);
  });

  test('Edge case: Clicking Learn More multiple times triggers alert each time', async ({ page }) => {
    // Validate that repeated clicks each produce an alert with the same message
    const dt = new DecisionTreePage(page);
    const expectedMessage = "This is an informative visualization of Decision Trees!";

    // We'll click the button three times sequentially and assert dialog each time
    for (let i = 0; i < 3; i++) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click(dt.buttonSelector),
      ]);
      expect(dialog).toBeTruthy();
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe(expectedMessage);
      await dialog.accept();
    }

    // Ensure no page errors were emitted during these interactions
    expect(pageErrors).toEqual([]);
  });

  test('DOM stability: alert does not modify the tree structure or node positions', async ({ page }) => {
    // Capture DOM snapshot and bounding boxes before and after alert to ensure no visual DOM changes
    const dt = new DecisionTreePage(page);

    const beforeHtml = await dt.getTreeContainerHtml();
    const beforeBoxes = await dt.boundingBoxesOfNodes();

    // Trigger an alert and accept it
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click(dt.buttonSelector),
    ]);
    await dialog.accept();

    // Capture after state
    const afterHtml = await dt.getTreeContainerHtml();
    const afterBoxes = await dt.boundingBoxesOfNodes();

    // The innerHTML of the tree container should remain the same
    expect(afterHtml).toBe(beforeHtml);

    // Bounding boxes should be present and corresponding nodes should still exist.
    // Exact pixel equality might be affected by animations, but ensure same number and approximate positions.
    expect(afterBoxes.length).toBe(beforeBoxes.length);
    for (let i = 0; i < beforeBoxes.length; i++) {
      const b = beforeBoxes[i];
      const a = afterBoxes[i];
      // Basic sanity checks: bounding boxes exist and are of similar size and location
      expect(a).toBeTruthy();
      // Tolerate small differences; ensure difference is within 5 pixels (allowing for minimal layout changes)
      const dx = Math.abs((a.x || 0) - (b.x || 0));
      const dy = Math.abs((a.y || 0) - (b.y || 0));
      const dw = Math.abs((a.width || 0) - (b.width || 0));
      const dh = Math.abs((a.height || 0) - (b.height || 0));
      expect(dx).toBeLessThanOrEqual(5);
      expect(dy).toBeLessThanOrEqual(5);
      expect(dw).toBeLessThanOrEqual(5);
      expect(dh).toBeLessThanOrEqual(5);
    }

    // No page errors expected here
    expect(pageErrors).toEqual([]);
  });

  test('Observability: console and error listeners capture messages; no unexpected runtime errors on normal use', async ({ page }) => {
    // This test validates that normal page usage (render + single alert) does not produce runtime errors
    const dt = new DecisionTreePage(page);

    // Ensure at least the console listener is capturing (we will not assert on messages contents)
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Trigger a single alert
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click(dt.buttonSelector),
    ]);
    await dialog.accept();

    // After normal usage, ensure no page errors (except those intentionally caused in the other test)
    // Because tests are isolated, pageErrors here should be empty
    expect(pageErrors).toEqual([]);
  });
});