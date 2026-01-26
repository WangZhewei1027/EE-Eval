import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aaa191-fa78-11f0-812d-c9788050701f.html';

// Page Object for the graph application
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to the app and wait for initial render
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the graph container to be present and the initial nodes to render
    await this.page.waitForSelector('#graph .node', { timeout: 5000 });
    // Wait a small amount to allow initial animations / DOM insertion
    await this.page.waitForTimeout(200);
  }

  // Get number of nodes rendered in the graph
  async nodeCount() {
    return await this.page.$$eval('#graph .node', (els) => els.length);
  }

  // Get number of edges rendered in the graph
  async edgeCount() {
    return await this.page.$$eval('#graph .edge', (els) => els.length);
  }

  // Returns whether result sequence has any children
  async resultCount() {
    return await this.page.$$eval('#result-sequence .result-node', (els) => els.length);
  }

  // Click the sort button
  async clickSort() {
    await this.page.click('#sort-btn');
  }

  // Click the reset button
  async clickReset() {
    await this.page.click('#reset-btn');
  }

  // Returns the inline style.background value of a node (string or empty)
  async nodeInlineBackground(nodeId) {
    return await this.page.$eval(`#node-${nodeId}`, (el) => el.style.background || '');
  }

  // Returns whether a button is disabled
  async isButtonDisabled(selector) {
    return await this.page.$eval(selector, (btn) => btn.disabled);
  }

  // Wait until result sequence has at least `count` nodes or timeout
  async waitForResultCount(count, timeout = 30000) {
    await this.page.waitForFunction(
      (expected) => {
        const seq = document.getElementById('result-sequence');
        return seq && seq.children.length >= expected;
      },
      count,
      { timeout }
    );
  }

  // Wait until sorting completes: reset button becomes enabled (resetBtn.disabled === false)
  async waitForSortingComplete(timeout = 60000) {
    await this.page.waitForFunction(() => {
      const resetBtn = document.getElementById('reset-btn');
      return resetBtn && resetBtn.disabled === false;
    }, { timeout });
  }
}

