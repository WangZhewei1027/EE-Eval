import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f801a2-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('OSI Model — Layered Architecture (Visual) — Interaction tests', () => {
  // Collect console errors and page errors to observe runtime problems.
  let consoleErrors = [];
  let consoleWarnings = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];
    pageErrors = [];

    // Listen to console messages and capture errors/warnings
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleErrors.push(text);
      if (type === 'warning') consoleWarnings.push(text);
      // keep other console messages also visible in arrays if needed
    });

    // Listen to uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the exact provided URL and ensure the document loads
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing specific to teardown beyond Playwright's automatic handling.
    // We intentionally do not try to patch or modify the page if errors are observed.
  });

  test('Initial Idle state: button and ARIA attributes are present and correct', async ({ page }) => {
    // Validate initial Idle state (S0_Idle)
    const playBtn = page.locator('#playBtn');
    const btnText = page.locator('#btnText');
    const card = page.locator('#card');
    const panel = page.locator('.panel');
    const layerList = page.locator('#layerList');

    // Button exists and is visible
    await expect(playBtn).toBeVisible({ timeout: 2000 });

    // Button should initially be aria-pressed="false"
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');

    // Button text should be "Explore Layers" initially
    await expect(btnText).toHaveText('Explore Layers');

    // Card should not have the expanded class initially
    await expect(card).not.toHaveClass(/(^|\s)expanded(\s|$)/);

    // The decorative panel and layerList should be hidden to assistive tech initially
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(layerList).toHaveAttribute('aria-hidden', 'true');

    // Check that a renderPage function was not injected by the page (FSM entry_action mentions renderPage)
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // We assert it is undefined (the page implementation does not define it).
    expect(hasRenderPage).toBe(false);

    // Ensure there were no uncaught page errors during initial load
    expect(pageErrors.length).toBe(0);
    // No console.error messages at load
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleExpandCollapse via click: expands and collapses the visualization', async ({ page }) => {
    // This test covers transitions S0_Idle -> S1_Expanded and back using click events.
    const playBtn = page.locator('#playBtn');
    const btnText = page.locator('#btnText');
    const card = page.locator('#card');
    const panel = page.locator('.panel');
    const layerList = page.locator('#layerList');
    const someDesc = page.locator('.layer[data-layer="7"] .desc'); // a desc element whose opacity should change

    // Click to expand (S0 -> S1)
    await playBtn.click();

    // Expect aria-pressed updated to true
    await expect(playBtn).toHaveAttribute('aria-pressed', 'true');

    // Button text becomes 'Collapse'
    await expect(btnText).toHaveText('Collapse');

    // Card should now have 'expanded' class
    await expect(card).toHaveClass(/(^|\s)expanded(\s|$)/);

    // Panel and layerList should be visible to assistive tech
    await expect(panel).toHaveAttribute('aria-hidden', 'false');
    await expect(layerList).toHaveAttribute('aria-hidden', 'false');

    // The desc element should have transitioned to visible opacity; wait a short time for CSS transition to settle
    await page.waitForTimeout(200); // small wait for transitions applied by JS/CSS
    const descOpacity = await someDesc.evaluate((el) => window.getComputedStyle(el).opacity);
    expect(Number(descOpacity)).toBeGreaterThan(0.9);

    // Click again to collapse (S1 -> S0)
    await playBtn.click();

    // After collapse: aria-pressed false
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');

    // Button text returns to 'Explore Layers'
    await expect(btnText).toHaveText('Explore Layers');

    // Card should no longer have 'expanded'
    await expect(card).not.toHaveClass(/(^|\s)expanded(\s|$)/);

    // Panel and layerList hidden again
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(layerList).toHaveAttribute('aria-hidden', 'true');

    // Ensure no page-level uncaught exceptions happened during these interactions
    expect(pageErrors.length).toBe(0);
    // Also ensure no console.error messages were emitted
    expect(consoleErrors.length).toBe(0);
  });

  test('KeyboardToggle via Enter and Space toggles expansion state (keyboard accessibility)', async ({ page }) => {
    // Validate keyboard-based toggling (KeyboardToggle event in FSM)
    const playBtn = page.locator('#playBtn');
    const btnText = page.locator('#btnText');
    const card = page.locator('#card');
    const panel = page.locator('.panel');
    const layerList = page.locator('#layerList');

    // Focus the button
    await playBtn.focus();
    // Press Enter: should toggle to expanded
    await page.keyboard.press('Enter');

    await expect(playBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(btnText).toHaveText('Collapse');
    await expect(card).toHaveClass(/(^|\s)expanded(\s|$)/);
    await expect(panel).toHaveAttribute('aria-hidden', 'false');
    await expect(layerList).toHaveAttribute('aria-hidden', 'false');

    // Press Space: should toggle back to collapsed (note: space is represented as 'Space' in Playwright)
    await playBtn.focus();
    await page.keyboard.press('Space');

    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(btnText).toHaveText('Explore Layers');
    await expect(card).not.toHaveClass(/(^|\s)expanded(\s|$)/);
    await expect(panel).toHaveAttribute('aria-hidden', 'true');
    await expect(layerList).toHaveAttribute('aria-hidden', 'true');

    // Pressing other keys should not toggle (edge case)
    await playBtn.focus();
    // record state
    const beforePressed = await playBtn.getAttribute('aria-pressed');
    await page.keyboard.press('KeyA'); // arbitrary key
    const afterPressed = await playBtn.getAttribute('aria-pressed');
    expect(afterPressed).toBe(beforePressed);

    // Confirm no runtime page errors or console.error messages occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid interactions: multiple quick clicks toggle state reliably and do not cause errors', async ({ page }) => {
    // Edge case: user rapidly clicks the button multiple times
    const playBtn = page.locator('#playBtn');
    const card = page.locator('#card');

    // Rapidly click 5 times
    for (let i = 0; i < 5; i++) {
      await playBtn.click();
    }

    // The net result should be that the state matches odd/even clicks: 5 clicks -> expanded (since initial was collapsed)
    const shouldBeExpanded = true; // 5 toggles from false -> true
    const hasExpanded = await card.evaluate((el) => el.classList.contains('expanded'));
    expect(hasExpanded).toBe(shouldBeExpanded);

    // Now click 1 more time to make it collapsed
    await playBtn.click();
    const hasExpandedAfter = await card.evaluate((el) => el.classList.contains('expanded'));
    expect(hasExpandedAfter).toBe(false);

    // Ensure no JS errors surfaced due to rapid interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Visual and DOM integrity: layers exist and are properly ordered, panel contains expected rows', async ({ page }) => {
    // Validate presence and content for critical DOM parts described in FSM and HTML
    const layers = page.locator('.layer');
    const panelRows = page.locator('.panel .layer-desc .row');

    // Expect seven layer elements (layers 7..1)
    await expect(layers).toHaveCount(7);

    // Check topmost layer has data-layer="7"
    const firstLayerData = await layers.nth(0).getAttribute('data-layer');
    // Note: ordering in DOM is 7..1, so the first should be "7"
    expect(firstLayerData).toBe('7');

    // Panel's layer list initially hidden; but if we expand, rows should be present and equal to 7
    await page.locator('#playBtn').click(); // expand
    await expect(panelRows).toHaveCount(7);

    // Validate some textual content in panel rows
    const firstRowText = await panelRows.nth(0).innerText();
    expect(firstRowText).toMatch(/Application/i);

    // Collapse to restore initial state for other tests
    await page.locator('#playBtn').click();

    // Ensure no page errors or console.error occurred during validation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console warnings/errors and assert none are present (or report them)', async ({ page }) => {
    // This test demonstrates observing console and page errors.
    // We assert that there were no uncaught exceptions or console.error messages.
    // If errors exist, we fail the test and include details to aid debugging.

    // Small no-op to ensure listeners have captured relevant things after load
    await page.waitForTimeout(100);

    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // If any errors occurred, surface them clearly in the assertion message
      const combined = [
        pageErrors.length ? `Page errors:\n${pageErrors.join('\n----\n')}` : null,
        consoleErrors.length ? `Console.errors:\n${consoleErrors.join('\n----\n')}` : null,
        consoleWarnings.length ? `Console.warnings:\n${consoleWarnings.join('\n----\n')}` : null,
      ].filter(Boolean).join('\n\n');

      // Fail with detailed diagnostics
      expect(false, `Runtime issues detected:\n\n${combined}`).toBe(true);
    }

    // Otherwise assert that there were no such errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});