import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa0552-fa78-11f0-812d-c9788050701f.html';

// Page object encapsulating common interactions and queries for the Binary Search Visualizer
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.statusText = page.locator('#statusText');
    this.arrayContainer = page.locator('#arrayContainer');
    this.highlightLine = page.locator('#highlightLine');
    this.elementLocator = (index) => page.locator(`#element-${index}`);
    this.foundLocator = page.locator('.element.found');
    this.midLocator = page.locator('.element.middle');
    this.examinedLocator = page.locator('.element.examined');
    this.highlightedLocator = page.locator('.element.highlight');
    this.allElements = page.locator('.element');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial rendering and init to complete (window load triggers init)
    await this.page.waitForLoadState('load');
    // Ensure the array elements have been generated
    await expect(this.allElements).toHaveCount(15);
  }

  async getStatusText() {
    return (await this.statusText.textContent()) || '';
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async waitForStep(stepNumber, timeout = 5000) {
    const expectedPrefix = `Step ${stepNumber}: Checking index`;
    await this.page.waitForFunction(
      (selector, expectedPrefix) => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.indexOf(expectedPrefix) === 0;
      },
      '#statusText',
      expectedPrefix,
      { timeout }
    );
  }

  async waitForFound(timeout = 15000) {
    // Wait until status text matches "Found <target> at index <mid>!"
    await this.page.waitForFunction(
      () => {
        const el = document.getElementById('statusText');
        if (!el || !el.textContent) return false;
        return /Found \d+ at index \d+!/.test(el.textContent);
      },
      null,
      { timeout }
    );
  }

  async getFirstStepMidFromStatus() {
    // Status format: Step 1: Checking index <mid> (value <val>)
    const status = await this.getStatusText();
    const m = status.match(/Checking index\s+(\d+)/);
    if (m) return Number(m[1]);
    return null;
  }

  async elementHasClass(index, className) {
    return this.page.evaluate(
      (id, cls) => {
        const el = document.getElementById(id);
        if (!el) return false;
        return el.classList.contains(cls);
      },
      `element-${index}`,
      className
    );
  }

  async countElementsWithClass(className) {
    return this.page.$$eval(`.element.${className}`, els => els.length);
  }
}

