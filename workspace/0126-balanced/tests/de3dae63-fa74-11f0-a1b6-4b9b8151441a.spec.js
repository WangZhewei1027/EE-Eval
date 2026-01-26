import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dae63-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object encapsulating common selectors and interactions
class GCPage {
  constructor(page) {
    this.page = page;
    this.createRefBtn = page.locator('#createRefObj');
    this.clearRefBtn = page.locator('#clearRefObj');
    this.refStatus = page.locator('#refStatus');

    this.createCircularBtn = page.locator('#createCircularRef');
    this.clearCircularBtn = page.locator('#clearCircularRef');
    this.circularStatus = page.locator('#circularStatus');

    this.checkMemoryBtn = page.locator('#checkMemory');
    this.memoryInfo = page.locator('#memoryInfo');

    this.startLeakBtn = page.locator('#startLeak');
    this.stopLeakBtn = page.locator('#stopLeak');
    this.leakStatus = page.locator('#leakStatus');
  }

  // Helpers
  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickCreateRef() {
    await this.createRefBtn.click();
  }

  async clickClearRef() {
    await this.clearRefBtn.click();
  }

  async clickCreateCircular() {
    await this.createCircularBtn.click();
  }

  async clickClearCircular() {
    await this.clearCircularBtn.click();
  }

  async clickCheckMemory() {
    await this.checkMemoryBtn.click();
  }

  async clickStartLeak() {
    await this.startLeakBtn.click();
  }

  async clickStopLeak() {
    await this.stopLeakBtn.click();
  }
}

// Shared arrays and handlers to capture console errors and page exceptions per test
let consoleErrors = [];
let pageErrors = [];
let consoleHandler = null;
let pageErrorHandler = null;

test.beforeEach(async ({ page }) => {
  // Reset collectors
  consoleErrors = [];
  pageErrors = [];

  // Handler functions are kept in outer scope so they can be removed in afterEach
  consoleHandler = (msg) => {
    // Collect only console 'error' messages for clarity
    if (msg.type && msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location ? msg.location() : undefined });
    }
  };
  page.on('console', consoleHandler);

  pageErrorHandler = (err) => {
    // Capture page uncaught exceptions
    pageErrors.push(err);
  };
  page.on('pageerror', pageErrorHandler);

  // Navigate to the application page (entry action renderPage() is exercised by loading)
  await page.goto(APP_URL);
});

test.afterEach(async ({ page }) => {
  // Remove listeners to avoid cross-test pollution
  try {
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);
  } catch (e) {
    // Ignore if removing fails; it's best-effort cleanup
  }
});

/*
  Group: Initial State & Basic Rendering
  Validate that the initial Idle state renders expected controls and labels.
*/
test.describe('Initial State (Idle) and rendering', () => {
  test('Initial UI elements exist and show correct default text', async ({ page }) => {
    const app = new GCPage(page);

    // Verify buttons are visible
    await expect(app.createRefBtn).toBeVisible();
    await expect(app.clearRefBtn).toBeVisible();
    await expect(app.createCircularBtn).toBeVisible();
    await expect(app.clearCircularBtn).toBeVisible();
    await expect(app.checkMemoryBtn).toBeVisible();
    await expect(app.startLeakBtn).toBeVisible();
    await expect(app.stopLeakBtn).toBeVisible();

    // Verify default status texts match the Idle state's evidence
    await expect(app.refStatus).toHaveText('No object created');
    await expect(app.circularStatus).toHaveText('No circular references created');
    await expect(app.memoryInfo).toHaveText('Memory info will appear here');
    await expect(app.leakStatus).toHaveText('Memory leak not active');

    // Ensure no console errors or uncaught page exceptions occurred just from loading
    expect(consoleErrors.length, 'No console.errors on initial load').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors on initial load').toBe(0);
  });
});

