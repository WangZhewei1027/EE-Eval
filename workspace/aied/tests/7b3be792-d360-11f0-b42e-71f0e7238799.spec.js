import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3be792-d360-11f0-b42e-71f0e7238799.html';

// Page Object for interacting with the Bellman-Ford demo
class BellmanFordPage {
  constructor(page) {
    this.page = page;
    this.form = page.locator('#form');
    this.numEdgesInput = page.locator('#numEdges');
    this.createButton = page.locator('button[type="submit"]');
    this.graphDiv = page.locator('#graph');
    this.resultDiv = page.locator('#result');
  }

  // Navigate to the app and set up listeners for console & page errors externally
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Submit the form to create specified number of edge input rows
  async submitCreateEdges(num) {
    await this.numEdgesInput.fill(String(num));
    await Promise.all([
      this.page.waitForFunction(
        (n) => {
          const graph = document.getElementById('graph');
          return graph && graph.children.length >= n;
        },
        num // note: it's okay even though calculate button adds one extra; we just wait for creation
      ).catch(() => {}), // swallow timeout here, the click will still perform
      this.createButton.click()
    ]);
  }

  // Return how many child nodes are inside #graph (edge inputs + calculate button)
  async graphChildrenCount() {
    return await this.page.evaluate(() => document.getElementById('graph').children.length);
  }

  // Fill the created edge input fields with provided array of strings (like "A B 4")
  async fillEdgeInputs(edgeStrings) {
    for (let i = 0; i < edgeStrings.length; i++) {
      const inputLocator = this.graphDiv.locator('input').nth(i);
      await inputLocator.fill(edgeStrings[i]);
    }
  }

  // Click the "Calculate Shortest Paths" button and provide a dialog response for the prompt
  // Returns the pageerror (if any) and result content after click (if any)
  async clickCalculateAndHandlePrompt(startVertex = 'A') {
    let dialogHandled = false;
    // Prepare to accept the prompt when it appears
    this.page.once('dialog', async dialog => {
      dialogHandled = true;
      // Accept the prompt with provided start vertex
      await dialog.accept(startVertex);
    });

    // Click the dynamically created calculate button
    const calculateButton = this.page.locator('text=Calculate Shortest Paths');
    await calculateButton.click();

    // Give a small delay to let result DOM updates or page errors surface
    await this.page.waitForTimeout(200);

    // Get result text
    const resultText = await this.resultDiv.innerText().catch(() => '');
    return { dialogHandled, resultText };
  }

  // Utility to check whether createEdges function exists on window
  async hasCreateEdgesFunction() {
    return await this.page.evaluate(() => typeof window.createEdges === 'function');
  }

  // Utility to check whether renderPage exists on window
  async hasRenderPageFunction() {
    return await this.page.evaluate(() => typeof window.renderPage === 'function');
  }
}

