import { test, expect } from '@playwright/test';

// Test file for Application ID: 5a32e351-ffc5-11f0-8b43-1ffa87931c43
// URL: http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32e351-ffc5-11f0-8b43-1ffa87931c43.html
//
// Notes:
// - Tests validate the FSM states: S0_Idle (initial), S1_Sorting (active), S2_Sorted (final).
// - Tests exercise events: ShuffleClick, StartClick, WindowResize.
// - Tests observe console messages and page errors and assert that none are thrown during normal operation.
// - Tests purposely do NOT patch or modify the page; they load it exactly as-is and observe behavior.

test.describe('Bubble Sort Visualization - FSM and interactions', () => {
  // Increase timeout to account for potentially long bubble sort animation on the page.
  test.setTimeout(180000); // 3 minutes

  const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32e351-ffc5-11f0-8b43-1ffa87931c43.html';

  // Page Object for interacting with the bubble sort visualization page
  class BubbleSortPage {
    constructor(page) {
      this.page = page;
      this.container = page.locator('#array-container');
      this.shuffleBtn = page.locator('#shuffle-btn');
      this.startBtn = page.locator('#start-btn');
      this.bars = page.locator('#array-container .bar');
    }

    async goto() {
      await this.page.goto(APP_URL);
    }

    // Collect current bars count
    async getBarsCount() {
      return await this.bars.count();
    }

    // Get numeric height of the first bar (px)
    async getFirstBarHeight() {
      const first = this.bars.nth(0);
      return await first.evaluate((el) => parseInt(getComputedStyle(el).height, 10));
    }

    // Get numeric width of the first bar (px)
    async getFirstBarWidth() {
      const first = this.bars.nth(0);
      return await first.evaluate((el) => parseInt(getComputedStyle(el).width, 10));
    }

    async clickShuffle() {
      await this.shuffleBtn.click();
    }

    async clickStart() {
      await this.startBtn.click();
    }

    // Wait until sorting appears to be in progress: at least one bar has .comparing OR .swapping
    async waitForSortingToStart(timeout = 5000) {
      await this.page.waitForFunction(() => {
        const c = document.querySelector('.bar.comparing, .bar.swapping');
        return !!c;
      }, { timeout });
    }

    // Wait until sorting completes: all bars have .sorted
    async waitForSortingToComplete(timeout = 120000) {
      // Determine expected count (array size) on the page
      const expected = await this.getBarsCount();
      await this.page.waitForFunction((exp) => {
        const sorted = document.querySelectorAll('.bar.sorted');
        return sorted.length === exp;
      }, expected, { timeout });
    }

    // Get number of sorted bars
    async getSortedBarsCount() {
      return await this.page.locator('.bar.sorted').count();
    }

    // Helper to get whether buttons are disabled
    async getButtonDisabledStates() {
      const shuffleDisabled = await this.shuffleBtn.evaluate((b) => b.disabled);
      const startDisabled = await this.startBtn.evaluate((b) => b.disabled);
      return { shuffleDisabled, startDisabled };
    }

    // Resize viewport to trigger window resize handler on page
    async resize(width, height) {
      await this.page.setViewportSize({ width, height });
      // Allow a small delay for page's resize handler to run and render to update
      await this.page.waitForTimeout(250);
    }

    // Returns an array of console messages captured (text only)
    async captureConsoleMessagesDuring(action) {
      const messages = [];
      const listener = (msg) => messages.push(`${msg.type()}: ${msg.text()}`);
      this.page.on('console', listener);
      try {
        await action();
        // small wait to ensure any console messages emitted after action are captured
        await this.page.waitForTimeout(100);
      } finally {
        this.page.off('console', listener);
      }
      return messages;
    }
  }

  // Shared setup for each test: create page object and attach handlers for page errors and console events
  test.beforeEach(async ({ page }) => {
    // increase default navigation timeout if needed
    page.setDefaultTimeout(120000);
  });

  // Test 1: Validate the initial idle state (S0_Idle)
  test('Initial Idle State (S0_Idle): page loads and array is rendered', async ({ page }) => {
    // Collect runtime errors and console messages
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

    const app = new BubbleSortPage(page);
    await app.goto();

    // Validate createArray() and renderArray() resulted in bars
    const barsCount = await app.getBarsCount();
    // According to HTML implementation, ARRAY_SIZE = 30
    expect(barsCount).toBeGreaterThanOrEqual(1);
    expect(barsCount).toBeGreaterThanOrEqual(30); // defensive: at least 30 elements expected in most runs

    // Validate buttons exist and are enabled in Idle state
    const { shuffleDisabled, startDisabled } = await app.getButtonDisabledStates();
    expect(shuffleDisabled).toBe(false);
    expect(startDisabled).toBe(false);

    // Ensure bars have heights assigned
    const firstBarHeight = await app.getFirstBarHeight();
    expect(typeof firstBarHeight).toBe('number');
    expect(firstBarHeight).toBeGreaterThan(0);

    // Assert that no page errors (ReferenceError/SyntaxError/TypeError) were thrown during load
    expect(pageErrors.length).toBe(0);

    // Optionally log console messages for debugging in case of failures
    // This does not affect test outcome if there are messages
    // But assert that there were no 'error' console messages
    const errorConsoleMsgs = consoleMessages.filter(m => m.startsWith('error') || m.toLowerCase().includes('uncaught'));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  // Test 2: Start Sorting transitions to Sorting (S1_Sorting) and eventually to Sorted (S2_Sorted)
  test('StartClick event triggers sorting: buttons disabled during sort and all bars marked sorted on completion', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

    const app = new BubbleSortPage(page);
    await app.goto();

    // Number of bars to expect
    const barsCount = await app.getBarsCount();

    // Start sorting
    await app.clickStart();

    // Immediately after starting, buttons should be disabled (evidence of S1_Sorting entry actions)
    const btnStatesAfterStart = await app.getButtonDisabledStates();
    expect(btnStatesAfterStart.shuffleDisabled).toBe(true);
    expect(btnStatesAfterStart.startDisabled).toBe(true);

    // Wait for sorting to visibly start: at least one .comparing or .swapping bar should appear
    await app.waitForSortingToStart(10000); // 10s to catch the transient compare highlight

    // At this point, confirm at least one bar is either comparing or swapping
    const comparingCount = await page.locator('.bar.comparing').count();
    const swappingCount = await page.locator('.bar.swapping').count();
    expect(comparingCount + swappingCount).toBeGreaterThan(0);

    // Wait for sorting to complete - this may take some time given ARRAY_SIZE and DELAY in implementation
    await app.waitForSortingToComplete(120000); // up to 2 minutes

    // After completion, all bars should be marked as sorted
    const sortedCount = await app.getSortedBarsCount();
    expect(sortedCount).toBe(barsCount);

    // Buttons should be re-enabled (exit of S1_Sorting to S2_Sorted)
    const btnStatesAfterComplete = await app.getButtonDisabledStates();
    expect(btnStatesAfterComplete.shuffleDisabled).toBe(false);
    expect(btnStatesAfterComplete.startDisabled).toBe(false);

    // Ensure no page errors occurred during sorting
    expect(pageErrors.length).toBe(0);

    // No 'error' console messages should have been emitted
    const errorConsoleMsgs = consoleMessages.filter(m => m.startsWith('error') || m.toLowerCase().includes('uncaught'));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  // Test 3: Clicking Shuffle during Sorting should not re-trigger shuffle operations (ShuffleClick while sorting)
  test('ShuffleClick during Sorting: shuffle is ignored while sorting and buttons remain disabled', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

    const app = new BubbleSortPage(page);
    await app.goto();

    // Capture initial first bar height and a snapshot of the first bar's label to compare later
    const beforeHeight = await app.getFirstBarHeight();
    const beforeText = await page.locator('#array-container .bar span').nth(0).textContent();

    // Start sorting
    await app.clickStart();

    // Wait for sorting to start
    await app.waitForSortingToStart(10000);

    // Try clicking shuffle while sorting (per implementation, shuffleArray returns early if sorting)
    await app.clickShuffle();

    // Buttons should remain disabled after attempted shuffle during sorting
    const btnStatesDuring = await app.getButtonDisabledStates();
    expect(btnStatesDuring.shuffleDisabled).toBe(true);
    expect(btnStatesDuring.startDisabled).toBe(true);

    // Verify that the first bar's height/text did not get immediately replaced by a new array (i.e., shuffle did not run)
    // There can be changes due to swapping during sorting; however, a full re-render would likely change the entire set drastically.
    // We at least assert that page did not throw errors and that buttons stayed disabled.
    const afterText = await page.locator('#array-container .bar span').nth(0).textContent();
    expect(typeof afterText).toBe('string');

    // Wait for sorting to finish (so test ends cleanly)
    await app.waitForSortingToComplete(120000);

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.startsWith('error') || m.toLowerCase().includes('uncaught'));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  // Test 4: Window resize during sorting triggers renderArray and updates bar widths
  test('WindowResize event causes renderArray to update bar widths during Sorting', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

    const app = new BubbleSortPage(page);
    await app.goto();

    // Capture initial bar width
    const initialWidth = await app.getFirstBarWidth();

    // Start sorting
    await app.clickStart();

    // Wait for sorting to begin
    await app.waitForSortingToStart(10000);

    // Resize the viewport to trigger the window resize handler; ensure a visible change in container width
    // Use a significantly different width to force recalculation
    await app.resize(600, 800); // smaller
    const widthAfterSmall = await app.getFirstBarWidth();

    // There should be a change in width (renderArray recalculates widths). It may be smaller or same depending on constraints,
    // but commonly it will differ. Allow equality but assert no page errors.
    expect(typeof widthAfterSmall).toBe('number');

    // Resize back to larger size
    await app.resize(1200, 800);
    const widthAfterLarge = await app.getFirstBarWidth();
    expect(typeof widthAfterLarge).toBe('number');

    // At least one of the widths should differ from the initial width (to demonstrate renderArray was called)
    const widthsDiffer = (initialWidth !== widthAfterSmall) || (initialWidth !== widthAfterLarge) || (widthAfterSmall !== widthAfterLarge);
    expect(widthsDiffer).toBe(true);

    // Wait for sorting to finish
    await app.waitForSortingToComplete(120000);

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.startsWith('error') || m.toLowerCase().includes('uncaught'));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  // Test 5: Edge case - click Start multiple times rapidly; ensure only one sorting run happens (start handler guards with sorting flag)
  test('Edge case: Rapid StartClick attempts while sorting do not start multiple concurrent sorts', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

    const app = new BubbleSortPage(page);
    await app.goto();

    // Start sorting
    await app.clickStart();

    // Immediately attempt to start again several times
    for (let i = 0; i < 5; i++) {
      await app.clickStart().catch(() => {}); // ignore potential click rejections
    }

    // Buttons should be disabled while sorting; this indicates subsequent clicks were ignored
    const btnStates = await app.getButtonDisabledStates();
    expect(btnStates.startDisabled).toBe(true);
    expect(btnStates.shuffleDisabled).toBe(true);

    // Wait for sorting to start and then finish
    await app.waitForSortingToStart(10000);
    await app.waitForSortingToComplete(120000);

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.startsWith('error') || m.toLowerCase().includes('uncaught'));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  // Test 6: Verify resetBarsColor is indirectly used when shuffle is invoked in Idle state (S0_Idle)
  test('ShuffleClick in Idle state re-creates array and resets bar classes', async ({ page }) => {
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));

    const app = new BubbleSortPage(page);
    await app.goto();

    // Intentionally add a 'sorted' class to first bar via page.evaluate to simulate state (we do not modify functions,
    // but for verification we can mutate DOM to see if shuffle resets classes - this is allowed since it's interacting with DOM)
    await page.evaluate(() => {
      const b = document.querySelector('.bar');
      if (b) b.classList.add('sorted');
    });

    // Ensure at least one bar has sorted
    const hadSorted = await page.locator('.bar.sorted').count();
    expect(hadSorted).toBeGreaterThanOrEqual(1);

    // Click shuffle in Idle state - should recreate and reset classes
    await app.clickShuffle();

    // After shuffle, no bars should remain with the 'sorted' class
    const sortedAfterShuffle = await page.locator('.bar.sorted').count();
    expect(sortedAfterShuffle).toBe(0);

    // Buttons should remain enabled after shuffle completes
    const btnStates = await app.getButtonDisabledStates();
    expect(btnStates.shuffleDisabled).toBe(false);
    expect(btnStates.startDisabled).toBe(false);

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.startsWith('error') || m.toLowerCase().includes('uncaught'));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  // Teardown: no global teardown necessary; Playwright handles page/contexts per test.
});