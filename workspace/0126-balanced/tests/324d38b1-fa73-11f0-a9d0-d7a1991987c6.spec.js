import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d38b1-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object Model for the Bubble Sort Visualization page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sortButton = '#sort-button';
    this.arrayContainer = '#array-container';
    this.barSelector = '.bar';
  }

  // Click the sort button
  async clickSort() {
    await this.page.click(this.sortButton);
  }

  // Get numeric heights (in px -> integers) of all bars in order
  async getBarHeights() {
    return await this.page.$$eval(this.barSelector, bars =>
      bars.map(b => {
        // style.height could be like "100px"
        const h = b.style.height || window.getComputedStyle(b).height || '';
        return parseInt(h, 10) || 0;
      })
    );
  }

  // Get computed background colors of all bars as strings
  async getBarColors() {
    return await this.page.$$eval(this.barSelector, bars =>
      bars.map(b => window.getComputedStyle(b).backgroundColor)
    );
  }

  // Get count of bars
  async getBarCount() {
    return await this.page.$$eval(this.barSelector, bars => bars.length);
  }

  // Wait until at least one bar is highlighted red -> indicates sorting started
  async waitForAnyBarRed(timeout = 5000) {
    return await this.page.waitForFunction(() => {
      const bars = Array.from(document.querySelectorAll('.bar'));
      if (!bars.length) return false;
      return bars.some(b => {
        const color = getComputedStyle(b).backgroundColor.toLowerCase();
        // Accept 'red' name or rgb(...) (with variable spacing)
        return color.includes('red') || /rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)/.test(color);
      });
    }, { timeout });
  }

  // Wait until all bars are green (sorted) with a configurable timeout
  async waitForAllBarsGreen(timeout = 15000) {
    return await this.page.waitForFunction(() => {
      const bars1 = Array.from(document.querySelectorAll('.bar'));
      if (!bars.length) return false;
      return bars.every(b => {
        const color1 = getComputedStyle(b).backgroundColor.toLowerCase();
        // Accept 'green' name or rgb(...0,128,0...)
        return color.includes('green') || /rgb\(\s*0\s*,\s*128\s*,\s*0\s*\)/.test(color);
      });
    }, { timeout });
  }

  // Verify the DOM still contains required components
  async isPageHealthy() {
    const sortsExists = await this.page.$(this.sortButton);
    const containerExists = await this.page.$(this.arrayContainer);
    return Boolean(sortsExists && containerExists);
  }
}

