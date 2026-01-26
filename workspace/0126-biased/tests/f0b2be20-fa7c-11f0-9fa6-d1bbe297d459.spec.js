import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b2be20-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the demo page
class TopoDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoButton');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async waitForReady() {
    await Promise.all([
      this.page.waitForSelector('#demoButton', { state: 'visible' }),
      this.page.waitForSelector('#demoOutput', { state: 'attached' })
    ]);
  }

  async clickRun() {
    await this.button.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }
}

test.describe('Topological Sort Interactive Demo (FSM validation)', () => {
  // Collect console errors and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors)
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', err => {
      // store the actual Error object for inspection
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Small check to log any captured issues to Playwright's output (helps debugging on CI)
    if (consoleMessages.length > 0) {
      // attach minimal summary to test output
      // (We don't modify app runtime; this is just test-side logging)
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
    }
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => String(e)));
    }
  });

  test('S0_Idle: initial render shows Run Topological Sort button and placeholder output', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) evidence:
    // - The Run Topological Sort button exists and is visible
    // - The demoOutput starts with the placeholder text 'Topological order will appear here'
    const demo = new TopoDemoPage(page);
    await demo.goto();
    await demo.waitForReady();

    // Button should be present and visible
    await expect(demo.button).toBeVisible();
    await expect(demo.button).toHaveText('Run Topological Sort');

    // Output should contain the placeholder initial text
    const initialText = await demo.getOutputText();
    expect(initialText.trim()).toBe('Topological order will appear here');

    // FSM evidence: renderPage() is represented by the initial DOM; we assert DOM matches evidence for Idle state

    // Ensure no uncaught page errors or console.error logs occurred during initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S0 -> S1 -> S2: clicking button runs topologicalSort and displays expected order', async ({ page }) => {
    // This test validates the transition from Idle (S0) to Sorting (S1) and Completed (S2)
    // It asserts that clicking the button triggers the in-page Kahn implementation and updates demoOutput
    const demo = new TopoDemoPage(page);
    await demo.goto();
    await demo.waitForReady();

    // Ensure pre-click state
    expect(await demo.getOutputText()).toBe('Topological order will appear here');

    // Click the demo button to trigger the sort
    await demo.clickRun();

    // After clicking, the page should update the output with a topological order.
    // The implementation in the page (deterministic for the given graph) should produce: A → B → C → D
    // Wait for the output to change from the placeholder
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      if (!el) return false;
      return el.textContent && !el.textContent.includes('Topological order will appear here');
    });

    // Verify the exact expected final output string
    const finalText = (await demo.getOutputText()).trim();
    expect(finalText.startsWith('Topological order:')).toBeTruthy();

    // Accept the canonical ordering expected from the implemented Kahn's algorithm run on the predefined graph
    expect(finalText).toBe('Topological order: A → B → C → D');

    // Also verify the visual output element is non-empty and updated
    const outputHandle = await page.$('#demoOutput');
    const box = await outputHandle.boundingBox();
    // boundingBox may be null in headless sometimes, but if available ensure area > 0
    if (box) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }

    // Assert there were no console errors or page errors during the sorting transition
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Idempotence & edge case: multiple rapid clicks produce consistent result and no errors', async ({ page }) => {
    // This test validates edge-case behavior:
    // - Clicking the Run button multiple times rapidly should not produce invalid output or duplicate appends
    // - The output should remain a valid topological order and stable after repeated triggers
    const demo = new TopoDemoPage(page);
    await demo.goto();
    await demo.waitForReady();

    // Rapidly click the button multiple times
    const clicks = 6;
    for (let i = 0; i < clicks; i++) {
      await demo.clickRun();
    }

    // Wait for the output to reflect the computation (it should have updated at least once)
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.startsWith('Topological order:');
    });

    const text = (await demo.getOutputText()).trim();

    // The result should be the same canonical order computed by the page algorithm
    expect(text).toBe('Topological order: A → B → C → D');

    // Ensure the output did not, for example, append repeated results or become corrupted
    // (i.e., still matches the exact expected string)
    expect(text.split('Topological order:').length - 1).toBe(1);

    // Verify no console errors or uncaught exceptions occurred after rapid interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('FSM evidence checks: event listener exists implicitly by behavior and output format is correct', async ({ page }) => {
    // This test validates evidence items in the FSM:
    // - The button has an event listener attached (we infer by successful click behavior)
    // - The output uses arrows '→' and contains the expected number of nodes
    const demo = new TopoDemoPage(page);
    await demo.goto();
    await demo.waitForReady();

    // Before clicking, ensure the button responds to click (inferred by trying to dispatch a click and observing change).
    // We don't alter page functions or global state; we only interact via normal DOM events.
    await demo.clickRun();

    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('→');
    });

    const text = (await demo.getOutputText()).trim();
    expect(text).toContain('→');

    // Check that there are exactly 3 arrow separators for 4 nodes (A, B, C, D)
    const arrowCount = (text.match(/→/g) || []).length;
    expect(arrowCount).toBe(3);

    // Check the final textual representation matches expected node count and tokens
    const nodeList = text.replace('Topological order:', '').trim().split('→').map(s => s.trim());
    expect(nodeList.length).toBe(4);
    expect(nodeList).toEqual(['A', 'B', 'C', 'D']);

    // No console errors or page errors expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});