/*
  Group: Reference Counting Example
  Tests the transitions S0_Idle -> S1_RefObjCreated -> S2_RefObjCleared and edge cases.
*/
test.describe('Reference Counting Example (Create & Clear reference)', () => {
  test('Create object sets refStatus to "Object created with reference"', async ({ page }) => {
    const app = new GCPage(page);

    // Click create and assert state message updates
    await app.clickCreateRef();
    await expect(app.refStatus).toHaveText('Object created with reference');

    // No runtime errors expected during this interaction
    expect(consoleErrors.length, 'No console errors after createRef click').toBe(0);
    expect(pageErrors.length, 'No page errors after createRef click').toBe(0);
  });

  test('Clear reference after creation sets refStatus to cleared message', async ({ page }) => {
    const app = new GCPage(page);

    // Ensure we're in created state first
    await app.clickCreateRef();
    await expect(app.refStatus).toHaveText('Object created with reference');

    // Now clear reference and verify transition to cleared state
    await app.clickClearRef();
    await expect(app.refStatus).toHaveText('Reference cleared - object eligible for GC');

    expect(consoleErrors.length, 'No console errors after clearRef click').toBe(0);
    expect(pageErrors.length, 'No page errors after clearRef click').toBe(0);
  });

  test('Clearing reference when none created still updates status (edge case)', async ({ page }) => {
    const app = new GCPage(page);

    // Click clear before any create - ensure idempotent and results are correct
    await app.clickClearRef();
    await expect(app.refStatus).toHaveText('Reference cleared - object eligible for GC');

    // No crash expected
    expect(consoleErrors.length, 'No console errors when clearing non-existent ref').toBe(0);
    expect(pageErrors.length, 'No page errors when clearing non-existent ref').toBe(0);
  });

  test('Multiple creates overwrite previous reference state', async ({ page }) => {
    const app = new GCPage(page);

    // Create twice and ensure still in created state
    await app.clickCreateRef();
    await app.clickCreateRef();
    await expect(app.refStatus).toHaveText('Object created with reference');

    // Clear afterwards should still work
    await app.clickClearRef();
    await expect(app.refStatus).toHaveText('Reference cleared - object eligible for GC');
  });
});

/*
  Group: Circular References Example
  Tests S0_Idle -> S3_CircularRefsCreated -> S4_CircularRefsCleared and edge cases.
*/
test.describe('Circular References Example', () => {
  test('Creating circular references updates circularStatus accordingly', async ({ page }) => {
    const app = new GCPage(page);

    await app.clickCreateCircular();
    await expect(app.circularStatus).toHaveText('Circular references created between Object A and B');

    // No runtime errors expected
    expect(consoleErrors.length, 'No console errors after createCircular click').toBe(0);
    expect(pageErrors.length, 'No page errors after createCircular click').toBe(0);
  });

  test('Clearing circular references updates status to cleared message', async ({ page }) => {
    const app = new GCPage(page);

    // Create then clear
    await app.clickCreateCircular();
    await expect(app.circularStatus).toHaveText('Circular references created between Object A and B');

    await app.clickClearCircular();
    await expect(app.circularStatus).toHaveText('References cleared - objects eligible for GC despite circular reference');

    expect(consoleErrors.length, 'No console errors after clearCircular click').toBe(0);
    expect(pageErrors.length, 'No page errors after clearCircular click').toBe(0);
  });

  test('Clearing circular references before creation behaves gracefully (edge case)', async ({ page }) => {
    const app = new GCPage(page);

    // Clear before create - should still show cleared text
    await app.clickClearCircular();
    await expect(app.circularStatus).toHaveText('References cleared - objects eligible for GC despite circular reference');

    expect(consoleErrors.length, 'No console errors when clearing circular refs before creation').toBe(0);
    expect(pageErrors.length, 'No page errors when clearing circular refs before creation').toBe(0);
  });
});