test.describe('Topological Sort | Visual Elegance - FSM validation and UI tests', () => {
  // Increase default timeout for tests that wait on animation chains
  test.setTimeout(120000);

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Initial renderGraph() should create nodes, edges and enable controls', async ({ page }) => {
      // Arrange
      const gp = new GraphPage(page);

      // Act
      await gp.goto();

      // Assert: verify nodes exist (expected 8 nodes based on implementation)
      const nodes = await gp.nodeCount();
      expect(nodes).toBe(8);

      // Assert: verify edges exist (implementation has multiple edges; expect > 0)
      const edges = await gp.edgeCount();
      expect(edges).toBeGreaterThan(0);

      // Assert: result sequence is empty initially
      const resultNodes = await gp.resultCount();
      expect(resultNodes).toBe(0);

      // Assert: sort and reset buttons exist and are enabled initially
      expect(await gp.isButtonDisabled('#sort-btn')).toBe(false);
      expect(await gp.isButtonDisabled('#reset-btn')).toBe(false);

      // Assert: no page errors on initial load
      expect(gp.pageErrors.length).toBe(0);

      // Log captured console messages for debugging (no assertion on content)
      // but ensure we captured at least something like animations script scheduling.
      expect(Array.isArray(gp.consoleMessages)).toBe(true);
    });
  });

  test.describe('Sorting lifecycle (S0_Idle -> S1_Sorting -> S2_Completed)', () => {
    test('Clicking Sort Graph transitions to Sorting (S1) and starts algorithm', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Sanity: ensure node A exists
      await page.waitForSelector('#node-A', { timeout: 2000 });

      // Act: click sort
      await gp.clickSort();

      // Immediately after clicking, the sort function disables buttons
      // Assert: sort button and reset button are disabled at start of sort
      await page.waitForFunction(() => {
        const sort = document.getElementById('sort-btn');
        const reset = document.getElementById('reset-btn');
        return sort && sort.disabled === true && reset && reset.disabled === true;
      }, { timeout: 2000 });

      expect(await gp.isButtonDisabled('#sort-btn')).toBe(true);
      expect(await gp.isButtonDisabled('#reset-btn')).toBe(true);

      // While sorting, first processed node should get inline style background 'var(--secondary)'
      // Wait until at least one result node is appended (indicates processing started)
      await gp.waitForResultCount(1, 20000);

      // Grab the first result-node text content (should be a valid node id like 'G', 'C', etc.)
      const firstResultText = await page.$eval('#result-sequence .result-node', (el) => el.textContent.trim());
      expect(firstResultText.length).toBeGreaterThan(0);

      // The node element for that id should have inline background set to var(--secondary) at some point
      const nodeBg = await gp.nodeInlineBackground(firstResultText);
      // The code sets nodeElement.style.background = 'var(--secondary)' during processing
      expect(nodeBg).toContain('var(--secondary)');
    });

    test('Sorting completes (S2_Completed): all nodes in result, nodes marked completed, reset enabled', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Start sorting
      await gp.clickSort();

      // Wait for sorting to complete by waiting until the reset button is re-enabled
      await gp.waitForSortingComplete(60000);

      // After completion, result sequence should contain all nodes (expected 8 nodes)
      await gp.waitForResultCount(8, 10000);
      const finalResultCount = await gp.resultCount();
      expect(finalResultCount).toBe(8);

      // All graph nodes should have been marked as completed with inline background 'var(--accent)'
      const nodeIds = await page.$$eval('#graph .node', (els) => els.map((el) => el.id.replace('node-', '')));
      for (const id of nodeIds) {
        const bg = await gp.nodeInlineBackground(id);
        // The final step sets nodeElement.style.background = 'var(--accent)'
        expect(bg).toContain('var(--accent)');
      }

      // Reset button should be enabled at the end
      expect(await gp.isButtonDisabled('#reset-btn')).toBe(false);

      // Confirm no unexpected page errors occurred during the sorting process
      expect(gp.pageErrors.length).toBe(0);

      // Confirm no console-level error messages were emitted
      const consoleErrors = gp.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    }, 90000);
  });

  test.describe('Reset transition and edge cases', () => {
    test('Reset (S1 -> S0) after completion restores initial DOM and enables controls', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Start and wait for completion
      await gp.clickSort();
      await gp.waitForSortingComplete(60000);
      await gp.waitForResultCount(8, 10000);

      // Act: click reset
      await gp.clickReset();

      // After reset, result sequence should be empty again
      await page.waitForFunction(() => {
        const seq = document.getElementById('result-sequence');
        return seq && seq.children.length === 0;
      }, { timeout: 5000 });

      const resultCountAfterReset = await gp.resultCount();
      expect(resultCountAfterReset).toBe(0);

      // Nodes should be re-rendered without inline background styles (initial state)
      const inlineBgValues = await page.$$eval('#graph .node', (els) => els.map((el) => el.getAttribute('style') || ''));
      // At least one node should have empty inline style or not contain var(--accent)
      const anyNoInlineBg = inlineBgValues.some((s) => s === '' || !s.includes('var(--accent)'));
      expect(anyNoInlineBg).toBe(true);

      // Buttons should be enabled after reset
      expect(await gp.isButtonDisabled('#sort-btn')).toBe(false);
      expect(await gp.isButtonDisabled('#reset-btn')).toBe(false);
    });

    test('Rapid double-click of Sort Graph should not create duplicate full runs', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Rapidly click sort twice
      await Promise.all([
        page.click('#sort-btn'),
        page.click('#sort-btn').catch(() => { /* ignore if second click is prevented */ }),
      ]);

      // Wait for completion
      await gp.waitForSortingComplete(60000);
      await gp.waitForResultCount(8, 10000);

      // The result sequence should have exactly the number of nodes, not duplicated
      const finalResultCount = await gp.resultCount();
      expect(finalResultCount).toBe(8);

      // Ensure no page errors and no console errors occurred
      expect(gp.pageErrors.length).toBe(0);
      const consoleErrors = gp.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: clicking reset during initial idle state simply re-renders without error', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Act: click reset immediately in idle state
      await gp.clickReset();

      // Expect graph to still be present and nodes re-rendered
      await page.waitForSelector('#graph .node', { timeout: 2000 });
      const nodes = await gp.nodeCount();
      expect(nodes).toBe(8);

      // No page errors were emitted
      expect(gp.pageErrors.length).toBe(0);
    });
  });

  test.describe('Console / error observation and negative scenarios', () => {
    test('No unexpected runtime errors (ReferenceError, TypeError, SyntaxError) should be thrown during typical usage', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Run through a typical usage: sort and reset
      await gp.clickSort();
      await gp.waitForSortingComplete(60000);
      await gp.clickReset();
      await page.waitForSelector('#graph .node', { timeout: 5000 });

      // Assert that no page errors were captured
      expect(gp.pageErrors.length).toBe(0, `Expected no page errors but got: ${gp.pageErrors.map(e => String(e)).join('\n')}`);

      // Assert that console error messages are absent
      const consoleErrs = gp.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrs.length).toBe(0, `Console errors were found: ${consoleErrs.map(c => c.text).join('\n')}`);
    });
  });
});