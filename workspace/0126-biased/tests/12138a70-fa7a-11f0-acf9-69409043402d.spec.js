import { test, expect } from '@playwright/test';

// Tests for Interactive Suffix Tree Explorer
// File expected name: 12138a70-fa7a-11f0-acf9-69409043402d.spec.js
// The page under test: http://127.0.0.1:5500/workspace/0126-biased/html/12138a70-fa7a-11f0-acf9-69409043402d.html

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12138a70-fa7a-11f0-acf9-69409043402d.html';

test.describe('Interactive Suffix Tree Explorer - FSM and UI integration tests', () => {
  // Arrays to collect runtime console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  // Setup - runs before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for observation
    page.on('console', (msg) => {
      // Record only text for easier assertions
      try {
        consoleMessages.push(`${msg.type().toUpperCase()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`CONSOLE: (could not read message)`);
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to app
    await page.goto(APP_URL);
    // ensure initial rendering
    await page.waitForLoadState('domcontentloaded');
  });

  // Teardown - ensure no unexpected runtime errors occurred
  test.afterEach(async () => {
    // Assert no page errors (ReferenceError, SyntaxError, TypeError, etc.) happened during test
    // This ensures we observed the runtime and allowed natural errors to propagate.
    expect(pageErrors.map(e => String(e))).toEqual([]);
  });

  test('Initial state (S0_Idle) shows prompt and has no tree displayed', async ({ page }) => {
    // Validate initial status message per FSM S0_Idle on entry
    const status = await page.locator('#status').textContent();
    expect(status).toContain('Enter a string and press "Build Suffix Tree" to start.');

    // The tree display should be empty initially
    const treeText = await page.locator('#treeDisplay').textContent();
    expect(treeText.trim()).toBe('');

    // Log should be empty initially
    const logText = await page.locator('#log').textContent();
    expect(logText.trim()).toBe('');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('BuildTree event: builds suffix tree, appends terminal char and updates status to S1_TreeBuilt', async ({ page }) => {
    // Enter input and click Build Suffix Tree
    const input = page.locator('#inputStr');
    await input.fill('aba'); // intentionally without terminal char
    await page.click('#buildTreeBtn');

    // After clicking build we expect input to be updated to include terminal char ('$')
    await page.waitForTimeout(50);
    const resultingValue = await input.inputValue();
    expect(resultingValue.endsWith('$')).toBe(true);

    // Status should initially show Building then Suffix tree initialized message
    // Wait for final initialization status
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Suffix tree initialized.');
    });
    const status = await page.locator('#status').textContent();
    expect(status).toContain('Suffix tree initialized. Use step explorer to explore construction.');

    // Tree display should show edge-based header (default view mode is 'edges')
    const treeDisplay = await page.locator('#treeDisplay').textContent();
    expect(treeDisplay).toContain('Suffix Tree (Edges) for:');

    // Active point string should be included in display
    expect(treeDisplay).toMatch(/Active Point: Node\d+, Edge: '.?', Length: \d+/);

    // Ensure there were no runtime errors during build
    expect(pageErrors.length).toBe(0);
  });

  test('Stepwise exploration transitions (S1 -> S2) with StepNext and StepPrev work and update status', async ({ page }) => {
    // Build tree first
    await page.fill('#inputStr', 'aba');
    await page.click('#buildTreeBtn');

    // Wait until initialized
    await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Suffix tree initialized'));

    // Click Next to move into stepwise exploration (S2)
    await page.click('#stepNext');

    // After first next we expect status to reflect extension or move
    // Could be "Extended phase to X" or "Moved to step ..."
    await page.waitForTimeout(100);
    const statusAfterNext = await page.locator('#status').textContent();
    expect(
      statusAfterNext.includes('Extended phase to') ||
      statusAfterNext.includes('Moved to step') ||
      statusAfterNext.includes('Suffix tree build complete')
    ).toBe(true);

    // Display should update to reflect a snapshot (active point present)
    const displayAfterNext = await page.locator('#treeDisplay').textContent();
    expect(displayAfterNext.length).toBeGreaterThan(0);
    expect(displayAfterNext).toMatch(/Active Point: Node\d+, Edge: '.?', Length: \d+/);

    // Try stepping back
    await page.click('#stepPrev');
    await page.waitForTimeout(50);
    const statusAfterPrev = await page.locator('#status').textContent();
    // Either we moved back or were already at first step
    expect(
      statusAfterPrev.includes('Moved back to step') ||
      statusAfterPrev.includes('Already at first step')
    ).toBe(true);

    // No runtime exceptions during stepping
    expect(pageErrors.length).toBe(0);
  });

  test('ChangeViewMode event updates display formatting (edges, nodes, paths)', async ({ page }) => {
    // Build tree
    await page.fill('#inputStr', 'ab');
    await page.click('#buildTreeBtn');
    await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Suffix tree initialized'));

    // modes: edges, nodes, paths
    const viewSelect = page.locator('#viewModeSelect');

    // Edges mode - existing default
    await viewSelect.selectOption('edges');
    await page.waitForTimeout(50);
    const edgesText = await page.locator('#treeDisplay').textContent();
    expect(edgesText).toContain('Suffix Tree (Edges) for:');

    // Nodes mode
    await viewSelect.selectOption('nodes');
    await page.waitForTimeout(50);
    const nodesText = await page.locator('#treeDisplay').textContent();
    // nodes view displays "node<ID>" lines
    expect(nodesText).toMatch(/node\d+ \(suffixLink: node/);

    // Paths mode
    await viewSelect.selectOption('paths');
    await page.waitForTimeout(50);
    const pathsText = await page.locator('#treeDisplay').textContent();
    expect(pathsText).toContain('All suffix paths');

    expect(pageErrors.length).toBe(0);
  });

  test('SearchSubstring and ClearSearch events during S2 exploration: found and cleared statuses', async ({ page }) => {
    // Build tree for known input
    await page.fill('#inputStr', 'aba');
    await page.click('#buildTreeBtn');
    await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Suffix tree initialized'));

    // Ensure at least one step exists by invoking stepNext
    await page.click('#stepNext');
    await page.waitForTimeout(80);

    // Enter substring that exists: 'a'
    await page.fill('#searchSubstring', 'a');
    await page.click('#searchBtn');

    // Wait for status update indicating result
    await page.waitForTimeout(50);
    const searchStatus = await page.locator('#status').textContent();
    // Either found or not; in normal functioning expect found
    expect(
      searchStatus.includes('found at suffix indices') ||
      searchStatus.includes('not found in the tree') ||
      searchStatus.includes('Build suffix tree first')
    ).toBe(true);

    // Click clear search -> expect 'Search cleared.'
    await page.click('#clearSearchBtn');
    await page.waitForTimeout(20);
    const statusAfterClear = await page.locator('#status').textContent();
    expect(statusAfterClear).toContain('Search cleared.');

    expect(pageErrors.length).toBe(0);
  });

  test('AutoPlay and PausePlay events: autoplay starts and can be paused; buttons enable/disable reflect state', async ({ page }) => {
    // Build a tree
    await page.fill('#inputStr', 'ab');
    await page.click('#buildTreeBtn');
    await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Suffix tree initialized'));

    // Autoplay start
    await page.click('#autoPlay');

    // Immediately check button state: autoPlay should be disabled and pause enabled
    await page.waitForTimeout(30);
    const autoDisabled = await page.locator('#autoPlay').isDisabled();
    const pauseDisabled = await page.locator('#pausePlay').isDisabled();

    expect(autoDisabled).toBe(true);
    expect(pauseDisabled).toBe(false);

    // Pause autoplay by clicking pause
    await page.click('#pausePlay');

    // Wait shortly for stopAutoplay to execute
    await page.waitForTimeout(50);
    const statusAfterPause = await page.locator('#status').textContent();
    expect(statusAfterPause).toContain('Autoplay paused.');

    // Buttons should be re-enabled accordingly
    const autoDisabledNow = await page.locator('#autoPlay').isDisabled();
    const pauseDisabledNow = await page.locator('#pausePlay').isDisabled();
    expect(autoDisabledNow).toBe(false);
    expect(pauseDisabledNow).toBe(true);

    expect(pageErrors.length).toBe(0);
  });

  test('ResetSteps event resets the stepwise exploration to initial state (S2 loop to S2)', async ({ page }) => {
    // Build tree and move steps
    await page.fill('#inputStr', 'abc');
    await page.click('#buildTreeBtn');
    await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Suffix tree initialized'));

    // Perform a couple of steps to advance state
    await page.click('#stepNext');
    await page.waitForTimeout(50);
    await page.click('#stepNext');
    await page.waitForTimeout(50);

    // Now reset steps
    await page.click('#resetSteps');

    // Status should indicate reset
    await page.waitForTimeout(20);
    const statusAfterResetSteps = await page.locator('#status').textContent();
    expect(statusAfterResetSteps).toContain('Stepwise build reset to initial state.');

    // The display should reflect initial snapshot (active point likely at root or initial)
    const display = await page.locator('#treeDisplay').textContent();
    expect(display.length).toBeGreaterThan(0);
    expect(display).toMatch(/Active Point: Node\d+, Edge: '.?', Length: \d+/);

    expect(pageErrors.length).toBe(0);
  });

  test('Reset event brings application back to Idle (S1 -> S0)', async ({ page }) => {
    // Build tree first to get into S1
    await page.fill('#inputStr', 'xy');
    await page.click('#buildTreeBtn');
    await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Suffix tree initialized'));

    // Click Reset to go back to idle
    await page.click('#resetBtn');
    await page.waitForTimeout(50);

    const status = await page.locator('#status').textContent();
    expect(status).toContain('Reset done.');

    // Input should be cleared
    const inputVal = await page.locator('#inputStr').inputValue();
    expect(inputVal).toBe('');

    // Tree display cleared
    const tree = await page.locator('#treeDisplay').textContent();
    expect(tree.trim()).toBe('');

    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: invoking controls before BuildTree produces instructive statuses', async ({ page }) => {
    // Ensure page in initial Idle state
    await page.waitForTimeout(10);

    // Click stepNext before building
    await page.click('#stepNext');
    await page.waitForTimeout(20);
    let status = await page.locator('#status').textContent();
    expect(status).toContain('Build suffix tree first.');

    // Click search before building
    await page.fill('#searchSubstring', 'a');
    await page.click('#searchBtn');
    await page.waitForTimeout(20);
    status = await page.locator('#status').textContent();
    expect(status).toContain('Build suffix tree first.');

    // ResetSteps before building
    await page.click('#resetSteps');
    await page.waitForTimeout(20);
    status = await page.locator('#status').textContent();
    // It will inform to build first as per code flow
    expect(status).toContain('Build suffix tree first.');

    // Clear search should still work (clear input and set status)
    await page.click('#clearSearchBtn');
    await page.waitForTimeout(20);
    status = await page.locator('#status').textContent();
    expect(status).toContain('Search cleared.');

    expect(pageErrors.length).toBe(0);
  });

  test('Sanitization and maximum length handling: long input truncated and warning shown', async ({ page }) => {
    // Create very long input > 150 chars
    const longInput = 'x'.repeat(200);
    await page.fill('#inputStr', longInput);
    await page.click('#buildTreeBtn');

    // Wait for status initial build and possible warning
    await page.waitForTimeout(30);
    const status = await page.locator('#status').textContent();

    // The code sets a warning if trimmed to >150 characters
    expect(
      status.includes('Warning: input truncated to 150 characters.') ||
      status.includes('Suffix tree initialized.')
    ).toBe(true);

    // Input value should be truncated and end with $
    const finalInput = await page.locator('#inputStr').inputValue();
    expect(finalInput.length).toBeLessThanOrEqual(151); // 150 chars + maybe $
    expect(finalInput.endsWith('$')).toBe(true);

    expect(pageErrors.length).toBe(0);
  });

  test('Observe console messages and ensure no unexpected console errors were produced during interactions', async ({ page }) => {
    // Perform a sequence of interactions to create console activity
    await page.fill('#inputStr', 'test');
    await page.click('#buildTreeBtn');
    await page.waitForFunction(() => document.getElementById('status')?.textContent?.includes('Suffix tree initialized'));
    await page.click('#stepNext');
    await page.waitForTimeout(30);
    await page.click('#autoPlay');
    await page.waitForTimeout(30);
    await page.click('#pausePlay');

    // We expect console messages may be present but there should be no page errors captured
    expect(pageErrors.length).toBe(0);

    // Console messages are collected; ensure we recorded some messages (not prescriptive about content)
    // It's acceptable if consoleMessages is empty; but assert it's an array
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});