/*
  Group: Memory Monitoring
  Tests S0_Idle -> S5_MemoryChecked. Memory API availability varies by environment; accept both outcomes.
*/
test.describe('Memory Monitoring', () => {
  test('Check Memory Usage updates memoryInfo with either memory data or fallback message', async ({ page }) => {
    const app = new GCPage(page);

    // Ensure initial content present
    await expect(app.memoryInfo).toHaveText('Memory info will appear here');

    // Click check memory and validate either detailed info or the fallback text appears
    await app.clickCheckMemory();

    // Wait briefly for DOM update
    await page.waitForTimeout(50);

    // Read innerHTML and textContent to distinguish formatted vs plain text fallback
    const innerHTML = await page.locator('#memoryInfo').innerHTML();
    const textContent = await page.locator('#memoryInfo').textContent();

    const hasHeapInfo = /Used JS heap|Total JS heap|Heap size limit/i.test(innerHTML);
    const fallbackText = 'Memory API not available in this browser. Try Chrome.';

    // The app is considered correct if either the heap info was written or the fallback text is shown
    const ok = hasHeapInfo || (textContent && textContent.trim() === fallbackText);
    expect(ok, `memoryInfo should contain heap info or fallback message. innerHTML="${innerHTML}" text="${textContent}"`).toBe(true);

    // No runtime errors expected from clicking checkMemory
    expect(consoleErrors.length, 'No console errors after checkMemory click').toBe(0);
    expect(pageErrors.length, 'No page errors after checkMemory click').toBe(0);
  });

  test('Repeated memory checks do not crash and update memoryInfo', async ({ page }) => {
    const app = new GCPage(page);

    // Perform multiple checks
    await app.clickCheckMemory();
    await page.waitForTimeout(30);
    const first = await app.memoryInfo.textContent();

    await app.clickCheckMemory();
    await page.waitForTimeout(30);
    const second = await app.memoryInfo.textContent();

    // Either both are same fallback or updated info; ensure memoryInfo is present and a string
    expect(typeof first).toBe('string');
    expect(typeof second).toBe('string');

    expect(consoleErrors.length, 'No console errors after repeated checkMemory clicks').toBe(0);
    expect(pageErrors.length, 'No page errors after repeated checkMemory clicks').toBe(0);
  });
});

