import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba8c431-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Graph FSM Tests - 0ba8c431-d5b2-11f0-b169-abe023d0d932', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Setup: attach listeners for console and page errors and navigate to the page before each test.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  // Teardown: no special teardown needed beyond Playwright's built-ins.
  test.afterEach(async () => {
    // Intentionally left empty: we capture console and page errors during each test.
  });

  test('Initial state S0_Idle: page renders and graph title is present (entry action verification)', async ({ page }) => {
    // This validates the FSM entry state S0_Idle by checking the expected evidence:
    // the presence of the graph title "Directed Graph".
    const title = await page.locator('.graph-title').textContent();
    expect(title).toBe('Directed Graph');

    // Verify no uncaught page runtime errors were emitted during load.
    expect(pageErrors.length).toBe(0);

    // Verify there are no console.error messages emitted during load.
    const errorConsole = consoleMessages.find((m) => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  // Helper function to assert the S1_EdgeClicked state for a particular edge id.
  async function assertEdgeClickedState(page, edgeId) {
    // After click, the implementation sets inline styles:
    // edge.style.color = "black"; edge.style.background = "white"; edge.style.cursor = "pointer";
    const style = await page.$eval(`#${edgeId}`, (el) => {
      return {
        inlineColor: el.style.color,
        inlineBackground: el.style.background,
        inlineCursor: el.style.cursor,
        computedColor: window.getComputedStyle(el).color,
        computedBackground: window.getComputedStyle(el).backgroundColor,
        computedCursor: window.getComputedStyle(el).cursor
      };
    });

    // Expect inline styles to reflect the transition's expected observables.
    expect(style.inlineColor).toBe('black');
    expect(style.inlineBackground).toBe('white');
    expect(style.inlineCursor).toBe('pointer');

    // Also verify the computed style is not empty (sanity check). Colors may be returned differently
    // for computedColor (e.g., 'rgb(0, 0, 0)'), so we assert presence rather than exact match for computed.
    expect(style.computedColor).toBeTruthy();
    expect(style.computedBackground).toBeTruthy();
    expect(style.computedCursor).toBeTruthy();
  }

  // Test each edge click transition from S0_Idle to S1_EdgeClicked.
  for (const edgeId of ['edge1', 'edge2', 'edge3', 'edge4', 'edge5', 'edge6']) {
    test(`Transition test: clicking #${edgeId} should enter S1_EdgeClicked and change styles`, async ({ page }) => {
      // Ensure the edge exists in the DOM
      const edge = await page.$(`#${edgeId}`);
      expect(edge).not.toBeNull();

      // Click the edge to trigger the transition
      await page.click(`#${edgeId}`);

      // Validate expected style changes (evidence for S1_EdgeClicked)
      await assertEdgeClickedState(page, edgeId);

      // Ensure no page errors were emitted as a consequence of the click
      expect(pageErrors.length).toBe(0);

      // Ensure no console.error messages were emitted by clicking
      const clickErrorConsole = consoleMessages.find((m) => m.type === 'error');
      expect(clickErrorConsole).toBeUndefined();
    });
  }

  test('Click idempotence: clicking the same edge multiple times keeps the expected S1_EdgeClicked styles', async ({ page }) => {
    const edgeId = 'edge1';
    // Click 3 times quickly
    await page.click(`#${edgeId}`);
    await page.click(`#${edgeId}`);
    await page.click(`#${edgeId}`);

    // Styles should remain consistent after repeated clicks
    await assertEdgeClickedState(page, edgeId);

    // No runtime errors should have been introduced by repeated interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Sequential clicks: clicking all edges sequentially transitions each to S1_EdgeClicked without errors', async ({ page }) => {
    // Click all edges in sequence and assert each reaches the S1_EdgeClicked evidence state.
    const edges = ['edge1', 'edge2', 'edge3', 'edge4', 'edge5', 'edge6'];
    for (const id of edges) {
      await page.click(`#${id}`);
      await assertEdgeClickedState(page, id);
    }

    // After interacting with all edges, ensure no uncaught errors were recorded.
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: non-existent element should not be present and clicking it should throw', async ({ page }) => {
    // Verify the non-existent element is not present in the DOM
    const missing = await page.$('#edge999');
    expect(missing).toBeNull();

    // Attempting to click a non-existent selector should reject and throw; assert that behavior.
    await expect(page.click('#edge999', { timeout: 1000 })).rejects.toThrow();
  });

  test('Robustness: rapid interactions across edges should not produce runtime errors', async ({ page }) => {
    // Rapidly click edges in a short burst
    const edges = ['#edge1', '#edge2', '#edge3', '#edge4', '#edge5', '#edge6'];
    // Fire clicks without awaiting style checks to simulate rapid user interaction
    for (const sel of edges) {
      // use locator().click to avoid throwing on missing element (they exist)
      await page.locator(sel).click();
    }

    // Slight delay to allow any handlers to run
    await page.waitForTimeout(100);

    // Ensure all clicked edges reached the expected inline styles
    for (const id of ['edge1', 'edge2', 'edge3', 'edge4', 'edge5', 'edge6']) {
      await assertEdgeClickedState(page, id);
    }

    // No page runtime errors observed
    expect(pageErrors.length).toBe(0);

    // Assert there are no console.error messages
    const anyConsoleError = consoleMessages.some((m) => m.type === 'error');
    expect(anyConsoleError).toBe(false);
  });

  test('Sanity check: event handlers were wired (click produces style changes) - evidence-based validation', async ({ page }) => {
    // This test double-checks that the evidence items in the FSM (addEventListener on each edge)
    // resulted in observable behavior: a click leads to style changes. We pick a sample edge.
    const sample = 'edge4';
    // Ensure initial inline style is empty (pre-click)
    const beforeInline = await page.$eval(`#${sample}`, (el) => el.getAttribute('style'));
    // It may be null or empty string; ensure that style mutation occurs after click
    await page.click(`#${sample}`);
    const afterInline = await page.$eval(`#${sample}`, (el) => el.getAttribute('style'));
    expect(afterInline).not.toBe(beforeInline);

    // Validate expected style components are present in the inline style string
    expect(afterInline).toContain('color: black');
    expect(afterInline).toContain('background: white');
  });

  test('Diagnostics: capture and report any runtime errors or console errors if they occur', async ({ page }) => {
    // This test intentionally collects diagnostics and asserts that either:
    // - there were no runtime errors (most likely), or
    // - if there were, they are instances of Error with messages (we assert shape).
    // (We do not inject or fix code; we simply observe.)
    // Interact a bit to trigger potential runtime issues
    await page.click('#edge2');

    // Wait briefly
    await page.waitForTimeout(50);

    // If there are page errors, assert they are Error instances and include a message.
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message.length).toBeGreaterThan(0);
      }
    } else {
      // Otherwise, assert that there were no page errors recorded.
      expect(pageErrors.length).toBe(0);
    }

    // For console messages of type 'error', assert they include text
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    if (errorConsoleMessages.length > 0) {
      for (const msg of errorConsoleMessages) {
        expect(typeof msg.text).toBe('string');
        expect(msg.text.length).toBeGreaterThan(0);
      }
    } else {
      // No console errors observed
      expect(errorConsoleMessages.length).toBe(0);
    }
  });
});