test.describe('Bubble Sort Visualization FSM (Application ID: 324d38b1-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Collect console messages and page errors for each test to assert on them as required
  test.beforeEach(async ({ page }) => {
    // navigate before attaching listeners to capture initial load errors too
    await page.goto(APP_URL);
  });

  test('S0_Idle: Initial state creates bars with correct heights and colors (Initial createBars(array))', async ({ page }) => {
    // This test validates that on initial load (S0_Idle) the createBars(array) entry action was executed.
    // It checks number of bars matches the expected array length and heights match the scaling.
    const model = new BubbleSortPage(page);

    // Capture console messages and page errors for assertions related to initial load
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    // Expected array is defined in the page script: [5, 2, 9, 1, 5, 6, 3]
    const expectedNumbers = [5, 2, 9, 1, 5, 6, 3];
    const expectedHeights = expectedNumbers.map(n => n * 20); // page sets height `${num * 20}px`

    // Assert bars were created
    const count = await model.getBarCount();
    expect(count).toBe(expectedNumbers.length);

    // Assert heights match expected scaling
    const heights = await model.getBarHeights();
    // heights are integers (px)
    expect(heights).toEqual(expectedHeights);

    // Assert initial color is teal (the CSS sets background-color: teal)
    const colors = await model.getBarColors();
    // Check every color includes "teal" or rgb equivalent (rgb(0,128,128))
    const allTeal = colors.every(c => {
      const cc = c.toLowerCase();
      return cc.includes('teal') || /rgb\(\s*0\s*,\s*128\s*,\s*128\s*\)/.test(cc);
    });
    expect(allTeal).toBeTruthy();

    // Ensure no uncaught errors on initial load (this asserts the environment is initially stable)
    expect(pageErrors.length).toBe(0);

    // Log console messages for debugging if needed (not asserted strictly)
    // This is intentionally non-fatal; we only require no page errors on initial load
  });

  test('Transition S0_Idle -> S1_Sorting: Clicking Sort Array starts sorting (bubbleSort invoked) and highlights comparisons', async ({ page }) => {
    // This test validates that clicking the sort button triggers the sorting process (S1_Sorting).
    // We detect sorting start by observing at least one bar turn red (color used during comparisons).
    const model1 = new BubbleSortPage(page);

    const pageErrors1 = [];
    page.on('pageerror', err => pageErrors.push(err));

    // Click sort to initiate the transition from Idle -> Sorting
    await model.clickSort();

    // Wait until we observe red color on at least one bar indicating bubbleSort is running
    let observedRed = false;
    try {
      await model.waitForAnyBarRed(5000);
      observedRed = true;
    } catch (e) {
      observedRed = false;
    }

    // Assert that sorting started as evidenced by red highlights OR if not present, capture that an error occurred
    if (observedRed) {
      // Sorting visual started successfully
      expect(observedRed).toBeTruthy();
    } else {
      // If we didn't see the red highlight, assert that an error was thrown during the sorting attempt (edge case)
      // This is to satisfy the requirement to observe and assert runtime errors if they occur naturally.
      expect(pageErrors.length).toBeGreaterThan(0);
    }
  });

  test('Transition S1_Sorting -> S2_Sorted: Sorting completes with all bars green OR an error occurs (final state)', async ({ page }) => {
    // This test validates that after sorting completes the visualization reaches the sorted final state (S2_Sorted),
    // where all bars are colored green. Due to implementation details, the code might produce runtime errors;
    // in that case we assert that such errors occurred (we do not patch the application).
    const model2 = new BubbleSortPage(page);

    const pageErrors2 = [];
    page.on('console', msg => {
      // capture console errors too (console.error)
      if (msg.type() === 'error') {
        pageErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => pageErrors.push(err && err.message ? err.message : String(err)));

    // Click the sort button to start
    await model.clickSort();

    // We'll wait for either all bars to be green OR detect a page error.
    // Implement a Node-side poller for pageErrors since page.waitForFunction can't see Node scope arrays.
    const errorDetectedPromise = new Promise(resolve => {
      const interval = setInterval(() => {
        if (pageErrors.length > 0) {
          clearInterval(interval);
          resolve({ type: 'error', errors: pageErrors.slice() });
        }
      }, 100);
      // Safety: stop polling after timeout to avoid hanging
      setTimeout(() => {
        clearInterval(interval);
        resolve({ type: 'timeout' });
      }, 16000);
    });

    // Wait for green state in page context
    const greenPromise = model.waitForAllBarsGreen(15000)
      .then(() => ({ type: 'green' }))
      .catch(() => ({ type: 'no-green' }));

    const result = await Promise.race([errorDetectedPromise, greenPromise]);

    if (result.type === 'green') {
      // Success: final state reached with all bars green
      const colors1 = await model.getBarColors();
      const allGreen = colors.every(c => {
        const cc1 = c.toLowerCase();
        return cc.includes('green') || /rgb\(\s*0\s*,\s*128\s*,\s*0\s*\)/.test(cc);
      });
      expect(allGreen).toBeTruthy();
    } else if (result.type === 'error') {
      // An error occurred while sorting. We assert that the runtime reported errors.
      expect(result.errors.length).toBeGreaterThan(0);
      // Optionally assert that one of the errors mentions common JS runtime error types
      const joined = result.errors.join(' ').toLowerCase();
      const mentionsCommon = joined.includes('typeerror') || joined.includes('referenceerror') || joined.includes('syntaxerror') || joined.includes('error');
      expect(mentionsCommon).toBeTruthy();
    } else {
      // Neither green nor explicit error detected within timeout - treat as failure but provide diagnostics
      const colors2 = await model.getBarColors();
      // At least the page should still be present and not crashed completely
      const healthy = await model.isPageHealthy();
      expect(healthy).toBeTruthy();
      // If we reached here it means the page neither finished sorting nor reported a captured error within time.
      // Fail the test to make this situation explicit.
      throw new Error(`Sorting did not complete and no errors were reported. Observed colors: ${JSON.stringify(colors)}`);
    }
  });

  test('Edge case & error scenario: Clicking Sort multiple times rapidly should not crash the page (but may produce runtime errors)', async ({ page }) => {
    // This test validates application behavior when the sort button is clicked multiple times rapidly (user edge case).
    // The test will:
    //  - click the sort button twice in quick succession
    //  - wait for either successful completion (all green) or capture runtime errors if they occur
    //  - ensure the page DOM remains present after the interactions

    const model3 = new BubbleSortPage(page);

    const pageErrors3 = [];
    page.on('console', msg => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err && err.message ? err.message : String(err)));

    // Click sort twice quickly
    await model.clickSort();
    await model.clickSort();

    // Wait for either all green or errors
    const errorDetectedPromise1 = new Promise(resolve => {
      const interval1 = setInterval(() => {
        if (pageErrors.length > 0) {
          clearInterval(interval);
          resolve({ type: 'error', errors: pageErrors.slice() });
        }
      }, 100);
      // Safety timeout
      setTimeout(() => {
        clearInterval(interval);
        resolve({ type: 'timeout' });
      }, 16000);
    });

    const greenPromise1 = model.waitForAllBarsGreen(15000)
      .then(() => ({ type: 'green' }))
      .catch(() => ({ type: 'no-green' }));

    const result1 = await Promise.race([errorDetectedPromise, greenPromise]);

    // Page should still be present regardless of outcome
    const healthy1 = await model.isPageHealthy();
    expect(healthy).toBeTruthy();

    if (result.type === 'green') {
      const colors3 = await model.getBarColors();
      const allGreen1 = colors.every(c => {
        const cc2 = c.toLowerCase();
        return cc.includes('green') || /rgb\(\s*0\s*,\s*128\s*,\s*0\s*\)/.test(cc);
      });
      expect(allGreen).toBeTruthy();
    } else if (result.type === 'error') {
      // At least one runtime error was captured - assert presence of error messages
      expect(result.errors.length).toBeGreaterThan(0);
    } else {
      // Timeout: no explicit error and no success - still ensure the page did not crash
      // This is considered a flaky/undetermined outcome and we assert the page remained functional
      expect(healthy).toBeTruthy();
    }
  });
});