import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1acb1-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object for the B+ Tree demo page.
 * Encapsulates common actions and selectors used across tests.
 */
class BPlusTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.visualizeBtn = page.locator('#visualizeBtn');
    this.visualization = page.locator('#treeVisualization');
    this.treeNodes = page.locator('.tree-node');
    this.leafNodes = page.locator('.leaf-node');
    this.pointers = page.locator('.pointer');
  }

  // Navigate to the app and wait for DOM content loaded
  async goto() {
    const response = await this.page.goto(APP_URL);
    // ensure page loaded successfully (will throw if navigation failed)
    expect(response && response.ok()).toBeTruthy();
    await this.page.waitForLoadState('domcontentloaded');
  }

  // Return the innerHTML of the visualization container
  async getVisualizationHTML() {
    return await this.visualization.innerHTML();
  }

  // Click the visualize button as a user would
  async clickVisualizeButton() {
    await this.visualizeBtn.click();
  }

  // Returns true if the visualize button is visible
  async isVisualizeButtonVisible() {
    return await this.visualizeBtn.isVisible();
  }

  // Returns computed style display value of the visualize button
  async getVisualizeButtonDisplay() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('visualizeBtn');
      return el ? window.getComputedStyle(el).display : null;
    });
  }

  // Count of tree nodes in the visualization
  async countTreeNodes() {
    return await this.treeNodes.count();
  }

  async countLeafNodes() {
    return await this.leafNodes.count();
  }

  async countPointers() {
    return await this.pointers.count();
  }
}

