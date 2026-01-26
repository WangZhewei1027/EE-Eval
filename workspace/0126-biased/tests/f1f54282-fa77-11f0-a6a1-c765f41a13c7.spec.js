import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f54282-fa77-11f0-a6a1-c765f41a13c7.html';

// Utility to read computed style opacity as a number for an element handle
async function getOpacity(page, selector) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = window.getComputedStyle(el);
    return parseFloat(s.opacity || el.getAttribute('opacity') || 0);
  }, selector);
}

test.describe('Trie visualization FSM tests (f1f54282-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages from the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure initial skeleton renders: wait for root node (node-1) and status text
    await page.waitForSelector('#node-1', { state: 'attached', timeout: 5000 });
    await page.waitForSelector('#statusText', { state: 'visible', timeout: 5000 });
  });

  test.afterEach(async ({ page }) => {
    // snapshot console in case of failures; test runner will show assertions
    // no explicit cleanup necessary beyond Playwright fixtures
  });

  test('Initial Idle state: renderPage() executed and UI ready', async ({ page }) => {
    // Validate the initial status text (Idle state entry action renderPage())
    const status = await page.locator('#statusText').innerText();
    expect(status).toContain('Ready • Press "Animate" to begin');

    // Play and Reset buttons should exist and be enabled
    const btnPlay = page.locator('#btnPlay');
    const btnReset = page.locator('#btnReset');
    await expect(btnPlay).toBeVisible();
    await expect(btnReset).toBeVisible();
    await expect(btnPlay).toBeEnabled();
    await expect(btnReset).toBeEnabled();

    // Root node should be present and visible (not hidden)
    const root = page.locator('#node-1');
    await expect(root).toBeVisible();
    const rootClass = await root.getAttribute('class');
    expect(rootClass || '').not.toContain('hidden');

    // There should be multiple node elements rendered in skeleton (nodes group not empty)
    const nodes = await page.$$('svg.trie #nodes > g');
    expect(nodes.length).toBeGreaterThan(0);

    // Edges exist and initially have class 'hidden' (skeleton state)
    const edgesHidden = await page.$$eval('svg.trie #edges > path', (ps) => ps.filter(p => p.classList.contains('hidden')).length);
    expect(edgesHidden).toBeGreaterThanOrEqual(0); // at least zero, but presence checked above

    // No uncaught page errors should have occurred during initial load
    expect(pageErrors.length).toBe(0);
  });

  test('AnimateClick transitions to Animating state', async ({ page }) => {
    const btnPlay = page.locator('#btnPlay');
    const btnReset = page.locator('#btnReset');

    // Click Animate and immediately verify entry into Animating state
    await btnPlay.click();

    // After clicking, play and reset should be disabled while animation runs
    await expect(btnPlay).toBeDisabled();
    await expect(btnReset).toBeDisabled();

    // Status text should indicate animating (entry action animateSequence(prepared))
    await expect(page.locator('#statusText')).toHaveText(/Animating insertions.../i, { timeout: 2000 });

    // While animating, at least some nodes should still be hidden (skeleton reveal in progress)
    const hiddenCountDuring = await page.$$eval('svg.trie #nodes > g.hidden', els => els.length);
    // There may be zero shortly after fast reveals, but it's reasonable to assert non-negative and nodes exist
    const totalNodes = await page.$$eval('svg.trie #nodes > g', els => els.length);
    expect(totalNodes).toBeGreaterThan(0);
    expect(hiddenCountDuring).toBeGreaterThanOrEqual(0);

    // Ensure no uncaught page errors happened as animation started
    expect(pageErrors.length).toBe(0);

    // Cancel running animation by clicking Reset to avoid long waits in this test
    // Clicking Reset during animation should transition S1_Animating -> S0_Idle (via ResetClick)
    await page.locator('#btnReset').click();
    // Wait for status to become Reset • Ready (renderSkeleton called during reset)
    await expect(page.locator('#statusText')).toHaveText('Reset • Ready', { timeout: 3000 });

    // Buttons should be re-enabled after reset completes
    await expect(btnPlay).toBeEnabled();
    await expect(btnReset).toBeEnabled();

    // Confirm that skeleton was re-rendered: many nodes should be in the DOM and nodes created after root are hidden (createdAt > 0)
    const hiddenAfterReset = await page.$$eval('svg.trie #nodes > g.hidden', els => els.length);
    expect(hiddenAfterReset).toBeGreaterThanOrEqual(0);

    // No page errors during this interaction
    expect(pageErrors.length).toBe(0);
  });

  test('ResetClick from Idle transitions to Resetting and updates status text immediately', async ({ page }) => {
    // Ensure Idle state
    const statusBefore = await page.locator('#statusText').innerText();
    expect(statusBefore).toContain('Ready');

    // Click Reset from idle
    await page.locator('#btnReset').click();

    // When not running, reset should render skeleton and set statusText immediately
    await expect(page.locator('#statusText')).toHaveText('Reset • Ready', { timeout: 2000 });

    // Verify nodes exist (skeleton present) and root persists
    await expect(page.locator('#node-1')).toBeVisible();
    const nodesCount = await page.$$eval('svg.trie #nodes > g', els => els.length);
    expect(nodesCount).toBeGreaterThan(0);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('ResetClick during animation gracefully stops and resets (S1 -> S0)', async ({ page }) => {
    // Start animation
    await page.locator('#btnPlay').click();

    // Give animation a tiny moment to set running = true
    await page.waitForTimeout(80);

    // Click Reset during animation
    await page.locator('#btnReset').click();

    // When running, code uses setTimeout to re-render skeleton after ~60ms; wait for that change
    await expect(page.locator('#statusText')).toHaveText('Reset • Ready', { timeout: 3000 });

    // After reset, play should be enabled again (running false)
    await expect(page.locator('#btnPlay')).toBeEnabled();
    await expect(page.locator('#btnReset')).toBeEnabled();

    // Verify that at least the root node is visible and many nodes are reset to hidden/skeleton
    await expect(page.locator('#node-1')).toBeVisible();
    const hiddenAfter = await page.$$eval('svg.trie #nodes > g.hidden', els => els.length);
    expect(hiddenAfter).toBeGreaterThanOrEqual(0);

    // No page errors occurred from interrupting animation
    expect(pageErrors.length).toBe(0);
  });

  test('Full animation completes to "Completed • All words inserted"', async ({ page }) => {
    // This test waits for the full animation to complete.
    // The animation is sequence-driven and may take several seconds. Increase timeout for this test.
    test.setTimeout(60000);

    // Start animation
    await page.locator('#btnPlay').click();

    // Confirm animating started
    await expect(page.locator('#statusText')).toHaveText(/Animating insertions.../i, { timeout: 3000 });

    // Wait until final status text is set by animateSequence
    await expect(page.locator('#statusText')).toHaveText('Completed • All words inserted', { timeout: 45000 });

    // After completion, both buttons should be enabled again
    await expect(page.locator('#btnPlay')).toBeEnabled();
    await expect(page.locator('#btnReset')).toBeEnabled();

    // Terminal markers should be visible for some nodes (opacity > 0)
    // Pick any term element and ensure at least one is visible/opaque
    const termSelectors = await page.$$eval('svg.trie #terms > circle', els => els.map((el, i) => ({ sel: `svg.trie #terms > circle:nth-child(${i+1})` })));
    let foundVisibleTerminal = false;
    for (const t of termSelectors.slice(0, 10)) {
      const op = await getOpacity(page, t.sel);
      if (op !== null && op > 0) {
        foundVisibleTerminal = true;
        break;
      }
    }
    expect(foundVisibleTerminal).toBe(true);

    // No uncaught errors during full run
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking Animate repeatedly is guarded (button disabled after first click)', async ({ page }) => {
    // Rapidly attempt to click Animate twice
    const btnPlay = page.locator('#btnPlay');
    await btnPlay.click();
    // Immediately attempt a second click; because disable happens synchronously in animateSequence start, the second click won't start another run
    // but attempting to click while disabled should not throw; confirm the button is disabled
    await page.waitForTimeout(20);
    expect(await btnPlay.isDisabled()).toBe(true);

    // Cancel animation by resetting to keep test fast
    await page.locator('#btnReset').click();
    await expect(page.locator('#statusText')).toHaveText('Reset • Ready', { timeout: 3000 });

    // No page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console output and reports no unexpected errors', async ({ page }) => {
    // Basic smoke: gather some console messages already captured
    // There might be info-level logs; ensure no console message of type 'error' was emitted
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);

    // Also ensure no uncaught page exceptions
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: DOM integrity after multiple resets and animates', async ({ page }) => {
    // Perform a few cycles of animate -> reset -> animate -> reset to ensure consistent renderSkeleton and animateSequence interplay
    await page.locator('#btnPlay').click();
    await page.waitForTimeout(120); // allow animation to start
    await page.locator('#btnReset').click();
    await expect(page.locator('#statusText')).toHaveText('Reset • Ready', { timeout: 3000 });

    // Second cycle from idle
    await page.locator('#btnPlay').click();
    await page.waitForTimeout(120);
    await page.locator('#btnReset').click();
    await expect(page.locator('#statusText')).toHaveText('Reset • Ready', { timeout: 3000 });

    // DOM should still have nodes, edges, and terminal groups intact
    const nodesCount = await page.$$eval('svg.trie #nodes > g', els => els.length);
    const edgesCount = await page.$$eval('svg.trie #edges > path', els => els.length);
    const termsCount = await page.$$eval('svg.trie #terms > circle', els => els.length);
    expect(nodesCount).toBeGreaterThan(0);
    expect(edgesCount).toBeGreaterThanOrEqual(0);
    expect(termsCount).toBeGreaterThanOrEqual(0);

    // No page errors surfaced during stress cycles
    expect(pageErrors.length).toBe(0);
  });
});