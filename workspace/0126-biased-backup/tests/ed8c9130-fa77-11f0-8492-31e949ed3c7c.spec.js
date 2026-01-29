import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8c9130-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the Circular Linked List page
class CircularListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startSelector = ".button[onclick='startAnimation()']";
    this.resetSelector = ".button[onclick='resetAnimation()']";
    this.nodeSelector = '.node';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Start Animation button
  async clickStart() {
    await this.page.click(this.startSelector);
  }

  // Click the Reset button
  async clickReset() {
    await this.page.click(this.resetSelector);
  }

  // Return an array of computed inline transform styles for nodes (strings)
  async getNodeTransforms() {
    return await this.page.$$eval(this.nodeSelector, nodes => nodes.map(n => n.style.transform));
  }

  // Return the current intervalId variable from page context (may be undefined/null/number)
  async getIntervalId() {
    return await this.page.evaluate(() => {
      try {
        // intervalId is declared with let in the page script; referencing it returns its value or throws if not present.
        return typeof intervalId === 'undefined' ? undefined : intervalId;
      } catch (e) {
        // If intervalId is not accessible, return a special marker
        return { __error: true, name: e.name, message: e.message };
      }
    });
  }

  // Return the current angle variable from page context or special marker if inaccessible
  async getAngle() {
    return await this.page.evaluate(() => {
      try {
        return typeof angle === 'undefined' ? undefined : angle;
      } catch (e) {
        return { __error: true, name: e.name, message: e.message };
      }
    });
  }

  // Trigger a call to renderPage() inside the page asynchronously so that an uncaught ReferenceError will surface as a pageerror event
  async triggerRenderPageAsync() {
    // Schedule a macro-task in page to call renderPage() which does not exist - will produce a runtime ReferenceError
    await this.page.evaluate(() => {
      setTimeout(() => {
        // Intentionally call a missing function to allow the page to raise a ReferenceError
        // We do not catch it here because we want the page to emit a 'pageerror' event.
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0);
    });
  }
}

