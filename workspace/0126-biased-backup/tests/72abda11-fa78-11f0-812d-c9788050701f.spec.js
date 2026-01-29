import { test, expect } from '@playwright/test';

test.describe('Relational Database Visualization (FSM tests) - 72abda11-fa78-11f0-812d-c9788050701f', () => {
  // URL provided by the task
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72abda11-fa78-11f0-812d-c9788050701f.html';

  // Collect console errors and page errors per test to assert on them.
  test.beforeEach(async ({ page }) => {
    // Arrays attached to page for access in tests
    page['_consoleErrors'] = [];
    page['_pageErrors'] = [];

    page.on('console', msg => {
      // capture console errors (type 'error') and also capture all console messages for debugging
      if (msg.type() === 'error') {
        page['_consoleErrors'].push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // capture uncaught exceptions (ReferenceError, TypeError, SyntaxError, etc.)
      page['_pageErrors'].push(err);
    });

    // Navigate to application and wait for the main control to be available
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#showRelations', { state: 'visible' });
  });

  test.afterEach(async ({ page }) => {
    // If there were page errors or console errors, attach them to the test output for debugging
    if (page['_consoleErrors'] && page['_consoleErrors'].length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Console errors captured:', page['_consoleErrors']);
    }
    if (page['_pageErrors'] && page['_pageErrors'].length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Page errors captured:', page['_pageErrors']);
    }
  });

  test.describe('State S0: Idle (initial render)', () => {
    test('Initial page render shows control button and relations elements are present but not active', async ({ page }) => {
      // Validate: entry action renderPage() should have resulted in DOM ready and button present
      const showBtn = page.locator('#showRelations');
      await expect(showBtn).toBeVisible();
      await expect(showBtn).toHaveText('Show Relationships');

      // Validate: relationships elements are created on initialization but not active (hidden)
      const linesCount = await page.locator('.relation-line').count();
      const dotsCount = await page.locator('.relation-dot').count();
      const highlightsCount = await page.locator('.highlight').count();

      // Expect some relationship elements were created (createRelationships runs on load)
      expect(linesCount).toBeGreaterThan(0);
      expect(dotsCount).toBeGreaterThan(0);
      expect(highlightsCount).toBeGreaterThan(0);

      // None should have the 'active' class initially
      const activeLines = await page.locator('.relation-line.active').count();
      const activeDots = await page.locator('.relation-dot.active').count();
      const activeHighlights = await page.locator('.highlight.active').count();

      expect(activeLines).toBe(0);
      expect(activeDots).toBe(0);
      expect(activeHighlights).toBe(0);

      // Database transform not yet set (no relationship view)
      const initialTransform = await page.$eval('.database', el => el.style.transform);
      // Inline style isn't set initially; it should be empty string
      expect(initialTransform === '' || initialTransform === 'none').toBeTruthy();

      // Ensure no uncaught page errors were fired during initial load
      expect(page['_pageErrors'].length).toBe(0);
      expect(page['_consoleErrors'].length).toBe(0);
    });
  });

  test.describe('Transitions: Show/Hide Relationships (ShowRelations event)', () => {
    test('Transition S0 -> S1: Clicking "Show Relationships" activates relation visuals and updates button text', async ({ page }) => {
      // Click the Show Relationships button
      const showBtn = page.locator('#showRelations');
      await showBtn.click();

      // Button text should update to "Hide Relationships"
      await expect(showBtn).toHaveText('Hide Relationships');

      // At least one relation-line/.relation-dot/.highlight should have .active
      const activeLines = await page.locator('.relation-line.active').count();
      const activeDots = await page.locator('.relation-dot.active').count();
      const activeHighlights = await page.locator('.highlight.active').count();

      expect(activeLines).toBeGreaterThan(0);
      expect(activeDots).toBeGreaterThan(0);
      expect(activeHighlights).toBeGreaterThan(0);

      // The database container should receive a transform inline style for the 3D effect
      const dbTransform = await page.$eval('.database', el => el.style.transform);
      expect(dbTransform).toContain('perspective') || expect(dbTransform).not.toBe('');

      // No page errors should have occurred during the transition
      expect(page['_pageErrors'].length).toBe(0);
      expect(page['_consoleErrors'].length).toBe(0);
    });

    test('Transition S1 -> S2: Clicking again hides relation visuals, resets button text and transform', async ({ page }) => {
      const showBtn = page.locator('#showRelations');

      // Show first
      await showBtn.click();
      await expect(showBtn).toHaveText('Hide Relationships');

      // Now click to hide
      await showBtn.click();

      // Button text should revert
      await expect(showBtn).toHaveText('Show Relationships');

      // No active relation-line/dot/highlight should remain
      const activeLines = await page.locator('.relation-line.active').count();
      const activeDots = await page.locator('.relation-dot.active').count();
      const activeHighlights = await page.locator('.highlight.active').count();

      expect(activeLines).toBe(0);
      expect(activeDots).toBe(0);
      expect(activeHighlights).toBe(0);

      // Database transform should be set to 'none' inline by the code (explicit reset)
      const dbTransform = await page.$eval('.database', el => el.style.transform);
      expect(dbTransform).toBe('none');

      // No page errors during hide transition
      expect(page['_pageErrors'].length).toBe(0);
      expect(page['_consoleErrors'].length).toBe(0);
    });

    test('Transition S2 -> S1: Toggling back shows relations again (idempotent toggle behavior)', async ({ page }) => {
      const showBtn = page.locator('#showRelations');

      // Ensure starting hidden state
      await expect(showBtn).toHaveText('Show Relationships');

      // Click to show
      await showBtn.click();
      await expect(showBtn).toHaveText('Hide Relationships');

      // Verify active classes are again present
      const activeLines = await page.locator('.relation-line.active').count();
      const activeDots = await page.locator('.relation-dot.active').count();
      const activeHighlights = await page.locator('.highlight.active').count();

      expect(activeLines).toBeGreaterThan(0);
      expect(activeDots).toBeGreaterThan(0);
      expect(activeHighlights).toBeGreaterThan(0);

      // No page errors in the process
      expect(page['_pageErrors'].length).toBe(0);
      expect(page['_consoleErrors'].length).toBe(0);
    });
  });

  test.describe('Edge cases and UI interactions', () => {
    test('Hover behavior: when relations visible, tables involved in relationships get transformed on mouseenter', async ({ page }) => {
      // Ensure relations are visible
      const showBtn = page.locator('#showRelations');
      await showBtn.click();
      await expect(showBtn).toHaveText('Hide Relationships');

      // Hover the orders table (should be related)
      const orders = page.locator('#orders');
      await orders.hover();

      // After hover, inline style transform should reflect translation/scale set in mouseenter handler
      const ordersTransform = await page.$eval('#orders', el => el.style.transform);
      // The handler sets 'translateY(-10px) scale(1.02)' when related and relationsVisible is true
      expect(ordersTransform).toContain('translateY') || expect(ordersTransform).toContain('scale');

      // Move mouse away to trigger mouseleave cleanup
      await page.mouse.move(0, 0);
      // After mouseleave, inline style should be reset
      await page.waitForTimeout(50); // small wait to allow event handling
      const ordersTransformAfter = await page.$eval('#orders', el => el.style.transform);
      expect(ordersTransformAfter === '' || ordersTransformAfter === 'none').toBeTruthy();

      // No page errors
      expect(page['_pageErrors'].length).toBe(0);
      expect(page['_consoleErrors'].length).toBe(0);
    });

    test('Resize handling: updateRelationPosition executes and relation-line widths remain positive', async ({ page }) => {
      // Show relations so elements are active and positioned
      const showBtn = page.locator('#showRelations');
      await showBtn.click();
      await expect(showBtn).toHaveText('Hide Relationships');

      // Capture widths before resize
      const beforeWidths = await page.$$eval('.relation-line', els => els.map(e => parseFloat(getComputedStyle(e).width)));
      // Ensure there is at least one positive width
      expect(beforeWidths.some(w => w > 0)).toBeTruthy();

      // Change viewport size to trigger resize event listeners
      const originalViewport = page.viewportSize();
      // Toggle to a narrow viewport (if supported)
      try {
        await page.setViewportSize({ width: 360, height: 800 });
      } catch (e) {
        // setViewportSize might not be allowed in some runners; ignore and continue
      }

      // Wait briefly for resize handlers to run
      await page.waitForTimeout(200);

      const afterWidths = await page.$$eval('.relation-line', els => els.map(e => parseFloat(getComputedStyle(e).width)));
      // After resize, widths should still be numbers and at least one remains > 0
      expect(afterWidths.length).toBeGreaterThan(0);
      expect(afterWidths.some(w => w > 0)).toBeTruthy();

      // Restore viewport if possible
      if (originalViewport) {
        try {
          await page.setViewportSize(originalViewport);
        } catch (e) {
          // ignore
        }
      }

      // No page errors introduced by resize
      expect(page['_pageErrors'].length).toBe(0);
      expect(page['_consoleErrors'].length).toBe(0);
    });

    test('Robustness: rapid toggling of ShowRelations does not throw uncaught errors', async ({ page }) => {
      const showBtn = page.locator('#showRelations');

      // Rapid clicks
      for (let i = 0; i < 6; i++) {
        await showBtn.click();
        // tiny wait to allow handlers to process
        await page.waitForTimeout(40);
      }

      // After rapid toggles, the button should be in a valid state with expected text
      const text = await showBtn.textContent();
      expect(['Show Relationships', 'Hide Relationships']).toContain(text?.trim());

      // Ensure there are still relation-line elements
      const linesCount = await page.locator('.relation-line').count();
      expect(linesCount).toBeGreaterThan(0);

      // Assert there were no uncaught errors during rapid toggling
      expect(page['_pageErrors'].length).toBe(0);
      expect(page['_consoleErrors'].length).toBe(0);
    });
  });

  test.describe('Console and page error observation', () => {
    test('No unexpected console or page errors during full interaction flow', async ({ page }) => {
      const showBtn = page.locator('#showRelations');

      // Perform full cycle: show -> hover -> hide -> show -> resize
      await showBtn.click();
      await expect(showBtn).toHaveText('Hide Relationships');

      await page.locator('#orders').hover();
      await page.mouse.move(0, 0);

      await showBtn.click();
      await expect(showBtn).toHaveText('Show Relationships');

      await showBtn.click();
      await expect(showBtn).toHaveText('Hide Relationships');

      try {
        await page.setViewportSize({ width: 800, height: 600 });
      } catch (e) {
        // ignore if not permitted
      }
      await page.waitForTimeout(100);

      // Collect any console / page errors captured
      const consoleErrors = page['_consoleErrors'] || [];
      const pageErrors = page['_pageErrors'] || [];

      // We expect the application to not produce uncaught errors in normal usage.
      // If errors naturally occurred, they will be present in these arrays and will fail this assertion.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});