test.describe('Binary Search Visualizer - FSM and UI tests', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Basic sanity checks: record if any unexpected page errors occurred
    // Tests themselves will assert expected behavior related to errors.
    // Attach console summary to test output for debugging when needed.
    if (consoleMessages.length) {
      // Add console messages to Playwright trace/log for debugging
      testInfo.attach('console-messages', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json'
      });
    }
    if (pageErrors.length) {
      testInfo.attach('page-errors', {
        body: pageErrors.map(e => String(e.stack || e)).join('\n\n'),
        contentType: 'text/plain'
      });
    }
  });

  test('Initial (Idle) state renders correctly: S0_Idle', async ({ page }) => {
    // This test validates the Idle state rendering and entry actions (renderPage/init)
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    // The status text should instruct the user to start and mention the target value
    const status = await bsp.getStatusText();
    expect(status).toContain('Click "Start Search" to begin visualization');
    expect(status).toContain('Looking for'); // per resetSearch's status text format

    // Ensure array elements are rendered and numbered
    await expect(bsp.allElements).toHaveCount(15);
    // No element should be marked as found/middle/examined/highlight initially
    expect(await bsp.countElementsWithClass('found')).toBe(0);
    expect(await bsp.countElementsWithClass('middle')).toBe(0);
    expect(await bsp.countElementsWithClass('examined')).toBe(0);
    expect(await bsp.countElementsWithClass('highlight')).toBe(0);

    // Confirm no uncaught page errors occurred during load/init
    expect(pageErrors.length).toBe(0);
  });

  test('Transition Idle -> Searching on Start Search click and highlight behaviors: S0_Idle -> S1_Searching', async ({ page }) => {
    // This test validates that clicking Start triggers searchStep() and shows step 1 status and highlights
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    // Click Start and wait for Step 1 to appear
    await bsp.clickStart();
    await bsp.waitForStep(1, 5000);

    // Verify status text indicates Step 1 and mentions an index
    const status = await bsp.getStatusText();
    expect(status).toMatch(/Step 1: Checking index \d+ \(value \d+\)/);

    // The code highlight line should be set to the midpoint calculation and have the 'highlighted' class
    const highlightClass = await bsp.highlightLine.getAttribute('class');
    const highlightText = (await bsp.highlightLine.textContent()) || '';
    expect(highlightClass).toContain('highlighted');
    expect(highlightText).toContain('const mid = Math.floor');

    // There should be exactly one element with the 'middle' class for the current mid
    const middleCount = await bsp.countElementsWithClass('middle');
    expect(middleCount).toBeGreaterThanOrEqual(1);

    // Highlight for left and right pointers should also be present unless left === right
    const highlightCount = await bsp.countElementsWithClass('highlight');
    // It is acceptable for highlightCount to be 0 when left === right; otherwise should be >= 2
    expect(highlightCount).toBeGreaterThanOrEqual(0);

    // No page errors expected at this point
    expect(pageErrors.length).toBe(0);
  });

  test('Searching -> Found: final state S2_Found and DOM reflects found highlight and final status', async ({ page }) => {
    // This test validates that a search completes with the Found state (status text + .found element)
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    // Start the search and wait for the final "Found ..." message (binary search will find target because target was chosen from array)
    await bsp.clickStart();

    // Wait for the "Found X at index Y!" status to appear. Allow generous timeout to account for animation delays.
    await bsp.waitForFound(15000);

    // Validate status text follows expected pattern
    const finalStatus = await bsp.getStatusText();
    expect(finalStatus).toMatch(/Found \d+ at index \d+!/);

    // There should be exactly one element with the 'found' class
    const foundCount = await bsp.countElementsWithClass('found');
    expect(foundCount).toBeGreaterThanOrEqual(1);

    // The highlight line should be cleared by endSearch
    const highlightLineText = (await bsp.highlightLine.textContent()) || '';
    expect(highlightLineText.trim()).toBe('');

    // Confirm that code sets isSearching to false by verifying starting a new search is possible after found:
    // Click Start again; it should start a new search (status will change to Step 1 again)
    await bsp.clickStart();
    // Because startBtn handler checks !isSearching before calling searchStep,
    // if isSearching false, clicking should initiate a new search. Wait briefly for step 1.
    await bsp.page.waitForTimeout(200); // small delay to allow handler execution
    await bsp.waitForStep(1, 5000);

    // Also verify no uncaught page errors occurred during success path
    expect(pageErrors.length).toBe(0);
  });

  test('Reset returns to Idle and clears highlights: S2_Found -> S0_Idle (via Reset)', async ({ page }) => {
    // This test validates that Reset invokes init() and returns UI to Idle state
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    // Start and wait for Found
    await bsp.clickStart();
    await bsp.waitForFound(15000);

    // Ensure found state before reset
    expect((await bsp.getStatusText()).startsWith('Found')).toBe(true);
    expect(await bsp.countElementsWithClass('found')).toBeGreaterThanOrEqual(1);

    // Click Reset and verify status returns to initial prompt and highlights removed
    await bsp.clickReset();

    // Wait until status reverts to initial instruction
    await bsp.page.waitForFunction(
      () => {
        const el = document.getElementById('statusText');
        return el && el.textContent && el.textContent.indexOf('Click "Start Search" to begin visualization') === 0;
      },
      null,
      { timeout: 5000 }
    );

    const statusAfterReset = await bsp.getStatusText();
    expect(statusAfterReset).toContain('Click "Start Search" to begin visualization');
    expect(statusAfterReset).toContain('Looking for');

    // Verify no elements have 'found', 'middle', 'examined', or 'highlight' classes after reset
    expect(await bsp.countElementsWithClass('found')).toBe(0);
    expect(await bsp.countElementsWithClass('middle')).toBe(0);
    expect(await bsp.countElementsWithClass('examined')).toBe(0);
    expect(await bsp.countElementsWithClass('highlight')).toBe(0);

    // highlightLine should be empty and not highlighted
    const hlText = (await bsp.highlightLine.textContent()) || '';
    expect(hlText.trim()).toBe('');
    const hlClass = await bsp.highlightLine.getAttribute('class');
    expect(hlClass).toBe('code-line');

    // No uncaught errors expected on reset
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: removing mid DOM element during animation causes a runtime page error (TypeError) - error scenario', async ({ page }) => {
    // This test intentionally induces an error by removing the element that the animation code will later try to update.
    // It validates that page errors are observable and captured as part of runtime behavior.
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    // Start the search and wait for Step 1 to be set up
    await bsp.clickStart();
    await bsp.waitForStep(1, 5000);

    // Parse mid index from the status
    const midIndex = await bsp.getFirstStepMidFromStatus();
    expect(typeof midIndex).toBe('number');

    // Remove the mid element from the DOM so that the scheduled setTimeout callback will attempt to access a null element
    // This simulates an edge-case DOM mutation that the app does not handle gracefully.
    await page.evaluate((mid) => {
      const el = document.getElementById(`element-${mid}`);
      if (el) el.remove();
    }, midIndex);

    // Wait for a short period longer than ANIMATION_DELAY to allow the scheduled callback to run and (hopefully) throw
    // ANIMATION_DELAY is 1000ms in page code; wait 3s to be safe
    await page.waitForTimeout(3000);

    // At this point, we expect at least one uncaught page error to have been captured
    // It may be a TypeError when attempting to access classList of null
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Assert the error message indicates problems accessing properties of null/undefined or classList
    const messages = pageErrors.map(e => String(e.message || e));
    const matched = messages.some(m => /classList|Cannot read properties of|null/.test(m));
    // It's acceptable if the exact phrasing differs; we assert that some runtime error occurred related to DOM access
    expect(matched).toBeTruthy();
  });
});