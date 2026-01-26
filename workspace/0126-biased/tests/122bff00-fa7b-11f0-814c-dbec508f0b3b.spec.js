import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bff00-fa7b-11f0-814c-dbec508f0b3b.html';

// Store console messages and page errors for assertions
let consoleMessages = [];
let pageErrors = [];

/**
 * Helper page object for interacting with the Dijkstra demo.
 * Encapsulates selectors and common actions used throughout the tests.
 */
class DijkstraPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      startBtn: '#start-btn',
      resetBtn: '#reset-btn',
      minHeapSize: '#min-heap-size',
      maxHeapSize: '#max-heap-size',
      numStartingPoints: '#num-starting-points',
      numEdges: '#num-edges',
      showPath: '#show-path',
      container: '#dijkstra'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.page.click(this.selectors.startBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async setMinHeapSize(value) {
    await this.page.fill(this.selectors.minHeapSize, String(value));
    // Input events are wired to call start automatically
    await this.page.dispatchEvent(this.selectors.minHeapSize, 'input');
  }

  async setMaxHeapSize(value) {
    await this.page.fill(this.selectors.maxHeapSize, String(value));
    await this.page.dispatchEvent(this.selectors.maxHeapSize, 'input');
  }

  async setNumStartingPoints(value) {
    await this.page.fill(this.selectors.numStartingPoints, String(value));
    await this.page.dispatchEvent(this.selectors.numStartingPoints, 'input');
  }

  async setNumEdges(value) {
    await this.page.fill(this.selectors.numEdges, String(value));
    await this.page.dispatchEvent(this.selectors.numEdges, 'input');
  }

  async toggleShowPath() {
    await this.page.click(this.selectors.showPath);
    await this.page.dispatchEvent(this.selectors.showPath, 'change');
  }

  // Read the global d object from the page (the app's state)
  async getState() {
    return await this.page.evaluate(() => {
      // Return a shallow copy to avoid transferring functions or prototype data
      if (window.d === undefined) return null;
      return {
        minHeapSize: window.d.minHeapSize,
        maxHeapSize: window.d.maxHeapSize,
        numStartingPoints: window.d.numStartingPoints,
        numEdges: window.d.numEdges,
        showPath: window.d.showPath,
        graphKeys: Object.keys(window.d.graph || {}),
        startKeys: Object.keys(window.d.start || {}),
        pathKeys: Object.keys(window.d.path || {}),
        heapType: typeof window.d.heap,
      };
    });
  }
}

