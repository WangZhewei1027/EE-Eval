import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79c5282-d361-11f0-8438-11a56595a476.html';

/**
 * Page Object for the Adjacency List Visualization page
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.edgeInput = page.locator('#edgeInput');
    this.buildBtn = page.locator('#buildGraphBtn');
    this.message = page.locator('#message');
    this.adjListDisplay = page.locator('#adjListDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getTitleText() {
    return (await this.page.locator('h1').textContent()) || '';
  }

  async getPlaceholder() {
    return await this.edgeInput.getAttribute('placeholder');
  }

  async setEdges(text) {
    await this.edgeInput.fill(text);
  }

  async clickBuild() {
    // Click and wait a short time for UI updates (DOM updates are synchronous in this app)
    await Promise.all([
      this.buildBtn.click(),
      // no network activity expected; small wait for DOM mutation
      this.page.waitForTimeout(50)
    ]);
  }

  async getAdjListPreText() {
    const pre = this.adjListDisplay.locator('pre');
    if (await pre.count() === 0) return null;
    return (await pre.textContent()) || '';
  }

  async getMessageText() {
    return (await this.message.textContent()) || '';
  }

  async getMessageComputedColor() {
    return await this.message.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
  }

  async adjListDisplayIsEmpty() {
    const html = (await this.adjListDisplay.innerHTML()) || '';
    return html.trim().length === 0;
  }
}

test.describe('Adjacency List Visualization - d79c5282-d361-11f0-8438-11a56595a476', () => {
  // Collect console messages and page errors for each test to validate that runtime errors (if any) are observable.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('S0 Idle: initial render shows title and expected components', async ({ page }) => {
    // Validate initial state: page renders H1 and UI components exist with expected placeholders.
    const graph = new GraphPage(page);
    await graph.goto();

    // Title check (evidence in FSM S0_Idle)
    const title = await graph.getTitleText();
    expect(title.trim()).toBe('Adjacency List Representation of a Graph');

    // Ensure textarea exists and has the placeholder described by the FSM
    const placeholder = await graph.getPlaceholder();
    expect(placeholder).toContain('A B');
    expect(placeholder).toContain('D E');

    // Message and adjListDisplay should be present and empty initially
    expect(await graph.getMessageText()).toBe('');
    const isEmpty = await graph.adjListDisplayIsEmpty();
    expect(isEmpty).toBe(true);

    // Ensure no unhandled page errors or console errors occurred on initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1 -> S2: Valid input produces adjacency list display with sorted nodes and neighbors', async ({ page }) => {
    // This test validates:
    // - Clicking the build button parses input lines (S0->S1)
    // - buildAdjacencyList and displayAdjacencyList produce a pre block with expected text (S2)
    const graph = new GraphPage(page);
    await graph.goto();

    // Provide the example edges (explicitly set, textarea initial value is empty)
    const sample = [
      'A B',
      'A C',
      'B D',
      'C D',
      'D E'
    ].join('\n');
    await graph.setEdges(sample);

    // Precondition: message should be empty before click (S1 evidence shows clearing)
    await graph.message.evaluate((el) => { /* noop to ensure locator resolves */ });
    expect(await graph.getMessageText()).toBe('');

    // Click build to trigger parsing and display
    await graph.clickBuild();

    // The adjacency list should be displayed in a <pre> element
    const preText = await graph.getAdjListPreText();
    expect(preText).not.toBeNull();

    // Expected formatted adjacency list (nodes sorted; neighbor lists sorted)
    const expectedLines = [
      'A -> B, C',
      'B -> A, D',
      'C -> A, D',
      'D -> B, C, E',
      'E -> D'
    ];
    for (const line of expectedLines) {
      expect(preText).toContain(line);
    }

    // The message area should remain empty on successful build
    expect(await graph.getMessageText()).toBe('');

    // No page errors or console errors should have been produced
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1 -> S3: Invalid edge format produces an error message and red styling', async ({ page }) => {
    // This test validates the error transition when parseEdges throws:
    // - Error message placed in #message (S3 evidence: message.textContent = e.message)
    // - message.style.color set to 'red' (S3 evidence)
    const graph = new GraphPage(page);
    await graph.goto();

    // Provide invalid input: a line with three tokens should trigger the error
    const invalid = [
      'A B C', // invalid line
      'A B'
    ].join('\n');
    await graph.setEdges(invalid);

    // Click build to trigger parsing and catch the exception
    await graph.clickBuild();

    // The adjList display should remain empty when an error occurs
    expect(await graph.adjListDisplayIsEmpty()).toBe(true);

    // The message should contain the specific error message thrown by parseEdges
    const msgText = await graph.getMessageText();
    expect(msgText).toContain('Invalid edge format on line');
    expect(msgText).toContain('"A B C"');

    // The message element should be styled red (computed color should be RGB red)
    const color = await graph.getMessageComputedColor();
    // Accept typical 'rgb(255, 0, 0)' for 'red' or 'red' as fallback
    const isRed = color === 'rgb(255, 0, 0)' || color === 'red';
    expect(isRed).toBe(true);

    // No uncaught page error should be emitted because the code catches the exception and sets UI (handled)
    expect(pageErrors.length).toBe(0);

    // Console might have messages, but there should be no console-level errors (type 'error')
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Error cleared on subsequent successful build: message cleared and adjacency list displayed', async ({ page }) => {
    // This test validates onExit/onEnter like behavior:
    // - After an error state, performing a successful build clears the message and shows adj list (S1->S2)
    const graph = new GraphPage(page);
    await graph.goto();

    // Step 1: Trigger an error
    await graph.setEdges('BadLineOnly');
    await graph.clickBuild();
    expect((await graph.getMessageText()).length).toBeGreaterThan(0);
    expect(await graph.adjListDisplayIsEmpty()).toBe(true);

    // Step 2: Now set valid edges and click build again
    const valid = [
      'X Y',
      'Y Z'
    ].join('\n');
    await graph.setEdges(valid);

    // Click build; according to app code message.textContent is cleared at the start of the handler
    await graph.clickBuild();

    // Message should be cleared after successful build
    expect(await graph.getMessageText()).toBe('');

    // Adjacency list should be displayed and contain expected entries
    const preText = await graph.getAdjListPreText();
    expect(preText).not.toBeNull();
    expect(preText).toContain('X -> Y');
    expect(preText).toContain('Y -> X, Z');
    expect(preText).toContain('Z -> Y');

    // Ensure no page errors were thrown during this sequence
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: empty input produces empty adjacency display (no error)', async ({ page }) => {
    // This test validates behavior for empty input (edge case):
    // - No error should be thrown; adjListDisplay may show an empty pre or remain empty.
    const graph = new GraphPage(page);
    await graph.goto();

    // Set empty input explicitly
    await graph.setEdges('');
    await graph.clickBuild();

    // No error message should be shown
    expect(await graph.getMessageText()).toBe('');

    // adjListDisplay may contain an empty pre or be empty; both are acceptable, assert no text
    const preText = await graph.getAdjListPreText();
    if (preText !== null) {
      expect(preText.trim()).toBe('');
    } else {
      expect(await graph.adjListDisplayIsEmpty()).toBe(true);
    }

    // No runtime page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Runtime observation: capture console messages and page errors across interactions', async ({ page }) => {
    // This test ensures we are observing console and page errors and asserts that the app runs without runtime exceptions.
    const graph = new GraphPage(page);
    await graph.goto();

    // Perform both a successful build and an intentional invalid build to exercise code paths
    await graph.setEdges('A B\nB C');
    await graph.clickBuild();

    await graph.setEdges('Malformed Line ThreeParts here');
    await graph.clickBuild();

    // After these interactions, there should be no uncaught page errors (exceptions are handled by the app)
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console-level 'error' messages produced during normal operation
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // We do expect console messages array to be an array (may be empty); assert structure
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});