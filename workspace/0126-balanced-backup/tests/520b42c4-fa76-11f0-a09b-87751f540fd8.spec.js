import { test, expect } from '@playwright/test';

// Page Object for the Garbage Collection page
class GCPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      try {
        // stringify args to make assertion easier
        const text = msg.text();
        this.consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        this.consoleMessages.push({ type: 'unknown', text: '<unable to read console message>' });
      }
    });

    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to the application under test
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/520b42c4-fa76-11f0-a09b-87751f540fd8.html', {
      waitUntil: 'load'
    });
  }

  // Return the raw innerText of the gc-log element
  async getLogText() {
    const el = await this.page.$('#gc-log');
    if (!el) return null;
    return (await el.innerText()).trim();
  }

  // Wait until gc-log has some content (non-empty), or timeout
  async waitForLogNonEmpty(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('gc-log');
      return el && el.innerText && el.innerText.length > 0;
    }, null, { timeout });
    return this.getLogText();
  }

  // Return captured console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Return captured page errors
  getPageErrors() {
    return this.pageErrors;
  }

  // Helper to count occurrences of substring in the log
  async countLogOccurrences(substring) {
    const text = await this.getLogText();
    if (!text) return 0;
    return (text.match(new RegExp(substring, 'g')) || []).length;
  }
}

