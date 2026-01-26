import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b146d0-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Bellman-Ford Interactive Application (FSM validations)', () => {
  // We'll attach console and pageerror listeners before each test so we can
  // observe the page's runtime behavior (entry actions, event handlers, logs, errors).
  test.beforeEach(async ({ page }) => {
    // No-op here; listeners are attached within each test to ensure we capture
    // events from the very beginning (including those emitted during page load).
  });

  // Test the initial state S0_Idle: page renders and entry action (renderPage -> initial algorithm run)
  test('S0_Idle: Page renders, button present, and initial bellmanFord run logs distances', async ({ page }) => {
    // Collect console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page (the script will run on load)
    await page.goto(APP_URL);

    // Verify the demonstration button exists and has expected text (evidence for S0_Idle)
    const button = await page.locator('#demonstration-button');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Run the Bellman-Ford Algorithm');

    // Wait briefly to ensure page load logs are captured
    await page.waitForTimeout(200);

    // Assert that initial script computed distances and logged them.
    // The page script does: let distances = bellmanFord(graph, 'A'); console.log(distances);
    // We expect at least one console.log that includes keys like 'A' or 'B' or the numeric distances.
    const hasInitialDistancesLog = consoleMessages.some(m =>
      m.type === 'log' && /A|B|C|D|0|2|3|6/.test(m.text)
    );
    expect(hasInitialDistancesLog).toBeTruthy();

    // Also verify the global distances variable exists and has the expected values by evaluating in page context.
    const distances = await page.evaluate(() => {
      // Access the global variable 'distances' defined by the page script.
      // This reads the exact runtime value without modifying code.
      return typeof distances !== 'undefined' ? distances : null;
    });

    // Expect the algorithm to have produced the known shortest paths from 'A'
    expect(distances).not.toBeNull();
    expect(distances).toEqual({ A: 0, B: 2, C: 3, D: 6 });

    // Ensure no page errors occurred during initial load
    expect(pageErrors.length).toBe(0);
  });

  // Test transition: RunAlgorithm (clicking the demonstration button should run the algorithm and log per-node distances)
  test('Transition RunAlgorithm: clicking button triggers bellmanFord and logs expected messages (S0 -> S1)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Clear any initial logs in our in-memory capture so we can focus on the click action logs
    await page.waitForTimeout(100);
    // Note: we simply continue to use the array; just capture counts before click
    const beforeClickCount = consoleMessages.length;

    // Click the demonstration button to trigger the event (RunAlgorithm)
    await page.click('#demonstration-button');

    // Wait for the handler to log messages
    await page.waitForTimeout(200);

    // Collect the new console messages after the click
    const newMessages = consoleMessages.slice(beforeClickCount);

    // Expect to see the explicit string logged by the click handler
    // The handler logs: 'Shortest distances from ' + sourceNode + ' to all other nodes:'
    const hasHeaderLog = newMessages.some(m =>
      m.type === 'log' && m.text.includes('Shortest distances from A to all other nodes')
    );
    expect(hasHeaderLog).toBeTruthy();

    // The handler also logs each node as "node: distance", expect those messages for A,B,C,D
    const expectedPerNode = ['A: 0', 'B: 2', 'C: 3', 'D: 6'];
    for (const expected of expectedPerNode) {
      const found = newMessages.some(m => m.type === 'log' && m.text.includes(expected));
      expect(found).toBeTruthy();
    }

    // Ensure no page errors resulted from clicking
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: clicking the button multiple times should consistently produce logs and not produce errors or unexpected state
  test('Edge case: multiple clicks produce repeated outputs and remain error-free', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Click the button three times in succession
    const clickCount = 3;
    for (let i = 0; i < clickCount; i++) {
      await page.click('#demonstration-button');
      // small delay between clicks to let logs appear
      await page.waitForTimeout(120);
    }

    // Gather logs that correspond to the 'Shortest distances' header; there should be clickCount such headers
    const headerLogs = consoleMessages.filter(m =>
      m.type === 'log' && m.text.includes('Shortest distances from A to all other nodes')
    );
    expect(headerLogs.length).toBeGreaterThanOrEqual(clickCount);

    // Ensure each per-node message appears at least clickCount times in total logs
    const expectedPerNode = ['A: 0', 'B: 2', 'C: 3', 'D: 6'];
    for (const expected of expectedPerNode) {
      const count = consoleMessages.filter(m => m.type === 'log' && m.text.includes(expected)).length;
      expect(count).toBeGreaterThanOrEqual(clickCount);
    }

    // Still no page errors
    expect(pageErrors.length).toBe(0);
  });

  // Error scenario / robustness check: call bellmanFord with a non-existent source (should not throw, but produce Infinity distances)
  test('Robustness: bellmanFord invoked with unknown source returns Infinity distances (no runtime error)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Invoke bellmanFord in page context with a source that does not exist in the graph ('Z').
    // We do not alter any functions; we only call the existing function as the page exposes it.
    const resultForUnknownSource = await page.evaluate(() => {
      // If bellmanFord or graph is missing for some reason, this will throw inside the page and be captured as a pageerror.
      try {
        return bellmanFord(graph, 'Z');
      } catch (e) {
        // Return a sentinel so the test can assert that an exception occurred in page context.
        return { __threw: String(e) };
      }
    });

    // If the function executed normally, it should return an object whose values are Infinity.
    if (resultForUnknownSource && resultForUnknownSource.__threw) {
      // If an exception was thrown, fail the test explicitly (we expect the implementation to handle unknown sources gracefully).
      throw new Error('bellmanFord threw an exception when called with unknown source: ' + resultForUnknownSource.__threw);
    } else {
      // Expect that all nodes are Infinity because source 'Z' doesn't match any node in the defined graph.
      expect(Object.keys(resultForUnknownSource).length).toBeGreaterThan(0);
      for (const val of Object.values(resultForUnknownSource)) {
        expect(val).toBe(Number.POSITIVE_INFINITY);
      }
    }

    // Confirm that no page-level exceptions were emitted during this invocation
    expect(pageErrors.length).toBe(0);
  });

  // Verify that the FSM transition evidence is present: event handler is registered on the button
  test('FSM evidence: button has click event handler registered (cannot inspect handler directly, but clicking triggers expected behavior)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // We can't programmatically inspect listeners directly in a cross-browser safe way without modifying page,
    // but we can assert that clicking produces the expected transition output.
    await page.click('#demonstration-button');
    await page.waitForTimeout(150);

    // Check that the click resulted in the known header log
    const headerLogExists = consoleMessages.some(m =>
      m.type === 'log' && m.text.includes('Shortest distances from A to all other nodes')
    );
    expect(headerLogExists).toBeTruthy();

    // No page errors
    expect(pageErrors.length).toBe(0);
  });
});