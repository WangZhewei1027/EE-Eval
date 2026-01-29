import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b11070-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Doubly Linked List Visualization (f0b11070-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to capture console errors and page errors for each test
  let consoleErrors = [];
  let pageErrors = [];
  let consoleListener = null;
  let pageErrorListener = null;

  // Setup: navigate to the page and attach listeners to capture console and page errors.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    consoleListener = msg => {
      // capture only error-level console messages, but store full text for diagnostics
      try {
        if (msg.type && msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // defensive: if msg.type() throws, push a generic note
        consoleErrors.push(`console listener error: ${String(e)}`);
      }
    };
    page.on('console', consoleListener);

    pageErrorListener = error => {
      // pageerror events provide Error objects
      try {
        pageErrors.push(error.message || String(error));
      } catch (e) {
        pageErrors.push(`pageerror listener error: ${String(e)}`);
      }
    };
    page.on('pageerror', pageErrorListener);

    // Load the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure DOMContent is loaded before tests continue
    await page.waitForLoadState('domcontentloaded');
  });

  // Teardown: assert that no unexpected errors were emitted during the test
  // and detach listeners.
  test.afterEach(async ({ page }) => {
    // Assert that no console error messages were emitted during the test
    expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    // Assert that no page-level uncaught errors occurred
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);

    // Remove listeners to avoid cross-test pollution
    try {
      if (consoleListener) page.off('console', consoleListener);
      if (pageErrorListener) page.off('pageerror', pageErrorListener);
    } catch (e) {
      // ignore removal errors
    }
  });

  test('S0_Idle - initial render shows Visualize button and an empty visualization container', async ({ page }) => {
    // Validate that the "Visualize Sample List" button exists and is visible (S0_Idle and renderPage entry)
    const visualizeBtn = page.locator('#visualizeBtn');
    await expect(visualizeBtn).toBeVisible();
    await expect(visualizeBtn).toHaveText('Visualize Sample List');

    // Validate that the visualization container exists
    const listVisualization = page.locator('#listVisualization');
    await expect(listVisualization).toBeVisible();

    // It should be empty initially (no .node children)
    const nodes = listVisualization.locator('.node');
    await expect(nodes).toHaveCount(0);

    // Also verify there are no pointer elements yet
    await expect(listVisualization.locator('.next-pointer')).toHaveCount(0);
    await expect(listVisualization.locator('.prev-pointer')).toHaveCount(0);
  });

  test('Transition VisualizeClick -> S1_Visualizing: clicking Visualize creates three nodes [A][B][C] and an explanation', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_Visualizing:
    // - clicking the #visualizeBtn should clear the visualization and create three node elements
    // - confirm nodes [A], [B], [C] exist in order and explanation appended

    const visualizeBtn = page.locator('#visualizeBtn');
    const listVisualization = page.locator('#listVisualization');

    // Click the visualize button to trigger createVisualization() (entry action of S1_Visualizing)
    await visualizeBtn.click();

    // After the click, there should be 3 nodes with the expected text content
    const nodes = listVisualization.locator('.node');
    await expect(nodes).toHaveCount(3);
    await expect(nodes.nth(0)).toHaveText('[A]');
    await expect(nodes.nth(1)).toHaveText('[B]');
    await expect(nodes.nth(2)).toHaveText('[C]');

    // The code appends next-pointer elements between nodes (pointer1 and pointer3),
    // so next-pointer count should be 2. prev-pointer elements are created but not appended in the implementation,
    // so we expect 0 prev-pointer elements in the DOM.
    await expect(listVisualization.locator('.next-pointer')).toHaveCount(2);
    await expect(listVisualization.locator('.prev-pointer')).toHaveCount(0);

    // An explanation paragraph should have been appended; verify it contains expected lines
    const explanation = listVisualization.locator('p');
    await expect(explanation).toBeVisible();
    const explanationText = await explanation.innerHTML();
    // Check that the explanation refers to Node [A], Node [B], Node [C] and pointers
    expect(explanationText).toContain('Node [A]');
    expect(explanationText).toContain('Node [B]');
    expect(explanationText).toContain('Node [C]');
    expect(explanationText).toContain("Node [A]'s next pointer");
  });

  test('createVisualization clears existing content before building visualization (exit/entry behavior)', async ({ page }) => {
    // This test validates that the click handler clears previous content (visualization.innerHTML = '').
    // We insert a sentinel element into the visualization container, then click and verify it was removed.

    // Insert a sentinel element into the visualization area
    await page.evaluate(() => {
      const viz = document.getElementById('listVisualization');
      if (viz) {
        viz.innerHTML = '<div id="SENTINEL">SENTINEL_CONTENT</div>';
      }
    });

    // Ensure sentinel exists before click
    const sentinel = page.locator('#listVisualization #SENTINEL');
    await expect(sentinel).toBeVisible();
    await expect(sentinel).toHaveText('SENTINEL_CONTENT');

    // Click the visualize button to trigger clearing and re-creation
    await page.locator('#visualizeBtn').click();

    // The sentinel should no longer be present after createVisualization runs
    await expect(page.locator('#listVisualization #SENTINEL')).toHaveCount(0);

    // And nodes should be created as expected
    await expect(page.locator('#listVisualization .node')).toHaveCount(3);
  });

  test('Idempotency & robustness: multiple rapid clicks recreate the same 3-node structure and produce no errors', async ({ page }) => {
    // Click the visualize button multiple times rapidly and ensure the DOM remains consistent
    const btn = page.locator('#visualizeBtn');
    const listVisualization = page.locator('#listVisualization');

    // Rapidly click 5 times
    for (let i = 0; i < 5; i++) {
      await btn.click();
    }

    // After repeated clicks, the visualization should still have exactly 3 nodes
    const nodes = listVisualization.locator('.node');
    await expect(nodes).toHaveCount(3);

    // And explanation paragraph should be present once (since innerHTML is reset each click)
    const explanationCount = await listVisualization.locator('p').count();
    expect(explanationCount).toBe(1);

    // Validate texts again
    await expect(nodes.nth(0)).toHaveText('[A]');
    await expect(nodes.nth(1)).toHaveText('[B]');
    await expect(nodes.nth(2)).toHaveText('[C]');
  });

  test('Edge case: ensure visualization container handles being empty and recreated without throwing errors', async ({ page }) => {
    // Explicitly ensure the container is empty and then click (should behave same)
    await page.evaluate(() => {
      const viz = document.getElementById('listVisualization');
      if (viz) viz.innerHTML = '';
    });

    // Confirm it's empty
    await expect(page.locator('#listVisualization .node')).toHaveCount(0);

    // Click once to create visualization
    await page.locator('#visualizeBtn').click();

    // Validate structure created correctly
    await expect(page.locator('#listVisualization .node')).toHaveCount(3);
    await expect(page.locator('#listVisualization p')).toBeVisible();
  });
});