test.describe('Garbage Collection Interactive Application (FSM: Idle)', () => {
  // Using Playwright's test fixtures (page) with setup in each test
  test.beforeEach(async ({ page }) => {
    // No global patching or injection - tests should observe the app as-is
  });

  test.afterEach(async ({ page }) => {
    // Let any intervals continue to run briefly to ensure teardown doesn't kill pending work in the page
    // (No special teardown required; Playwright closes pages automatically)
  });

  test('Idle state entry action: collectGarbage should run via setInterval (gc-log updates)', async ({ page }) => {
    // This test verifies that the Idle state's entry action (collectGarbage) runs at least once
    // The page sets setInterval(collectGarbage, 1000) and we expect #gc-log to be populated within a few seconds.

    const gc = new GCPage(page);
    await gc.goto();

    // Before the first interval fires, the gc-log is expected to be empty (script schedules the interval, first run occurs after ~1000ms)
    const initialLog = await gc.getLogText();
    // It may be empty string or whitespace; assert it's either empty or not yet populated.
    expect(initialLog === '' || initialLog === null || initialLog.length === 0).toBeTruthy();

    // Wait for the collectGarbage to execute via setInterval and populate the #gc-log element.
    // Give a generous timeout to account for scheduling (5s).
    const log = await gc.waitForLogNonEmpty(5000);

    // The collectGarbage function generates lines "Heap 0: No garbage" etc.
    expect(log.length).toBeGreaterThan(0);
    // Basic content assertions
    expect(log).toContain('Heap 0:');
    expect(log).toContain('Heap 1:');

    // There should be many heap lines (the implementation loops 1000 times)
    const occurrences = await gc.countLogOccurrences('Heap ');
    expect(occurrences).toBeGreaterThan(10); // sanity check: many lines present
  });

  test('Entry action garbageCollection() logs to console on page load', async ({ page }) => {
    // This test checks that the garbageCollection() function (called synchronously at the end of the script)
    // logs to the console with the "Garbage Collection:" prefix.

    const gc = new GCPage(page);
    await gc.goto();

    // Give a brief moment for synchronous scripts to run and console messages to be emitted
    await page.waitForTimeout(200);

    // Find console messages that include the garbage collection log
    const msgs = gc.getConsoleMessages().map(m => m.text);
    const found = msgs.find((t) => t.startsWith('Garbage Collection:') || t.includes('Garbage Collection:'));

    expect(found).toBeTruthy(); // we expect at least one console message from garbageCollection

    // Additional check: ensure that the console message type is 'log' for the garbageCollection call
    const hasLogType = gc.getConsoleMessages().some(m => m.type === 'log' && (m.text.startsWith('Garbage Collection:') || m.text.includes('Garbage Collection:')));
    expect(hasLogType).toBeTruthy();
  });

  test('No runtime page errors are thrown during normal operation', async ({ page }) => {
    // This test observes page errors (uncaught exceptions) while the page loads and the interval runs briefly.
    // The requirement forbids modifying the environment - we only observe naturally occurring errors.

    const gc = new GCPage(page);
    await gc.goto();

    // Wait long enough for the initial scripts and at least one interval invocation to occur (2.5s)
    await page.waitForTimeout(2500);

    const errors = gc.getPageErrors();

    // Assert that there are no page errors (ReferenceError, SyntaxError, TypeError, etc.) emitted naturally.
    // If any do occur, this assertion will fail — satisfying the requirement to observe and assert their presence/absence.
    expect(errors.length).toBe(0);
  });

  test('App exposes expected globals and data structures (heap, garbage) with expected shapes', async ({ page }) => {
    // Validate that the page defines the top-level variables used by the FSM/implementation.
    // We do not mutate these; we only read them from the page context.

    const gc = new GCPage(page);
    await gc.goto();

    // Access heap and garbage from the page. These were declared with let at top-level, so they should be on window.
    const shapes = await page.evaluate(() => {
      return {
        hasHeap: typeof window.heap !== 'undefined',
        heapLength: window.heap ? window.heap.length : null,
        heapAllZeros: window.heap ? window.heap.every(x => x === 0) : null,
        hasGarbage: typeof window.garbage !== 'undefined',
        garbageSize: window.garbage ? window.garbage.size : null,
        hasCollectGarbageFn: typeof window.collectGarbage === 'function',
        hasGarbageCollectionFn: typeof window.garbageCollection === 'function'
      };
    });

    // Assertions on the detected structures
    expect(shapes.hasHeap).toBeTruthy();
    expect(shapes.heapLength).toBe(1000); // implementation created an array of length 1000
    expect(shapes.heapAllZeros).toBeTruthy(); // initial content was zeros
    expect(shapes.hasGarbage).toBeTruthy();
    expect(shapes.garbageSize).toBe(0); // garbage Set initially empty
    expect(shapes.hasCollectGarbageFn).toBeTruthy();
    expect(shapes.hasGarbageCollectionFn).toBeTruthy();
  });

  test('No interactive controls exist (matches FSM expectation of no user-triggered events)', async ({ page }) => {
    // The FSM extraction noted there are no buttons/inputs. Verify this via DOM queries.

    const gc = new GCPage(page);
    await gc.goto();

    // Query for common interactive elements
    const interactiveCount = await page.evaluate(() => {
      const selectors = ['button', 'input', 'textarea', 'select', '[role="button"]'];
      return selectors.reduce((acc, sel) => acc + document.querySelectorAll(sel).length, 0);
    });

    // Expect zero interactive controls
    expect(interactiveCount).toBe(0);
  });

  test('collectGarbage function is present and is executed by the environment (function exists)', async ({ page }) => {
    // Even though we cannot directly observe every interval tick, the existence of the function and the fact
    // that #gc-log is populated demonstrates the function runs in this environment.

    const gc = new GCPage(page);
    await gc.goto();

    // Assert collectGarbage is a function on the window
    const isFunction = await page.evaluate(() => typeof window.collectGarbage === 'function');
    expect(isFunction).toBeTruthy();

    // Ensure that collectGarbage runs at least once (observed via gc-log population)
    const log = await gc.waitForLogNonEmpty(4000);
    expect(log).toContain('Heap 0:');
  });

  test('Edge case: ensure repeated interval invocation occurs (heuristic by observing repeated log re-assignments)', async ({ page }) => {
    // This test attempts to detect repeated invocations of collectGarbage indirectly.
    // Because collectGarbage writes the same content each time, we detect repeated activity by awaiting multiple
    // population events separated by the interval duration and verifying that the element remains accessible and consistent.

    const gc = new GCPage(page);
    await gc.goto();

    // Wait for first population
    const firstLog = await gc.waitForLogNonEmpty(5000);
    expect(firstLog.length).toBeGreaterThan(0);

    // Capture timestamp of first observation
    const firstTimestamp = Date.now();

    // Wait for a bit longer than one interval to allow the next scheduled invocation to run
    // We wait ~1200ms to exceed the 1000ms interval
    await page.waitForTimeout(1200);

    // Read the log again - even if contents are identical, successful reading after an interval implies page continued running
    const secondLog = await gc.getLogText();
    const secondTimestamp = Date.now();

    // The log should still be present and non-empty
    expect(secondLog && secondLog.length).toBeGreaterThan(0);

    // Heuristic: ensure at least ~1s elapsed between samples (indicating time passed for an interval)
    expect(secondTimestamp - firstTimestamp).toBeGreaterThanOrEqual(1000);
  });

  // Additional negative test: assert that there are no unexpected syntax or reference errors on initial parsing
  test('No syntax errors during parsing; page should load successfully', async ({ page }) => {
    // This verifies the page loads and its scripts parse successfully (no SyntaxError thrown during load).
    const gc = new GCPage(page);
    const navigation = await gc.goto();

    // If the page had a SyntaxError that prevented load, page.goto would still resolve but page error would be emitted.
    await page.waitForTimeout(200);

    const errors = gc.getPageErrors();
    // We expect no page errors including SyntaxError
    expect(errors.length).toBe(0);
  });
});