test.describe('Bellman-Ford Algorithm Visualization - FSM state & transition tests', () => {
  let page;
  let bfPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // New page for each test
    page = await browser.newPage();

    // Capture console logs and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      // store the error object for later assertions
      pageErrors.push(error);
    });

    bfPage = new BellmanFordPage(page);
    await bfPage.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('S0_Idle state: initial render should show form and inputs (Idle state validations)', async () => {
    // Validate that the initial form is present and has expected components
    // This test validates the S0_Idle state's evidence and expected DOM elements

    // Form exists
    await expect(page.locator('#form')).toBeVisible();

    // numEdges input exists and default value is 4 (per HTML)
    const value = await page.locator('#numEdges').inputValue();
    expect(value).toBe('4');

    // Create Edges submit button exists
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Create Edges' })).toBeVisible();

    // The script defined createEdges function; verify existence
    const hasCreate = await bfPage.hasCreateEdgesFunction();
    expect(hasCreate).toBe(true);

    // FSM entry action mention renderPage(): verify that renderPage is NOT defined in the environment.
    // We do not modify runtime; we simply observe that renderPage is undefined (so the entry action does not run).
    const hasRender = await bfPage.hasRenderPageFunction();
    expect(hasRender).toBe(false);

    // There should not be any page errors just from loading the page
    expect(pageErrors.length).toBe(0);

    // Also record that console produced no severe errors
    const severe = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severe.length).toBeLessThanOrEqual(1); // allow non-zero incidental warnings, but ensure no flood of errors
  });

  test('S0 -> S1 transition: submitting the form creates edge inputs and a calculate button', async () => {
    // This test exercises the FormSubmit event transition from Idle to EdgesCreated (S0 -> S1)
    // It verifies createEdges(numEdges) DOM changes as evidence.

    // Submit form to create 3 edges
    await bfPage.submitCreateEdges(3);

    // After submission, graph should contain 3 input containers plus a calculate button => children length 4
    const childrenCount = await bfPage.graphChildrenCount();
    expect(childrenCount).toBe(4);

    // The Calculate Shortest Paths button should exist and be visible
    const calculateButton = page.locator('text=Calculate Shortest Paths');
    await expect(calculateButton).toBeVisible();

    // Confirm that inputs were created and have required attribute on each input
    const inputs = page.locator('#graph input');
    await expect(inputs).toHaveCount(3);

    for (let i = 0; i < 3; i++) {
      const placeholder = await inputs.nth(i).getAttribute('placeholder');
      expect(placeholder).toContain('e.g. A B 4');
    }

    // Ensure no page errors were thrown during creation
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S2 transition: calculate shortest paths with valid edges (normal flow)', async () => {
    // This test exercises CalculateButtonClick transition from EdgesCreated to CalculatePaths (S1 -> S2)
    // It fills in valid edges, clicks calculate, accepts prompt, and verifies result DOM shows distances.

    // Create 3 inputs
    await bfPage.submitCreateEdges(3);

    // Fill edges to form a small acyclic graph: A -> B (1), B -> C (2), A -> C (4)
    const edges = ['A B 1', 'B C 2', 'A C 4'];
    await bfPage.fillEdgeInputs(edges);

    // Click calculate and accept prompt with start vertex 'A'
    const { dialogHandled, resultText } = await bfPage.clickCalculateAndHandlePrompt('A');

    // Confirm the prompt was handled (Playwright handled the native prompt)
    expect(dialogHandled).toBe(true);

    // Result should contain distances from A to A, B, C (A=0, B=1, C=3)
    expect(resultText).toContain('Distance from A to A: 0');
    expect(resultText).toContain('Distance from A to B: 1');
    expect(resultText).toContain('Distance from A to C: 3');

    // There should be no page errors in the normal successful flow
    expect(pageErrors.length).toBe(0);
  });

  test('Invalid/malformed edge input: application handles gracefully without throwing page errors', async () => {
    // This test creates edges but intentionally provides malformed weights to validate behavior and robustness.
    // We expect the application to not crash with a runtime exception (no pageerror) for typical malformed input.

    // Create 2 edge inputs
    await bfPage.submitCreateEdges(2);

    // Fill one valid and one malformed input
    const edges = ['A B 5', 'B C not_a_number'];
    await bfPage.fillEdgeInputs(edges);

    // Click calculate, accept prompt with 'A'
    const { dialogHandled, resultText } = await bfPage.clickCalculateAndHandlePrompt('A');

    // Prompt must have been handled
    expect(dialogHandled).toBe(true);

    // Result should contain an entry for vertices that were discovered.
    // Even with malformed number, the code is defensive; it will not crash (no negative cycle thrown here).
    // We assert that output contains distances lines (may be Infinity for unreachable nodes).
    expect(resultText.length).toBeGreaterThan(0);

    // Ensure no unhandled page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: negative-weight cycle should surface a page error when calculating', async () => {
    // This test constructs a graph with a negative-weight cycle to trigger the explicit Error thrown by bellmanFord.
    // We assert that the error surfaces as an unhandled page error (pageerror event captured).

    // Create 3 inputs (will result in 4 children including calculate button)
    await bfPage.submitCreateEdges(3);

    // Construct edges that form a negative-weight cycle: A->B 1, B->C -2, C->A 0 => cycle sum -1
    const edges = ['A B 1', 'B C -2', 'C A 0'];
    await bfPage.fillEdgeInputs(edges);

    // Prepare to wait for a page error because bellmanFord throws when a negative-weight cycle is detected.
    let capturedPageError = null;
    const waitForPageError = new Promise(resolve => {
      const handler = err => {
        capturedPageError = err;
        resolve(err);
      };
      page.once('pageerror', handler);
      // safety timeout to avoid hanging if error doesn't occur
      setTimeout(() => resolve(null), 1500);
    });

    // Click calculate and accept prompt with 'A' (the prompt will be accepted)
    const clickPromise = bfPage.clickCalculateAndHandlePrompt('A');

    // Wait for either click to finish or page error to appear
    const [clickResult] = await Promise.all([clickPromise, waitForPageError]);

    // If a page error was thrown, capturedPageError should be set
    if (capturedPageError) {
      // Ensure the message matches the expected thrown error from bellmanFord
      expect(String(capturedPageError.message)).toContain('Graph contains a negative-weight cycle');
    } else {
      // If no pageerror captured, fail the test because FSM expects the algorithm to detect negative cycle and throw
      throw new Error('Expected a pageerror for negative-weight cycle, but none occurred.');
    }

    // Even if the error occurred, ensure the prompt was shown and handled
    expect(clickResult.dialogHandled).toBe(true);
  });
});