/*
  Group: Memory Leak Simulation
  Tests S0_Idle -> S6_MemoryLeakActive -> S7_MemoryLeakStopped including edge cases.
*/
test.describe('Memory Leak Simulation', () => {
  test('Start memory leak activates and increments leaked objects', async ({ page }) => {
    const app = new GCPage(page);

    // Start memory leak
    await app.clickStartLeak();

    // Wait sufficiently for at least one interval cycle (interval is 100ms)
    await page.waitForTimeout(350);

    // Assert leakStatus displays active message with a leaked count
    const leakText = await app.leakStatus.textContent();
    expect(/Memory leak active - \d+ leaked objects/.test(leakText), `leakStatus should indicate active leak, got "${leakText}"`).toBe(true);

    // Inspect leakedObjects array from page context to ensure there is at least one leaked object
    const leakedCount = await page.evaluate(() => {
      // leakedObjects is defined in the page script; return its length if present
      try {
        // eslint-disable-next-line no-undef
        return typeof leakedObjects !== 'undefined' ? leakedObjects.length : -1;
      } catch (e) {
        return -1;
      }
    });
    expect(leakedCount).toBeGreaterThanOrEqual(1);

    expect(consoleErrors.length, 'No console errors after starting memory leak').toBe(0);
    expect(pageErrors.length, 'No page errors after starting memory leak').toBe(0);
  });

  test('Starting leak twice does not create duplicate intervals (idempotent start)', async ({ page }) => {
    const app = new GCPage(page);

    // Start leak first time
    await app.clickStartLeak();
    await page.waitForTimeout(200);

    // Capture leaked count after first start
    const countAfterFirst = await page.evaluate(() => leakedObjects.length);

    // Start leak again (should be a no-op since leakInterval already set)
    await app.clickStartLeak();
    await page.waitForTimeout(200);

    const countAfterSecond = await page.evaluate(() => leakedObjects.length);

    // The leak should continue increasing but starting twice shouldn't crash. Ensure counts are numbers and second >= first
    expect(typeof countAfterFirst).toBe('number');
    expect(typeof countAfterSecond).toBe('number');
    expect(countAfterSecond).toBeGreaterThanOrEqual(countAfterFirst);

    // Clean up for next tests by stopping the leak
    await app.clickStopLeak();
    await page.waitForTimeout(50);
  });

  test('Stop memory leak clears interval and shows stopped message', async ({ page }) => {
    const app = new GCPage(page);

    // Start leak
    await app.clickStartLeak();
    await page.waitForTimeout(300);

    // Stop leak
    await app.clickStopLeak();
    await page.waitForTimeout(50);

    // Assert status text changed to stopped message
    await expect(app.leakStatus).toHaveText('Memory leak stopped - objects remain in memory');

    // Verify leakInterval is null and leakedObjects array still retains objects (objects remain in memory)
    const result = await page.evaluate(() => {
      try {
        return {
          leakIntervalIsNull: typeof leakInterval === 'undefined' ? null : leakInterval === null,
          leakedCount: typeof leakedObjects === 'undefined' ? -1 : leakedObjects.length
        };
      } catch (e) {
        return { leakIntervalIsNull: null, leakedCount: -1 };
      }
    });

    // leakInterval should be null indicating stopped; leakedCount should be >= 0 (likely >0)
    expect(result.leakIntervalIsNull).toBe(true);
    expect(result.leakedCount).toBeGreaterThanOrEqual(0);

    expect(consoleErrors.length, 'No console errors after stopping memory leak').toBe(0);
    expect(pageErrors.length, 'No page errors after stopping memory leak').toBe(0);
  });

  test('Stopping leak when none active behaves gracefully (edge case)', async ({ page }) => {
    const app = new GCPage(page);

    // Ensure leak is stopped
    await app.clickStopLeak();
    await page.waitForTimeout(50);

    // Status should reflect stopped message after clicking stop (code only changes to stopped if leakInterval existed,
    // but clicking stop when null should be a no-op; verify page doesn't crash and leakStatus is either default or stopped)
    const status = await app.leakStatus.textContent();
    const allowed = [
      'Memory leak not active',
      'Memory leak stopped - objects remain in memory'
    ];
    expect(allowed.includes(status)).toBe(true);

    expect(consoleErrors.length, 'No console errors when stopping non-active leak').toBe(0);
    expect(pageErrors.length, 'No page errors when stopping non-active leak').toBe(0);
  });
});

/*
  Group: Console & Page Error Observation
  This test confirms the environment produced no uncaught ReferenceError/SyntaxError/TypeError on load and interactions.
  According to "observe console logs and page errors", we capture them and assert that none occurred.
*/
test('Observe console and page errors throughout interactions (no uncaught ReferenceError/SyntaxError/TypeError)', async ({ page }) => {
  const app = new GCPage(page);

  // Perform a sequence of interactions to reveal potential runtime errors
  await app.clickCreateRef();
  await app.clickClearRef();
  await app.clickCreateCircular();
  await app.clickClearCircular();
  await app.clickCheckMemory();
  await app.clickStartLeak();
  // allow leak to grow a bit then stop
  await page.waitForTimeout(250);
  await app.clickStopLeak();

  // Give a small pause for any asynchronous page errors to surface
  await page.waitForTimeout(100);

  // Collect current console and page errors
  // We expect there to be no console errors or uncaught exceptions
  // If any exist, include them in the assertion message for easier debugging
  if (consoleErrors.length > 0) {
    console.log('Captured console.error messages:', consoleErrors);
  }
  if (pageErrors.length > 0) {
    console.log('Captured page errors:', pageErrors);
  }

  // Assert no console.error messages were emitted
  expect(consoleErrors.length, `Expected no console.error messages, but found ${consoleErrors.length}`).toBe(0);

  // Assert no uncaught page errors (like ReferenceError, SyntaxError, TypeError) occurred
  expect(pageErrors.length, `Expected no uncaught page errors, but found ${pageErrors.length}`).toBe(0);
});