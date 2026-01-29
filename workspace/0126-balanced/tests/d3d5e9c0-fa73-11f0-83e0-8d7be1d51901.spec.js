import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d5e9c0-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Suffix Tree Interactive Demo (FSM validations) - d3d5e9c0-fa73-11f0-83e0-8d7be1d51901', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;
  let consoleListener;
  let pageErrorListener;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    consoleListener = msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    };
    page.on('console', consoleListener);

    // Capture uncaught page errors (runtime exceptions)
    pageErrorListener = err => {
      pageErrors.push(err);
    };
    page.on('pageerror', pageErrorListener);

    // Navigate to the page under test and wait for initial build to complete.
    await page.goto(BASE_URL, { waitUntil: 'load' });

    // The app performs an initial build on load; wait for the searchResult to reflect a built tree.
    await expect(page.locator('#searchResult')).toHaveText(/Built suffix tree for string of length \d+\./, { timeout: 5000 });
  });

  test.afterEach(async ({ page }) => {
    // cleanup listeners
    page.removeListener('console', consoleListener);
    page.removeListener('pageerror', pageErrorListener);

    // Assert that there were no unexpected console errors or uncaught page errors during the test run.
    // If the app genuinely has runtime errors, these assertions will fail and surface them.
    expect(consoleErrors, 'No console.error messages should have been emitted').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
  });

  test.describe('State S0_Idle and initial rendering', () => {
    test('page has correct title and initial build occurred (Idle -> TreeBuilt)', async ({ page }) => {
      // Validate document title (evidence of S0_Idle entry_action renderPage())
      await expect(page).toHaveTitle('Suffix Tree (Trie + Compression) — Interactive Demo');

      // Since the page auto-builds on load, verify the "Built suffix tree" message
      const result = page.locator('#searchResult');
      await expect(result).toHaveText(/Built suffix tree for string of length \d+\./);

      // Check the suffix list container has items equal to input length
      const inputVal = await page.locator('#inputStr').inputValue();
      const sufItems = page.locator('#sufList .sufItem');
      await expect(sufItems).toHaveCount(inputVal.length);
    });
  });

  test.describe('Event: RandomString -> transition to TreeBuilt', () => {
    test('click Random generates a string with $ and allows rebuild', async ({ page }) => {
      // Click random and assert input changed to a string that ends with $
      await page.click('#randBtn');
      const val = await page.locator('#inputStr').inputValue();
      expect(val.length).toBeGreaterThanOrEqual(8);
      expect(val.endsWith('$')).toBeTruthy();

      // Now click Build Tree and assert searchResult updates to reflect new length
      await page.click('#buildBtn');
      await expect(page.locator('#searchResult')).toHaveText(new RegExp(`Built suffix tree for string of length ${val.length}\\.`));
      // and suffix list should update accordingly
      await expect(page.locator('#sufList .sufItem')).toHaveCount(val.length);
    });
  });

  test.describe('Event: BuildTree (Idle -> TreeBuilt / rebuild)', () => {
    test('manually building tree updates searchResult and renders SVG nodes/edges', async ({ page }) => {
      // Change input to a small deterministic string and build
      await page.fill('#inputStr', 'abc$');
      await page.click('#buildBtn');

      // Expect searchResult to indicate built tree with proper length
      await expect(page.locator('#searchResult')).toHaveText('Built suffix tree for string of length 4.');

      // Expect SVG viewport to contain path.edge and g[data-id] elements
      await expect(page.locator('#viewport path.edge')).toHaveCountGreaterThan(0);
      await expect(page.locator('#viewport g[data-id]')).toHaveCountGreaterThan(0);
    });
  });

  test.describe('Event: SearchPattern and transitions (S1_TreeBuilt -> S2_Searching)', () => {
    test('searching for an existing pattern highlights and shows indices (banana$ -> ana -> 1, 3)', async ({ page }) => {
      // Ensure input is the demo string banana$ and rebuild to be certain
      await page.fill('#inputStr', 'banana$');
      await page.click('#buildBtn');
      await expect(page.locator('#searchResult')).toHaveText('Built suffix tree for string of length 7.');

      // Enter pattern 'ana' and click search
      await page.fill('#pattern', 'ana');
      await page.click('#searchBtn');

      // Expect searchResult to show correct indices for 'ana' in 'banana$'
      await expect(page.locator('#searchResult')).toHaveText('Matched suffix start indices: 1, 3');

      // Expect at least one highlighted edge and some highlighted nodes (leaves)
      const highlightedEdge = await page.locator('path.edge.highlightEdge').first().count();
      const highlightedNodes = await page.locator('g[data-id] circle.highlightNode').first().count();
      expect(highlightedEdge + highlightedNodes).toBeGreaterThan(0);
    });

    test('searching for a non-existing pattern reports No match found', async ({ page }) => {
      // Ensure built tree present
      await page.fill('#inputStr', 'banana$');
      await page.click('#buildBtn');
      await expect(page.locator('#searchResult')).toHaveText('Built suffix tree for string of length 7.');

      // Search for something that does not exist
      await page.fill('#pattern', 'zzz');
      await page.click('#searchBtn');
      await expect(page.locator('#searchResult')).toHaveText('No match found.');
    });

    test('searching when no tree is built triggers an alert (edge-case)', async ({ page }) => {
      // First clear to remove tree
      await page.click('#clearBtn');
      await expect(page.locator('#searchResult')).toHaveText('Cleared.');

      // Attempt to search should show an alert 'Build a tree first.'
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#searchBtn'),
      ]);
      expect(dialog.message()).toContain('Build a tree first.');
      await dialog.accept();
    });
  });

  test.describe('Event: ClickSuffix (S1_TreeBuilt -> S1_TreeBuilt) and UI highlight behavior', () => {
    test('clicking a suffix in the left list highlights its corresponding node and updates searchResult', async ({ page }) => {
      // Build the demo tree (banana$)
      await page.fill('#inputStr', 'banana$');
      await page.click('#buildBtn');

      // Click suffix with index 2 (should exist)
      const sufItem = page.locator('#sufList .sufItem').filter({ hasText: /^2:/ }).first();
      await expect(sufItem).toBeVisible();
      await sufItem.click();

      // The clicked suffix item should have 'selected' class
      const selected = await sufItem.evaluate(el => el.classList.contains('selected'));
      expect(selected).toBeTruthy();

      // searchResult should show the matched index (2)
      await expect(page.locator('#searchResult')).toHaveText('Matched suffix start indices: 2');

      // The corresponding node in SVG should be highlighted (a circle with highlightNode)
      const highlightedNodeCount = await page.locator('g[data-id] circle.highlightNode').count();
      expect(highlightedNodeCount).toBeGreaterThan(0);
    });

    test('clicking a visible edge highlights subtree leaves and updates searchResult', async ({ page }) => {
      // Build demo tree
      await page.fill('#inputStr', 'banana$');
      await page.click('#buildBtn');

      // Wait for at least one edge to exist
      const edge = page.locator('path.edge').first();
      await expect(edge).toHaveCount(1);

      // Click first edge (this should not throw and should highlight)
      await edge.click();

      // That edge should now have class 'highlightEdge'
      const hasHighlight = await edge.evaluate(el => el.classList.contains('highlightEdge'));
      expect(hasHighlight).toBeTruthy();

      // And searchResult should have 'Matched suffix start indices:' (some indices)
      await expect(page.locator('#searchResult')).toHaveText(/Matched suffix start indices: \d+(?:, \d+)*|Matched suffix start indices:/);
    });
  });

  test.describe('Event: ClearInput (S1_TreeBuilt -> S3_Cleared)', () => {
    test('clicking Clear empties inputs, clears suffix list, clears SVG, and sets searchResult to Cleared.', async ({ page }) => {
      // Ensure built tree exists
      await page.fill('#inputStr', 'banana$');
      await page.click('#buildBtn');
      await expect(page.locator('#searchResult')).toHaveText('Built suffix tree for string of length 7.');

      // Click clear
      await page.click('#clearBtn');

      // Input fields should be empty
      await expect(page.locator('#inputStr')).toHaveValue('');
      await expect(page.locator('#pattern')).toHaveValue('');

      // Suffix list should be empty
      await expect(page.locator('#sufList')).toHaveText('', { timeout: 2000 });

      // searchResult should read 'Cleared.'
      await expect(page.locator('#searchResult')).toHaveText('Cleared.');

      // SVG viewport should be empty (no child nodes drawn)
      const viewportInnerHTML = await page.locator('#viewport').innerHTML();
      expect(viewportInnerHTML.trim()).toBe('');
    });
  });

  test.describe('Edge cases & visual checks', () => {
    test('tooltip appears on edge hover and hides on mouseout (visual feedback)', async ({ page }) => {
      // Build demo tree
      await page.fill('#inputStr', 'banana$');
      await page.click('#buildBtn');

      // Hover an edge to display tooltip; then move away to hide it
      const edge1 = page.locator('path.edge1').first();
      await expect(edge).toHaveCount(1);

      // Hover
      await edge.hover();

      // Tooltip should become visible with content including 'edge:' or 'leads to subtree'
      const tooltip = page.locator('#tooltip');
      await expect(tooltip).toBeVisible();
      const tipText = await tooltip.textContent();
      expect(tipText).toMatch(/edge: "|leads to subtree/);

      // Move mouse away by hovering the svg background
      await page.locator('#svg').hover({ position: { x: 10, y: 10 } });
      await expect(tooltip).toBeHidden();
    });

    test('pan & zoom transform updates viewport transform attribute (interactivity)', async ({ page }) => {
      // Ensure built tree exists
      await page.click('#buildBtn');
      // Grab current transform
      const getTransform = async () => await page.locator('#viewport').getAttribute('transform');

      const before = await getTransform();
      // Simulate wheel event to zoom in at center
      await page.dispatchEvent('#svg', 'wheel', { deltaY: -100, clientX: 300, clientY: 200 });
      const afterZoom = await getTransform();
      expect(afterZoom).not.toBe(before);

      // Simulate drag to pan: mousedown, mousemove, mouseup
      await page.dispatchEvent('#svg', 'mousedown', { clientX: 200, clientY: 200 });
      await page.dispatchEvent(window, 'mousemove', { clientX: 220, clientY: 220 });
      await page.dispatchEvent(window, 'mouseup', { clientX: 220, clientY: 220 });
      const afterPan = await getTransform();
      expect(afterPan).not.toBeUndefined();
    });
  });
});