test.describe('Circular Linked List Visualization — FSM validation', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: navigate to the page before each test
    await page.goto(APP_URL);
  });

  test('Initial Idle state: page renders nodes and buttons; variables are at initial values', async ({ page }) => {
    // This test validates the S0_Idle state:
    // - Buttons for Start and Reset are present
    // - Nodes are rendered with initial transforms as defined in the HTML
    // - angle is 0 and intervalId is undefined
    const model = new CircularListPage(page);

    // Buttons exist with correct onclick attributes
    const startBtn = await page.$(".button[onclick='startAnimation()']");
    const resetBtn = await page.$(".button[onclick='resetAnimation()']");
    expect(startBtn).not.toBeNull();
    expect(resetBtn).not.toBeNull();

    // There should be 6 nodes (A..F) as per HTML
    const nodes = await page.$$(model.nodeSelector);
    expect(nodes.length).toBe(6);

    // Verify initial inline transform for each node matches expected pattern from HTML
    const transforms = await model.getNodeTransforms();
    const expectedTransforms = [
      'rotate(0deg) translate(250px) rotate(0deg)',
      'rotate(60deg) translate(250px) rotate(-60deg)',
      'rotate(120deg) translate(250px) rotate(-120deg)',
      'rotate(180deg) translate(250px) rotate(-180deg)',
      'rotate(240deg) translate(250px) rotate(-240deg)',
      'rotate(300deg) translate(250px) rotate(-300deg)'
    ];
    expect(transforms).toEqual(expectedTransforms);

    // Check JS variables state in page context
    const intervalId = await model.getIntervalId();
    // top-level let intervalId is declared but not initialized -> its value should be undefined
    expect(intervalId).toBeUndefined();

    const angle = await model.getAngle();
    expect(angle).toBe(0);
  });

  test('StartAnimation event transitions to Animating: interval set and nodes rotate over time', async ({ page }) => {
    // This test validates transition S0_Idle -> S1_Animating:
    // - Clicking Start Animation sets intervalId (startAnimation is invoked)
    // - The nodes' transforms change over time indicating rotation
    // - Subsequent clicks of Start do not create additional intervals (guard if (intervalId) return;)
    const model = new CircularListPage(page);

    // Capture initial transform snapshot
    const initialTransforms = await model.getNodeTransforms();

    // Click start
    await model.clickStart();

    // After starting, intervalId should be a number (setInterval id). Wait briefly to allow assignment.
    await page.waitForTimeout(50);
    const intervalId1 = await model.getIntervalId();
    // intervalId is expected to be a number (browser setInterval returns integer id)
    expect(typeof intervalId1 === 'number' || typeof intervalId1 === 'string').toBeTruthy();

    // Wait some time for a few ticks of the animation (interval 100ms)
    await page.waitForTimeout(350);
    const transformsAfterStart = await model.getNodeTransforms();

    // At least one transform should have changed from initial
    const anyChanged = transformsAfterStart.some((t, i) => t !== initialTransforms[i]);
    expect(anyChanged).toBeTruthy();

    // Click Start again and ensure intervalId does not change (guard prevents multiple intervals)
    await model.clickStart();
    await page.waitForTimeout(50);
    const intervalId2 = await model.getIntervalId();
    // interval id should remain the same (or at least not become multiple different values)
    expect(intervalId2).toEqual(intervalId1);

    // Cleanup: reset to stop animation to avoid flakiness for other tests
    await model.clickReset();
    await page.waitForTimeout(50);
  });

  test('ResetAnimation transitions back to Idle: interval cleared, angle reset, and nodes restored', async ({ page }) => {
    // This test validates transition S1_Animating -> S0_Idle:
    // - After animation started, clicking Reset clears the interval, sets intervalId to null, angle to 0,
    //   and node transforms reset to their initial values.
    const model = new CircularListPage(page);

    // Start animation
    await model.clickStart();
    await page.waitForTimeout(250);

    // Ensure animation was running
    const intervalBeforeReset = await model.getIntervalId();
    expect(typeof intervalBeforeReset === 'number' || typeof intervalBeforeReset === 'string').toBeTruthy();

    // Click Reset
    await model.clickReset();

    // After reset, intervalId should be null (per implementation)
    await page.waitForTimeout(50);
    const intervalAfterReset = await model.getIntervalId();
    // Implementation sets intervalId = null; but top-level let variable may yield null
    expect(intervalAfterReset === null || intervalAfterReset === undefined).toBeTruthy();

    // angle should be reset to 0
    const angleAfterReset = await model.getAngle();
    expect(angleAfterReset).toBe(0);

    // Transforms should be back to initial values exactly
    const transformsAfterReset = await model.getNodeTransforms();
    const expectedTransforms = [
      'rotate(0deg) translate(250px) rotate(0deg)',
      'rotate(60deg) translate(250px) rotate(-60deg)',
      'rotate(120deg) translate(250px) rotate(-120deg)',
      'rotate(180deg) translate(250px) rotate(-180deg)',
      'rotate(240deg) translate(250px) rotate(-240deg)',
      'rotate(300deg) translate(250px) rotate(-300deg)'
    ];
    expect(transformsAfterReset).toEqual(expectedTransforms);
  });

  test('Reset when idle is safe: no uncaught errors and transforms remain correct', async ({ page }) => {
    // Edge case: clicking Reset while not animating should not produce page errors
    // We attach a pageerror listener and assert no errors are emitted.
    const model = new CircularListPage(page);

    const pageErrors = [];
    const consoleErrors = [];
    const onPageError = e => pageErrors.push(e);
    const onConsole = msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    };

    page.on('pageerror', onPageError);
    page.on('console', onConsole);

    // Ensure we are in Idle (not animating)
    const beforeInterval = await model.getIntervalId();
    expect(beforeInterval === undefined || beforeInterval === null).toBeTruthy();

    // Click Reset in Idle
    await model.clickReset();

    // Give a small timeframe to catch any errors
    await page.waitForTimeout(100);

    // No page errors should have occurred
    expect(pageErrors.length).toBe(0);
    // No console.error messages expected
    expect(consoleErrors.length).toBe(0);

    // Nodes should remain in initial positions
    const transforms = await model.getNodeTransforms();
    expect(transforms[0]).toContain('rotate(0deg)'); // at least check first node
    // cleanup listeners
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  });

  test('Calling missing renderPage() causes a ReferenceError pageerror event', async ({ page }) => {
    // This test validates that a missing entry action renderPage (as declared in FSM) would raise a ReferenceError
    // if invoked. We intentionally trigger renderPage asynchronously on the page and assert a pageerror is emitted.
    const model = new CircularListPage(page);

    // Wait for pageerror event and capture it
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      model.triggerRenderPageAsync()
    ]);

    // The thrown error should be a ReferenceError complaining about renderPage not being defined
    expect(error).toBeTruthy();
    // error.name should indicate ReferenceError
    expect(error.name).toBe('ReferenceError');

    // The error message typically contains the missing identifier name
    expect(error.message).toContain('renderPage');
  });
});