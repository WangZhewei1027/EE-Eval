import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8da2a1-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Binary Search Visualization page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#start-btn');
    this.graphContainer = page.locator('#graph-container');
    this.bars = page.locator('#graph-container .bar');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async getBarCount() {
    return await this.bars.count();
  }

  // returns array of class strings for each bar
  async getBarClasses() {
    const count = await this.getBarCount();
    const classes = [];
    for (let i = 0; i < count; i++) {
      classes.push(await this.bars.nth(i).getAttribute('class'));
    }
    return classes;
  }

  // returns index of the first bar with the 'selected' class, or -1 if none
  async getSelectedBarIndex() {
    const count = await this.getBarCount();
    for (let i = 0; i < count; i++) {
      const cls = await this.bars.nth(i).getAttribute('class');
      if (cls && cls.split(/\s+/).includes('selected')) return i;
    }
    return -1;
  }

  // returns index of the first bar with the 'active' class, or -1 if none
  async getActiveBarIndex() {
    const count = await this.getBarCount();
    for (let i = 0; i < count; i++) {
      const cls = await this.bars.nth(i).getAttribute('class');
      if (cls && cls.split(/\s+/).includes('active')) return i;
    }
    return -1;
  }

  // wait until a bar has class 'selected' or timeout
  async waitForSelectedBar(timeout = 3000) {
    await this.page.waitForFunction(() => {
      const bars = document.querySelectorAll('#graph-container .bar');
      for (let i = 0; i < bars.length; i++) {
        if (bars[i].classList.contains('selected')) return true;
      }
      return false;
    }, null, { timeout });
  }
}

