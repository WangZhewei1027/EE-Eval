import { test, expect } from '@playwright/test';

test.setTimeout(60000); // Allow enough time for the demo sequence to complete

// Page Object for the demo page to keep tests organized and readable
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8329380-fa7b-11f0-b314-ad8654ee5de8.html';
    this.demoButton = page.locator('#demo-button');
    this.demoText = page.locator('#demo-text');
    this.nodeA = page.locator('#node-A');
    this.nodeB = page.locator('#node-B');
    this.nodeC = page.locator('#node-C');
    this.nodeARect = page.locator('#node-A rect');
    this.nodeBRect = page.locator('#node-B rect');
    this.nodeCRect = page.locator('#node-C rect');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickDemo() {
    await this.demoButton.click();
  }

  async getDemoText() {
    return (await this.demoText.innerText()).trim();
  }

  async getNodeOpacity(nodeLocator) {
    return (await nodeLocator.getAttribute('opacity'));
  }

  async getRectStroke(rectLocator) {
    // Returns the 'stroke' attribute, or null if not present.
    return await rectLocator.getAttribute('stroke');
  }

  async waitForDemoTextContains(substring, options = {}) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(substr) !== -1;
      },
      ['#demo-text', substring],
      options
    );
  }

  async waitForDemoTextEquals(expected, options = {}) {
    await this.page.waitForFunction(
      (sel, expectedText) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim() === expectedText;
      },
      ['#demo-text', expected],
      options
    );
  }

  async isDemoButtonDisabled() {
    return await this.demoButton.getAttribute('disabled') !== null;
  }
}

// Capture console and page errors helper
function attachLoggingCollectors(page) {
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => {
    // pageerror is emitted for unhandled exceptions in the page
    pageErrors.push(String(err));
  });
  return { consoleMessages, pageErrors };
}