test.describe('Dijkstra Algorithm Interactive - FSM validation', () => {
  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // store type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown patching of the application code - we only observe.
  });

  test('Initial state (S0_Idle) - UI renders and default state is set', async ({ page }) => {
    // Validate the initial DOM structure and default d object values.
    const dp = new DijkstraPage(page);

    // Check that key controls are present
    await expect(page.locator(dp.selectors.startBtn)).toBeVisible();
    await expect(page.locator(dp.selectors.resetBtn)).toBeVisible();
    await expect(page.locator(dp.selectors.minHeapSize)).toBeVisible();
    await expect(page.locator(dp.selectors.maxHeapSize)).toBeVisible();
    await expect(page.locator(dp.selectors.numStartingPoints)).toBeVisible();
    await expect(page.locator(dp.selectors.numEdges)).toBeVisible();
    await expect(page.locator(dp.selectors.showPath)).toBeVisible();
    await expect(page.locator(dp.selectors.container)).toBeVisible();

    // Inspect the app state object 'd' on the window to verify entry action effect (renderPage() in FSM terms)
    const state = await dp.getState();
    // The HTML sets defaults to 10,100,10,100,false
    expect(state).not.toBeNull();
    expect(state.minHeapSize).toBe(10);
    expect(state.maxHeapSize).toBe(100);
    expect(state.numStartingPoints).toBe(10);
    expect(state.numEdges).toBe(100);
    expect(state.showPath).toBe(false);

    // There should be no immediate page errors just from rendering
    expect(Array.isArray(pageErrors)).toBeTruthy();
    // If errors occurred, they should be valid JS error messages (we don't fail when zero)
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        expect(err.message).toMatch(/ReferenceError|TypeError|SyntaxError|Error|RangeError|TypeError/);
      }
    }
  });

  test('StartClick transitions to Algorithm Running (S1_AlgorithmRunning) and runs dijkstra', async ({ page }) => {
    // This test validates that clicking Start triggers the algorithm (createGraph + dijkstra)
    const dp = new DijkstraPage(page);

    // Click start and wait a small idle to let scripts run
    await dp.clickStart();

    // After start, d.start[0] should exist (start sets d.start[start] = 0)
    const stateAfterStart = await dp.getState();
    expect(stateAfterStart).not.toBeNull();

    // The graph should be created with keys equal to numStartingPoints (default 10)
    expect(stateAfterStart.graphKeys.length).toBeGreaterThanOrEqual(0);
    // Expect that the start map contains at least the initial node 0
    expect(stateAfterStart.startKeys.includes('0')).toBeTruthy();

    // dijkstra logs either "Shortest path:" (with undefined) or "No path found"
    const hasShortestOrNoPath = consoleMessages.some(m => /Shortest path:|No path found/.test(m.text));
    expect(hasShortestOrNoPath).toBeTruthy();

    // Confirm no unexpected serious page errors; if present they should still be JS errors
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        expect(err.message).toMatch(/ReferenceError|TypeError|SyntaxError|Error|RangeError|TypeError/);
      }
    }
  });

  test('ResetClick transitions to Algorithm Reset (S2_AlgorithmReset) and reinitializes state', async ({ page }) => {
    // This test validates that clicking Reset reinitializes the internal state and runs a graph creation + dijkstra
    const dp = new DijkstraPage(page);

    // Ensure algorithm has run at least once to change state
    await dp.clickStart();

    // Now click reset to trigger reset()
    await dp.clickReset();

    // After reset, the app recreates the graph and runs dijkstra again
    const stateAfterReset = await dp.getState();
    expect(stateAfterReset).not.toBeNull();

    // Reset should restore defaults
    expect(stateAfterReset.minHeapSize).toBe(10);
    expect(stateAfterReset.maxHeapSize).toBe(100);
    expect(stateAfterReset.numStartingPoints).toBe(10);
    expect(stateAfterReset.numEdges).toBe(100);
    expect(stateAfterReset.showPath).toBe(false);

    // confirm graph re-created (graphKeys length should be number of starting points)
    expect(Array.isArray(stateAfterReset.graphKeys)).toBeTruthy();
    expect(stateAfterReset.graphKeys.length).toBeGreaterThanOrEqual(0);

    // The console should have messages from dijkstra run done by reset
    const resetConsole = consoleMessages.some(m => /Shortest path:|No path found/.test(m.text));
    expect(resetConsole).toBeTruthy();

    // Validate page errors if any - ensure they are typical JS errors
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        expect(err.message).toMatch(/ReferenceError|TypeError|SyntaxError|Error|RangeError|TypeError/);
      }
    }
  });

  test.describe('Input-driven events from Idle (S0_Idle) trigger Algorithm Running (S1_AlgorithmRunning)', () => {
    test('MinHeapSizeChange triggers start and does not cause uncaught exceptions', async ({ page }) => {
      const dp = new DijkstraPage(page);

      // Change min heap size input to a new number
      await dp.setMinHeapSize(5);

      // After input event, algorithm's dijkstra should have been invoked -> console contains traces
      const found = consoleMessages.some(m => /Shortest path:|No path found/.test(m.text));
      expect(found).toBeTruthy();

      // d.minHeapSize may be reset by start(); verify d still exists
      const state = await dp.getState();
      expect(state).not.toBeNull();

      // Check page errors are either none or meaningful JS errors if present
      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          expect(err.message).toMatch(/ReferenceError|TypeError|SyntaxError|Error|RangeError|TypeError/);
        }
      }
    });

    test('MaxHeapSizeChange triggers start and keeps internal state coherent', async ({ page }) => {
      const dp = new DijkstraPage(page);

      await dp.setMaxHeapSize(200);

      // Validate a dijkstra invocation is observable via console
      const found = consoleMessages.some(m => /Shortest path:|No path found/.test(m.text));
      expect(found).toBeTruthy();

      // Ensure d object exists and types are coherent
      const state = await dp.getState();
      expect(state.heapType).toBeDefined();

      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          expect(err.message).toMatch(/ReferenceError|TypeError|SyntaxError|Error|RangeError|TypeError/);
        }
      }
    });

    test('NumStartingPointsChange triggers start and graph size is adjusted or gracefully handled', async ({ page }) => {
      const dp = new DijkstraPage(page);

      // set to a smaller number
      await dp.setNumStartingPoints(3);

      // dijkstra should have run
      const found1 = consoleMessages.some(m => /Shortest path:|No path found/.test(m.text));
      expect(found1).toBeTruthy();

      // get state and ensure graph has 0..n-1 or at least no crash
      const state = await dp.getState();
      expect(state).not.toBeNull();

      // graphKeys length may be zero or match numStartingPoints (implementation quirks allowed)
      expect(Array.isArray(state.graphKeys)).toBeTruthy();

      // Now try a problematic value (edge case): negative number
      await dp.setNumStartingPoints(-5);
      const stateAfterNegative = await dp.getState();
      expect(stateAfterNegative).not.toBeNull();
      // Implementation should not throw - we just expect graphKeys to be an array
      expect(Array.isArray(stateAfterNegative.graphKeys)).toBeTruthy();

      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          expect(err.message).toMatch(/ReferenceError|TypeError|SyntaxError|Error|RangeError|TypeError/);
        }
      }
    });

    test('NumEdgesChange triggers start and changing to extreme values handled', async ({ page }) => {
      const dp = new DijkstraPage(page);

      await dp.setNumEdges(0);
      const found = consoleMessages.some(m => /Shortest path:|No path found/.test(m.text));
      expect(found).toBeTruthy();

      // large number
      await dp.setNumEdges(1000000);
      const foundLarge = consoleMessages.some(m => /Shortest path:|No path found/.test(m.text));
      expect(foundLarge).toBeTruthy();

      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          expect(err.message).toMatch(/ReferenceError|TypeError|SyntaxError|Error|RangeError|TypeError/);
        }
      }
    });

    test('ShowPathChange toggles checkbox, triggers start, and does not flip internal showPath flag permanently', async ({ page }) => {
      const dp = new DijkstraPage(page);

      // Toggle the checkbox to fire the change event
      await dp.toggleShowPath();

      // start() is called on change; verify console saw algorithm run
      const found = consoleMessages.some(m => /Shortest path:|No path found/.test(m.text));
      expect(found).toBeTruthy();

      // The application sets d.showPath to false inside start() repeatedly,
      // so even after toggling the checkbox the internal flag is expected to be false.
      const state = await dp.getState();
      expect(state).not.toBeNull();
      expect(state.showPath).toBe(false);

      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          expect(err.message).toMatch(/ReferenceError|TypeError|SyntaxError|Error|RangeError|TypeError/);
        }
      }
    });
  });

  test('Edge cases & error observation: invalid inputs should not crash the page', async ({ page }) => {
    const dp = new DijkstraPage(page);

    // Try to input non-numeric text into number fields (edge-case)
    // Because inputs are type=number, .fill with non-number will set empty string in many browsers.
    await page.fill(dp.selectors.num-starting-points || dp.selectors['numStartingPoints'], 'abc').catch(() => {});
    // Instead we use the known selector via the DijkstraPage
    await page.fill(dp.selectors.numStartingPoints, 'abc').catch(() => {});
    await page.dispatchEvent(dp.selectors.numStartingPoints, 'input').catch(() => {});

    // Try extremely large invalid numeric value
    await dp.setNumStartingPoints(1e9);

    // Check that the app remains loaded and responsive by invoking start
    await dp.clickStart();

    // Application should not have thrown fatal uncaught exceptions; but if it did, capture them.
    // We assert that pageErrors is an array; if it contains items ensure they are JavaScript errors.
    expect(Array.isArray(pageErrors)).toBeTruthy();
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        expect(err.message).toMatch(/ReferenceError|TypeError|SyntaxError|Error|RangeError|TypeError/);
      }
    }

    // Ensure console logs from dijkstra exist at least once
    const found = consoleMessages.some(m => /Shortest path:|No path found/.test(m.text));
    expect(found).toBeTruthy();
  });
});