test.describe('Binary Search Visualization - FSM states and transitions', () => {
  let page;
  let bsPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context so console/pageerror events are isolated per test
    const context = await browser.newContext();
    page = await context.newPage();

    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for later assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect runtime page errors (unhandled exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    bsPage = new BinarySearchPage(page);
    await bsPage.goto();
  });

  test.afterEach(async () => {
    // Ensure no unexpected runtime errors occurred during the test
    // The FSM/requirements ask us to observe and assert page errors.
    // Assert that there are zero page errors for this implementation.
    expect(pageErrors.length).toBe(0);

    // Also ensure there are no console errors emitted by the page
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
    // Close the page's context to clean up
    await page.context().close();
  });

  test('S0_Idle: initial Idle state - start button is present and graph container is empty', async () => {
    // Validate initial Idle state: Start button exists
    await expect(bsPage.startBtn).toBeVisible();
    await expect(bsPage.startBtn).toHaveText('Start');

    // Validate that the graph container initially has no bars (Idle has no bars)
    const initialBarCount = await bsPage.getBarCount();
    expect(initialBarCount).toBe(0);

    // The FSM evidence for Idle expects: <button id="start-btn">Start</button>
    // We assert the start button exists which matches the extracted evidence.
  });

  test('S0 -> S1 (StartClick): clicking Start creates bars (Bars Created state)', async () => {
    // Click the Start button to trigger createBars()
    await bsPage.clickStart();

    // After click, bars should be created and rendered
    const barCount = await bsPage.getBarCount();

    // The provided array has 13 elements
    expect(barCount).toBe(13);

    // Each bar should have the 'bar' class and an inline style height set
    for (let i = 0; i < barCount; i++) {
      const cls = await bsPage.bars.nth(i).getAttribute('class');
      expect(cls).toBeTruthy();
      expect(cls.split(/\s+/)).toContain('bar');

      const style = await bsPage.bars.nth(i).getAttribute('style');
      // style should set height like "height: XX%;"
      expect(style).toMatch(/height:\s*\d+(\.\d+)?%/);
    }

    // This verifies the createBars() entry action for the S1_BarsCreated state:
    // graphContainer.innerHTML is cleared and new bars are appended (we detect new bars present).
  });

  test('S1 -> S2 -> S3 (StartClick -> Searching -> TargetFound): binary search highlights and selects target', async () => {
    // Clicking start runs createBars() and immediately runs binarySearch()
    await bsPage.clickStart();

    // Immediately after clicking, binarySearch will compute mid and call highlightActive(mid)
    // For this array, the first mid is index 6 (value 21), which is the target and should be selected immediately.
    // Check that the active bar is index 6
    const activeIndex = await bsPage.getActiveBarIndex();
    expect(activeIndex).toBeGreaterThanOrEqual(0);
    // Validate that activeIndex is the expected mid for the algorithm given full range:
    // For array length 13, mid = floor((0+12)/2) = 6
    expect(activeIndex).toBe(6);

    // Now wait for the selected bar to appear (should be immediate, but use waitFor in case of microtasks)
    await bsPage.waitForSelectedBar(1000);
    const selectedIndex = await bsPage.getSelectedBarIndex();
    expect(selectedIndex).toBe(6);

    // Ensure only one bar is selected
    const classes = await bsPage.getBarClasses();
    const selectedCount = classes.filter(c => c && c.split(/\s+/).includes('selected')).length;
    expect(selectedCount).toBe(1);

    // The FSM final state S3_TargetFound expects bars[mid].classList.add('selected');
    // We assert that the selected class is present on the correct index.
  });

  test('Edge case: clicking Start multiple times does not create duplicate selected bars and resets DOM', async () => {
    // First click: should create bars and select the target
    await bsPage.clickStart();
    await bsPage.waitForSelectedBar(1000);
    const firstSelected = await bsPage.getSelectedBarIndex();
    expect(firstSelected).toBe(6);

    // Second click: createBars() clears the container and recreates bars, binarySearch runs again.
    // Because createBars replaces DOM, previously selected classes should be removed before the second run.
    await bsPage.clickStart();

    // Wait again for selection to appear
    await bsPage.waitForSelectedBar(1000);
    const secondSelected = await bsPage.getSelectedBarIndex();
    expect(secondSelected).toBe(6);

    // Ensure still exactly one selected bar
    const classes = await bsPage.getBarClasses();
    const selectedCount = classes.filter(c => c && c.split(/\s+/).includes('selected')).length;
    expect(selectedCount).toBe(1);

    // This validates that repeated Start clicks behave deterministically and that createBars resets the DOM.
  });

  test('Visual feedback checks: selected bar has both "active" and "selected" classes and style changes', async () => {
    // Click Start and wait for selection
    await bsPage.clickStart();
    await bsPage.waitForSelectedBar(1000);

    const selectedIndex = await bsPage.getSelectedBarIndex();
    expect(selectedIndex).toBe(6);

    // Verify the selected bar has both classes (active applied first by highlightActive, selected applied next)
    const selectedClassAttr = await bsPage.bars.nth(selectedIndex).getAttribute('class');
    const classList = selectedClassAttr ? selectedClassAttr.split(/\s+/) : [];
    expect(classList).toContain('selected');
    // active may or may not be present after selection, but since highlightActive was called right before selection, check for it too
    expect(classList).toContain('active');

    // The CSS sets .bar.selected { height: 100%; } - we can assert that the computed height changed relative to other bars
    const heights = await Promise.all(
      Array.from({ length: await bsPage.getBarCount() }, (_, i) =>
        bsPage.page.evaluate(idx => {
          const bar = document.querySelectorAll('#graph-container .bar')[idx];
          return window.getComputedStyle(bar).height;
        }, i)
      )
    );

    // The selected bar's computed height should be at least as large as other bars (100% override)
    const selectedHeight = heights[selectedIndex];
    for (let i = 0; i < heights.length; i++) {
      if (i === selectedIndex) continue;
      // It's sufficient to assert selectedHeight is not equal to some other bar height (likely larger),
      // but to be robust across pixel rounding, assert selectedHeight is >= others numerically.
      const selectedPx = parseFloat(selectedHeight);
      const otherPx = parseFloat(heights[i]);
      expect(selectedPx).toBeGreaterThanOrEqual(otherPx);
    }
  });

  test('Observability: capture console logs and page errors while interacting', async () => {
    // This test ensures we capture console and runtime errors during normal operation.
    // Click Start and wait for selected bar
    await bsPage.clickStart();
    await bsPage.waitForSelectedBar(1000);

    // Verify that we captured console messages (there may be none but we assert no console 'error' types)
    const errorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorMessages.length).toBe(0);

    // Verify that no page errors were emitted (collected in afterEach as well)
    expect(pageErrors.length).toBe(0);

    // Additionally check we captured at least one console entry (info/debug) is not required,
    // but we can at least assert consoleMessages is an array (always true). This helps document observability.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('FSM behavior: verify transitions and state evidence through DOM changes', async () => {
    // S0_Idle evidence: start button present
    await expect(bsPage.startBtn).toBeVisible();

    // Trigger transition S0 -> S1 by clicking Start
    await bsPage.clickStart();

    // S1_BarsCreated evidence: graphContainer.innerHTML = '' then bars appended -> we see bars exist
    const barCount = await bsPage.getBarCount();
    expect(barCount).toBe(13);

    // Transition S1 -> S2: binarySearch starts; evidence includes highlightActive(mid)
    // We assert that at least one bar has 'active' class during the run
    const activeIndex = await bsPage.getActiveBarIndex();
    expect(activeIndex).toBeGreaterThanOrEqual(0);

    // Transition S2 -> S3: target found; evidence bars[mid].classList.add('selected')
    await bsPage.waitForSelectedBar(1000);
    const selectedIndex = await bsPage.getSelectedBarIndex();
    expect(selectedIndex).toBe(6);

    // All FSM transitions have been validated via DOM evidence.
  });
});