test.describe('Doubly Linked List Demo - FSM validation and interactions', () => {
  test('Idle state: initial render and button presence (S0_Idle evidence)', async ({ page }) => {
    // This test validates the Idle state entry action renderPage() produced the expected elements.
    const demo = new DemoPage(page);
    const { consoleMessages, pageErrors } = attachLoggingCollectors(page);

    await demo.goto();

    // Basic assertions that the demo UI rendered as described in the FSM evidence
    await expect(demo.demoButton).toBeVisible({ timeout: 5000 });
    await expect(demo.demoButton).toHaveText('Run simple demo');
    await expect(demo.demoButton).toBeEnabled();

    const initialText = await demo.getDemoText();
    // The page text instructs pressing the button to run the demo
    expect(initialText).toMatch(/Press "Run simple demo"/);

    // Ensure SVG nodes are present and have initial opacities (as per implementation)
    await expect(demo.nodeA).toBeVisible();
    await expect(demo.nodeB).toBeVisible();
    await expect(demo.nodeC).toBeVisible();

    // Check there are no unexpected page errors on load
    expect(pageErrors).toHaveLength(0);
    // There may be console messages (info/debug), but assert there are no console messages of type 'error'
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Transition Idle -> DemoRunning and full demonstration flow (S0 -> S1 -> S0)', async ({ page }) => {
    // This test validates the RunDemo event: clicking the button starts the demo,
    // nodes get highlighted in forward then backward order, demo text updates,
    // clearHighlights() (on exit) is called, and the button is re-enabled at the end.
    const demo = new DemoPage(page);
    const { consoleMessages, pageErrors } = attachLoggingCollectors(page);

    await demo.goto();

    // Click the demo button to trigger runDemo()
    await demo.clickDemo();

    // Immediately after click, the button should be disabled and running prevents re-entry
    await expect(demo.demoButton).toBeDisabled({ timeout: 2000 });

    // Wait for runDemo initial message
    await demo.waitForDemoTextContains('Starting forward traversal from head...', { timeout: 3000 });

    // Wait for first forward visit (node A). When node A is being visited,
    // the demo text contains 'Visiting node: A (moving forward)' and node-A should be highlighted.
    await demo.waitForDemoTextContains('Visiting node: A (moving forward)', { timeout: 5000 });

    // Assert node-A is highlighted: opacity '1' and rect stroke set to highlight color
    const nodeAOpacityDuring = await demo.getNodeOpacity(demo.nodeA);
    expect(nodeAOpacityDuring).toBe('1');

    const nodeAStrokeDuring = await demo.getRectStroke(demo.nodeARect);
    // Highlight color in implementation: '#fde68a'
    expect(nodeAStrokeDuring).toBe('#fde68a');

    // Wait until forward traversal completes to the 'Reached tail' pause
    await demo.waitForDemoTextContains('Reached tail. Now traversing backward...', { timeout: 10000 });

    // Wait for backward traversal to visit node C (tail -> backward)
    await demo.waitForDemoTextContains('Visiting node: C (moving backward)', { timeout: 10000 });

    // Assert node-C is highlighted during backward visit
    const nodeCOpacityDuring = await demo.getNodeOpacity(demo.nodeC);
    expect(nodeCOpacityDuring).toBe('1');
    const nodeCStrokeDuring = await demo.getRectStroke(demo.nodeCRect);
    expect(nodeCStrokeDuring).toBe('#fde68a');

    // Wait for demo finished message (the code sets this exact string before clearHighlights)
    await demo.waitForDemoTextContains('Demo finished. Nodes were visited forward then backward.', { timeout: 5000 });

    // Immediately after the 'Demo finished...' assignment, clearHighlights() is invoked.
    // Verify that stroke attributes were cleared (set to 'none') and opacities returned to '0.9'
    // Because the code calls clearHighlights() right after setting finished text, we can assert now.
    const nodeAStrokeAfterFinish = await demo.getRectStroke(demo.nodeARect);
    expect(nodeAStrokeAfterFinish).toBe('none');

    const nodeAOpacityAfter = await demo.getNodeOpacity(demo.nodeA);
    const nodeBOpacityAfter = await demo.getNodeOpacity(demo.nodeB);
    const nodeCOpacityAfter = await demo.getNodeOpacity(demo.nodeC);
    expect(nodeAOpacityAfter).toBe('0.9');
    expect(nodeBOpacityAfter).toBe('0.9');
    expect(nodeCOpacityAfter).toBe('0.9');

    // Finally the implementation waits a short time then sets the demo text back and re-enables the button.
    await demo.waitForDemoTextContains('Press "Run simple demo" to repeat.', { timeout: 5000 });
    await expect(demo.demoButton).toBeEnabled({ timeout: 2000 });

    // Ensure there were no unhandled page errors during the demo run
    expect(pageErrors).toHaveLength(0);

    // Also assert there are no console.error messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Edge case: clicking the demo button again while running is ignored (no double-run)', async ({ page }) => {
    // This test asserts the guard "if(running) return;" behaves as implemented:
    // extra clicks while the demo is running should not restart or cause errors, and the button remains disabled.
    const demo = new DemoPage(page);
    const { consoleMessages, pageErrors } = attachLoggingCollectors(page);

    await demo.goto();

    // Start the demo
    await demo.clickDemo();

    // Immediately try to click again while it's running
    await demo.demoButton.click();

    // The button must remain disabled while the demo runs
    await expect(demo.demoButton).toBeDisabled({ timeout: 2000 });

    // Wait for a mid-demo text to ensure it continued normally and wasn't restarted
    await demo.waitForDemoTextContains('Visiting node: B (moving forward)', { timeout: 8000 });

    // Wait for demo to finish normally
    await demo.waitForDemoTextContains('Press "Run simple demo" to repeat.', { timeout: 20000 });

    // Validate that no page errors were thrown due to multiple clicks
    expect(pageErrors).toHaveLength(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);

    // Ensure the button is re-enabled at the end
    await expect(demo.demoButton).toBeEnabled();
  });

  test('Can run the demo sequentially multiple times (repeatability)', async ({ page }) => {
    // This test validates that after finishing, the demo can be started again and behaves consistently.
    const demo = new DemoPage(page);
    const { consoleMessages, pageErrors } = attachLoggingCollectors(page);

    await demo.goto();

    // Run first time
    await demo.clickDemo();
    await demo.waitForDemoTextContains('Press "Run simple demo" to repeat.', { timeout: 20000 });
    await expect(demo.demoButton).toBeEnabled();

    // Verify one set of final clearing occurred
    const strokeAfterFirst = await demo.getRectStroke(demo.nodeARect);
    expect(strokeAfterFirst).toBe('none');

    // Run second time
    await demo.clickDemo();
    await expect(demo.demoButton).toBeDisabled({ timeout: 2000 });

    // Wait for an expected mid-demo state to ensure it ran again
    await demo.waitForDemoTextContains('Visiting node: A (moving forward)', { timeout: 8000 });

    // Wait for finish of second run
    await demo.waitForDemoTextContains('Press "Run simple demo" to repeat.', { timeout: 20000 });
    await expect(demo.demoButton).toBeEnabled();

    // Ensure no page errors occurred during either run
    expect(pageErrors).toHaveLength(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Observability: capture console messages and page errors during load and interactions', async ({ page }) => {
    // This test explicitly demonstrates we observe console and page errors and assert expected absence of runtime errors.
    const demo = new DemoPage(page);
    const { consoleMessages, pageErrors } = attachLoggingCollectors(page);

    await demo.goto();

    // There should be no uncaught exceptions on load
    expect(pageErrors).toHaveLength(0);

    // Click demo then wait a short while; we just want to ensure no uncaught exceptions are emitted during normal operation
    await demo.clickDemo();
    // Wait for the demo to begin
    await demo.waitForDemoTextContains('Starting forward traversal from head...', { timeout: 5000 });

    // Wait for completion
    await demo.waitForDemoTextContains('Press "Run simple demo" to repeat.', { timeout: 20000 });

    // Assert capturing worked and there are no page errors or console.error messages
    expect(pageErrors).toHaveLength(0);
    const errorConsole = consoleMessages.filter(msg => msg.type === 'error');
    expect(errorConsole.length).toBe(0);

    // For traceability in CI logs we also assert that we captured at least some console output (info/debug),
    // but do not fail if not present. This checks the collector is active.
    // (We do not require any specific console text because the page is mostly static.)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});