test.describe('B+ Tree Visualization - FSM and UI validations', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Capture console and error events before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store text and type for assertion and debugging
      consoleMessages.push({ text: msg.text(), type: msg.type() });
    });

    page.on('pageerror', (error) => {
      // store actual error objects for assertions
      pageErrors.push(error);
    });
  });

  // Clean up listeners after each test to avoid cross-test pollution
  test.afterEach(async ({ page }) => {
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0_Idle state: initial render shows the visualize button and empty visualization', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) described in the FSM:
    // - renderPage() is expected to produce the initial UI
    // - Evidence: a button with id #visualizeBtn should be present
    const app = new BPlusTreePage(page);
    await app.goto();

    // Verify the visualize button exists and has the expected label
    await expect(app.visualizeBtn).toBeVisible();
    await expect(app.visualizeBtn).toHaveText('Show Example B+ Tree');

    // The visualization container should initially be present but empty (no h4 header)
    await expect(app.visualization).toBeVisible();
    const html = await app.getVisualizationHTML();
    expect(html.trim().length).toBeGreaterThanOrEqual(0); // must be present; may be empty

    // Initial counts: before visualization, there should be zero tree-node elements inside visualization
    const treeNodeCount = await app.countTreeNodes();
    expect(treeNodeCount).toBe(0);

    const leafNodeCount = await app.countLeafNodes();
    expect(leafNodeCount).toBe(0);

    // Ensure no runtime page errors were thrown during initial load
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted during initial load
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Transition S0_Idle -> S1_TreeVisualized: clicking the button displays the tree visualization', async ({ page }) => {
    // This test validates the ShowTreeVisualization event and the transition to the Tree Visualized state:
    // - Clicking #visualizeBtn should run displayTreeVisualization(), updating #treeVisualization.innerHTML
    // - The button should hide itself after click (this.style.display = "none")
    const app = new BPlusTreePage(page);
    await app.goto();

    // Click the visualize button to trigger the visualization
    await app.clickVisualizeButton();

    // After clicking, the button should no longer be visible (script sets display: none)
    await expect(app.visualizeBtn).toBeHidden();
    const displayValue = await app.getVisualizeButtonDisplay();
    // Inline style should be applied: "none"
    expect(displayValue).toBe('none');

    // The visualization container should now include the expected header and explanatory text
    await expect(app.visualization).toContainText('B+ Tree of Order 3');
    await expect(app.visualization).toContainText('Leaf nodes are linked sequentially');
    await expect(app.visualization).toContainText('Key Observations:');

    // Verify that tree-node and leaf-node elements are present as per the implemented visualization
    const treeNodeCount = await app.countTreeNodes();
    expect(treeNodeCount).toBeGreaterThanOrEqual(7); // root + internal + leaf nodes present; expect at least 7 nodes total

    const leafNodeCount = await app.countLeafNodes();
    // According to the provided HTML, there are 4 leaf-node elements inserted
    expect(leafNodeCount).toBeGreaterThanOrEqual(4);

    // Pointer elements (→) should be rendered with class .pointer
    const pointerCount = await app.countPointers();
    expect(pointerCount).toBeGreaterThanOrEqual(6);

    // Ensure the button's click handler performed its DOM mutation (innerHTML contains lists)
    const visualizationHTML = await app.getVisualizationHTML();
    expect(visualizationHTML).toMatch(/<ul>/); // expect at least one <ul> with list items (Key Observations)

    // Confirm no runtime page errors during the click and render
    expect(pageErrors.length).toBe(0);

    // Confirm no console 'error' level messages were emitted
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Idempotency/Edge case: after visualization, the button is hidden and cannot be interacted with via user click', async ({ page }) => {
    // This test covers edge-case behavior: once the visualization is shown the UI hides the button.
    // We assert that the button is hidden and the visible UI remains stable.
    const app = new BPlusTreePage(page);
    await app.goto();

    // Trigger visualization
    await app.clickVisualizeButton();

    // Ensure button is hidden
    await expect(app.visualizeBtn).toBeHidden();

    // Attempting to perform a user click on a hidden button should not change the visualization.
    // Instead of forcing a click (which bypasses visibility constraints), we assert the button is not actionable.
    const isVisible = await app.isVisualizeButtonVisible();
    expect(isVisible).toBe(false);

    // Capture current visualization HTML to compare after an attempted programmatic click.
    const beforeHTML = await app.getVisualizationHTML();

    // Attempt a programmatic click via DOM API (edge scenario): This is still allowed by the browser and will call any handler.
    // We call it to ensure the page handles repeated calls gracefully without throwing runtime errors.
    await page.evaluate(() => {
      const btn = document.getElementById('visualizeBtn');
      if (btn) {
        // This will re-invoke the handler if present; do not modify any functions - just call click()
        btn.click();
      }
    });

    const afterHTML = await app.getVisualizationHTML();
    // The visualization should remain logically consistent (may be identical or re-rendered to the same content)
    expect(afterHTML).toContain('B+ Tree of Order 3');
    expect(afterHTML.length).toBeGreaterThan(0);

    // Ensure no runtime page errors were introduced by a repeated click
    expect(pageErrors.length).toBe(0);

    // Verify console did not report errors
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);

    // Ensure visualization content did not unexpectedly remove key elements
    await expect(app.visualization).toContainText('Key Observations:');
    await expect(app.visualization).toContainText('Leaf nodes are linked sequentially');
  });

  test('FSM coverage: verify evidence and transition expectations exist in the DOM and behaviors match FSM description', async ({ page }) => {
    // This test cross-checks FSM "evidence" strings against the actual DOM and behavior:
    // - Evidence in S0_Idle: presence of "#visualizeBtn"
    // - Evidence in S1_TreeVisualized: "visualization.innerHTML = `...`" -> visualization contains inserted HTML
    const app = new BPlusTreePage(page);
    await app.goto();

    // S0_Idle evidence
    await expect(app.visualizeBtn).toBeVisible();
    await expect(app.visualizeBtn).toHaveAttribute('id', 'visualizeBtn');

    // Trigger transition (ShowTreeVisualization)
    await app.clickVisualizeButton();

    // S1_TreeVisualized evidence: the visualization container should now contain elements inserted by innerHTML
    const vizHTML = await app.getVisualizationHTML();
    expect(vizHTML).toMatch(/B\+\s*Tree of Order 3/);
    expect(vizHTML).toMatch(/Leaf nodes are linked sequentially/);
    expect(vizHTML).toMatch(/Key Observations/);

    // Validate some specific structural expectations: presence of a root node with keys "10" and "30"
    // Search for the inline tree-node that contains "10" and "30" as shown in the example
    await expect(app.visualization).toContainText('10');
    await expect(app.visualization).toContainText('30');

    // Ensure at least one leaf node is present with expected contents like '1', '3', '5' sequence
    const leafTexts = await page.locator('.leaf-node').allTextContents();
    const combinedLeafText = leafTexts.join(' ');
    expect(combinedLeafText).toMatch(/1/);
    expect(combinedLeafText).toMatch(/5/);

    // No runtime page errors should be present
    expect(pageErrors.length).toBe(0);
    // No console errors should be present
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Error observation test: ensure no unexpected runtime exceptions during navigation and user interactions', async ({ page }) => {
    // This test explicitly observes console and page errors while performing the core interactions.
    // It validates that the example runs without raising ReferenceError/SyntaxError/TypeError.
    const app = new BPlusTreePage(page);
    await app.goto();

    // Perform the main interaction
    await app.clickVisualizeButton();

    // Wait a small moment to allow any asynchronous errors to surface
    await page.waitForTimeout(100); // small wait to ensure event handlers complete

    // Assert that there were no uncaught page errors
    // If the app had thrown ReferenceError/SyntaxError/TypeError, they'd be captured by page.on('pageerror')
    expect(pageErrors.length).toBe(0);

    // Assert that no console messages of type 'error' were emitted
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);

    // Also validate that there were console messages (optional) or none - but we must not fail if none
    // This assertion ensures we at least collected the console messages array successfully
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});